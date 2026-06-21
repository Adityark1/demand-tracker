
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from .database import Base

class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_name = Column(Text, nullable=False)
    domain = Column(Text, unique=True, nullable=True)
    account_manager = Column(Text, nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)
    approved_by = Column(Text, nullable=True)


class ApprovedSender(Base):
    __tablename__ = "approved_senders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email_address = Column(Text, unique=True, nullable=False)
    client_name = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Demand(Base):
    __tablename__ = "demands"

    id = Column(Integer, primary_key=True, autoincrement=True)
    demand_id = Column(String(50), unique=True, nullable=False)
    client_name = Column(String(255), nullable=False)
    sender_email = Column(String(255), nullable=True)
    role = Column(String(255), nullable=False)
    positions = Column(Integer, default=1)
    location = Column(String(255), nullable=True)
    priority = Column(String(20), default="Medium")
    status = Column(String(50), default="New")
    summary = Column(Text, nullable=True)
    owner = Column(String(255), nullable=True)
    account_owner = Column(String(255), nullable=True)
    requisition_created = Column(Boolean, default=False)
    requisition_id = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    message_id = Column(Text, unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    source_type = Column(Text, default="Unknown")


class ProcessedEmail(Base):
    __tablename__ = "processed_emails"

    id = Column(Integer, primary_key=True, autoincrement=True)
    message_id = Column(Text, unique=True, nullable=False)
    processed_at = Column(DateTime, default=datetime.utcnow)