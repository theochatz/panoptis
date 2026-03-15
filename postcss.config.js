"""
Unit tests for tasks.py — pure Python, no DB, no subprocess, no Azure.

All external calls (psycopg2, subprocess, azure SDK) are mocked at the
boundary. These tests verify business logic only.
"""

from __future__ import annotations

import json
import os
import tempfile
import uuid
from pathlib import Path
from unittest.mock import MagicMock, call, patch

import pytest


# ── _estimate_cost ────────────────────────────────────────────────────────────

class TestEstimateCost:
    """_estimate_cost maps resource types to approximate monthly GBP costs."""

    def _cost(self, resource: dict, rtype: str) -> float:
        from app.workers.tasks import _estimate_cost
        return _estimate_cost(resource, rtype)

    def test_known_vm_sku(self):
        r = {"properties": {"hardwareProfile": {"vmSize": "Standard_D4s_v3"}}}
        assert self._cost(r, "Microsoft.Compute/virtualMachines") == 192

    def test_unknown_vm_sku_returns_default(self):
        r = {"properties": {"hardwareProfile": {"vmSize": "Unknown_SKU"}}}
        assert self._cost(r, "Microsoft.Compute/virtualMachines") == 80.0

    def test_disk_cost_based_on_size(self):
        r = {"properties": {"diskSizeGB": 200}}
        assert self._cost(r, "Microsoft.Compute/disks") == pytest.approx(10.0)

    def test_disk_missing_size_uses_default_128gb(self):
        assert self._cost({}, "Microsoft.Compute/disks") == pytest.approx(6.4)

    def test_public_ip(self):
        assert self._cost({}, "Microsoft.Network/publicIPAddresses") == pytest.approx(3.65)

    def test_sql_database(self):
        assert self._cost({}, "Microsoft.Sql/servers/databases") == 150.0

    def test_storage_account(self):
        assert self._cost({}, "Microsoft.Storage/storageAccounts") == 12.0

    def test_app_service_plan(self):
        assert self._cost({}, "Microsoft.Web/serverFarms") == 80.0

    def test_unknown_resource_type_returns_default(self):
        assert self._cost({}, "Microsoft.Unknown/thing") == 20.0

    def test_empty_resource_type(self):
        assert self._cost({}, "") == 20.0

    def test_none_safe_properties(self):
        """Resource with None properties dict should not raise."""
        r = {"properties": None}
        cost = self._cost(r, "Microsoft.Compute/virtualMachines")
        assert cost == 80.0  # falls back to default


# ── _write_accounts_file ──────────────────────────────────────────────────────

class TestWriteAccountsFile:
    """_write_accounts_file generates valid c7n-org accounts.yml."""

    def test_writes_correct_structure(self, tmp_path):
        import yaml
        from app.workers.tasks import _write_accounts_file

        subs = [
            {"name": "Prod", "subscription_id": "aaa-111", "tenant_id": "ttt-000", "environment": "production"},
            {"name": "Dev",  "subscription_id": "bbb-222", "tenant_id": "ttt-000", "environment": ""},
        ]
        path = str(tmp_path / "accounts.yml")
        _write_accounts_file(subs, path)

        with open(path) as f:
            data = yaml.safe_load(f)

        assert "accounts" in data
        assert len(data["accounts"]) == 2
        assert data["accounts"][0]["name"] == "Prod"
        assert data["accounts"][0]["subscription_id"] == "aaa-111"
        assert data["accounts"][0]["tenant_id"] == "ttt-000"
        assert data["accounts"][0]["tags"] == ["production"]

    def test_no_environment_tag_when_empty(self, tmp_path):
        import yaml
        from app.workers.tasks import _write_accounts_file

        subs = [{"name": "Dev", "subscription_id": "x", "tenant_id": "y", "environment": ""}]
        path = str(tmp_path / "accounts.yml")
        _write_accounts_file(subs, path)

        with open(path) as f:
            data = yaml.safe_load(f)

        assert "tags" not in data["accounts"][0]

    def test_empty_subscriptions_writes_empty_list(self, tmp_path):
        import yaml
        from app.workers.tasks import _write_accounts_file

        path = str(tmp_path / "accounts.yml")
        _write_accounts_file([], path)

        with open(path) as f:
            data = yaml.safe_load(f)
        assert data["accounts"] == []


# ── _write_policy_files ───────────────────────────────────────────────────────

class TestWritePolicyFiles:
    def test_writes_one_file_per_policy(self, tmp_path):
        from app.workers.tasks import _write_policy_files

        policies = [
            {"id": "p1", "yaml_content": "policies:\n  - name: p1\n"},
            {"id": "p2", "yaml_content": "policies:\n  - name: p2\n"},
        ]
        paths = _write_policy_files(policies, str(tmp_path))

        assert len(paths) == 2
        for path in paths:
            assert Path(path).exists()

    def test_file_content_matches_yaml(self, tmp_path):
        from app.workers.tasks import _write_policy_files

        yaml_content = "policies:\n  - name: test-policy\n    resource: azure.vm\n"
        paths = _write_policy_files([{"id": "abc", "yaml_content": yaml_content}], str(tmp_path))

        assert Path(paths[0]).read_text() == yaml_content

    def test_returns_paths_in_order(self, tmp_path):
        from app.workers.tasks import _write_policy_files

        policies = [{"id": f"p{i}", "yaml_content": f"# {i}"} for i in range(5)]
        paths = _write_policy_files(policies, str(tmp_path))

        assert [Path(p).stem for p in paths] == [f"policy_p{i}" for i in range(5)]


