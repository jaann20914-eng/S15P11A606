from fastapi import APIRouter, Depends

from app.core.security import verify_internal_api_key
from app.schemas.recommendation import (
    ErrorResponse,
    ScoreRequest,
    ScoreResponse,
)
from app.services.recommendation.recommendation_service import score_places

router = APIRouter(
    prefix="/api/v1/internal/recommendations",
    tags=["recommendations"],
    dependencies=[Depends(verify_internal_api_key)],
)


@router.post(
    "/score",
    response_model=ScoreResponse,
    responses={
        400: {"model": ErrorResponse},
        401: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
        504: {"model": ErrorResponse},
    },
)
async def score_recommendations(request: ScoreRequest) -> ScoreResponse:
    return await score_places(request)
