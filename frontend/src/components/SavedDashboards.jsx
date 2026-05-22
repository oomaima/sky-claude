import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuthStore } from '../store/authStore';
import { LayoutGrid, BarChart3, Trash2, X, ArrowLeft, Calendar, Database } from 'lucide-react';
import DashboardRenderer from './DashboardRenderer';

// ─── Dashboard Card ───────────────────────────────────────────────────────────
const DashboardCard = ({ dash, onOpen, onDelete }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const modelColors = {
    COMPETITORS: 'bg-orange-50 text-orange-700 border border-orange-200',
  };

  return (
    <div
      className="group relative bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-[0_8px_30px_rgba(65,127,162,0.15)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
      onClick={() => onOpen(dash)}
    >
      {/* Top gradient bar */}
      <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #417FA2, #fe5b04)' }} />

      {/* Preview area */}
      <div className="h-32 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center border-b border-slate-100 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 grid grid-cols-8 gap-0.5 p-2">
          {[...Array(32)].map((_, i) => (
            <div key={i} className="bg-genviz-accent rounded-sm"
              style={{ height: `${20 + Math.random() * 60}%`, alignSelf: 'flex-end' }} />
          ))}
        </div>
        <BarChart3 className="w-10 h-10 text-genviz-accent/40 relative z-10" />
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-semibold text-slate-800 text-sm leading-snug line-clamp-2 flex-1">{dash.title}</h3>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${modelColors[dash.semantic_model] || 'bg-slate-100 text-slate-600'}`}>
            <Database className="w-2.5 h-2.5 inline mr-1" />{dash.semantic_model}
          </span>
        </div>
      </div>

      {/* Delete confirmation overlay */}
      {confirmDelete && (
        <div
          className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-6 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <Trash2 className="w-6 h-6 text-red-500" />
          <p className="text-sm font-semibold text-slate-800 text-center">Delete this dashboard?</p>
          <p className="text-xs text-slate-500 text-center">This action cannot be undone.</p>
          <div className="flex gap-2 w-full">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onDelete(dash.id)}
              className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const SavedDashboards = () => {
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDash, setOpenDash] = useState(null); // currently viewed dashboard
  const token = useAuthStore(state => state.token);

  useEffect(() => { fetchDashboards(); }, []);

  const fetchDashboards = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/dashboards/');
      setDashboards(res.data);
      setDashboards(res.data);
    } catch (error) {
      console.error("Error fetching dashboards", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/dashboards/${id}`);
      setDashboards(prev => prev.filter(d => d.id !== id));
      setDashboards(prev => prev.filter(d => d.id !== id));
      if (openDash?.id === id) setOpenDash(null);
    } catch (error) {
      console.error("Error deleting dashboard", error);
    }
  };

  const handleOpen = (dash) => {
    let config = null;
    let data = [];
    try { config = JSON.parse(dash.layout_config); } catch {}
    try { data = dash.raw_data ? JSON.parse(dash.raw_data) : []; } catch {}
    setOpenDash({ ...dash, config, data });
  };

  // ── Full-screen Dashboard view ──────────────────────────────────────────────
  if (openDash) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setOpenDash(null)}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div className="h-5 w-px bg-slate-200" />
            <div>
              <h2 className="text-base font-semibold text-slate-800 leading-tight">{openDash.title}</h2>
              <p className="text-xs text-slate-400">{openDash.semantic_model} Model</p>
            </div>
          </div>
          <button
            onClick={() => handleDelete(openDash.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>

        {/* Dashboard render */}
        <div className="flex-1 overflow-hidden bg-slate-50">
          {openDash.config ? (
            <div className="h-full overflow-y-auto p-6">
              <DashboardRenderer layoutConfig={openDash.config} rawData={openDash.data} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <BarChart3 className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Dashboard configuration could not be loaded.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Grid view ───────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-800">Saved Dashboards</h2>
          <p className="text-slate-500 text-sm mt-1">Click a dashboard card to open and view it.</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-genviz-accent animate-spin" />
          </div>
        )}

        {!loading && dashboards.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
              style={{ background: 'linear-gradient(135deg, #417FA215 0%, #fe5b0408 100%)', border: '1px solid #417FA220' }}>
              <LayoutGrid className="w-9 h-9 text-genviz-accent/50" />
            </div>
            <p className="text-lg font-semibold text-slate-600">No saved dashboards yet</p>
            <p className="text-sm text-slate-400 mt-1">Generate a dashboard and hit "Save" to see it here.</p>
          </div>
        )}

        {!loading && dashboards.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {dashboards.map(dash => (
              <DashboardCard key={dash.id} dash={dash} onOpen={handleOpen} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedDashboards;
