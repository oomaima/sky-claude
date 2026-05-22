import json
import os
from typing import Dict, Any, List
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_anthropic import ChatAnthropic
from langgraph.graph import StateGraph, START, END
from typing_extensions import TypedDict

from app.core.config import settings
from app.services.pbi_client import pbi_client
from app.db.database import SessionLocal
from app.db.models import Prompt, SemanticModelEnum, PromptTypeEnum, Setting

class AgentState(TypedDict):
    user_query: str
    semantic_model: str
    dax_query: str
    raw_data: List[Dict[str, Any]]
    layout_config: str
    chat_history: List[Dict[str, str]]
    error: str

# Initialize LLM
llm = ChatAnthropic(model="claude-sonnet-4-6", api_key=settings.ANTHROPIC_API_KEY, temperature=0)

def get_prompts_from_db(semantic_model: str) -> str:
    db = SessionLocal()
    try:
        model_enum = SemanticModelEnum(semantic_model)
        base = db.query(Prompt).filter(Prompt.semantic_model == model_enum, Prompt.prompt_type == PromptTypeEnum.BASE).first()
        rules = db.query(Prompt).filter(Prompt.semantic_model == model_enum, Prompt.prompt_type == PromptTypeEnum.RULES).first()
        examples = db.query(Prompt).filter(Prompt.semantic_model == model_enum, Prompt.prompt_type == PromptTypeEnum.EXAMPLES).first()
        
        base_content = base.content if base else ""
        rules_content = rules.content if rules else ""
        examples_content = examples.content if examples else ""
        return f"{base_content}\n\nCRITICAL RULES:\n{rules_content}\n\nEXAMPLES:\n{examples_content}"
    finally:
        db.close()

def get_dashboard_prompt_from_db() -> str:
    """Fetch the editable dashboard generation instructions stored in the DB."""
    db = SessionLocal()
    try:
        row = db.query(Prompt).filter(
            Prompt.semantic_model == SemanticModelEnum.DASHBOARD,
            Prompt.prompt_type == PromptTypeEnum.RULES
        ).first()
        return row.content if row else ""
    finally:
        db.close()
def get_generation_mode() -> str:
    db = SessionLocal()
    try:
        mode = db.query(Setting).filter(Setting.key == "GENERATION_MODE").first()
        return mode.value if mode else "FULL"
    finally:
        db.close()


def get_schema_metadata(semantic_model: str) -> str:
    mapping = {
        "COMPETITORS": "sm-competitors-metadata.json",
    }
    filename = mapping.get(semantic_model, "sm-competitors-metadata.json")
    filepath = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "metadata", filename)
    try:
        with open(filepath, "r") as f:
            return f.read()
    except Exception:
        return "{}"


def get_format_map(semantic_model: str) -> dict:
    """Extract measure name → PBI format string from the semantic model metadata.
    Returns e.g. {"_OTP15D": "0.00 %;-0.00 %;0.00 %", "_Flights": "#,0"}
    
    Handles three metadata structures:
    - Financial:   {tables:[...], measures:[...]}           → top-level measures array
    - Operations:  {tables:[{..., measures:[...]}]}         → measures inside each table
    - Competitors: {model:{tables:[{..., measures:[...]}]}} → measures inside model.tables
    """
    format_map = {}
    try:
        raw = get_schema_metadata(semantic_model)
        metadata = json.loads(raw)
        
        # Collect all measures from every possible location
        all_measures = []
        
        # 1) Top-level "measures" array (Financial model)
        if "measures" in metadata and isinstance(metadata["measures"], list):
            all_measures.extend(metadata["measures"])
        
        # 2) Measures inside tables (Operations/Commercial) or model.tables (Competitors)
        # Only use the "model" node as root when it actually contains "tables" (Competitors).
        # For Commercial the "model" key holds only connection metadata, not tables.
        model_node = metadata.get("model")
        root = model_node if (isinstance(model_node, dict) and "tables" in model_node) else metadata
        tables = root.get("tables", [])
        for table in tables:
            for measure in table.get("measures", []):
                all_measures.append(measure)
        
        # Extract format strings from collected measures
        for measure in all_measures:
            name = measure.get("name", "").replace("[", "").replace("]", "").strip()
            
            # Try both keys: formatString (Financial/Competitors) and format (Operations)
            fmt = measure.get("formatString") or measure.get("format") or ""
            # Skip null / empty / "null" string
            if not fmt or fmt == "null":
                continue
                    
            if name and fmt:
                format_map[name] = fmt
    except Exception:
        pass
    return format_map


