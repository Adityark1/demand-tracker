import os
import imaplib
import email
import json
import time
from email.header import decode_header
# CHANGE 1: Added parseaddr to handle email parsing properly
from email.utils import parseaddr

from dotenv import load_dotenv
from openai import OpenAI
from sqlalchemy import create_engine, text

load_dotenv()

# =========================
# ENV VARIABLES
# =========================

EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

# =========================
# DATABASE
# =========================

engine = create_engine(DATABASE_URL)

# =========================
# GMAIL CONNECTION
# =========================

def connect_to_gmail():
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(EMAIL_USER, EMAIL_PASS)
        return mail
    except Exception as e:
        print(f"Gmail connection failed: {e}")
        return None


# =========================
# GROQ PARSER
# =========================

def parse_email_body(subject, body_text):
    client = OpenAI(
        api_key=GROQ_API_KEY,
        base_url="https://api.groq.com/openai/v1",
    )

    prompt = f"""
You are an AI recruitment intake system.

Determine whether this email is a genuine hiring demand.

A hiring demand means a client is requesting candidates,
staffing services, recruiters, developers, engineers,
analysts, managers, contractors, consultants, or any
employment requirement.

Return ONLY valid JSON.

{{
    "is_hiring_demand": true,
    "confidence": 0.95,
    "Client": "",
    "Role": "",
    "Positions": 1,
    "Location": "",
    "Priority": "Medium",
    "JD_Summary": ""
}}

Rules:
- is_hiring_demand must be true or false.
- confidence must be between 0 and 1.
- Positions must be an integer.
- Priority must be High, Medium, or Low.
- If no hiring demand exists set is_hiring_demand=false.
- If role is unknown use "Unknown".
- If client is unknown use "Unknown".
- Return raw JSON only.
- No markdown.
- No explanations.

Subject:
{subject}

Email:
{body_text}
"""

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "You are a precise data extraction assistant."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0
        )

        result = completion.choices[0].message.content.strip()

        if result.startswith("```"):
            result = result.replace("```json", "", 1)
            result = result.replace("```", "", 1)
        result = result.strip()

        return json.loads(result)

    except Exception as e:
        print(f"Groq parsing failed: {e}")
        return {
            "is_hiring_demand": False,
            "confidence": 0,
            "Client": "Unknown",
            "Role": "Unknown",
            "Positions": 1,
            "Location": "Unknown",
            "Priority": "Medium",
            "JD_Summary": "Parsing failed"
        }


# =========================
# DUPLICATE CHECK
# =========================

def already_processed(message_id):
    try:
        with engine.begin() as conn:
            result = conn.execute(
                text("""
                    SELECT id 
                    FROM processed_emails 
                    WHERE message_id = :message_id
                """),
                {"message_id": message_id}
            )
            return result.fetchone() is not None
    except Exception as e:
        print(f"Duplicate check failed: {e}")
        return False


# =========================
# MARK EMAIL PROCESSED
# =========================

def mark_processed(message_id):
    try:
        with engine.begin() as conn:
            conn.execute(
                text("""
                    INSERT INTO processed_emails (message_id)
                    VALUES (:message_id)
                """),
                {"message_id": message_id}
            )
    except Exception as e:
        print(f"Failed to mark processed: {e}")


# =========================
# CHANGE 2: NEW HELPER FUNCTIONS
# =========================

def extract_email_address(sender):
    return parseaddr(sender)[1].lower()


def extract_domain(email_address):
    if "@" not in email_address:
        return ""
    return email_address.split("@")[1].lower()


def is_approved_sender(email_address):
    try:
        with engine.begin() as conn:
            result = conn.execute(
                text("""
                    SELECT id
                    FROM approved_senders
                    WHERE LOWER(email_address) = LOWER(:email)
                """),
                {"email": email_address}
            )
            return result.fetchone() is not None
    except Exception as e:
        print(f"Approved sender check failed: {e}")
        return False


def is_approved_client(domain):
    try:
        with engine.begin() as conn:
            result = conn.execute(
                text("""
                    SELECT id
                    FROM clients
                    WHERE LOWER(domain) = LOWER(:domain)
                    AND active = TRUE
                """),
                {"domain": domain}
            )
            return result.fetchone() is not None
    except Exception as e:
        print(f"Client check failed: {e}")
        return False


# =========================
# SAVE DEMAND
# =========================

