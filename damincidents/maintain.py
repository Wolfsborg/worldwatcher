"""Duplicate detection and smart merge for Worldwatch dam incidents.

Pure logic. No HTTP.
"""

from __future__ import annotations

import copy
import csv
import json
import math
import re
import shutil
from datetime import datetime
from pathlib import Path

TODAY = "2026-08-19"
SYNC_DIR = Path("/workspace/dam-incidents")

NAME_DATE_DAYS = 14
GEO_DATE_DAYS = 21
GEO_KM = 3.0

CSV_COLUMNS = [
    "id",
    "name",
    "country",
    "region",
    "location_label",
    "lat",
    "lng",
    "geo_accuracy",
    "geo_source",
    "river_or_facility",
    "type",
    "category",
    "causes",
    "cause_summary",
    "era",
    "incident_date",
    "latest_report_date",
    "deaths",
    "injured",
    "affected_or_evacuated",
    "verification",
    "status",
    "what_happened",
    "notes",
    "sources",
    "in_baseline",
    "last_updated",
]

_PLACEHOLDERS = {
    "unknown",
    "n/a",
    "na",
    "none",
    "tbd",
    "—",
    "-",
    "–",
    "?",
    "unconfirmed",
    "pending",
    "null",
    "undefined",
    ".",
    "..",
}

_GEO_RANK = {"exact": 3, "approx": 2, "region": 1}
_CASUALTY_KEYS = {"deaths", "injured"}
_NARRATIVE_KEYS = {"what_happened", "status", "notes"}


def load_db(path):
    path = Path(path)
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        return {"incidents": []}
    data.setdefault("incidents", [])
    return data


def save_db(path, db):
    path = Path(path)
    db = dict(db)
    incidents = list(db.get("incidents") or [])
    db["incidents"] = incidents
    db["count"] = len(incidents)
    db["updated"] = TODAY
    if any(r.get("era") for r in incidents):
        db["current_count"] = sum(1 for r in incidents if r.get("era") == "current")
        db["historical_count"] = sum(1 for r in incidents if r.get("era") == "historical")

    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(db, indent=2, ensure_ascii=False) + "\n"
    path.write_text(text, encoding="utf-8")

    csv_path = path.with_suffix(".csv")
    _write_csv(csv_path, incidents)

    if SYNC_DIR.is_dir():
        dest_json = SYNC_DIR / "incidents.json"
        dest_csv = SYNC_DIR / "incidents.csv"
        if path.resolve() != dest_json.resolve():
            dest_json.write_text(text, encoding="utf-8")
        if csv_path.resolve() != dest_csv.resolve():
            shutil.copy2(csv_path, dest_csv)
    return db


def find_matches(db, incident):
    if not isinstance(incident, dict):
        return []
    found = []
    seen = set()
    want_id = incident.get("id")
    for rec in db.get("incidents") or []:
        if not isinstance(rec, dict):
            continue
        rid = rec.get("id")
        if rid is not None and rid in seen:
            continue
        if _is_duplicate(rec, incident):
            if rid is not None:
                seen.add(rid)
            found.append(rec)
    found.sort(key=lambda r: (0 if r.get("id") == want_id and want_id else 1, r.get("id") or ""))
    return found


def upsert(db, incident, target_id=None):
    empty = {"action": "rejected", "record": None, "matches": [], "changes": []}
    if not isinstance(db, dict):
        return dict(empty)
    if not isinstance(incident, dict):
        return dict(empty)
    incident = dict(incident)
    if not (incident.get("name") or incident.get("id") or target_id):
        return dict(empty)

    incidents = db.setdefault("incidents", [])
    matches = find_matches({"incidents": incidents}, incident)

    target = None
    if target_id:
        target = next((r for r in incidents if r.get("id") == target_id), None)
        if target is None:
            return {"action": "rejected", "record": None, "matches": matches, "changes": []}
    elif matches:
        target = matches[0]

    if target is not None:
        merged, changes = merge_records(target, incident)
        idx = next(
            i for i, r in enumerate(incidents)
            if r is target or r.get("id") == target.get("id")
        )
        incidents[idx] = merged
        return {"action": "merged", "record": merged, "matches": matches, "changes": changes}

    created = dict(incident)
    if not created.get("id"):
        created["id"] = make_id(created)
    created["last_updated"] = TODAY
    incidents.append(created)
    return {
        "action": "created",
        "record": created,
        "matches": [],
        "changes": [k for k in created.keys()],
    }


