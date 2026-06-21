from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import pydantic

from .database import get_db
from . import models, schemas

app = FastAPI(title="Demand Tracker Systems API", version="1.1.0")

# Local Vite development CORS lock
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# WEBSOCKET CONNECTION MGR
# =========================
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Handle stale connections gracefully
                pass

manager = ConnectionManager()

@app.websocket("/ws/demands")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and listen for incoming text if any
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

class BroadcastPayload(pydantic.BaseModel):
    type: str
    data: dict

@app.post("/api/internal/broadcast", status_code=status.HTTP_200_OK)
async def internal_broadcast(payload: BroadcastPayload):
    """Internal endpoint allowing the ingestion daemon to trigger real-time updates."""
    await manager.broadcast(payload.dict())
    return {"status": "broadcast_sent"}

# =========================
# STANDARD ROUTES
# =========================

@app.get("/")
def root():
    """Fast health check endpoint to verify backend service status."""
    return {
        "status": "online",
        "service": "Demand Tracker API",
        "version": "1.1.0"
    }

@app.get("/api/dashboard/stats", response_model=schemas.DashboardStatsOut)
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_demands = db.query(models.Demand).count()
    total_positions = db.query(func.sum(models.Demand.positions)).scalar() or 0
    processed_emails_count = db.query(models.ProcessedEmail).count()
    
    active_clients = db.query(models.Client).filter(models.Client.active.is_(True)).count()

    client_counts = (
        db.query(models.Demand.client_name, func.count(models.Demand.id))
        .group_by(models.Demand.client_name)
        .all()
    )
    
    client_distribution = [
        schemas.ClientStat(client_name=row[0], count=row[1]) for row in client_counts
    ]

    return {
        "total_demands": total_demands,
        "total_positions": total_positions,
        "processed_emails_count": processed_emails_count,
        "active_clients": active_clients,
        "client_distribution": client_distribution
    }

@app.get("/api/demands", response_model=List[schemas.DemandOut])
def get_all_demands(db: Session = Depends(get_db)):
    return db.query(models.Demand).order_by(models.Demand.created_at.desc()).all()

@app.get("/api/demands/{id}", response_model=schemas.DemandOut)
def get_demand_by_id(id: int, db: Session = Depends(get_db)):
    demand = db.query(models.Demand).filter(models.Demand.id == id).first()
    if not demand:
        raise HTTPException(status_code=404, detail="Demand not found.")
    return demand

@app.get("/api/demands/by-demand-id/{demand_id}", response_model=schemas.DemandOut)
def get_demand_by_business_id(demand_id: str, db: Session = Depends(get_db)):
    demand = db.query(models.Demand).filter(models.Demand.id == demand_id).first()
    if not demand:
        raise HTTPException(status_code=404, detail=f"Demand {demand_id} not found.")
    return demand

@app.patch("/api/demands/{id}", response_model=schemas.DemandOut)
def update_demand(id: int, demand_update: schemas.DemandUpdate, db: Session = Depends(get_db)):
    db_demand = db.query(models.Demand).filter(models.Demand.id == id).first()
    if not db_demand:
        raise HTTPException(status_code=404, detail="Demand not found.")
    
    update_data = demand_update.dict(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(db_demand, key, value)
    
    db.commit()
    db.refresh(db_demand)
    
    return db_demand

@app.get("/api/clients", response_model=List[schemas.ClientOut])
def get_clients(db: Session = Depends(get_db)):
    return db.query(models.Client).order_by(models.Client.client_name.asc()).all()

@app.post("/api/clients", response_model=schemas.ClientOut, status_code=status.HTTP_201_CREATED)
def create_client(client: schemas.ClientCreate, db: Session = Depends(get_db)):
    if client.domain:
        db_client = db.query(models.Client).filter(models.Client.domain == client.domain).first()
        if db_client:
            raise HTTPException(status_code=400, detail="Client domain already exists.")
    new_client = models.Client(**client.dict())
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return new_client

@app.get("/api/approved-senders", response_model=List[schemas.ApprovedSenderOut])
def get_approved_senders(db: Session = Depends(get_db)):
    return db.query(models.ApprovedSender).order_by(models.ApprovedSender.created_at.desc()).all()

@app.post("/api/approved-senders", response_model=schemas.ApprovedSenderOut, status_code=status.HTTP_201_CREATED)
def create_approved_sender(sender: schemas.ApprovedSenderCreate, db: Session = Depends(get_db)):
    db_sender = db.query(models.ApprovedSender).filter(models.ApprovedSender.email_address == sender.email_address).first()
    if db_sender:
        raise HTTPException(status_code=400, detail="Approved sender already exists.")
    new_sender = models.ApprovedSender(**sender.dict())
    db.add(new_sender)
    db.commit()
    db.refresh(new_sender)
    return new_sender

@app.get("/api/processed-emails", response_model=List[schemas.ProcessedEmailOut])
def get_processed_emails(db: Session = Depends(get_db)):
    return db.query(models.ProcessedEmail).order_by(models.ProcessedEmail.processed_at.desc()).all()