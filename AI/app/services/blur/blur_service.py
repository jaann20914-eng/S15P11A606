import cv2
import numpy as np

from app.core.config import settings
from app.services.blur.face_detector import BBox


class BlurService:

    def apply(
        self,
        frame: np.ndarray,
        face_bbox: BBox,
    ) -> tuple[np.ndarray, BBox]:

        blur_bbox = self.expand_bbox(
            face_bbox,
            frame.shape[1],
            frame.shape[0],
        )

        x1, y1, x2, y2 = blur_bbox

        roi = frame[y1:y2, x1:x2]

        if roi.size == 0:
            return frame, blur_bbox

        height, width = roi.shape[:2]

        if width < 3 or height < 3:
            return frame, blur_bbox

        kernel = min(
            settings.blur_kernel_size,
            min(width, height),
        )

        if kernel % 2 == 0:
            kernel -= 1

        kernel = max(kernel, 3)

        blurred = roi.copy()

        for _ in range(
            settings.blur_iterations
        ):
            blurred = cv2.GaussianBlur(
                blurred,
                (kernel, kernel),
                0,
            )

        frame[y1:y2, x1:x2] = blurred

        return frame, blur_bbox

    @staticmethod
    def expand_bbox(
        bbox: BBox,
        frame_width: int,
        frame_height: int,
    ) -> BBox:

        x1, y1, x2, y2 = bbox

        width = x2 - x1
        height = y2 - y1

        mx = int(
            width * settings.margin_ratio
        )

        my = int(
            height * settings.margin_ratio
        )

        return (
            max(0, x1 - mx),
            max(0, y1 - my),
            min(frame_width, x2 + mx),
            min(frame_height, y2 + my),
        )