def _is_percent_format(fmt: str) -> bool:
    """Return True when the PBI format string implies a percentage (stored as 0-1)."""
    return "%" in fmt


def _is_integer_format(fmt: str) -> bool:
    """Return True when the PBI format string implies a plain integer count."""
    return "#,0" in fmt and "%" not in fmt

def generate_dax_node(state: AgentState) -> AgentState:
    try:
        system_instructions = get_prompts_from_db(state["semantic_model"])
        schema_metadata = get_schema_metadata(state["semantic_model"])
        
        system_prompt = f"{system_instructions}\n\nSCHEMA:\n{schema_metadata}\n\nReturn ONLY the DAX query, no markdown."
        
        messages = [
            SystemMessage(content=system_prompt)
        ]
        
        # Add chat history
        for msg in state.get("chat_history", []):
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                # Include the DAX query in the context if available to help with follow-up iterations
                content = msg["content"]
                if "dax" in msg:
                    content += f"\nGenerated DAX: {msg['dax']}"
                messages.append(AIMessage(content=content))
                
        messages.append(HumanMessage(content=f"User Query: {state['user_query']}"))
        
        response = llm.invoke(messages)
        dax = response.content.strip()
        # Clean up any potential markdown
        if dax.startswith("```dax"):
            dax = dax.replace("```dax", "").replace("```", "").strip()
            
        return {"dax_query": dax, "error": ""}
    except Exception as e:
        return {"error": f"DAX Generation Error: {str(e)}"}

async def execute_dax_node(state: AgentState) -> AgentState:
    if state.get("error"):
        return state
        
    try:
        mapping = {
            "COMPETITORS": settings.POWERBI_COMPETITORS_DATASET_ID,
        }
        dataset_id = mapping.get(state["semantic_model"])
        
        raw_data = await pbi_client.execute_dax_query(dataset_id, state["dax_query"])
        
        # Sanitize keys: remove brackets to prevent Recharts rendering issues
        sanitized_data = []
        for row in raw_data:
            sanitized_row = {k.replace('[', '').replace(']', ''): v for k, v in row.items()}
            sanitized_data.append(sanitized_row)
            
        return {"raw_data": sanitized_data}
    except Exception as e:
        return {"error": f"PBI Execution Error: {str(e)}"}

