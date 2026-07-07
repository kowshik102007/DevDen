import numpy as np
from pharos.preprocess import dark_subtract, flat_correct, preprocess


def test_dark_subtract_clips_to_zero(synthetic_frame, dark):
    result = dark_subtract(synthetic_frame, dark)
    assert result.min() >= 0.0
    assert result.dtype == np.float32


def test_flat_correct_uniform_flat_is_identity(synthetic_frame):
    flat = np.ones_like(synthetic_frame)
    result = flat_correct(synthetic_frame, flat)
    np.testing.assert_allclose(result, synthetic_frame, rtol=1e-5)


def test_preprocess_output_range(synthetic_frame, dark, flat):
    result = preprocess(synthetic_frame, dark, flat)
    assert result.dtype == np.float32
    assert result.min() >= 0.0
