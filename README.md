# SKY-CLAUDE — Powered by Skynet

**SKY-CLAUDE** is an AI-powered data visualization platform designed for airline executives and analysts. It translates natural language queries into DAX expressions, retrieves live data from Power BI, and automatically generates professional, interactive dashboards.

## Project Objective

Bridge the gap between raw data and executive decision-making. The **Agentic AI Workflow** removes the technical barrier of writing DAX or manually configuring charts, allowing users to get instant visual insights from their semantic models.

## Key Features

- **Natural Language to Dashboard**: Ask *"Compare flights operations March 2026 to February 2026"* and receive a full visual analysis.
- **Agentic Workflow**: LangGraph manages a multi-step process: Query Understanding → DAX Generation → Data Execution → Dashboard Synthesis.
- **Advanced Visualizations**: Automatically selects from 12+ chart types — Waterfall (bridge analysis), Bullet (target tracking), Heatmap, Radar, Donut, Stacked Bar — based on query intent.
- **PBI Metadata Sync**: Respects Power BI measure formatting (Percentage, Decimal, Currency) for correctly formatted tables and tooltips.
- **Editable System Prompts**: Data Analysts can refine AI instructions per semantic model without code redeployment.
- **Generation Modes**: Super Admins toggle between **Full Dashboard** (KPI scorecards + multi-chart layout) and **Focused** (single chart + table) for all users.
- **Chat Persistence**: Conversation history stored in the database, enabling follow-up refinements.
- **Executive Aesthetics**: Dark glassmorphism design optimized for C-level reporting with Light/Dark mode support.

## Use Cases

1. **Competitor Benchmarking** — Dynamic visualization of capacity (ASKs, RPKs), unit economics (RASK, CASK), and profitability (EBIT, Margin) across industry rivals.
2. **Growth & Trend Analysis** — Year-over-year and quarter-over-quarter comparisons with automatic percentage growth calculations.
3. **Top-N Rankings** — Instantly rank airlines by any KPI (profit margin, load factor, RASK) for a given period.
4. **Ad-hoc Reporting** — Rapid data tables and charts without waiting for BI development cycles.

## Technology Stack

### Frontend
| Technology | Version | Purpose |
| :--- | :--- | :--- |
| React | 19 | UI framework |
| Vite | 8 | Build tool and dev server |
| React Router | 7 | Client-side routing |
| Tailwind CSS | 4 | Styling (dark glassmorphism theme) |
| Recharts | 3 | Interactive charts |
| Zustand | 5 | Auth state management |
| Axios | 1 | HTTP client with JWT interceptor |


### Backend
| Technology | Version | Purpose |
| :--- | :--- | :--- |
| FastAPI | 0.110+ | REST API framework |
| LangGraph | — | Agentic workflow orchestration |
| Claude Sonnet 4.6 | — | LLM (via langchain-anthropic) |
| SQLAlchemy + SQLite | — | User management & prompt versioning |
| MSAL + httpx | — | Power BI REST API (Service Principal auth) |
| JWT + bcrypt | — | Authentication & password hashing |

## Project Structure

```
skynetgenviz/
├── backend/
│   ├── app/
│   │   ├── api/            # REST endpoints (auth, users, chat, dashboards, prompts, settings)
│   │   ├── services/       # agent_workflow.py (LangGraph), pbi_client.py (Power BI)
│   │   ├── core/           # JWT security, PBI config, app settings
│   │   └── db/             # SQLAlchemy models, database init, seed scripts
│   ├── metadata/           # Semantic model schema (Competitors)
│   ├── scratch/            # Utility/debug scripts
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/     # All UI components (see below)
│   │   ├── store/          # Zustand auth store
│   │   ├── styles/         # Global CSS
│   │   └── api.js          # Axios instance
│   ├── nginx.conf          # Production reverse proxy
│   ├── tailwind.config.js  # Design tokens (primary blue #417FA2, accent orange #fe5b04)
│   └── vite.config.js
├── docker-compose.yml
└── README.md
```

### Frontend Components

| Component | Access | Description |
| :--- | :--- | :--- |
| `GenerateDashboard.jsx` | All | Main chat interface — sends queries, renders dashboards, save/export |
| `DashboardRenderer.jsx` | All | Recharts-based chart engine (12+ chart types, format-aware) |
| `SavedDashboards.jsx` | All | Dashboard library — browse, open, and delete saved dashboards |
| `SystemPrompts.jsx` | Analyst+ | Edit AI prompts (BASE/RULES/EXAMPLES) per semantic model |
| `ApplicationFeatures.jsx` | Super Admin | Toggle generation mode; visual chart-type catalogue |
| `UserManagement.jsx` | Super Admin | Create and delete users |
| `QueryData.jsx` | Super Admin | Execute raw DAX queries for debugging |
| `Layout.jsx` | — | Master layout: sidebar nav, model selector, user profile |
| `Login.jsx` | — | JWT authentication form |

### Backend Services

| File | Description |
| :--- | :--- |
| `agent_workflow.py` | LangGraph StateMachine: DAX generation → PBI execution → dashboard synthesis |
| `pbi_client.py` | MSAL token refresh + async DAX execution against Power BI REST API |

### User Roles

