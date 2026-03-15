#!/usr/bin/env bash
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
ACR_NAME="${ACR_NAME:-mycustodianacr}"
AKS_CLUSTER="${AKS_CLUSTER:-my-aks-cluster}"
AKS_RG="${AKS_RG:-my-resource-group}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"

# ── 1. Build and push images ──────────────────────────────────────────────────
echo "▶ Logging into ACR: ${ACR_NAME}"
az acr login --name "${ACR_NAME}"

echo "▶ Building images (tag: ${IMAGE_TAG})"
docker build -t "${ACR_NAME}.azurecr.io/custodian-api:${IMAGE_TAG}"      ./backend -f ./backend/Dockerfile
docker build -t "${ACR_NAME}.azurecr.io/custodian-worker:${IMAGE_TAG}"   ./backend -f ./backend/Dockerfile.worker
docker build -t "${ACR_NAME}.azurecr.io/custodian-frontend:${IMAGE_TAG}" ./frontend

docker push "${ACR_NAME}.azurecr.io/custodian-api:${IMAGE_TAG}"
docker push "${ACR_NAME}.azurecr.io/custodian-worker:${IMAGE_TAG}"
docker push "${ACR_NAME}.azurecr.io/custodian-frontend:${IMAGE_TAG}"

# ── 2. AKS credentials ────────────────────────────────────────────────────────
echo "▶ Getting AKS credentials"
az aks get-credentials \
  --resource-group "${AKS_RG}" \
  --name "${AKS_CLUSTER}" \
  --overwrite-existing

# ── 3. KEDA ───────────────────────────────────────────────────────────────────
echo "▶ Installing / upgrading KEDA"
helm repo add kedacore https://kedacore.github.io/charts --force-update
helm upgrade --install keda kedacore/keda \
  --namespace keda --create-namespace \
  --set watchNamespace=custodian \
  --wait

# ── 4. Apply secrets ─────────────────────────────────────────────────────────
# Postgres connection details are built into the Secret template.
# Override POSTGRES_PASSWORD here if you change the StatefulSet default.
echo "▶ Creating namespace and applying secrets"
kubectl create namespace custodian --dry-run=client -o yaml | kubectl apply -f -

PG_PASS="${POSTGRES_PASSWORD:-custodian_secret}"
PG_HOST="postgres-svc.custodian.svc.cluster.local"
PG_USER="custodian"
PG_DB="custodian"

kubectl create secret generic custodian-secrets \
  --namespace custodian \
  --from-literal=DATABASE_URL="postgresql+asyncpg://${PG_USER}:${PG_PASS}@${PG_HOST}:5432/${PG_DB}" \
  --from-literal=CELERY_BROKER_URL="sqla+postgresql://${PG_USER}:${PG_PASS}@${PG_HOST}:5432/${PG_DB}" \
  --from-literal=CELERY_RESULT_BACKEND="db+postgresql://${PG_USER}:${PG_PASS}@${PG_HOST}:5432/${PG_DB}" \
  --from-literal=CELERY_BROKER_DSN="postgresql://${PG_USER}:${PG_PASS}@${PG_HOST}:5432/${PG_DB}" \
  --from-literal=SECRET_KEY="${SECRET_KEY:-$(openssl rand -hex 32)}" \
  --from-literal=AZURE_TENANT_ID="${AZURE_TENANT_ID:-}" \
  --from-literal=AZURE_CLIENT_ID="${AZURE_CLIENT_ID:-}" \
  --from-literal=AZURE_CLIENT_SECRET="${AZURE_CLIENT_SECRET:-}" \
  --dry-run=client -o yaml | kubectl apply -f -

# ── 5. Apply manifests ────────────────────────────────────────────────────────
echo "▶ Substituting image tags"
export ACR_NAME IMAGE_TAG
find k8s -name "*.yaml" | xargs -I{} sh -c 'envsubst < {} > {}.rendered && mv {}.rendered {}'

echo "▶ Applying manifests"
kubectl apply -k k8s/

# ── 6. Wait for rollout ───────────────────────────────────────────────────────
echo "▶ Waiting for API"
kubectl rollout status deployment/custodian-api -n custodian --timeout=180s
kubectl rollout status deployment/custodian-frontend -n custodian --timeout=120s

echo ""
echo "✅ Deployment complete."
echo ""
echo "   Broker  : PostgreSQL SQLAlchemy (kombu_message table)"
echo "   Backend : PostgreSQL (celery_taskmeta table)"
echo "   KEDA    : postgresql trigger on kombu_message row count"
echo "   Azure Storage Account: NOT REQUIRED"
echo ""
echo "   KEDA ScaledObjects:"
kubectl get scaledobjects -n custodian
echo ""
echo "   Pods (workers start at 0 replicas):"
kubectl get pods -n custodian
