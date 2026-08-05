from unittest.mock import MagicMock, patch

import cv2
import numpy as np
import pytest

from app.common.exceptions import VideoDecodeError, VideoEncodeError
from app.services.blur.face_detector import FaceDetection
from app.services.blur.validation_service import ValidationResult
from app.services.blur.video_service import (
    VideoMetadata,
    VideoService,
)


def test_validate_processed_video_accepts_auto_rotated_dimensions(
) -> None:
    metadata = VideoMetadata(
        width=1280,
        height=720,
        fps=30.0,
        duration_seconds=3.0,
        declared_frame_count=90,
        decoded_frame_count=90,
    )

    VideoService._validate_processed_video(
        input_metadata=metadata,
        processed_frame_count=90,
        fps=30.0,
        width=720,
        height=1280,
        orientation_degrees=90.0,
    )


def test_validate_processed_video_rejects_swapped_dimensions_without_rotation(
) -> None:
    metadata = VideoMetadata(
        width=1280,
        height=720,
        fps=30.0,
        duration_seconds=3.0,
        declared_frame_count=90,
        decoded_frame_count=90,
    )

    with pytest.raises(
        VideoDecodeError,
        match="Input video properties changed",
    ):
        VideoService._validate_processed_video(
            input_metadata=metadata,
            processed_frame_count=90,
            fps=30.0,
            width=720,
            height=1280,
            orientation_degrees=0.0,
        )


@patch("app.services.blur.video_service.subprocess.Popen")
def test_start_output_encoder_uses_raw_frames_and_original_audio(
    popen: MagicMock,
) -> None:
    encoder = MagicMock()
    popen.return_value = encoder

    with patch(
        "app.services.blur.video_service.Path.mkdir"
    ) as mkdir:
        result = VideoService._start_output_encoder(
            original_video_path="input.mp4",
            output_path="nested/output.mp4",
            fps=29.97,
            width=1920,
            height=1080,
        )

    assert result is encoder
    mkdir.assert_called_once_with(
        parents=True,
        exist_ok=True,
    )

    command = popen.call_args.args[0]
    assert command[:2] == ["ffmpeg", "-y"]
    assert ["-f", "rawvideo"] == command[5:7]
    assert "pipe:0" in command
    assert "input.mp4" in command
    assert "mp4v" not in command

    video_map_index = command.index("0:v:0")
    audio_map_index = command.index("1:a:0?")
    assert video_map_index < audio_map_index
    assert command.count("-c:v") == 1
    assert command[command.index("-c:v") + 1] == "libx264"
    assert command[command.index("-c:a") + 1] == "aac"
    assert command.index("-apad") < command.index("-shortest")


def test_write_output_frame_sends_all_frame_bytes() -> None:
    encoder = MagicMock()
    frame = np.zeros((2, 3, 3), dtype=np.uint8)
    encoder.stdin.write.return_value = frame.nbytes

    VideoService._write_output_frame(
        encoder,
        frame,
    )

    encoder.stdin.write.assert_called_once_with(
        frame.tobytes()
    )


def test_write_output_frame_rejects_partial_write() -> None:
    encoder = MagicMock()
    frame = np.zeros((2, 3, 3), dtype=np.uint8)
    encoder.stdin.write.return_value = frame.nbytes - 1

    with pytest.raises(
        VideoEncodeError,
        match="incomplete video frame",
    ):
        VideoService._write_output_frame(
            encoder,
            frame,
        )


def test_finish_output_encoder_reports_ffmpeg_error() -> None:
    encoder = MagicMock()
    encoder.returncode = 1
    encoder.communicate.return_value = (
        None,
        b"encoder failed",
    )

    with pytest.raises(
        VideoEncodeError,
        match="encoder failed",
    ):
        VideoService._finish_output_encoder(
            encoder
        )


def test_finish_output_encoder_closes_input_and_waits() -> None:
    encoder = MagicMock()
    encoder_input = encoder.stdin
    encoder.returncode = 0
    encoder.communicate.return_value = (
        None,
        b"",
    )

    VideoService._finish_output_encoder(
        encoder
    )

    encoder_input.close.assert_called_once_with()
    encoder.communicate.assert_called_once_with()
    assert encoder.stdin is None


def test_process_blurs_held_track_without_counting_it_as_detection(
) -> None:
    frame = np.zeros((100, 100, 3), dtype=np.uint8)
    metadata = VideoMetadata(
        width=100,
        height=100,
        fps=30.0,
        duration_seconds=2 / 30,
        declared_frame_count=2,
        decoded_frame_count=2,
    )

    capture = MagicMock()
    capture.isOpened.return_value = True
    capture.get.side_effect = lambda property_id: {
        cv2.CAP_PROP_FPS: 30.0,
        cv2.CAP_PROP_FRAME_WIDTH: 100.0,
        cv2.CAP_PROP_FRAME_HEIGHT: 100.0,
        cv2.CAP_PROP_ORIENTATION_META: 0.0,
    }[property_id]
    capture.read.side_effect = [
        (True, frame.copy()),
        (True, frame.copy()),
        (False, None),
    ]

    detector = MagicMock()
    detector.detect.side_effect = [
        [
            FaceDetection(
                bbox=(20, 20, 50, 50),
                confidence=0.9,
            )
        ],
        [],
    ]
    service = VideoService(detector)

    apply_blur = MagicMock(
        side_effect=lambda current_frame, bbox: (
            current_frame,
            bbox,
        )
    )
    service.blur_service.apply = apply_blur
    validate_blur = MagicMock(
        return_value=ValidationResult(
            passed=True,
            sharpness_ratio=0.1,
            reason_code=None,
        )
    )
    service.validator.validate = validate_blur

    with (
        patch(
            "app.services.blur.video_service.cv2.VideoCapture",
            return_value=capture,
        ),
        patch.object(
            service,
            "_probe_video",
            side_effect=[metadata, metadata],
        ),
        patch.object(
            service,
            "_verify_full_decode",
        ),
        patch.object(
            service,
            "_validate_input_metadata",
        ),
        patch.object(
            service,
            "_start_output_encoder",
            return_value=MagicMock(),
        ),
        patch.object(
            service,
            "_write_output_frame",
        ),
        patch.object(
            service,
            "_validate_processed_video",
        ),
        patch.object(
            service,
            "_finish_output_encoder",
        ),
        patch.object(
            service,
            "_validate_output_video",
        ),
    ):
        result = service.process(
            "input.mp4",
            "output.mp4",
        )

    assert result.final_status == "PASS"
    assert result.detected_face_count == 1
    assert result.validated_face_count == 1
    assert apply_blur.call_count == 2
    validate_blur.assert_called_once()
