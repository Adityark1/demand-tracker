// api.js - Production-grade service layer aligned directly with your FastAPI endpoints
const API_BASE = "http://127.0.0.1:8000/api";

export const api = {
  // 1. Dashboard Aggregate Counters
  async getDashboardStats() {
    const res = await fetch(`${API_BASE}/dashboard/stats`);
    if (!res.ok) throw new Error(`HTTP error ${res.status} fetching stats`);
    return res.json();
  },

  // 2. Open Requirements/Demands Ingestion Ledger
  async getDemands() {
    const res = await fetch(`${API_BASE}/demands`);
    if (!res.ok) throw new Error(`HTTP error ${res.status} fetching demands`);
    return res.json();
  },

  // NEW: Added to handle partial updates securely for status, priority, and owner fields
  async updateDemand(id, demandData) {
    const res = await fetch(`${API_BASE}/demands/${id}`, {
      method: "PATCH",
      headers: { 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify(demandData)
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP error ${res.status} updating demand: ${errorText}`);
    }
    return res.json();
  },

  // 3. Client Whitelist Entities
  async getClients() {
    const res = await fetch(`${API_BASE}/clients`);
    if (!res.ok) throw new Error(`HTTP error ${res.status} fetching clients`);
    return res.json();
  },

  async createClient(clientData) {
    const res = await fetch(`${API_BASE}/clients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clientData)
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status} writing client`);
    return res.json();
  },

  // 4. Approved Senders Configuration
  async getApprovedSenders() {
    const res = await fetch(`${API_BASE}/approved-senders`);
    if (!res.ok) throw new Error(`HTTP error ${res.status} fetching senders`);
    return res.json();
  },

  async createApprovedSender(senderData) {
    const res = await fetch(`${API_BASE}/approved-senders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(senderData)
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status} authorizing sender`);
    return res.json();
  },

  // 5. Ingested Email Payload History (Logs / Previews)
  async getProcessedEmails() {
    const res = await fetch(`${API_BASE}/processed-emails`);
    if (!res.ok) throw new Error(`HTTP error ${res.status} fetching processed emails`);
    return res.json();
  }
};