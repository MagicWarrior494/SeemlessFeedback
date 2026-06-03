# SeemlessFeedback

Basic, chunk-friendly starter for:
- FastAPI backend (Python)
- React frontend
- Plain Python script for AI interaction logic

## Project structure

```text
SeemlessFeedback/
	backend/
		app/
			api/
				routes.py          # FastAPI hello endpoints
			services/
				ai_client.py       # Python AI interaction placeholder
			main.py              # FastAPI app entrypoint
		scripts/
			hello_python_ai.py   # Hello world Python script using ai_client
		requirements.txt
	frontend/
		src/
			App.jsx              # React hello world + backend fetch
			main.jsx
			styles.css
		index.html
		package.json
		vite.config.js
	.gitignore
	README.md
```

## Requirements

- Python 3.10+
- Node.js 18+ (or newer LTS)

## 1) Backend setup (FastAPI)

From repo root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Run FastAPI server:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Test endpoints:
- http://127.0.0.1:8000/
- http://127.0.0.1:8000/health
- http://127.0.0.1:8000/ai/hello

## 2) Frontend setup (React + Vite)

Open a second terminal, from repo root:

```powershell
cd frontend
npm install
npm run dev
```

Open the frontend:
- http://127.0.0.1:5173

The page fetches `http://127.0.0.1:8000/` and shows the backend message.

## 3) Hello world Python script (AI helper)

From repo root (with backend venv active):

```powershell
cd backend
python scripts/hello_python_ai.py
```

Expected output is a simple hello + placeholder AI response.

## Notes for future chunking

- Add new API groups under `backend/app/api/`.
- Keep reusable business logic in `backend/app/services/`.
- Add frontend features as folders in `frontend/src/` (for example `src/features/feedback/`).





run_dev.py
https://www.memurai.com/get-memurai LTS version

https://nodejs.org/en/download
prebuilt binaries below

npm i vite