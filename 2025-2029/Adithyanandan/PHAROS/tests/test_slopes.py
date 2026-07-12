import numpy as np
from pharos.slopes import compute_slopes


def test_slopes_zero_deviation():
    N = 10
    centroids = np.random.default_rng(0).uniform(100, 400, (N, 2)).astype(np.float32)
    s = compute_slopes(centroids, centroids, focal_length_px=3381.8)
    np.testing.assert_allclose(s, 0.0, atol=1e-6)


def test_slopes_known_displacement():
    N = 5
    ref = np.ones((N, 2), dtype=np.float32) * 100.0
    centroids = ref.copy()
    centroids[:, 0] += 3.381  # 3.381 px x-displacement
    focal_px = 3381.8
    s = compute_slopes(centroids, ref, focal_px)
    # x-slopes should be 3.381 / 3381.8 ≈ 0.001 rad
    np.testing.assert_allclose(s[:N], 3.381 / focal_px, rtol=1e-4)
    np.testing.assert_allclose(s[N:], 0.0, atol=1e-6)


def test_slopes_output_shape():
    N = 8
    centroids = np.zeros((N, 2), dtype=np.float32)
    ref = np.zeros((N, 2), dtype=np.float32)
    s = compute_slopes(centroids, ref, focal_length_px=1000.0)
    assert s.shape == (2 * N,)