def make_id(incident):
    name = normalize_name(incident.get("name") or "incident")
    slug = re.sub(r"[^a-z0-9]+", "-", name).strip("-") or "incident"
    date_part = str(incident.get("incident_date") or TODAY).strip()
    return f"{slug}-{date_part}"


def normalize_name(name):
    s = str(name or "").casefold()
    buf = []
    for ch in s:
        if ch.isalnum() or ch.isspace():
            buf.append(ch)
        else:
            buf.append(" ")
    return " ".join("".join(buf).split())


def normalize_country(country):
    return " ".join(str(country or "").casefold().split())


def _is_empty(value):
    if value is None:
        return True
    if value == "":
        return True
    if isinstance(value, str) and not value.strip():
        return True
    if isinstance(value, (list, dict)) and len(value) == 0:
        return True
    return False


def _is_placeholder(value):
    if _is_empty(value):
        return True
    if not isinstance(value, str):
        return False
    text = value.strip().casefold()
    if text in _PLACEHOLDERS:
        return True
    return len(text) < 3


def _is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _has_coords(rec):
    return _is_number(rec.get("lat")) and _is_number(rec.get("lng"))


def parse_date(value):
    if _is_empty(value):
        return None
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%Y-%m", "%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _date_within(a, b, days):
    da, db = parse_date(a), parse_date(b)
    if da is None or db is None:
        return False
    return abs((da - db).days) <= days


def _date_newer(a, b):
    da, db = parse_date(a), parse_date(b)
    if da is None:
        return False
    if db is None:
        return True
    return da > db


def _date_gte(a, b):
    da, db = parse_date(a), parse_date(b)
    if da is None and db is None:
        return True
    if da is None:
        return False
    if db is None:
        return True
    return da >= db


def haversine_km(lat1, lng1, lat2, lng2):
    radius = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * radius * math.asin(min(1.0, math.sqrt(a)))


def _is_duplicate(existing, incoming):
    if incoming.get("id") and existing.get("id") and incoming.get("id") == existing.get("id"):
        return True

    n1 = normalize_name(existing.get("name"))
    n2 = normalize_name(incoming.get("name"))
    c1 = normalize_country(existing.get("country"))
    c2 = normalize_country(incoming.get("country"))
    if n1 and n1 == n2 and c1 and c1 == c2:
        if _date_within(existing.get("incident_date"), incoming.get("incident_date"), NAME_DATE_DAYS):
            return True

    if _has_coords(existing) and _has_coords(incoming):
        dist = haversine_km(existing["lat"], existing["lng"], incoming["lat"], incoming["lng"])
        if dist < GEO_KM and _date_within(
            existing.get("incident_date"), incoming.get("incident_date"), GEO_DATE_DAYS
        ):
            return True
    return False


def _assign(out, key, value, changes):
    if out.get(key) != value:
        out[key] = value
        if key not in changes:
            changes.append(key)


def merge_records(existing, incoming):
    """Merge incoming into existing. Never invents fields. Returns (record, changes)."""
    if not isinstance(existing, dict):
        existing = {}
    if not isinstance(incoming, dict):
        incoming = {}
    out = copy.deepcopy(existing)
    changes = []
    incoming_newer = _date_newer(incoming.get("latest_report_date"), existing.get("latest_report_date"))
    incoming_gte = _date_gte(incoming.get("latest_report_date"), existing.get("latest_report_date"))

    _merge_geo(out, existing, incoming, changes)

    for key, ival in incoming.items():
        if key in {"id", "last_updated", "lat", "lng", "geo_accuracy"}:
            continue
        if key == "sources":
            _assign(out, "sources", _merge_sources(out.get("sources"), ival), changes)
            continue
        if key == "causes":
            _assign(out, "causes", _merge_causes(out.get("causes"), ival), changes)
            continue
        if key == "cause_summary":
            _merge_cause_summary(out, ival, incoming_newer, changes)
            continue
        if key in _NARRATIVE_KEYS:
            _merge_narrative(out, key, ival, changes)
            continue
        if key in _CASUALTY_KEYS:
            _merge_casualty(out, key, ival, incoming_gte, changes)
            continue
        if _is_number(ival) or _is_number(out.get(key)):
            _merge_number(out, key, ival, incoming_gte, changes)
            continue
        if isinstance(ival, bool) or isinstance(out.get(key), bool):
            if ival is None:
                continue
            if isinstance(ival, bool):
                _assign(out, key, ival, changes)
            continue
        if isinstance(ival, list):
            if _is_empty(ival):
                continue
            if _is_empty(out.get(key)):
                _assign(out, key, copy.deepcopy(ival), changes)
            continue
        if isinstance(ival, dict):
            if not ival:
                continue
            if _is_empty(out.get(key)):
                _assign(out, key, copy.deepcopy(ival), changes)
            continue
        _merge_string(out, key, ival, incoming_newer, changes)

    if out.get("last_updated") != TODAY:
        changes.append("last_updated")
    out["last_updated"] = TODAY
    return out, changes


