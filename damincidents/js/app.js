(function () {
  "use strict";

  const DATA_URL = "data/incidents.json";
  const COLORS = {
    failure: "#e24b4a",
    partial_breach: "#e8892c",
    incident: "#4aa3df",
    watch: "#d4b45a",
    controlled_release: "#7a8894",
  };
  const CATEGORY_LABEL = {
    failure: "Failure",
    partial_breach: "Partial breach",
    incident: "Incident",
    watch: "Watch",
    controlled_release: "Controlled release",
  };
  const CAUSE_LABEL = {
    overtopping: "Overtopping",
    piping_internal_erosion: "Piping / internal erosion",
    structural_design: "Structural / design",
    foundation: "Foundation",
    earthquake: "Earthquake",
    landslide: "Landslide",
    spillway: "Spillway",
    operational_gate: "Operational / gate",
    extreme_rainfall: "Extreme rainfall",
    war_attack: "War / attack",
    tailings_liquefaction: "Tailings liquefaction",
    poor_maintenance: "Poor maintenance",
    construction_first_filling: "Construction / first filling",
    unknown: "Unknown",
  };

  const TYPE_LABEL = {
    reservoir_dam: "Reservoir dam",
    tailings: "Tailings",
    levee_embankment: "Levee / embankment",
    weir: "Weir",
    spillway: "Spillway",
    sluice: "Sluice",
  };

  const els = {
    search: document.getElementById("search"),
    chips: document.getElementById("category-chips"),
    type: document.getElementById("type-filter"),
    cause: document.getElementById("cause-filter"),
    yearMin: document.getElementById("year-min"),
    yearMax: document.getElementById("year-max"),
    periods: document.getElementById("period-chips"),
    list: document.getElementById("incident-list"),
    empty: document.getElementById("empty-state"),
    listCount: document.getElementById("list-count"),
    detail: document.getElementById("detail"),
    detailBody: document.getElementById("detail-body"),
    detailClose: document.getElementById("detail-close"),
    sidebar: document.getElementById("sidebar"),
    toggle: document.getElementById("sidebar-toggle"),
    statCount: document.getElementById("stat-count"),
    statCountries: document.getElementById("stat-countries"),
    statDeaths: document.getElementById("stat-deaths"),
  };

  let all = [];
  let yearBounds = { min: 1864, max: 2026 };
  let selectedId = null;
  let map, cluster;
  const markersById = new Map();

  function yearOf(inc) {
    if (!inc.incident_date) return null;
    const y = parseInt(String(inc.incident_date).slice(0, 4), 10);
    return Number.isFinite(y) ? y : null;
  }

  function dateSortKey(inc) {
    const d = inc.incident_date || "";
    if (d.length >= 10) return d;
    if (d.length === 7) return d + "-01";
    if (d.length === 4) return d + "-01-01";
    return "0000-01-01";
  }

  function formatDate(iso) {
    if (!iso) return "Date unknown";
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const p = String(iso).split("-");
    if (p.length === 1) return p[0];
    const mon = months[parseInt(p[1], 10) - 1] || p[1];
    if (p.length === 2) return mon + " " + p[0];
    return parseInt(p[2], 10) + " " + mon + " " + p[0];
  }

  function formatNum(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function markerRadius(deaths) {
    if (deaths == null || deaths === 0) return 8;
    return Math.min(26, 8 + Math.log10(deaths + 1) * 5.2);
  }

  function activeCategories() {
    const pressed = [...els.chips.querySelectorAll(".chip[aria-pressed='true']")].map(
      (b) => b.dataset.category
    );
    return pressed;
  }

  function currentYear() {
    return new Date().getFullYear();
  }

  function periodRange(period) {
    const y = currentYear();
    const minB = yearBounds.min;
    const maxB = yearBounds.max;
    if (period === "year") return [y, y];
    if (period === "5y") return [y - 4, y];
    if (period === "decade") return [y - 9, y];
    if (period === "century") return [2000, y];
    if (period === "historical") return [minB, 1999];
    return [minB, maxB];
  }

  function setPeriod(period) {
    if (!els.periods) return;
    [...els.periods.querySelectorAll(".chip")].forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.period === period ? "true" : "false");
    });
    const range = periodRange(period);
    els.yearMin.value = range[0];
    els.yearMax.value = range[1];
  }

  function syncPeriodFromYears() {
    if (!els.periods) return;
    const ymin = parseInt(els.yearMin.value, 10);
    const ymax = parseInt(els.yearMax.value, 10);
    let match = null;
    [...els.periods.querySelectorAll(".chip")].forEach((b) => {
      const r = periodRange(b.dataset.period);
      const on = r[0] === ymin && r[1] === ymax;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      if (on) match = b.dataset.period;
    });
    return match;
  }

  function filtered() {
    const q = els.search.value.trim().toLowerCase();
    const cats = activeCategories();
    const type = els.type.value;
    const cause = els.cause ? els.cause.value : "";
    const ymin = parseInt(els.yearMin.value, 10);
    const ymax = parseInt(els.yearMax.value, 10);
    return all.filter((inc) => {
      const y = yearOf(inc);
      if (y != null && (y < ymin || y > ymax)) return false;
      if (cats.length && !cats.includes(inc.category)) return false;
      if (type && inc.type !== type) return false;
      if (cause) {
        const cs = inc.causes || [];
        if (!cs.includes(cause)) return false;
      }
      if (q) {
        const hay = [
          inc.name, inc.country, inc.region, inc.location_label,
          inc.river_or_facility, inc.what_happened, inc.status, inc.id,
          inc.cause_summary, (inc.causes || []).join(" "),
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => dateSortKey(b).localeCompare(dateSortKey(a)) || a.name.localeCompare(b.name));
  }

  function updateStats(rows) {
    els.statCount.textContent = formatNum(rows.length);
    const countries = new Set(rows.map((r) => r.country).filter(Boolean));
    els.statCountries.textContent = formatNum(countries.size);
    const deaths = rows.reduce((s, r) => s + (typeof r.deaths === "number" ? r.deaths : 0), 0);
    els.statDeaths.textContent = formatNum(deaths);
    els.listCount.textContent = rows.length === all.length
      ? rows.length + " records"
      : rows.length + " of " + all.length;
  }

  function renderList(rows) {
    els.list.innerHTML = "";
    els.empty.hidden = rows.length > 0;
    rows.forEach((inc) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "incident-item" + (inc.id === selectedId ? " is-selected" : "");
      btn.dataset.id = inc.id;
      const deaths = typeof inc.deaths === "number"
        ? '<span>' + formatNum(inc.deaths) + ' deaths</span>'
        : "";
      btn.innerHTML =
        '<span class="item-date">' + formatDate(inc.incident_date) + "</span>" +
        '<span class="item-name">' + escapeHtml(inc.name) + "</span>" +
        '<span class="item-meta"><span>' + escapeHtml(inc.country) + "</span>" +
        '<span class="item-cat cat-' + inc.category + '">' + (CATEGORY_LABEL[inc.category] || inc.category) + "</span>" +
        (inc.causes && inc.causes[0] ? '<span class="item-cause">' + escapeHtml(CAUSE_LABEL[inc.causes[0]] || inc.causes[0]) + "</span>" : "") +
        deaths + "</span>";
      btn.addEventListener("click", () => selectIncident(inc.id, { fromList: true }));
      li.appendChild(btn);
      els.list.appendChild(li);
    });
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function popupHtml(inc) {
    return "<strong>" + escapeHtml(inc.name) + "</strong><br>" + escapeHtml(String(yearOf(inc) || ""));
  }

  function rebuildMarkers(rows) {
    cluster.clearLayers();
    markersById.clear();
    rows.forEach((inc) => {
      if (typeof inc.lat !== "number" || typeof inc.lng !== "number") return;
      const r = markerRadius(inc.deaths);
      const color = COLORS[inc.category] || COLORS.incident;
      const icon = L.divIcon({
        className: "",
        iconSize: [r * 2, r * 2],
        iconAnchor: [r, r],
        html: '<div class="site-marker" style="width:' + (r * 2) + "px;height:" + (r * 2) +
          "px;background:" + color + ';opacity:0.88"></div>',
      });
      const m = L.marker([inc.lat, inc.lng], { icon, title: inc.name, riseOnHover: true });
      m.bindPopup(popupHtml(inc), { closeButton: false });
      m.on("click", () => selectIncident(inc.id, { fromMap: true }));
      cluster.addLayer(m);
      markersById.set(inc.id, m);
    });
  }


  const ATTR_LABEL = {
    id: "ID",
    country: "Country",
    region: "Region",
    river_or_facility: "River / facility",
    location_label: "Location",
    lat: "Latitude",
    lng: "Longitude",
    geo_accuracy: "Location accuracy",
    geo_source: "Coordinate source",
    era: "Era",
    latest_report_date: "Latest report",
    last_updated: "Record updated",
    in_baseline: "In baseline",
    type: "Type",
    category: "Category",
    verification: "Verification",
    causes: "Causes",
    cause_summary: "Cause summary",
  };

  const PRIMARY_KEYS = new Set([
    "name", "location_label", "incident_date", "category", "type", "verification",
    "causes", "cause_summary", "what_happened", "status", "deaths", "injured",
    "affected_or_evacuated", "notes", "sources",
  ]);

  function formatAttrValue(key, value) {
    if (value == null || value === "") return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return String(value);
    if (Array.isArray(value)) {
      if (!value.length) return "—";
      if (key === "causes") return value.map((c) => CAUSE_LABEL[c] || c).join(", ");
      if (typeof value[0] === "object") {
        return value.map((s) => (s && (s.label || s.url)) || JSON.stringify(s)).join("; ");
      }
      return value.join(", ");
    }
    if (typeof value === "object") return JSON.stringify(value);
    if (key === "category") return CATEGORY_LABEL[value] || value;
    if (key === "type") return TYPE_LABEL[value] || value;
    return String(value);
  }

  function extraAttributesHtml(inc) {
    const keys = Object.keys(inc).filter((k) => !PRIMARY_KEYS.has(k));
    keys.sort((a, b) => (ATTR_LABEL[a] || a).localeCompare(ATTR_LABEL[b] || b));
    if (!keys.length) return "";
    const rows = keys.map((k) => {
      return "<div class=\"attr-row\"><dt>" + escapeHtml(ATTR_LABEL[k] || k.replace(/_/g, " ")) +
        "</dt><dd>" + escapeHtml(formatAttrValue(k, inc[k])) + "</dd></div>";
    }).join("");
    return '<details class="more-attrs"><summary>Additional attributes</summary><dl class="attr-list">' +
      rows + "</dl></details>";
  }

  function openDetail(inc) {
    const deaths = typeof inc.deaths === "number" ? formatNum(inc.deaths) : "Unknown";
    const injured = typeof inc.injured === "number" ? formatNum(inc.injured) : (inc.injured || "Unknown");
    const affected = inc.affected_or_evacuated || "Unknown";
    const geoNote = inc.geo_accuracy && inc.geo_accuracy !== "exact"
      ? '<p class="geo-note">Location ' + (inc.geo_accuracy === "region" ? "regional (town or district centroid)" : "approximate") +
        ". " + escapeHtml(inc.geo_source || "") + "</p>"
      : "";
    const sources = (inc.sources || []).map((s) => {
      const url = s.url || "";
      const label = escapeHtml(s.label || url);
      if (!url) return "<li>" + label + "</li>";
      return '<li><a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + label + "</a></li>";
    }).join("");
    els.detailBody.innerHTML =
      '<h2 id="detail-title">' + escapeHtml(inc.name) + "</h2>" +
      '<p class="detail-loc">' + escapeHtml(inc.location_label || [inc.region, inc.country].filter(Boolean).join(", ")) + "</p>" +
      '<p class="detail-date">' + formatDate(inc.incident_date) +
        (inc.river_or_facility ? " · " + escapeHtml(inc.river_or_facility) : "") + "</p>" +
      '<div class="badges">' +
        '<span class="badge cat-' + inc.category + '">' + (CATEGORY_LABEL[inc.category] || inc.category) + "</span>" +
        '<span class="badge">' + (TYPE_LABEL[inc.type] || inc.type) + "</span>" +
        (inc.verification ? '<span class="badge">' + escapeHtml(inc.verification) + "</span>" : "") +
      "</div>" + geoNote +
      (inc.causes && inc.causes.length
        ? "<h3>Cause</h3><div class=\"badges\">" +
          inc.causes.map((c) => '<span class="badge">' + escapeHtml(CAUSE_LABEL[c] || c) + "</span>").join("") +
          "</div>" + (inc.cause_summary ? "<p>" + escapeHtml(inc.cause_summary) + "</p>" : "")
        : (inc.cause_summary ? "<h3>Cause</h3><p>" + escapeHtml(inc.cause_summary) + "</p>" : "")) +
      "<h3>What happened</h3><p>" + escapeHtml(inc.what_happened) + "</p>" +
      "<h3>Status</h3><p>" + escapeHtml(inc.status || "—") + "</p>" +
      "<h3>Casualties</h3>" +
      '<div class="casualties">' +
        '<div><span class="cas-label">Deaths</span><span class="cas-value">' + deaths + "</span></div>" +
        '<div><span class="cas-label">Injured</span><span class="cas-value">' + escapeHtml(String(injured)) + "</span></div>" +
        '<div style="grid-column:1/-1"><span class="cas-label">Affected or evacuated</span><span class="cas-value" style="font-size:14px">' + escapeHtml(String(affected)) + "</span></div>" +
      "</div>" +
      (inc.notes ? "<h3>Notes</h3><p>" + escapeHtml(inc.notes) + "</p>" : "") +
      "<h3>Sources</h3><ul class='sources'>" + sources + "</ul>" +
      extraAttributesHtml(inc);
    els.detail.hidden = false;
  }

  function closeDetail() {
    selectedId = null;
    els.detail.hidden = true;
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    [...els.list.querySelectorAll(".incident-item")].forEach((b) => b.classList.remove("is-selected"));
  }

  function selectIncident(id, opts) {
    const inc = all.find((r) => r.id === id);
    if (!inc) return;
    selectedId = id;
    openDetail(inc);
    [...els.list.querySelectorAll(".incident-item")].forEach((b) => {
      b.classList.toggle("is-selected", b.dataset.id === id);
    });
    const row = els.list.querySelector('.incident-item[data-id="' + id + '"]');
    if (row && opts && opts.fromMap) row.scrollIntoView({ block: "nearest" });
    const marker = markersById.get(id);
    if (marker && typeof inc.lat === "number") {
      cluster.zoomToShowLayer(marker, function () {
        map.flyTo([inc.lat, inc.lng], Math.max(map.getZoom(), 8), { duration: 0.7 });
        marker.openPopup();
      });
    }
    const hash = "#id=" + encodeURIComponent(id);
    if (location.hash !== hash) history.replaceState(null, "", hash);
    if (opts && opts.fromList && window.matchMedia("(max-width: 980px)").matches) {
      els.sidebar.classList.remove("is-open");
      els.toggle.setAttribute("aria-expanded", "false");
    }
  }

  function apply() {
    const rows = filtered();
    updateStats(rows);
    renderList(rows);
    rebuildMarkers(rows);
    if (selectedId && !rows.some((r) => r.id === selectedId)) {
      closeDetail();
    } else if (selectedId) {
      const row = els.list.querySelector('.incident-item[data-id="' + selectedId + '"]');
      if (row) row.classList.add("is-selected");
    }
  }

  function fillTypeFilter() {
    const types = [...new Set(all.map((i) => i.type))].sort();
    types.forEach((t) => {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = TYPE_LABEL[t] || t;
      els.type.appendChild(o);
    });
  }

  function fillCauseFilter() {
    if (!els.cause) return;
    const seen = new Set();
    all.forEach((i) => (i.causes || []).forEach((c) => seen.add(c)));
    [...seen].sort((a, b) => (CAUSE_LABEL[a] || a).localeCompare(CAUSE_LABEL[b] || b)).forEach((c) => {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = CAUSE_LABEL[c] || c;
      els.cause.appendChild(o);
    });
  }

  function bind() {
    els.search.addEventListener("input", apply);
    els.type.addEventListener("change", apply);
    if (els.cause) els.cause.addEventListener("change", apply);
    els.yearMin.addEventListener("change", () => { syncPeriodFromYears(); apply(); });
    els.yearMax.addEventListener("change", () => { syncPeriodFromYears(); apply(); });
    if (els.periods) {
      els.periods.addEventListener("click", (e) => {
        const btn = e.target.closest(".chip");
        if (!btn) return;
        setPeriod(btn.dataset.period);
        apply();
      });
    }
    els.chips.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      btn.setAttribute("aria-pressed", btn.getAttribute("aria-pressed") === "true" ? "false" : "true");
      apply();
    });
    els.detailClose.addEventListener("click", closeDetail);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (!els.detail.hidden) closeDetail();
        else {
          els.sidebar.classList.remove("is-open");
          els.toggle.setAttribute("aria-expanded", "false");
        }
      }
    });
    els.toggle.addEventListener("click", () => {
      const open = !els.sidebar.classList.contains("is-open");
      els.sidebar.classList.toggle("is-open", open);
      els.toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    window.addEventListener("worldwatch:reload", () => location.reload());
    window.addEventListener("hashchange", () => {
      const id = hashId();
      if (id) selectIncident(id);
      else closeDetail();
    });
  }

  function hashId() {
    const m = location.hash.match(/id=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function initMap() {
    map = L.map("map", {
      zoomControl: false,
      attributionControl: true,
      worldCopyJump: true,
    }).setView([22, 12], 2.4);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);
    cluster = L.markerClusterGroup({
      maxClusterRadius: 42,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 10,
    });
    map.addLayer(cluster);
    setTimeout(() => map.invalidateSize(), 80);
  }

  fetch(DATA_URL)
    .then((r) => {
      if (!r.ok) throw new Error("Could not load incidents.json");
      return r.json();
    })
    .then((data) => {
      all = data.incidents || [];
      const years = all.map(yearOf).filter((y) => y != null);
      yearBounds.min = Math.min.apply(null, years);
      yearBounds.max = Math.max.apply(null, years);
      els.yearMin.min = yearBounds.min;
      els.yearMin.max = yearBounds.max;
      els.yearMax.min = yearBounds.min;
      els.yearMax.max = yearBounds.max;
      els.yearMin.value = yearBounds.min;
      els.yearMax.value = yearBounds.max;
      fillTypeFilter();
      fillCauseFilter();
      initMap();
      bind();
      apply();
      const id = hashId();
      if (id) selectIncident(id);
    })
    .catch((err) => {
      els.empty.hidden = false;
      els.empty.textContent = "Could not load incident data.";
      console.error(err);
    });
})();
