import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import numpy as np
import pytest
from pydantic import ValidationError

from app.schemas.blur import BlurRequest, BlurResult
from app.services.blur.video_service import VideoProcessResult
from app.workers.blur_worker import BlurWorker

REQUEST_ID = UUID("11111111-1111-1111-1111-111111111111")
PIN_ID = UUID("22222222-2222-2222-2222-222222222222")


class FakeStorage:
    def __init__(self) -> None:
        self.uploads: list[tuple[str, str, str]] = []

    def download(
        self,
        object_key: str,
        destination: str | Path,
    ) -> Path:
        path = Path(destination)
        path.write_bytes(b"input")
        return path

    def upload(
        self,
        source: str | Path,
        object_key: str,
        content_type: str = "video/mp4",
    ) -> str:
        path = Path(source)
        assert path.is_file()
        assert path.stat().st_size > 0
        self.uploads.append(
            (
                path.name,
                object_key,
                content_type,
            )
        )
        return object_key


class FakeVideoService:
    def __init__(
        self,
        final_status: str,
    ) -> None:
        self.final_status = final_status

    def process(
        self,
        input_path: str,
        output_path: str,
    ) -> VideoProcessResult:
        assert Path(input_path).is_file()
        Path(output_path).write_bytes(b"blurred-video")

        return VideoProcessResult(
            final_status=self.final_status,
            thumbnail_frame=np.full(
                (480, 640, 3),
                127,
                dtype=np.uint8,
            ),
            detected_face_count=1,
            validated_face_count=1,
            pass_count=(
                1
                if self.final_status == "PASS"
                else 0
            ),
            fail_count=(
                0
                if self.final_status == "PASS"
                else 1
            ),
            reason_codes=(
                []
                if self.final_status == "PASS"
                else ["BLUR_TOO_WEAK"]
            ),
            processing_time_seconds=1.25,
        )


def make_request() -> BlurRequest:
    return BlurRequest(
        requestId=REQUEST_ID,
        pinId=PIN_ID,
        originalVideoKey="pins/original/7/input.mp4",
        requestedAt=datetime.now(timezone.utc),
    )


def test_pass_creates_and_uploads_thumbnail_before_video() -> None:
    storage = FakeStorage()
    worker = BlurWorker(
        storage=storage,  # type: ignore[arg-type]
        video_service=FakeVideoService("PASS"),  # type: ignore[arg-type]
    )

    result = worker._process_request_sync(make_request())

    expected_thumbnail_key = (
        f"pins/thumbnails/{PIN_ID}/{REQUEST_ID}.webp"
    )
    expected_blurred_video_key = (
        f"pins/blurred/{PIN_ID}/{REQUEST_ID}.mp4"
    )

    assert result.finalStatus == "PASS"
    assert result.thumbnailKey == expected_thumbnail_key
    assert result.blurredVideoKey == expected_blurred_video_key
    assert storage.uploads == [
        (
            "thumbnail.webp",
            expected_thumbnail_key,
            "image/webp",
        ),
        (
            "output.mp4",
            expected_blurred_video_key,
            "video/mp4",
        ),
    ]


def test_validation_fail_does_not_upload_result_files() -> None:
    storage = FakeStorage()
    worker = BlurWorker(
        storage=storage,  # type: ignore[arg-type]
        video_service=FakeVideoService("FAIL"),  # type: ignore[arg-type]
    )

    result = worker._process_request_sync(make_request())

    assert result.finalStatus == "FAIL"
    assert result.blurredVideoKey is None
    assert result.thumbnailKey is None
    assert result.code == "BLUR_VALIDATION_FAILED"
    assert storage.uploads == []


def test_pass_result_requires_thumbnail_key() -> None:
    with pytest.raises(
        ValidationError,
        match="PASS requires thumbnailKey",
    ):
        BlurResult(
            requestId=REQUEST_ID,
            pinId=PIN_ID,
            processingStatus="COMPLETED",
            finalStatus="PASS",
            blurredVideoKey="pins/blurred/video.mp4",
            thumbnailKey=None,
            completedAt=datetime.now(timezone.utc),
        )


def test_failed_payload_contains_null_result_keys() -> None:
    result = BlurResult(
        requestId=REQUEST_ID,
        pinId=PIN_ID,
        processingStatus="FAILED",
        finalStatus=None,
        blurredVideoKey=None,
        thumbnailKey=None,
        errorCode="THUMBNAIL_GENERATION_FAILED",
        completedAt=datetime.now(timezone.utc),
    )

    payload = result.to_message_payload()

    assert payload["finalStatus"] is None
    assert payload["blurredVideoKey"] is None
    assert payload["thumbnailKey"] is None


@pytest.mark.parametrize(
    ("redelivered", "expected_requeue"),
    [
        (False, True),
        (True, False),
    ],
)
def test_publish_failure_retries_once_then_dead_letters(
    redelivered: bool,
    expected_requeue: bool,
) -> None:
    request = make_request()
    result = BlurResult(
        requestId=REQUEST_ID,
        pinId=PIN_ID,
        processingStatus="COMPLETED",
        finalStatus="PASS",
        blurredVideoKey="pins/blurred/video.mp4",
        thumbnailKey="pins/thumbnails/thumbnail.webp",
        completedAt=datetime.now(timezone.utc),
    )
    message = MagicMock()
    message.body = json.dumps(
        request.model_dump(mode="json")
    ).encode("utf-8")
    message.redelivered = redelivered
    message.reject = AsyncMock()
    message.ack = AsyncMock()
    worker = BlurWorker()

    with (
        patch.object(
            worker,
            "process_request",
            AsyncMock(return_value=result),
        ),
        patch(
            "app.workers.blur_worker.publish_result",
            AsyncMock(side_effect=RuntimeError("publish failed")),
        ),
    ):
        asyncio.run(worker.handle_message(message))

    message.reject.assert_awaited_once_with(
        requeue=expected_requeue
    )
    message.ack.assert_not_awaited()
