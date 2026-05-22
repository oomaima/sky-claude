from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from app.db.database import get_db
from app.db.models import Prompt, RoleEnum, User, SemanticModelEnum, PromptTypeEnum
from app.api.auth import get_current_user

router = APIRouter()

class PromptUpdate(BaseModel):
    content: str

class PromptResponse(BaseModel):
    id: int
    semantic_model: str
    prompt_type: str
    content: str

    class Config:
        from_attributes = True
        use_enum_values = True

def check_data_analyst_or_admin(user: User = Depends(get_current_user)):
    if user.role not in [RoleEnum.SUPER_ADMIN, RoleEnum.DATA_ANALYST]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return user

@router.get("/", response_model=List[PromptResponse])
def get_prompts(db: Session = Depends(get_db), current_user: User = Depends(check_data_analyst_or_admin)):
    prompts = db.query(Prompt).all()
    return prompts

@router.put("/{prompt_id}", response_model=PromptResponse)
def update_prompt(prompt_id: int, prompt_update: PromptUpdate, db: Session = Depends(get_db), current_user: User = Depends(check_data_analyst_or_admin)):
    db_prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not db_prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    db_prompt.content = prompt_update.content
    db.commit()
    db.refresh(db_prompt)
    return db_prompt

from app.services.agent_workflow import get_schema_metadata

@router.get("/metadata/{semantic_model}")
def get_metadata(semantic_model: str, current_user: User = Depends(check_data_analyst_or_admin)):
    metadata_content = get_schema_metadata(semantic_model.upper())
    return {"content": metadata_content}
