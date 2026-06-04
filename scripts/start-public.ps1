<#
.SYNOPSIS
    Expone Casino VjF publicamente via Cloudflare Quick Tunnels.
.DESCRIPTION
    Orden correcto:
    1. Obtiene URL del tunel de la API
    2. Obtiene URL del tunel del frontend (antes de servir, CF espera)
    3. Actualiza CORS con la URL del frontend
    4. Buildea el frontend con la URL de la API
    5. Sirve el frontend en :3000
    6. Reinicia la API para aplicar el nuevo CORS
.EXAMPLE
    .\scripts\start-public.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$ProjectRoot  = Split-Path -Parent $PSScriptRoot
$FrontendDir  = Join-Path $ProjectRoot "casino_frontend"
$FrontendEnv  = Join-Path $FrontendDir ".env"
$AppEnvFile   = Join-Path $ProjectRoot "casino_app\.env"
$ApiLogFile   = Join-Path $env:TEMP "casino-api-tunnel.log"
$FrontLogFile = Join-Path $env:TEMP "casino-front-tunnel.log"

function Write-Step { param([string]$Msg) Write-Host "`n[....] $Msg" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Msg) Write-Host "[ OK ] $Msg" -ForegroundColor Green }
function Write-Fail { param([string]$Msg) Write-Host "[FAIL] $Msg" -ForegroundColor Red; exit 1 }

function Get-TunnelUrl {
    param([string]$LogFile, [int]$TimeoutSec = 30)
    $elapsed = 0
    while ($elapsed -lt $TimeoutSec) {
        Start-Sleep -Seconds 1; $elapsed++
        if (Test-Path $LogFile) {
            $match = Select-String -Path $LogFile -Pattern "https://[a-z0-9\-]+\.trycloudflare\.com" -AllMatches
            if ($match) { return $match.Matches[0].Value }
        }
    }
    return $null
}

Write-Host ""
Write-Host "=================================================" -ForegroundColor Magenta
Write-Host "   Casino VjF -- Inicio publico                 " -ForegroundColor Magenta
Write-Host "=================================================" -ForegroundColor Magenta

# ── Step 1: Verificar contenedores ───────────────────────────────────────────
Write-Step "Verificando contenedores..."
$containers = @(docker ps --format "{{.Names}}" 2>$null)
$apiName    = $containers | Where-Object { $_ -match "api-1" } | Select-Object -First 1
if (-not $apiName) { Write-Fail "Contenedor API no encontrado. Ejecuta primero: .\scripts\setup.ps1 -SkipBackup" }
Write-Ok "API: $apiName"

# ── Step 2: Tunel de la API ───────────────────────────────────────────────────
Write-Step "Iniciando tunel de la API..."
if (Test-Path $ApiLogFile) { Remove-Item $ApiLogFile -Force }
$apiTunnelProc = Start-Process "cloudflared" -ArgumentList "tunnel --url http://localhost:8000" `
    -RedirectStandardError $ApiLogFile -PassThru -NoNewWindow
$apiUrl = Get-TunnelUrl -LogFile $ApiLogFile
if (-not $apiUrl) { Write-Fail "No se pudo obtener la URL del tunel de la API." }
Write-Ok "API publica: $apiUrl"

# ── Step 3: Tunel del frontend (antes de servir — CF espera hasta que :3000 este listo) ──
Write-Step "Iniciando tunel del frontend..."
if (Test-Path $FrontLogFile) { Remove-Item $FrontLogFile -Force }
$frontTunnelProc = Start-Process "cloudflared" -ArgumentList "tunnel --url http://localhost:3000" `
    -RedirectStandardError $FrontLogFile -PassThru -NoNewWindow
$frontUrl = Get-TunnelUrl -LogFile $FrontLogFile
if (-not $frontUrl) { Write-Fail "No se pudo obtener la URL del tunel del frontend." }
Write-Ok "Frontend publico: $frontUrl"

# ── Step 4: Actualizar CORS con la URL del FRONTEND ──────────────────────────
Write-Step "Configurando CORS (origen: $frontUrl)..."
$envContent  = Get-Content $AppEnvFile | Where-Object { $_ -notmatch "^CORS_ORIGINS" }
$envContent += "CORS_ORIGINS=$frontUrl,http://localhost:5173,http://localhost:3000"
$envContent  | Set-Content $AppEnvFile
Write-Ok "CORS actualizado."

# ── Step 5: Build del frontend con URL de la API ──────────────────────────────
Write-Step "Buildeando frontend con API: $apiUrl/api/v1 ..."
"VITE_API_URL=$apiUrl/api/v1" | Set-Content $FrontendEnv
Push-Location $FrontendDir
try { $null = npx vite build 2>&1 } catch { }
$buildExit = $LASTEXITCODE
Pop-Location
if ($buildExit -ne 0) { Write-Fail "vite build fallo." }
Write-Ok "Frontend buildeado."

# ── Step 6: Servir frontend en :3000 ──────────────────────────────────────────
Write-Step "Iniciando servidor frontend en :3000..."
$serveProc = Start-Process "cmd" -ArgumentList "/c npx serve dist -l 3000 --single" `
    -WorkingDirectory $FrontendDir -PassThru -NoNewWindow
Start-Sleep -Seconds 2
Write-Ok "Frontend sirviendo en localhost:3000"

# ── Step 7: Reiniciar API para aplicar nuevo CORS ────────────────────────────
Write-Step "Reiniciando API con nuevo CORS..."
$null = docker restart $apiName 2>&1
Start-Sleep -Seconds 4
Write-Ok "API reiniciada."

# ── Resumen ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=================================================" -ForegroundColor Magenta
Write-Host "   SISTEMA PUBLICO ACTIVO                       " -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Magenta
Write-Host "  Frontend : $frontUrl" -ForegroundColor Green
Write-Host "  API      : $apiUrl" -ForegroundColor Green
Write-Host "  Swagger  : $apiUrl/docs" -ForegroundColor Green
Write-Host ""
Write-Host "  Presiona Ctrl+C para detener todo." -ForegroundColor Yellow
Write-Host ""

try {
    while ($true) { Start-Sleep -Seconds 10 }
} finally {
    Write-Host "`nDeteniendo servicios..." -ForegroundColor Yellow
    if ($apiTunnelProc)   { Stop-Process -Id $apiTunnelProc.Id   -Force -ErrorAction SilentlyContinue }
    if ($frontTunnelProc) { Stop-Process -Id $frontTunnelProc.Id -Force -ErrorAction SilentlyContinue }
    if ($serveProc)       { Stop-Process -Id $serveProc.Id       -Force -ErrorAction SilentlyContinue }
    Write-Host "Todo detenido." -ForegroundColor Green
}
