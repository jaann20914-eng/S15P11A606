from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)

SCORE_URL = "/api/v1/internal/recommendations/score"

AUTH_HEADERS = {"x-internal-api-key": settings.internal_api_key}


def build_place(
    place_id: int,
    crowd_level: float = 2.0,
    **overrides: Any,
) -> dict[str, Any]:
    place: dict[str, Any] = {
        "placeId": place_id,
        "representativePinId": str(UUID(int=place_id)),
        "latitude": 37.5008,
        "longitude": 127.0366,
        "category": "CAFE",
        "crowdLevel": crowd_level,
        "lastPinActivatedAt": "2026-07-27T08:55:00Z",
        "unlockCount7d": 42,
        "authorCount": 8,
        "authorGenderDist": {"MALE": 0.375, "FEMALE": 0.625},
        "authorAgeDist": {"TWENTIES": 0.5, "THIRTIES": 0.375, "FORTIES": 0.125},
    }
    place.update(overrides)
    return place


def build_request(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "userId": 1,
        "latitude": 37.5006,
        "longitude": 127.0364,
        "preferredCategories": ["CAFE", "RESTAURANT"],
        "gender": "FEMALE",
        "ageGroup": "TWENTIES",
        "requestedAt": "2026-07-27T09:00:00Z",
        "candidatePlaces": [build_place(1)],
    }
    payload.update(overrides)
    return payload


def post_score(payload: dict[str, Any]) -> Any:
    return client.post(SCORE_URL, json=payload, headers=AUTH_HEADERS)


def test_returns_scored_lists() -> None:
    response = post_score(build_request())

    assert response.status_code == 200

    body = response.json()
    assert body["relaxedList"][0]["placeId"] == 1
    assert (
        body["relaxedList"][0]["representativePinId"]
        == "00000000-0000-0000-0000-000000000001"
    )
    assert body["wagleList"] == []


def test_crowd_level_below_threshold_goes_to_relaxed_list() -> None:
    payload = build_request(candidatePlaces=[build_place(1, 2.4)])

    body = post_score(payload).json()

    assert len(body["relaxedList"]) == 1
    assert body["wagleList"] == []


def test_crowd_level_at_threshold_goes_to_wagle_list() -> None:
    payload = build_request(candidatePlaces=[build_place(1, 2.5)])

    body = post_score(payload).json()

    assert body["relaxedList"] == []
    assert len(body["wagleList"]) == 1


def test_empty_candidates_returns_empty_lists() -> None:
    response = post_score(build_request(candidatePlaces=[]))

    assert response.status_code == 200

    body = response.json()
    assert body["relaxedList"] == []
    assert body["wagleList"] == []


def test_same_request_returns_same_scores() -> None:
    payload = build_request(
        candidatePlaces=[build_place(place_id) for place_id in range(1, 6)]
    )

    first = post_score(payload).json()["relaxedList"]
    second = post_score(payload).json()["relaxedList"]

    assert [place["score"] for place in first] == [place["score"] for place in second]


def test_scores_are_sorted_in_descending_order() -> None:
    payload = build_request(
        candidatePlaces=[build_place(place_id) for place_id in range(1, 11)]
    )

    scores = [place["score"] for place in post_score(payload).json()["relaxedList"]]

    assert scores == sorted(scores, reverse=True)


def test_last_updated_includes_timezone() -> None:
    body = post_score(build_request()).json()

    last_updated = datetime.fromisoformat(body["lastUpdated"])

    assert last_updated.tzinfo is not None


def test_partial_age_distribution_is_accepted() -> None:
    payload = build_request(
        candidatePlaces=[build_place(1, authorAgeDist={"TWENTIES": 1.0})]
    )

    assert post_score(payload).status_code == 200


def test_crowd_level_above_range_is_rejected() -> None:
    payload = build_request(candidatePlaces=[build_place(1, 5)])

    response = post_score(payload)

    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_REQUEST_PAYLOAD"


def test_lowercase_category_is_rejected() -> None:
    payload = build_request(
        candidatePlaces=[build_place(1, category="cafe")]
    )

    response = post_score(payload)

    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_REQUEST_PAYLOAD"


def test_negative_unlock_count_is_rejected() -> None:
    payload = build_request(
        candidatePlaces=[build_place(1, unlockCount7d=-1)]
    )

    response = post_score(payload)

    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_REQUEST_PAYLOAD"


def test_zero_author_count_is_rejected() -> None:
    payload = build_request(candidatePlaces=[build_place(1, authorCount=0)])

    response = post_score(payload)

    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_REQUEST_PAYLOAD"


def test_gender_distribution_not_summing_to_one_is_rejected() -> None:
    payload = build_request(
        candidatePlaces=[
            build_place(1, authorGenderDist={"MALE": 0.3, "FEMALE": 0.3})
        ]
    )

    response = post_score(payload)

    assert response.status_code == 400

    body = response.json()
    assert body["code"] == "INVALID_REQUEST_PAYLOAD"
    assert "authorGenderDist" in body["message"]


def test_ratio_above_one_is_rejected() -> None:
    payload = build_request(
        candidatePlaces=[
            build_place(1, authorGenderDist={"MALE": 1.5, "FEMALE": -0.5})
        ]
    )

    response = post_score(payload)

    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_REQUEST_PAYLOAD"


def test_unknown_age_group_key_is_rejected() -> None:
    payload = build_request(
        candidatePlaces=[
            build_place(1, authorAgeDist={"TWENTIES": 0.5, "MEN": 0.5})
        ]
    )

    response = post_score(payload)

    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_REQUEST_PAYLOAD"


def test_missing_gender_is_rejected() -> None:
    response = post_score(build_request(gender=None))

    assert response.status_code == 400

    body = response.json()
    assert body["code"] == "INVALID_REQUEST_PAYLOAD"
    assert "gender" in body["message"]


def test_removed_avg_author_trust_field_is_rejected() -> None:
    payload = build_request(
        candidatePlaces=[build_place(1, avgAuthorTrust=132.5)]
    )

    response = post_score(payload)

    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_REQUEST_PAYLOAD"


def test_non_numeric_place_id_is_rejected() -> None:
    payload = build_request(candidatePlaces=[build_place(1, placeId="place_001")])

    response = post_score(payload)

    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_REQUEST_PAYLOAD"


def test_non_uuid_representative_pin_id_is_rejected() -> None:
    payload = build_request(
        candidatePlaces=[build_place(1, representativePinId="pin_014")]
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
