import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuthStore } from '../store/authStore';
import { Save, Check, LayoutGrid, BarChart2 as ChartIcon, Settings2, Sparkles } from 'lucide-react';

const PromptEditor = ({ prompt, onSave }) => {
  const [content, setContent] = useState(prompt.content);
  const [status, setStatus] = useState('idle'); // idle, saving, saved, error
  
  // Update local content if parent prompt changes (e.g. initial load)
  useEffect(() => {
    setContent(prompt.content);
  }, [prompt.content]);

  const handleSave = async () => {
    setStatus('saving');
    try {
      await onSave(prompt.id, content);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (e) {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2500);
    }
  };

  const isDirty = content !== prompt.content;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm transition-all hover:shadow-md">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-slate-800">{prompt.prompt_type}</h3>
          <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded uppercase tracking-wider">Instructions</span>
        </div>
        <div className="flex items-center gap-3">
          {status === 'error' && <span className="text-xs text-red-500 font-medium">Failed to save</span>}
          <button 
            onClick={handleSave}
            disabled={status === 'saving' || (!isDirty && status === 'idle')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              status === 'saved' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : status === 'saving' 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-transparent' 
                  : isDirty 
                    ? 'bg-genviz-accent text-white hover:bg-genviz-accentHover shadow-sm shadow-genviz-primary/20 border border-transparent' 
                    : 'bg-white border border-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {status === 'saved' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {status === 'saved' ? 'Saved!' : status === 'saving' ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
      <div className="p-6 bg-white">
        <textarea
          className={`w-full h-48 p-4 border rounded-lg focus:ring-2 focus:outline-none font-mono text-sm text-slate-700 resize-y shadow-inner transition-colors ${
            isDirty ? 'border-genviz-orange/50 focus:ring-genviz-orange/20 focus:border-genviz-orange' : 'border-slate-200 focus:ring-genviz-accent/20 focus:border-genviz-accent'
          }`}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (status === 'saved' || status === 'error') setStatus('idle');
          }}
          placeholder={`Enter your ${prompt.prompt_type} instructions here...`}
        />
        {isDirty && <p className="text-[10px] text-genviz-orange mt-2 font-medium">Unsaved changes</p>}
      </div>
    </div>
  );
};

