import json
import math
import subprocess
import tempfile
import time
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path

import cv2

from app.common.exceptions import (
    VideoDecodeError,
    VideoEncodeError,
)
from app.core.config import settings
from app.services.blur.blur_service import BlurService
from app.services.blur.face_detector import FaceDetector
from app.services.blur.validation_service import (
    ValidationService,
)


@dataclass
class VideoProcessResult:
    final_status: str

    detected_face_count: int
    validated_face_count: int

    pass_count: int
    fail_count: int

    reason_codes: list[str]

    processing_time_seconds: float


@dataclass(frozen=True)
class VideoMetadata:
    width: int
    height: int
    fps: float
    duration_seconds: float
    declared_frame_count: int | None
    decoded_frame_count: int


class VideoService:

    def __init__(
        self,
        detector: FaceDetector,
    ) -> None:

        self.detector = detector
        self.blur_service = BlurService()
        self.validator = ValidationService()

    def process(
        self,
        input_path: str,
        output_path: str,
    ) -> VideoProcessResult:

        started = time.perf_counter()
        input_metadata = self._probe_video(
            input_path,
            VideoDecodeError,
        )
        self._verify_full_decode(
            input_path,
            VideoDecodeError,
        )
        self._validate_input_metadata(
            input_metadata
        )

        capture = cv2.VideoCapture(
            input_path
        )

        if not capture.isOpened():
            raise VideoDecodeError(
                f"Cannot open video: {input_path}"
            )

        silent_output_path = self._create_silent_output_path(
            output_path
        )

        fps = capture.get(
            cv2.CAP_PROP_FPS
        )

        width = int(
            capture.get(
                cv2.CAP_PROP_FRAME_WIDTH
            )
        )

        height = int(
            capture.get(
                cv2.CAP_PROP_FRAME_HEIGHT
            )
        )

        writer = cv2.VideoWriter(
            silent_output_path,
            # opencv 타입 스텁에 이 함수가 빠져 있다. 런타임에는 존재한다.
            cv2.VideoWriter_fourcc(  # type: ignore[attr-defined]
                *"mp4v"
            ),
            fps,
            (width, height),
        )

        if not writer.isOpened():
            capture.release()
            Path(silent_output_path).unlink(
                missing_ok=True
            )
            raise VideoEncodeError(
                f"Cannot create output video: {output_path}"
            )

        detected = 0
        validated = 0
        passed = 0
        failed = 0

        reasons: set[str] = set()

        detected_frame_count = 0
        processed_frame_count = 0

        try:
            while True:
                ok, frame = capture.read()

                if not ok:
                    break

                original = frame.copy()

                faces = self.detector.detect(
                    original
                )

                blurred = frame.copy()

                records = []

                for face in faces:
                    detected += 1

                    blurred, blur_bbox = (
                        self.blur_service.apply(
                            blurred,
                            face.bbox,
                        )
                    )

                    records.append(
                        blur_bbox
                    )

                if records:
                    should_validate = (
                        detected_frame_count
                        % settings.validate_interval
                        == 0
                    )

                    detected_frame_count += 1

                    if should_validate:
                        for blur_bbox in records:

                            result = (
                                self.validator.validate(
                                    original,
                                    blurred,
                                    blur_bbox,
                                )
                            )

                            validated += 1

                            if result.passed:
                                passed += 1

                            else:
                                failed += 1

                                if result.reason_code:
                                    reasons.add(
                                        result.reason_code
                                    )

                writer.write(
                    blurred
                )
                processed_frame_count += 1

        except Exception:
            capture.release()
            writer.release()
            Path(silent_output_path).unlink(
                missing_ok=True
            )
            raise

        finally:
            capture.release()
            writer.release()

        try:
            self._validate_processed_video(
                input_metadata=input_metadata,
                processed_frame_count=processed_frame_count,
                fps=fps,
                width=width,
                height=height,
            )
        except Exception:
            Path(silent_output_path).unlink(
                missing_ok=True
            )
            raise

        try:
            self._merge_original_audio(
                silent_output_path,
                input_path,
                output_path,
            )
        finally:
            Path(silent_output_path).unlink(
                missing_ok=True
            )

        try:
            output_metadata = self._probe_video(
                output_path,
                VideoEncodeError,
            )
            self._verify_full_decode(
                output_path,
                VideoEncodeError,
            )
            self._validate_output_video(
                input_metadata=input_metadata,
                output_metadata=output_metadata,
                processed_frame_count=processed_frame_count,
                fps=fps,
                width=width,
                height=height,
            )
        except Exception:
            Path(output_path).unlink(
                missing_ok=True
            )
            raise

        if detected == 0:
            reasons.add("NO_FACE_DETECTED")

        if detected > 0 and validated == 0:
            reasons.add("NO_FACE_VALIDATED")

        final_status = "PASS" if not reasons else "FAIL"

        return VideoProcessResult(
            final_status=final_status,

            detected_face_count=detected,
            validated_face_count=validated,

            pass_count=passed,
            fail_count=failed,

            reason_codes=sorted(
                reasons
            ),

            processing_time_seconds=(
                time.perf_counter()
                - started
            ),
        )

    @staticmethod
    def _probe_video(
        video_path: str,
        error_type: type[VideoDecodeError]
        | type[VideoEncodeError],
    ) -> VideoMetadata:
        command = [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-count_frames",
            "-show_entries",
            (
                "stream=width,height,avg_frame_rate,"
                "duration,nb_frames,nb_read_frames:"
                "format=duration"
            ),
            "-of",
            "json",
            video_path,
        ]
        completed = VideoService._run_media_command(
            command,
            error_type,
            "FFprobe failed",
        )

        try:
            payload = json.loads(completed.stdout)
            stream = payload["streams"][0]
            width = int(stream["width"])
            height = int(stream["height"])
            fps = float(
                Fraction(stream["avg_frame_rate"])
            )
            stream_duration = stream.get(
                "duration"
            )
            duration_value = (
                payload["format"]["duration"]
                if stream_duration in (None, "N/A")
                else stream_duration
            )
            duration = float(
                duration_value
            )
            declared_frames_value = stream.get(
                "nb_frames"
            )
            declared_frame_count = (
                int(declared_frames_value)
                if declared_frames_value
                not in (None, "N/A")
                else None
            )
            decoded_frame_count = int(
                stream["nb_read_frames"]
            )
        except (
            IndexError,
            KeyError,
            TypeError,
            ValueError,
            ZeroDivisionError,
        ) as error:
            raise error_type(
                f"Invalid video metadata: {video_path}"
            ) from error

        if (
            width <= 0
            or height <= 0
            or not math.isfinite(fps)
            or fps <= 0
            or not math.isfinite(duration)
            or duration <= 0
            or decoded_frame_count <= 0
        ):
            raise error_type(
                f"Invalid video metadata: {video_path}"
            )

        return VideoMetadata(
            width=width,
            height=height,
            fps=fps,
            duration_seconds=duration,
            declared_frame_count=declared_frame_count,
            decoded_frame_count=decoded_frame_count,
        )

    @staticmethod
    def _verify_full_decode(
        video_path: str,
        error_type: type[VideoDecodeError]
        | type[VideoEncodeError],
    ) -> None:
        VideoService._run_media_command(
            [
                "ffmpeg",
                "-v",
                "error",
                "-xerror",
                "-i",
                video_path,
                "-map",
                "0:v:0",
                "-f",
                "null",
                "-",
            ],
            error_type,
            "Video cannot be decoded completely",
        )

    @staticmethod
    def _run_media_command(
        command: list[str],
        error_type: type[VideoDecodeError]
        | type[VideoEncodeError],
        message: str,
    ) -> subprocess.CompletedProcess[str]:
        try:
            completed = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=False,
            )
        except OSError as error:
            raise error_type(
                f"Cannot run {command[0]}: {error}"
            ) from error

        if completed.returncode != 0:
            detail = completed.stderr.strip()
            raise error_type(
                message
                + (f": {detail}" if detail else "")
            )

        return completed

    @staticmethod
    def _frame_tolerance(
        frame_count: int,
    ) -> int:
        return max(
            1,
            math.ceil(frame_count * 0.001),
        )

    @classmethod
    def _validate_input_metadata(
        cls,
        metadata: VideoMetadata,
    ) -> None:
        if metadata.declared_frame_count is None:
            return

        difference = abs(
            metadata.declared_frame_count
            - metadata.decoded_frame_count
        )
        if difference > cls._frame_tolerance(
            metadata.declared_frame_count
        ):
            raise VideoDecodeError(
                "Input frame count mismatch: "
                f"declared={metadata.declared_frame_count}, "
                f"decoded={metadata.decoded_frame_count}"
            )

    @classmethod
    def _validate_processed_video(
        cls,
        input_metadata: VideoMetadata,
        processed_frame_count: int,
        fps: float,
        width: int,
        height: int,
    ) -> None:
        if processed_frame_count == 0:
            raise VideoDecodeError(
                "No video frames could be decoded"
            )

        if (
            width != input_metadata.width
            or height != input_metadata.height
            or not math.isfinite(fps)
            or fps <= 0
            or abs(fps - input_metadata.fps)
            > max(0.01, input_metadata.fps * 0.001)
        ):
            raise VideoDecodeError(
                "Input video properties changed or are invalid"
            )

        difference = abs(
            input_metadata.decoded_frame_count
            - processed_frame_count
        )
        if difference > cls._frame_tolerance(
            input_metadata.decoded_frame_count
        ):
            raise VideoDecodeError(
                "Processed frame count mismatch: "
                f"expected={input_metadata.decoded_frame_count}, "
                f"processed={processed_frame_count}"
            )

        processed_duration = processed_frame_count / fps
        duration_tolerance = max(
            0.1,
            1 / fps,
        )
        if (
            abs(
                input_metadata.duration_seconds
                - processed_duration
            )
            > duration_tolerance
        ):
            raise VideoDecodeError(
                "Input duration mismatch: "
                f"metadata={input_metadata.duration_seconds:.3f}, "
                f"processed={processed_duration:.3f}"
            )

    @classmethod
    def _validate_output_video(
        cls,
        input_metadata: VideoMetadata,
        output_metadata: VideoMetadata,
        processed_frame_count: int,
        fps: float,
        width: int,
        height: int,
    ) -> None:
        if (
            output_metadata.width != width
            or output_metadata.height != height
            or abs(output_metadata.fps - fps)
            > max(0.01, fps * 0.001)
        ):
            raise VideoEncodeError(
                "Output resolution or frame rate does not match input"
            )

        if output_metadata.declared_frame_count is not None:
            declared_difference = abs(
                output_metadata.declared_frame_count
                - output_metadata.decoded_frame_count
            )
            if declared_difference > cls._frame_tolerance(
                output_metadata.declared_frame_count
            ):
                raise VideoEncodeError(
                    "Output declared and decoded frame counts "
                    "do not match"
                )

        frame_difference = abs(
            output_metadata.decoded_frame_count
            - processed_frame_count
        )
        if frame_difference > cls._frame_tolerance(
            processed_frame_count
        ):
            raise VideoEncodeError(
                "Output frame count mismatch: "
                f"expected={processed_frame_count}, "
                f"decoded={output_metadata.decoded_frame_count}"
            )

        expected_duration = processed_frame_count / fps
        duration_tolerance = max(
            0.1,
            1 / fps,
        )
        if (
            abs(
                output_metadata.duration_seconds
                - expected_duration
            )
            > duration_tolerance
            or abs(
                output_metadata.duration_seconds
                - input_metadata.duration_seconds
            )
            > duration_tolerance
        ):
            raise VideoEncodeError(
                "Output duration does not match input"
            )

    @staticmethod
    def _create_silent_output_path(
        output_path: str,
    ) -> str:
        output = Path(output_path)
        output.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        with tempfile.NamedTemporaryFile(
            prefix=f".{output.stem}-silent-",
            suffix=".mp4",
            dir=output.parent,
            delete=False,
        ) as temporary_file:
            temporary_path = temporary_file.name

        Path(temporary_path).unlink(
            missing_ok=True
        )
        return temporary_path

    @staticmethod
    def _merge_original_audio(
        silent_video_path: str,
        original_video_path: str,
        output_path: str,
    ) -> None:
        command = [
            "ffmpeg",
            "-y",
            "-i",
            silent_video_path,
            "-i",
            original_video_path,
            "-map",
            "0:v:0",
            "-map",
            "1:a:0?",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "23",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            "-movflags",
            "+faststart",
            output_path,
        ]

        try:
            completed = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=False,
            )
        except OSError as error:
            raise VideoEncodeError(
                f"Cannot run FFmpeg: {error}"
            ) from error

        if completed.returncode != 0:
            Path(output_path).unlink(
                missing_ok=True
            )
            error_message = completed.stderr.strip()
            raise VideoEncodeError(
                "FFmpeg failed to create output video"
                + (
                    f": {error_message}"
                    if error_message
                    else ""
                )
            )
