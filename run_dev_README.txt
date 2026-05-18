Python 3.10+: Download from the official site. (Crucial: Make sure to check the box that says "Add Python to PATH" during setup).

Node.js (v18 or higher): Download the LTS version from the official site.

Memurai (Redis for Windows): Download and run the Developer Edition (LTS) installer from Memurai's website. Run the installer fully—it will set up Redis to run automatically as a silent background service.



Backend: 

# 1. Move into the backend directory
cd backend

# 2. Create your isolated local virtual environment
python -m venv venv

# 3. Activate the environment
.\venv\Scripts\Activate.ps1

"if policy error: run: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process"


# 4. Install all required packages (including Celery and Redis)
pip install -r requirements.txt

# 5. Move back up to the project root
cd ..



# 1. Frontend, Move into the frontend directory

cd frontend

# 2. Download and install the React packages
npm install

# 3. Move back up to the project root
cd ..

# 4 run:
python run_dev.py

