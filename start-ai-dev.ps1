# start-ai-dev.ps1
# Run this script to start the MediSync AI Care Companion in development mode.
# Prerequisites: Ollama installed, qwen2.5:1.5b pulled, Python 3.x, pip packages installed.

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MediSync AI Care Companion - Dev Start" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Start Ollama if not already running
Write-Host "[1/3] Checking Ollama..." -ForegroundColor Yellow
$ollamaRunning = $false
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    $ollamaRunning = $true
    Write-Host "      Ollama already running." -ForegroundColor Green
} catch {
    Write-Host "      Starting Ollama..." -ForegroundColor Yellow
    Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 4
    Write-Host "      Ollama started." -ForegroundColor Green
}

# 2. Verify model available
Write-Host "[2/3] Checking qwen2.5:1.5b model..." -ForegroundColor Yellow
try {
    $tags = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 5
    $modelFound = $tags.models | Where-Object { $_.name -like "*qwen2.5:1.5b*" }
    if ($modelFound) {
        Write-Host "      qwen2.5:1.5b is ready." -ForegroundColor Green
    } else {
        Write-Host "      [WARN] qwen2.5:1.5b not found! Run: ollama pull qwen2.5:1.5b" -ForegroundColor Red
    }
} catch {
    Write-Host "      [WARN] Could not verify model." -ForegroundColor Yellow
}

# 3. Start FastAPI AI service
Write-Host "[3/3] Starting FastAPI AI service on :8000..." -ForegroundColor Yellow
$aiServicePath = Join-Path $PSScriptRoot "ai-service"
Start-Process -FilePath "python" `
    -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload" `
    -WorkingDirectory $aiServicePath `
    -WindowStyle Normal

Start-Sleep -Seconds 3
Write-Host ""
Write-Host "AI Service started!" -ForegroundColor Green
Write-Host "  Health check: http://localhost:8000/health" -ForegroundColor Cyan
Write-Host "  Debug route:  http://localhost:8000/debug/route?q=show+my+prescriptions" -ForegroundColor Cyan
Write-Host ""
Write-Host "Now start the main MediSync stack (if not already running):" -ForegroundColor Yellow
Write-Host "  docker-compose up" -ForegroundColor White
Write-Host ""
Write-Host "Then open: http://localhost:5173  (log in as a Patient)" -ForegroundColor Green
Write-Host ""
