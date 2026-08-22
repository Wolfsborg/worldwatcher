# Sitemap Generation

The `build-sitemap.js` script generates `sitemap.xml` for Google Search indexing.

## Usage

```bash
node scripts/build-sitemap.js
```

## When to run

Run this script whenever:
- `data/incidents.json` is updated
- `data/floods.json` is updated
- New static pages are added to the site

## Automated updates

If the hourly publish process updates incidents.json on the operator machine, this script should be run as part of that process to keep the sitemap current.

## Output

The script generates `damincidents/sitemap.xml` with:
- Static pages (/, /standards.html, /terms.html, /privacy.html)
- Layer page (?layer=floods)
- All dam incidents (?id=<incident-id>)
- All flood events (?layer=floods&id=<flood-id>)

Total URLs: ~2,500+ (2,184 dams + 370 floods + static pages)
