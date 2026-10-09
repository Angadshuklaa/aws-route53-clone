import re
import sqlite3
from collections.abc import Callable
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from tests.conftest import DEMO_LOGIN, make_client


def test_create_public_zone_adds_default_ns_and_soa(client: TestClient) -> None:
    response = client.post("/api/hosted-zones", json={"name": "Example.COM.", "comment": "Main site"})

    assert response.status_code == 201
    zone = response.json()
    assert re.fullmatch(r"Z[A-Z0-9]{20}", zone["id"])
    assert zone["name"] == "example.com"
    assert zone["type"] == "PUBLIC"
    assert zone["comment"] == "Main site"
    assert zone["record_count"] == 2
    assert len(zone["name_servers"]) == 4
    assert all(".awsdns-" in ns for ns in zone["name_servers"])

    records = client.get(f"/api/hosted-zones/{zone['id']}/records").json()["items"]
    assert [(r["type"], r["is_system"]) for r in records] == [("NS", True), ("SOA", True)]


@pytest.mark.parametrize("name", ["", "localhost", "-bad.com", "bad-.com", "a..b.com", "under_score.com", "x.123", "a" * 64 + ".com"])
def test_invalid_domain_names_are_rejected(client: TestClient, name: str) -> None:
    response = client.post("/api/hosted-zones", json={"name": name})

    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "name"


def test_duplicate_public_zone_is_a_conflict(client: TestClient, zone: dict) -> None:
    response = client.post("/api/hosted-zones", json={"name": "EXAMPLE.com"})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CONFLICT"


def test_private_zone_requires_a_valid_vpc(client: TestClient) -> None:
    missing = client.post("/api/hosted-zones", json={"name": "corp.internal", "type": "PRIVATE"})
    assert missing.status_code == 422
    assert {d["field"] for d in missing.json()["error"]["details"]} == {"vpc_id", "vpc_region"}

    bad = client.post(
        "/api/hosted-zones",
        json={"name": "corp.internal", "type": "PRIVATE", "vpc_id": "vpc-xyz", "vpc_region": "mars-1"},
    )
    assert bad.status_code == 422

    ok = client.post(
        "/api/hosted-zones",
        json={"name": "corp.internal", "type": "PRIVATE", "vpc_id": "vpc-0a1b2c3d", "vpc_region": "us-east-1"},
    )
    assert ok.status_code == 201
    assert ok.json()["vpc_id"] == "vpc-0a1b2c3d"

    other_vpc = client.post(
        "/api/hosted-zones",
        json={"name": "corp.internal", "type": "PRIVATE", "vpc_id": "vpc-0a1b2c3e", "vpc_region": "us-east-1"},
    )
    assert other_vpc.status_code == 201
    same_vpc = client.post(
        "/api/hosted-zones",
        json={"name": "corp.internal", "type": "PRIVATE", "vpc_id": "vpc-0a1b2c3d", "vpc_region": "us-west-2"},
    )
    assert same_vpc.status_code == 409


def test_list_search_filter_sort_and_paginate(client: TestClient, create_zone: Callable[..., dict]) -> None:
    created = [create_zone(f"site{i}.example", comment=f"Site number {i}") for i in range(5)]
    create_zone("alpha.test", comment="100% organic")
    create_zone("vpc.internal", type="PRIVATE", vpc_id="vpc-0a1b2c3d", vpc_region="eu-west-1")

    page1 = client.get("/api/hosted-zones", params={"page_size": 3}).json()
    assert page1["total"] == 7
    assert page1["total_pages"] == 3
    assert [z["name"] for z in page1["items"]] == ["alpha.test", "site0.example", "site1.example"]
    page3 = client.get("/api/hosted-zones", params={"page_size": 3, "page": 3}).json()
    assert [z["name"] for z in page3["items"]] == ["vpc.internal"]

    by_name = client.get("/api/hosted-zones", params={"search": "SITE3"}).json()
    assert [z["name"] for z in by_name["items"]] == ["site3.example"]

    by_id = client.get("/api/hosted-zones", params={"search": created[2]["id"].lower()}).json()
    assert [z["id"] for z in by_id["items"]] == [created[2]["id"]]

    by_comment = client.get("/api/hosted-zones", params={"search": "100%"}).json()
    assert [z["name"] for z in by_comment["items"]] == ["alpha.test"]

    private = client.get("/api/hosted-zones", params={"type": "PRIVATE"}).json()
    assert [z["name"] for z in private["items"]] == ["vpc.internal"]

    no_match = client.get("/api/hosted-zones", params={"search": "nothing-here"}).json()
    assert no_match["items"] == [] and no_match["total"] == 0 and no_match["total_pages"] == 1

    desc = client.get("/api/hosted-zones", params={"sort_by": "name", "sort_order": "desc"}).json()
    assert desc["items"][0]["name"] == "vpc.internal"