const SystemPrompts = () => {
  const [prompts, setPrompts] = useState([]);
  const [metadata, setMetadata] = useState('');
  const [activeModel, setActiveModel] = useState('COMPETITORS');
  const [settings, setSettings] = useState([]);
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    fetchPrompts();
  }, []);


  useEffect(() => {
    fetchMetadata(activeModel);
  }, [activeModel]);

  const fetchPrompts = async () => {
    try {
      const res = await api.get('/api/prompts/');
      setPrompts(res.data);
    } catch (error) {
      console.error("Error fetching prompts", error);
    }
  };

  const fetchMetadata = async (model) => {
    if (model === 'DASHBOARD') {
      setMetadata('');
      return;
    }
    try {
      const res = await api.get(`/api/prompts/metadata/${model}`);
      setMetadata(res.data.content);
    } catch (error) {
      console.error("Error fetching metadata", error);
      setMetadata('// Metadata could not be loaded');
    }
  };

  const updatePrompt = async (id, newContent) => {
    try {
      await api.put(`/api/prompts/${id}`, { content: newContent });
      fetchPrompts();
    } catch (error) {
      console.error("Error updating prompt", error);
    }
  };

  const parseMetadata = (dataStr) => {
    if (!dataStr) return {};
    try {
      return JSON.parse(dataStr);
    } catch {
      return { error: 'Invalid JSON format', raw: dataStr };
    }
  };

  const filteredPrompts = prompts.filter(p => p.semantic_model === activeModel);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white m-4 rounded-2xl shadow-sm border border-slate-200">
      <div className="p-8 border-b border-slate-200 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">System Prompts</h2>
          <p className="text-slate-500 text-sm mt-1">Customise the instructions Claude uses when generating DAX queries.</p>
        </div>
      </div>

      <div className="p-8 flex-1 overflow-y-auto">

        <div className="flex space-x-2 mb-8 bg-slate-100 p-1 rounded-lg w-max">
          {['COMPETITORS', 'DASHBOARD'].map(model => (
            <button
              key={model}
              onClick={() => setActiveModel(model)}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                activeModel === model 
                  ? 'bg-white text-slate-800 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {model === 'DASHBOARD' ? '⚙ Dashboard Gen' : model.charAt(0) + model.slice(1).toLowerCase()}
            </button>
          ))}
        </div>


        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-genviz-orange" />
          <h3 className="text-lg font-bold text-slate-800">AI Prompt Engineering</h3>
        </div>

        <div className="space-y-6">
          {activeModel === 'DASHBOARD' ? (
            <>
              <div className="mb-4 p-4 rounded-xl bg-blue-50 border border-blue-200">
                <p className="text-sm text-blue-700 font-medium">🎨 Dashboard Generation Instructions</p>
                <p className="text-xs text-blue-500 mt-1">
                  These instructions control how the AI converts query results into chart configurations.
                  Changes apply immediately to all future dashboard generations.
                </p>
              </div>
              {filteredPrompts.map(prompt => (
                <PromptEditor key={prompt.id} prompt={prompt} onSave={updatePrompt} />
              ))}
            </>
          ) : (
            filteredPrompts.map(prompt => (
              <PromptEditor key={prompt.id} prompt={prompt} onSave={updatePrompt} />
            ))
          )}

          {activeModel !== 'DASHBOARD' && (
            <div className="border border-slate-200 rounded-xl overflow-hidden mt-8">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-semibold text-slate-800">SCHEMA METADATA</h3>
                <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded">JSON VIEWER</span>
              </div>
              <div className="p-6 bg-white overflow-x-auto max-h-96 overflow-y-auto rounded-b-xl">
                <div className="min-w-max">
                  <JsonViewerNode nodeKey="JSON" data={parseMetadata(metadata)} initiallyExpanded={true} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper component for rendering JSON data interactively like a classic tree viewer
const JsonViewerNode = ({ nodeKey, data, initiallyExpanded = false }) => {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  
  if (data === undefined) return null;
  
  const isObject = typeof data === 'object' && data !== null;
  const isArray = Array.isArray(data);
  const isEmpty = isObject && Object.keys(data).length === 0;

  const toggle = (e) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  if (!isObject) {
    const isString = typeof data === 'string';
    return (
      <div className="flex items-center py-[2px] ml-[15px] font-sans text-[12px] leading-tight">
        <div className="w-[12px] flex justify-center mr-1 shrink-0">
          <div className="w-[5px] h-[5px] bg-[#003399]"></div>
        </div>
        <span className="text-black">{nodeKey} : </span>
        <span className="text-black ml-1">{isString ? `"${data}"` : String(data)}</span>
      </div>
    );
  }

  return (
    <div className="font-sans text-[12px] leading-tight select-none">
      <div className="flex items-center py-[2px] cursor-pointer hover:bg-slate-100 w-max pr-2 rounded" onClick={toggle}>
        <div className="w-[12px] h-[12px] flex items-center justify-center mr-1 shrink-0">
          {!isEmpty ? (
            <div className="w-[9px] h-[9px] border border-slate-500 flex items-center justify-center bg-white text-[8px] leading-none text-black font-bold pb-[1px]">
              {expanded ? '-' : '+'}
            </div>
          ) : null}
        </div>
        <span className="text-[#000080] font-bold text-[13px] mr-1">{isArray ? '[]' : '{}'}</span>
        <span className="text-black">{nodeKey}</span>
      </div>
      
      {expanded && !isEmpty && (
        <div className="ml-[5px] pl-[10px] border-l border-dotted border-slate-400">
          {Object.keys(data).map((key) => (
            <JsonViewerNode 
              key={key} 
              nodeKey={key} 
              data={data[key]} 
              initiallyExpanded={false}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SystemPrompts;
