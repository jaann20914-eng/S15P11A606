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

        frame_height, frame_width = frame.shape[:2]

        blur_bbox = self.expand_bbox(
            face_bbox,
            frame_width,
            frame_height,
        )
        validation_bbox = self.clip_bbox(
            face_bbox,
            frame_width,
            frame_height,
        )

        x1, y1, x2, y2 = blur_bbox

        roi = frame[y1:y2, x1:x2]

        if roi.size == 0:
            return frame, validation_bbox

        height, width = roi.shape[:2]

        if width < 3 or height < 3:
            return frame, validation_bbox

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

        feather_mask = self.create_feather_mask(
            face_bbox,
            blur_bbox,
        )

        if settings.blur_feather_ratio == 0.0:
            frame[y1:y2, x1:x2] = blurred
        else:
            alpha = (
                feather_mask
                if roi.ndim == 2
                else feather_mask[:, :, np.newaxis]
            )
            original_float = roi.astype(
                np.float32
            )
            blurred_float = blurred.astype(
                np.float32
            )
            blended = (
                original_float * (1.0 - alpha)
                + blurred_float * alpha
            )
            frame[y1:y2, x1:x2] = np.clip(
                blended,
                0,
                255,
            ).astype(frame.dtype)

        return frame, validation_bbox

    @staticmethod
    def create_feather_mask(
        face_bbox: BBox,
        blur_bbox: BBox,
    ) -> np.ndarray:
        face_x1, face_y1, face_x2, face_y2 = (
            face_bbox
        )
        blur_x1, blur_y1, blur_x2, blur_y2 = (
            blur_bbox
        )

        width = max(0, blur_x2 - blur_x1)
        height = max(0, blur_y2 - blur_y1)

        inner_x1 = min(
            max(face_x1 - blur_x1, 0),
            width,
        )
        inner_y1 = min(
            max(face_y1 - blur_y1, 0),
            height,
        )
        inner_x2 = min(
            max(face_x2 - blur_x1, 0),
            width,
        )
        inner_y2 = min(
            max(face_y2 - blur_y1, 0),
            height,
        )

        feather_width = round(
            max(0, face_x2 - face_x1)
            * settings.blur_feather_ratio
        )
        feather_height = round(
            max(0, face_y2 - face_y1)
            * settings.blur_feather_ratio
        )

        horizontal = BlurService._create_axis_mask(
            length=width,
            inner_start=inner_x1,
            inner_end=inner_x2,
            feather_size=feather_width,
        )
        vertical = BlurService._create_axis_mask(
            length=height,
            inner_start=inner_y1,
            inner_end=inner_y2,
            feather_size=feather_height,
        )

        feather_mask: np.ndarray = (
            vertical[:, np.newaxis]
            * horizontal[np.newaxis, :]
        )

        return feather_mask

    @staticmethod
    def _create_axis_mask(
        length: int,
        inner_start: int,
        inner_end: int,
        feather_size: int,
    ) -> np.ndarray:
        mask = np.ones(
            length,
            dtype=np.float32,
        )

        if (
            length == 0
            or inner_start >= inner_end
            or feather_size <= 0
        ):
            return mask

        positions = np.arange(
            length,
            dtype=np.float32,
        )
        before = positions < inner_start
        after = positions >= inner_end

        mask[before] = np.clip(
            1.0
            - (
                inner_start
                - positions[before]
            )
            / feather_size,
            0.0,
            1.0,
        )
        mask[after] = np.clip(
            1.0
            - (
                positions[after]
                - inner_end
                + 1.0
            )
            / feather_size,
            0.0,
            1.0,
        )

        return mask

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

        return BlurService.clip_bbox(
            (
                x1 - mx,
                y1 - my,
                x2 + mx,
                y2 + my,
            ),
            frame_width,
            frame_height,
        )

    @staticmethod
    def clip_bbox(
        bbox: BBox,
        frame_width: int,
        frame_height: int,
    ) -> BBox:
        x1, y1, x2, y2 = bbox

        return (
            min(max(0, x1), frame_width),
            min(max(0, y1), frame_height),
            min(max(0, x2), frame_width),
            min(max(0, y2), frame_height),
        )
