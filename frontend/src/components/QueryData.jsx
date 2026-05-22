import React, { useState } from 'react';
import api from '../api';
import { useAuthStore } from '../store/authStore';
import { Send, Database, Code2, ChevronDown, ChevronUp, TableProperties, AlertTriangle, CheckCircle2 } from 'lucide-react';

const MODELS = ['COMPETITORS'];

const MODEL_BADGE = {
  COMPETITORS: 'bg-orange-50 text-orange-700 border border-orange-200',
};

// ─── Data Table ───────────────────────────────────────────────────────────────
const DataTable = ({ rows, formatMap = {} }) => {
  if (!rows || rows.length === 0) return (
    <p className="text-sm text-slate-400 italic">Query returned no rows.</p>
  );

  // Union keys across all rows — PBI omits null-valued columns in sparse rows
  const columns = [...new Set(rows.flatMap(r => Object.keys(r)))];

  // Parse PBI format string → a JS formatter function
  const makeFmt = (pbiFormat) => {
    if (!pbiFormat) return null;
    const posFormat = pbiFormat.split(';')[0].trim();
    
    // Extract custom suffix in quotes (e.g. " M", " K", " c")
    let suffix = '';
    const suffixMatch = posFormat.match(/"([^"]+)"?/);
    if (suffixMatch) {
      suffix = suffixMatch[1].replace(/"/g, '');
    } else if (posFormat.includes('%')) {
      suffix = '%';
    } else if (posFormat.endsWith('M')) {
      suffix = ' M';
    } else if (posFormat.endsWith('K')) {
      suffix = ' K';
    }

    // Determine decimal places
    let decimals = 0;
    const decimalMatch = posFormat.match(/\.([0#]+)/);
    if (decimalMatch) {
      decimals = decimalMatch[1].length;
    } else if (posFormat.includes('%')) {
      decimals = 1; // default to 1 decimal for percentage if not specified
    }

    return (v) => {
      let scaleValue = v;
      if (posFormat.includes('%')) {
        scaleValue = v * 100;
      }
      const formattedNum = scaleValue.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
      return `${formattedNum}${suffix}`;
    };
  };

  const fmtCell = (col, val) => {
    if (val === null || val === undefined) return '—';
    if (typeof val !== 'number') return String(val);

    let pbiFormat = formatMap[col];
    if (!pbiFormat) {
      const keys = Object.keys(formatMap);
      const searchKey = col.toLowerCase().replace(/^\[|\]$/g, '');
      const match = keys.find(k => {
        const cleanK = k.toLowerCase().replace(/^\[|\]$/g, '').replace(/^_/, '');
        return cleanK === searchKey || cleanK === searchKey.replace(/^_/, '');
      });
      if (match) pbiFormat = formatMap[match];
    }

    const fmt = makeFmt(pbiFormat);
    if (fmt) return fmt(val);
    
    // Fallback formatting for numbers
    const colUpper = col.toUpperCase();
    const isPctKeyword = ['OTP', 'REGULARITY', 'FACTOR', 'MARGIN', 'RATE', '%'].some(k => colUpper.includes(k));
    if (isPctKeyword || (val > 0 && val < 1 && String(val).length > 5)) {
      return (val * 100).toFixed(2) + '%';
    }
    return val.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {columns.map(col => (
              <th key={col} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={`border-b border-slate-100 transition-colors hover:bg-genviz-primary/5 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
              {columns.map(col => (
                <td key={col} className="px-4 py-2.5 text-slate-700 whitespace-nowrap font-mono text-xs">
                  {row[col] === null ? <span className="text-slate-300 italic">null</span> : fmtCell(col, row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center gap-1.5">
        <TableProperties className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs text-slate-400">{rows.length} row{rows.length !== 1 ? 's' : ''} returned</span>
      </div>
    </div>
  );
};

// ─── DAX Inspector ────────────────────────────────────────────────────────────
const DaxBlock = ({ dax }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 bg-slate-900 text-left"
      >
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Generated DAX Query</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {open && (
        <pre className="bg-slate-950 text-slate-300 font-mono text-xs px-5 py-4 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
          {dax}
        </pre>
      )}
    </div>
  );
};

// ─── Result Card ─────────────────────────────────────────────────────────────
const ResultCard = ({ result }) => (
  <div className="space-y-4 mt-6">
    <div className="flex items-center gap-2">
      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      <span className="text-sm font-semibold text-slate-700">Query executed successfully</span>
      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${MODEL_BADGE[result.semantic_model] || 'bg-slate-100 text-slate-600'}`}>
        {result.semantic_model}
      </span>
    </div>
    <DaxBlock dax={result.dax_query} />
    <DataTable rows={result.raw_data} formatMap={result.format_map} />
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
const QueryData = () => {
  const [query, setQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState('COMPETITORS');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const token = useAuthStore(state => state.token);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    setError('');

    try {
      const res = await api.post('/api/chat/', {
        user_query: query,
        semantic_model: selectedModel
      });

      const data = res.data;
      if (data.error) {
        setError(data.error);
      } else {
        setResult({ ...data, semantic_model: selectedModel });
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred while running the query.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden">

      {/* Results Area */}
      <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
        {/* Header */}
        <div className="h-16 border-b border-slate-200 bg-white flex items-center px-6 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Database className="w-5 h-5 text-genviz-accent" />
              Query Data
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Write a question in natural language — see the DAX and live data results.</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Empty state */}
          {!loading && !result && !error && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 bg-genviz-orange shadow-lg shadow-orange-200">
                <Database className="w-9 h-9 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-700 mb-2">Run a data query</h3>
              <p className="text-slate-400 text-sm max-w-md">
                Type your question on the right. The AI will generate the DAX query, execute it against Power BI, and display the raw results here.
              </p>
              <div className="mt-8 flex items-center gap-6 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-genviz-orange" />NL → DAX</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-genviz-orange" />Live Power BI</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-purple-400" />Raw table view</span>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-2 border-slate-200" />
                <div className="absolute inset-0 rounded-full border-2 border-t-genviz-accent border-r-genviz-orange animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-slate-700 font-semibold text-sm">Running query…</p>
                <p className="text-slate-400 text-xs mt-1">Generating DAX · Executing on Power BI</p>
              </div>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="max-w-3xl mx-auto">
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4 mt-4">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700 mb-1">Query Failed</p>
                  <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono leading-relaxed">{error}</pre>
                </div>
              </div>
            </div>
          )}

          {/* Result */}
          {!loading && result && (
            <div className="max-w-5xl mx-auto">
              <ResultCard result={result} />
            </div>
          )}
        </div>
      </div>

      {/* Right panel — Query Input */}
      <div className="w-80 border-l border-slate-200 bg-white flex flex-col shrink-0 shadow-[-4px_0_20px_rgba(0,0,0,0.04)] z-20">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">Ask a Question</h3>
          <p className="text-xs text-slate-400 mt-1">Returns raw data — no chart</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Model selector */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Semantic Model</p>
            <div className="flex flex-col gap-1.5">
              {MODELS.map(m => (
                <button
                  key={m}
                  onClick={() => setSelectedModel(m)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    selectedModel === m
                      ? 'border-genviz-orange text-genviz-orange bg-genviz-orange/5'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
                  }`}
                >
                  <Database className="w-4 h-4" />
                  {m.charAt(0) + m.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Example queries */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Examples</p>
            <div className="space-y-2">
              {[
                { label: "Competitor ASK 2025",    q: "BA ASK, CRASK, and PRASK for 2025 by quarter",                           m: "COMPETITORS" },
                { label: "Competitor ASK Increase",q: "BA ASK, CRASK, and PRASK increase for 2025 vs last year by quarter",     m: "COMPETITORS" },
              ].map((ex, i) => (
                <button
                  key={i}
                  onClick={() => { setQuery(ex.q); setSelectedModel(ex.m); }}
                  className="w-full text-left text-xs text-slate-500 border border-slate-200 p-2.5 rounded-xl hover:border-genviz-orange hover:text-genviz-orange transition-all bg-white hover:bg-slate-50 group"
                >
                  <span className="font-medium text-genviz-orange opacity-0 group-hover:opacity-100 mr-1 transition-opacity">→</span>
                  {ex.label}
                  <span className={`float-right text-[9px] font-bold px-1.5 py-0.5 rounded-full ${MODEL_BADGE[ex.m]}`}>{ex.m}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Input form */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <textarea
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-genviz-accent/30 focus:border-genviz-accent resize-none transition-all shadow-sm"
              rows={4}
              placeholder="Ask a question about your data…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
              }}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="w-full flex items-center justify-center gap-2 bg-genviz-orange hover:opacity-90 text-white py-2.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm shadow-md shadow-orange-200"
            >
              {loading
                ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                : <Send className="w-4 h-4" />
              }
              <span>{loading ? 'Running…' : 'Run Query'}</span>
            </button>
            <p className="text-[10px] text-center text-slate-400">Enter to run · Shift+Enter for new line</p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default QueryData;