def _merge_string(out, key, incoming, incoming_newer, changes):
    if _is_empty(incoming):
        return
    existing = out.get(key)
    if _is_empty(existing):
        _assign(out, key, incoming, changes)
        return
    if not isinstance(incoming, str):
        incoming = str(incoming)
    if not isinstance(existing, str):
        existing = str(existing)
    if incoming_newer:
        _assign(out, key, incoming, changes)
        return
    if len(incoming) > len(existing) and _is_placeholder(existing):
        _assign(out, key, incoming, changes)


def _merge_cause_summary(out, incoming, incoming_newer, changes):
    if _is_empty(incoming):
        return
    existing = out.get("cause_summary")
    if _is_empty(existing):
        _assign(out, "cause_summary", incoming, changes)
        return
    incoming = str(incoming)
    existing = str(existing)
    if incoming_newer:
        _assign(out, "cause_summary", incoming, changes)
        return
    if len(incoming) > len(existing):
        _assign(out, "cause_summary", incoming, changes)


def _normalize_text(value):
    return " ".join(str(value or "").casefold().split())


def _merge_narrative(out, key, incoming, changes):
    if _is_empty(incoming):
        return
    incoming = str(incoming).strip()
    existing = out.get(key)
    if _is_empty(existing):
        _assign(out, key, incoming, changes)
        return
    existing = str(existing)
    ex_n = _normalize_text(existing)
    in_n = _normalize_text(incoming)
    if in_n in ex_n:
        return
    if ex_n in in_n:
        _assign(out, key, incoming, changes)
        return
    appended = existing.rstrip() + "\n\n[" + TODAY + "] " + incoming
    _assign(out, key, appended, changes)


def _merge_casualty(out, key, incoming, incoming_gte, changes):
    if incoming is None or incoming == "":
        return
    if not _is_number(incoming):
        try:
            incoming = int(incoming) if str(incoming).isdigit() else float(incoming)
        except (TypeError, ValueError):
            return
    existing = out.get(key)
    if existing is None or existing == "":
        _assign(out, key, incoming, changes)
        return
    if not _is_number(existing):
        return
    if incoming_gte and incoming > existing:
        _assign(out, key, incoming, changes)


def _merge_number(out, key, incoming, incoming_gte, changes):
    if incoming is None or incoming == "":
        return
    if not _is_number(incoming):
        return
    existing = out.get(key)
    if existing is None or existing == "":
        _assign(out, key, incoming, changes)
        return
    if incoming_gte:
        _assign(out, key, incoming, changes)


def _merge_sources(existing, incoming):
    existing = existing if isinstance(existing, list) else []
    incoming = incoming if isinstance(incoming, list) else []
    by_key = {}
    order = []
    for src in existing + incoming:
        if not isinstance(src, dict):
            continue
        url = str(src.get("url") or "").strip()
        label = str(src.get("label") or "").strip()
        key = url or ("label:" + label)
        if not key or key == "label:":
            continue
        if key not in by_key:
            item = {}
            if label:
                item["label"] = src.get("label")
            if url:
                item["url"] = src.get("url")
            for extra_k, extra_v in src.items():
                if extra_k not in item and not _is_empty(extra_v):
                    item[extra_k] = extra_v
            by_key[key] = item
            order.append(key)
        else:
            held = by_key[key]
            if not held.get("label") and src.get("label"):
                held["label"] = src.get("label")
    return [by_key[k] for k in order]


