# Local development only — not for production.
# Starts Postgres + the API so you can test all endpoints locally.
# Workers are NOT started here (they need Azure Storage Queues).
# Run: docker compose -f docker-compose.dev.yml up
version: "3.9"
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: custodian
      POSTGRES_USER: custodian
      POSTGRES_PASSWORD: custodian_secret
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U custodian"]
      interval: 5s
      retries: 10

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql+asyncpg://custodian:custodian_secret@postgres:5432/custodian
      CELERY_RESULT_BACKEND: db+postgresql://custodian:custodian_secret@postgres:5432/custodian
      # ASQ broker — set these to your real storage account for full testing,
      # or leave blank and the API will start without worker dispatch working.
      CELERY_BROKER_URL: ${CELERY_BROKER_URL:-azurestoragequeues://devaccount:devkey@}
      AZURE_STORAGE_ACCOUNT_NAME: ${AZURE_STORAGE_ACCOUNT_NAME:-}
      AZURE_STORAGE_ACCOUNT_KEY: ${AZURE_STORAGE_ACCOUNT_KEY:-}
      AZURE_TENANT_ID: ${AZURE_TENANT_ID:-}
      AZURE_CLIENT_ID: ${AZURE_CLIENT_ID:-}
      AZURE_CLIENT_SECRET: ${AZURE_CLIENT_SECRET:-}
      SECRET_KEY: dev-only-secret
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - ./backend:/app
