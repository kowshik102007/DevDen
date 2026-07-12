"""
Gymnasium environment simulating an AO closed loop for RL training.
Requires: aotools, pharos pipeline modules.
"""

import numpy as np

try:
    import gymnasium as gym
    from gymnasium import spaces

    class AOClosedLoopEnv(gym.Env):
        """
        State:   slope vector s (2*N_active,)
        Action:  actuator stroke vector a (N_actuators,) normalised [-1, 1]
        Reward:  negative RMS wavefront error after applying correction
        """

        def __init__(self, config: dict):
            super().__init__()
            self.config = config
            self.n_active = config.get("n_active_subapertures", 76)
            n_slopes = 2 * self.n_active
            n_actuators = config["dm"]["n_actuators"]
            self.stroke_range = config["dm"]["stroke_um"]

            self.observation_space = spaces.Box(
                low=-np.inf, high=np.inf, shape=(n_slopes,), dtype=np.float32)
            self.action_space = spaces.Box(
                low=-1.0, high=1.0, shape=(n_actuators,), dtype=np.float32)

            self._coupling_matrix = None
            self._phase_screen = None
            self._rng = np.random.default_rng(0)

        def reset(self, seed=None, options=None):
            super().reset(seed=seed)
            if seed is not None:
                self._rng = np.random.default_rng(seed)
            self._phase_screen = self._generate_phase_screen()
            obs = self._compute_slopes(self._phase_screen)
            return obs.astype(np.float32), {}

        def step(self, action: np.ndarray):
            strokes = action * self.stroke_range
            correction = self._apply_dm(strokes)
            residual = self._phase_screen - correction
            rms_error = float(np.sqrt(np.mean(residual**2)))
            reward = -rms_error
            self._phase_screen = self._advance_turbulence()
            obs = self._compute_slopes(self._phase_screen)
            return obs.astype(np.float32), reward, False, False, {}

        def _generate_phase_screen(self) -> np.ndarray:
            try:
                import aotools
                pupil_r = self.config["pupil"]["diameter_px"] / 2
                npix = int(2 * pupil_r)
                r0_px = self._rng.uniform(20, 100)
                return aotools.turbulence.phasescreen.ft_phase_screen(
                    r0_px, npix, 1.0, L0=1000, l0=0.01
                ).astype(np.float32)
            except ImportError:
                pupil_r = self.config["pupil"]["diameter_px"] / 2
                npix = int(2 * pupil_r)
                return self._rng.normal(0, 1.0, (npix, npix)).astype(np.float32)

        def _compute_slopes(self, phase: np.ndarray) -> np.ndarray:
            dy = np.gradient(phase, axis=0)
            dx = np.gradient(phase, axis=1)
            # Sample at subaperture grid positions
            H, W = phase.shape
            nx = self.config["mla"]["n_lenslets_x"]
            ny = self.config["mla"]["n_lenslets_y"]
            sub_px_x = W // nx
            sub_px_y = H // ny
            s_x, s_y = [], []
            for i in range(ny):
                for j in range(nx):
                    y0 = i * sub_px_y
                    x0 = j * sub_px_x
                    s_x.append(dx[y0:y0+sub_px_y, x0:x0+sub_px_x].mean())
                    s_y.append(dy[y0:y0+sub_px_y, x0:x0+sub_px_x].mean())
            return np.array(s_x + s_y, dtype=np.float32)[:2*self.n_active]

        def _apply_dm(self, strokes: np.ndarray) -> np.ndarray:
            if self._coupling_matrix is None:
                coupling_path = self.config["dm"].get("coupling_matrix_path", "")
                if coupling_path:
                    try:
                        import os
                        self._coupling_matrix = np.load(coupling_path)
                    except Exception:
                        pass
            if self._coupling_matrix is not None:
                phase_flat = self._coupling_matrix @ strokes
                H, W = self._phase_screen.shape
                return phase_flat[:H*W].reshape(H, W)
            # Fallback: no-op correction
            return np.zeros_like(self._phase_screen)

        def _advance_turbulence(self) -> np.ndarray:
            # Frozen-flow: shift phase screen by 1 pixel per frame
            return np.roll(self._phase_screen, shift=1, axis=1)

except ImportError:
    pass
