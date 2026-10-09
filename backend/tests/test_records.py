from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

RECORD_CASES = {
    "A": (
        "www.example.com",
        [{"value": "192.0.2.10"}, {"value": "192.0.2.11"}],
        ["192.0.2.10", "192.0.2.11"],
        [{"value": "198.51.100.7"}],
        ["198.51.100.7"],
    ),
    "AAAA": (
        "www.example.com",
        [{"value": "2001:DB8:0:0:0:0:0:1"}],
        ["2001:db8::1"],
        [{"value": "2001:db8::2"}, {"value": "2001:db8::3"}],
        ["2001:db8::2", "2001:db8::3"],
    ),
    "CNAME": (
        "blog.example.com",
        [{"value": "Hosting.Example.NET."}],
        ["hosting.example.net"],
        [{"value": "d111111abcdef8.cloudfront.net"}],
        ["d111111abcdef8.cloudfront.net"],
    ),
    "TXT": (
        "example.com",
        [{"value": "v=spf1 include:_spf.example.com ~all"}, {"value": 'say "hi" \\ there  '}],
        ['"v=spf1 include:_spf.example.com ~all"', '"say \\"hi\\" \\\\ there  "'],
        [{"value": "google-site-verification=abc"}],
        ['"google-site-verification=abc"'],
    ),
    "MX": (
        "example.com",
        [{"priority": 10, "value": "mail.example.com"}, {"priority": 20, "value": "backup.example.com"}],
        ["10 mail.example.com", "20 backup.example.com"],
        [{"priority": 5, "value": "mx.example.net"}],
        ["5 mx.example.net"],
    ),
    "NS": (
        "dev.example.com",
        [{"value": "ns-1.example.net"}, {"value": "ns-2.example.net"}],
        ["ns-1.example.net", "ns-2.example.net"],
        [{"value": "ns-3.example.net"}],
        ["ns-3.example.net"],
    ),
    "PTR": (
        "10.example.com",
        [{"value": "host.example.com"}],
        ["host.example.com"],
        [{"value": "other.example.com"}],
        ["other.example.com"],
    ),
    "SRV": (
        "_sip._tcp.example.com",
        [{"priority": 10, "weight": 60, "port": 5060, "value": "sip.example.com"}],
        ["10 60 5060 sip.example.com"],
        [{"priority": 1, "weight": 5, "port": 5061, "value": "sips.example.com"}],
        ["1 5 5061 sips.example.com"],
    ),
    "CAA": (
        "example.com",
        [{"flags": 0, "tag": "issue", "value": "amazon.com"}, {"flags": 128, "tag": "iodef", "value": "mailto:sec@example.com"}],
        ['0 issue "amazon.com"', '128 iodef "mailto:sec@example.com"'],
        [{"flags": 0, "tag": "issuewild", "value": ";"}],
        ['0 issuewild ";"'],
    ),
}


def records_url(zone: dict) -> str:
    return f"/api/hosted-zones/{zone['id']}/records"


