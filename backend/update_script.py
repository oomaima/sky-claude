import sys
import re

file_path = r'c:\Users\Oumaima Oueslati\Desktop\TowardProd\skynetgenviz\backend\app\services\agent_workflow.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """                        # ── Standard Chart Detection ──
                        metrics_to_plot = [m for m in measure_cols if 'Raw' in m]
                        if not metrics_to_plot: metrics_to_plot = measure_cols
                        
                        year_col = next((c for c in time_dims if 'year' in c.lower() and 'month' not in c.lower()), None)
                        qtr_col = next((c for c in time_dims if 'quarter' in c.lower()), None)
                        
                        for idx, metric in enumerate(metrics_to_plot):
                            metric_clean = metric.replace('Raw', '').strip()
                            is_pct = any(p in metric_clean.upper() for p in ['OTP', 'REGULARITY', 'FACTOR', 'MARGIN', 'RATE', '%', 'INCREASE', 'YOY'])
                            
                            if cat_dims and (1 < len(unique_times) <= 12):
                                unique_years = list(set(d.get(year_col) for d in data_sample if d.get(year_col))) if year_col else []
                                unique_quarters = list(set(d.get(qtr_col) for d in data_sample if d.get(qtr_col))) if qtr_col else []
                                unique_cats = list(set(d.get(cat_dims[0]) for d in data_sample if d.get(cat_dims[0])))
                                
                                if len(unique_cats) == 1 and len(unique_years) > 1 and len(unique_quarters) > 1:
                                    x_key = qtr_col
                                    group_key = year_col
                                    title_suffix = f"for {unique_cats[0]}"
                                elif len(unique_years) == 1 and qtr_col:
                                    group_key = qtr_col
                                    x_key = cat_dims[0]
                                    title_suffix = f"by {x_key.replace('Name', 'Airline')}"
                                else:
                                    group_key = year_col if year_col else x_col
                                    x_key = cat_dims[0]
                                    title_suffix = f"by {x_key.replace('Name', 'Airline')}"
                                
                                panels.append({
                                    "id": f"p{panel_id}_{idx}",
                                    "type": "GroupedBar",
                                    "title": f"{metric_clean} Comparison {title_suffix}",
                                    "dataKeyX": x_key,
                                    "dataKeyGroup": group_key,
                                    "dataKeyY": [metric],
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
                                    "yAxisFormatter": "percent" if is_pct else "number"
                                })
                            else:
                                panels.append({
                                    "id": f"p{panel_id}_{idx}",
                                    "type": "LineChart",
                                    "title": f"{metric_clean} Over Time",
                                    "dataKeyX": x_col,
                                    "dataKeyY": [metric],
                                    "yAxisFormatter": "percent" if is_pct else "number"
                                })
                        panel_id += 1"""

pattern = re.compile(r'# ── Standard Chart Detection ──.*?panel_id \+= 1', re.DOTALL)
if pattern.search(content):
    new_content = pattern.sub(replacement, content)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("SUCCESS")
else:
    print("NOT FOUND")
