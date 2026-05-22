from sqlalchemy import Column, Integer, String, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum
from .database import Base

class RoleEnum(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    DATA_ANALYST = "DATA_ANALYST"
    BUSINESS_ANALYST = "BUSINESS_ANALYST"

class SemanticModelEnum(str, enum.Enum):
    COMPETITORS = "COMPETITORS"
    DASHBOARD = "DASHBOARD"

class PromptTypeEnum(str, enum.Enum):
    BASE = "BASE"
    RULES = "RULES"
    EXAMPLES = "EXAMPLES"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    role = Column(SQLEnum(RoleEnum), default=RoleEnum.BUSINESS_ANALYST, nullable=False)

    dashboards = relationship("Dashboard", back_populates="owner")

class Prompt(Base):
    __tablename__ = "prompts"

    id = Column(Integer, primary_key=True, index=True)
    semantic_model = Column(SQLEnum(SemanticModelEnum), nullable=False)
    prompt_type = Column(SQLEnum(PromptTypeEnum), nullable=False)
    content = Column(Text, nullable=False)

class Dashboard(Base):
    __tablename__ = "dashboards"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    semantic_model = Column(SQLEnum(SemanticModelEnum), nullable=False)
    layout_config = Column(Text, nullable=False) # JSON string
    chat_history = Column(Text, nullable=False) # JSON string
    raw_data = Column(Text, nullable=True) # JSON string

    owner = relationship("User", back_populates="dashboards")
class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(String, nullable=False)
