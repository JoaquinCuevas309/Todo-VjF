# Design Spec: DevOps Setup & Documentation — Casino VjF

**Date:** 2026-06-03
**Status:** Approved
**Scope:** Automation scripts + professional README for production deployment on Windows

---

## 1. Context

Sistema crítico de casino con transacciones financieras. Stack: FastAPI + PostgreSQL 15 + Docker.
La seguridad e integridad de los datos son la prioridad absoluta.
El script será ejecutado por un equipo de ops en un servidor Windows de producción/staging.

---

## 2. Approach

**Modular scripts + orquestador** (Approach B — aprobado por el usuario):

```
scripts/
├── setup.ps1     ← orquestador principal de despliegue
└── backup.ps1    ← backup independiente bajo demanda
README.md         ← documentación técnica profesional
```

Descartados:
- Monolítico: difícil de mantener
- Config file extra: sobre-engineered, `.env` ya centraliza la config

---

## 3. `setup.ps1` — Spec

### Flags
| Flag | Comportamiento |
|---|---|
| *(ninguno)* | Ejecución normal completa |
| `-SkipBackup` | Omite el backup previo (primera instalación limpia) |
| `-Verbose` | Muestra output completo de cada comando |

### Pasos (en orden, todos idempotentes)

1. **Verificar Docker** — `docker --version` + `docker compose version`. Exit con mensaje claro si falta.
2. **Validar `.env` raíz** — Verifica que `DB_USER`, `DB_PASSWORD`, `DB_NAME` existan y no estén vacíos. Exit listando vars faltantes.
3. **Backup condicional** — Si el volumen `postgres_data` ya existe, llama `backup.ps1` automáticamente. Si el backup falla (exit code ≠ 0), aborta el deploy.
4. **`docker compose up -d --build`** — Levanta infraestructura. Exit si compose falla.
5. **Esperar healthcheck de `db`** — Polling hasta 60 s. Timeout con error descriptivo.
6. **Init schema (idempotente)** — Consulta si el schema `casino` existe. Solo ejecuta `init_db.sql` si no existe. No re-ejecuta en deploys subsecuentes.
7. **Alembic migrations** — `docker exec todovjf-api-1 alembic upgrade head`. Exit si falla.
8. **Smoke test** — GET `/health` → espera `{"status":"ok"}`. Warning (no exit) si no responde en 10 s.

### Error handling
- Cada paso lleva `Write-Host` con prefijo `[OK]`, `[WARN]`, `[ERROR]`
- Cualquier error crítico (pasos 1–7) invoca `exit 1`
- El paso 8 es solo informativo — la API puede tardar en arrancar

---

## 4. `backup.ps1` — Spec

### Flags
| Flag | Default | Descripción |
|---|---|---|
| `-Keep` | `7` | Número de backups a retener |
| `-OutputDir` | `.\backups` | Directorio de destino |

### Pasos

1. **Validar contenedor** — Verifica que `todovjf-db-1` esté corriendo.
2. **Crear directorio** — `.\backups\` si no existe.
3. **pg_dump** — Ejecuta dentro del contenedor, comprime con gzip. Nombre: `YYYY-MM-DD_HH-mm.sql.gz`.
4. **Verificar integridad** — Comprueba que el archivo pese > 0 bytes.
5. **Retención** — Ordena backups por fecha, elimina los más viejos conservando los últimos `-Keep`.
6. **Reporte** — Imprime ruta del archivo y tamaño.

### Exit codes
- `0` → backup exitoso
- `1` → contenedor no disponible, dump vacío, o error de escritura

---

## 5. `README.md` — Estructura

```
1. Descripción del sistema
2. Arquitectura
   └── Diagrama Mermaid (Frontend → API → DB → Volume)
3. Requisitos previos
4. Guía de despliegue
   ├── Primera instalación
   └── Re-deploy / actualización
5. Variables de entorno (tabla + ejemplo)
6. Mantenimiento
   ├── Logs
   ├── Backup bajo demanda
   ├── Restore
   └── Actualizar dependencias
7. Seguridad e integridad de datos
   ├── Volúmenes Docker
   ├── Política de backups
   └── Acceso mínimo privilegio
8. Troubleshooting
```

---

## 6. Persistencia de datos

- Volumen Docker `postgres_data` mapeado a `/var/lib/postgresql/data`
- Directorio `./backups/` en el host (fuera de contenedores)
- `docker compose down` NO destruye el volumen (requiere `-v` explícito)
- El `setup.ps1` documenta este comportamiento explícitamente

---

## 7. Out of scope

- Scripts para Linux/Mac
- Integración con CI/CD pipeline
- Notificaciones automáticas de backup (email, Slack)
- Encriptación de backups en reposo
