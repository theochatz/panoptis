FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl git libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /outputs /policies

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV C_FORCE_ROOT=1

# Default: policy-run worker. Override CMD in K8s for beat, notifications, remediation
CMD ["celery", "-A", "app.workers.tasks.celery_app", "worker", \
     "--loglevel=info", "--concurrency=4", "-Q", "policy-runs"]
