import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  ResponsiveContainer, PieChart, Pie, Cell,
  ScatterChart, Scatter, ComposedChart,
  RadarChart as RechartsRadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

// ─── Brand palette ────────────────────────────────────────────────────────────
const COLORS = ['#417FA2', '#fe5b04', '#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
const GRADIENTS_DEF = [
  { id: 'g0', color: '#417FA2' }, { id: 'g1', color: '#fe5b04' },
  { id: 'g2', color: '#0ea5e9' }, { id: 'g3', color: '#8b5cf6' },
  { id: 'g4', color: '#10b981' }, { id: 'g5', color: '#f59e0b' },
];

// ─── Utilities ────────────────────────────────────────────────────────────────
const parseNumeric = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  const strVal = String(val);
  const isPercent = strVal.includes('%');
  const cleaned = strVal.replace(/[,%\s]/g, '').replace(/[a-zA-Z]+$/, '').trim();
  let n = parseFloat(cleaned);
  if (isNaN(n)) return null;
  if (isPercent) n = n / 100;
  return n;
};

const normalizeDataForChart = (data, numericKeys) => {
  if (!data?.length || !numericKeys?.length) return data;
  return data.map(row => {
    const newRow = { ...row };
    numericKeys.forEach(key => {
      if (typeof newRow[key] !== 'number') {
        const parsed = parseNumeric(newRow[key]);
        if (parsed !== null) newRow[key] = parsed;
      }
    });
    return newRow;
  });
};

/** Pivot flat rows into grouped format for multi-series charts */
const pivotData = (data, xKey, groupKey, yKey) => {
  const groups = [...new Set(data.map(r => r[groupKey]).filter(Boolean))].sort();
  const xVals  = [...new Set(data.map(r => r[xKey]).filter(Boolean))];
  const displayKeyBase = yKey.replace(/_Value$/i, '_Display');

  return {
    pivoted: xVals.map(xVal => {
      const row = { [xKey]: xVal };
      groups.forEach(g => {
        const match = data.find(r => r[xKey] === xVal && r[groupKey] === g);
        const raw = match?.[yKey];
        row[g] = typeof raw === 'number' ? raw : (parseNumeric(raw) ?? 0);
        
        // Store display value for this group only if it's actually a string (not a raw number)
        if (displayKeyBase !== yKey && match?.[displayKeyBase] && typeof match[displayKeyBase] === 'string') {
          row[`${g}_Display`] = match[displayKeyBase];
        } else if (match?.[displayKeyBase] && typeof match[displayKeyBase] === 'string' && match[displayKeyBase] !== String(raw)) {
          row[`${g}_Display`] = match[displayKeyBase];
        }
      });
      return row;
    }),
    groups,
  };
};

const fmtTick = (v, formatter) => {
  if (typeof v !== 'number') return v;
  if (formatter === 'percent') {
    const scaled = (Math.abs(v) > 1.1) ? v : v * 100;
    return `${scaled.toFixed(0)}%`;
  }
  return v.toLocaleString();
};

