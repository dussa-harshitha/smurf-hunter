#!/bin/bash
set -e

echo "=== Starting Smurfing Hunter ==="

# Backend
echo "[1/2] Starting FastAPI backend on :8000..."
cd backend
pip install -r requirements.txt --quiet 2>/dev/null
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# Frontend
echo "[2/2] Starting Vite dev server on :8080..."
npm install --silent 2>/dev/null
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Backend  → http://localhost:8000/api/stats"
echo "Frontend → http://localhost:8080"
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
