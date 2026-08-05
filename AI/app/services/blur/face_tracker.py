from dataclasses import dataclass
from typing import Sequence

from app.services.blur.face_detector import BBox, FaceDetection

FloatBBox = tuple[float, float, float, float]


@dataclass(frozen=True)
class TrackedFace:
    bbox: BBox
    detected_this_frame: bool


@dataclass
class _FaceTrack:
    track_id: int
    bbox: FloatBBox
    missed_frames: int = 0


class FaceTracker:
    def __init__(
        self,
        iou_threshold: float,
        smoothing_alpha: float,
        max_missed_frames: int,
    ) -> None:
        if not 0.0 < iou_threshold <= 1.0:
            raise ValueError(
                "iou_threshold must be greater than 0 and at most 1."
            )
        if not 0.0 < smoothing_alpha <= 1.0:
            raise ValueError(
                "smoothing_alpha must be greater than 0 and at most 1."
            )
        if max_missed_frames < 0:
            raise ValueError(
                "max_missed_frames must be greater than or equal to 0."
            )

        self.iou_threshold = iou_threshold
        self.smoothing_alpha = smoothing_alpha
        self.max_missed_frames = max_missed_frames

        self._tracks: dict[int, _FaceTrack] = {}
        self._next_track_id = 1

    def update(
        self,
        detections: Sequence[FaceDetection],
    ) -> list[TrackedFace]:
        detection_boxes = [
            self._to_float_bbox(detection.bbox)
            for detection in detections
        ]
        candidates = self._build_match_candidates(
            detection_boxes
        )

        matched_track_ids: set[int] = set()
        matched_detection_indexes: set[int] = set()

        for _, track_id, detection_index in candidates:
            if (
                track_id in matched_track_ids
                or detection_index in matched_detection_indexes
            ):
                continue

            track = self._tracks[track_id]
            track.bbox = self._smooth_bbox(
                track.bbox,
                detection_boxes[detection_index],
            )
            track.missed_frames = 0

            matched_track_ids.add(track_id)
            matched_detection_indexes.add(
                detection_index
            )

        for track_id in list(self._tracks):
            if track_id in matched_track_ids:
                continue

            track = self._tracks[track_id]
            track.missed_frames += 1

            if (
                track.missed_frames
                > self.max_missed_frames
            ):
                del self._tracks[track_id]

        observed_track_ids = set(matched_track_ids)

        for detection_index, bbox in enumerate(
            detection_boxes
        ):
            if detection_index in matched_detection_indexes:
                continue

            track_id = self._next_track_id
            self._next_track_id += 1
            self._tracks[track_id] = _FaceTrack(
                track_id=track_id,
                bbox=bbox,
            )
            observed_track_ids.add(track_id)

        return [
            TrackedFace(
                bbox=self._to_int_bbox(track.bbox),
                detected_this_frame=(
                    track_id in observed_track_ids
                ),
            )
            for track_id, track in sorted(
                self._tracks.items()
            )
        ]

    def _build_match_candidates(
        self,
        detection_boxes: Sequence[FloatBBox],
    ) -> list[tuple[float, int, int]]:
        candidates: list[tuple[float, int, int]] = []

        for track_id, track in self._tracks.items():
            for detection_index, bbox in enumerate(
                detection_boxes
            ):
                iou = self._calculate_iou(
                    track.bbox,
                    bbox,
                )

                if iou >= self.iou_threshold:
                    candidates.append(
                        (
                            iou,
                            track_id,
                            detection_index,
                        )
                    )

        return sorted(
            candidates,
            key=lambda candidate: (
                -candidate[0],
                candidate[1],
                candidate[2],
            ),
        )

    def _smooth_bbox(
        self,
        previous: FloatBBox,
        current: FloatBBox,
    ) -> FloatBBox:
        previous_weight = (
            1.0 - self.smoothing_alpha
        )

        return (
            previous[0] * previous_weight
            + current[0] * self.smoothing_alpha,
            previous[1] * previous_weight
            + current[1] * self.smoothing_alpha,
            previous[2] * previous_weight
            + current[2] * self.smoothing_alpha,
            previous[3] * previous_weight
            + current[3] * self.smoothing_alpha,
        )

    @staticmethod
    def _calculate_iou(
        first: FloatBBox,
        second: FloatBBox,
    ) -> float:
        intersection_x1 = max(first[0], second[0])
        intersection_y1 = max(first[1], second[1])
        intersection_x2 = min(first[2], second[2])
        intersection_y2 = min(first[3], second[3])

        intersection_width = max(
            0.0,
            intersection_x2 - intersection_x1,
        )
        intersection_height = max(
            0.0,
            intersection_y2 - intersection_y1,
        )
        intersection_area = (
            intersection_width
            * intersection_height
        )

        first_area = max(
            0.0,
            first[2] - first[0],
        ) * max(
            0.0,
            first[3] - first[1],
        )
        second_area = max(
            0.0,
            second[2] - second[0],
        ) * max(
            0.0,
            second[3] - second[1],
        )
        union_area = (
            first_area
            + second_area
            - intersection_area
        )

        if union_area <= 0.0:
            return 0.0

        return intersection_area / union_area

    @staticmethod
    def _to_float_bbox(
        bbox: BBox,
    ) -> FloatBBox:
        return (
            float(bbox[0]),
            float(bbox[1]),
            float(bbox[2]),
            float(bbox[3]),
        )

    @staticmethod
    def _to_int_bbox(
        bbox: FloatBBox,
    ) -> BBox:
        return (
            round(bbox[0]),
            round(bbox[1]),
            round(bbox[2]),
            round(bbox[3]),
        )
