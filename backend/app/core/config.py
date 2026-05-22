from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str = "super_secret_key_for_genviz"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 1 week

    # PBI Settings are in .env, we can load them here too
    POWERBI_TENANT_ID: str = ""
    POWERBI_CLIENT_ID: str = ""
    POWERBI_CLIENT_SECRET: str = ""
    POWERBI_WORKSPACE_ID: str = ""
    POWERBI_COMPETITORS_DATASET_ID: str = ""
    ANTHROPIC_API_KEY: str = ""
    
    model_config = {
        "env_file": ".env",
        "extra": "ignore"
    }

settings = Settings()
