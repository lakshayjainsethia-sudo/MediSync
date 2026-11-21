# scripts/start-dev.ps1
# Unified Startup Orchestration for MediSync
# Runs Node.js Backend (:5000) and FastAPI AI Microservice (:8000) concurrently with clean PID tracking.

param(
    [string]$PythonPath = $env:MEDISYNC_PYTHON
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "     MediSync Unified Service Startup Orchestration       " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Determine Project Root
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $ProjectRoot
Write-Host "[Root] $ProjectRoot" -ForegroundColor DarkGray

# 2. Setup Local AppData Logging Directory (avoiding OneDrive cloud reparse issues)
$LocalLogDir = Join-Path $env:LOCALAPPDATA "MediSync\logs"
if (-not (Test-Path $LocalLogDir)) {
    New-Item -ItemType Directory -Path $LocalLogDir -Force | Out-Null
}
$BackendLogFile = Join-Path $LocalLogDir "backend-dev.log"
$FastApiLogFile = Join-Path $LocalLogDir "ai-service-dev.log"
Write-Host "[Logs] %LOCALAPPDATA%\MediSync\logs" -ForegroundColor DarkGray

# 3. Environment & Dependency Checks
Write-Host "`n--> Pre-flight System Verification" -ForegroundColor Yellow

# Check Node.js and npm
$nodeCmd = Get-Command "node" -ErrorAction SilentlyContinue
$npmCmd = Get-Command "npm" -ErrorAction SilentlyContinue
if (-not $nodeCmd -or -not $npmCmd) {
    Write-Host "[FATAL] Node.js or npm is missing from system PATH!" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] Node.js: $(node --version)" -ForegroundColor Green

# Check Python (configurable with C:\Python313\python.exe fallback)
if (-not $PythonPath) {
    if (Test-Path "C:\Python313\python.exe") {
        $PythonPath = "C:\Python313\python.exe"
    } else {
        $pyCmd = Get-Command "python" -ErrorAction SilentlyContinue
        if ($pyCmd) {
            $PythonPath = $pyCmd.Source
        }
    }
}

if (-not $PythonPath -or -not (Test-Path $PythonPath)) {
    Write-Host "[FATAL] Python interpreter not found! Set `$env:MEDISYNC_PYTHON or install Python 3.13." -ForegroundColor Red
    exit 1
}
$pyVer = & $PythonPath --version
Write-Host "  [OK] Python: $pyVer ($PythonPath)" -ForegroundColor Green

# Verify Backend packages exist
if (-not (Test-Path "$ProjectRoot\server\node_modules")) {
    Write-Host "[ERROR] server/node_modules not found!" -ForegroundColor Red
    Write-Host "        Please install using: cd server && npm install" -ForegroundColor Yellow
    exit 1
}

# Verify AI Service dependencies
$fastApiCheck = & $PythonPath -c "import fastapi, uvicorn, motor, httpx, pydantic, pydantic_settings; print('OK')" 2>$null
if ($fastApiCheck -ne "OK") {
    Write-Host "[ERROR] Required Python packages missing!" -ForegroundColor Red
    Write-Host "        Please install using: $PythonPath -m pip install -r ai-service/requirements.txt" -ForegroundColor Yellow
    exit 1
}
Write-Host "  [OK] FastAPI Dependencies Verified" -ForegroundColor Green

# 4. Port Conflict Detection (Ports 5000 and 8000)
Write-Host "`n--> Checking Port Availability (:5000 & :8000)" -ForegroundColor Yellow

function Get-PortProcessId {
    param([int]$Port)
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) { return $conn.OwningProcess }
    return $null
}

$pid5000 = Get-PortProcessId -Port 5000
$pid8000 = Get-PortProcessId -Port 8000

if ($pid5000) {
    $procName = (Get-Process -Id $pid5000 -ErrorAction SilentlyContinue).ProcessName
    Write-Host "[FATAL] Port 5000 is occupied by PID $pid5000 ($procName)!" -ForegroundColor Red
    Write-Host "        Please stop this process before launching MediSync." -ForegroundColor Yellow
    exit 1
}

if ($pid8000) {
    $procName = (Get-Process -Id $pid8000 -ErrorAction SilentlyContinue).ProcessName
    Write-Host "[FATAL] Port 8000 is occupied by PID $pid8000 ($procName)!" -ForegroundColor Red
    Write-Host "        Please stop this process before launching MediSync." -ForegroundColor Yellow
    exit 1
}
Write-Host "  [OK] Ports 5000 and 8000 are available." -ForegroundColor Green

# 5. Service Dependency Readiness: MongoDB & Ollama
Write-Host "`n--> Checking Upstream Service Dependencies" -ForegroundColor Yellow

