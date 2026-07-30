from datetime import datetime
from typing import Any

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)

SCORE_URL = "/api/v1/internal/recommendations/score"

AUTH_HEADERS = {"x-internal-api-key": settings.internal_api_key}


def build_place(
    place_id: str,
    crowd_level: float = 2.0,
    **overrides: Any,
) -> dict[str, Any]:
    place: dict[str, Any] = {
        "placeId": place_id,
        "representativePinId": f"pin_{place_id}",
        "latitude": 37.5008,
        "longitude": 127.0366,
        "category": "CAFE",
        "crowdLevel": crowd_level,
        "latestPinCreatedAt": "2026-07-27T08:55:00Z",
        "avgAuthorTrust": 132.5,
    }
    place.update(overrides)
    return place


def build_request(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "userId": "user_12345",
        "latitude": 37.5006,
        "longitude": 127.0364,
        "preferredCategories": ["CAFE", "RESTAURANT"],
        "gender": "FEMALE",
        "ageGroup": "TWENTIES",
        "requestedAt": "2026-07-27T09:00:00Z",
        "candidatePlaces": [build_place("place_001")],
    }
    payload.update(overrides)
    return payload


def post_score(payload: dict[str, Any]) -> Any:
    return client.post(SCORE_URL, json=payload, headers=AUTH_HEADERS)


def test_returns_scored_lists() -> None:
    response = post_score(build_request())

    assert response.status_code == 200

    body = response.json()
    assert body["relaxedList"][0]["placeId"] == "place_001"
    assert body["relaxedList"][0]["representativePinId"] == "pin_place_001"
    assert body["busyList"] == []


def test_crowd_level_below_threshold_goes_to_relaxed_list() -> None:
    payload = build_request(candidatePlaces=[build_place("place_001", 2.4)])

    body = post_score(payload).json()

    assert len(body["relaxedList"]) == 1
    assert body["busyList"] == []


def test_crowd_level_at_threshold_goes_to_busy_list() -> None:
    payload = build_request(candidatePlaces=[build_place("place_001", 2.5)])

    body = post_score(payload).json()

    assert body["relaxedList"] == []
    assert len(body["busyList"]) == 1


def test_empty_candidates_returns_empty_lists() -> None:
    response = post_score(build_request(candidatePlaces=[]))

    assert response.status_code == 200

    body = response.json()
    assert body["relaxedList"] == []
    assert body["busyList"] == []


def test_same_request_returns_same_scores() -> None:
    payload = build_request(
        candidatePlaces=[build_place(f"place_{index:03d}") for index in range(5)]
    )

    first = post_score(payload).json()["relaxedList"]
    second = post_score(payload).json()["relaxedList"]

    assert [place["score"] for place in first] == [place["score"] for place in second]


def test_scores_are_sorted_in_descending_order() -> None:
    payload = build_request(
        candidatePlaces=[build_place(f"place_{index:03d}") for index in range(10)]
    )

    scores = [place["score"] for place in post_score(payload).json()["relaxedList"]]

    assert scores == sorted(scores, reverse=True)


def test_last_updated_includes_timezone() -> None:
    body = post_score(build_request()).json()

    last_updated = datetime.fromisoformat(body["lastUpdated"])

    assert last_updated.tzinfo is not None


def test_crowd_level_above_range_is_rejected() -> None:
    payload = build_request(candidatePlaces=[build_place("place_001", 5)])

    response = post_score(payload)

    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_REQUEST_PAYLOAD"


def test_lowercase_category_is_rejected() -> None:
    payload = build_request(
        candidatePlaces=[build_place("place_001", category="cafe")]
    )

    response = post_score(payload)

    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_REQUEST_PAYLOAD"


def test_missing_required_field_is_rejected() -> None:
    payload = build_request()
    del payload["latitude"]

    response = post_score(payload)

    assert response.status_code == 400

    body = response.json()
    assert body["code"] == "INVALID_REQUEST_PAYLOAD"
    assert "latitude" in body["message"]


def test_unknown_field_is_rejected() -> None:
    response = post_score(build_request(placeID="typo"))

    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_REQUEST_PAYLOAD"


def test_missing_api_key_is_rejected() -> None:
    response = client.post(SCORE_URL, json=build_request())

    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"


def test_wrong_api_key_is_rejected() -> None:
    response = client.post(
        SCORE_URL,
        json=build_request(),
        headers={"x-internal-api-key": "wrong-key"},
    )

    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"
