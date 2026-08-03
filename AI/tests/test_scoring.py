from datetime import UTC, datetime, timedelta

import pytest

from app.pipeline.recommendation.infer import compute_score
from app.pipeline.recommendation.preprocess import (
    PlaceFeatures,
    category_score,
    demographic_score,
    freshness_score,
    haversine_meters,
    popularity_score,
    proximity_score,
)

NOW = datetime(2026, 7, 27, 9, 0, tzinfo=UTC)

FEMALE_TWENTIES_AUTHORS = ({"FEMALE": 1.0}, {"TWENTIES": 1.0})


def test_same_coordinates_have_no_distance() -> None:
    assert haversine_meters(37.4979, 127.0276, 37.4979, 127.0276) == 0.0


def test_distance_matches_real_world_length() -> None:
    # 강남역 ~ 역삼역 직선거리는 약 830m다.
    distance = haversine_meters(37.4979, 127.0276, 37.5006, 127.0364)

    assert distance == pytest.approx(830, rel=0.05)


def test_proximity_is_highest_at_zero_distance() -> None:
    assert proximity_score(0.0) == 1.0


def test_proximity_decays_with_distance() -> None:
    assert proximity_score(500.0) == pytest.approx(0.368, abs=0.001)
    assert proximity_score(3000.0) < proximity_score(500.0)


def test_preferred_category_scores_full() -> None:
    assert category_score(["CAFE", "RESTAURANT"], "CAFE") == 1.0


def test_unpreferred_category_scores_zero() -> None:
    assert category_score(["CAFE", "RESTAURANT"], "PARK") == 0.0


def test_preference_order_does_not_change_category_score() -> None:
    preferred = ["CAFE", "RESTAURANT", "PARK"]

    assert category_score(preferred, "CAFE") == category_score(preferred, "PARK")


def test_popularity_starts_at_zero() -> None:
    assert popularity_score(0) == 0.0


def test_popularity_reaches_half_at_saturation_point() -> None:
    assert popularity_score(20) == 0.5


def test_popularity_never_reaches_one() -> None:
    assert popularity_score(100_000) < 1.0


def test_freshness_is_highest_right_after_activation() -> None:
    assert freshness_score(NOW, NOW) == 1.0


def test_freshness_decays_over_time() -> None:
    half_life = freshness_score(NOW - timedelta(minutes=30), NOW)
    expired = freshness_score(NOW - timedelta(minutes=60), NOW)

    assert half_life == pytest.approx(0.368, abs=0.001)
    assert expired == pytest.approx(0.135, abs=0.001)


def test_future_activation_time_is_clamped() -> None:
    # 서버 간 시계 오차로 미래 시각이 와도 점수가 1을 넘지 않아야 한다.
    assert freshness_score(NOW + timedelta(minutes=10), NOW) == 1.0


def test_demographic_shrinks_toward_neutral_with_few_authors() -> None:
    few = demographic_score("FEMALE", "TWENTIES", *FEMALE_TWENTIES_AUTHORS, 2)
    many = demographic_score("FEMALE", "TWENTIES", *FEMALE_TWENTIES_AUTHORS, 100)

    assert 0.5 < few < many


def test_demographic_treats_missing_distribution_key_as_zero() -> None:
    # 비율이 0인 항목은 분포에서 생략될 수 있다.
    score = demographic_score("MALE", "FIFTIES", *FEMALE_TWENTIES_AUTHORS, 10)

    assert score < 0.5


def test_all_features_at_maximum_score_one() -> None:
    assert compute_score(PlaceFeatures(1.0, 1.0, 1.0, 1.0, 1.0)) == 1.0


def test_all_features_at_minimum_score_zero() -> None:
    assert compute_score(PlaceFeatures(0.0, 0.0, 0.0, 0.0, 0.0)) == 0.0


def test_score_is_rounded_to_two_decimals() -> None:
    score = compute_score(PlaceFeatures(0.3684, 1.0, 0.5, 0.3684, 0.55))

    assert score == round(score, 2)
