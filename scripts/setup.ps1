<#
.SYNOPSIS
    Despliega Casino VjF en un servidor Windows de produccion/staging.
.DESCRIPTION
    Idempotente: detecta el estado actual y solo aplica lo que falta.
    Realiza backup automatico antes de migrar si ya existen datos previos.
.PARAMETER SkipBackup
    Omite el backup previo (usar solo en primera instalacion limpia).
.PARAMETER Verbose
    Muestra output completo de cada comando Docker.
.EXAMPLE
    .\setup.ps1
    .\setup.ps1 -SkipBackup
    .\setup.ps1 -Verbose
#>
param(
    [switch]$SkipBackup,
    [switch]$Verbose
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Rutas ─────────────────────────────────────────────────────────────────────
$ProjectRoot  = Split-Path -Parent $PSScriptRoot
$BackupScript = Join-Path $PSScriptRoot "backup.ps1"
$EnvFile      = Join-Path $ProjectRoot ".env"
$InitSql      = Join-Path $ProjectRoot "casino_app\scripts\init_db.sql"

# ── Helpers ───────────────────────────────────────────────────────────────────
function Write-Step { param([string]$Msg) Write-Host "`n[....] $Msg" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Msg) Write-Host "[ OK ] $Msg" -ForegroundColor Green }
function Write-Warn { param([string]$Msg) Write-Host "[WARN] $Msg" -ForegroundColor Yellow }
function Write-Fail { param([string]$Msg) Write-Host "[FAIL] $Msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "=================================================" -ForegroundColor Magenta
Write-Host "   Casino VjF -- Script de despliegue           " -ForegroundColor Magenta
Write-Host "=================================================" -ForegroundColor Magenta
Write-Host "  Fecha   : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "  Proyecto: $ProjectRoot"
Write-Host ""

# ── Step 1: Verificar Docker ──────────────────────────────────────────────────
Write-Step "Verificando Docker..."
try {
    $dockerVer  = docker --version 2>&1
    $composeVer = docker compose version 2>&1
} catch {
    Write-Fail "Docker no encontrado o no esta corriendo. Asegurate de que Docker Desktop este activo."
}
Write-Ok "Docker:         $dockerVer"
Write-Ok "Docker Compose: $composeVer"

# ── Step 2: Validar .env ──────────────────────────────────────────────────────
Write-Step "Validando variables de entorno (.env)..."
if (-not (Test-Path $EnvFile)) { Write-Fail ".env no encontrado en $ProjectRoot" }

$EnvVars = @{}
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match "^\s*([^#][^=]*?)\s*=\s*(.*)\s*$") {
        $EnvVars[$Matches[1]] = $Matches[2]
    }
}
$Required = @("DB_USER", "DB_PASSWORD", "DB_NAME")
$Missing  = @($Required | Where-Object { -not $EnvVars.ContainsKey($_) -or [string]::IsNullOrWhiteSpace($EnvVars[$_]) })
if ($Missing.Count -gt 0) {
    Write-Fail "Variables faltantes en .env: $($Missing -join ', ')"
}
Write-Ok "Variables requeridas presentes: $($Required -join ', ')"

$DbUser = $EnvVars["DB_USER"]
$DbName = $EnvVars["DB_NAME"]

# ── Step 3: Backup condicional ────────────────────────────────────────────────
if (-not $SkipBackup) {
    Write-Step "Verificando si existen datos previos..."
    $VolumeExists = docker volume ls --format "{{.Name}}" 2>$null | Where-Object { $_ -eq "todovjf_postgres_data" }
    if ($VolumeExists) {
        Write-Host "[INFO] Volumen postgres_data detectado. Ejecutando backup de seguridad..." -ForegroundColor Yellow
        & $BackupScript -Keep 7
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "El backup fallo. Deploy abortado para proteger los datos."
        }
    } else {
        Write-Ok "No hay datos previos. Se omite el backup."
    }
} else {
    Write-Warn "Flag -SkipBackup activo. Se omite el backup."
}

# ── Step 4: docker compose up ─────────────────────────────────────────────────
Write-Step "Levantando infraestructura (docker compose up -d --build)..."
Push-Location $ProjectRoot
try {
    if ($Verbose) {
        docker compose up -d --build
    } else {
        docker compose up -d --build 2>&1 | Out-Null
    }
    if ($LASTEXITCODE -ne 0) { Write-Fail "docker compose up fallo." }
} finally {
    Pop-Location
}
Write-Ok "Contenedores iniciados."

# ── Step 5: Esperar healthcheck de db ────────────────────────────────────────
Write-Step "Esperando que PostgreSQL este saludable (max 60s)..."
$Timeout = 60
$Elapsed = 0
do {
    Start-Sleep -Seconds 2
    $Elapsed += 2
    $Health = docker inspect --format "{{.State.Health.Status}}" todovjf-db-1 2>$null
    Write-Host "   [$Elapsed s] Estado: $Health   " -NoNewline
    Write-Host "`r" -NoNewline
} while ($Health -ne "healthy" -and $Elapsed -lt $Timeout)

Write-Host ""
if ($Health -ne "healthy") {
    Write-Fail "La base de datos no alcanzo estado healthy en ${Timeout}s. Revisa: docker compose logs db"
}
Write-Ok "PostgreSQL healthy."

# ── Step 6: Init schema (idempotente) ────────────────────────────────────────
Write-Step "Verificando schema 'casino'..."
$SchemaExists = docker exec todovjf-db-1 psql -U $DbUser -d $DbName -tAc "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'casino';" 2>$null
if ($SchemaExists) { $SchemaExists = $SchemaExists.Trim() }

if ($SchemaExists -ne "1") {
    Write-Host "[INFO] Schema 'casino' no encontrado. Ejecutando init_db.sql..." -ForegroundColor Yellow
    if (-not (Test-Path $InitSql)) { Write-Fail "No se encontro $InitSql" }
    Get-Content $InitSql | docker exec -i todovjf-db-1 psql -U $DbUser -d $DbName 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Fail "init_db.sql fallo." }
    Write-Ok "Schema 'casino' inicializado."
} else {
    Write-Ok "Schema 'casino' ya existe. Se omite init_db.sql."
}

# ── Step 7: Alembic migrations ───────────────────────────────────────────────
Write-Step "Ejecutando migraciones Alembic..."
docker exec todovjf-api-1 alembic upgrade head
if ($LASTEXITCODE -ne 0) { Write-Fail "alembic upgrade head fallo." }
Write-Ok "Migraciones aplicadas."

# ── Step 8: Smoke test ───────────────────────────────────────────────────────
Write-Step "Smoke test: GET /health..."
$ApiOk = $false
for ($i = 1; $i -le 5; $i++) {
    Start-Sleep -Seconds 2
    try {
        $Resp = Invoke-RestMethod -Uri "http://localhost:8000/health" -TimeoutSec 5
        if ($Resp.status -eq "ok") { $ApiOk = $true; break }
    } catch { }
}

Write-Host ""
Write-Host "=================================================" -ForegroundColor Magenta
if ($ApiOk) {
    Write-Host "   DEPLOY COMPLETADO EXITOSAMENTE              " -ForegroundColor Green
} else {
    Write-Host "   DEPLOY COMPLETADO (API aun iniciando)       " -ForegroundColor Yellow
}
Write-Host "=================================================" -ForegroundColor Magenta
Write-Host "  API     : http://localhost:8000"
Write-Host "  Swagger : http://localhost:8000/docs"
Write-Host ""
if (-not $ApiOk) {
    Write-Warn "La API no respondio a /health en 10s. Verifica con: docker compose logs -f api"
}
exit 0
