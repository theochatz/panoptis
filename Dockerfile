# Azure Custodian Platform

A production-grade, AKS-native system for continuously identifying and remediating Azure cloud waste using Cloud Custodian policies executed at scale.

---

## Project structure

```
custodian-azure/
├── backend/                          # FastAPI + Celery application
│   ├── Dockerfile                    # API container image
│   ├── Dockerfile.worker             # Worker container image (shared by all 4 worker deployments)
│   ├── requirements.txt
│   └── app/
│       ├── main.py                   # FastAPI app, router wiring, DB init on startup
│       ├── api/
│       │   ├── policies.py           # GET/POST/PUT/DELETE/PATCH /api/policies
│       │   ├── runs.py               # GET /api/runs, POST /api/runs/trigger, DELETE cancel
│       │   ├── resources.py          # GET /api/resources, PATCH exempt
│       │   ├── analytics.py          # summary, by-category, by-subscription, by-severity, ladder, history
│       │   ├── actions.py            # GET/POST /api/actions
│       │   ├── subscriptions.py      # GET/POST/PATCH /api/subscriptions
│       │   └── health.py             # GET /health
│       ├── core/
│       │   └── database.py           # SQLAlchemy async models: Subscription, Policy, PolicyRun,
│       │                             #   WasteResource, RemediationAction
│       ├── workers/
│       │   └── tasks.py              # Celery tasks: run_policy, apply_remediation,
│       │                             #   trigger_scheduled_policies, advance_ladder
│       └── services/
│           └── azure_client.py       # Azure SDK: deallocate, delete, tag, resize, snapshot, tier-down
│
├── frontend/                         # React SPA
│   ├── Dockerfile                    # nginx-served production build
│   ├── nginx.conf
│   ├── package.json                  # Vite + React + Recharts + Zustand
│   └── src/
│       ├── main.jsx                  # Router entry point (7 pages)
│       ├── index.css                 # Design system (dark industrial theme)
│       ├── lib/api.js                # Axios client — all API calls
│       └── components/
│           ├── Layout.jsx            # Sidebar navigation
│           ├── dashboard/            # Dashboard (KPIs, charts, recent runs) + RunsPage
│           ├── policies/             # Policy CRUD with YAML editor + Test policy validator
│           ├── resources/            # Waste resources table + ActionsPage (remediation log)
│           ├── analytics/            # Full chart suite (6 charts)
│           └── settings/             # Subscription management + KEDA worker reference
│
├── k8s/                              # Kubernetes manifests (Kustomize)
│   ├── kustomization.yaml
│   ├── base/
│   │   ├── namespace-rbac.yaml       # Namespace, ServiceAccounts, RBAC
│   │   ├── configmap-secret.yaml     # ConfigMap + Secret template (fill before deploy)
│   │   ├── postgres.yaml             # PostgreSQL StatefulSet + headless Service
│   │   ├── api.yaml                  # API Deployment + Service + PodDisruptionBudget
│   │   ├── workers.yaml              # 4 worker Deployments (3 start at 0 replicas)
│   │   └── ingress-frontend.yaml     # Frontend Deployment + Ingress + outputs PVC
│   ├── keda/
│   │   └── scaled-objects.yaml       # KEDA ScaledObjects (azure-queue trigger) + API HPA
│   └── configmaps/
│       └── policies.yaml             # Built-in Cloud Custodian YAML policies (7 policies)
│
├── custodian-ui-standalone.html      # Fully self-contained UI — open in any browser to preview
├── docker-compose.dev.yml            # Local dev: Postgres + API only (no workers)
├── deploy.sh                         # Full AKS deploy script (provisions ASQ, builds images, applies k8s)
└── README.md
```

---

## Container images (3 custom)

| Image | Dockerfile | Deployments that use it |
|---|---|---|
| `custodian-api` | `backend/Dockerfile` | `custodian-api` (2–10 pods, HPA) |
| `custodian-worker` | `backend/Dockerfile.worker` | `worker-policy-runs`, `worker-remediation`, `worker-notifications`, `worker-beat` |
| `custodian-frontend` | `frontend/Dockerfile` | `custodian-frontend` (2 pods) |