# MongoDB Check (port 27017)
$mongoReady = $false
try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $iar = $tcp.BeginConnect("127.0.0.1", 27017, $null, $null)
    $success = $iar.AsyncWaitHandle.WaitOne(1500, $false)
    if ($success) {
        $tcp.EndConnect($iar)
        $tcp.Close()
        $mongoReady = $true
        Write-Host "  [OK] MongoDB is responding on 127.0.0.1:27017" -ForegroundColor Green
    } else {
        $tcp.Close()
    }
} catch {
    # Handled below
}

if (-not $mongoReady) {
    Write-Host "  [WARN] MongoDB not responding on 127.0.0.1:27017." -ForegroundColor Yellow
    Write-Host "         Start MongoDB: mongod --dbpath <data-path> or start Windows Service" -ForegroundColor Yellow
}

# Ollama Check (port 11434) - Reusing logic from start-ai-dev.ps1
$ollamaReady = $false
try {
    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:11434/api/tags" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    $ollamaReady = $true
    Write-Host "  [OK] Ollama server already running on 127.0.0.1:11434" -ForegroundColor Green
} catch {
    Write-Host "  [INFO] Ollama server is not running." -ForegroundColor DarkYellow
    $ollamaCmd = Get-Command "ollama" -ErrorAction SilentlyContinue
    if ($ollamaCmd) {
        Write-Host "         Attempting to launch Ollama serve..." -ForegroundColor DarkYellow
        Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
        Start-Sleep -Seconds 3
        try {
            $resp = Invoke-WebRequest -Uri "http://127.0.0.1:11434/api/tags" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            $ollamaReady = $true
            Write-Host "  [OK] Ollama server launched." -ForegroundColor Green
        } catch {
            Write-Host "  [WARN] Ollama could not be started automatically." -ForegroundColor Yellow
        }
    } else {
        Write-Host "  [WARN] Ollama executable not found in PATH." -ForegroundColor Yellow
    }
}

