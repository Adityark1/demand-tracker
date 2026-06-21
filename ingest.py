import os
import imaplib
import email
import json
import time
import logging
import urllib.request
from email.header import decode_header
from email.utils import parseaddr
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

from dotenv import load_dotenv
from openai import OpenAI
from sqlalchemy import create_engine, Column, Integer, String, Boolean, Text, DateTime, func
from sqlalchemy.orm import declarative_base, sessionmaker

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

load_dotenv()

# =========================
# ENV VARIABLES
# =========================
EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
BACKEND_INTERNAL_URL = os.getenv("BACKEND_INTERNAL_URL", "http://127.0.0.1:8000")

# =========================
# DATABASE MODELS
# =========================
Base = declarative_base()

class ApprovedSender(Base):
    __tablename__ = 'approved_senders'
    id = Column(Integer, primary_key=True)
    email_address = Column(String(255), unique=True, nullable=False, index=True)
    client_name = Column(String(255), nullable=True)

class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True)
    client_name = Column(Text, nullable=False)
    domain = Column(Text)
    account_manager = Column(Text)
    active = Column(Boolean, default=True)

class Demand(Base):
    __tablename__ = 'demands'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    demand_id = Column(String(50), unique=True, nullable=False)
    client_name = Column(String(255), default="Unassigned")
    sender_email = Column(String(255), nullable=False)
    role = Column(String(255), default="Unknown Role")
    positions = Column(Integer, default=1)
    location = Column(String(255), nullable=True)
    priority = Column(String(50), default="Medium")
    status = Column(String(50), default="New")
    summary = Column(Text, nullable=True)
    source_type = Column(String(50), default="UNKNOWN")
    message_id = Column(String(255), unique=True, nullable=False, index=True)
    requisition_created = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)

# =========================
# HELPER UTILITIES
# =========================
def normalize_email(sender_raw: str) -> str:
    """Extracts, strips, and lowercases raw sender strings."""
    _, email_address = parseaddr(sender_raw)
    return email_address.strip().lower()

def extract_domain(email_address: str) -> str:
    """Safely extracts domain name from normalized email string."""
    if "@" not in email_address:
        return ""
    return email_address.split("@")[-1]

def get_fallback_summary(body_text: str) -> str:
    """Returns the first 2-3 lines of email body as summary fallback."""
    lines = [line.strip() for line in body_text.splitlines() if line.strip()]
    return " ".join(lines[:3])

def determine_priority(subject: str, body: str) -> str:
    """Sets High priority if explicit urgency keywords are hit."""
    content = f"{subject} {body}".lower()
    urgency_keywords = ["urgent", "immediate", "asap"]
    if any(keyword in content for keyword in urgency_keywords):
        return "High"
    return "Medium"

def trigger_live_broadcast(demand_record: Demand):
    """Dispatches a non-blocking internal HTTP notification to trigger the websocket broadcast."""
    payload = {
        "type": "NEW_DEMAND",
        "data": {
            "id": demand_record.id,
            "demand_id": demand_record.demand_id,
            "client_name": demand_record.client_name,
            "role": demand_record.role,
            "status": demand_record.status,
            "priority": demand_record.priority
        }
    }
    try:
        req = urllib.request.Request(
            f"{BACKEND_INTERNAL_URL.rstrip('/')}/api/internal/broadcast",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=2) as response:
            if response.status == 200:
                logger.info("Real-time WebSocket event broadcast triggered successfully.")
    except Exception as e:
        logger.warning(f"Could not broadcast real-time update over HTTP: {e}")

# =========================
# GMAIL CONNECTION
# =========================
def connect_to_gmail() -> Optional[imaplib.IMAP4_SSL]:
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(EMAIL_USER, EMAIL_PASS)
        return mail
    except Exception as e:
        logger.error(f"Gmail connection failed: {e}")
        return None