// ─── SVG Gradient Definitions ────────────────────────────────────────────────
const GradientDefs = () => (
  <defs>
    {GRADIENTS_DEF.map(({ id, color }) => (
      <React.Fragment key={id}>
        <linearGradient id={`bar-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%"  stopColor={color} stopOpacity={0.92} />
          <stop offset="95%" stopColor={color} stopOpacity={0.55} />
        </linearGradient>
        <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%"  stopColor={color} stopOpacity={0.2} />
          <stop offset="95%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </React.Fragment>
    ))}
  </defs>
);

// ─── Shared axis / grid styles ────────────────────────────────────────────────
const TICK  = { fill: '#94a3b8', fontSize: 11, fontFamily: 'Inter, sans-serif' };
const GRID  = { strokeDasharray: '3 3', stroke: '#f1f5f9', vertical: false };
const getYAxisProps = (formatter) => ({
  axisLine: false,
  tickLine: false,
  tick: TICK,
  width: 68,
  tickFormatter: (v) => fmtTick(v, formatter)
});
const XAXIS = { axisLine: false, tickLine: false, tick: TICK };

const CustomTooltip = ({ active, payload, label, yAxisFormatter, activeMetric }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_10px_40px_-15px_rgba(0,0,0,0.15)] border border-slate-100/50 px-5 py-4 min-w-[180px] animate-in fade-in zoom-in duration-200">
      {label !== undefined && (
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-3 pb-2 border-b border-slate-50">{label}</p>
      )}
      <div className="space-y-1.5">
        {payload.map((entry, i) => {
          // Find matching display value in the raw row if available
          const rawRow = entry.payload;
          const cleanKey = String(entry.name).replace(/(_Value|_Display|Raw|Value)$/gi, '').trim();
          
          // Try to find a display version of this metric in the data row
          let displayVal = null;
          const entryKey = entry.dataKey;
          if (typeof entryKey === 'string') {
            const cleanBase = entryKey.toLowerCase().replace(/value/g, '').replace(/_/g, '').trim();
            const displayCol = Object.keys(rawRow).find(k => {
              const cleanK = k.toLowerCase().replace(/display/g, '').replace(/_/g, '').trim();
              return (cleanK === cleanBase || cleanBase.startsWith(cleanK) || cleanK.startsWith(cleanBase)) && k.toLowerCase().includes('display');
            });
            if (displayCol && typeof rawRow[displayCol] === 'string' && rawRow[displayCol] !== String(rawRow[entryKey])) {
              displayVal = rawRow[displayCol];
            } else {
              const displayKey = entryKey.replace(/_Value$/i, '_Display');
              const pivotedDisplayKey = `${entryKey}_Display`;
              const val1 = rawRow[displayKey];
              const val2 = rawRow[pivotedDisplayKey];
              if (typeof val1 === 'string' && val1 !== String(rawRow[entryKey])) {
                displayVal = val1;
              } else if (typeof val2 === 'string' && val2 !== String(rawRow[entryKey])) {
                displayVal = val2;
              }
            }
          }

          return (
            <div key={i} className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full ring-2 ring-white shadow-sm flex-shrink-0" style={{ background: entry.color ?? entry.fill }} />
                <span className="text-[11px] font-medium text-slate-500">{cleanKey}</span>
              </div>
              <span className="text-xs font-bold text-slate-900 tabular-nums">
                {displayVal || (() => {
                  let v = entry.value;
                  const isGlobalPct = yAxisFormatter === 'percent';
                  if (typeof v === 'number') {
                    const nameUpper = String(entry.name).toUpperCase();
                    const metricUpper = String(activeMetric || '').toUpperCase();
                    const isEntryPct = ['OTP', 'MARGIN', 'FACTOR', '%', 'INCREASE', 'YOY', 'GROWTH'].some(p => nameUpper.includes(p) || metricUpper.includes(p));
                    if (isGlobalPct || isEntryPct) {
                      const scaled = (Math.abs(v) > 1.1) ? v : v * 100;
                      return `${scaled.toFixed(1)}%`;
                    }
                    // Check if it's a very small decimal, might be a percentage missed by keywords
                    if (Math.abs(v) > 0 && Math.abs(v) < 1.1 && String(v).length > 4) {
                       return `${(v * 100).toFixed(1)}%`;
                    }
                    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
                  }
                  return v;
                })()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── CHART 1: Bar Chart (simple / grouped / stacked) ─────────────────────────
const BarPanel = ({ panel, data }) => {
  const { dataKeyX, dataKeyY = [], dataKeyGroup, variant = 'simple' } = panel;
  const isStacked  = variant === 'stacked';
  const isGrouped  = variant === 'grouped' || (dataKeyGroup && dataKeyY.length === 1);

  let chartData = data;
  let seriesKeys = dataKeyY;

  if (dataKeyGroup && dataKeyY.length === 1) {
    // Group by dimension → one Bar per group value
    const { pivoted, groups } = pivotData(data, dataKeyX, dataKeyGroup, dataKeyY[0]);
    chartData = pivoted;
    seriesKeys = groups;
  } else {
    chartData = normalizeDataForChart(data, dataKeyY);
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }} barCategoryGap="30%" barGap={3}>
          <GradientDefs />
          <CartesianGrid {...GRID} />
          <XAxis dataKey={dataKeyX} {...XAXIS} />
          <YAxis {...getYAxisProps(panel.yAxisFormatter)} />
          <Tooltip content={<CustomTooltip yAxisFormatter={panel.yAxisFormatter} activeMetric={panel.dataKeyY?.[0]} />} cursor={{ fill: '#f8fafc', radius: 4 }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
          {seriesKeys.map((key, i) => (
            <Bar
              key={key} dataKey={key} 
              name={String(key).replace(/(_Value|_Display|Raw|Value)$/gi, '').trim()}
              fill={`url(#bar-g${i % GRADIENTS_DEF.length})`}
              radius={isStacked && i < seriesKeys.length - 1 ? [0,0,0,0] : [6,6,0,0]}
              maxBarSize={56}
              stackId={isStacked ? 'stack' : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── CHART 2: Line / Multi-series Line ───────────────────────────────────────
const LinePanel = ({ panel, data }) => {
  const { dataKeyX, dataKeyY = [], dataKeyGroup } = panel;
  const yKey = dataKeyY[0];

  let chartData = data;
  let seriesKeys = dataKeyY;

  if (dataKeyGroup) {
    const { pivoted, groups } = pivotData(data, dataKeyX, dataKeyGroup, yKey);
    chartData = pivoted;
    seriesKeys = groups;
  } else {
    chartData = normalizeDataForChart(data, dataKeyY);
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <GradientDefs />
          <CartesianGrid {...GRID} />
          <XAxis dataKey={dataKeyX} {...XAXIS} />
          <YAxis {...getYAxisProps(panel.yAxisFormatter)} />
          <Tooltip content={<CustomTooltip yAxisFormatter={panel.yAxisFormatter} activeMetric={panel.dataKeyY?.[0] || (panel.seriesConfig && panel.seriesConfig[0]?.key)} />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
          {seriesKeys.map((key, i) => (
            <Line
              key={key} type="monotone" dataKey={key} 
              name={String(key).replace(/(_Value|_Display|Raw|Value)$/gi, '').trim()}
              stroke={COLORS[i % COLORS.length]} strokeWidth={2.5}
              dot={{ r: 3.5, fill: COLORS[i % COLORS.length], strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── CHART 3: Area Chart (simple / stacked) ───────────────────────────────────
const AreaPanel = ({ panel, data }) => {
  const { dataKeyX, dataKeyY = [], dataKeyGroup, variant = 'simple' } = panel;
  const isStacked = variant === 'stacked';
  const yKey = dataKeyY[0];

  let chartData = data;
  let seriesKeys = dataKeyY;

  if (dataKeyGroup) {
    const { pivoted, groups } = pivotData(data, dataKeyX, dataKeyGroup, yKey);
    chartData = pivoted;
    seriesKeys = groups;
  } else {
    chartData = normalizeDataForChart(data, dataKeyY);
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <GradientDefs />
          <CartesianGrid {...GRID} />
          <XAxis dataKey={dataKeyX} {...XAXIS} />
          <YAxis {...getYAxisProps(panel.yAxisFormatter)} />
          <Tooltip content={<CustomTooltip yAxisFormatter={panel.yAxisFormatter} activeMetric={panel.dataKeyY?.[0] || (panel.seriesConfig && panel.seriesConfig[0]?.key)} />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
          {seriesKeys.map((key, i) => (
            <Area
              key={key} type="monotone" dataKey={key} name={key}
              stroke={COLORS[i % COLORS.length]} strokeWidth={2.5}
              fill={`url(#area-g${i % GRADIENTS_DEF.length})`}
              stackId={isStacked ? 'stack' : undefined}
              dot={{ r: 3, fill: COLORS[i % COLORS.length], strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── CHART 4: Composed Chart (Dual Axis / Mixed) ──────────────────────────────
const ComposedPanel = ({ panel, data }) => {
  const { dataKeyX, seriesConfig = [] } = panel;
  const numericKeys = seriesConfig.map(s => s.key);
  const chartData = normalizeDataForChart(data, numericKeys);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '350px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 20, right: 10, left: 10, bottom: 20 }}>
          <GradientDefs />
          <CartesianGrid {...GRID} />
          <XAxis dataKey={dataKeyX} {...XAXIS} padding={{ left: 20, right: 20 }} />
          <YAxis yAxisId="left" {...getYAxisProps(panel.yAxisFormatter)} />
          <YAxis yAxisId="right" orientation="right" {...getYAxisProps(panel.yAxisSecondaryFormatter)} />
          <Tooltip content={<CustomTooltip yAxisFormatter={panel.yAxisFormatter} activeMetric={panel.dataKeyY?.[0] || (panel.seriesConfig && panel.seriesConfig[0]?.key)} />} />
          <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
          {seriesConfig.map((s, i) => {
            const common = {
              key: s.key,
              dataKey: s.key,
              name: (s.name || s.key).replace(/(_Value|_Display|Raw|Value)$/gi, '').trim(),
              yAxisId: s.yAxisId || 'left'
            };
            if (s.type === 'bar') {
              return (
                <Bar
                  {...common}
                  fill={`url(#bar-g${i % GRADIENTS_DEF.length})`}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              );
            }
            return (
              <Line
                {...common}
                type="monotone"
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3, fill: COLORS[i % COLORS.length], strokeWidth: 0 }}
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── CHART 5: Pie / Donut Chart ───────────────────────────────────────────────
const PiePanel = ({ panel, data, isDonut = false }) => {
  const { dataKeyX, dataKeyY = [] } = panel;
  const yKey = dataKeyY[0];

  const chartData = data.map(row => ({
    name: row[dataKeyX] ?? 'Unknown',
    value: typeof row[yKey] === 'number' ? row[yKey] : (parseNumeric(row[yKey]) ?? 0),
  })).filter(d => d.value > 0);

  const RADIAN = Math.PI / 180;
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.04) return null;
    const r  = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x  = cx + r * Math.cos(-midAngle * RADIAN);
    const y  = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: 11, fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            formatter={(value, name) => [value.toLocaleString(), name]}
            contentStyle={{ borderRadius: 12, border: '1px solid #f1f5f9', fontSize: 12 }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
          <Pie
            data={chartData} cx="50%" cy="50%"
            innerRadius={isDonut ? '52%' : 0} outerRadius="75%"
            dataKey="value" nameKey="name"
            labelLine={false} label={renderLabel}
            paddingAngle={isDonut ? 3 : 1}
          >
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── CHART 5: Scorecard ───────────────────────────────────────────────────────
const ScorecardPanel = ({ panel, data }) => {
  const yKey = panel.dataKeyY?.[0];
  // Clean key for display (strip PBI brackets)
  const cleanKey = yKey ? yKey.replace(/^\[|\]$/g, '') : '';

  // Try to find the best single display value:
  // If there are multiple rows, sum numeric values or show first formatted string
  let displayVal = '—';
  if (data?.length && yKey) {
    const cleanBase = String(yKey).toLowerCase().replace(/value/g, '').replace(/_/g, '').trim();
    const displayCol = Object.keys(data[0]).find(k => {
      const cleanK = k.toLowerCase().replace(/display/g, '').replace(/_/g, '').trim();
      return (cleanK === cleanBase || cleanBase.startsWith(cleanK) || cleanK.startsWith(cleanBase)) && k.toLowerCase().includes('display');
    });

    if (displayCol) {
      const vals = data.map(r => r[displayCol]).filter(v => v !== null && v !== undefined);
      if (vals.length) {
        displayVal = vals[0]; // formatted string — show first row
      }
    } else {
      const vals = data.map(r => r[yKey]).filter(v => v !== null && v !== undefined);
      const firstNumeric = vals.find(v => typeof v === 'number');
      if (firstNumeric !== undefined) {
        const total = vals.reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
        displayVal = total.toLocaleString();
      } else if (vals.length) {
        displayVal = vals[0]; // formatted string — show first row
      }
    }
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-white" />
      <div className="relative text-center">
        <p className="text-4xl font-black text-slate-800 tracking-tight leading-none">{displayVal}</p>
        {cleanKey && (
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-3">{cleanKey}</p>
        )}
      </div>
    </div>
  );
};

// Helper: strip PBI bracket notation, underscores, and technical suffixes
const cleanColName = col => {
  return col
    .replace(/^\[|\]$/g, '')
    .replace(/(_Value|_Display|Raw|Value)$/gi, '')
    .replace(/_/g, ' ')
    .replace(/Data/g, ' ')
    .trim();
};

// ─── CHART 6: Data Table ──────────────────────────────────────────────────────
const DataTablePanel = ({ panel, data }) => {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  if (!data?.length) return <div className="flex items-center justify-center h-full text-slate-400 text-sm">No data available</div>;

  const allCols = panel.columns ?? (data.length > 0 ? Object.keys(data[0]) : []);
  const formatMap = panel.formatMap || {};

  // Parse PBI format string → a JS formatter function
  const makeFmt = (pbiFormat) => {
    if (!pbiFormat) return null;
    // PBI uses semicolon-separated formats: positive;negative;zero
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
    
    // Find format string with a more robust lookup (try exact, try with/without underscore, case-insensitive)
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
    if (fmt && typeof val === 'number') return fmt(val);
    
    // Fallback: if it looks like a long decimal ratio (between 0 and 1), try to detect
    // or if the column name implies a percentage
    if (typeof val === 'number' && !pbiFormat) {
      const colUpper = col.toUpperCase();
      const isPctKeyword = ['OTP', 'REGULARITY', 'FACTOR', 'MARGIN', 'RATE', '%'].some(k => colUpper.includes(k));
      if (isPctKeyword || (val > 0 && val < 1 && String(val).length > 5)) {
        return (val * 100).toFixed(2) + '%';
      }
      return val.toLocaleString(undefined, { maximumFractionDigits: 4 });
    }
    return String(val);
  };

  // Smart column filtering: hide _Value if _Display counterpart exists; hide raw cols
  const displayCols = allCols.filter(col => {
    const isValue = col.toLowerCase().includes('value');
    if (isValue) {
      const cleanBase = col.toLowerCase().replace(/value/g, '').replace(/_/g, '').trim();
      const displayColExists = allCols.some(k => {
        const cleanK = k.toLowerCase().replace(/display/g, '').replace(/_/g, '').trim();
        return (cleanK === cleanBase || cleanBase.startsWith(cleanK) || cleanK.startsWith(cleanBase)) && k.toLowerCase().includes('display');
      });
      if (displayColExists) return false;
    }
    return !col.toLowerCase().includes('raw');
  });

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  const toggleSort = (col) => {
    if (sortKey === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(col); setSortDir('asc'); }
  };

  return (
    <div className="w-full h-full overflow-auto">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 bg-slate-50 z-10">
          <tr>
            {displayCols.map(col => (
              <th key={col}
                onClick={() => toggleSort(col)}
                className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-widest text-[10px] cursor-pointer hover:text-slate-700 border-b border-slate-200 whitespace-nowrap select-none">
                {cleanColName(col)}
                {sortKey === col && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, ri) => (
            <tr key={ri} className={`border-b border-slate-100 transition-colors ${ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/40`}>
              {displayCols.map(col => (
                <td key={col} className="px-4 py-2.5 text-slate-700 whitespace-nowrap font-medium">
                  {fmtCell(col, row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── CHART 7: Scatter Chart ───────────────────────────────────────────────────
const ScatterTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white rounded-xl shadow-xl border border-slate-100 px-4 py-3 min-w-[160px]">
      {d?._label && <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">{d._label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.fill || entry.color }} />
          <span className="text-xs font-bold text-slate-800">{entry.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

const ScatterPanel = ({ panel, data }) => {
  const yKey = panel.dataKeyY?.[0];
  const xKey = panel.dataKeyX;

  const chartData = (data || []).map((row, i) => {
    const rawY = row[yKey];
    const numY = typeof rawY === 'number' ? rawY : (parseNumeric(rawY) ?? 0);
    return { x: i, y: numY, _label: row[xKey] ?? `Item ${i + 1}` };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
        <GradientDefs />
        <CartesianGrid {...GRID} />
        <XAxis type="number" dataKey="x"
          domain={[-0.5, chartData.length - 0.5]}
          tickCount={chartData.length}
          tickFormatter={i => chartData[i]?._label ?? i}
          {...XAXIS} interval={0} />
        <YAxis type="number" dataKey="y" {...YAXIS} />
        <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
        <Scatter name="Data" data={chartData}>
          {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
};

// ─── CHART 8: Radar Chart ─────────────────────────────────────────────────────
const RadarPanel = ({ panel, data }) => {
  const { dataKeyX, dataKeyY = [] } = panel;

  if (!dataKeyX || dataKeyY.length < 2 || !data?.length) {
    return <div className="flex items-center justify-center h-full text-slate-400 text-sm">Need ≥ 2 metrics and a category for Radar chart</div>;
  }

  // Unique entities (e.g. airlines)
  const entities = [...new Set(data.map(d => d[dataKeyX]).filter(Boolean))];

  // Normalise each metric to 0–100 relative to the max across all entities
  const metricMaxes = {};
  dataKeyY.forEach(metric => {
    const vals = data
      .map(d => { const v = d[metric]; return typeof v === 'number' ? v : (parseNumeric(v) ?? 0); })
      .filter(v => v > 0);
    metricMaxes[metric] = vals.length ? Math.max(...vals) : 1;
  });

  // Pivot: one row per metric, one key per entity
  const radarData = dataKeyY.map(metric => {
    const row = { subject: cleanColName(metric) };
    entities.forEach(entity => {
      const entityRow = data.find(d => d[dataKeyX] === entity);
      if (entityRow) {
        const raw = entityRow[metric];
        const num = typeof raw === 'number' ? raw : (parseNumeric(raw) ?? 0);
        row[entity] = metricMaxes[metric] > 0 ? parseFloat(((num / metricMaxes[metric]) * 100).toFixed(2)) : 0;
      }
    });
    return row;
  });

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '320px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart data={radarData} margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
          <PolarGrid stroke="#f1f5f9" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 11, fontFamily: 'Inter, sans-serif', fill: '#64748b', fontWeight: 600 }}
          />
          <PolarRadiusAxis
            angle={30} domain={[0, 100]}
            tick={{ fontSize: 9, fill: '#94a3b8' }}
            tickFormatter={v => `${v}%`}
          />
          {entities.map((entity, i) => (
            <Radar
              key={entity} name={entity} dataKey={entity}
              stroke={COLORS[i % COLORS.length]}
              fill={COLORS[i % COLORS.length]}
              fillOpacity={0.15} strokeWidth={2.5}
              dot={{ r: 3.5, fill: COLORS[i % COLORS.length], strokeWidth: 0 }}
            />
          ))}
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
          <Tooltip
            formatter={(value, name) => [`${value.toFixed(1)}% (normalised)`, name]}
            contentStyle={{ borderRadius: 12, border: '1px solid #f1f5f9', fontSize: 12 }}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── CHART 9: Waterfall Chart ─────────────────────────────────────────────────
const WaterfallPanel = ({ panel, data }) => {
  const { dataKeyX, dataKeyY = [] } = panel;
  const yKey = dataKeyY[0];
  if (!yKey || !data?.length) return <div className="flex items-center justify-center h-full text-slate-400 text-sm">No data</div>;

  let running = 0;
  const waterfallData = data.map((row, i) => {
    const raw = row[yKey];
    const val = typeof raw === 'number' ? raw : (parseNumeric(raw) ?? 0);
    const base = i === 0 ? 0 : running;
    running += val;
    return {
      name: row[dataKeyX] ?? `Item ${i + 1}`,
      base: val < 0 ? base + val : base,
      value: Math.abs(val),
      rawVal: val,
      type: i === 0 ? 'total' : val >= 0 ? 'increase' : 'decrease',
    };
  });

  const FALL_COLORS = { total: '#417FA2', increase: '#10b981', decrease: '#ef4444' };

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={waterfallData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }} barCategoryGap="30%">
            <GradientDefs />
            <CartesianGrid {...GRID} />
            <XAxis dataKey="name" {...XAXIS} />
            <YAxis {...getYAxisProps(panel.yAxisFormatter)} />
            <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const entry = waterfallData.find(e => e.name === label);
                if (!entry) return null;
                return (
                  <div className="bg-white rounded-xl shadow-xl border border-slate-100 px-4 py-3 min-w-[140px]">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                    <p className={`text-sm font-bold ${entry.type === 'increase' ? 'text-emerald-600' : entry.type === 'decrease' ? 'text-red-500' : 'text-slate-800'}`}>
                      {entry.rawVal >= 0 ? '+' : ''}
                      {panel.yAxisFormatter === 'percent' 
                        ? `${(entry.rawVal * 100).toFixed(2)}%` 
                        : entry.rawVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="base" stackId="wf" fill="transparent" stroke="none" legendType="none" />
            <Bar dataKey="value" stackId="wf" maxBarSize={60} radius={[4, 4, 0, 0]}>
              {waterfallData.map((entry, i) => (
                <Cell key={i} fill={FALL_COLORS[entry.type]} fillOpacity={0.85} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-5 pb-1 shrink-0">
        {[['#10b981','Increase'],['#ef4444','Decrease'],['#417FA2','Total']].map(([c,l]) => (
          <div key={l} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{background:c,opacity:0.85}} />
            <span className="text-[10px] text-slate-500 font-medium">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── CHART 10: Bullet Chart (KPI vs Target) ───────────────────────────────────
const BulletPanel = ({ panel, data }) => {
  const { dataKeyX, dataKeyY = [], dataKeyTarget } = panel;
  const actualKey = dataKeyY[0];
  const targetKey = dataKeyTarget || dataKeyY[1];
  const isPercent = panel.yAxisFormatter === 'percent';

  if (!actualKey || !data?.length) return <div className="flex items-center justify-center h-full text-slate-400 text-sm">No data</div>;

  const toNum = v => typeof v === 'number' ? v : (parseNumeric(v) ?? 0);
  const fmt = v => isPercent
    ? `${(v * 100).toFixed(1)}%`
    : v.toLocaleString(undefined, { maximumFractionDigits: 1 });

  const allVals = data.flatMap(r => [toNum(r[actualKey]), targetKey ? toNum(r[targetKey]) : 0]);
  const maxVal = Math.max(...allVals) * 1.18;

  return (
    <div className="flex flex-col gap-3 px-6 py-4 w-full h-full overflow-y-auto">
      {data.map((row, i) => {
        const actual = toNum(row[actualKey]);
        const target = targetKey ? toNum(row[targetKey]) : null;
        const pctActual = maxVal > 0 ? (actual / maxVal) * 100 : 0;
        const pctTarget = target != null && maxVal > 0 ? (target / maxVal) * 100 : null;
        const isAbove   = target != null ? actual >= target : null;
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="w-20 text-[11px] font-semibold text-slate-600 text-right truncate shrink-0" title={row[dataKeyX]}>
              {row[dataKeyX]}
            </div>
            <div className="flex-1 relative h-7">
              <div className="absolute inset-0 rounded-lg bg-slate-100" />
              {pctTarget && <div className="absolute inset-y-0 rounded-lg bg-slate-200/70" style={{ width: `${pctTarget}%` }} />}
              <div
                className={`absolute top-1.5 bottom-1.5 rounded-md transition-all ${
                  isAbove === true ? 'bg-emerald-500' : isAbove === false ? 'bg-red-400' : 'bg-genviz-accent'
                }`}
                style={{ width: `${pctActual}%` }}
              />
              {pctTarget && (
                <div className="absolute top-0 bottom-0 w-0.5 bg-slate-700 z-10 rounded-full" style={{ left: `${pctTarget}%` }} title={`Target: ${fmt(target)}`} />
              )}
            </div>
            <div className="w-24 shrink-0">
              <span className={`text-[11px] font-bold ${isAbove === true ? 'text-emerald-600' : isAbove === false ? 'text-red-500' : 'text-slate-800'}`}>{fmt(actual)}</span>
              {target != null && <span className="text-[10px] text-slate-400 font-normal"> / {fmt(target)}</span>}
            </div>
          </div>
        );
      })}
      {targetKey && (
        <div className="flex items-center gap-4 pt-2 border-t border-slate-100 shrink-0">
          {[['bg-emerald-500','Above target'],['bg-red-400','Below target']].map(([c,l]) => (
            <div key={l} className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-sm ${c}`} /><span className="text-[9px] text-slate-400 font-medium">{l}</span></div>
          ))}
          <div className="flex items-center gap-1.5"><span className="w-0.5 h-3 bg-slate-700 rounded-full" /><span className="text-[9px] text-slate-400 font-medium">Target</span></div>
        </div>
      )}
    </div>
  );
};

// ─── CHART 11: Heatmap Chart ──────────────────────────────────────────────────
const HeatmapPanel = ({ panel, data }) => {
  const { dataKeyX, dataKeyGroup, dataKeyY = [] } = panel;
  const valueKey = dataKeyY[0];
  const isPercent = panel.yAxisFormatter === 'percent';

  if (!dataKeyX || !dataKeyGroup || !valueKey || !data?.length) {
    return <div className="flex items-center justify-center h-full text-slate-400 text-sm">Need two dimensions and one metric</div>;
  }

  const toNum = v => typeof v === 'number' ? v : (parseNumeric(v) ?? null);
  const fmt = v => v == null ? '—' : isPercent
    ? `${(v * 100).toFixed(1)}%`
    : v.toLocaleString(undefined, { maximumFractionDigits: 1 });

  // Month-aware sorting (Jan, Feb, Mar...)
  const monthOrder = { 'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6, 'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12 };
  const getSortScore = (val) => {
    const s = String(val).toLowerCase();
    for (const [m, score] of Object.entries(monthOrder)) {
      if (s.includes(m)) return score + (s.includes('25') ? 100 : s.includes('24') ? 50 : 0);
    }
    return val;
  };

  const xVals = [...new Set(data.map(d => d[dataKeyX]))].sort((a, b) => {
    const sa = getSortScore(a), sb = getSortScore(b);
    return sa > sb ? 1 : -1;
  });
  const yVals = [...new Set(data.map(d => d[dataKeyGroup]))].sort();

  const lookup = {};
  data.forEach(row => {
    const x = row[dataKeyX], y = row[dataKeyGroup];
    if (!lookup[y]) lookup[y] = {};
    lookup[y][x] = toNum(row[valueKey]);
  });

  const nums = data.map(d => toNum(d[valueKey])).filter(v => v != null);
  const minVal = Math.min(...nums);
  const maxVal = Math.max(...nums);

  const getColor = (val) => {
    if (val == null) return '#f8fafc';
    const t = maxVal > minVal ? (val - minVal) / (maxVal - minVal) : 0.5;
    // Premium Indigo scale
    return `rgba(79, 70, 229, ${0.1 + t * 0.9})`;
  };

  return (
    <div className="w-full h-full overflow-auto p-4 bg-white rounded-xl">
      <div className="min-w-max">
        {/* Header Row */}
        <div className="flex items-center gap-1 mb-1 ml-28">
          {xVals.map(x => (
            <div key={x} className="w-14 text-center text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate px-0.5">
              {String(x)}
            </div>
          ))}
        </div>
        
        {/* Data Rows */}
        {yVals.map(y => (
          <div key={y} className="flex items-center gap-1 mb-1">
            <div className="w-28 text-right pr-3 text-[10px] font-bold text-slate-600 truncate uppercase tracking-wider">{String(y)}</div>
            {xVals.map(x => {
              const val = lookup[y]?.[x];
              const t = maxVal > minVal && val != null ? (val - minVal) / (maxVal - minVal) : 0.5;
              return (
                <div 
                  key={`${y}-${x}`}
                  className="w-14 h-10 rounded-[4px] flex items-center justify-center text-[9px] font-bold transition-all hover:scale-105 hover:shadow-md cursor-default group relative"
                  style={{ backgroundColor: getColor(val), color: t > 0.5 ? 'white' : '#1e293b' }}
                >
                  {fmt(val)}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[9px] rounded opacity-0 group-hover:opacity-100 pointer-events-none z-50 whitespace-nowrap shadow-xl">
                    {String(y)} | {String(x)}: <span className="text-indigo-300">{fmt(val)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="mt-6 flex items-center gap-3 ml-28">
          <span className="text-[9px] font-bold text-slate-400 uppercase">Low</span>
          <div className="h-2 w-32 rounded-full bg-gradient-to-r from-indigo-50 to-indigo-600" />
          <span className="text-[9px] font-bold text-slate-400 uppercase">High</span>
        </div>
      </div>
    </div>
  );
};


// ─── Panel size map ───────────────────────────────────────────────────────────
// col-span in a 6-column grid
const chartColSpan = {
  BarChart:        'col-span-6 lg:col-span-3',
  GroupedBar:      'col-span-6',
  StackedBar:      'col-span-6',
  LineChart:       'col-span-6 lg:col-span-3',
  AreaChart:       'col-span-6 lg:col-span-3',
  PieChart:        'col-span-6 lg:col-span-3',
  DonutChart:      'col-span-6 lg:col-span-3',
  ScatterChart:    'col-span-6 lg:col-span-3',
  RadarChart:      'col-span-6 lg:col-span-3',
  WaterfallChart:  'col-span-6',
  BulletChart:     'col-span-6',
  HeatmapChart:    'col-span-6',
  DataTable:       'col-span-6',
};

const CHART_HEIGHT = 'h-[360px]';

const chartTypeBadge = {
  Scorecard: 'SCORECARD', BarChart: 'BAR', GroupedBar: 'GROUPED BAR',
  StackedBar: 'STACKED BAR', LineChart: 'LINE', AreaChart: 'AREA',
  PieChart: 'PIE', DonutChart: 'DONUT', ScatterChart: 'SCATTER',
  RadarChart: 'RADAR', WaterfallChart: 'WATERFALL', BulletChart: 'BULLET', HeatmapChart: 'HEATMAP',
  DataTable: 'TABLE',
};

// Panel ordering priority
const panelOrder = { Scorecard: 0, DonutChart: 1, PieChart: 1, RadarChart: 2, BulletChart: 2, BarChart: 2, GroupedBar: 2, StackedBar: 2, LineChart: 2, AreaChart: 2, WaterfallChart: 2, HeatmapChart: 3, ScatterChart: 3, DataTable: 4 };

// ─── KPI Scorecard strip (compact top row) ─────────────────────────────────────
const KpiStrip = ({ panels, data }) => (
  <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(panels.length, 4)}, 1fr)` }}>
    {panels.map(panel => {
      const yKey = panel.dataKeyY?.[0];
      const cleanKey = yKey ? yKey.replace(/^\[|\]$/g, '') : '';
      let displayVal = '—';
      if (data?.length && yKey) {
        const vals = data.map(r => r[yKey]).filter(v => v != null);
        const isNumeric = vals.some(v => typeof v === 'number');
        if (isNumeric) {
          displayVal = vals.reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0).toLocaleString();
        } else if (vals.length) {
          displayVal = vals[0];
        }
      }
      return (
        <div key={panel.id}
          className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex flex-col justify-between shadow-sm"
          style={{ borderTop: '3px solid #417FA2' }}>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            {cleanKey || panel.title}
          </p>
          <p className="text-2xl font-black text-slate-800 tracking-tight">{displayVal}</p>
        </div>
      );
    })}
  </div>
);

// ─── Metric Selector ─────────────────────────────────────────────────────────
const MetricSelector = ({ metrics, activeMetric, onChange }) => {
  if (!metrics || metrics.length <= 1) return null;
  
  return (
    <div className="relative flex items-center">
      <select
        value={activeMetric}
        onChange={(e) => onChange(e.target.value)}
        className="text-[10px] text-blue-600 font-bold uppercase tracking-wider bg-blue-50 border border-blue-100 rounded-md px-2 py-0.5 outline-none cursor-pointer hover:bg-blue-100 transition-colors appearance-none pr-5"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%232563eb'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7' /%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center', backgroundSize: '8px' }}
      >
        {metrics.map(m => (
          <option key={m} value={m}>
            {m.replace(/(_Value|_Display|Raw|Value)$/gi, '').trim()}
          </option>
        ))}
      </select>
    </div>
  );
};

// ─── Chart Panel card ──────────────────────────────────────────────────────────
const ChartPanel = ({ panel, data, isFullWidth }) => {
  const initialMetric = (panel.availableMetrics && panel.availableMetrics.length > 0) 
    ? panel.availableMetrics[0] 
    : (panel.dataKeyY?.[0] || panel.seriesConfig?.[0]?.key || null);

  const [activeMetric, setActiveMetric] = useState(initialMetric);
  const [overrideType, setOverrideType] = useState(null);

  useEffect(() => {
    const newMetric = (panel.availableMetrics && panel.availableMetrics.length > 0) 
      ? panel.availableMetrics[0] 
      : (panel.dataKeyY?.[0] || panel.seriesConfig?.[0]?.key || null);
    if (newMetric) setActiveMetric(newMetric);
  }, [panel.dataKeyY, panel.availableMetrics, panel.seriesConfig]);

  const currentType = overrideType || panel.type;

  const badge = chartTypeBadge[currentType] ?? currentType;
  const colClass = isFullWidth ? 'col-span-6' : (chartColSpan[currentType] ?? 'col-span-6 lg:col-span-3');
  const isTable = currentType === 'DataTable';
  
  // Construct actual panel for rendering
  const activePanel = {
    ...panel,
    dataKeyY: panel.availableMetrics ? [activeMetric].filter(Boolean) : panel.dataKeyY,
    title: panel.availableMetrics && activeMetric ? `${cleanColName(activeMetric)} Analysis` : panel.title
  };

  const renderChart = () => {
    // Check if we have any valid visualization keys (either in dataKeyY or seriesConfig)
    const hasDataKeys = activePanel.dataKeyY && activePanel.dataKeyY.length > 0 && activePanel.dataKeyY[0] !== undefined;
    const hasSeriesConfig = activePanel.seriesConfig && activePanel.seriesConfig.length > 0;
    
    if (!hasDataKeys && !hasSeriesConfig && !isTable) {
       return (
         <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
           <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-300 animate-spin" />
           <p className="text-sm font-medium text-slate-500 italic">Initializing visualization context...</p>
         </div>
       );
    }
    
    switch (currentType) {
      case 'BarChart':     return <BarPanel panel={{...activePanel, type: 'BarChart'}} data={data} />;
      case 'GroupedBar':   return <BarPanel panel={{ ...activePanel, type: 'GroupedBar', variant: 'grouped' }} data={data} />;
      case 'StackedBar':   return <BarPanel panel={{ ...activePanel, type: 'StackedBar', variant: 'stacked' }} data={data} />;
      case 'LineChart':    return <LinePanel panel={{...activePanel, type: 'LineChart'}} data={data} />;
      case 'AreaChart':    return <AreaPanel panel={{...activePanel, type: 'AreaChart'}} data={data} />;
      case 'PieChart':     return <PiePanel panel={{...activePanel, type: 'PieChart'}} data={data} isDonut={false} />;
      case 'DonutChart':   return <PiePanel panel={{...activePanel, type: 'DonutChart'}} data={data} isDonut={true} />;
      case 'ComposedChart': return <ComposedPanel panel={{...activePanel, type: 'ComposedChart'}} data={data} />;
      case 'ScatterChart':   return <ScatterPanel panel={{...activePanel, type: 'ScatterChart'}} data={data} />;
      case 'RadarChart':     return <RadarPanel panel={{...activePanel, type: 'RadarChart'}} data={data} />;
      case 'WaterfallChart': return <WaterfallPanel panel={{...activePanel, type: 'WaterfallChart'}} data={data} />;
      case 'BulletChart':    return <BulletPanel panel={{...activePanel, type: 'BulletChart'}} data={data} />;
      case 'HeatmapChart':   return <HeatmapPanel panel={{...activePanel, type: 'HeatmapChart'}} data={data} />;
      case 'DataTable':      return <DataTablePanel panel={activePanel} data={data} />;
      default:               return <BarPanel panel={{...activePanel, type: 'BarChart'}} data={data} />;
    }
  };

  const isSwitchable = ['BarChart', 'GroupedBar', 'StackedBar', 'LineChart', 'AreaChart', 'RadarChart', 'WaterfallChart', 'BulletChart', 'HeatmapChart'].includes(panel.type);

  return (
    <div className={`${colClass} bg-white rounded-2xl border border-slate-200/60 shadow-sm flex flex-col overflow-hidden transition-all duration-300 hover:shadow-md hover:border-slate-300/50 group`}>
      <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-50 flex-shrink-0 bg-white/50 backdrop-blur-sm">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-slate-800 text-sm tracking-tight truncate group-hover:text-genviz-accent transition-colors">
            {activePanel.title}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
             <MetricSelector 
                metrics={panel.availableMetrics} 
                activeMetric={activeMetric} 
                onChange={setActiveMetric} 
             />
             {panel.description && !panel.availableMetrics && (
               <p className="text-[10px] text-slate-400 font-medium line-clamp-1">{panel.description}</p>
             )}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
          {isSwitchable && (
            <select
              value={currentType}
              onChange={(e) => setOverrideType(e.target.value)}
              className="text-[10px] text-slate-500 font-medium bg-transparent border border-transparent hover:border-slate-200 rounded px-1.5 py-0.5 outline-none cursor-pointer transition-colors appearance-none text-center"
              title="Change chart type"
            >
              <option value="BarChart">Bar</option>
              <option value="GroupedBar">Grouped</option>
              <option value="StackedBar">Stacked</option>
              <option value="LineChart">Line</option>
              <option value="AreaChart">Area</option>
              <option value="RadarChart">Radar</option>
            </select>
          )}
          <span className="px-2 py-0.5 rounded-full bg-slate-50 text-[8px] font-black tracking-widest text-slate-400 uppercase border border-slate-100 group-hover:bg-white group-hover:border-slate-200 transition-all">{badge}</span>
        </div>
      </div>
      <div className={isTable ? 'overflow-auto max-h-[420px] w-full' : `${CHART_HEIGHT} px-4 py-4 w-full relative`}>
        {renderChart()}
      </div>
    </div>
  );
};

// ─── Main DashboardRenderer ────────────────────────────────────────────────────
const DashboardRenderer = ({ layoutConfig, rawData }) => {
  if (!layoutConfig || !rawData) return null;

  let config;
  try {
    config = typeof layoutConfig === 'string' ? JSON.parse(layoutConfig) : layoutConfig;
  } catch {
    return <div className="text-red-500 text-sm p-4">Invalid dashboard configuration.</div>;
  }

  const allPanels = [...(config?.panels ?? [])].sort(
    (a, b) => (panelOrder[a.type] ?? 3) - (panelOrder[b.type] ?? 3)
  );

  const scorecards = allPanels.filter(p => p.type === 'Scorecard');
  const charts     = allPanels.filter(p => p.type !== 'Scorecard');

  return (
    <div className="space-y-4">
      {/* KPI strip — compact metric row at top */}
      {scorecards.length > 0 && <KpiStrip panels={scorecards} data={rawData} />}

      {/* Charts grid — 6-column system for flexible layouts */}
      {charts.length > 0 && (
        <div className="grid grid-cols-6 gap-4">
          {charts.map(panel => (
            <ChartPanel 
              key={panel.id} 
              panel={panel} 
              data={rawData} 
              isFullWidth={charts.length <= 2} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardRenderer;


