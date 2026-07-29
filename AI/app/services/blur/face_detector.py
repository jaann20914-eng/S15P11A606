from dataclasses import dataclass

import numpy as np
import onnxruntime as ort
from insightface.app import FaceAnalysis

from app.common.exceptions import ModelExecutionError
from app.core.config import settings

BBox = tuple[int, int, int, int]


@dataclass(frozen=True)
class FaceDetection:
    bbox: BBox
    confidence: float


class FaceDetector:
    def __init__(self) -> None:
        try:
            available = ort.get_available_providers()

            if "CUDAExecutionProvider" in available:
                providers = [
                    "CUDAExecutionProvider",
                    "CPUExecutionProvider",
                ]
                ctx_id = 0

            else:
                providers = [
                    "CPUExecutionProvider",
                ]
                ctx_id = -1

            self.app = FaceAnalysis(
                name=settings.model_name,
                allowed_modules=["detection"],
                providers=providers,
            )

            self.app.prepare(
                ctx_id=ctx_id,
                det_thresh=settings.det_threshold,
                det_size=(
                    settings.det_width,
                    settings.det_height,
                ),
            )

        except Exception as exc:
            raise ModelExecutionError(
                "SCRFD model initialization failed."
            ) from exc

    def detect(
        self,
        frame: np.ndarray,
    ) -> list[FaceDetection]:

        try:
            faces = self.app.get(frame)

        except Exception as exc:
            raise ModelExecutionError(
                "SCRFD inference failed."
            ) from exc

        result: list[FaceDetection] = []

        for face in faces:
            x1, y1, x2, y2 = map(
                int,
                np.round(face.bbox),
            )

            result.append(
                FaceDetection(
                    bbox=(x1, y1, x2, y2),
                    confidence=float(face.det_score),
                )
            )

        return result
