import React, { useState, useMemo, useEffect } from 'react';
import { api } from './api'; 
import { 
  LayoutDashboard, 
  FileText, 
  Building2, 
  UserCheck, 
  UserX,
  History,
  Search, 
  Bell, 
  Inbox, 
  Eye,
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  AlertTriangle,
  Briefcase,
  MailOpen
} from 'lucide-react';

export default function RecruitmentDashboard() {
  const [activePage, setActivePage] = useState('dashboard');
  
  // Data States
  const [demands, setDemands] = useState([]);
  const [clients, setClients] = useState([]);
  const [senders, setSenders] = useState([]);
  const [processedEmails, setProcessedEmails] = useState([]);
  
  // UI States
  const [selectedDemandId, setSelectedDemandId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Form States
  const [detailsForm, setDetailsForm] = useState({
    priority: 'Medium',
    status: 'New',
    owner: 'Not Assigned',
    source_type: 'Manual Entry'
  });
  const [newClientForm, setNewClientForm] = useState({ client_name: '', domain: '' });
  const [newSenderForm, setNewSenderForm] = useState({ email_address: '', client_name: '' });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [clientFilter, setClientFilter] = useState('All');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [demandsData, clientsData, sendersData, emailsData] = await Promise.all([
        api.getDemands().catch(() => []),
        api.getClients().catch(() => []),
        api.getApprovedSenders().catch(() => []),
        api.getProcessedEmails().catch(() => [])
      ]);

      setDemands(Array.isArray(demandsData) ? demandsData : []);
      setClients(Array.isArray(clientsData) ? clientsData : []);
      setSenders(Array.isArray(sendersData) ? sendersData : []);
      setProcessedEmails(Array.isArray(emailsData) ? emailsData : []);
    } catch (error) {
      showToast('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Base Data Loading
  useEffect(() => {
    loadData();
  }, []);

  // Real-Time WebSocket Channel
  useEffect(() => {
    const ws = new WebSocket("ws://127.0.0.1:8000/ws/demands");

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "NEW_DEMAND") {
          // Add new incoming demand item directly to the top of our active array lists
          setDemands(prev => [msg.data, ...prev]);
          
          // Toast trigger signaling live event ingestion
          const clientName = msg.data?.client_name || msg.data?.client || 'Unknown Client';
          const roleTitle = msg.data?.role || msg.data?.extracted_role || 'Job Role';
          showToast(`New Live Demand Ingested: ${clientName} - ${roleTitle}`, 'success');
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error observed:", error);
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    if (activePage === 'demand-details' && selectedDemandId) {
      const match = demands.find(d => String(d.id || d.demand_id) === String(selectedDemandId));
      if (match) {
        setDetailsForm({
          priority: match.priority || 'Medium',
          status: match.status || 'New',
          owner: match.owner || 'Not Assigned',
          source_type: match.source_type || match.source || 'Manual Entry'
        });
      }
    }
  }, [activePage, selectedDemandId, demands]);

  const currentDemand = useMemo(() => {
    if (!selectedDemandId) return null;
    return demands.find(d => String(d.id || d.demand_id) === String(selectedDemandId)) || null;
  }, [demands, selectedDemandId]);

  const filteredDemands = useMemo(() => {
    return demands.filter(d => {
      if (!d) return false;
      const query = searchQuery.toLowerCase().trim();
      const role = String(d.role || d.extracted_role || '').toLowerCase();
      const client = String(d.client_name || d.client || '').toLowerCase();
      const id = String(d.id || d.demand_id || '').toLowerCase();

      const matchesSearch = !query || role.includes(query) || client.includes(query) || id.includes(query);
      const matchesClient = clientFilter === 'All' || (d.client_name || d.client) === clientFilter;

      return matchesSearch && matchesClient;
    });
  }, [demands, searchQuery, clientFilter]);

  const updateDemandField = async (id, updatedFields) => {
    try {
      if (api.updateDemand) {
        await api.updateDemand(id, updatedFields);
        showToast(`Updated demand #${id}`);
        setDemands(prev => prev.map(item => String(item.id || item.demand_id) === String(id) ? { ...item, ...updatedFields } : item));
      }
    } catch (err) {
      showToast('Failed to update demand', 'error');
    }
  };

  const saveDetails = async () => {
    if (!selectedDemandId) return;
    try {
      setSaving(true);
      if (api.updateDemand) {
        await api.updateDemand(selectedDemandId, detailsForm);
        showToast('Changes saved successfully');
        setDemands(prev => prev.map(item => String(item.id || item.demand_id) === String(selectedDemandId) ? { ...item, ...detailsForm } : item));
      }
    } catch (err) {
      showToast('Failed to save changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    if (!newClientForm.client_name || !newClientForm.domain) return showToast('Please fill out all fields', 'error');
    try {
      await api.createClient(newClientForm);
      setNewClientForm({ client_name: '', domain: '' });
      showToast('Client added successfully');
      await loadData();
    } catch (err) {
      showToast('Failed to add client', 'error');
    }
  };

  const handleAddSender = async (e) => {
    e.preventDefault();
    if (!newSenderForm.email_address) return showToast('Email is required', 'error');
    try {
      await api.createApprovedSender(newSenderForm);
      setNewSenderForm({ email_address: '', client_name: '' });
      showToast('Sender approved successfully');
      await loadData();
    } catch (err) {
      showToast('Failed to approve sender', 'error');
    }
  };

  const renderStatCard = (Icon, count, label, subtitle, colors) => (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
      <div className="space-y-1">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">{label}</span>
        <h3 className="text-3xl font-black text-slate-800 tracking-tight">{count}</h3>
        <p className="text-xs font-medium text-slate-500">{subtitle}</p>
      </div>
      <div className={`p-3.5 rounded-xl text-white bg-gradient-to-br ${colors}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 text-slate-500 font-sans text-xs font-bold">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-blue-600"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-[#F8FAFC] text-slate-900 font-sans antialiased overflow-hidden">
      
      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border bg-white text-xs font-bold text-slate-800 border-slate-200">
          <div className={`p-1 rounded-lg ${toast.type === 'error' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          </div>
          <span>{toast.message}</span>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between h-full shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-blue-600 text-white p-2.5 rounded-xl flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-black text-slate-900 text-sm tracking-tight">Demand Tracker</h1>
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Dashboard</span>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'demands', label: 'Demands Grid', icon: FileText, count: demands.length },
              { id: 'clients', label: 'Clients', icon: Building2, count: clients.length },
              { id: 'approved-senders', label: 'Approved Senders', icon: UserCheck, count: senders.length },
              { id: 'unknown-senders', label: 'Unknown Senders', icon: UserX },
              { id: 'email-activity', label: 'Email Activity', icon: History, count: processedEmails.length },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = activePage === item.id || (item.id === 'demands' && activePage === 'demand-details');
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isSelected ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-md ${isSelected ? 'bg-white text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        
        {/* HEADER */}
        <header className="bg-white border-b border-slate-200 h-14 px-8 flex items-center justify-between shrink-0">
          <div className="w-96 relative">
            <Search className="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search demands, roles, or clients..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Connected
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto p-8">
          
          {/* VIEW: DASHBOARD */}
          {activePage === 'dashboard' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Overview</h2>
                <p className="text-xs text-slate-400">Quick statistics and operational metrics.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {renderStatCard(TrendingUp, demands.length, 'Total Active Demands', 'All open positions', 'from-blue-500 to-indigo-600')}
                {renderStatCard(AlertTriangle, demands.filter(r => r.priority === 'Critical' || r.priority === 'High').length, 'Urgent Attention Required', 'High & Critical priority items', 'from-rose-500 to-red-600')}
                {renderStatCard(Briefcase, clients.length, 'Active Client Accounts', 'Total companies mapped', 'from-purple-500 to-fuchsia-600')}
                {renderStatCard(MailOpen, processedEmails.length, 'Total Emails Processed', 'Total parsing history count', 'from-amber-500 to-orange-600')}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider">Recent Job Demands</h3>
                  <button onClick={() => setActivePage('demands')} className="text-xs text-blue-600 font-bold hover:underline">Open Grid System →</button>
                </div>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-400 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                      <th className="p-4 pl-6">ID</th>
                      <th className="p-4">Client Name</th>
                      <th className="p-4">Job Role</th>
                      <th className="p-4">Priority</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {demands.slice(0, 5).map((rec) => {
                      const id = rec.id || rec.demand_id;
                      return (
                        <tr key={String(id)} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => { setSelectedDemandId(id); setActivePage('demand-details'); }}>
                          <td className="p-4 pl-6 font-mono font-bold text-blue-600">#{id}</td>
                          <td className="p-4 font-bold text-slate-900">{rec.client_name || rec.client || 'Unassigned'}</td>
                          <td className="p-4">{rec.role || rec.extracted_role}</td>
                          <td className="p-4"><span className="px-2 py-0.5 rounded-full border text-[11px] font-bold bg-slate-50">{rec.priority || 'Medium'}</span></td>
                          <td className="p-4"><span className="px-2 py-0.5 rounded-full border text-[11px] font-bold bg-slate-50">{rec.status || 'New'}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW: DEMANDS GRID */}
          {activePage === 'demands' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Demands Ledger Grid</h2>
                <p className="text-xs text-slate-400">View and update active records in real time.</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3">
                <div className="flex flex-col gap-1 text-xs">
                  <span className="font-bold text-slate-400 text-[10px] uppercase">Filter By Client</span>
                  <select 
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    className="border border-slate-200 bg-slate-50 px-3 py-1.5 rounded-lg font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
                  >
                    <option value="All">All Companies</option>
                    {clients.map(c => <option key={c.id} value={c.client_name}>{c.client_name}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                      <th className="p-4 pl-6">ID</th>
                      <th className="p-4">Client Name</th>
                      <th className="p-4">Job Role</th>
                      <th className="p-4 w-40">Priority</th>
                      <th className="p-4 w-40">Status</th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredDemands.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center p-12 text-slate-400">
                          <Inbox className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                          <p className="font-bold">No records found</p>
                        </td>
                      </tr>
                    ) : (
                      filteredDemands.map((rec) => {
                        const id = rec.id || rec.demand_id;
                        return (
                          <tr key={String(id)} className="hover:bg-slate-50/30">
                            <td className="p-4 pl-6 font-mono font-bold text-blue-600">#{id}</td>
                            <td className="p-4 font-bold text-slate-900">{rec.client_name || rec.client || 'Unassigned'}</td>
                            <td className="p-4">{rec.role || rec.extracted_role}</td>
                            
                            <td className="p-3">
                              <select
                                value={rec.priority || 'Medium'}
                                onChange={(e) => updateDemandField(id, { priority: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
                              >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                                <option value="Critical">Critical</option>
                              </select>
                            </td>
                            
                            <td className="p-3">
                              <select
                                value={rec.status || 'New'}
                                onChange={(e) => updateDemandField(id, { status: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
                              >
                                <option value="New">New</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Stale">Stale</option>
                                <option value="Closed">Closed</option>
                              </select>
                            </td>

                            <td className="p-4 text-center">
                              <button
                                onClick={() => { setSelectedDemandId(id); setActivePage('demand-details'); }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Workspace</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW: DETAILS WORKSPACE */}
          {activePage === 'demand-details' && (
            <div className="space-y-6">
              <button onClick={() => setActivePage('demands')} className="inline-flex items-center gap-1 text-xs text-slate-500 font-bold hover:text-slate-800">
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Grid</span>
              </button>

              {!currentDemand ? (
                <div className="bg-white p-6 border rounded-xl text-center text-slate-400">Demand profile not found.</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  <div className="lg:col-span-2 bg-white border border-slate-200 p-6 rounded-2xl space-y-4">
                    <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Payload Data</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                      <div>
                        <span className="text-slate-400 block">Sender Email</span>
                        <span className="font-mono text-slate-800 bg-slate-50 p-2 rounded-lg border block mt-1">{currentDemand.sender_email || 'None'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Client Domain</span>
                        <span className="text-slate-800 bg-slate-50 p-2 rounded-lg border block mt-1">{currentDemand.client_name || 'None'}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-400 block mb-1">Email Subject</span>
                      <div className="bg-slate-50 p-3 rounded-lg border text-xs font-bold text-slate-800">{currentDemand.subject || 'No subject info'}</div>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-400 block mb-1">Full Email Content</span>
                      <div className="bg-slate-950 p-4 rounded-xl font-mono text-xs text-slate-300 h-80 overflow-y-auto whitespace-pre-line leading-relaxed">
                        {currentDemand.description || currentDemand.raw_text_payload || "No text payload body mapped."}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4">
                    <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Control Options</h3>
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block text-slate-400 font-bold mb-1">Priority</label>
                        <select 
                          value={detailsForm.priority}
                          onChange={(e) => setDetailsForm({ ...detailsForm, priority: e.target.value })}
                          className="w-full border p-2 bg-slate-50 rounded-xl font-bold focus:outline-none focus:bg-white"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Critical">Critical</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 font-bold mb-1">Status</label>
                        <select 
                          value={detailsForm.status}
                          onChange={(e) => setDetailsForm({ ...detailsForm, status: e.target.value })}
                          className="w-full border p-2 bg-slate-50 rounded-xl font-bold focus:outline-none focus:bg-white"
                        >
                          <option value="New">New</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Stale">Stale</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 font-bold mb-1">Source Type</label>
                        <select 
                          value={detailsForm.source_type}
                          onChange={(e) => setDetailsForm({ ...detailsForm, source_type: e.target.value })}
                          className="w-full border p-2 bg-slate-50 rounded-xl font-bold focus:outline-none focus:bg-white"
                        >
                          <option value="Manual Entry">Manual Entry</option>
                          <option value="Approved Sender">Approved Sender</option>
                          <option value="Known Route">Known Route</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 font-bold mb-1">Assigned Stakeholder</label>
                        <input 
                          type="text"
                          value={detailsForm.owner}
                          onChange={(e) => setDetailsForm({ ...detailsForm, owner: e.target.value })}
                          className="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-800 focus:outline-none focus:bg-white"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={saveDetails}
                      disabled={saving}
                      className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{saving ? 'Saving...' : 'Save Workspace Changes'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW: CLIENT MANAGEMENT */}
          {activePage === 'clients' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Client Domain Mapping</h2>
                <p className="text-xs text-slate-400">Define external companies mapped into our parser rules.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <form onSubmit={handleCreateClient} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
                  <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider">Add Client Account</h3>
                  <div className="space-y-2 text-xs font-semibold">
                    <div>
                      <label className="block text-slate-400 mb-1">Company Name</label>
                      <input type="text" placeholder="e.g. Acme Corp" className="w-full border rounded-xl p-2 bg-slate-50 focus:outline-none focus:bg-white" value={newClientForm.client_name} onChange={e => setNewClientForm({...newClientForm, client_name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Domain Handle</label>
                      <input type="text" placeholder="e.g. acme.com" className="w-full border rounded-xl p-2 bg-slate-50 font-mono focus:outline-none focus:bg-white" value={newClientForm.domain} onChange={e => setNewClientForm({...newClientForm, domain: e.target.value})} />
                    </div>
                    <button type="submit" className="w-full py-2 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-colors">Add Company Mapping</button>
                  </div>
                </form>
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                        <th className="p-4 pl-6">Client Label</th>
                        <th className="p-4">Linked Routing Domain</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {clients.map(c => (
                        <tr key={String(c.id)} className="hover:bg-slate-50/40">
                          <td className="p-4 pl-6 font-bold text-slate-900">{c.client_name}</td>
                          <td className="p-4 font-mono text-blue-600">@{c.domain}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: APPROVED SENDERS */}
          {activePage === 'approved-senders' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Approved Ingestion Whitelists</h2>
                <p className="text-xs text-slate-400">Configure trusted email addresses allowed to generate system demands.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <form onSubmit={handleAddSender} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
                  <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider">Whitelist New Address</h3>
                  <div className="space-y-3 text-xs font-semibold">
                    <div>
                      <label className="block text-slate-400 mb-1">Incoming Email Address</label>
                      <input type="email" placeholder="hiring@acme.com" className="w-full border rounded-xl p-2 bg-slate-50 font-mono focus:outline-none focus:bg-white" value={newSenderForm.email_address} onChange={e => setNewSenderForm({...newSenderForm, email_address: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Target Assigned Account</label>
                      <select value={newSenderForm.client_name} onChange={e => setNewSenderForm({...newSenderForm, client_name: e.target.value})} className="w-full border p-2 bg-slate-50 rounded-xl focus:outline-none focus:bg-white font-bold text-slate-700">
                        <option value="">-- Choose Client --</option>
                        {clients.map(c => <option key={c.id} value={c.client_name}>{c.client_name}</option>)}
                      </select>
                    </div>
                    <button type="submit" className="w-full py-2 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-colors">Authorize Source Route</button>
                  </div>
                </form>
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                        <th className="p-4 pl-6">Whitelisted Source Email Address</th>
                        <th className="p-4">Associated Client Target</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {senders.map(s => (
                        <tr key={String(s.id)} className="hover:bg-slate-50/40">
                          <td className="p-4 pl-6 font-mono text-slate-800">{s.email_address}</td>
                          <td className="p-4 text-purple-600 font-bold">{s.client_name || 'Personal Account Route'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: UNKNOWN SENDERS */}
          {activePage === 'unknown-senders' && (
            <div className="space-y-4">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Intercepted Anomalies Log</h2>
              <div className="bg-white p-12 text-center text-slate-400 border border-slate-200 rounded-2xl">No verification anomalies found.</div>
            </div>
          )}

          {/* VIEW: EMAIL ACTIVITY */}
          {activePage === 'email-activity' && (
            <div className="space-y-4">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Historical Email Activity Logs</h2>
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider font-sans">
                      <th className="p-4 pl-6">Source Origin Address</th>
                      <th className="p-4">Subject Line Header</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                    {processedEmails.map((log, i) => (
                      <tr key={i} className="hover:bg-slate-50/40">
                        <td className="p-4 pl-6 font-bold text-slate-800">{log.sender_email || log.sender || 'Unknown'}</td>
                        <td className="p-4 font-sans text-slate-700">{log.subject || 'Empty Log Payload'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}