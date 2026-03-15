import os, logging
from azure.identity import DefaultAzureCredential, ClientSecretCredential
from azure.mgmt.compute import ComputeManagementClient
from azure.mgmt.resource import ResourceManagementClient
from azure.mgmt.network import NetworkManagementClient
from azure.mgmt.storage import StorageManagementClient

logger = logging.getLogger(__name__)

def _get_credential():
    client_id = os.getenv("AZURE_CLIENT_ID")
    client_secret = os.getenv("AZURE_CLIENT_SECRET")
    tenant_id = os.getenv("AZURE_TENANT_ID")
    if client_id and client_secret and tenant_id:
        return ClientSecretCredential(tenant_id, client_id, client_secret)
    return DefaultAzureCredential()

def _parse_resource_id(resource_id: str) -> dict:
    parts = resource_id.lower().split("/")
    result = {}
    for i, part in enumerate(parts):
        if part == "subscriptions" and i + 1 < len(parts):
            result["subscription"] = parts[i + 1]
        elif part == "resourcegroups" and i + 1 < len(parts):
            result["resource_group"] = parts[i + 1]
        elif part in ("virtualmachines", "disks", "publicipaddresses", "storageaccounts"):
            result["type"] = part
            if i + 1 < len(parts):
                result["name"] = parts[i + 1]
    return result

class AzureRemediation:
    def __init__(self, subscription_id: str):
        self.subscription_id = subscription_id
        self.credential = _get_credential()
        self._compute = None
        self._network = None
        self._storage = None
        self._resource = None

    @property
    def compute(self):
        if not self._compute:
            self._compute = ComputeManagementClient(self.credential, self.subscription_id)
        return self._compute

    @property
    def network(self):
        if not self._network:
            self._network = NetworkManagementClient(self.credential, self.subscription_id)
        return self._network

    @property
    def storage(self):
        if not self._storage:
            self._storage = StorageManagementClient(self.credential, self.subscription_id)
        return self._storage

    @property
    def resource(self):
        if not self._resource:
            self._resource = ResourceManagementClient(self.credential, self.subscription_id)
        return self._resource

    def execute(self, action_type: str, resource_id: str) -> dict:
        parsed = _parse_resource_id(resource_id)
        rg = parsed.get("resource_group")
        name = parsed.get("name")
        rtype = parsed.get("type")
        logger.info(f"Executing {action_type} on {name} (rg={rg}, type={rtype})")
        handler = {
            "deallocate": self._deallocate_vm,
            "delete": self._delete_resource,
            "tag": self._tag_for_deletion,
            "snapshot": self._snapshot_disk,
            "tier_down": self._tier_down_storage,
            "resize": self._resize_vm,
        }.get(action_type)
        if not handler:
            raise ValueError(f"Unknown action: {action_type}")
        return handler(resource_id, rg, name, rtype)

    def _deallocate_vm(self, resource_id, rg, name, rtype):
        poller = self.compute.virtual_machines.begin_deallocate(rg, name)
        poller.result(timeout=300)
        return {"action": "deallocated", "vm": name}

    def _delete_resource(self, resource_id, rg, name, rtype):
        # Generic delete via resource client
        poller = self.resource.resources.begin_delete_by_id(resource_id, api_version="2023-07-01")
        poller.result(timeout=300)
        return {"action": "deleted", "resource": name}

    def _tag_for_deletion(self, resource_id, rg, name, rtype):
        from datetime import datetime, timedelta
        deletion_date = (datetime.utcnow() + timedelta(days=7)).strftime("%Y-%m-%d")
        self.resource.tags.begin_update_at_scope(
            resource_id,
            {"operation": "Merge", "properties": {"tags": {
                "custodian_status": "pending-deletion",
                "custodian_deletion_date": deletion_date,
            }}},
        ).result()
        return {"action": "tagged", "deletion_date": deletion_date}

    def _snapshot_disk(self, resource_id, rg, name, rtype):
        from azure.mgmt.compute.models import Snapshot, CreationData, DiskCreateOption
        snap_name = f"{name}-custodian-snap"
        self.compute.snapshots.begin_create_or_update(rg, snap_name, Snapshot(
            location=self.compute.disks.get(rg, name).location,
            creation_data=CreationData(
                create_option=DiskCreateOption.COPY,
                source_resource_id=resource_id,
            ),
        )).result(timeout=300)
        return {"action": "snapshotted", "snapshot_name": snap_name}

    def _tier_down_storage(self, resource_id, rg, name, rtype):
        account = self.storage.storage_accounts.get_properties(rg, name)
        self.storage.storage_accounts.update(rg, name, {"access_tier": "Cool"})
        return {"action": "tiered_down", "tier": "Cool"}

    def _resize_vm(self, resource_id, rg, name, rtype, new_size: str = "Standard_B2s"):
        from azure.mgmt.compute.models import VirtualMachineUpdate, HardwareProfile
        self.compute.virtual_machines.begin_update(
            rg, name,
            VirtualMachineUpdate(hardware_profile=HardwareProfile(vm_size=new_size))
        ).result(timeout=300)
        return {"action": "resized", "new_size": new_size}
