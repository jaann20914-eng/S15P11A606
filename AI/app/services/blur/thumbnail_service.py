from pathlib import Path

import cv2
import numpy as np

from app.common.exceptions import ThumbnailGenerationError


class ThumbnailService:
    def __init__(
        self,
        webp_quality: int = 85,
        max_dimension: int = 720,
    ) -> None:
        if not 1 <= webp_quality <= 100:
            raise ValueError("webp_quality must be between 1 and 100.")
        if max_dimension <= 0:
            raise ValueError("max_dimension must be greater than zero.")

        self.webp_quality = webp_quality
        self.max_dimension = max_dimension

    def save_webp(
        self,
        frame: np.ndarray,
        output_path: str | Path,
    ) -> Path:
        if frame.size == 0 or frame.ndim not in (2, 3):
            raise ThumbnailGenerationError(
                "Thumbnail source frame is empty or invalid."
            )

        path = Path(output_path)

        try:
            path.parent.mkdir(
                parents=True,
                exist_ok=True,
            )
        except OSError as exc:
            raise ThumbnailGenerationError(
                f"Failed to create thumbnail directory: {path.parent}"
            ) from exc

        if not cv2.haveImageWriter(".webp"):
            raise ThumbnailGenerationError(
                "OpenCV WebP encoder is unavailable."
            )

        resized = self._resize_if_needed(frame)

        try:
            saved = cv2.imwrite(
                str(path),
                resized,
                [
                    cv2.IMWRITE_WEBP_QUALITY,
                    self.webp_quality,
                ],
            )
        except (cv2.error, OSError) as exc:
            raise ThumbnailGenerationError(
                f"Failed to encode thumbnail: {path}"
            ) from exc

        try:
            is_valid_file = (
                saved
                and path.is_file()
                and path.stat().st_size > 0
            )
        except OSError as exc:
            raise ThumbnailGenerationError(
                f"Failed to verify thumbnail: {path}"
            ) from exc

        if not is_valid_file:
            raise ThumbnailGenerationError(
                f"Thumbnail file was not created correctly: {path}"
            )

        return path

    def _resize_if_needed(
        self,
        frame: np.ndarray,
    ) -> np.ndarray:
        height, width = frame.shape[:2]

        if height <= 0 or width <= 0:
            raise ThumbnailGenerationError(
                "Thumbnail source frame has invalid dimensions."
            )

        longest_dimension = max(width, height)
        if longest_dimension <= self.max_dimension:
            return frame

        ratio = self.max_dimension / longest_dimension
        resized_width = max(1, round(width * ratio))
        resized_height = max(1, round(height * ratio))

        return cv2.resize(
            frame,
            (resized_width, resized_height),
            interpolation=cv2.INTER_AREA,
        )
