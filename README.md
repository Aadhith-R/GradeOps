# GradeOps

## 🚀 Quickstart (Windows PowerShell)

You will need two separate PowerShell terminal windows open to run GradeOps locally.

**1. Start the Backend (FastAPI)**
cd backend
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload

**2. Start the Frontend (React)**
cd frontend
npm install
npm run dev ""