import React, { useState, useMemo, useEffect } from 'react';
import { api } from './api'; // Import your exact service layer
import { 
  LayoutDashboard, 
  Layers, 
  FileText, 
  BarChart3, 
  History, 
  Search, 
  Bell, 
  SlidersHorizontal, 
  Mail, 
  Plus, 
  Inbox, 
  Building2, 
  UserCheck, 
  Eye
} from 'lucide-react';

export default function RecruitmentDashboard() {
  const [activePage, setActivePage] = useState('dashboard');
  
  // Real Core Data States (Populated directly via FastAPI Layer)
  const [requirements, setRequirements] = useState([]);
  const [clients, setClients] = useState([]);
  const [senders, setSenders] = useState([]);
  const [processedEmails, setProcessedEmails] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({ total_demands: 0, total_clients: 0, total_senders: 0 });
  
  const [selectedReqId, setSelectedReqId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modals & Forms Local States
  const [previewEmail, setPreviewEmail] = useState(null);
  const [newClient, setNewClient] = useState({ name: '', domain: '', account_manager: 'Alex Rivera' });
  const [newSender, setNewSender] = useState({ email: '', client_id: '' });

  // Filter States
  const [globalSearch, setGlobalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [clientFilter, setClientFilter] = useState('All');

  // ==========================================
  // CORE ASYNC DATA SYNC & LIFECYCLE
  // ==========================================
  const syncWithBackendEngine = async () => {
    try {
      setLoading(true);
      
      // Concurrent fetching across existing FastAPI paths
      const [demandsData, clientsData, sendersData, emailsData, statsData] = await Promise.all([
        api.getDemands(),
        api.getClients(),
        api.getApprovedSenders(),
        api.getProcessedEmails(),
        api.getDashboardStats()
      ]);

      // SANITY TEST INJECTOR
      console.log("REAL DATA INGESTED:", demandsData);

      setRequirements(demandsData);
      setClients(clientsData);
      setSenders(sendersData);
      setProcessedEmails(emailsData);
      setDashboardStats(statsData);

      // Auto-focus first dynamic element in list
      if (demandsData.length > 0 && !selectedReqId) {
        setSelectedReqId(demandsData[0].id || demandsData[0].demand_id);
      }
    } catch (error) {
      console.error("FastAPI Sync Connection Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncWithBackendEngine();
  }, []);

  // ==========================================
  // MEMOIZED REAL-TIME VIEWS & COMPUTATIONS
  // ==========================================
  const currentRequirement = useMemo(() => {
    return requirements.find(r => (r.id === selectedReqId || r.demand_id === selectedReqId)) || requirements[0] || null;
  }, [requirements, selectedReqId]);

  const filteredRequirements = useMemo(() => {
    return requirements.filter(r => {
      const targetRole = r.role || r.extracted_role || '';
      const targetClient = r.client || r.client_name || '';
      const targetId = r.id || r.demand_id || '';
      
      const matchQuery = targetRole.toLowerCase().includes(globalSearch.toLowerCase()) || 
                          targetClient.toLowerCase().includes(globalSearch.toLowerCase()) ||
                          targetId.toLowerCase().includes(globalSearch.toLowerCase());
      const matchStatus = statusFilter === 'All' ? true : (r.status === statusFilter);
      const matchPriority = priorityFilter === 'All' ? true : (r.priority === priorityFilter);
      const matchClient = clientFilter === 'All' ? true : (targetClient === clientFilter);
      
      return matchQuery && matchStatus && matchPriority && matchClient;
    });
  }, [requirements, globalSearch, statusFilter, priorityFilter, clientFilter]);

  // ==========================================
  // VERIFIED MUTATION WRITERS (POSTs Only)
  // ==========================================
  const handleCommitClient = async (e) => {
    e.preventDefault();
    if (!newClient.name || !newClient.domain) return alert('Please supply all schema parameters.');
    try {
      await api.createClient(newClient);
      setNewClient({ name: '', domain: '', account_manager: 'Alex Rivera' });
      await syncWithBackendEngine(); // Pull updated tables immediately
    } catch (err) {
      alert("Error committing company client entry.");
    }
  };

  const handleCommitSender = async (e) => {
    e.preventDefault();
    if (!newSender.email || !newSender.client_id) return alert('Select target client binding.');
    try {
      await api.createApprovedSender({
        email: newSender.email,
        client_id: parseInt(newSender.client_id)
      });
      setNewSender({ email: '', client_id: '' });
      await syncWithBackendEngine(); // Pull updated tables immediately
    } catch (err) {
      alert("Failed to bind approved sender rule profile.");
    }
  };

  // ==========================================
  // BRANDED LUXURY UI RENDER CHIPS
  // ==========================================
  const renderPriorityBadge = (priority = 'Medium') => {
    const mapping = {
      Critical: 'bg-red-50 text-red-700 border-red-200',
      High: 'bg-amber-50 text-amber-700 border-amber-100',
      Medium: 'bg-blue-50 text-blue-700 border-blue-100',
      Low: 'bg-slate-50 text-slate-600 border-slate-200',
    };
    return <span className={`px-2.5 py-0.5 inline-flex items-center text-xs font-semibold rounded-md border ${mapping[priority] || mapping.Medium}`}>{priority}</span>;
  };

  const renderStatusBadge = (status = 'New') => {
    const mapping = {
      New: 'bg-blue-50 text-blue-700 border-blue-200',
      'In Progress': 'bg-emerald-50 text-emerald-700 border-emerald-100',
      Stale: 'bg-red-50 text-red-700 border-red-100',
      Closed: 'bg-slate-100 text-slate-700 border-slate-200',
    };
    return <span className={`px-2 py-0.5 inline-flex items-center text-xs font-medium rounded-full border ${mapping[status] || mapping.New}`}>{status}</span>;
  };

  const renderConfidenceBadge = (score = 90) => {
    const color = score >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : score >= 75 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200';
    return <span className={`px-2 py-0.5 text-[11px] font-bold rounded border ${color}`}>{score}% Confidence</span>;
  };

  const renderSourceLabel = (source = 'Approved Client') => {
    const mapping = {
      'Approved Client': 'bg-purple-50 text-purple-700 border-purple-200',
      'Approved Sender': 'bg-blue-50 text-blue-700 border-blue-200',
      'Pending Review': 'bg-amber-50 text-amber-700 border-amber-200',
      'Unknown Source': 'bg-rose-50 text-rose-700 border-rose-200'
    };
    return <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded border ${mapping[source] || 'bg-slate-50 text-slate-600'}`}>{source}</span>;
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 font-sans text-xs font-semibold text-slate-500">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          Syncing with core engine ledger data...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-[#F8FAFC] text-slate-900 font-sans antialiased overflow-hidden">
      
      {/* SIDEBAR NAVIGATION PANEL */}
      <aside className="w-64 min-w-64 bg-white border-r border-slate-200 flex flex-col justify-between h-full z-20 shrink-0">
        <div className="p-5">
          <div className="flex items-center gap-3 mb-7 px-1">
            <div className="bg-[#2563EB] text-white p-2 rounded-lg shadow-sm flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 tracking-tight text-sm">Talent Ingestion Pro</h1>
              <span className="text-[11px] text-slate-400 font-medium block -mt-0.5">Staffing & Requirements</span>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'demands', label: 'Open Requirements', icon: FileText, badge: requirements.length },
              { id: 'details', label: 'Requirement Details', icon: SlidersHorizontal },
              { id: 'clients', label: 'Clients', icon: Building2, badge: clients.length },
              { id: 'senders', label: 'Approved Senders', icon: UserCheck, badge: senders.length },
              { id: 'processed', label: 'Activity Log', icon: History, badge: processedEmails.length },
            ].map((node) => {
              const IconComponent = node.icon;
              const isSelected = activePage === node.id;
              return (
                <button
                  key={node.id}
                  onClick={() => setActivePage(node.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isSelected ? 'bg-blue-50 text-[#2563EB]' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <IconComponent className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#2563EB]' : 'text-slate-400'}`} />
                    <span>{node.label}</span>
                  </div>
                  {node.badge !== undefined && (
                    <span className="text-[10px] px-1.5 py-0.5 font-bold rounded-md bg-slate-100 text-slate-600">
                      {node.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* LOGGED IN USER CONTEXT CONTAINER */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              AR
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">Alex Rivera</p>
              <p className="text-[10px] text-slate-400 font-medium truncate">Lead Talent Operations Partner</p>
            </div>
          </div>
        </div>
      </aside>

      {/* CORE FRAME LAYOUT CONTENT ENGINE */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        
        {/* TOP META CONTROLLER BAR */}
        <header className="bg-white border-b border-slate-200 h-14 min-h-14 px-8 flex items-center justify-between w-full z-10 shrink-0">
          <div className="flex items-center gap-4 w-96">
            <div className="relative w-full">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search database requirements, clients..."
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50/80 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] block font-bold text-slate-400 uppercase tracking-wider">PostgreSQL Core</span>
              <span className="text-xs font-semibold text-emerald-600 flex items-center justify-end gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Live Sync Engaged
              </span>
            </div>
            <div className="h-5 w-[1px] bg-slate-200"></div>
            <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg relative">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* WORKSPACE SUBVIEW CONTEXT SWITCHER */}
        <main className="flex-1 overflow-y-auto p-8 w-full max-w-full">
          
          {/* VIEW: DASHBOARD */}
          {activePage === 'dashboard' && (
            <div className="space-y-8 w-full">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Recruitment Dashboard</h2>
                <p className="text-xs text-slate-400 mt-0.5">Real-time system telemetry sourced live via your connected FastAPI endpoints.</p>
              </div>

              {/* STATS TELEMETRY ROW */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'Total Tracked Demands', count: dashboardStats.total_demands, desc: 'Active pipeline requisitions', border: 'border-l-blue-500' },
                  { label: 'Registered Clients', count: dashboardStats.total_clients, desc: 'Partner corporate domain groups', border: 'border-l-purple-500' },
                  { label: 'Authorized Senders', count: dashboardStats.total_senders, desc: 'Whitelisted ingestion channels', border: 'border-l-emerald-500' },
                ].map((stat, idx) => (
                  <div key={idx} className={`bg-white p-5 rounded-xl border border-slate-200 border-l-4 ${stat.border} shadow-sm`}>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">{stat.label}</span>
                    <span className="text-3xl font-bold mt-2 block text-slate-800">{stat.count}</span>
                    <span className="text-[11px] text-slate-400 font-medium mt-2 block">{stat.desc}</span>
                  </div>
                ))}
              </div>

              {/* LOWER ROW ASYMMETRIC LOG SPLIT */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* RECENT EMAIL INGESTION QUEUE PREVIEW */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-500" />
                      <h3 className="font-bold text-xs text-slate-700">Processed Transmission Streams</h3>
                    </div>
                  </div>
                  <div className="p-4 divide-y divide-slate-100 max-h-[350px] overflow-y-auto">
                    {processedEmails.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">No historical emails processed yet.</p>
                    ) : (
                      processedEmails.map((email, idx) => (
                        <div key={idx} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-mono font-bold text-slate-600 truncate max-w-[160px]">{email.sender_email || email.sender}</span>
                          </div>
                          <p className="text-xs text-slate-800 font-semibold truncate">{email.subject}</p>
                          <button 
                            onClick={() => setPreviewEmail({ 
                              client: email.client_name || 'System Ingestion Logs', 
                              role: email.subject, 
                              originalEmail: `From: ${email.sender_email || email.sender}\nSubject: ${email.subject}\n\n${email.body || email.raw_body || 'No raw email body attached.'}`
                            })} 
                            className="mt-1 text-[11px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                          >
                            View Transmitted Payload
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* MAIN ACTIVE DATA TRANSCRIPT INTERFACE */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden lg:col-span-2">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider">Live Requirements Pipeline</h3>
                    <button onClick={() => setActivePage('demands')} className="text-xs text-blue-600 font-bold hover:underline">Launch Full Workspace →</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                          <th className="p-4 pl-6">ID</th>
                          <th className="p-4">Partnership Client</th>
                          <th className="p-4">Extracted Role Target</th>
                          <th className="p-4">Confidence Metric</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {requirements.slice(0, 5).map((rec) => {
                          const reqId = rec.id || rec.demand_id;
                          return (
                            <tr key={reqId} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => { setSelectedReqId(reqId); setActivePage('details'); }}>
                              <td className="p-4 pl-6 font-mono font-bold text-blue-600">{reqId}</td>
                              <td className="p-4 font-bold text-slate-900">{rec.client || rec.client_name || 'Unknown Client'}</td>
                              <td className="p-4 font-semibold text-slate-700">{rec.role || rec.extracted_role}</td>
                              <td className="p-4">{renderConfidenceBadge(rec.confidence || rec.confidence_score)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* VIEW: OPEN REQUIREMENTS MASTER LEDGER */}
          {activePage === 'demands' && (
            <div className="space-y-6 w-full">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">Open Requirements Workspace</h2>
                <p className="text-xs text-slate-400 mt-0.5">Filter and review raw extraction nodes mapping directly from the PostgreSQL engine tables.</p>
              </div>

              {/* FILTER OPTIONS CONTROLLER CARD */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between w-full">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Client Filter Matrix</span>
                    <select 
                      className="border border-slate-200 bg-slate-50 text-xs rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 focus:outline-none"
                      value={clientFilter}
                      onChange={(e) => setClientFilter(e.target.value)}
                    >
                      <option value="All">All Portfolio Corporations</option>
                      {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={() => { setGlobalSearch(''); setClientFilter('All'); }} className="text-xs font-bold text-slate-400 hover:text-slate-700 underline">Clear Active Filters</button>
              </div>

              {/* FULL MAIN TABLE MATRIX */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden w-full">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <th className="p-4 pl-6">ID Token</th>
                        <th className="p-4">Client Profile</th>
                        <th className="p-4">Extracted Role Requirement</th>
                        <th className="p-4">Confidence Header</th>
                        <th className="p-4">Source Label Mapping</th>
                        <th className="p-4 pr-6 text-right">Action Routing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRequirements.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center p-16 text-slate-400">
                            <Inbox className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                            <p className="font-semibold text-sm text-slate-700">No synchronized postgres records discovered matching queries.</p>
                          </td>
                        </tr>
                      ) : (
                        filteredRequirements.map((rec) => {
                          const reqId = rec.id || rec.demand_id;
                          return (
                            <tr key={reqId} className="hover:bg-slate-50/40">
                              <td className="p-4 pl-6 font-mono font-bold text-blue-600">{reqId}</td>
                              <td className="p-4 font-bold text-slate-900">{rec.client || rec.client_name || 'Unassigned Account'}</td>
                              <td className="p-4 font-semibold text-slate-700">{rec.role || rec.extracted_role}</td>
                              <td className="p-4">{renderConfidenceBadge(rec.confidence || rec.confidence_score)}</td>
                              <td className="p-4">{renderSourceLabel(rec.source || rec.source_type)}</td>
                              <td className="p-4 pr-6 text-right">
                                <button 
                                  onClick={() => { setSelectedReqId(reqId); setActivePage('details'); }}
                                  className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
                                >
                                  Inspect Details
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
            </div>
          )}

          {/* VIEW: REQUIREMENT DETAILS SPECIFIC ANALYSIS */}
          {activePage === 'details' && (
            <div className="space-y-6 w-full">
              {!currentRequirement ? (
                <div className="bg-white p-12 text-center text-slate-400 border rounded-xl">No active requirement records loaded.</div>
              ) : (
                <>
                  <div className="flex justify-between items-center border-b border-slate-200 pb-5">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold">{currentRequirement.id || currentRequirement.demand_id}</span>
                      <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                        {currentRequirement.client || currentRequirement.client_name} <span className="font-medium text-slate-400">/</span> {currentRequirement.role || currentRequirement.extracted_role}
                      </h2>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white border border-slate-200 p-6 rounded-xl space-y-4 shadow-sm">
                      <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Extracted Text Schema</h3>
                      <div className="bg-slate-50 p-4 rounded-lg font-mono text-xs text-slate-700 whitespace-pre-line border border-slate-200">
                        {currentRequirement.description || currentRequirement.raw_text_payload || "No explicit description body logged."}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                        <div>
                          <span className="text-slate-400 font-bold block uppercase tracking-wider text-[10px]">Sender Email</span>
                          <span className="font-mono text-slate-800 mt-1 block bg-slate-50 p-2 rounded border">{currentRequirement.emailSender || currentRequirement.sender_email || 'Unlogged Domain'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold block uppercase tracking-wider text-[10px]">Processing Metrics Baseline</span>
                          <div className="mt-2 flex gap-2">
                            {renderConfidenceBadge(currentRequirement.confidence || currentRequirement.confidence_score)}
                            {renderSourceLabel(currentRequirement.source || currentRequirement.source_type)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-3">
                      <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider border-b pb-2">Operational Metadata</h3>
                      <p className="text-xs text-slate-500 font-medium">This record is securely stored inside the persistence engine framework and can be audited via tracking logs.</p>
                      <button 
                        onClick={() => setPreviewEmail({
                          client: currentRequirement.client || currentRequirement.client_name,
                          role: currentRequirement.role || currentRequirement.extracted_role,
                          originalEmail: `From: ${currentRequirement.emailSender || currentRequirement.sender_email}\nSubject: Ingested Pipeline Payload\n\n${currentRequirement.description || currentRequirement.raw_text_payload}`
                        })}
                        className="w-full text-center py-2 border text-xs font-bold rounded-lg hover:bg-slate-50"
                      >
                        Launch Raw Mail Inspector
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* VIEW: CLIENT MANAGEMENT VIEW */}
          {activePage === 'clients' && (
            <div className="space-y-6 w-full">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Portfolio Clients Management</h2>
                <p className="text-xs text-slate-400 mt-0.5">Persist new accounts and assign administrative account managers directly to postgres rows.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <form onSubmit={handleCommitClient} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
                  <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider border-b pb-2">Add Corporate Client</h3>
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Client Entity Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. ABC Technologies"
                        className="w-full border rounded-lg p-2 bg-slate-50 font-medium text-slate-800 focus:outline-none"
                        value={newClient.name}
                        onChange={e => setNewClient({...newClient, name: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Corporate Domain Validation Mapping</label>
                      <input 
                        type="text" 
                        placeholder="e.g. abctechnologies.com"
                        className="w-full border rounded-lg p-2 bg-slate-50 font-mono text-slate-800 focus:outline-none"
                        value={newClient.domain}
                        onChange={e => setNewClient({...newClient, domain: e.target.value})}
                      />
                    </div>
                    <button type="submit" className="w-full py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-xs">
                      Write Client To Database
                    </button>
                  </div>
                </form>

                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <th className="p-4 pl-6">Client Identity</th>
                        <th className="p-4">Whitelisting Corporate Domain</th>
                        <th className="p-4">Assigned Delivery Manager</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {clients.map(c => (
                        <tr key={c.id || c.client_id} className="hover:bg-slate-50/40">
                          <td className="p-4 pl-6 font-bold text-slate-900">{c.name}</td>
                          <td className="p-4 font-mono text-blue-600 font-semibold">@{c.domain}</td>
                          <td className="p-4 text-slate-500 font-medium">{c.account_manager || 'Alex Rivera'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: APPROVED SENDERS CONFIGURATOR */}
          {activePage === 'senders' && (
            <div className="space-y-6 w-full">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Approved Senders Directory</h2>
                <p className="text-xs text-slate-400 mt-0.5">Whitelist external communication handles and link them to relational corporate entities.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <form onSubmit={handleCommitSender} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
                  <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider border-b pb-2">Link Verified Email Handle</h3>
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Sender Email Address</label>
                      <input 
                        type="email" 
                        placeholder="e.g. staffing@abctechnologies.com"
                        className="w-full border rounded-lg p-2 bg-slate-50 font-mono text-slate-800 focus:outline-none"
                        value={newSender.email}
                        onChange={e => setNewSender({...newSender, email: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Relational Database Destination Client</label>
                      <select 
                        className="w-full border rounded-lg p-2 bg-slate-50 text-slate-800 font-semibold focus:outline-none"
                        value={newSender.client_id}
                        onChange={e => setNewSender({...newSender, client_id: e.target.value})}
                      >
                        <option value="">-- Choose Corporate Target --</option>
                        {clients.map(c => <option key={c.id || c.client_id} value={c.id || c.client_id}>{c.name}</option>)}
                      </select>
                    </div>
                    <button type="submit" className="w-full py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 text-xs">
                      Authorize Whitelist Handle
                    </button>
                  </div>
                </form>

                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <th className="p-4 pl-6">Authorized Whitelist Email Address</th>
                        <th className="p-4">Relational Client Scope ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {senders.map(s => (
                        <tr key={s.id || s.sender_id} className="hover:bg-slate-50/40">
                          <td className="p-4 pl-6 font-mono font-bold text-slate-800">{s.email}</td>
                          <td className="p-4 font-mono font-bold text-purple-600">Client Reference Pointer: #{s.client_id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: ACTIVITY TRANSCRIPTS FROM BACKEND */}
          {activePage === 'processed' && (
            <div className="space-y-4 w-full">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">Processed Ingestion Streams Logs</h2>
                <p className="text-xs text-slate-400 mt-0.5">Immutable historic index log tracks raw metadata parsed during server webhook runtime events.</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden w-full">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <th className="p-4 pl-6">Sender Email Inflow Origin</th>
                      <th className="p-4">Parsed E-mail Header Subject Field</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {processedEmails.map((log, index) => (
                      <tr key={index} className="hover:bg-slate-50/40">
                        <td className="p-4 pl-6 font-bold text-slate-800">{log.sender_email || log.sender}</td>
                        <td className="p-4 font-sans text-slate-700 font-semibold">{log.subject}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* RAW EMAIL INSPECTOR MODAL LIGHTBOX */}
      {previewEmail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">Raw System Log Preview</span>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">{previewEmail.client} — {previewEmail.role}</h3>
              </div>
              <button onClick={() => setPreviewEmail(null)} className="text-xs text-slate-400 hover:text-slate-600 font-bold border rounded-lg px-2.5 py-1 bg-white">✕ Close</button>
            </div>
            <div className="p-6 overflow-y-auto bg-slate-950 text-slate-200 font-mono text-xs leading-relaxed select-text whitespace-pre-wrap">
              {previewEmail.originalEmail}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button onClick={() => setPreviewEmail(null)} className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800">Close Audit Inspector</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}