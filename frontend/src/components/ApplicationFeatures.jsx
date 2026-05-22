import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuthStore } from '../store/authStore';
import { LayoutGrid, BarChart2 as ChartIcon, Settings2 } from 'lucide-react';

const ApplicationFeatures = () => {
  const [settings, setSettings] = useState([]);
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (isSuperAdmin) fetchSettings();
  }, [isSuperAdmin]);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/api/settings/');
      setSettings(res.data);
      setSettings(res.data);
    } catch (error) {
      console.error("Error fetching settings", error);
    }
  };

  const updateSetting = async (key, value) => {
    try {
      await api.put(`/api/settings/${key}`, { value });
      fetchSettings();
      fetchSettings();
    } catch (error) {
      console.error("Error updating setting", error);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white m-4 rounded-2xl shadow-sm border border-slate-200">
        <p className="text-slate-500">You do not have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white m-4 rounded-2xl shadow-sm border border-slate-200">
      <div className="p-8 border-b border-slate-200 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Application Features</h2>
          <p className="text-slate-500 text-sm mt-1">Configure global application behavior and features.</p>
        </div>
      </div>

      <div className="p-8 flex-1 overflow-y-auto">
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <Settings2 className="w-5 h-5 text-genviz-orange" />
            <h3 className="text-lg font-bold text-slate-800">Core Configuration</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <LayoutGrid className="w-5 h-5 text-genviz-accent" />
                  </div>
                  <h4 className="font-bold text-slate-800">Generation Mode</h4>
                </div>
                <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                  Define the default output format for all users. Choose between a rich multi-panel dashboard or a focused single chart and table view.
                </p>
              </div>
              
              <div className="flex bg-slate-100 p-1.5 rounded-xl">
                {[
                  { id: 'FULL', label: 'Full Dashboard', icon: LayoutGrid },
                  { id: 'SINGLE', label: 'Single Chart & Table', icon: ChartIcon }
                ].map(mode => {
                  const isActive = settings.find(s => s.key === 'GENERATION_MODE')?.value === mode.id;
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => updateSetting('GENERATION_MODE', mode.id)}
                      className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-lg text-sm font-bold transition-all ${
                        isActive 
                          ? 'bg-white text-genviz-orange shadow-md ring-1 ring-black/5' 
                          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {mode.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Chart Catalogue Section */}
        <div>
          <div className="flex items-center gap-2 mb-6">
            <ChartIcon className="w-5 h-5 text-genviz-accent" />
            <h3 className="text-lg font-bold text-slate-800">Visual Insights Catalogue</h3>
          </div>
          <p className="text-sm text-slate-500 mb-6 -mt-2">All chart types available in the platform. The AI automatically selects the most appropriate type based on your query.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[
              {
                title: 'KPI Scorecard',
                badge: 'ALWAYS ON',
                badgeColor: 'bg-genviz-accent/10 text-genviz-accent',
                desc: 'Headline metric cards at the top of every dashboard for instant executive summary.',
                usage: 'Always generated in FULL mode for primary display metrics.',
                preview: (
                  <div className="text-center">
                    <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Total Revenue</div>
                    <div className="text-2xl font-black text-genviz-accent">1,240 M</div>
                    <div className="text-[9px] text-emerald-500 font-bold mt-1">↑ 3.2%</div>
                  </div>
                )
              },
              {
                title: 'Grouped Bar',
                badge: 'AUTO',
                badgeColor: 'bg-slate-100 text-slate-500',
                desc: 'Side-by-side bars comparing airlines or regions across time periods.',
                usage: 'Selected for categorical data with 2–12 time points and multiple series.',
                preview: (
                  <div className="flex items-end gap-1 h-12">
                    {[[8,12],[10,14],[6,9],[9,11]].map(([a,b],i) => (
                      <div key={i} className="flex items-end gap-0.5">
                        <div className="w-2.5 rounded-t-sm bg-genviz-accent/60" style={{height: `${a*4}px`}} />
                        <div className="w-2.5 rounded-t-sm bg-genviz-orange/60" style={{height: `${b*4}px`}} />
                      </div>
                    ))}
                  </div>
                )
              },
              {
                title: 'Stacked Bar',
                badge: 'NEW',
                badgeColor: 'bg-emerald-50 text-emerald-600',
                desc: 'Stacked segments showing part-to-whole composition across time or categories.',
                usage: 'Triggered by queries using: breakdown, split, composition, distribution, share.',
                preview: (
                  <div className="flex items-end gap-1.5 h-12">
                    {[[6,4,2],[7,5,3],[5,3,4],[8,4,2]].map(([a,b,c],i) => (
                      <div key={i} className="w-4 flex flex-col-reverse rounded-t-sm overflow-hidden" style={{height:'48px'}}>
                        <div className="bg-genviz-accent/70" style={{flex:a}} />
                        <div className="bg-genviz-orange/60" style={{flex:b}} />
                        <div className="bg-purple-400/60" style={{flex:c}} />
                      </div>
                    ))}
                  </div>
                )
              },
              {
                title: 'Standard Bar',
                badge: 'AUTO',
                badgeColor: 'bg-slate-100 text-slate-500',
                desc: 'Simple single-series bar chart for direct comparison of individual items.',
                usage: 'Used for single-dimension categorical snapshots with no time grouping.',
                preview: (
                  <div className="flex items-end gap-1.5 h-12">
                    {[10, 14, 8, 12, 6].map((h, i) => (
                      <div key={i} className="w-4 bg-genviz-accent/70 rounded-t-sm" style={{height: `${h*4}px`}} />
                    ))}
                  </div>
                )
              },
              {
                title: 'Line Chart',
                badge: 'AUTO',
                badgeColor: 'bg-slate-100 text-slate-500',
                desc: 'Continuous trend lines showing metric evolution over time.',
                usage: 'Selected for time-series data with > 12 data points or many airline series.',
                preview: (
                  <svg className="w-24 h-12" viewBox="0 0 100 40">
                    <path d="M0 30 Q 25 10, 50 35 T 100 5" fill="none" stroke="#417FA2" strokeWidth="2.5" strokeLinecap="round"/>
                    <path d="M0 35 Q 25 20, 50 25 T 100 15" fill="none" stroke="#fe5b04" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 2"/>
                  </svg>
                )
              },
              {
                title: 'Area Chart',
                badge: 'AUTO',
                badgeColor: 'bg-slate-100 text-slate-500',
                desc: 'Filled area chart showing volume and cumulative metric growth over time.',
                usage: 'Used for capacity, revenue, and volume trend analysis.',
                preview: (
                  <svg className="w-24 h-12" viewBox="0 0 100 40">
                    <path d="M0 40 L0 28 Q 25 8, 50 32 T 100 5 L100 40 Z" fill="#fe5b04" fillOpacity="0.2" stroke="#fe5b04" strokeWidth="2"/>
                    <path d="M0 40 L0 35 Q 25 18, 50 38 T 100 12 L100 40 Z" fill="#417FA2" fillOpacity="0.2" stroke="#417FA2" strokeWidth="2"/>
                  </svg>
                )
              },
              {
                title: 'Composed Chart',
                badge: 'AUTO',
                badgeColor: 'bg-slate-100 text-slate-500',
                desc: 'Mixed bars and lines on dual Y-axes for metrics with vastly different scales.',
                usage: 'Selected automatically when comparing ASK (millions) with OTP% (0–1).',
                preview: (
                  <div className="relative w-24 h-12">
                    <div className="absolute inset-0 flex items-end gap-1 px-1">
                      {[8,10,6,9].map((h,i) => <div key={i} className="flex-1 bg-slate-200 rounded-t-sm" style={{height:`${h*4}px`}}/>)}
                    </div>
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 40">
                      <path d="M10 28 L35 18 L65 32 L90 10" fill="none" stroke="#417FA2" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                )
              },
              {
                title: 'Radar Chart',
                badge: 'NEW',
                badgeColor: 'bg-emerald-50 text-emerald-600',
                desc: 'Spider/radar chart comparing multiple airlines across several KPIs simultaneously.',
                usage: 'Triggered by compare, overview, profile queries with 3+ metrics and 3+ entities.',
                preview: (
                  <svg className="w-14 h-14" viewBox="0 0 100 100">
                    <polygon points="50,5 95,30 82,80 18,80 5,30" fill="none" stroke="#e2e8f0" strokeWidth="1.5"/>
                    <polygon points="50,27 75,40 66,64 34,64 25,40" fill="none" stroke="#e2e8f0" strokeWidth="1"/>
                    <polygon points="50,15 85,35 73,72 27,72 15,35" fill="#417FA2" fillOpacity="0.15" stroke="#417FA2" strokeWidth="2"/>
                    <polygon points="50,20 78,38 68,70 32,70 22,38" fill="#fe5b04" fillOpacity="0.12" stroke="#fe5b04" strokeWidth="2"/>
                  </svg>
                )
              },
              {
                title: 'Pie Chart',
                badge: 'NEW',
                badgeColor: 'bg-emerald-50 text-emerald-600',
                desc: 'Classic pie chart for market share and distribution with ≤ 4 segments.',
                usage: 'Triggered by share, distribution queries with a single measure and ≤ 4 categories.',
                preview: (
                  <svg className="w-14 h-14" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="1"/>
                    <path d="M50 50 L50 10 A40 40 0 0 1 90 50 Z" fill="#417FA2" opacity="0.8"/>
                    <path d="M50 50 L90 50 A40 40 0 0 1 30 88 Z" fill="#fe5b04" opacity="0.8"/>
                    <path d="M50 50 L30 88 A40 40 0 0 1 10 50 Z" fill="#8b5cf6" opacity="0.8"/>
                    <path d="M50 50 L10 50 A40 40 0 0 1 50 10 Z" fill="#10b981" opacity="0.8"/>
                  </svg>
                )
              },
              {
                title: 'Donut Chart',
                badge: 'NEW',
                badgeColor: 'bg-emerald-50 text-emerald-600',
                desc: 'Donut variant for distribution analysis with 5–10 categories.',
                usage: 'Triggered by share, distribution queries with a single measure and 5–10 categories.',
                preview: (
                  <svg className="w-14 h-14" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="1"/>
                    <path d="M50 50 L50 10 A40 40 0 0 1 90 50 Z" fill="#417FA2" opacity="0.8"/>
                    <path d="M50 50 L90 50 A40 40 0 0 1 50 90 Z" fill="#fe5b04" opacity="0.8"/>
                    <path d="M50 50 L50 90 A40 40 0 0 1 10 50 Z" fill="#8b5cf6" opacity="0.8"/>
                    <path d="M50 50 L10 50 A40 40 0 0 1 50 10 Z" fill="#10b981" opacity="0.8"/>
                    <circle cx="50" cy="50" r="22" fill="white"/>
                    <text x="50" y="54" textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="700">SHARE</text>
                  </svg>
                )
              },
              {
                title: 'Waterfall Chart',
                badge: 'NEW',
                badgeColor: 'bg-emerald-50 text-emerald-600',
                desc: 'Bridge analysis showing cumulative positive and negative increments between two values.',
                usage: 'Triggered by: delta, change, evolution, contribution, bridge, waterfall.',
                preview: (
                  <div className="flex items-end gap-1 h-12">
                    {[6,3,2,4,7].map((h,i) => (
                      <div key={i} className={`w-2.5 rounded-t-sm ${i===0||i===4?'bg-indigo-400':'bg-emerald-400'}`} style={{height:`${h*4}px`, marginBottom: i===1?'12px':i===2?'16px':i===3?'8px':'0px'}} />
                    ))}
                  </div>
                )
              },
              {
                title: 'Bullet Chart',
                badge: 'NEW',
                badgeColor: 'bg-emerald-50 text-emerald-600',
                desc: 'KPI vs Target visual using markers to show actual performance against a set benchmark.',
                usage: 'Selected for target, budget, plan, or objective comparisons.',
                preview: (
                  <div className="w-24 h-8 bg-slate-100 rounded-sm relative overflow-hidden flex items-center px-1">
                    <div className="h-4 bg-emerald-500/60 rounded-sm w-4/5" />
                    <div className="absolute left-[85%] top-1 bottom-1 w-0.5 bg-slate-800 rounded-full" />
                  </div>
                )
              },
              {
                title: 'Heatmap Chart',
                badge: 'NEW',
                badgeColor: 'bg-emerald-50 text-emerald-600',
                desc: '2D grid visualization showing metric density across two dimensions using color intensity.',
                usage: 'Triggered by heatmap, matrix, grid or for large multi-airline monthly comparisons.',
                preview: (
                  <div className="grid grid-cols-4 gap-0.5">
                    {[0.2, 0.4, 0.1, 0.6, 0.3, 0.8, 0.5, 0.2, 0.7, 0.4, 0.9, 0.3].map((op, i) => (
                      <div key={i} className="w-4 h-4 rounded-[2px] bg-indigo-600" style={{opacity: op}} />
                    ))}
                  </div>
                )
              },
              {
                title: 'Data Table',
                badge: 'ALWAYS ON',
                badgeColor: 'bg-genviz-accent/10 text-genviz-accent',
                desc: 'Sortable, paginated raw data table for drill-down and export verification.',
                usage: 'Always included — placed at the top in Single mode, bottom in Full Dashboard.',
                preview: (
                  <div className="w-full px-2 space-y-1.5">
                    <div className="h-1.5 bg-genviz-accent/20 rounded-full w-full" />
                    <div className="h-1.5 bg-slate-100 rounded-full w-full" />
                    <div className="h-1.5 bg-slate-100 rounded-full w-4/5" />
                    <div className="h-1.5 bg-slate-100 rounded-full w-full" />
                  </div>
                )
              },
            ].map((chart, i) => (
              <div key={i} className="group border border-slate-200 rounded-xl p-5 bg-white hover:border-genviz-accent hover:shadow-lg transition-all duration-300 flex flex-col">
                <div className="w-full aspect-video mb-4 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-genviz-accent/5 transition-colors overflow-hidden">
                  {chart.preview}
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="font-bold text-slate-800 text-sm">{chart.title}</h4>
                  <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${chart.badgeColor}`}>{chart.badge}</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed mb-3 flex-1">
                  {chart.desc}
                </p>
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">When it's selected:</p>
                  <p className="text-[10px] text-slate-600 font-medium leading-relaxed">{chart.usage}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicationFeatures;