# ── _parse_c7n_org_output ─────────────────────────────────────────────────────

class TestParseC7nOrgOutput:
    """_parse_c7n_org_output reads c7n-org's directory tree correctly."""

    def _make_output(self, tmp_path, account: str, policy: str, resources: list) -> str:
        """Write a fake c7n-org output tree."""
        output_dir = tmp_path / account / policy
        output_dir.mkdir(parents=True)
        (output_dir / "resources.json").write_text(json.dumps(resources))
        return str(tmp_path)

    def test_aggregates_resources_and_cost(self, tmp_path):
        from app.workers.tasks import _parse_c7n_org_output

        resources = [
            {"id": "/subscriptions/sub1/rg/rg1/providers/Microsoft.Compute/virtualMachines/vm1",
             "name": "vm1", "type": "Microsoft.Compute/virtualMachines", "location": "westeurope",
             "properties": {"hardwareProfile": {"vmSize": "Standard_D2s_v3"}}},
        ]
        output_dir = self._make_output(tmp_path, "Prod", "idle-vm", resources)

        subs = [{"name": "Prod", "subscription_id": "sub-111"}]
        pols = [{"name": "idle-vm", "category": "idle", "severity": "high"}]

        result = _parse_c7n_org_output(output_dir, subs, pols)

        assert result["total_resources"] == 1
        assert result["total_waste"] == pytest.approx(96.0)
        assert "Prod" in result["by_subscription"]
        assert result["by_subscription"]["Prod"]["subscription_id"] == "sub-111"

    def test_multiple_subscriptions_aggregated_separately(self, tmp_path):
        from app.workers.tasks import _parse_c7n_org_output

        r = [{"id": "/rg/x", "name": "x", "type": "Microsoft.Storage/storageAccounts",
               "location": "uksouth"}]
        (tmp_path / "ProdA" / "idle-vm").mkdir(parents=True)
        (tmp_path / "ProdA" / "idle-vm" / "resources.json").write_text(json.dumps(r))
        (tmp_path / "ProdB" / "idle-vm").mkdir(parents=True)
        (tmp_path / "ProdB" / "idle-vm" / "resources.json").write_text(json.dumps(r))

        subs = [{"name": "ProdA", "subscription_id": "aaa"},
                {"name": "ProdB", "subscription_id": "bbb"}]
        pols = [{"name": "idle-vm", "category": "idle", "severity": "medium"}]

        result = _parse_c7n_org_output(str(tmp_path), subs, pols)

        assert result["total_resources"] == 2
        assert len(result["by_subscription"]) == 2

    def test_malformed_resources_json_skipped(self, tmp_path):
        from app.workers.tasks import _parse_c7n_org_output

        bad_dir = tmp_path / "Prod" / "bad-policy"
        bad_dir.mkdir(parents=True)
        (bad_dir / "resources.json").write_text("not json {{{{")

        result = _parse_c7n_org_output(str(tmp_path), [], [])
        assert result["total_resources"] == 0

    def test_non_list_resources_json_skipped(self, tmp_path):
        from app.workers.tasks import _parse_c7n_org_output

        bad_dir = tmp_path / "Prod" / "bad-policy"
        bad_dir.mkdir(parents=True)
        (bad_dir / "resources.json").write_text('{"not": "a list"}')

        result = _parse_c7n_org_output(str(tmp_path), [], [])
        assert result["total_resources"] == 0

    def test_empty_output_dir_returns_zero(self, tmp_path):
        from app.workers.tasks import _parse_c7n_org_output
        result = _parse_c7n_org_output(str(tmp_path), [], [])
        assert result["total_resources"] == 0
        assert result["total_waste"] == 0.0

    def test_missing_output_dir_returns_zero(self, tmp_path):
        from app.workers.tasks import _parse_c7n_org_output
        result = _parse_c7n_org_output(str(tmp_path / "nonexistent"), [], [])
        assert result["total_resources"] == 0

    def test_resource_metadata_annotated_correctly(self, tmp_path):
        from app.workers.tasks import _parse_c7n_org_output

        r = [{"id": "/r/vm1", "name": "vm1", "type": "Microsoft.Compute/disks",
               "location": "westeurope", "properties": {"diskSizeGB": 100}}]
        (tmp_path / "Prod" / "orphaned-disk").mkdir(parents=True)
        (tmp_path / "Prod" / "orphaned-disk" / "resources.json").write_text(json.dumps(r))

        subs = [{"name": "Prod", "subscription_id": "sub-111"}]
        pols = [{"name": "orphaned-disk", "category": "orphaned", "severity": "high"}]

        result = _parse_c7n_org_output(str(tmp_path), subs, pols)

        resource = result["all_resources"][0]
        assert resource["_subscription_id"] == "sub-111"
        assert resource["_policy_name"] == "orphaned-disk"
        assert resource["_category"] == "orphaned"
        assert resource["_severity"] == "high"
