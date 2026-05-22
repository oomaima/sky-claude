from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, Any

from app.api.auth import get_current_user
from app.db.models import User, SemanticModelEnum
from app.services.agent_workflow import process_chat

router = APIRouter()

class ChatRequest(BaseModel):
    user_query: str
    semantic_model: SemanticModelEnum
    chat_history: list[Dict[str, Any]] = []

class ChatResponse(BaseModel):
    dax_query: str
    raw_data: list
    layout_config: str
    error: str
    format_map: Dict[str, str] = {}

@router.post("/", response_model=ChatResponse)
async def generate_dashboard(request: ChatRequest, current_user: User = Depends(get_current_user)):
    try:
        final_state = await process_chat(request.user_query, request.semantic_model.value, request.chat_history)
        
        # Load format map for the selected semantic model
        from app.services.agent_workflow import get_format_map
        fmt_map = get_format_map(request.semantic_model.value)
        
        return ChatResponse(
            dax_query=final_state.get("dax_query", ""),
            raw_data=final_state.get("raw_data", []),
            layout_config=final_state.get("layout_config", ""),
            error=final_state.get("error", ""),
            format_map=fmt_map
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