| Role | Permissions |
| :--- | :--- |
| `SUPER_ADMIN` | Manage users, edit prompts, toggle features, run raw DAX queries |
| `DATA_ANALYST` | Generate dashboards, edit system prompts |
| `BUSINESS_ANALYST` | Generate dashboards, save dashboards |

## Agentic Workflow (How It Works)

```
User Query (natural language)
       │
       ▼
[Node 1] generate_dax_node
  └─ Claude Sonnet 4.6 converts query → DAX
     using editable system prompts + semantic model schema
       │
       ▼
[Node 2] execute_dax_node
  └─ MSAL auth → Power BI REST API → raw tabular data
       │
       ▼
[Node 3] generate_dashboard_node
  └─ Classifies columns (dimensions vs measures)
     Detects intent from query keywords
     Selects chart type(s) + builds layout config
       │
       ▼
Frontend renders dashboard with Recharts
  └─ Applies PBI format strings (%, currency, integer)
```

**Chart selection keywords** (examples):
- `"waterfall"` / `"delta"` / `"change"` → Waterfall (bridge) chart
- `"breakdown"` / `"split"` / `"composition"` → Stacked bar
- `"heatmap"` / `"matrix"` → Heatmap
- `"share"` / `"distribution"` → Pie / Donut
- `"target"` / `"budget"` → Bullet chart

## How to Run

### Prerequisites
- Python 3.10+
- Node.js 18+
- Anthropic API Key
- Power BI Service Principal credentials

### 1. Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory:

```env
ANTHROPIC_API_KEY=your_key_here
POWERBI_CLIENT_ID=your_client_id
POWERBI_CLIENT_SECRET=your_client_secret
POWERBI_TENANT_ID=your_tenant_id
POWERBI_WORKSPACE_ID=your_workspace_id
POWERBI_COMPETITORS_DATASET_ID=your_dataset_id
```

Start the API:

```bash
uvicorn app.main:app --reload
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173`. The Vite dev proxy forwards `/api/*` to `http://localhost:8000`.

### 3. Docker (Production)

```bash
docker-compose up --build
```

- Backend: port `8000`
- Frontend: port `80` (Nginx reverse proxy → backend)

---

*Developed with passion by Oumaima — Skynet Team*

---

## Roadmap — Stabilisation & Enhancement Backlog

### 1. DAX Self-Correction Loop
The current LangGraph workflow stops if Power BI rejects the generated DAX. Add a retry node that feeds the PBI error message back to Claude (with the failed query as context) so it can self-correct and re-execute — targeting up to 2 automatic retries before surfacing the error to the user. This is the single highest-impact stability fix as DAX syntax errors are the most common failure mode.

### 2. In-Dashboard Chart Controls
The raw data is already in the browser after a query, so users should not need to re-query just to change how it is displayed. Add per-panel controls to: switch chart type (bar ↔ line ↔ area), swap X/Y axes, toggle individual series on/off, and change the aggregation level (quarterly → annual). This transforms the dashboard from a static snapshot into an interactive exploration surface.

### 3. Chart Export & Shareable Dashboards
Add a one-click **Export** button per panel that downloads the chart as a PNG (via `html2canvas` or Recharts' SVG serialiser) and a **PDF Report** button that packages the full dashboard layout. Separately, generate a read-only share link per saved dashboard so Business Analysts can distribute a live view without giving recipients login access — high value for C-level reporting.

### 4. Statistical Overlays & Annotations
Extend `DashboardRenderer.jsx` with optional visual overlays that require no extra data fetch: reference lines (fleet average, budget target), a linear trend line drawn over time-series charts using a least-squares calculation on the existing data points, and period-over-period delta labels (e.g. `+4.2 pp` badge above a bar). These turn basic charts into analysis-ready visuals and are particularly powerful for the RASK/CASK/Margin KPIs already in the Competitors model.

### 5. Prompt Version History & Live Testing
The System Prompts editor currently overwrites with no history. Add a lightweight version table in SQLite (prompt\_id, content, edited\_by, edited\_at) so changes are tracked and any previous version can be restored in one click. Alongside this, add a **"Test Prompt"** button on the editor page that runs a fixed sample query against the live Power BI dataset and renders the result inline — so Data Analysts can validate a prompt change before it goes live for all users.

### 6. Production-Grade AWS Deployment with Bedrock Foundation Models
Migrate the current single-container setup to a scalable AWS-native architecture. Replace the direct Anthropic API calls with **Amazon Bedrock** (Claude Sonnet via `anthropic.claude-sonnet-4-5` on Bedrock) to gain VPC-level network isolation, IAM-based access control, and no API key management. The target infrastructure: **ECS Fargate** for the FastAPI backend (auto-scaling based on concurrent chat sessions), **CloudFront + S3** for the React frontend, **RDS PostgreSQL** replacing SQLite for multi-user concurrency, and **ElastiCache Redis** for caching Power BI tokens and DAX results. LangGraph agent state should move to **Amazon DynamoDB** for persistence across container restarts. This architecture supports enterprise SSO (via Cognito), audit logging to CloudWatch, and meets the data-residency requirements typical in airline group environments.

---

> **Note to contributors:** The items above are a starting point, not a ceiling. Please review the codebase and freely modify, extend, or reprioritise this backlog — and add any items you consider relevant for the stabilisation, scalability, and efficiency of this platform.
