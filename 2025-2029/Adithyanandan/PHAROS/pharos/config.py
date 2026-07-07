from pathlib import Path
from ruamel.yaml import YAML

_REQUIRED_KEYS = [
    ("mla", "n_lenslets_x"), ("mla", "n_lenslets_y"),
    ("mla", "pitch_mm"), ("mla", "focal_length_mm"),
    ("camera", "pixel_size_um"), ("camera", "frame_width_px"),
    ("camera", "frame_height_px"), ("camera", "bit_depth"),
    ("camera", "frame_rate_hz"),
    ("pupil", "diameter_px"), ("pupil", "centre_x_px"), ("pupil", "centre_y_px"),
    ("dm", "n_actuators"), ("dm", "stroke_um"),
]


def load_config(path: str = "config/system.yaml") -> dict:
    yaml = YAML()
    with open(path) as f:
        cfg = yaml.load(f)

    for section, key in _REQUIRED_KEYS:
        if section not in cfg or key not in cfg[section]:
            raise ValueError(f"Missing required config key: {section}.{key}")

    # Derived parameter used by centroid and slopes modules
    cfg["_focal_length_px"] = (
        cfg["mla"]["focal_length_mm"] / cfg["camera"]["pixel_size_um"] * 1000
    )
    cfg["_subaperture_size_px"] = int(
        cfg["mla"]["pitch_mm"] / cfg["camera"]["pixel_size_um"] * 1000
    )
    return cfg
