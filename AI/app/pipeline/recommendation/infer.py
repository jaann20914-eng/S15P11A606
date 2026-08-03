from app.pipeline.recommendation.preprocess import PlaceFeatures

# 합이 1.00이라 각 항목이 0~1이면 최종 점수도 0.00~1.00 안에 들어온다.
PROXIMITY_WEIGHT = 0.30
CATEGORY_WEIGHT = 0.25
POPULARITY_WEIGHT = 0.20
FRESHNESS_WEIGHT = 0.15
DEMOGRAPHIC_WEIGHT = 0.10

SCORE_DECIMAL_PLACES = 2


def compute_score(features: PlaceFeatures) -> float:
    weighted_sum = (
        PROXIMITY_WEIGHT * features.proximity
        + CATEGORY_WEIGHT * features.category
        + POPULARITY_WEIGHT * features.popularity
        + FRESHNESS_WEIGHT * features.freshness
        + DEMOGRAPHIC_WEIGHT * features.demographic
    )

    return round(weighted_sum, SCORE_DECIMAL_PLACES)
