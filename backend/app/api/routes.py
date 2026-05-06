from fastapi import APIRouter

from app.services.ai_client import get_ai_message

router = APIRouter()


@router.get("/")
def hello_fastapi() -> dict[str, str]:
    return {"message": "Hello from FastAPI"}


@router.get("/ai/hello")
def hello_ai() -> dict[str, str]:
    return {"message": get_ai_message("Hello")}
