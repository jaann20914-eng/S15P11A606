from pathlib import Path

import cv2
import numpy as np
import pytest

from app.common.exceptions import ThumbnailGenerationError
from app.services.blur.thumbnail_service import ThumbnailService


def test_save_webp_resizes_longest_dimension(
    tmp_path: Path,
) -> None:
    frame = np.full(
        (1200, 600, 3),
        127,
        dtype=np.uint8,
    )
    output_path = tmp_path / "nested" / "thumbnail.webp"

    saved_path = ThumbnailService(
        max_dimension=300,
    ).save_webp(
        frame,
        output_path,
    )

    decoded = cv2.imread(str(saved_path))

    assert saved_path == output_path
    assert saved_path.stat().st_size > 0
    assert decoded is not None
    assert decoded.shape[:2] == (300, 150)


def test_save_webp_keeps_small_frame_dimensions(
    tmp_path: Path,
) -> None:
    frame = np.zeros(
        (240, 320, 3),
        dtype=np.uint8,
    )
    output_path = tmp_path / "thumbnail.webp"

    ThumbnailService(
        max_dimension=720,
    ).save_webp(
        frame,
        output_path,
    )

    decoded = cv2.imread(str(output_path))

    assert decoded is not None
    assert decoded.shape[:2] == (240, 320)


def test_save_webp_rejects_empty_frame(
    tmp_path: Path,
) -> None:
    frame = np.empty(
        (0, 0, 3),
        dtype=np.uint8,
    )

    with pytest.raises(
        ThumbnailGenerationError,
        match="empty or invalid",
    ):
        ThumbnailService().save_webp(
            frame,
            tmp_path / "thumbnail.webp",
        )


@pytest.mark.parametrize(
    ("quality", "max_dimension"),
    [
        (0, 720),
        (101, 720),
        (85, 0),
    ],
)
def test_thumbnail_service_rejects_invalid_configuration(
    quality: int,
    max_dimension: int,
) -> None:
    with pytest.raises(ValueError):
        ThumbnailService(
            webp_quality=quality,
            max_dimension=max_dimension,
        )