# =========================
# LLM DATA EXTRACTION
# =========================
def parse_email_body(subject: str, body_text: str) -> Dict[str, Any]:
    client = OpenAI(api_key=GROQ_API_KEY, base_url="https://api.groq.com/openai/v1")

    prompt = f"""
You are an AI recruitment intake system extraction layer.
Extract structured recruitment information from the email context.

Return ONLY a valid JSON block matching this schema:
{{
    "is_hiring_demand": true,
    "role": "",
    "positions": 1,
    "location": "",
    "summary": ""
}}

Rules:
- is_hiring_demand must be true or false.
- positions must be an integer. If ambiguous or missing, default to 1.
- Do not include markdown code fences or conversational prose. 

Subject: {subject}
Email Body:
{body_text}
"""
    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a precise data extraction assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0
        )
        result = completion.choices[0].message.content.strip()
        
        if result.startswith("```"):
            result = result.replace("```json", "", 1).replace("```", "", 1).strip()
            
        return json.loads(result)
    except Exception as e:
        logger.error(f"Groq parsing failed, switching to default system fallback: {e}")
        return {"is_hiring_demand": True, "fallback": True}

# =========================
# CORE PROCESSING PIPELINE
# =========================
def process_emails():
    mail = connect_to_gmail()
    if not mail:
        return

    db = SessionLocal()
    metrics = {"processed": 0, "skipped": 0, "errors": 0}

    try:
        mail.select("inbox")
        
        # 1. READ LAST SCAN TIME FROM DATABASE
        # Fetch the creation time of the most recent demand record processed.
        last_scan_time = db.query(func.max(Demand.created_at)).scalar()
        
        if last_scan_time:
            # Look back an extra 24 hours from the last record to ensure no emails 
            # are missed due to processing delays or timezone alignment.
            search_date = (last_scan_time - timedelta(days=1)).strftime("%d-%b-%Y")
            search_criterion = f'(SINCE "{search_date}")'
            logger.info(f"Scanning emails newer than baseline tracking window (SINCE {search_date}).")
        else:
            # Fallback for a clean/empty database: scan everything
            search_criterion = "ALL"
            logger.info("No prior scan logs found. Executing full mailbox scan sweep.")

        # 2. PROCESS EMAILS FILTERED BY THE LOOKBACK TIMESTAMP
        status, messages = mail.search(None, search_criterion)
        email_ids = messages[0].split()

        if not email_ids:
            logger.info("No new matching emails found inside the targeted scan window.")
            return

        logger.info(f"Evaluating {len(email_ids)} scoped email candidate(s).")

        for e_id in email_ids:
            try:
                status, msg_data = mail.fetch(e_id, "(RFC822)")
                for response_part in msg_data:
                    if not isinstance(response_part, tuple):
                        continue

                    msg = email.message_from_bytes(response_part[1])
                    message_id = msg.get("Message-ID", "").strip()

                    if not message_id:
                        logger.warning("Email missing Message-ID. Skipping to prevent ambiguity.")
                        metrics["skipped"] += 1
                        continue

                    # 3. MESSAGE-ID DEDUPLICATION (The absolute source of truth)
                    existing_demand = db.query(Demand).filter(Demand.message_id == message_id).first()
                    if existing_demand:
                        metrics["skipped"] += 1
                        continue

                    # Email component parsing & sanitization
                    subject_header = msg.get("Subject", "No Subject")
                    subject, encoding = decode_header(subject_header)[0]
                    if isinstance(subject, bytes):
                        subject = subject.decode(encoding or "utf-8", errors="ignore")
                    subject = subject.strip()

                    raw_sender = msg.get("From", "")
                    clean_email = normalize_email(raw_sender)
                    domain = extract_domain(clean_email)

                    body, html_body = "", ""
                    if msg.is_multipart():
                        for part in msg.walk():
                            content_type = part.get_content_type()
                            try:
                                part_payload = part.get_payload(decode=True)
                                if part_payload:
                                    decoded = part_payload.decode("utf-8", errors="ignore")
                                    if content_type == "text/plain":
                                        body = decoded
                                        break
                                    elif content_type == "text/html":
                                        html_body = decoded
                            except Exception:
                                pass
                        if not body and html_body:
                            body = html_body
                    else:
                        try:
                            body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")
                        except Exception:
                            body = ""
                    
                    body = body.strip()

                    # System noise pre-filter
                    lower_subject = subject.lower()
                    if any(k in lower_subject for k in ["security alert", "verification", "password reset"]) or \
                       any(k in clean_email for k in ["google.com", "workspace-noreply", "noreply"]):
                        logger.info(f"System email noise skipped: {subject}")
                        mail.store(e_id, "+FLAGS", "\\Seen")
                        metrics["skipped"] += 1
                        continue

                    # Sender classification & client mapping
                    approved_sender_record = db.query(ApprovedSender).filter(ApprovedSender.email_address == clean_email).first()
                    matched_client = db.query(Client).filter(Client.domain == domain, Client.active == True).first()
                    
                    if approved_sender_record and approved_sender_record.client_name:
                        client_name = approved_sender_record.client_name
                        source_type = "APPROVED SENDER"
                    elif matched_client:
                        client_name = matched_client.client_name
                        source_type = "APPROVED SENDER" if approved_sender_record else "CLIENT DOMAIN"
                    else:
                        client_name = "Unassigned"
                        source_type = "APPROVED SENDER" if approved_sender_record else "UNKNOWN"

                    # Extraction via LLM
                    extracted = parse_email_body(subject, body)
                    
                    if not extracted.get("is_hiring_demand", True):
                        logger.info(f"AI classified email as non-hiring demand. Skipping.")
                        mail.store(e_id, "+FLAGS", "\\Seen")
                        metrics["skipped"] += 1
                        continue

                    role = extracted.get("role") or "Unknown Role"
                    role = role.strip() if role.strip() else "Unknown Role"
                    
                    try:
                        positions = int(extracted.get("positions", 1))
                    except (ValueError, TypeError):
                        positions = 1

                    location = extracted.get("location", "").strip() or None
                    summary = extracted.get("summary") or get_fallback_summary(body)
                    summary = summary.strip() if summary.strip() else get_fallback_summary(body)
                    priority = determine_priority(subject, body)

                    # 4. WRITE RECORD AND AUTOMATICALLY REFRESH LAST SCAN TIME
                    # Appending this record inherently advances the `func.max(Demand.created_at)` value for the subsequent scan iteration.
                    demand_record = Demand(
                        demand_id=f"DM-{int(time.time())}-{e_id.decode()}",
                        client_name=client_name,
                        sender_email=clean_email,
                        role=role,
                        positions=positions,
                        location=location,
                        priority=priority,
                        status="New",
                        summary=summary,
                        source_type=source_type,
                        message_id=message_id,
                        requisition_created=False,
                        created_at=datetime.utcnow()
                    )

                    db.add(demand_record)
                    db.commit()
                    
                    trigger_live_broadcast(demand_record)
                    
                    mail.store(e_id, "+FLAGS", "\\Seen")
                    metrics["processed"] += 1
                    logger.info(f"Successfully processed demand {demand_record.demand_id} for client: {client_name} ({source_type})")

            except Exception as item_error:
                db.rollback()
                logger.error(f"Failed to process specific email ID {e_id}: {item_error}")
                metrics["errors"] += 1
                continue

    finally:
        db.close()
        try:
            mail.logout()
        except Exception:
            pass
        logger.info(f"Pipeline loop statistics run complete: {metrics}")

# =========================
# RUNTIME DAEMON LOOP
# =========================
if __name__ == "__main__":
    logger.info("Production Email Ingestion Service Pipeline Daemon Engine Online.")
    Base.metadata.create_all(engine)
    
    while True:
        try:
            process_emails()
        except Exception as global_err:
            logger.critical(f"Critical service pipeline interface failure encountered: {global_err}")
            
        logger.info("Engine cooling down. Sleeping for 120 seconds...")
        time.sleep(120)