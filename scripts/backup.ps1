<#
.SYNOPSIS
    Backup de PostgreSQL para Casino VjF.
.DESCRIPTION
    Genera un dump comprimido (.sql.gz) de la base de datos dentro del
    contenedor todovjf-db-1. Elimina backups antiguos conservando los
    últimos -Keep archivos.
.PARAMETER Keep
    Número de backups a retener. Default: 7.
.PARAMETER OutputDir
    Directorio de destino. Default: .\backups (relativo a la raíz del proyecto).
.EXAMPLE
    .\backup.ps1
    .\backup.ps1 -Keep 30
    .\backup.ps1 -OutputDir "D:\backups\casino"
#>
param(
    [int]$Keep = 7,
    [string]$OutputDir = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Rutas ─────────────────────────────────────────────────────────────────────
$ProjectRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    $OutputDir = Join-Path $ProjectRoot "backups"
}

# ── Helpers ───────────────────────────────────────────────────────────────────
function Write-Step { param([string]$Msg) Write-Host "[....] $Msg" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Msg) Write-Host "[ OK ] $Msg" -ForegroundColor Green }
function Write-Fail { param([string]$Msg) Write-Host "[FAIL] $Msg" -ForegroundColor Red; exit 1 }

# ── Leer .env ─────────────────────────────────────────────────────────────────
$EnvFile = Join-Path $ProjectRoot ".env"
if (-not (Test-Path $EnvFile)) { Write-Fail ".env no encontrado en $ProjectRoot" }

$EnvVars = @{}
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match "^\s*([^#][^=]*?)\s*=\s*(.*)\s*$") {
        $EnvVars[$Matches[1]] = $Matches[2]
    }
}
$DbUser = $EnvVars["DB_USER"]
$DbName = $EnvVars["DB_NAME"]

if ([string]::IsNullOrWhiteSpace($DbUser) -or [string]::IsNullOrWhiteSpace($DbName)) {
    Write-Fail "DB_USER o DB_NAME no definidos en .env"
}

# ── Step 1: Validar contenedor ────────────────────────────────────────────────
Write-Step "Verificando contenedor todovjf-db-1..."
$running = docker inspect --format "{{.State.Running}}" casino-vjf-db-1 2>$null
if ($running -ne "true") { Write-Fail "El contenedor casino-vjf-db-1 no esta corriendo." }
Write-Ok "Contenedor activo."

# ── Step 2: Crear directorio ──────────────────────────────────────────────────
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
    Write-Ok "Directorio creado: $OutputDir"
}

# ── Step 3: Generar nombre y ejecutar pg_dump ─────────────────────────────────
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$Filename  = "$Timestamp.sql.gz"
$Filepath  = Join-Path $OutputDir $Filename

Write-Step "Ejecutando pg_dump -> $Filename ..."
docker exec casino-vjf-db-1 sh -c "pg_dump -U $DbUser $DbName | gzip" | Set-Content -Path $Filepath -Encoding Byte
if ($LASTEXITCODE -ne 0) { Write-Fail "pg_dump fallo (exit $LASTEXITCODE)." }

# ── Step 4: Verificar integridad ──────────────────────────────────────────────
$FileSize = (Get-Item $Filepath).Length
if ($FileSize -eq 0) {
    Remove-Item $Filepath -Force
    Write-Fail "El archivo de backup esta vacio. Se elimino."
}
$FileSizeKb = [Math]::Round($FileSize / 1KB, 1)
Write-Ok "Backup generado: $Filepath ($FileSizeKb KB)"

# ── Step 5: Retención ─────────────────────────────────────────────────────────
$AllBackups = Get-ChildItem $OutputDir -Filter "*.sql.gz" | Sort-Object LastWriteTime -Descending
if ($AllBackups.Count -gt $Keep) {
    $ToDelete = $AllBackups | Select-Object -Skip $Keep
    $ToDelete | Remove-Item -Force
    Write-Ok "Retencion aplicada: se eliminaron $($ToDelete.Count) backup(s) antiguo(s). Se conservan $Keep."
}

Write-Host ""
Write-Host "  Backup completado exitosamente." -ForegroundColor Green
Write-Host "  Archivo : $Filepath"
Write-Host "  Tamano  : $FileSizeKb KB"
Write-Host "  Total   : $([Math]::Min($AllBackups.Count, $Keep)) backup(s) retenidos en $OutputDir"
Write-Host ""
exit 0
