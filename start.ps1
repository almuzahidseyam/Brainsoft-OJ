$ErrorActionPreference = "Stop"
Write-Host "Starting Brainsoft-OJ..." -ForegroundColor Cyan

# Start Backend
Write-Host "Starting Backend on Port 5000..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/k cd backend && npm start"

# Start Frontend
Write-Host "Starting Frontend (Vite)..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/k cd frontend && npm run dev"

Write-Host "Both servers are starting! A browser window should open shortly." -ForegroundColor Green
