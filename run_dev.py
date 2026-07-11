import os
import sys

if not sys.platform.startswith("win"):
    print("Error: This script is configured specifically for Windows.")
    sys.exit(1) 

print("🚀 Launching VoiceLens Local Development Environment...")
print("💡 Memurai (Redis) is already running invisibly as a Windows Service.")

# 1. Start FastAPI Backend
print("👉 Spawning FastAPI Backend window...")
os.system('start cmd /k "title Backend API && cd backend && .\\venv\\Scripts\\activate && uvicorn app.main:app --reload --reload-dir app"')

# 2. Start Celery Worker
print("👉 Spawning Celery Worker window...")
os.system('start cmd /k "title Celery Worker && cd backend && .\\venv\\Scripts\\activate && python -m celery -A app.main.celery_app worker --loglevel=info --pool=solo"')

# 3. Start React Frontend
print("👉 Spawning React Frontend window...")
os.system('start cmd /k "title React Frontend && cd frontend && npm run dev"')

print("\n✅ Success! All development terminals have been launched.")