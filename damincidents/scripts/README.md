# Build Scripts

## Sitemap Generation

The `build-sitemap.js` script generates `sitemap.xml` for Google Search indexing.

### Usage

```bash
node scripts/build-sitemap.js
```

### When to run

Run this script whenever:
- `data/incidents.json` is updated
- `data/floods.json` is updated
- New static pages are added to the site

### Output

The script generates `damincidents/sitemap.xml` with:
- Static pages (/, /standards.html, /terms.html, /privacy.html)
- Layer page (?layer=floods)
- All dam incidents (?id=<incident-id>)
- All flood events (?layer=floods&id=<flood-id>)

Total URLs: ~2,500+ (2,184 dams + 370 floods + static pages)

## Version Generation

The `build-version.js` script generates `data/version.json` with automatic versioning.

### Usage

```bash
node scripts/build-version.js
```

### When to run

Run this script at build/deploy time to update the version number shown in Settings.

### Output

The script generates `damincidents/data/version.json` with:

```json
{
  "version": "2026.08.22-92979b0",
  "git": "92979b0e4e0fbf89ae1e02ce4f249e120c71cab1",
  "built_at": "2026-08-22T06:42:15Z"
}
```

Format: `YYYY.MM.DD-shortsha` (e.g., 2026.08.22-a1b2c3d)

The version is displayed in the Settings panel as "Version 2026.08.22-a1b2c3d".

## Automated Updates

If the hourly publish process updates incidents.json on the operator machine, both scripts should be run as part of that process to keep the sitemap and version current.
