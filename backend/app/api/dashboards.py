from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from app.db.database import get_db
from app.db.models import Dashboard, User, SemanticModelEnum
from app.api.auth import get_current_user

router = APIRouter()

class DashboardCreate(BaseModel):
    title: str
    semantic_model: SemanticModelEnum
    layout_config: str
    chat_history: str
    raw_data: str

class DashboardResponse(BaseModel):
    id: int
    title: str
    semantic_model: SemanticModelEnum
    layout_config: str
    chat_history: str
    raw_data: str | None = None

    class Config:
        from_attributes = True

@router.get("/", response_model=List[DashboardResponse])
def get_user_dashboards(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    dashboards = db.query(Dashboard).filter(Dashboard.user_id == current_user.id).all()
    return dashboards

@router.post("/", response_model=DashboardResponse)
def save_dashboard(dash: DashboardCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_dash = Dashboard(
        user_id=current_user.id,
        title=dash.title,
        semantic_model=dash.semantic_model,
        layout_config=dash.layout_config,
        chat_history=dash.chat_history,
        raw_data=dash.raw_data
    )
    db.add(db_dash)
    db.commit()
    db.refresh(db_dash)
    return db_dash

@router.delete("/{dash_id}")
def delete_dashboard(dash_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_dash = db.query(Dashboard).filter(Dashboard.id == dash_id, Dashboard.user_id == current_user.id).first()
    if not db_dash:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    db.delete(db_dash)
    db.commit()
    return {"message": "Dashboard deleted"}
