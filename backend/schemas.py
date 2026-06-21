
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

# Client Schemas
class ClientBase(BaseModel):
    client_name: str
    domain: Optional[str] = None
    account_manager: Optional[str] = None
    active: Optional[bool] = True
    notes: Optional[str] = None
    approved_by: Optional[str] = None

class ClientCreate(ClientBase):
    pass

class ClientOut(ClientBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Approved Sender Schemas
class ApprovedSenderBase(BaseModel):
    email_address: str
    client_name: Optional[str] = None

class ApprovedSenderCreate(ApprovedSenderBase):
    pass

class ApprovedSenderOut(ApprovedSenderBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Demand Schemas
class DemandOut(BaseModel):
    id: int
    demand_id: str
    client_name: str
    sender_email: Optional[str] = None
    role: str
    positions: Optional[int] = 1
    location: Optional[str] = None
    priority: Optional[str] = "Medium"
    status: Optional[str] = "New"
    summary: Optional[str] = None
    owner: Optional[str] = None
    account_owner: Optional[str] = None
    requisition_created: Optional[bool] = False
    requisition_id: Optional[str] = None
    notes: Optional[str] = None
    message_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    source_type: Optional[str] = "Unknown"

    class Config:
        from_attributes = True

# Processed Email Schemas
class ProcessedEmailOut(BaseModel):
    id: int
    message_id: str
    processed_at: datetime

    class Config:
        from_attributes = True

# Aggregation Schemas
class ClientStat(BaseModel):
    client_name: str
    count: int

class DashboardStatsOut(BaseModel):
    total_demands: int
    total_positions: int
    processed_emails_count: int
    active_clients: int
    client_distribution: List[ClientStat]