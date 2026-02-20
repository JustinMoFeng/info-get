# Info-Get

Personal knowledge base with RAG capabilities.

## Setup
1. Create virtual environment: `python -m venv venv`
2. Activate: `. venv/bin/activate` (or `venv\Scripts\activate` on Windows)
3. Install dependencies: `pip install -r requirements.txt`

## Running the Application

### One-Click Start (Windows)
Simply run the `start.bat` script in the root directory. This will launch both backend and frontend servers in separate windows.

### Manual Start

#### Backend
Run from the project root directory:
```bash
python -m uvicorn backend.app.main:app --reload
```
Access API at: http://localhost:8000
API Docs: http://localhost:8000/docs

### Frontend
Run from the frontend directory:
```bash
cd frontend
npm run dev
```
Access UI at: http://localhost:5173

## Development Rules
See [.trae/rules/rules.md](.trae/rules/rules.md) for workflow guidelines.
