from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from app.db.database import get_db
from app.db.models import User, RoleEnum
from app.api.auth import get_current_user
from app.core.security import get_password_hash

router = APIRouter()

class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    role: RoleEnum

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str = None
    role: str

    class Config:
        from_attributes = True

def check_super_admin(user: User = Depends(get_current_user)):
    if user.role != RoleEnum.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return user

@router.get("/", response_model=List[UserResponse])
def get_users(db: Session = Depends(get_db), current_user: User = Depends(check_super_admin)):
    users = db.query(User).all()
    return users

@router.post("/", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(check_super_admin)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = User(
        email=user.email,
        password_hash=get_password_hash(user.password),
        full_name=user.full_name,
        role=user.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(check_super_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}
