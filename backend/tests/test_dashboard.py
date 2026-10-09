from collections.abc import Callable

from fastapi.testclient import TestClient


def test_dashboard_requires_a_session(anon_client: TestClient) -> None:
    assert anon_client.get("/api/dashboard").status_code == 401


def test_dashboard_counts_zones_and_records(client: TestClient, create_zone: Callable[..., dict]) -> None:
    empty = client.get("/api/dashboard").json()
    assert empty["hosted_zones"] == {"total": 0, "public": 0, "private": 0}
    assert empty["record_count"] == 0
    assert empty["recent_zones"] == []

    public = create_zone("one.example")
    create_zone("two.internal", type="PRIVATE", vpc_id="vpc-0a1b2c3d", vpc_region="us-east-1")
    client.post(
        f"/api/hosted-zones/{public['id']}/records",
        json={"name": "www.one.example", "type": "A", "ttl": 60, "values": [{"value": "192.0.2.1"}]},
    )

    summary = client.get("/api/dashboard").json()
    assert summary["hosted_zones"] == {"total": 2, "public": 1, "private": 1}
    assert summary["record_count"] == 5  # 2 x (NS + SOA) + 1 A
    assert summary["records_by_type"]["A"] == 1
    assert summary["records_by_type"]["NS"] == 2
    assert summary["records_by_type"]["CAA"] == 0
    assert [zone["name"] for zone in summary["recent_zones"]] == ["two.internal", "one.example"]
