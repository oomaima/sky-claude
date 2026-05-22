from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, users, prompts, dashboards, chat, settings

app = FastAPI(title="GenVIZ API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to GenVIZ API"}

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(prompts.router, prefix="/api/prompts", tags=["prompts"])
app.include_router(dashboards.router, prefix="/api/dashboards", tags=["dashboards"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
