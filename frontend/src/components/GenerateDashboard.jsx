import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api';
import { useAuthStore } from '../store/authStore';
import { Send, BarChart3, Save, Code2, ChevronDown, ChevronUp, Sparkles, User, Bot, RotateCcw, ChevronsRight, ChevronsLeft, MessageSquare } from 'lucide-react';
import DashboardRenderer from './DashboardRenderer';

const GenerateDashboard = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const selectedModel = searchParams.get('model') || 'COMPETITORS';
  
  const [query, setQuery] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [error, setError] = useState('');
  const [showDax, setShowDax] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const token = useAuthStore(state => state.token);
  const chatEndRef = useRef(null);

  const handleNewChat = () => {
    setChatHistory([]);
    setDashboardData(null);
    setError('');
    setQuery('');
  };

  // Auto-scroll to bottom of chat when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, loading]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userMessage = { role: 'user', content: query };
    setChatHistory(prev => [...prev, userMessage]);
    
    const currentQuery = query;
    setQuery(''); // Clear input immediately
    setLoading(true);
    setError('');
    
    try {
      const res = await api.post('/api/chat/', {
        user_query: currentQuery,
        semantic_model: selectedModel,
        chat_history: chatHistory
      });
      
      if (res.data.error) {
        setChatHistory(prev => [...prev, { 
          role: 'assistant', 
          content: `Error: ${res.data.error}`,
          isError: true
        }]);
        setLoading(false);
        return;
      }

      let configObj = null;
      try {
        configObj = JSON.parse(res.data.layout_config);
      } catch (e) {
        console.error("Failed to parse layout config", res.data.layout_config);
      }

      setDashboardData({
        config: configObj,
        data: res.data.raw_data,
        dax: res.data.dax_query,
        lastQuery: currentQuery
      });

      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: `Dashboard generated for: "${currentQuery}"`,
        dax: res.data.dax_query
      }]);

    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred during generation');
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, there was an error generating your dashboard. Please try again.',
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!dashboardData) return;
    try {
      await api.post('/api/dashboards/', {
        title: dashboardData.lastQuery || 'Generated Dashboard',
        semantic_model: selectedModel,
        layout_config: JSON.stringify(dashboardData.config),
        chat_history: JSON.stringify(chatHistory),
        raw_data: JSON.stringify(dashboardData.data)
      });
      alert('Dashboard saved!');
    } catch (error) {
      alert('Failed to save dashboard');
    }
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Dashboard Display Area */}
      <div className="flex-1 flex flex-col bg-slate-50 relative">

        {/* Top header bar */}
        <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 z-10">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              {dashboardData && <Sparkles className="w-4 h-4 text-genviz-orange" />}
              {dashboardData ? <span className="capitalize">{dashboardData.lastQuery}</span> : 'Generate Dashboard'}
            </h2>
            <p className="text-xs text-slate-400 flex items-center mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-genviz-orange mr-1.5 inline-block"></span>
              {selectedModel} Semantic Model
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isChatCollapsed && (
              <button
                onClick={() => setIsChatCollapsed(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-500 hover:border-genviz-accent hover:text-genviz-accent hover:bg-slate-50 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Show Chat
              </button>
            )}
            {dashboardData?.dax && (
              <button
                onClick={() => setShowDax(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-500 hover:border-genviz-accent hover:text-genviz-accent transition-colors"
              >
                <Code2 className="w-3.5 h-3.5" />
                DAX
                {showDax ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
            {dashboardData && (
              <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-genviz-accent hover:bg-genviz-accentHover text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-genviz-primary/20">
                <Save className="w-3.5 h-3.5" />
                Save
              </button>
            )}
          </div>
        </div>

        {/* DAX inspector drawer */}
        {showDax && dashboardData?.dax && (
          <div className="bg-slate-900 text-slate-300 font-mono text-xs px-6 py-4 border-b border-slate-800 max-h-48 overflow-y-auto shrink-0">
            <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-2 font-sans">Generated DAX Query</p>
            <pre className="whitespace-pre-wrap leading-relaxed">{dashboardData.dax}</pre>
          </div>
        )}

        <div className="flex-1 overflow-hidden relative">
          {isChatCollapsed && (
            <button
              onClick={() => setIsChatCollapsed(false)}
              title="Open Chat"
              className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-white border border-r-0 border-slate-200 hover:border-genviz-accent hover:text-genviz-accent shadow-md rounded-l-xl p-2.5 z-30 transition-all flex items-center justify-center text-slate-500 group cursor-pointer"
            >
              <ChevronsLeft className="w-4.5 h-4.5 group-hover:-translate-x-0.5 transition-transform" />
            </button>
          )}
          {error && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl shadow-sm z-20 max-w-lg w-full text-sm flex items-center gap-2">
              <span className="font-semibold">Error:</span> {error}
            </div>
          )}

          {!dashboardData && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
              <div className="relative mb-8">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center bg-genviz-orange shadow-lg shadow-orange-200">
                  <BarChart3 className="w-9 h-9 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">Your dashboard will appear here</h3>
              <p className="text-slate-400 max-w-sm text-sm leading-relaxed">
                Ask a question in natural language — the AI will generate the DAX query, retrieve live data, and build your dashboard automatically.
              </p>
              <div className="flex items-center gap-6 mt-8 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-genviz-accent"></span>Live Data</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-genviz-orange"></span>AI-Generated</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>Interactive Charts</span>
              </div>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 backdrop-blur-sm z-20">
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-14 h-14">
                  <div className="absolute inset-0 rounded-full border-2 border-slate-200"></div>
                  <div className="absolute inset-0 rounded-full border-2 border-t-genviz-accent border-r-genviz-orange animate-spin"></div>
                </div>
                <div className="text-center">
                  <p className="text-slate-700 font-semibold text-sm">Generating your dashboard…</p>
                  <p className="text-slate-400 text-xs mt-1">Running DAX · Fetching data · Building charts</p>
                </div>
              </div>
            </div>
          )}

          {dashboardData?.config && (
            <div className="h-full overflow-y-auto p-6">
              <DashboardRenderer layoutConfig={dashboardData.config} rawData={dashboardData.data} />
            </div>
          )}
        </div>
      </div>

      {/* Chat Side Panel */}
      <div 
        className="bg-white flex flex-col shrink-0 shadow-[-4px_0_20px_rgba(0,0,0,0.04)] z-20"
        style={{ 
          width: isChatCollapsed ? '0px' : '384px', 
          minWidth: isChatCollapsed ? '0px' : '384px', 
          borderLeftWidth: isChatCollapsed ? '0px' : '1px', 
          borderLeftColor: '#e2e8f0',
          borderLeftStyle: 'solid',
          opacity: isChatCollapsed ? 0 : 1, 
          overflow: 'hidden',
          transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <div className="p-5 border-b border-slate-100 flex-shrink-0 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Chat & Actions</h3>
            <p className="text-xs text-slate-400 mt-1 flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-genviz-orange mr-1.5 inline-block"></span>
              {selectedModel} Semantic Model
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleNewChat}
              title="New Empty Chat"
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:border-genviz-accent hover:text-genviz-accent hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-center"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsChatCollapsed(true)}
              title="Collapse Chat"
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:border-genviz-accent hover:text-genviz-accent hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-center"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Chat History Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30">
          {chatHistory.length === 0 ? (
            <div className="text-center mt-6">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Example Queries</p>
              <div className="space-y-2">
                {(() => {
                  const examples = {
                    COMPETITORS: [
                      "BA ASK, CRASK, and PRASK for 2025 by quarter",
                      "BA ASK, CRASK, and PRASK increase for 2025 vs last year by quarter"
                    ]
                  };
                  return (examples[selectedModel] || []).map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setQuery(q)}
                      className="w-full text-left text-xs text-slate-600 border border-slate-200 p-3 rounded-xl hover:border-genviz-accent hover:text-genviz-accent cursor-pointer transition-all bg-white hover:bg-slate-50 hover:shadow-sm group"
                    >
                      <span className="font-medium text-genviz-accent opacity-0 group-hover:opacity-100 mr-1 transition-opacity">→</span>
                      {q}
                    </button>
                  ));
                })()}
              </div>
            </div>
          ) : (
            chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${msg.isError ? 'bg-red-100 text-red-600' : 'bg-genviz-accent/10 text-genviz-accent'}`}>
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-genviz-accent text-white rounded-tr-sm' 
                    : msg.isError 
                      ? 'bg-red-50 text-red-600 border border-red-100 rounded-tl-sm'
                      : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))
          )}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-6 h-6 rounded-full bg-genviz-accent/10 text-genviz-accent flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-100 bg-white shrink-0">
          <form onSubmit={handleGenerate} className="flex flex-col gap-3">
            <div className="relative">
              <textarea
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-genviz-accent/30 focus:border-genviz-accent resize-none transition-all focus:bg-white"
                rows={2}
                placeholder="Ask about data..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerate(e);
                  }
                }}
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="absolute right-2 bottom-2 p-2 bg-genviz-orange text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-center text-slate-400">Press Enter to generate · Shift+Enter for new line</p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default GenerateDashboard;
