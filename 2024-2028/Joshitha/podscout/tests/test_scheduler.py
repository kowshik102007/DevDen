"""
Tests for the ingestion scheduler's bulk-insert behaviour.
Verifies that N+1 DB pattern is gone — exactly one upsert and one insert
call regardless of how many records are in the batch.
"""

import sys
from pathlib import Path
from datetime import datetime
from unittest.mock import MagicMock, patch, call

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))


def _make_mock_supabase():
    """Return a MagicMock that simulates the Supabase fluent API."""
    sb = MagicMock()
    # table("x").upsert(...).execute()
    # table("x").insert(...).execute()
    sb.table.return_value.upsert.return_value.execute.return_value = MagicMock(data=[])
    sb.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[])
    return sb


def _fake_ground_data(n_records: int = 5) -> dict:
    """Produce fake ground-sensor data for n_records stations."""
    records = []
    for i in range(n_records):
        records.append({
            "station_id":   f"cpcb-{i}",
            "station_name": f"Station {i}",
            "city":         "Delhi",
            "latitude":     28.6 + i * 0.01,
            "longitude":    77.2 + i * 0.01,
            "pm25":         80.0 + i * 5,
            "source":       "cpcb",
            "timestamp":    datetime.utcnow().isoformat(),
        })
    return {"cpcb": {"status": "success", "data": records}}


def _fake_satellite_data(n_records: int = 4) -> dict:
    records = []
    for i in range(n_records):
        records.append({
            "city":      "Delhi",
            "no2":       40.0 + i,
            "quality":   1,
            "timestamp": datetime.utcnow().isoformat(),
        })
    return {"sentinel5p_no2": {"status": "success", "data": records}}


class TestBulkInsertScheduler:
    @pytest.mark.asyncio
    async def test_ground_data_single_upsert_and_insert(self):
        """
        _store_ground_sensor_data must call .upsert() once and .insert() once
        (with lists), not once per record.
        """
        from backend.app.ingestion.scheduler import IngestionScheduler

        sched = IngestionScheduler()
        mock_sb = _make_mock_supabase()
        ground = _fake_ground_data(n_records=5)

        sites_n, meas_n = await sched._store_ground_sensor_data(mock_sb, ground)

        # Only ONE upsert call to monitoring_sites
        upsert_calls = mock_sb.table.return_value.upsert.call_count
        insert_calls = mock_sb.table.return_value.insert.call_count

        assert upsert_calls == 1, f"Expected 1 upsert call, got {upsert_calls}"
        assert insert_calls == 1, f"Expected 1 insert call, got {insert_calls}"

        # The single upsert payload should be a list of 5 dicts
        upsert_payload = mock_sb.table.return_value.upsert.call_args[0][0]
        assert isinstance(upsert_payload, list)
        assert len(upsert_payload) == 5

        assert sites_n == 5
        assert meas_n  == 5

    @pytest.mark.asyncio
    async def test_satellite_data_single_insert(self):
        """
        _store_satellite_data must call .insert() once with a list payload.
        """
        from backend.app.ingestion.scheduler import IngestionScheduler

        sched = IngestionScheduler()
        mock_sb = _make_mock_supabase()
        satellite = _fake_satellite_data(n_records=4)

        count = await sched._store_satellite_data(mock_sb, satellite)

        insert_calls = mock_sb.table.return_value.insert.call_count
        assert insert_calls == 1, f"Expected 1 insert call, got {insert_calls}"

        insert_payload = mock_sb.table.return_value.insert.call_args[0][0]
        assert isinstance(insert_payload, list)
        assert len(insert_payload) == 4
        assert count == 4

    @pytest.mark.asyncio
    async def test_is_estimated_flag_is_false_for_real_data(self):
        """All ground measurement inserts must carry is_estimated=False."""
        from backend.app.ingestion.scheduler import IngestionScheduler

        sched = IngestionScheduler()
        mock_sb = _make_mock_supabase()
        ground = _fake_ground_data(n_records=3)

        await sched._store_ground_sensor_data(mock_sb, ground)

        payload = mock_sb.table.return_value.insert.call_args[0][0]
        for record in payload:
            assert record.get("is_estimated") is False, (
                f"Record {record.get('site_id')} missing is_estimated=False"
            )

    @pytest.mark.asyncio
    async def test_empty_data_makes_no_db_calls(self):
        """When all sources report 0 records, no DB calls should be made."""
        from backend.app.ingestion.scheduler import IngestionScheduler

        sched = IngestionScheduler()
        mock_sb = _make_mock_supabase()
        empty_ground = {"cpcb": {"status": "success", "data": []}}

        sites_n, meas_n = await sched._store_ground_sensor_data(mock_sb, empty_ground)

        mock_sb.table.assert_not_called()
        assert sites_n == 0
        assert meas_n  == 0
