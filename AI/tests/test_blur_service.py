import cv2
import numpy as np

from app.core.config import settings
from app.services.blur.blur_service import BlurService


def test_feather_mask_keeps_face_opaque_and_fades_margin(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        settings,
        "blur_feather_ratio",
        0.25,
    )

    mask = BlurService.create_feather_mask(
        face_bbox=(30, 30, 70, 70),
        blur_bbox=(20, 20, 80, 80),
    )

    assert mask.shape == (60, 60)
    assert np.all(mask[10:50, 10:50] == 1.0)
    assert mask[0, 30] == 0.0
    assert 0.0 < mask[5, 30] < 1.0
    assert mask[5, 5] < mask[5, 30]


def test_apply_fully_blurs_face_and_feathers_only_margin(
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "margin_ratio", 0.25)
    monkeypatch.setattr(
        settings,
        "blur_feather_ratio",
        0.25,
    )
    monkeypatch.setattr(
        settings,
        "blur_kernel_size",
        5,
    )
    monkeypatch.setattr(
        settings,
        "blur_iterations",
        1,
    )

    random = np.random.default_rng(42)
    original = random.integers(
        0,
        256,
        size=(100, 100, 3),
        dtype=np.uint8,
    )
    expected_blurred_roi = cv2.GaussianBlur(
        original[20:80, 20:80],
        (5, 5),
        0,
    )

    result, validation_bbox = BlurService().apply(
        original.copy(),
        (30, 30, 70, 70),
    )

    assert validation_bbox == (30, 30, 70, 70)
    assert np.array_equal(
        result[30:70, 30:70],
        expected_blurred_roi[10:50, 10:50],
    )
    assert np.array_equal(
        result[20, 20:80],
        original[20, 20:80],
    )
    assert not np.array_equal(
        result[25, 50],
        original[25, 50],
    )
    assert not np.array_equal(
        result[25, 50],
        expected_blurred_roi[5, 30],
    )


def test_zero_feather_ratio_preserves_uniform_roi_blur(
    monkeypatch,
) -> None:
    monkeypatch.setattr(settings, "margin_ratio", 0.25)
    monkeypatch.setattr(
        settings,
        "blur_feather_ratio",
        0.0,
    )
    monkeypatch.setattr(
        settings,
        "blur_kernel_size",
        5,
    )
    monkeypatch.setattr(
        settings,
        "blur_iterations",
        1,
    )

    random = np.random.default_rng(7)
    original = random.integers(
        0,
        256,
        size=(100, 100, 3),
        dtype=np.uint8,
    )
    expected_blurred_roi = cv2.GaussianBlur(
        original[20:80, 20:80],
        (5, 5),
        0,
    )

    result, _ = BlurService().apply(
        original.copy(),
        (30, 30, 70, 70),
    )

    assert np.array_equal(
        result[20:80, 20:80],
        expected_blurred_roi,
    )
