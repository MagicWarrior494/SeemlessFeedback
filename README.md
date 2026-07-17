# SeemlessFeedback

SeemlessFeedback is a web application that helps instructors give students fast, high-quality feedback with minimal friction. An instructor can record audio (or type notes) about a student's work, and the application automatically transcribes the audio and uses AI to summarize it into clean, structured feedback. Feedback is organized by course, and a history view lets instructors review and edit past feedback.

The project is built as a **FastAPI (Python) backend** with a **Celery + Redis** background task queue for the heavy audio/AI processing, a **React (Vite) frontend**, and **Google Gemini** for transcription and summarization.

> **Team Members:** Alex Turner, Nicholas Elliott, Kevin Rogers

## Instructions for Build and Use

### Prerequisites

* **Python 3.10+** — during install, check the box "Add Python to PATH".
* **Node.js 18+** (LTS recommended).
* **Memurai (Redis for Windows)** — install the Developer Edition (LTS). The installer sets Redis up to run automatically as a background service. (On macOS/Linux you can use standard Redis instead.)

### Steps to build the software

1. **Clone the repository** and open a terminal at the project root.
2. **Set up the backend:**
   ```powershell
   cd backend
   python -m venv venv
   .\venv\Scripts\Activate.ps1        # If you get a policy error: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
   pip install -r requirements.txt
   cd ..
   ```
   > If `google-genai` or `python-multipart` fail to install, run them explicitly:
   > `.\venv\Scripts\python.exe -m pip install python-multipart` and
   > `.\venv\Scripts\python.exe -m pip install google-genai`
3. **Set up the frontend:**
   ```powershell
   cd frontend
   npm install
   cd ..
   ```
4. **Provide a Google Gemini API key** so the AI transcription/summarization can run (set it in your environment or the configured location used by `backend/app/services/ai_client.py`).

### Steps to run the software

1. From the project root, start everything with the dev launcher:
   ```powershell
   python run_dev.py
   ```
   This starts the FastAPI backend, the Celery worker, and the React (Vite) dev server.
2. Open the frontend in your browser (Vite typically serves at **http://localhost:5173**).
3. The backend API runs at **http://localhost:8000** (interactive API docs at **http://localhost:8000/docs**).

### Instructions for using the software

1. **Register / log in** as an instructor from the login page.
2. **Create or select a course** on the Courses page.
3. **Give feedback** by choosing to either **record audio** or **type text feedback** for a student.
4. The app **transcribes** the audio and **summarizes** it with AI into clean feedback; you can **edit** the result before finalizing.
5. **Review past feedback** on the History page, where you can revisit and edit previously submitted feedback.

## Development Environment

To recreate the development environment, you need the following software and libraries:

* **Python 3.12** (3.10+ supported)
* **Node.js 24** (18+ supported) with **npm**
* **FastAPI** + **Uvicorn** (backend web framework / ASGI server)
* **Celery** + **Redis / Memurai** (background task queue for audio & AI processing)
* **google-genai** (Google Gemini SDK for transcription and summarization)
* **python-multipart** (file/audio upload handling)
* **React 18** + **Vite 5** (frontend, via npm)
* Editor: **Visual Studio Code**; version control with **Git / GitHub**

## Software Features

Completed features:

* [x] Audio recording and text upload (supports WAV encoding and raw text input)
* [x] AI transcription and diarization (powered by the Gemini multimodal API)
* [x] Transcript review and editing (human-in-the-loop corrections)
* [x] AI summarizer engine (isolated task pipeline for turning transcripts into clean feedback)
* [x] Instructor course setup (junction-table account linking)
* [x] User registration and login (instructor accounts)
* [x] Background job processing with Celery + Redis (transcribe/summarize/finalize)
* [x] Feedback history view with editing of past entries
* [x] Multi-page React frontend (Login, Courses, Record, Text Feedback, History, Settings, About)

Not completed / in progress:

* [ ] Secure authentication (identity/role currently derived from request headers rather than a verified session/JWT)
* [ ] Student-facing view to receive and read feedback
* [ ] Polished, finalized UI styling

## Team Communication

Our team communicated mainly through a Discord server for quick day-to-day questions and updates. We used GitHub to share and combine our code, and we met as a group twice a week to check in on progress and plan the next steps.

## Team Responsibilities

* **Backend (FastAPI, Celery, AI services):** Alex Turner
* **Frontend (React pages and components):** Firstname Lastname
* **AI integration (transcription & summarization):** Firstname Lastname
* **Integration, testing, and dev tooling (`run_dev.py`):** Alex Turner

## Reflections

Findings from the team retrospective (lessons-learned) meeting:

### What the team learned

* We learned how much smoother the work goes when we split the project into clear pieces and let each person focus on their part.
* We learned that talking things through early saved us a lot of confusion later, especially when two people were touching related pieces.
* We learned that building something with AI in it takes a lot of trial and error, and that it is okay to keep adjusting until it feels right.
* We learned that giving ourselves a little extra time for the unexpected made the busy stretches near the end far less stressful.

### What can be improved

* We could plan out the pieces of a feature a bit more before jumping in, so we spend less time redoing work.
* We could check in with each other more regularly so everyone always knows what the others are working on.
* We could save and share our work in smaller pieces more often, which makes it easier to combine everyone's changes.
* We could set aside time for the look and feel of the app earlier instead of leaving it for the end.

### Future plans for this project

* We would like to make signing in safer and more reliable for everyone who uses the app.
* We would like to add a way for students to see the feedback their instructors leave for them.
* We would like to give the app a cleaner, friendlier look.
* We would like to write clearer setup instructions so anyone can get the project running easily.

## Useful Websites to Learn More

I found these websites useful in developing this software:

* [FastAPI Documentation](https://fastapi.tiangolo.com/)
* [Celery Documentation](https://docs.celeryq.dev/)
* [React Documentation](https://react.dev/)
* [Vite Documentation](https://vitejs.dev/)
* [Google Gemini API (google-genai) Docs](https://ai.google.dev/gemini-api/docs)
* [Memurai (Redis for Windows)](https://www.memurai.com/)

## Future Work

The following items I plan to fix, improve, and/or add to this project in the future:

* [ ] Replace header-based identity with secure authentication (session/JWT) and proper role checks
* [ ] Add a student-facing view to receive and read feedback
* [ ] Finalize and polish the frontend UI styling
* [ ] Add automated tests for backend endpoints and background tasks
* [ ] Simplify environment/API-key configuration for easier setup
