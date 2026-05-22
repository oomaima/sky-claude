from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from app.db.database import get_db
from app.db.models import Setting, RoleEnum, User
from app.api.auth import get_current_user

router = APIRouter()

class SettingUpdate(BaseModel):
    value: str

class SettingResponse(BaseModel):
    key: str
    value: str

    class Config:
        from_attributes = True

def check_super_admin(user: User = Depends(get_current_user)):
    if user.role != RoleEnum.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only Super Admins can change application features")
    return user

@router.get("/", response_model=List[SettingResponse])
def get_settings(db: Session = Depends(get_db)):
    return db.query(Setting).all()

@router.put("/{key}", response_model=SettingResponse)
def update_setting(key: str, setting_update: SettingUpdate, db: Session = Depends(get_db), current_user: User = Depends(check_super_admin)):
    db_setting = db.query(Setting).filter(Setting.key == key).first()
    if not db_setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    
    db_setting.value = setting_update.value
    db.commit()
    db.refresh(db_setting)
    return db_setting
