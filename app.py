from fastapi import FastAPI
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(
    title="Demand Tracking System API",
    version="1.0.0"
)

engine = create_engine(
    os.getenv("DATABASE_URL")
)

# ===================================
# HEALTH CHECK
# ===================================

@app.get("/")
def home():
    return {
        "status": "running",
        "service": "Demand Tracking System API"
    }


# ===================================
# GET ALL DEMANDS
# ===================================

@app.get("/api/demands")
def get_demands():

    with engine.begin() as conn:

        result = conn.execute(
            text("""
                SELECT
                    id,
                    demand_id,
                    client_name,
                    sender_email,
                    role,
                    positions,
                    location,
                    priority,
                    status,
                    summary,
                    created_at
                FROM demands
                ORDER BY created_at DESC
            """)
        )

        rows = result.fetchall()

        return [
            {
                "id": row.id,
                "demand_id": row.demand_id,
                "client_name": row.client_name,
                "sender_email": row.sender_email,
                "role": row.role,
                "positions": row.positions,
                "location": row.location,
                "priority": row.priority,
                "status": row.status,
                "summary": row.summary,
                "created_at": str(row.created_at)
            }
            for row in rows
        ]


# ===================================
# GET SINGLE DEMAND
# ===================================

@app.get("/api/demands/{demand_id}")
def get_demand(demand_id: str):

    with engine.begin() as conn:

        result = conn.execute(
            text("""
                SELECT *
                FROM demands
                WHERE demand_id = :demand_id
            """),
            {"demand_id": demand_id}
        )

        row = result.fetchone()

        if not row:
            return {
                "error": "Demand not found"
            }

        return dict(row._mapping)