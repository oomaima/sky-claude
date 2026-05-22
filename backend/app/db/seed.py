import sys
import os

# Add the parent directory to sys.path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.db.database import engine, Base, SessionLocal
from app.db.models import User, RoleEnum, Prompt, SemanticModelEnum, PromptTypeEnum, Setting
from app.core.security import get_password_hash

def seed_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Create Users
    users = [
        {"email": "admin@genviz.com", "password": "password", "role": RoleEnum.SUPER_ADMIN, "full_name": "System Administrator"},
        {"email": "analyst@genviz.com", "password": "password", "role": RoleEnum.DATA_ANALYST, "full_name": "Senior Data Analyst"},
        {"email": "viewer@genviz.com", "password": "password", "role": RoleEnum.BUSINESS_ANALYST, "full_name": "Executive Viewer"},
    ]

    for u in users:
        existing = db.query(User).filter(User.email == u["email"]).first()
        if not existing:
            db_user = User(
                email=u["email"],
                password_hash=get_password_hash(u["password"]),
                full_name=u["full_name"],
                role=u["role"]
            )
            db.add(db_user)

    # Seed some base prompts
    base_prompts = [
        {
            "model": SemanticModelEnum.COMPETITORS,
            "type": PromptTypeEnum.BASE,
            "content": "You are a Power BI DAX expert. Write a valid DAX query using EVALUATE SUMMARIZECOLUMNS to retrieve competitor data."
        },
        {
            "model": SemanticModelEnum.COMPETITORS,
            "type": PromptTypeEnum.RULES,
            "content": "1. OUTPUT: Return ONLY the DAX query. No markdown, no ```dax blocks.\n2. QUOTING: Use single quotes for table names. String literals MUST use double quotes.\n3. SAFE MEASURE PATTERN: You MUST use DEFINE MEASURE to create safe local measures using SUMX and IFERROR.\n4. MEASURE COLUMN ACCESS: If you need to reference a dimension column inside a DEFINE MEASURE block, use SELECTEDVALUE('Table'[Column]).\n5. MEASURE SUFFIX RULES: Every metric MUST have a '_Value' version (numeric) and a '_Display' version (formatted string).\n6. COLUMN INCLUSION: Always include 'Opco', 'Year', and 'Quarter' in SUMMARIZECOLUMNS for context.\n7. GROWTH QUERIES: If the user asks for 'Increase' or 'Growth', you MUST calculate the **PERCENTAGE GROWTH** (e.g., (CY-PY)/PY) and name it with the suffix '_Growth_Value' and '_Growth_Display'. Do NOT project absolute differences unless explicitly asked. This ensures the charts are comparable and clean.\n8. SUMMARIZECOLUMNS RULE: Never re-project a grouping column as a named value."
        },
        {
            "model": SemanticModelEnum.COMPETITORS,
            "type": PromptTypeEnum.EXAMPLES,
            "content": (
                "Example 1 — EBIT for FR from 2023 to 2025 by quarter:\n"
                "DEFINE\n"
                "  MEASURE 'POC Data'[_Total Revenue Value] = SUMX('POC Data', IFERROR(VALUE('POC Data'[Total Revenue]), 0)) / 1000000\n"
                "  MEASURE 'POC Data'[_Total Expenditure on Operations Value] = SUMX('POC Data', IFERROR(VALUE('POC Data'[Total Expenditure on Operations]), 0)) / 1000000\n"
                "  MEASURE 'POC Data'[_EBIT Safe] = [_Total Revenue Value] - [_Total Expenditure on Operations Value]\n"
                "  MEASURE 'POC Data'[_EBIT Display Safe] = FORMAT([_EBIT Safe], \"#,##0\") & \" M EUR\"\n"
                "EVALUATE\n"
                "SUMMARIZECOLUMNS(\n"
                "    'POC Data'[Opco],\n"
                "    'Airlines Context'[Name],\n"
                "    'POC Data'[Year],\n"
                "    'POC Data'[Quarter],\n"
                "    TREATAS({\"FR\"}, 'POC Data'[Opco]),\n"
                "    FILTER(ALL('POC Data'[Year]), 'POC Data'[Year] >= 2023 && 'POC Data'[Year] <= 2025),\n"
                "    \"EBIT\", [_EBIT Display Safe]\n"
                ")\n\n"

                "Example 2 — Top 5 airlines by profit margin in Q3 2025:\n"
                "DEFINE\n"
                "  MEASURE 'POC Data'[_Total Revenue Value] = SUMX('POC Data', IFERROR(VALUE('POC Data'[Total Revenue]), 0)) / 1000000\n"
                "  MEASURE 'POC Data'[_Total Expenditure on Operations Value] = SUMX('POC Data', IFERROR(VALUE('POC Data'[Total Expenditure on Operations]), 0)) / 1000000\n"
                "  MEASURE 'POC Data'[_Margin Safe] = DIVIDE([_Total Revenue Value] - [_Total Expenditure on Operations Value], [_Total Revenue Value])\n"
                "  VAR _Filter = FILTER(ALL('POC Data'[Year], 'POC Data'[Quarter]), 'POC Data'[Year] = 2025 && 'POC Data'[Quarter] = \"Q3\")\n"
                "  VAR _SummaryTable = SUMMARIZECOLUMNS(\n"
                "      'POC Data'[Opco],\n"
                "      'Airlines Context'[Name],\n"
                "      'POC Data'[Year],\n"
                "      'POC Data'[Quarter],\n"
                "      _Filter,\n"
                "      FILTER('POC Data', NOT('POC Data'[Opco] IN {\"AF\", \"EW\", \"IAG\"})),\n"
                "      \"Profit Margin Value\", 'POC Data'[_Margin Safe]\n"
                "  )\n"
                "  VAR _NonZero = FILTER(_SummaryTable, NOT ISBLANK([Profit Margin Value]) && [Profit Margin Value] <> 0)\n"
                "  VAR _TopN = TOPN(5, _NonZero, [Profit Margin Value], DESC)\n"
                "EVALUATE\n"
                "  SELECTCOLUMNS(\n"
                "    _TopN,\n"
                "    \"Opco\", 'POC Data'[Opco],\n"
                "    \"Name\", 'Airlines Context'[Name],\n"
                "    \"Year\", 'POC Data'[Year],\n"
                "    \"Quarter\", 'POC Data'[Quarter],\n"
                "    \"Profit Margin\", ROUND([Profit Margin Value] * 100, 1) & \" %\"\n"
                "  )\n"
                "ORDER BY [Profit Margin] DESC\n\n"

                "Example 3 — RASK, CASK, Profit Margin and EBIT for FR, HV and W6 from 2024 to 2025 by quarter:\n"
                "DEFINE\n"
                "  MEASURE 'POC Data'[_Total Revenue Value] = SUMX('POC Data', IFERROR(VALUE('POC Data'[Total Revenue]), 0)) / 1000000\n"
                "  MEASURE 'POC Data'[_Total Expenditure on Operations Value] = SUMX('POC Data', IFERROR(VALUE('POC Data'[Total Expenditure on Operations]), 0)) / 1000000\n"
                "  MEASURE 'POC Data'[_EBIT Safe] = [_Total Revenue Value] - [_Total Expenditure on Operations Value]\n"
                "  MEASURE 'POC Data'[_RASK Safe] = DIVIDE([_Total Revenue Value], [_ASKs Value]) * 100\n"
                "  MEASURE 'POC Data'[_CASK Safe] = DIVIDE([_Total Expenditure on Operations Value], [_ASKs Value]) * 100\n"
                "  MEASURE 'POC Data'[_Margin Safe] = DIVIDE([_EBIT Safe], [_Total Revenue Value])\n"
                "  VAR _Summary = SUMMARIZECOLUMNS(\n"
                "      'POC Data'[Opco],\n"
                "      'Airlines Context'[Name],\n"
                "      'POC Data'[Year],\n"
                "      'POC Data'[Quarter],\n"
                "      TREATAS({\"FR\", \"HV\", \"W6\"}, 'POC Data'[Opco]),\n"
                "      TREATAS({2024, 2025}, 'POC Data'[Year]),\n"
                "      \"RASK Raw\", 'POC Data'[_RASK Safe],\n"
                "      \"CASK Raw\", 'POC Data'[_CASK Safe],\n"
                "      \"Margin Raw\", 'POC Data'[_Margin Safe],\n"
                "      \"EBIT Raw\", 'POC Data'[_EBIT Safe]\n"
                "  )\n"
                "EVALUATE\n"
                "  SELECTCOLUMNS(\n"
                "    FILTER(\n"
                "      _Summary,\n"
                "      NOT ISBLANK([RASK Raw]) && [RASK Raw] <> 0 &&\n"
                "      NOT ISBLANK([CASK Raw]) && [CASK Raw] <> 0 &&\n"
                "      NOT ISBLANK([Margin Raw]) && [Margin Raw] <> 0 &&\n"
                "      NOT ISBLANK([EBIT Raw]) && [EBIT Raw] <> 0\n"
                "    ),\n"
                "    \"Opco\", 'POC Data'[Opco],\n"
                "    \"Name\", 'Airlines Context'[Name],\n"
                "    \"Year\", 'POC Data'[Year],\n"
                "    \"Quarter\", 'POC Data'[Quarter],\n"
                "    \"RASK\", FORMAT([RASK Raw], \"0.00\") & \" c EUR\",\n"
                "    \"CASK\", FORMAT([CASK Raw], \"0.00\") & \" c EUR\",\n"
                "    \"Profit Margin\", ROUND([Margin Raw] * 100, 1) & \" %\",\n"
                "    \"EBIT\", FORMAT([EBIT Raw], \"#,##0\") & \" M EUR\"\n"
                "  )"
            )
        },
    ]

    for p in base_prompts:
        existing = db.query(Prompt).filter(
            Prompt.semantic_model == p["model"],
            Prompt.prompt_type == p["type"]
        ).first()
        if not existing:
            db_prompt = Prompt(
                semantic_model=p["model"],
                prompt_type=p["type"],
                content=p["content"]
            )
            db.add(db_prompt)

    # Seed initial settings
    settings = [
        {"key": "GENERATION_MODE", "value": "SINGLE"}
    ]

    for s in settings:
        existing = db.query(Setting).filter(Setting.key == s["key"]).first()
        if not existing:
            db_setting = Setting(key=s["key"], value=s["value"])
            db.add(db_setting)

    db.commit()
    db.close()
    print("Database seeded successfully.")

if __name__ == "__main__":
    seed_db()
