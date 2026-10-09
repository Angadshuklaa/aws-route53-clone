import json

from fastapi.testclient import TestClient

ZONE_FILE = """\
$ORIGIN example.com.
$TTL 3600
; comments and blank lines are ignored

@   IN  SOA ns1.example.com. admin.example.com. (
        2026100901 ; serial
        7200 900 1209600 300 )
@       IN  NS    ns1.example.com.
@       300 IN A  192.0.2.10
        IN  A     192.0.2.11            ; same owner as the previous line
@       IN  AAAA  2001:db8::10
@       IN  MX    10 mail
@       IN  MX    20 mail2.example.com.
@       IN  TXT   "v=spf1 include:_spf.example.com ~all"
long    IN  TXT   "part one;" " part two"
www     IN  CNAME example.com.
mail    1h IN  A  192.0.2.25
_sip._tcp IN SRV  10 60 5060 sip.example.com.
@       IN  CAA   0 issue "amazon.com"
dev     IN  NS    ns-1.example.net.
10      IN  PTR   host.example.com.
bad     IN  A     300.1.1.1
key     IN  SSHFP 1 1 123456789abcdef67890123456789abcdef67890
outside.example.org. IN A 192.0.2.99
"""


def import_file(client: TestClient, zone: dict, content: str, overwrite: bool = False) -> dict:
    response = client.post(f"/api/hosted-zones/{zone['id']}/import", json={"content": content, "overwrite": overwrite})
    assert response.status_code == 200, response.text
    return response.json()


def test_import_bind_zone_file(client: TestClient, zone: dict) -> None:
    result = import_file(client, zone, ZONE_FILE)

    assert result["created"] == 11
    assert result["updated"] == 0
    error_lines = {issue["line"] for issue in result["errors"]}
    assert error_lines == {22, 24}
    skipped = " ".join(issue["message"] for issue in result["skipped"])
    assert "SOA" in skipped and "SSHFP" in skipped and "zone apex" in skipped

    records = client.get(f"/api/hosted-zones/{zone['id']}/records", params={"page_size": 100}).json()["items"]
    by_key = {(r["name"], r["type"]): r for r in records}
    assert by_key[("example.com", "A")]["formatted_values"] == ["192.0.2.10", "192.0.2.11"]
    assert by_key[("example.com", "A")]["ttl"] == 300
    assert by_key[("example.com", "MX")]["formatted_values"] == ["10 mail.example.com", "20 mail2.example.com"]
    assert by_key[("long.example.com", "TXT")]["values"][0]["value"] == "part one; part two"
    assert by_key[("mail.example.com", "A")]["ttl"] == 3600
    assert by_key[("_sip._tcp.example.com", "SRV")]["formatted_values"] == ["10 60 5060 sip.example.com"]
    assert by_key[("example.com", "CAA")]["formatted_values"] == ['0 issue "amazon.com"']
    assert by_key[("10.example.com", "PTR")]["formatted_values"] == ["host.example.com"]


def test_reimport_skips_or_overwrites_existing_records(client: TestClient, zone: dict) -> None:
    import_file(client, zone, "www 300 IN A 192.0.2.1\n")

    skipped = import_file(client, zone, "www 300 IN A 192.0.2.2\n")
    assert skipped["created"] == 0 and len(skipped["skipped"]) == 1

    overwritten = import_file(client, zone, "www 60 IN A 192.0.2.2\n", overwrite=True)
    assert overwritten["updated"] == 1
    record = client.get(f"/api/hosted-zones/{zone['id']}/records", params={"type": "A"}).json()["items"][0]
    assert record["formatted_values"] == ["192.0.2.2"] and record["ttl"] == 60


def test_export_bind_round_trips(client: TestClient, zone: dict, create_zone) -> None:
    import_file(client, zone, ZONE_FILE)
    long_txt = "x" * 300
    client.post(
        f"/api/hosted-zones/{zone['id']}/records",
        json={"name": "big.example.com", "type": "TXT", "ttl": 60, "values": [{"value": long_txt}]},
    )

    response = client.get(f"/api/hosted-zones/{zone['id']}/export", params={"format": "bind"})
    assert response.status_code == 200
    assert 'filename="example.com.zone"' in response.headers["content-disposition"]
    text = response.text
    assert "$ORIGIN example.com." in text
    assert "_sip._tcp.example.com." in text and "sip.example.com." in text

    original = client.get(f"/api/hosted-zones/{zone['id']}/records", params={"page_size": 100}).json()["items"]
    client.delete(f"/api/hosted-zones/{zone['id']}")
    copy = create_zone("example.com")
    result = import_file(client, copy, text)
    assert result["errors"] == []
    restored = client.get(f"/api/hosted-zones/{copy['id']}/records", params={"page_size": 100}).json()["items"]

    def comparable(records: list[dict]) -> set:
        return {(r["name"], r["type"], r["ttl"], tuple(r["formatted_values"])) for r in records if not r["is_system"]}

    assert comparable(restored) == comparable(original)


def test_export_json(client: TestClient, zone: dict) -> None:
    response = client.get(f"/api/hosted-zones/{zone['id']}/export", params={"format": "json"})
    assert response.status_code == 200
    document = json.loads(response.text)
    assert document["hosted_zone"]["id"] == zone["id"]
    assert {r["type"] for r in document["records"]} == {"NS", "SOA"}
