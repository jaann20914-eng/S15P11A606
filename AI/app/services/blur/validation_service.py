from dataclasses import dataclass

import cv2
import numpy as np

from app.core.config import settings
from app.services.blur.face_detector import BBox


@dataclass
class ValidationResult:
    passed: bool

    sharpness_ratio: float | None

    reason_code: str | None


class ValidationService:

    def validate(
        self,
        original_frame: np.ndarray,
        blurred_frame: np.ndarray,
        bbox: BBox,
    ) -> ValidationResult:

        x1, y1, x2, y2 = bbox

        if (
            x2 - x1 < settings.min_roi_size
            or y2 - y1 < settings.min_roi_size
        ):
            return ValidationResult(
                passed=False,
                sharpness_ratio=None,
                reason_code="ROI_TOO_SMALL",
            )

        original_roi = original_frame[
            y1:y2,
            x1:x2,
        ]

        blurred_roi = blurred_frame[
            y1:y2,
            x1:x2,
        ]

        original_sharpness = (
            self.laplacian_variance(
                original_roi
            )
        )

        blurred_sharpness = (
            self.laplacian_variance(
                blurred_roi
            )
        )

        if original_sharpness <= 1e-6:
            return ValidationResult(
                passed=False,
                sharpness_ratio=None,
                reason_code="LOW_ORIGINAL_SHARPNESS",
            )

        ratio = (
            blurred_sharpness
            / original_sharpness
        )

        if (
            ratio
            <= settings.max_sharpness_ratio
        ):
            return ValidationResult(
                passed=True,
                sharpness_ratio=ratio,
                reason_code=None,
            )

        return ValidationResult(
            passed=False,
            sharpness_ratio=ratio,
            reason_code=(
                "SHARPNESS_RATIO_EXCEEDED"
            ),
        )

    @staticmethod
    def laplacian_variance(
        roi: np.ndarray,
    ) -> float:

        gray = cv2.cvtColor(
            roi,
            cv2.COLOR_BGR2GRAY,
        )

        return float(
            cv2.Laplacian(
                gray,
                cv2.CV_64F,
            ).var()
        )
