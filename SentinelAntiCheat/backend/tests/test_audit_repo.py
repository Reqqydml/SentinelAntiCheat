from __future__ import annotations

from pathlib import Path

from sentinel.repositories.audit import AuditRepository


def test_audit_recent_filters_by_event(tmp_path: Path) -> None:
    db = tmp_path / "audit_test.db"
    repo = AuditRepository(str(db))

    repo.write(
        {
            "request": {"player_id": "p1", "event_id": "evt-1"},
            "response": {"risk_tier": "LOW", "signals": []},
        },
        model_version="v-test",
    )
    repo.write(
        {
            "request": {"player_id": "p2", "event_id": "evt-2"},
            "response": {"risk_tier": "ELEVATED", "signals": []},
        },
        model_version="v-test",
    )

    all_rows = repo.recent(limit=10)
    evt1_rows = repo.recent(limit=10, event_id="evt-1")

    assert len(all_rows) == 2
    assert len(evt1_rows) == 1
    assert evt1_rows[0]["request"]["event_id"] == "evt-1"