@pytest.mark.parametrize("record_type", list(RECORD_CASES))
def test_record_crud_for_every_type(client: TestClient, zone: dict, record_type: str) -> None:
    name, values, formatted, new_values, new_formatted = RECORD_CASES[record_type]

    created = client.post(records_url(zone), json={"name": name, "type": record_type, "ttl": 300, "values": values})
    assert created.status_code == 201, created.text
    record = created.json()
    assert record["type"] == record_type
    assert record["name"] == name
    assert record["formatted_values"] == formatted
    assert record["zone_id"] == zone["id"]
    assert record["is_system"] is False

    fetched = client.get(f"{records_url(zone)}/{record['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["values"] == record["values"]

    listed = client.get(records_url(zone), params={"type": record_type}).json()["items"]
    assert [r["id"] for r in listed if r["name"] == name] == [record["id"]]

    updated = client.put(
        f"{records_url(zone)}/{record['id']}",
        json={"name": name, "type": record_type, "ttl": 86400, "values": new_values},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["ttl"] == 86400
    assert updated.json()["formatted_values"] == new_formatted
    assert client.get(f"{records_url(zone)}/{record['id']}").json()["formatted_values"] == new_formatted

    assert client.delete(f"{records_url(zone)}/{record['id']}").status_code == 204
    assert client.get(f"{records_url(zone)}/{record['id']}").status_code == 404


def test_type_specific_fields_round_trip(client: TestClient, zone: dict) -> None:
    srv = client.post(
        records_url(zone),
        json={"name": "_xmpp._tcp.example.com", "type": "SRV", "ttl": 60,
              "values": [{"priority": 0, "weight": 65535, "port": 5269, "value": "xmpp.example.com"}]},
    ).json()
    assert srv["values"] == [{"value": "xmpp.example.com", "priority": 0, "weight": 65535, "port": 5269, "flags": None, "tag": None}]

    a = client.post(
        records_url(zone),
        json={"name": "ip.example.com", "type": "A", "ttl": 60, "values": [{"value": "192.0.2.1", "priority": 5}]},
    ).json()
    assert a["values"][0]["priority"] is None


@pytest.mark.parametrize(
    ("record_type", "values", "field"),
    [
        ("A", [{"value": "999.1.1.1"}], "values[0].value"),
        ("A", [{"value": "2001:db8::1"}], "values[0].value"),
        ("A", [], "values"),
        ("A", [{"value": "192.0.2.1"}, {"value": "192.0.2.1"}], "values[1].value"),
        ("AAAA", [{"value": "2001:db8::zz"}], "values[0].value"),
        ("CNAME", [{"value": "a.example.net"}, {"value": "b.example.net"}], "values"),
        ("CNAME", [{"value": "bad..name"}], "values[0].value"),
        ("TXT", [{"value": ""}], "values[0].value"),
        ("TXT", [{"value": "line\nbreak"}], "values[0].value"),
        ("MX", [{"value": "mail.example.com"}], "values[0].priority"),
        ("MX", [{"priority": 70000, "value": "mail.example.com"}], "values[0].priority"),
        ("NS", [{"value": "192.0.2.1"}], "values[0].value"),
        ("PTR", [{"value": ""}], "values[0].value"),
        ("SRV", [{"priority": 1, "weight": 1, "value": "sip.example.com"}], "values[0].port"),
        ("SRV", [{"priority": 1, "weight": 1, "port": 70000, "value": "sip.example.com"}], "values[0].port"),
        ("CAA", [{"flags": 0, "tag": "bogus", "value": "amazon.com"}], "values[0].tag"),
        ("CAA", [{"flags": 300, "tag": "issue", "value": "amazon.com"}], "values[0].flags"),
        ("CAA", [{"flags": 0, "tag": "iodef", "value": "not-a-url"}], "values[0].value"),
    ],
)
def test_invalid_values_are_rejected_per_field(
    client: TestClient, zone: dict, record_type: str, values: list, field: str
) -> None:
    response = client.post(
        records_url(zone), json={"name": "test.example.com", "type": record_type, "ttl": 300, "values": values}
    )
    assert response.status_code == 422, response.text
    assert field in {d["field"] for d in response.json()["error"]["details"]}


def test_record_name_and_ttl_validation(client: TestClient, zone: dict) -> None:
    def create(name: str, ttl: int = 300, record_type: str = "A") -> dict:
        response = client.post(records_url(zone), json={"name": name, "type": record_type, "ttl": ttl, "values": [{"value": "192.0.2.1"}]})
        return {"status": response.status_code, "body": response.json()}

    outside = create("www.other.com")
    assert outside["status"] == 422 and outside["body"]["error"]["details"][0]["field"] == "name"
    assert create("a.*.example.com")["status"] == 422
    assert create("www.example.com", ttl=-1)["body"]["error"]["details"][0]["field"] == "ttl"
    assert create("soa.example.com", record_type="SOA")["status"] == 422
    wildcard = create("*.Example.com.")
    assert wildcard["status"] == 201 and wildcard["body"]["name"] == "*.example.com"


def test_cname_rules_and_duplicates(client: TestClient, zone: dict) -> None:
    def create(name: str, record_type: str, value: str) -> int:
        return client.post(
            records_url(zone), json={"name": name, "type": record_type, "ttl": 300, "values": [{"value": value}]}
        ).status_code

    assert create("example.com", "CNAME", "other.example.net") == 400
    assert create("www.example.com", "A", "192.0.2.1") == 201
    assert create("www.example.com", "A", "192.0.2.2") == 409
    assert create("www.example.com", "CNAME", "other.example.net") == 409
    assert create("alias.example.com", "CNAME", "www.example.com") == 201
    assert create("alias.example.com", "TXT", "hello") == 409


def test_records_are_isolated_per_zone(client: TestClient, create_zone: Callable[..., dict]) -> None:
    zone_a = create_zone("a.example")
    zone_b = create_zone("b.example")
    record = client.post(
        records_url(zone_a), json={"name": "www.a.example", "type": "A", "ttl": 300, "values": [{"value": "192.0.2.1"}]}
    ).json()

    assert all(r["name"].endswith("b.example") for r in client.get(records_url(zone_b)).json()["items"])
    assert client.get(f"{records_url(zone_b)}/{record['id']}").status_code == 404
    assert client.put(
        f"{records_url(zone_b)}/{record['id']}",
        json={"name": "www.b.example", "type": "A", "ttl": 300, "values": [{"value": "192.0.2.9"}]},
    ).status_code == 404
    assert client.delete(f"{records_url(zone_b)}/{record['id']}").status_code == 404
    assert client.post(
        records_url(zone_b), json={"name": "www.a.example", "type": "A", "ttl": 300, "values": [{"value": "192.0.2.1"}]}
    ).status_code == 422
    assert client.get(f"{records_url(zone_a)}/{record['id']}").status_code == 200


def test_records_in_unknown_zone_return_404(client: TestClient) -> None:
    response = client.post(
        "/api/hosted-zones/ZMISSING/records",
        json={"name": "www.example.com", "type": "A", "ttl": 300, "values": [{"value": "192.0.2.1"}]},
    )
    assert response.status_code == 404
    assert client.get("/api/hosted-zones/ZMISSING/records").status_code == 404


def test_search_type_filter_and_pagination(client: TestClient, zone: dict) -> None:
    def create(name: str, record_type: str, values: list[dict]) -> None:
        response = client.post(records_url(zone), json={"name": name, "type": record_type, "ttl": 300, "values": values})
        assert response.status_code == 201, response.text

    create("shop.example.com", "CNAME", [{"value": "shop.example.net"}])
    create("shop-api.example.com", "A", [{"value": "192.0.2.50"}])
    create("cdn.example.com", "CNAME", [{"value": "assets.shop-cdn.example.net"}])
    create("_sip._tcp.example.com", "SRV", [{"priority": 1, "weight": 1, "port": 5060, "value": "sip.example.com"}])
    for i in range(8):
        create(f"host{i}.example.com", "A", [{"value": f"198.51.100.{i}"}])

    def names(**params: object) -> list[str]:
        return [r["name"] for r in client.get(records_url(zone), params=params).json()["items"]]

    assert names(search="shop", type="CNAME") == ["cdn.example.com", "shop.example.com"]
    assert names(search="shop", type="A") == ["shop-api.example.com"]
    assert set(names(search="shop")) == {"cdn.example.com", "shop.example.com", "shop-api.example.com"}
    assert names(search="192.0.2.50") == ["shop-api.example.com"]
    assert names(search="_sip") == ["_sip._tcp.example.com"]
    assert names(type=["CNAME", "SRV"]) == ["_sip._tcp.example.com", "cdn.example.com", "shop.example.com"]
    assert names(search="no-such-record") == []

    page = client.get(records_url(zone), params={"page_size": 5, "page": 3}).json()
    assert page["total"] == 14
    assert page["total_pages"] == 3
    assert len(page["items"]) == 4
    first = client.get(records_url(zone), params={"page_size": 5}).json()["items"]
    assert [r["type"] for r in first[:2]] == ["NS", "SOA"]

    by_ttl = client.get(records_url(zone), params={"sort_by": "ttl", "sort_order": "desc"}).json()["items"]
    assert by_ttl[0]["ttl"] == 172800


def test_apex_ns_and_soa_are_protected(client: TestClient, zone: dict) -> None:
    records = client.get(records_url(zone)).json()["items"]
    ns = next(r for r in records if r["type"] == "NS")
    soa = next(r for r in records if r["type"] == "SOA")

    assert client.delete(f"{records_url(zone)}/{ns['id']}").status_code == 400
    assert client.delete(f"{records_url(zone)}/{soa['id']}").status_code == 400

    rename = client.put(
        f"{records_url(zone)}/{ns['id']}",
        json={"name": "x.example.com", "type": "NS", "ttl": 300, "values": ns["values"]},
    )
    assert rename.status_code == 400

    soa_edit = client.put(
        f"{records_url(zone)}/{soa['id']}",
        json={"name": "example.com", "type": "SOA", "ttl": 60,
              "values": [{"value": "ns-1.awsdns-01.com. hostmaster.example.com. 2 7200 900 1209600 300"}]},
    )
    assert soa_edit.status_code == 200, soa_edit.text
    assert soa_edit.json()["formatted_values"] == ["ns-1.awsdns-01.com. hostmaster.example.com. 2 7200 900 1209600 300"]

    bad_soa = client.put(
        f"{records_url(zone)}/{soa['id']}",
        json={"name": "example.com", "type": "SOA", "ttl": 60, "values": [{"value": "too short"}]},
    )
    assert bad_soa.status_code == 422


def test_bulk_delete_reports_partial_failures(client: TestClient, zone: dict) -> None:
    ids = [
        client.post(
            records_url(zone), json={"name": f"h{i}.example.com", "type": "A", "ttl": 300, "values": [{"value": "192.0.2.1"}]}
        ).json()["id"]
        for i in range(3)
    ]
    ns_id = next(r["id"] for r in client.get(records_url(zone)).json()["items"] if r["type"] == "NS")

    result = client.post(f"{records_url(zone)}/batch-delete", json={"record_ids": [*ids[:2], ns_id, 999999]}).json()

    assert result["deleted"] == ids[:2]
    assert {f["id"] for f in result["failed"]} == {ns_id, 999999}
    remaining = {r["id"] for r in client.get(records_url(zone)).json()["items"]}
    assert ids[2] in remaining and not set(ids[:2]) & remaining


def test_update_can_change_name_and_type(client: TestClient, zone: dict) -> None:
    record = client.post(
        records_url(zone), json={"name": "old.example.com", "type": "A", "ttl": 300, "values": [{"value": "192.0.2.1"}]}
    ).json()
    response = client.put(
        f"{records_url(zone)}/{record['id']}",
        json={"name": "new.example.com", "type": "CNAME", "ttl": 60, "values": [{"value": "target.example.net"}]},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "new.example.com"
    assert response.json()["values"][0]["value"] == "target.example.net"
    assert len(response.json()["values"]) == 1