All four worker Deployments use the **same image** differentiated only by the `command:` override in each Deployment spec. `worker-beat` always runs at 1 replica. The other three start at 0 and are scaled by KEDA.

---

## Architecture

```
AKS cluster (namespace: custodian)
│
├── custodian-frontend    nginx serving React SPA
│       │  REST
├── custodian-api         FastAPI  ──→  PostgreSQL StatefulSet
│       │  Celery .apply_async()
│       ▼
│   Azure Storage Queues (serverless)
│   ├── custodian-policy-runs
│   ├── custodian-remediation
│   └── custodian-notifications
│       │
│       │  KEDA ScaledObject polls queue depth every 15s
│       ▼
├── worker-policy-runs    0 → 20 pods  (custodian-worker image, -Q policy-runs)
├── worker-remediation    0 → 10 pods  (custodian-worker image, -Q remediation)
├── worker-notifications  0 → 5 pods   (custodian-worker image, -Q notifications)
└── worker-beat           1 pod always (custodian-worker image, celery beat)
```

**Broker:** Azure Storage Queues — no Redis, no always-on pod, no managed disk.
**Result backend:** PostgreSQL (`celery_taskmeta` table in the existing DB).
**KEDA trigger:** `azure-queue` type pointing at each ASQ queue. Workers scale to zero when idle.

---

## Quick start

### Preview the UI (no backend needed)
Open `custodian-ui-standalone.html` in any browser.

### Local development
```bash
# Starts Postgres + API on localhost:8000
# Interactive API docs at http://localhost:8000/docs
docker compose -f docker-compose.dev.yml up
```

### Deploy to AKS
```bash
# Set required environment variables
export ACR_NAME=mycustodianacr
export AKS_CLUSTER=my-aks
export AKS_RG=my-resource-group
export AZURE_TENANT_ID=...
export AZURE_CLIENT_ID=...
export AZURE_CLIENT_SECRET=...

# Run deploy script — provisions ASQ queues, builds + pushes images, applies all manifests
chmod +x deploy.sh
./deploy.sh
```

The deploy script:
1. Creates the Azure Storage Account and 3 queues
2. Builds and pushes all 3 custom images to ACR
3. Installs/upgrades KEDA via Helm
4. Patches the K8s Secret with real ASQ credentials
5. Applies all manifests via `kubectl apply -k k8s/`

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET/POST | `/api/subscriptions` | List / add Azure subscriptions |
| PATCH | `/api/subscriptions/{id}/toggle` | Enable / disable subscription |
| GET/POST/PUT/DELETE | `/api/policies` | Full policy CRUD |
| PATCH | `/api/policies/{id}/toggle` | Enable / disable policy |
| GET | `/api/runs` | List policy runs |
| POST | `/api/runs/trigger` | Fan-out: N policies × M subscriptions → KEDA scales workers |
| DELETE | `/api/runs/{id}/cancel` | Cancel a running policy |
| GET | `/api/resources` | List waste resources (filterable) |
| PATCH | `/api/resources/{id}/exempt` | Toggle exemption |
| GET | `/api/analytics/summary` | KPI totals |
| GET | `/api/analytics/by-category` | Waste breakdown by category |
| GET | `/api/analytics/by-subscription` | Waste breakdown by subscription |
| GET | `/api/analytics/by-severity` | Waste breakdown by severity |
| GET | `/api/analytics/ladder-breakdown` | Remediation ladder counts |
| GET | `/api/analytics/run-history` | Daily run history (configurable days) |
| GET/POST | `/api/actions` | List / trigger remediation actions |

---

## Remediation ladder

```
first seen → notify (tag + alert owner)
  ↓  grace period (default 72h, configurable per policy)
tagged  (custodian_status = pending-deletion)
  ↓  7 days
deallocated  (VM stopped — Azure billing for compute stops)
  ↓  7 days
deleted
```

Tag any resource `custodian_exempt=true` to exclude it from all ladder progression.
The `advance_ladder` Beat task runs every 6 hours and progresses eligible resources automatically.
