import time
from app.main import celery_app

@celery_app.task
def test_background_job(name: str):
    print(f"⏳ Starting heavy work for {name}...")
    time.sleep(5)
    print(f"✅ Finished work for {name}!")
    return f"Hello {name}, your transcript is ready!"