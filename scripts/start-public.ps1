<#
.SYNOPSIS
    Expone Casino VjF publicamente via Cloudflare Quick Tunnels.
.DESCRIPTION
    1. Levanta tunel de la API y captura la URL
    2. Buildea el frontend con esa URL
    3. Sirve el frontend en :3000
    4. Levanta tunel del frontend
    Todo en una sola terminal usando procesos en background.
.EXAMPLE
    .\scripts\start-public.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$ProjectRoot    = Split-Path -Parent $PSScriptRoot
$FrontendDir    = Join-Path $ProjectRoot "casino_frontend"
$FrontendEnv    = Join-Path $FrontendDir ".env"
$ApiLogFile     = Join-Path $env:TEMP "casino-api-tunnel.log"
$FrontLogFile   = Join-Path $env:TEMP "casino-front-tunnel.log"

function Write-Step { param([string]$Msg) Write-Host "`n[....] $Msg" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Msg) Write-Host "[ OK ] $Msg" -ForegroundColor Green }
function Write-Fail { param([string]$Msg) Write-Host "[FAIL] $Msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "=================================================" -ForegroundColor Magenta
Write-Host "   Casino VjF -- Inicio publico                 " -ForegroundColor Magenta
Write-Host "=================================================" -ForegroundColor Magenta

# ── Step 1: Verificar Docker y contenedores ───────────────────────────────────
Write-Step "Verificando contenedores..."
$containers = docker ps --format "{{.Names}}" 2>$null
$dbName  = $containers | Where-Object { $_ -match "db-1" } | Select-Object -First 1
$apiName = $containers | Where-Object { $_ -match "api-1" } | Select-Object -First 1

if (-not $dbName -or -not $apiName) {
    Write-Host "[INFO] Contenedores no estan corriendo. Ejecuta primero: .\scripts\setup.ps1 -SkipBackup" -ForegroundColor Yellow
    Write-Fail "Contenedores no encontrados."
}
Write-Ok "Contenedores activos: $dbName, $apiName"

# ── Step 2: Levantar tunel de la API en background ───────────────────────────
Write-Step "Iniciando tunel de la API..."
if (Test-Path $ApiLogFile) { Remove-Item $ApiLogFile -Force }
$apiTunnelProc = Start-Process "cloudflared" -ArgumentList "tunnel --url http://localhost:8000" `
    -RedirectStandardError $ApiLogFile -PassThru -NoNewWindow

# Esperar hasta que aparezca la URL (max 30s)
$elapsed = 0
$apiUrl  = $null
while ($elapsed -lt 30 -and -not $apiUrl) {
    Start-Sleep -Seconds 1; $elapsed++
    if (Test-Path $ApiLogFile) {
        $match = Select-String -Path $ApiLogFile -Pattern "https://[a-z0-9\-]+\.trycloudflare\.com" -AllMatches
        if ($match) { $apiUrl = $match.Matches[0].Value }
    }
}
if (-not $apiUrl) { Write-Fail "No se pudo obtener la URL del tunel de la API." }
Write-Ok "API publica: $apiUrl"

# ── Step 3: Actualizar CORS en casino_app/.env ───────────────────────────────
Write-Step "Configurando CORS..."
$appEnv     = Join-Path $ProjectRoot "casino_app\.env"
$envContent = Get-Content $appEnv | Where-Object { $_ -notmatch "^CORS_ORIGINS" }
$envContent += "CORS_ORIGINS=$apiUrl,http://localhost:5173,http://localhost:3000"
$envContent | Set-Content $appEnv
docker restart $apiName 2>&1 | Out-Null
Start-Sleep -Seconds 3
Write-Ok "CORS actualizado y API reiniciada."

# ── Step 4: Build del frontend ───────────────────────────────────────────────
Write-Step "Buildeando frontend con URL: $apiUrl/api/v1 ..."
"VITE_API_URL=$apiUrl/api/v1" | Set-Content $FrontendEnv
Push-Location $FrontendDir
try { $null = npx vite build 2>&1 } catch { }
if ($LASTEXITCODE -ne 0) { Write-Fail "vite build fallo." }
Pop-Location
Write-Ok "Frontend buildeado."

# ── Step 5: Servir frontend en :3000 ─────────────────────────────────────────
Write-Step "Iniciando servidor frontend en :3000..."
$serveProc = Start-Process "cmd" -ArgumentList "/c npx serve dist -l 3000 --single" `
    -WorkingDirectory $FrontendDir -PassThru -NoNewWindow
Start-Sleep -Seconds 2
Write-Ok "Frontend sirviendo en localhost:3000"

# ── Step 6: Levantar tunel del frontend ──────────────────────────────────────
Write-Step "Iniciando tunel del frontend..."
if (Test-Path $FrontLogFile) { Remove-Item $FrontLogFile -Force }
$frontTunnelProc = Start-Process "cloudflared" -ArgumentList "tunnel --url http://localhost:3000" `
    -RedirectStandardError $FrontLogFile -PassThru -NoNewWindow

$elapsed   = 0
$frontUrl  = $null
while ($elapsed -lt 30 -and -not $frontUrl) {
    Start-Sleep -Seconds 1; $elapsed++
    if (Test-Path $FrontLogFile) {
        $match = Select-String -Path $FrontLogFile -Pattern "https://[a-z0-9\-]+\.trycloudflare\.com" -AllMatches
        if ($match) { $frontUrl = $match.Matches[0].Value }
    }
}
if (-not $frontUrl) { Write-Fail "No se pudo obtener la URL del tunel del frontend." }

# ── Resumen ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=================================================" -ForegroundColor Magenta
Write-Host "   SISTEMA PUBLICO ACTIVO                       " -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Magenta
Write-Host "  Frontend : $frontUrl" -ForegroundColor Green
Write-Host "  API      : $apiUrl" -ForegroundColor Green
Write-Host "  Swagger  : $apiUrl/docs" -ForegroundColor Green
Write-Host ""
Write-Host "  Presiona Ctrl+C para detener todos los tuneles." -ForegroundColor Yellow
Write-Host ""

# Mantener el script vivo hasta Ctrl+C
try {
    while ($true) { Start-Sleep -Seconds 10 }
} finally {
    Write-Host "`nDeteniendo tuneles..." -ForegroundColor Yellow
    if ($apiTunnelProc)   { Stop-Process -Id $apiTunnelProc.Id   -Force -ErrorAction SilentlyContinue }
    if ($frontTunnelProc) { Stop-Process -Id $frontTunnelProc.Id -Force -ErrorAction SilentlyContinue }
    if ($serveProc)       { Stop-Process -Id $serveProc.Id       -Force -ErrorAction SilentlyContinue }
    Write-Host "Tuneles detenidos." -ForegroundColor Green
}