def _merge_causes(existing, incoming):
    slugs = []
    for seq in (existing, incoming):
        if not isinstance(seq, list):
            continue
        for slug in seq:
            if _is_empty(slug):
                continue
            if slug not in slugs:
                slugs.append(slug)
    real = [s for s in slugs if s != "unknown"]
    return real if real else slugs


def _merge_geo(out, existing, incoming, changes):
    in_lat, in_lng = incoming.get("lat"), incoming.get("lng")
    has_in = _is_number(in_lat) and _is_number(in_lng)
    has_ex = _has_coords(existing)
    ex_acc = existing.get("geo_accuracy") or ""
    in_acc = incoming.get("geo_accuracy") or ""
    if not has_in:
        if in_acc and _is_empty(out.get("geo_accuracy")):
            _assign(out, "geo_accuracy", in_acc, changes)
        return
    if has_ex and ex_acc == "exact" and in_acc != "exact":
        return
    take = False
    if not has_ex:
        take = True
    elif in_acc == "exact":
        take = True
    elif _GEO_RANK.get(in_acc, 0) >= _GEO_RANK.get(ex_acc, 0):
        take = True
    if take:
        _assign(out, "lat", in_lat, changes)
        _assign(out, "lng", in_lng, changes)
        if in_acc and _GEO_RANK.get(in_acc, 0) >= _GEO_RANK.get(ex_acc, 0):
            _assign(out, "geo_accuracy", in_acc, changes)


def _format_cell(key, value):
    if value is None:
        return ""
    if isinstance(value, bool):
        return "True" if value else "False"
    if key == "causes" and isinstance(value, list):
        return ";".join(str(v) for v in value)
    if key == "sources" and isinstance(value, list):
        parts = []
        for src in value:
            if isinstance(src, dict):
                parts.append("%s | %s" % (src.get("label") or "", src.get("url") or ""))
            else:
                parts.append(str(src))
        return "; ".join(parts)
    if isinstance(value, list):
        return ";".join(str(v) for v in value)
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False)
    return value


def _write_csv(path, incidents):
    extra = []
    seen = set(CSV_COLUMNS)
    for rec in incidents:
        for key in rec:
            if key not in seen:
                extra.append(key)
                seen.add(key)
    fields = CSV_COLUMNS + extra
    path = Path(path)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for rec in incidents:
            writer.writerow({key: _format_cell(key, rec.get(key)) for key in fields})


if __name__ == "__main__":
    existing = {
        "id": "test-dam-2026-01-01",
        "name": "Test Dam",
        "country": "Sweden",
        "incident_date": "2026-01-01",
        "lat": 59.33,
        "lng": 18.07,
        "deaths": 3,
        "what_happened": "A small breach occurred.",
        "sources": [{"label": "A", "url": "https://example.com/a"}],
        "causes": ["unknown"],
        "latest_report_date": "2026-01-02",
        "geo_accuracy": "approx",
    }
    incoming = {
        "name": "Test Dam",
        "country": "Sweden",
        "incident_date": "2026-01-05",
        "lat": 59.331,
        "lng": 18.071,
        "deaths": 5,
        "what_happened": "A small breach occurred. Evacuations followed.",
        "sources": [{"label": "B", "url": "https://example.com/b"}],
        "causes": ["overtopping"],
        "latest_report_date": "2026-01-10",
        "geo_accuracy": "approx",
        "status": "contained",
    }
    db = {"incidents": [dict(existing)]}
    merged = upsert(db, incoming)
    assert merged["action"] == "merged", merged
    rec = merged["record"]
    assert rec["deaths"] == 5, rec
    assert rec["causes"] == ["overtopping"], rec
    assert rec["status"] == "contained", rec
    assert len(rec["sources"]) == 2, rec
    assert rec["last_updated"] == TODAY, rec

    far = {
        "name": "Other Dam",
        "country": "Chile",
        "incident_date": "2026-01-01",
        "lat": -33.4,
        "lng": -70.6,
        "what_happened": "Overtopping after rainfall.",
    }
    created = upsert(db, far)
    assert created["action"] == "created", created
    assert len(db["incidents"]) == 2, db
    print("ok")