def save_demand(payload):
    try:
        with engine.begin() as conn:
            # CHANGE 3: Updated queries to include source_type
            conn.execute(
                text("""
                    INSERT INTO demands (
                        demand_id,
                        client_name,
                        sender_email,
                        role,
                        positions,
                        location,
                        priority,
                        summary,
                        message_id,
                        source_type
                    )
                    VALUES (
                        :demand_id,
                        :client_name,
                        :sender_email,
                        :role,
                        :positions,
                        :location,
                        :priority,
                        :summary,
                        :message_id,
                        :source_type
                    )
                """),
                payload
            )
        print(f"Saved demand {payload['demand_id']}")
    except Exception as e:
        print(f"Database insert failed: {e}")


# =========================
# MAIN PROCESSOR
# =========================

def process_emails():
    mail = connect_to_gmail()
    if not mail:
        return

    mail.select("inbox")
    status, messages = mail.search(None, "UNSEEN")
    email_ids = messages[0].split()

    if not email_ids:
        print("No unread emails.")
        mail.logout()
        return

    print(f"Found {len(email_ids)} unread email(s).")

    for e_id in email_ids:
        status, msg_data = mail.fetch(e_id, "(RFC822)")

        for response_part in msg_data:
            if not isinstance(response_part, tuple):
                continue

            msg = email.message_from_bytes(response_part[1])
            message_id = msg.get("Message-ID", "")

            if already_processed(message_id):
                print("Skipping duplicate email")
                continue

            # SUBJECT
            subject, encoding = decode_header(msg.get("Subject", "No Subject"))[0]
            if isinstance(subject, bytes):
                subject = subject.decode(encoding or "utf-8", errors="ignore")

            # SENDER
            sender = msg.get("From", "")

            # BODY EXTRACTION
            body = ""
            html_body = ""

            if msg.is_multipart():
                for part in msg.walk():
                    content_type = part.get_content_type()
                    try:
                        part_payload = part.get_payload(decode=True)
                        if part_payload:
                            decoded_part = part_payload.decode("utf-8", errors="ignore")
                            if content_type == "text/plain":
                                body = decoded_part
                                break
                            elif content_type == "text/html":
                                html_body = decoded_part
                    except:
                        pass
                
                if not body and html_body:
                    body = html_body
            else:
                try:
                    body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")
                except:
                    body = ""

            # PRE-AI FILTERING & CLASSIFICATION
            lower_subject = subject.lower()
            sender_lower = sender.lower()

            if (
                "security alert" in lower_subject
                or "verification" in lower_subject
                or "password reset" in lower_subject
                or "@google.com" in sender_lower
                or "workspace-noreply" in sender_lower
                or "noreply" in sender_lower
            ):
                print("System email skipped")
                mark_processed(message_id)
                mail.store(e_id, "+FLAGS", "\\Seen")
                continue

            # AI EXTRACTION
            details = parse_email_body(subject, body)

            # AI classification check
            if (
                not details.get("is_hiring_demand", False)
                or details.get("confidence", 0) < 0.80
            ):
                print("Not a hiring demand. Skipping.")
                mark_processed(message_id)
                mail.store(e_id, "+FLAGS", "\\Seen")
                continue

            # CHANGE 4: Sender classification source logic block
            email_address = extract_email_address(sender)
            domain = extract_domain(email_address)

            if is_approved_sender(email_address):
                source_type = "Approved Sender"
            elif is_approved_client(domain):
                source_type = "Approved Client"
            else:
                source_type = "Unknown"

            demand_id = f"DM-{e_id.decode()}"

            # CHANGE 5: Payload updated to include source_type
            payload = {
                "demand_id": demand_id,
                "client_name": details["Client"],
                "sender_email": sender,
                "role": details["Role"],
                "positions": details["Positions"],
                "location": details["Location"],
                "priority": details["Priority"],
                "summary": details["JD_Summary"],
                "message_id": message_id,
                "source_type": source_type
            }

            save_demand(payload)
            mark_processed(message_id)
            mail.store(e_id, "+FLAGS", "\\Seen")

    mail.logout()


# =========================
# RUNTIME LOOP
# =========================

if __name__ == "__main__":
    print("Email Ingestion Service Started.")
    while True:
        try:
            process_emails()
        except Exception as e:
            print(f"Loop encounter error: {e}")
            
        print("Sleeping for 120 seconds...")
        time.sleep(120)