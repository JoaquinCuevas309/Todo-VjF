# Guía de configuración del entorno

Pasos para levantar el proyecto **Casino VjF** en una máquina nueva.

---

## Requisitos previos

| Herramienta | Versión mínima | Notas |
|---|---|---|
| Docker Desktop | 4.x | Debe estar corriendo antes de levantar contenedores |
| WSL 2 | 2.7+ | `wsl --update` si Docker Desktop lo solicita |
| Git | cualquiera | Para clonar el repo |

---

## 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd "Todo VjF"
```

---

## 2. Crear el archivo `.env` raíz

Este archivo es leído por `docker-compose.yml` para configurar el contenedor de PostgreSQL.
**No se commitea** (está en `.gitignore`).

Crea el archivo `.env` en la raíz del proyecto con este contenido:

```env
DB_USER=casino_app
DB_PASSWORD=<contraseña-segura>
DB_NAME=casino_db
```

> El archivo `casino_app/.env` contiene las variables adicionales que necesita la API (JWT, timeouts, etc.). Revísalo y ajusta los valores si es necesario.

---

## 3. Configurar PostgreSQL local (solo si usas Postgres fuera de Docker)

Si en algún equipo necesitas conectarte a un PostgreSQL instalado localmente en lugar del contenedor:

1. En `postgresql.conf` asegúrate de tener:
   ```
   listen_addresses = '*'
   ```
2. En `pg_hba.conf` agrega la regla:
   ```
   host  all  all  0.0.0.0/0  scram-sha-256
   ```
3. Abre el puerto 5432 en el firewall de Windows (entrada TCP).
4. Reinicia el servicio PostgreSQL.

> En el flujo normal con Docker esto **no es necesario** — el contenedor `db` maneja todo.

---

## 4. Levantar los contenedores

```bash
docker compose up -d
```

La primera vez descarga la imagen `postgres:15-alpine` y construye la imagen de la API (~1-2 min).

Verifica que ambos contenedores estén corriendo:

```bash
docker compose ps
```

Resultado esperado:

```
NAME            STATUS
todovjf-api-1   Up
todovjf-db-1    Up (healthy)
```

---

## 5. Inicializar el schema de la base de datos

> **Solo la primera vez** en una base de datos vacía.

El schema, tablas, tipos ENUM, índices y triggers se crean con:

```bash
docker exec -i todovjf-db-1 psql -U casino_app -d casino_db < casino_app/scripts/init_db.sql
```

Luego reinicia la API para que Alembic aplique las migraciones:

```bash
docker restart todovjf-api-1
```

---

## 6. Verificar que todo funciona

```bash
curl http://localhost:8000/health
# {"status": "ok"}
```

Swagger UI disponible en: **http://localhost:8000/docs**

---

## Comandos útiles

```bash
# Ver logs en tiempo real
docker compose logs -f api

# Detener todo
docker compose down

# Detener y borrar la base de datos (volumen)
docker compose down -v

# Reconstruir la imagen de la API (tras cambios en requirements.txt)
docker compose build api
docker compose up -d
```

---

## Estructura del proyecto

```
Todo VjF/
├── casino_app/          # Backend FastAPI + Alembic
│   ├── app/             # Código fuente
│   ├── alembic/         # Migraciones de BD
│   ├── scripts/
│   │   └── init_db.sql  # Schema inicial (ejecutar una sola vez)
│   ├── .env             # Variables de entorno de la API (no commitear)
│   └── Dockerfile
├── casino_frontend/     # Frontend React + Vite + Tailwind
├── docker-compose.yml
└── .env                 # Variables para docker-compose (no commitear)
```
