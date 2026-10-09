from __future__ import annotations

from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import load_settings
from app.main import create_app

DEMO_LOGIN = {"account_id": "123456789012", "username": "demo", "password": "Route53Demo!"}


def make_client(database_path: Path, seed: bool = False) -> TestClient:
    settings = load_settings(database_path=str(database_path), seed_demo_data=seed, environment="test")
    return TestClient(create_app(settings))


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "test.db"


@pytest.fixture
def anon_client(db_path: Path) -> Iterator[TestClient]:
    with make_client(db_path) as client:
        yield client


@pytest.fixture
def client(anon_client: TestClient) -> TestClient:
    response = anon_client.post("/api/auth/login", json=DEMO_LOGIN)
    assert response.status_code == 200, response.text
    return anon_client


@pytest.fixture
def create_zone(client: TestClient) -> Callable[..., dict]:
    def _create(name: str = "example.com", **extra: object) -> dict:
        response = client.post("/api/hosted-zones", json={"name": name, **extra})
        assert response.status_code == 201, response.text
        return response.json()

    return _create


@pytest.fixture
def zone(create_zone: Callable[..., dict]) -> dict:
    return create_zone("example.com", comment="Test zone")
