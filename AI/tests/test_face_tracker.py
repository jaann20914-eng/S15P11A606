import pytest

from app.services.blur.face_detector import FaceDetection
from app.services.blur.face_tracker import FaceTracker


def make_detection(
    bbox: tuple[int, int, int, int],
) -> FaceDetection:
    return FaceDetection(
        bbox=bbox,
        confidence=0.9,
    )


def make_tracker(
    *,
    iou_threshold: float = 0.3,
    smoothing_alpha: float = 0.3,
    max_missed_frames: int = 3,
) -> FaceTracker:
    return FaceTracker(
        iou_threshold=iou_threshold,
        smoothing_alpha=smoothing_alpha,
        max_missed_frames=max_missed_frames,
    )


def test_starts_tracks_for_multiple_detections() -> None:
    tracker = make_tracker()

    tracked_faces = tracker.update(
        [
            make_detection((10, 10, 50, 50)),
            make_detection((100, 20, 150, 70)),
        ]
    )

    assert [
        tracked_face.bbox
        for tracked_face in tracked_faces
    ] == [
        (10, 10, 50, 50),
        (100, 20, 150, 70),
    ]
    assert all(
        tracked_face.detected_this_frame
        for tracked_face in tracked_faces
    )


def test_matches_by_iou_and_smooths_bbox() -> None:
    tracker = make_tracker()
    tracker.update(
        [make_detection((50, 10, 130, 90))]
    )

    tracked_faces = tracker.update(
        [make_detection((70, 10, 150, 90))]
    )

    assert len(tracked_faces) == 1
    assert tracked_faces[0].bbox == (
        56,
        10,
        136,
        90,
    )
    assert tracked_faces[0].detected_this_frame


def test_keeps_track_for_three_missed_frames_then_expires(
) -> None:
    tracker = make_tracker(
        max_missed_frames=3
    )
    tracker.update(
        [make_detection((10, 20, 50, 60))]
    )

    for _ in range(3):
        tracked_faces = tracker.update([])

        assert len(tracked_faces) == 1
        assert tracked_faces[0].bbox == (
            10,
            20,
            50,
            60,
        )
        assert not tracked_faces[0].detected_this_frame

    assert tracker.update([]) == []


def test_matches_multiple_faces_one_to_one() -> None:
    tracker = make_tracker(
        smoothing_alpha=1.0
    )
    tracker.update(
        [
            make_detection((10, 10, 50, 50)),
            make_detection((100, 10, 140, 50)),
        ]
    )

    tracked_faces = tracker.update(
        [
            make_detection((15, 10, 55, 50)),
            make_detection((95, 10, 135, 50)),
        ]
    )

    assert [
        tracked_face.bbox
        for tracked_face in tracked_faces
    ] == [
        (15, 10, 55, 50),
        (95, 10, 135, 50),
    ]
    assert all(
        tracked_face.detected_this_frame
        for tracked_face in tracked_faces
    )


@pytest.mark.parametrize(
    (
        "iou_threshold",
        "smoothing_alpha",
        "max_missed_frames",
    ),
    [
        (-0.1, 0.3, 3),
        (0.0, 0.3, 3),
        (1.1, 0.3, 3),
        (0.3, 0.0, 3),
        (0.3, 1.1, 3),
        (0.3, 0.3, -1),
    ],
)
def test_rejects_invalid_configuration(
    iou_threshold: float,
    smoothing_alpha: float,
    max_missed_frames: int,
) -> None:
    with pytest.raises(ValueError):
        FaceTracker(
            iou_threshold=iou_threshold,
            smoothing_alpha=smoothing_alpha,
            max_missed_frames=max_missed_frames,
        )
