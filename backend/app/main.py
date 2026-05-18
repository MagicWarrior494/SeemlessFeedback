from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from celery import Celery
from app.api.routes import router

app = FastAPI(title="SeemlessFeedback API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

celery_app = Celery(
    "voicelens",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0",
    include=["app.tasks"]
)

app.include_router(router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

@app.get("/")
def read_root():
    return {"message": "FastAPI is running and Celery is configured!"}

@app.post("/trigger")
def trigger_job(name: str):
    from app.tasks import test_background_job 
    test_background_job.delay(name)
    return {"message": "Job successfully sent to the Celery queue!"}