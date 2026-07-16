"""
Tests for realtime_pipeline push-alerts and statistics update.
"""

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch, call

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))


def _make_sites(critical=2, high=1, good=3):
    sites = []
    for i in range(critical):
        sites.append({"id": f"c{i}", "city": "Delhi", "name": f"C-{i}", "pm25": 200.0})
    for i in range(high):
        sites.append({"id": f"h{i}", "city": "Mumbai", "name": f"H-{i}", "pm25": 110.0})
    for i in range(good):
        sites.append({"id": f"g{i}", "city": "Pune", "name": f"G-{i}", "pm25": 40.0})
    return sites


class TestUpdateStatistics:
    @pytest.mark.asyncio
    async def test_returns_correct_counts(self):
        from backend.app.core.realtime_pipeline import RealtimePipeline
        from backend.app.services import supabase as sb_module

        pipeline = RealtimePipeline()
        mock_sb = MagicMock()
        mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value.data = (
            _make_sites(critical=2, high=1, good=3)
        )

        with patch.object(sb_module, "get_supabase", return_value=mock_sb), \
             patch.object(pipeline, "_fire_alert", new_callable=AsyncMock):
            stats = await pipeline._update_statistics()

        assert stats["active_sites"]      == 6
        assert stats["critical_hotspots"] == 2
        assert stats["high_hotspots"]     == 1

    @pytest.mark.asyncio
    async def test_critical_alert_fired_when_critical_sites_present(self):
        from backend.app.core.realtime_pipeline import RealtimePipeline
        from backend.app.services import supabase as sb_module

        pipeline = RealtimePipeline()
        mock_sb = MagicMock()
        mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value.data = (
            _make_sites(critical=1, high=0, good=0)
        )

        mock_fire = AsyncMock()
        with patch.object(sb_module, "get_supabase", return_value=mock_sb), \
             patch.object(pipeline, "_fire_alert", mock_fire):
            await pipeline._update_statistics()

        mock_fire.assert_awaited_once()
        _args, kwargs = mock_fire.call_args
        assert kwargs.get("level") == "CRITICAL" or _args[1] == "CRITICAL"

    @pytest.mark.asyncio
    async def test_high_alert_fired_when_no_critical_but_high(self):
        from backend.app.core.realtime_pipeline import RealtimePipeline
        from backend.app.services import supabase as sb_module

        pipeline = RealtimePipeline()
        mock_sb = MagicMock()
        mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value.data = (
            _make_sites(critical=0, high=2, good=1)
        )

        mock_fire = AsyncMock()
        with patch.object(sb_module, "get_supabase", return_value=mock_sb), \
             patch.object(pipeline, "_fire_alert", mock_fire):
            await pipeline._update_statistics()

        mock_fire.assert_awaited_once()
        _args, kwargs = mock_fire.call_args
        assert kwargs.get("level") == "HIGH" or _args[1] == "HIGH"

    @pytest.mark.asyncio
    async def test_no_alert_when_all_good(self):
        from backend.app.core.realtime_pipeline import RealtimePipeline
        from backend.app.services import supabase as sb_module

        pipeline  = RealtimePipeline()
        mock_sb   = MagicMock()
        mock_sb.table.return_value.select.return_value.eq.return_value.execute.return_value.data = (
            _make_sites(critical=0, high=0, good=5)
        )

        mock_fire = AsyncMock()
        with patch.object(sb_module, "get_supabase", return_value=mock_sb), \
             patch.object(pipeline, "_fire_alert", mock_fire):
            await pipeline._update_statistics()

        mock_fire.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_no_db_returns_empty(self):
        from backend.app.core.realtime_pipeline import RealtimePipeline
        from backend.app.services import supabase as sb_module

        pipeline = RealtimePipeline()
        with patch.object(sb_module, "get_supabase", return_value=None):
            stats = await pipeline._update_statistics()

        assert stats == {}
