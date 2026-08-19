# Worldwatcher

Public map of documented dam failures and incidents, 1864–2026.

Intended path: [worldwatch.com/damincidents](https://worldwatch.com/damincidents)

## Run locally

```bash
cd damincidents
python server.py
```

Open http://127.0.0.1:8080/

`server.py` serves the map and a small API so Maintain can check duplicates and merge new facts into existing records.

## Data

`damincidents/data/incidents.json` is the source of truth. Each record has location (lat/lng), causes, sources, and status. The Dam Watch agent updates it on a 4-hour scan.
