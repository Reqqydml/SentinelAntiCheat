from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from sentinel.config import settings

# Conservative defaults for scaffold mode.
# Replace with fitted values from your calibration pipeline/dataset.
DEFAULT_CALIBRATION: dict[str, Any] = {
    "bands": [
        {"min_elo": 0, "max_elo": 1399, "expected_acl": 95.0, "std_acl": 24.0},
        {"min_elo": 1400, "max_elo": 1599, "expected_acl": 78.0, "std_acl": 20.0},
        {"min_elo": 1600, "max_elo": 1799, "expected_acl": 63.0, "std_acl": 17.0},
        {"min_elo": 1800, "max_elo": 1999, "expected_acl": 50.0, "std_acl": 14.0},
        {"min_elo": 2000, "max_elo": 2199, "expected_acl": 39.0, "std_acl": 12.0},
        {"min_elo": 2200, "max_elo": 2399, "expected_acl": 31.0, "std_acl": 10.0},
        {"min_elo": 2400, "max_elo": 4000, "expected_acl": 24.0, "std_acl": 8.0},
    ]
}


@lru_cache(maxsize=1)
def _load_profile() -> dict[str, Any]:
    if not settings.calibration_profile_path:
        return DEFAULT_CALIBRATION
    p = Path(settings.calibration_profile_path)
    if not p.exists():
        return DEFAULT_CALIBRATION
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return DEFAULT_CALIBRATION


def regan_acl_params_for_elo(elo: int) -> tuple[float, float]:
    profile = _load_profile()
    bands = profile.get("bands", [])
    for b in bands:
        if int(b.get("min_elo", 0)) <= elo <= int(b.get("max_elo", 9999)):
            expected = float(b.get("expected_acl", 60.0))
            std = max(1.0, float(b.get("std_acl", 15.0)))
            return expected, std
    return 60.0, 15.0

