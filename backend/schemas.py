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
    
    # New fields added to retrieve raw email text via API
    email_subject: Optional[str] = None
    email_body: Optional[str] = None

    class Config:
        from_attributes = True

class DemandUpdate(BaseModel):
    """Schema used to securely handle partial updates for Demands via PATCH."""
    client_name: Optional[str] = None
    sender_email: Optional[str] = None
    role: Optional[str] = None
    positions: Optional[int] = None
    location: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    summary: Optional[str] = None
    owner: Optional[str] = None
    account_owner: Optional[str] = None
    requisition_created: Optional[bool] = None
    requisition_id: Optional[str] = None
    notes: Optional[str] = None
    source_type: Optional[str] = None
    
    # New fields added to optionally permit edits to raw text via PATCH updates
    email_subject: Optional[str] = None
    email_body: Optional[str] = None

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