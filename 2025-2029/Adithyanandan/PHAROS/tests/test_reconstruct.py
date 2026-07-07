import numpy as np
import pytest

try:
    import aotools
    HAS_AOTOOLS = True
except ImportError:
    HAS_AOTOOLS = False

pytestmark = pytest.mark.skipif(not HAS_AOTOOLS, reason="aotools not installed")


def test_build_reconstructor_shape(cfg):
    from pharos.centroid import build_subaperture_map
    from pharos.reconstruct import build_zernike_interaction_matrix, build_reconstructor

    sas = build_subaperture_map(cfg)
    n_active = sum(s.active for s in sas)
    n_modes = 6
    pupil_r = cfg["pupil"]["diameter_px"] / 2

    D = build_zernike_interaction_matrix(sas, n_modes, pupil_r)
    assert D.shape == (2 * n_active, n_modes)

    R = build_reconstructor(D)
    assert R.shape == (n_modes, 2 * n_active)


def test_reconstruct_wavefront_shape(cfg):
    from pharos.centroid import build_subaperture_map
    from pharos.zernike import zernike_basis
    from pharos.reconstruct import (
        build_zernike_interaction_matrix, build_reconstructor, reconstruct_wavefront
    )

    sas = build_subaperture_map(cfg)
    n_active = sum(s.active for s in sas)
    n_modes = 6
    pupil_r = cfg["pupil"]["diameter_px"] / 2
    npix = int(2 * pupil_r)

    D = build_zernike_interaction_matrix(sas, n_modes, pupil_r)
    R = build_reconstructor(D)
    basis = zernike_basis(n_modes, npix)

    s = np.zeros(2 * n_active, dtype=np.float32)
    coeffs, phase_map = reconstruct_wavefront(s, R, basis)
    assert coeffs.shape == (n_modes,)
    assert phase_map.shape == (npix, npix)