def test_get_unknown_zone_returns_404(client: TestClient) -> None:
    response = client.get("/api/hosted-zones/ZDOESNOTEXIST")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_update_zone_persists_comment_and_tags(client: TestClient, zone: dict) -> None:
    response = client.put(
        f"/api/hosted-zones/{zone['id']}",
        json={"comment": "Updated description", "tags": [{"key": "Env", "value": "prod"}, {"key": "Team", "value": "dns"}]},
    )
    assert response.status_code == 200
    assert response.json()["comment"] == "Updated description"

    response = client.put(f"/api/hosted-zones/{zone['id']}", json={"comment": "Again", "tags": [{"key": "Env", "value": "staging"}]})
    assert response.status_code == 200

    fetched = client.get(f"/api/hosted-zones/{zone['id']}").json()
    assert fetched["comment"] == "Again"
    assert fetched["tags"] == [{"key": "Env", "value": "staging"}]
    assert fetched["updated_at"] >= zone["updated_at"]


def test_update_rejects_name_changes_and_bad_tags(client: TestClient, zone: dict) -> None:
    rename = client.put(f"/api/hosted-zones/{zone['id']}", json={"name": "other.com"})
    assert rename.status_code == 422

    dup_tags = client.put(
        f"/api/hosted-zones/{zone['id']}", json={"tags": [{"key": "a", "value": "1"}, {"key": "a", "value": "2"}]}
    )
    assert dup_tags.status_code == 422
    assert dup_tags.json()["error"]["details"][0]["field"] == "tags[1].key"

    too_long = client.put(f"/api/hosted-zones/{zone['id']}", json={"comment": "x" * 257})
    assert too_long.status_code == 422

    missing = client.put("/api/hosted-zones/ZNOPE", json={"comment": "x"})
    assert missing.status_code == 404


def test_delete_zone_cascades_to_records(client: TestClient, zone: dict, db_path: Path) -> None:
    client.post(
        f"/api/hosted-zones/{zone['id']}/records",
        json={"name": "www.example.com", "type": "A", "ttl": 300, "values": [{"value": "192.0.2.1"}]},
    )
    assert client.delete(f"/api/hosted-zones/{zone['id']}").status_code == 204
    assert client.get(f"/api/hosted-zones/{zone['id']}").status_code == 404
    assert client.get("/api/hosted-zones").json()["total"] == 0
    assert client.delete(f"/api/hosted-zones/{zone['id']}").status_code == 404

    with sqlite3.connect(db_path) as conn:
        assert conn.execute("SELECT COUNT(*) FROM dns_records").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM dns_record_values").fetchone()[0] == 0


def test_data_survives_an_application_restart(db_path: Path) -> None:
    with make_client(db_path) as first:
        first.post("/api/auth/login", json=DEMO_LOGIN)
        zone = first.post("/api/hosted-zones", json={"name": "persist.example"}).json()
        first.post(
            f"/api/hosted-zones/{zone['id']}/records",
            json={"name": "persist.example", "type": "TXT", "ttl": 60, "values": [{"value": "still here"}]},
        )

    with make_client(db_path) as second:
        second.post("/api/auth/login", json=DEMO_LOGIN)
        assert second.get(f"/api/hosted-zones/{zone['id']}").json()["record_count"] == 3
        records = second.get(f"/api/hosted-zones/{zone['id']}/records", params={"type": "TXT"}).json()["items"]
        assert records[0]["formatted_values"] == ['"still here"']


def test_demo_seed_runs_only_once(db_path: Path) -> None:
    with make_client(db_path, seed=True) as first:
        first.post("/api/auth/login", json=DEMO_LOGIN)
        zones = first.get("/api/hosted-zones", params={"page_size": 100}).json()
        assert zones["total"] >= 10
        assert first.delete(f"/api/hosted-zones/{zones['items'][0]['id']}").status_code == 204

    with make_client(db_path, seed=True) as second:
        second.post("/api/auth/login", json=DEMO_LOGIN)
        assert second.get("/api/hosted-zones").json()["total"] == zones["total"] - 1


def test_health_reports_database_status(anon_client: TestClient) -> None:
    response = anon_client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["database"] == "ok"


def test_property_filters(client: TestClient, create_zone: Callable[..., dict]) -> None:
    create_zone("shop.example", comment="Storefront for alpha")
    create_zone("alpha.example", comment="Marketing")
    create_zone("alpha.internal", type="PRIVATE", vpc_id="vpc-0a1b2c3d", vpc_region="us-east-1")

    def names(**params: object) -> list[str]:
        return [z["name"] for z in client.get("/api/hosted-zones", params=params).json()["items"]]

    assert names(name="alpha") == ["alpha.example", "alpha.internal"]
    assert names(search="alpha") == ["alpha.example", "alpha.internal", "shop.example"]
    assert names(search=["alpha", "storefront"]) == ["shop.example"]
    assert names(type=["PUBLIC", "PRIVATE"]) == ["alpha.example", "alpha.internal", "shop.example"]
    assert names(name="alpha", type="PRIVATE") == ["alpha.internal"]