def generate_dashboard_node(state: AgentState) -> AgentState:
    if state.get("error"):
        return state
        
    try:
        data_sample = state["raw_data"][:10] if state.get("raw_data") else []
        # Union keys across all rows — PBI omits null-valued columns in sparse rows,
        # so data_sample[0] alone may miss columns that appear only in other rows.
        keys = list(dict.fromkeys(k for row in state["raw_data"] for k in row.keys()))

        # ── Load PBI format map for this semantic model ──
        format_map = get_format_map(state["semantic_model"])

        def is_pct_col(col_name: str) -> bool:
            """Prefer metadata format; fall back to keyword heuristic."""
            clean = col_name.replace('Raw', '').strip().replace('[', '').replace(']', '')
            # Try direct match, then try with underscore, then case-insensitive scan
            fmt = format_map.get(col_name) or format_map.get(clean) or format_map.get(f"_{clean}")
            if not fmt:
                search_lower = clean.lower().replace('_', '')
                for k, v in format_map.items():
                    if k.lower().replace('_', '') == search_lower:
                        fmt = v
                        break
            
            if fmt:
                return _is_percent_format(fmt)
            PCT_KEYS = ['OTP', 'REGULARITY', 'FACTOR', 'MARGIN', 'RATE', 'GROWTH', 'INCREASE', 'YOY', '%']
            return any(p in col_name.upper() for p in PCT_KEYS)

        # ── Column classification ───────────────────────────────────────────
        TIME_DIM_KEYS = {'year', 'month', 'monthnumber', 'quarter', 'week', 'day', 'date', 'period'}
        IDENTITY_KEYS = {'opco', 'name', 'airline', 'region', 'country', 'route', 'departure', 'arrival', 'scenario'}

        dimension_cols = []   # categorical or time — suitable for X axis
        measure_cols = []     # real KPI measures — suitable for Y axis (BarChart/LineChart)
        display_cols = []     # pre-formatted strings (e.g. "1,904 M") — for Scorecard only

        if data_sample:
            for key in keys:
                key_lower = key.lower().replace(' ', '').replace('_', '')
                sample_vals = [row.get(key) for row in data_sample if row.get(key) is not None]
                if not sample_vals:
                    continue
                
                # Check if it's actually numeric
                is_numeric = isinstance(sample_vals[0], (int, float))
                
                # Classification logic
                if any(t in key_lower for t in TIME_DIM_KEYS) or any(i in key_lower for i in IDENTITY_KEYS):
                    dimension_cols.append(key)
                elif 'raw' in key_lower and is_numeric:
                    measure_cols.append(key)
                elif is_numeric:
                    # Likely a year or a plain measure
                    vals_as_num = [v for v in sample_vals if isinstance(v, (int, float))]
                    if vals_as_num and all(1990 <= v <= 2100 for v in vals_as_num):
                        dimension_cols.append(key)
                    else:
                        measure_cols.append(key)
                else:
                    display_cols.append(key)

        # Infer best dimensions
        time_dims = [c for c in dimension_cols if any(t in c.lower().replace(' ','') for t in TIME_DIM_KEYS)]
        
        # Smart time dimension selection
        if len(time_dims) > 1:
            # Rank time dims: prefer human readable month/year strings over raw numbers
            # Priority: 'monthyear' > 'date' > 'period' > 'month' (string) > 'monthnumber' > 'year'
            def rank_time_dim(name):
                n = name.lower().replace(' ','').replace('_','')
                if 'monthyear' in n: return 1
                if 'date' in n: return 2
                if 'period' in n: return 3
                if 'month' in n and 'number' not in n: return 4
                if 'monthnumber' in n: return 5
                if 'year' in n: return 6
                return 10

            time_dims.sort(key=rank_time_dim)
            
            # If the first choice is constant (e.g. Year), move to the next varying one
            if data_sample:
                for i in range(len(time_dims)):
                    vals = {row.get(time_dims[i]) for row in data_sample}
                    if len(vals) > 1:
                        # Found the best varying dim! Move it to front.
                        best = time_dims.pop(i)
                        time_dims.insert(0, best)
                        break

        cat_dims  = [c for c in dimension_cols if c not in time_dims]

        # Fallback numeric parsing
        if not measure_cols and display_cols and data_sample:
            for key in display_cols[:]:
                sample_vals = [row.get(key) for row in data_sample if row.get(key) is not None]
                parseable = sum(1 for v in sample_vals if str(v).replace(',','').replace('%','').replace(' ','').replace('M','').strip().replace('.','',1).isdigit())
                if parseable > len(sample_vals) * 0.5:
                    measure_cols.append(key)
            measure_cols = [c for c in measure_cols if c in display_cols]

        panels = []
        panel_id = 1

        # ── Generation Mode Check ───────────────────────────────────────────
        generation_mode = get_generation_mode()
        
        # 1. KPI Scorecards (only in FULL mode)
        if generation_mode == "FULL":
            scorecard_metrics = display_cols[:4] if display_cols else measure_cols[:4]
            for metric in scorecard_metrics:
                panels.append({
                    "id": f"p{panel_id}",
                    "type": "Scorecard",
                    "title": metric.replace("Raw", "").replace("[", "").replace("]", "").strip(),
                    "dataKeyY": [metric],
                    "description": f"Total {metric}"
                })
                panel_id += 1

        # 2. Charts (if we have measures)
        if measure_cols:
            # Smart measure selection: prioritize measures mentioned in the user query
            query_clean = state["user_query"].lower().replace(" ", "").replace("!", "1") # Handle user typos like OTP!%
            matching_measures = [
                m for m in measure_cols 
                if m.lower().replace(" ", "").replace("raw", "") in query_clean
            ]
            
            if matching_measures:
                main_measure = matching_measures[0]
            else:
                # Fallback: Sort measures to put 'raw' ones first if they exist
                sorted_measures = sorted(measure_cols, key=lambda x: 'raw' in x.lower(), reverse=True)
                main_measure = sorted_measures[0]
            
            # Time Trend or Comparison Chart
            if time_dims:
                x_col = time_dims[0]
                unique_times = set()
                if data_sample:
                    unique_times = {str(row.get(x_col)) for row in state["raw_data"]}
                
                # If we have multiple time points, it's a trend or comparison
                if len(unique_times) > 1:
                    # ── Combined Time Dimension for Clarity ──
                    year_col = next((c for c in time_dims if 'year' in c.lower() and 'month' not in c.lower()), None)
                    qtr_col = next((c for c in time_dims if 'quarter' in c.lower()), None)
                    
                    if year_col and qtr_col and year_col != qtr_col:
                        unique_years = list(set(d.get(year_col) for d in data_sample if d.get(year_col)))
                        if len(unique_years) > 1:
                            combined_x_col = "Period"
                            for row in state["raw_data"]:
                                row[combined_x_col] = f"{row.get(year_col)} {row.get(qtr_col)}"
                            x_col = combined_x_col # Update primary X column for charts

                    # ── High-Intent Chart Detection (Heatmap, Radar) ──
                    HEATMAP_KEYWORDS = ['heatmap', 'matrix', 'grid', 'by month', 'by quarter', 'by week']
                    is_heatmap_query = any(kw in query_clean for kw in HEATMAP_KEYWORDS)
                    unique_cats_hm = list(set(d.get(cat_dims[0]) for d in data_sample if d.get(cat_dims[0]))) if cat_dims else []
                    
                    if (is_heatmap_query or (cat_dims and len(unique_times) >= 6 and len(unique_cats_hm) >= 4)):
                        if cat_dims and len(unique_times) >= 2 and measure_cols:
                            primary_m = next((m for m in measure_cols if is_pct_col(m)), measure_cols[0])
                            metric_clean_hm = primary_m.replace('Raw', '').strip()
                            panels.append({
                                "id": f"p{panel_id}_hm",
                                "type": "HeatmapChart",
                                "title": f"{metric_clean_hm} Heatmap",
                                "dataKeyX": x_col,
                                "dataKeyGroup": cat_dims[0],
                                "dataKeyY": [primary_m],
                                "yAxisFormatter": "percent" if is_pct_col(primary_m) else "number"
                            })
                            panel_id += 1
                            # Immediate return if heatmap is prioritized
                            config = {"panels": panels + [{
                                "id": f"p{panel_id}", "type": "DataTable", "title": "Detailed Data View", 
                                "columns": keys, "formatMap": format_map
                            }]}
                            return {"layout_config": json.dumps(config)}

                    # ── Dual Axis / Multi-Measure Detection ──
                    dual_axis_created = False
                    if len(measure_cols) > 1:
                        base_ms = []
                        for m in measure_cols:
                            clean_m = m.replace('Raw', '').strip()
                            if clean_m not in base_ms:
                                base_ms.append(clean_m)
                        
                        raw_metrics = []
                        for bm in base_ms:
                            if f"{bm} Raw" in measure_cols:
                                raw_metrics.append(f"{bm} Raw")
                            else:
                                raw_metrics.append(bm)
                        
                        metric_maxes = {}
                        for m in raw_metrics:
                            vals = [d.get(m) for d in data_sample if isinstance(d.get(m), (int, float))]
                            if vals: metric_maxes[m] = max(vals)
                        
                        if len(metric_maxes) >= 2:
                            sorted_metrics = sorted(metric_maxes.keys(), key=lambda k: metric_maxes[k], reverse=True)
                            highest = sorted_metrics[0]
                            lowest = sorted_metrics[-1]
                            
                            is_dual_axis = metric_maxes[highest] > metric_maxes[lowest] * 100
                            unique_cats = list(set(d.get(cat_dims[0]) for d in data_sample if d.get(cat_dims[0]))) if cat_dims else []
                            
                            if is_dual_axis or len(unique_cats) <= 1:
                                series_config = []
                                y_fmt_left = "number"
                                y_fmt_right = "number"
                                
                                for m in sorted_metrics:
                                    m_clean = m.replace('Raw', '').strip()
                                    is_low = is_dual_axis and (metric_maxes[m] < metric_maxes[highest] / 50)
                                    axis = "right" if is_low else "left"
                                    
                                    series_config.append({
                                        "key": m,
                                        "name": m_clean,
                                        "type": "line" if is_low else "bar",
                                        "yAxisId": axis
                                    })
                                    
                                    PCT_KEYWORDS = ['OTP', 'MARGIN', 'FACTOR', '%', 'INCREASE', 'YOY', 'GROWTH', 'RATE', 'REGULARITY']
                                    if any(p in m_clean.upper() for p in PCT_KEYWORDS):
                                        if axis == "left": y_fmt_left = "percent"
                                        else: y_fmt_right = "percent"

                                metric_titles = [m.replace('Raw', '').strip() for m in sorted_metrics]
                                if len(metric_titles) > 2:
                                    title_metrics = f"{', '.join(metric_titles[:-1])} and {metric_titles[-1]}"
                                else:
                                    title_metrics = " vs ".join(metric_titles)
                                
                                title_suffix = ""
                                if unique_cats and len(unique_cats) == 1:
                                    title_suffix = f" for {unique_cats[0]}"

                                panels.append({
                                    "id": f"p{panel_id}",
                                    "type": "ComposedChart",
                                    "title": f"{title_metrics} Comparison{title_suffix}",
                                    "dataKeyX": x_col,
                                    "seriesConfig": series_config,
                                    "yAxisFormatter": y_fmt_left,
                                    "yAxisSecondaryFormatter": y_fmt_right
                                })
                                dual_axis_created = True
                                panel_id += 1

                    if not dual_axis_created:
                        # ── Standard Chart Detection ──
                        base_ms_std = []
                        for m in measure_cols:
                            clean_m = m.replace('Raw', '').strip()
                            if clean_m not in base_ms_std:
                                base_ms_std.append(clean_m)
                        
                        metrics_to_plot = []
                        for bm in base_ms_std:
                            if f"{bm} Raw" in measure_cols:
                                metrics_to_plot.append(f"{bm} Raw")
                            else:
                                metrics_to_plot.append(bm)
                        
                        year_col = next((c for c in time_dims if 'year' in c.lower() and 'month' not in c.lower()), None)
                        qtr_col = next((c for c in time_dims if 'quarter' in c.lower()), None)

                        # (Radar/Heatmap logic was moved up)
                        radar_created = False
                        heatmap_created = False

                        # ── Waterfall: delta/bridge keywords + single measure time series ──
                        WATERFALL_KEYWORDS = ['delta', 'change', 'evolution', 'contribution', 'bridge', 'waterfall', 'yoychange', 'yoyevolution', 'vsly', 'vsly']
                        is_waterfall_query = any(kw in query_clean for kw in WATERFALL_KEYWORDS)
                        if (is_waterfall_query and len(metrics_to_plot) == 1 and not cat_dims):
                            metric_clean_wf = metrics_to_plot[0].replace('Raw', '').strip()
                            is_pct_wf = any(p in metric_clean_wf.upper() for p in ['OTP', 'MARGIN', 'FACTOR', 'RATE', '%', 'GROWTH', 'INCREASE'])
                            panels.append({
                                "id": f"p{panel_id}_wf",
                                "type": "WaterfallChart",
                                "title": f"{metric_clean_wf} Evolution",
                                "dataKeyX": x_col,
                                "dataKeyY": [metrics_to_plot[0]],
                                "yAxisFormatter": "percent" if is_pct_wf else "number"
                            })
                            panel_id += 1
                        
                        for idx, metric in enumerate(metrics_to_plot):
                            if generation_mode == "SINGLE" and panels:
                                break
                            metric_clean = metric.replace('Raw', '').strip()
                            is_pct = any(p in metric_clean.upper() for p in ['OTP', 'REGULARITY', 'FACTOR', 'MARGIN', 'RATE', '%', 'INCREASE', 'YOY', 'GROWTH'])

                            # ── StackedBar: composition keywords in query ──
                            STACK_KEYWORDS = ['breakdown', 'split', 'composition', 'proportion', 'structure', 'share', 'distribution']
                            is_stacked_query = any(kw in query_clean for kw in STACK_KEYWORDS)
                            
                            if cat_dims and (1 < len(unique_times) <= 12):
                                unique_years = list(set(d.get(year_col) for d in data_sample if d.get(year_col))) if year_col else []
                                unique_quarters = list(set(d.get(qtr_col) for d in data_sample if d.get(qtr_col))) if qtr_col else []
                                unique_cats = list(set(d.get(cat_dims[0]) for d in data_sample if d.get(cat_dims[0])))
                                
                                if len(unique_cats) == 1 and len(unique_years) > 1 and len(unique_quarters) > 1:
                                    x_key = qtr_col
                                    group_key = year_col
                                    title_suffix = f"for {unique_cats[0]}"
                                elif len(unique_cats) > 1 and qtr_col:
                                    # Comparison between airlines: Quarters on X, Airlines as groups
                                    x_key = qtr_col
                                    group_key = cat_dims[0]
                                    title_suffix = "Comparison"
                                elif len(unique_years) == 1 and qtr_col:
                                    group_key = qtr_col
                                    x_key = cat_dims[0]
                                    title_suffix = f"by {x_key.replace('Name', 'Airline')}"
                                else:
                                    group_key = year_col if year_col else x_col
                                    x_key = cat_dims[0]
                                    title_suffix = f"by {x_key.replace('Name', 'Airline')}"
                                
                                # Use StackedBar when composition query detected
                                bar_chart_type = "StackedBar" if is_stacked_query and len(unique_cats) <= 8 else "GroupedBar"
                                panels.append({
                                    "id": f"p{panel_id}_{idx}",
                                    "type": bar_chart_type,
                                    "title": f"{metric_clean} Comparison {title_suffix}",
                                    "dataKeyX": x_key,
                                    "dataKeyGroup": group_key,
                                    "dataKeyY": [metric],
                                    "availableMetrics": metrics_to_plot if generation_mode == "SINGLE" else None,
                                    "yAxisFormatter": "percent" if is_pct else "number"
                                })
                            elif cat_dims:
                                display_cat = cat_dims[0].replace('Name', 'Airline').replace('OpCo', 'Opco')
                                chart_type = "GroupedBar" if len(data_sample) / len(unique_times) <= 10 else "LineChart"
                                panels.append({
                                    "id": f"p{panel_id}_{idx}",
                                    "type": chart_type,
                                    "title": f"{metric_clean} by {display_cat} Over Time",
                                    "dataKeyX": x_col,
                                    "dataKeyGroup": cat_dims[0],
                                    "dataKeyY": [metric],
                                    "availableMetrics": metrics_to_plot if generation_mode == "SINGLE" else None,
                                    "yAxisFormatter": "percent" if is_pct else "number"
                                })
                            else:
                                panels.append({
                                    "id": f"p{panel_id}_{idx}",
                                    "type": "LineChart",
                                    "title": f"{metric_clean} Over Time",
                                    "dataKeyX": x_col,
                                    "dataKeyY": [metric],
                                    "availableMetrics": metrics_to_plot if generation_mode == "SINGLE" else None,
                                    "yAxisFormatter": "percent" if is_pct else "number"
                                })
                            
                            # In SINGLE mode, we only add the FIRST matching chart, but we give it all metrics
                            if generation_mode == "SINGLE" and panels:
                                break
                        panel_id += 1
                
                # If we are in SINGLE mode and we already have a chart, skip the rest
                if generation_mode == "SINGLE" and panels:
                    pass 
                elif cat_dims:
                    # Categorical Chart
                    measure_name = main_measure.replace('Raw', '').strip()
                    PCT_KEYWORDS = ['OTP', 'REGULARITY', 'FACTOR', 'MARGIN', 'RATE', '%', 'GROWTH', 'INCREASE', 'YOY']
                    is_pct = any(p in measure_name.upper() for p in PCT_KEYWORDS)
                    display_cat = cat_dims[0].replace('Name', 'Airline').replace('OpCo', 'Opco')

                    panels.append({
                        "id": f"p{panel_id}",
                        "type": "BarChart",
                        "title": f"{measure_name} by {display_cat}",
                        "dataKeyX": cat_dims[0],
                        "dataKeyY": [main_measure],
                        "yAxisFormatter": "percent" if is_pct else "number"
                    })
                    panel_id += 1

            elif cat_dims:
                # Categorical Chart (if no time dims)
                # Use Pie/Donut for market share / distribution queries
                measure_name = main_measure.replace('Raw', '').strip()
                PCT_KEYWORDS = ['OTP', 'REGULARITY', 'FACTOR', 'MARGIN', 'RATE', '%', 'GROWTH', 'INCREASE', 'YOY']
                is_pct = any(p in measure_name.upper() for p in PCT_KEYWORDS)
                display_cat = cat_dims[0].replace('Name', 'Airline').replace('OpCo', 'Opco')
                n_cats = len(set(d.get(cat_dims[0]) for d in state["raw_data"] if d.get(cat_dims[0])))
                PIE_KEYWORDS = ['share', 'distribution', 'breakdown', 'proportion', 'split', 'composition', 'mix']
                is_pie_query = any(kw in query_clean for kw in PIE_KEYWORDS)

                # Bullet: detect target/budget columns paired with actuals
                BULLET_KEYWORDS = ['target', 'budget', 'plan', 'objective', 'benchmark', 'vstarget', 'vsbudget', 'vsplan']
                is_bullet_query = any(kw in query_clean for kw in BULLET_KEYWORDS)
                target_col = next((m for m in measure_cols if any(kw in m.lower().replace(' ','') for kw in ['target','budget','plan'])), None)
                actual_col = next((m for m in measure_cols if m != target_col), None)

                if is_bullet_query and target_col and actual_col:
                    panels.append({
                        "id": f"p{panel_id}",
                        "type": "BulletChart",
                        "title": f"{actual_col.replace('Raw','').strip()} vs Target by {display_cat}",
                        "dataKeyX": cat_dims[0],
                        "dataKeyY": [actual_col],
                        "dataKeyTarget": target_col,
                        "yAxisFormatter": "percent" if is_pct else "number"
                    })
                elif is_pie_query and 2 <= n_cats <= 10 and len(measure_cols) == 1:
                    chart_type = "DonutChart" if n_cats >= 5 else "PieChart"
                    panels.append({
                        "id": f"p{panel_id}",
                        "type": chart_type,
                        "title": f"{measure_name} Distribution by {display_cat}",
                        "dataKeyX": cat_dims[0],
                        "dataKeyY": [main_measure],
                        "yAxisFormatter": "percent" if is_pct else "number"
                    })
                else:
                    panels.append({
                        "id": f"p{panel_id}",
                        "type": "BarChart",
                        "title": f"{measure_name} by {display_cat}",
                        "dataKeyX": cat_dims[0],
                        "dataKeyY": [main_measure],
                        "yAxisFormatter": "percent" if is_pct else "number"
                    })
                panel_id += 1

            # Multi-metric comparison (only in FULL mode)
            if generation_mode == "FULL" and len(measure_cols) >= 2:
                x_dim = cat_dims[0] if cat_dims else (time_dims[0] if time_dims else None)
                if x_dim:
                    measure_name = measure_cols[0].replace('Raw', '').strip()
                    PCT_KEYWORDS = ['OTP', 'REGULARITY', 'FACTOR', 'MARGIN', 'RATE', '%', 'GROWTH', 'INCREASE', 'YOY']
                    is_pct = any(p in measure_name.upper() for p in PCT_KEYWORDS)
                    panels.append({
                        "id": f"p{panel_id}",
                        "type": "GroupedBar",
                        "title": "Key Metrics Comparison",
                        "dataKeyX": x_dim,
                        "dataKeyY": measure_cols[:3],
                        "yAxisFormatter": "percent" if is_pct else "number"
                    })
                    panel_id += 1
        
        # 3. Always include DataTable at bottom
        # 3. Handle Table and Final Order
        table_panel = {
            "id": f"p{panel_id}",
            "type": "DataTable",
            "title": "Detailed Data View",
            "columns": keys,
            "formatMap": format_map
        }

        if generation_mode == "SINGLE":
            # Table first, then chart
            panels = [table_panel] + panels
        else:
            # Dashboard: Scorecards -> Charts -> Table at bottom
            panels.append(table_panel)

        config = {"panels": panels}
        return {"layout_config": json.dumps(config)}
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"DASHBOARD GEN ERROR: {error_details}")
        return {"error": f"Dashboard Generation Error: {str(e)}", "layout_config": json.dumps({"panels": []})}

workflow = StateGraph(AgentState)
workflow.add_node("generate_dax", generate_dax_node)
workflow.add_node("execute_dax", execute_dax_node)
workflow.add_node("generate_dashboard", generate_dashboard_node)

workflow.add_edge(START, "generate_dax")
workflow.add_edge("generate_dax", "execute_dax")
workflow.add_edge("execute_dax", "generate_dashboard")
workflow.add_edge("generate_dashboard", END)

app = workflow.compile()

async def process_chat(user_query: str, semantic_model: str, chat_history: List[Dict[str, str]] = []) -> dict:
    state = {
        "user_query": user_query,
        "semantic_model": semantic_model,
        "dax_query": "",
        "raw_data": [],
        "layout_config": "",
        "chat_history": chat_history,
        "error": ""
    }
    final_state = await app.ainvoke(state)
    return final_state