if ($ollamaReady) {
    try {
        $tags = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 3
        $modelFound = $tags.models | Where-Object { $_.name -like "*qwen2.5:1.5b*" }
        if ($modelFound) {
            Write-Host "  [OK] Ollama Model: qwen2.5:1.5b is ready" -ForegroundColor Green
        } else {
            Write-Host "  [WARN] Ollama Model qwen2.5:1.5b not found! Run: ollama pull qwen2.5:1.5b" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  [WARN] Could not retrieve Ollama model list." -ForegroundColor Yellow
    }
}

# 6. Launch Child Processes
Write-Host "`n--> Initializing Independent Microservices" -ForegroundColor Yellow

$TrackedProcesses = @()

# Cleanup Function: Kills ONLY the tracked processes started in this session
function Stop-TrackedProcesses {
    Write-Host "`n`n[Shutdown] Stopping MediSync services..." -ForegroundColor Yellow
    foreach ($p in $TrackedProcesses) {
        if ($p -and -not $p.HasExited) {
            Write-Host "  Terminating PID $($p.Id) ($($p.ProcessName))..." -ForegroundColor DarkGray
            try {
                Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
            } catch {}
        }
    }
    Write-Host "[Shutdown] All MediSync launcher services stopped cleanly." -ForegroundColor Green
}

try {
    # 6A. Start FastAPI AI Service
    Write-Host "  Starting FastAPI AI Service on port 8000..." -ForegroundColor Cyan
    $aiServicePath = Join-Path $ProjectRoot "ai-service"
    
    $fastApiPsi = New-Object System.Diagnostics.ProcessStartInfo
    $fastApiPsi.FileName = $PythonPath
    $fastApiPsi.Arguments = "-m uvicorn app.main:app --host 0.0.0.0 --port 8000"
    $fastApiPsi.WorkingDirectory = $aiServicePath
    $fastApiPsi.UseShellExecute = $false
    $fastApiPsi.RedirectStandardOutput = $true
    $fastApiPsi.RedirectStandardError = $true
    $fastApiPsi.CreateNoWindow = $true

    $fastApiProc = [System.Diagnostics.Process]::Start($fastApiPsi)
    $TrackedProcesses += $fastApiProc
    Write-Host "  FastAPI Process PID: $($fastApiProc.Id)" -ForegroundColor DarkGray

    # 6B. Start Node.js Express Gateway
    Write-Host "  Starting Node.js Backend Gateway on port 5000..." -ForegroundColor Cyan
    $serverPath = Join-Path $ProjectRoot "server"

    $nodePsi = New-Object System.Diagnostics.ProcessStartInfo
    $nodePsi.FileName = "node"
    $nodePsi.Arguments = "server.js"
    $nodePsi.WorkingDirectory = $serverPath
    $nodePsi.UseShellExecute = $false
    $nodePsi.RedirectStandardOutput = $true
    $nodePsi.RedirectStandardError = $true
    $nodePsi.CreateNoWindow = $true

    $nodeProc = [System.Diagnostics.Process]::Start($nodePsi)
    $TrackedProcesses += $nodeProc
    Write-Host "  Node.js Process PID: $($nodeProc.Id)" -ForegroundColor DarkGray

    # 7. Health Check Waiting Loop
    Write-Host "`n--> Verifying Service Health Endpoints" -ForegroundColor Yellow

    function Wait-ForHealth {
        param(
            [string]$Name,
            [string]$Url,
            [int]$TimeoutSec = 20,
            [System.Diagnostics.Process]$Proc
        )
        $start = Get-Date
        while ((Get-Date) - $start -lt (New-TimeSpan -Seconds $TimeoutSec)) {
            if ($Proc.HasExited) {
                Write-Host "  [FAIL] $Name process exited unexpectedly with code $($Proc.ExitCode)!" -ForegroundColor Red
                return $false
            }
            try {
                $resp = Invoke-RestMethod -Uri $Url -TimeoutSec 2 -ErrorAction Stop
                Write-Host "  [READY] $Name is healthy ($Url)" -ForegroundColor Green
                return $true
            } catch {
                # Check if it responded with HTTP status (e.g. 503 degraded due to DB)
                if ($_.Exception.Response) {
                    $code = [int]$_.Exception.Response.StatusCode
                    if ($code -eq 503) {
                        Write-Host "  [READY - DEGRADED] $Name reachable at $Url (Database not yet connected)" -ForegroundColor Yellow
                        return $true
                    }
                }
            }
            Start-Sleep -Milliseconds 800
        }
        Write-Host "  [TIMEOUT] $Name did not respond within $TimeoutSec seconds." -ForegroundColor Red
        return $false
    }

    $fastApiHealthy = Wait-ForHealth -Name "FastAPI AI Service" -Url "http://127.0.0.1:8000/health" -TimeoutSec 15 -Proc $fastApiProc
    $nodeHealthy    = Wait-ForHealth -Name "Node.js Backend"    -Url "http://127.0.0.1:5000/health" -TimeoutSec 15 -Proc $nodeProc

    if (-not $fastApiHealthy -or -not $nodeHealthy) {
        Write-Host "`n[FATAL] One or more services failed to report ready. Shutting down..." -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  MediSync Unified Stack is Active and Ready!             " -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  - Node Backend:  http://127.0.0.1:5000 (Health: /health)" -ForegroundColor Cyan
    Write-Host "  - AI Service:    http://127.0.0.1:8000 (Health: /health)" -ForegroundColor Cyan
    Write-Host "  - Proxy Route:   http://127.0.0.1:5000/api/v1/intelligence/* -> :8000" -ForegroundColor Cyan
    Write-Host "  - Frontend:      Run independently with 'cd client && npm run dev'" -ForegroundColor Gray
    Write-Host "  Press Ctrl+C to terminate both backend services." -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host ""

    # 8. Service Event & Log Monitor Loop
    # Handles stdout/stderr asynchronously and checks process liveness
    while ($true) {
        if ($fastApiProc.HasExited) {
            $code = $fastApiProc.ExitCode
            $err = $fastApiProc.StandardError.ReadToEnd()
            Write-Host "`n[EXIT] FastAPI process exited with code $code!" -ForegroundColor Red
            if ($err) { Write-Host $err -ForegroundColor Red }
            break
        }
        if ($nodeProc.HasExited) {
            $code = $nodeProc.ExitCode
            $err = $nodeProc.StandardError.ReadToEnd()
            Write-Host "`n[EXIT] Node.js process exited with code $code!" -ForegroundColor Red
            if ($err) { Write-Host $err -ForegroundColor Red }
            break
        }

        # Drain and display pending stdout lines with colored tags
        while (-not $fastApiProc.StandardOutput.EndOfStream) {
            $line = $fastApiProc.StandardOutput.ReadLine()
            if ($line) {
                Write-Host "[FastAPI] $line" -ForegroundColor DarkCyan
                Add-Content -Path $FastApiLogFile -Value "[$(Get-Date -Format 'o')] $line"
            }
        }
        while (-not $fastApiProc.StandardError.EndOfStream) {
            $line = $fastApiProc.StandardError.ReadLine()
            if ($line) {
                Write-Host "[FastAPI] $line" -ForegroundColor DarkCyan
                Add-Content -Path $FastApiLogFile -Value "[$(Get-Date -Format 'o')] $line"
            }
        }

        while (-not $nodeProc.StandardOutput.EndOfStream) {
            $line = $nodeProc.StandardOutput.ReadLine()
            if ($line) {
                Write-Host "[Node]    $line" -ForegroundColor White
                Add-Content -Path $BackendLogFile -Value "[$(Get-Date -Format 'o')] $line"
            }
        }
        while (-not $nodeProc.StandardError.EndOfStream) {
            $line = $nodeProc.StandardError.ReadLine()
            if ($line) {
                Write-Host "[Node]    $line" -ForegroundColor Gray
                Add-Content -Path $BackendLogFile -Value "[$(Get-Date -Format 'o')] $line"
            }
        }

        Start-Sleep -Milliseconds 500
    }
}
finally {
    Stop-TrackedProcesses
}
