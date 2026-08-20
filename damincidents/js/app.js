(function () {
  "use strict";

  const LAYERS = {
    dams: {
      id: "dams",
      title: "Dam Incidents",
      subtitle: "Hourly world screen. Sourced archive, still growing.",
      dataUrl: "data/incidents.json",
      rowsKey: "incidents",
      statLabel: "Incidents",
      recentLabel: "Recent incidents",
      credit: "worldwatcher.app",
      showCategory: true,
      showCause: true,
    },
    floods: {
      id: "floods",
      title: "Floods",
      subtitle: "Major named floods only",
      dataUrl: "data/floods.json",
      rowsKey: "events",
      statLabel: "Floods",
      recentLabel: "Recent floods",
      credit: "worldwatcher.app",
      showCategory: false,
      showCause: true,
    },
  };

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
    storm_surge: "Storm surge",
    snowmelt: "Snowmelt",
    ice_jam: "Ice jam",
    monsoon: "Monsoon",
    tropical_cyclone: "Tropical cyclone",
    dam_release: "Dam release",
    urban_drainage: "Urban drainage",
  };

  const FLOOD_TYPE_LABEL = {
    riverine: "Riverine",
    flash: "Flash",
    coastal: "Coastal",
    urban: "Urban",
    ice_jam: "Ice jam",
    glacial: "Glacial",
    storm: "Storm",
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
    cause: document.getElementById("cause-filter"),
    yearMin: document.getElementById("year-min"),
    yearMax: document.getElementById("year-max"),
    yearSliderMin: document.getElementById("year-slider-min"),
    yearSliderMax: document.getElementById("year-slider-max"),
    yearSliderFill: document.getElementById("year-slider-fill"),
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
    home: document.getElementById("home"),
    layerTabs: document.querySelector(".layer-tabs"),
    subtitle: document.getElementById("layer-subtitle"),
    categoryBlock: document.getElementById("category-block"),
    causeBlock: document.getElementById("cause-block"),
    statCountLabel: document.getElementById("stat-count-label"),
    recentHeading: document.getElementById("recent-heading"),
    statsPanel: document.getElementById("stats-panel"),
    statsBody: document.getElementById("stats-body"),
    statsOpen: document.getElementById("stats-open"),
    statsClose: document.getElementById("stats-close"),
    dashboardYearMin: document.getElementById("dashboard-year-min"),
    dashboardYearMax: document.getElementById("dashboard-year-max"),
    dashboardYearSliderMin: document.getElementById("dashboard-year-slider-min"),
    dashboardYearSliderMax: document.getElementById("dashboard-year-slider-max"),
    dashboardYearSliderFill: document.getElementById("dashboard-year-slider-fill"),
    dashboardPeriods: document.getElementById("dashboard-period-chips"),
    dashboardCount: document.getElementById("dashboard-count"),
  };

  let layer = "dams";
  const cache = { dams: null, floods: null };


  let all = [];
  let yearBounds = { min: 1864, max: 2026 };
  let dashboardYearBounds = { min: 1864, max: 2026 };
  let dashboardYearRange = { min: 2000, max: 2026 };
  let selectedId = null;
  let lastDetailTab = "event";
  let map, cluster, selectedLayer, fallbackLayer;
  const markersById = new Map();
  const fallbackMarkersById = new Map();
  let pinNamesEnabled = localStorage.getItem("ww-pin-names") !== "off";
  let currentTheme = localStorage.getItem("ww-theme") || "dark";


  function spec() { return LAYERS[layer] || LAYERS.dams; }

  function markerColor(inc) {
    if (layer === "floods") {
      if (inc.severity === "catastrophic") return COLORS.failure;
      if (inc.severity === "major") return COLORS.partial;
      return COLORS.incident;
    }
    return COLORS[inc.category] || COLORS.incident;
  }

  function locationUncertain(inc) {
    if (inc.location_uncertain === true) return true;
    const acc = inc.geo_accuracy;
    return acc === "approx" || acc === "region";
  }

  function locationLabel(inc) {
    if (inc.location_uncertain === true) return "Location uncertain";
    if (inc.geo_accuracy === "region") return "Location uncertain (town or district)";
    if (inc.geo_accuracy === "approx") return "Location approximate";
    return "";
  }

  function yearOf(inc) {
    if (!inc.incident_date) return null;
    const str = String(inc.incident_date);
    const y = parseInt(str.startsWith("-") ? str.slice(0, 5) : str.slice(0, 4), 10);
    return Number.isFinite(y) ? y : null;
  }

  function dateSortKey(inc) {
    const d = inc.incident_date || "";
    const isBC = String(d).startsWith("-");
    if (isBC) {
      const rest = d.slice(1);
      if (rest.length >= 10) return d;
      if (rest.length === 7) return d + "-01";
      if (rest.length === 4) return d + "-01-01";
      return "-9999-01-01";
    }
    if (d.length >= 10) return d;
    if (d.length === 7) return d + "-01";
    if (d.length === 4) return d + "-01-01";
    return "0000-01-01";
  }

  function formatDate(iso) {
    if (!iso) return "Date unknown";
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const str = String(iso);
    const isBC = str.startsWith("-");
    const dateStr = isBC ? str.slice(1) : str;
    const p = dateStr.split("-");
    
    function bcSuffix(yearStr) {
      const y = parseInt(yearStr, 10);
      if (isBC) {
        return (y === 0 ? "1" : yearStr) + " BC";
      }
      return yearStr;
    }
    
    if (p.length === 1) return bcSuffix(p[0]);
    const mon = months[parseInt(p[1], 10) - 1] || p[1];
    if (p.length === 2) return mon + " " + bcSuffix(p[0]);
    return parseInt(p[2], 10) + " " + mon + " " + bcSuffix(p[0]);
  }

  function formatNum(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function formatYear(y) {
    if (y < 1) {
      const bc = y === 0 ? 1 : Math.abs(y);
      return bc + " BC";
    }
    return String(y);
  }

  let lastScreenInterval = null;

  function updateLastScreen() {
    if (lastScreenInterval) {
      clearInterval(lastScreenInterval);
      lastScreenInterval = null;
    }

    const updatedEl = document.getElementById("data-updated");
    if (!updatedEl) return;

    fetch("data/last-screen.json")
      .then((res) => {
        if (!res.ok) throw new Error("not found");
        return res.json();
      })
      .then((data) => {
        if (!data.at) {
          updatedEl.textContent = "";
          return;
        }

        function render() {
          const atDate = new Date(data.at);
          if (isNaN(atDate.getTime())) {
            updatedEl.textContent = "";
            return;
          }

          const now = new Date();
          const nowUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
          const atUTC = Date.UTC(atDate.getUTCFullYear(), atDate.getUTCMonth(), atDate.getUTCDate());

          const hours = String(atDate.getUTCHours()).padStart(2, "0");
          const minutes = String(atDate.getUTCMinutes()).padStart(2, "0");
          const time = hours + ":" + minutes + " UTC";

          let datePrefix = "";
          if (atUTC < nowUTC) {
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const day = atDate.getUTCDate();
            const month = months[atDate.getUTCMonth()];
            datePrefix = day + " " + month + ", ";
          }

          const diffMs = Date.now() - atDate.getTime();
          const delayed = diffMs > 90 * 60 * 1000 ? " · delayed" : "";

          updatedEl.textContent = "Last screen " + datePrefix + time + delayed;
        }

        render();
        lastScreenInterval = setInterval(render, 60000);
      })
      .catch(() => {
        updatedEl.textContent = "";
      });
  }

  function parseYearInput(str) {
    if (!str) return NaN;
    const s = String(str).trim().toUpperCase();
    const bcMatch = s.match(/^(\d+)\s*BC?$/);
    if (bcMatch) return -parseInt(bcMatch[1], 10);
    return parseInt(s, 10);
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
    if (period === "lastyear") return [y - 1, y - 1];
    if (period === "5y") return [y - 4, y];
    if (period === "decade") return [y - 9, y];
    if (period === "century") return [2000, y];
    if (period === "historical") return [minB, 1999];
    if (period === "pre1900") return [minB, 1899];
    if (period === "pre1800") return [minB, 1799];
    return [minB, maxB];
  }

  function setPeriod(period) {
    if (!els.periods) return;
    [...els.periods.querySelectorAll(".chip")].forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.period === period ? "true" : "false");
    });
    const range = periodRange(period);
    setYearInputs(range[0], range[1]);
  }

  function yearPair() {
    let a = parseYearInput(els.yearMin.value);
    let b = parseYearInput(els.yearMax.value);
    if (Number.isNaN(a)) a = els.yearMin.dataset.numericValue ? parseInt(els.yearMin.dataset.numericValue, 10) : yearBounds.min;
    if (Number.isNaN(b)) b = els.yearMax.dataset.numericValue ? parseInt(els.yearMax.dataset.numericValue, 10) : yearBounds.max;
    if (Number.isNaN(a)) a = yearBounds.min;
    if (Number.isNaN(b)) b = yearBounds.max;
    return [a, b];
  }

  const SLIDER_STEPS = 10000;
  const ANCIENT_FRAC = 0.14;

  function sliderFloor() {
    return yearBounds.min >= 1700 ? yearBounds.min : 1700;
  }

  function yearToPos(y) {
    const lo = yearBounds.min;
    const hi = yearBounds.max;
    const floor = sliderFloor();
    y = Math.max(lo, Math.min(hi, y));
    if (lo >= floor) {
      return Math.round(((y - lo) / Math.max(1, hi - lo)) * SLIDER_STEPS);
    }
    if (y < floor) {
      const t = (y - lo) / Math.max(1, (floor - 1) - lo);
      return Math.round(t * ANCIENT_FRAC * SLIDER_STEPS);
    }
    const t = (y - floor) / Math.max(1, hi - floor);
    return Math.round((ANCIENT_FRAC + t * (1 - ANCIENT_FRAC)) * SLIDER_STEPS);
  }

  function posToYear(p) {
    const lo = yearBounds.min;
    const hi = yearBounds.max;
    const floor = sliderFloor();
    p = Math.max(0, Math.min(SLIDER_STEPS, Number(p)));
    const t = p / SLIDER_STEPS;
    if (lo >= floor) {
      return Math.round(lo + t * (hi - lo));
    }
    if (t <= ANCIENT_FRAC) {
      const u = t / ANCIENT_FRAC;
      return Math.round(lo + u * ((floor - 1) - lo));
    }
    const u = (t - ANCIENT_FRAC) / (1 - ANCIENT_FRAC);
    return Math.round(floor + u * (hi - floor));
  }

  function paintYearSlider() {
    if (!els.yearSliderMin || !els.yearSliderMax) return;
    const [a, b] = yearPair();
    els.yearSliderMin.min = 0;
    els.yearSliderMin.max = SLIDER_STEPS;
    els.yearSliderMax.min = 0;
    els.yearSliderMax.max = SLIDER_STEPS;
    const pa = yearToPos(a);
    const pb = yearToPos(b);
    els.yearSliderMin.value = pa;
    els.yearSliderMax.value = pb;
    const wrap = document.getElementById("year-slider");
    if (wrap) wrap.classList.remove("is-ancient");
    if (!els.yearSliderFill) return;
    const left = (Math.min(pa, pb) / SLIDER_STEPS) * 100;
    const right = (Math.max(pa, pb) / SLIDER_STEPS) * 100;
    els.yearSliderFill.style.left = left + "%";
    els.yearSliderFill.style.width = Math.max(0, right - left) + "%";
  }

  function setYearInputs(min, max) {
    if (min > max) {
      const t = min;
      min = max;
      max = t;
    }
    min = Math.max(yearBounds.min, Math.min(yearBounds.max, min));
    max = Math.max(yearBounds.min, Math.min(yearBounds.max, max));
    els.yearMin.value = formatYear(min);
    els.yearMax.value = formatYear(max);
    els.yearMin.dataset.numericValue = min;
    els.yearMax.dataset.numericValue = max;
    paintYearSlider();
  }

  function syncPeriodFromYears() {
    if (!els.periods) return;
    const ymin = parseYearInput(els.yearMin.value);
    const ymax = parseYearInput(els.yearMax.value);
    let match = null;
    [...els.periods.querySelectorAll(".chip")].forEach((b) => {
      const r = periodRange(b.dataset.period);
      const on = r[0] === ymin && r[1] === ymax;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      if (on) match = b.dataset.period;
    });
    return match;
  }

  function dashboardYearPair() {
    let a = parseYearInput(els.dashboardYearMin.value);
    let b = parseYearInput(els.dashboardYearMax.value);
    if (Number.isNaN(a)) a = els.dashboardYearMin.dataset.numericValue ? parseInt(els.dashboardYearMin.dataset.numericValue, 10) : dashboardYearBounds.min;
    if (Number.isNaN(b)) b = els.dashboardYearMax.dataset.numericValue ? parseInt(els.dashboardYearMax.dataset.numericValue, 10) : dashboardYearBounds.max;
    if (Number.isNaN(a)) a = dashboardYearBounds.min;
    if (Number.isNaN(b)) b = dashboardYearBounds.max;
    return [a, b];
  }

  function setDashboardYearInputs(min, max) {
    if (min > max) {
      const t = min;
      min = max;
      max = t;
    }
    min = Math.max(dashboardYearBounds.min, Math.min(dashboardYearBounds.max, min));
    max = Math.max(dashboardYearBounds.min, Math.min(dashboardYearBounds.max, max));
    dashboardYearRange.min = min;
    dashboardYearRange.max = max;
    els.dashboardYearMin.value = formatYear(min);
    els.dashboardYearMax.value = formatYear(max);
    els.dashboardYearMin.dataset.numericValue = min;
    els.dashboardYearMax.dataset.numericValue = max;
    paintDashboardYearSlider();
  }

  function paintDashboardYearSlider() {
    if (!els.dashboardYearSliderMin || !els.dashboardYearSliderMax) return;
    const [a, b] = dashboardYearPair();
    els.dashboardYearSliderMin.min = 0;
    els.dashboardYearSliderMin.max = SLIDER_STEPS;
    els.dashboardYearSliderMax.min = 0;
    els.dashboardYearSliderMax.max = SLIDER_STEPS;
    const pa = yearToPos(a);
    const pb = yearToPos(b);
    els.dashboardYearSliderMin.value = pa;
    els.dashboardYearSliderMax.value = pb;
    const wrap = document.getElementById("dashboard-year-slider");
    if (wrap) wrap.classList.remove("is-ancient");
    if (!els.dashboardYearSliderFill) return;
    const left = (Math.min(pa, pb) / SLIDER_STEPS) * 100;
    const right = (Math.max(pa, pb) / SLIDER_STEPS) * 100;
    els.dashboardYearSliderFill.style.left = left + "%";
    els.dashboardYearSliderFill.style.width = Math.max(0, right - left) + "%";
  }

  function setDashboardPeriod(period) {
    if (!els.dashboardPeriods) return;
    [...els.dashboardPeriods.querySelectorAll(".chip")].forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.period === period ? "true" : "false");
    });
    const range = periodRange(period);
    setDashboardYearInputs(range[0], range[1]);
  }

  function syncDashboardPeriodFromYears() {
    if (!els.dashboardPeriods) return;
    const ymin = parseYearInput(els.dashboardYearMin.value);
    const ymax = parseYearInput(els.dashboardYearMax.value);
    let match = null;
    [...els.dashboardPeriods.querySelectorAll(".chip")].forEach((b) => {
      const r = periodRange(b.dataset.period);
      const on = r[0] === ymin && r[1] === ymax;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      if (on) match = b.dataset.period;
    });
    return match;
  }

  function filterDashboardIncidents() {
    const [ymin, ymax] = dashboardYearPair();
    return all.filter((inc) => {
      const y = yearOf(inc);
      if (y != null && (y < ymin || y > ymax)) return false;
      return true;
    });
  }

  function renderDashboard() {
    if (!els.statsBody || !window.worldwatcherStats) return;
    const filtered = filterDashboardIncidents();
    const html = window.worldwatcherStats.render(filtered, layer);
    els.statsBody.innerHTML = html;
    if (els.dashboardCount) {
      const total = all.length;
      els.dashboardCount.textContent = filtered.length === total
        ? `${formatNum(total)} incidents`
        : `${formatNum(filtered.length)} of ${formatNum(total)} incidents`;
    }
  }

  function filtered() {
    const q = els.search.value.trim().toLowerCase();
    const cats = activeCategories();
    const cause = els.cause ? els.cause.value : "";
    const [ymin, ymax] = yearPair();
    return all.filter((inc) => {
      const y = yearOf(inc);
      if (y != null && (y < ymin || y > ymax)) return false;
      if (cats.length && !cats.includes(inc.category)) return false;
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
    const knownDeaths = rows.filter((r) => typeof r.deaths === "number");
    const deaths = knownDeaths.reduce((s, r) => s + r.deaths, 0);
    const unknownDeaths = rows.length - knownDeaths.length;
    els.statDeaths.textContent = formatNum(deaths) + (unknownDeaths ? "+" : "");
    els.statDeaths.title = unknownDeaths
      ? formatNum(deaths) + " confirmed. " + unknownDeaths + " records have no sourced death toll."
      : "";
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
        '<span class="item-cat cat-' + (inc.category || inc.severity || "incident") + '">' +
        escapeHtml(layer === "floods"
          ? (FLOOD_TYPE_LABEL[inc.flood_type] || inc.flood_type || "Flood")
          : (CATEGORY_LABEL[inc.category] || inc.category)) + "</span>" +
        (inc.causes && inc.causes[0] ? '<span class="item-cause">' + escapeHtml(CAUSE_LABEL[inc.causes[0]] || inc.causes[0]) + "</span>" : "") +
        (locationUncertain(inc) ? '<span class="item-geo">Location uncertain</span>' : "") +
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
    const geo = locationLabel(inc);
    const year = yearOf(inc);
    const yearStr = year != null ? formatYear(year) : "";
    return "<strong>" + escapeHtml(inc.name) + "</strong><br>" + escapeHtml(yearStr) +
      (geo ? "<br><em>" + escapeHtml(geo) + "</em>" : "");
  }

  function rebuildMarkers(rows) {
    cluster.clearLayers();
    markersById.clear();
    rows.forEach((inc) => {
      if (typeof inc.lat !== "number" || typeof inc.lng !== "number") return;
      const r = markerRadius(inc.deaths);
      const color = markerColor(inc);
      const uncertain = locationUncertain(inc);
      const cls = "site-marker" + (uncertain ? " is-uncertain" : "");
      const icon = L.divIcon({
        className: "",
        iconSize: [r * 2, r * 2],
        iconAnchor: [r, r],
        html: '<div class="' + cls + '" style="width:' + (r * 2) + "px;height:" + (r * 2) +
          "px;background:" + color + (uncertain ? ";opacity:0.55" : ";opacity:0.88") + '"></div>',
      });
      const m = L.marker([inc.lat, inc.lng], { icon, riseOnHover: true });
      m.bindPopup(popupHtml(inc), { closeButton: false });
      m.on("click", () => selectIncident(inc.id, { fromMap: true }));
      m._incidentName = inc.name;
      m._markerRadius = r;
      cluster.addLayer(m);
      markersById.set(inc.id, m);
    });
    updateFallbackMarkers();
    updateNameLabels();
  }

  function distanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function findIsolatedIncidents(rows, thresholdKm) {
    const isolated = [];
    rows.forEach((inc) => {
      if (typeof inc.lat !== "number" || typeof inc.lng !== "number") return;
      let hasNearby = false;
      for (let other of rows) {
        if (other.id === inc.id) continue;
        if (typeof other.lat !== "number" || typeof other.lng !== "number") continue;
        const dist = distanceKm(inc.lat, inc.lng, other.lat, other.lng);
        if (dist < thresholdKm) {
          hasNearby = true;
          break;
        }
      }
      if (!hasNearby) isolated.push(inc);
    });
    return isolated;
  }

  function updateFallbackMarkers() {
    if (!fallbackLayer) return;
    fallbackLayer.clearLayers();
    fallbackMarkersById.clear();
    const currentZoom = map.getZoom();
    const rows = filtered();
    const isolated = findIsolatedIncidents(rows, 350);
    isolated.forEach((inc) => {
      const r = markerRadius(inc.deaths);
      const color = markerColor(inc);
      const uncertain = locationUncertain(inc);
      const m = L.circleMarker([inc.lat, inc.lng], {
        pane: "fallbackPane",
        radius: r,
        color: color,
        weight: 0,
        fillColor: color,
        fillOpacity: uncertain ? 0.55 : 0.88,
      });
      m.bindPopup(popupHtml(inc), { closeButton: false });
      m.on("click", () => selectIncident(inc.id, { fromMap: true }));
      m._incidentName = inc.name;
      m._markerRadius = r;
      m.addTo(fallbackLayer);
      fallbackMarkersById.set(inc.id, m);
    });
    updateNameLabels();
  }

  let nameLabelsTimer = null;
  
  function updateNameLabels() {
    if (nameLabelsTimer) clearTimeout(nameLabelsTimer);
    nameLabelsTimer = setTimeout(updateNameLabelsNow, 60);
  }
  
  function updateNameLabelsNow() {
    if (!map) return;
    const zoom = map.getZoom();
    const showLabels = zoom >= 10 && pinNamesEnabled;
    
    if (!showLabels) {
      cluster.eachLayer((m) => {
        if (m && m.getTooltip()) m.unbindTooltip();
      });
      fallbackMarkersById.forEach((m) => {
        if (m && m.getTooltip()) m.unbindTooltip();
      });
      selectedLayer.eachLayer((m) => {
        if (m && m.getTooltip()) m.unbindTooltip();
      });
      return;
    }
    
    const bounds = map.getBounds();
    if (!bounds) return;
    const padded = bounds.pad(0.15);
    
    const processMarker = (m) => {
      if (!m || !m._incidentName) return;
      const latlng = m.getLatLng();
      if (!latlng) return;
      
      const inView = padded.contains(latlng);
      const hasTooltip = m.getTooltip();
      
      if (inView && !hasTooltip) {
        const r = m._markerRadius || 8;
        m.bindTooltip(m._incidentName, {
          permanent: true,
          direction: "top",
          offset: [0, -r],
          className: "pin-name",
          interactive: false,
        });
      } else if (!inView && hasTooltip) {
        m.unbindTooltip();
      }
    };
    
    cluster.eachLayer(processMarker);
    
    fallbackMarkersById.forEach(processMarker);
    
    selectedLayer.eachLayer(processMarker);
  }


  const CONSTRUCTION_LABEL = {
    earthfill: "Earthfill",
    rockfill: "Rockfill",
    concrete_gravity: "Concrete gravity",
    concrete_arch: "Concrete arch",
    concrete: "Concrete",
    tailings: "Tailings",
    embankment: "Embankment",
    masonry: "Masonry",
    unknown: "Unknown",
  };
  const PURPOSE_LABEL = {
    hydro: "Hydro",
    irrigation: "Irrigation",
    water_supply: "Water supply",
    flood_control: "Flood control",
    mining: "Mining",
    recreation: "Recreation",
    multipurpose: "Multipurpose",
    unknown: "Unknown",
  };
  const SEVERITY_LABEL = {
    catastrophic: "Catastrophic",
    major: "Major",
    moderate: "Moderate",
    minor: "Minor",
    watch: "Watch",
  };

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
    owner_operator: "Owner / operator",
    year_built: "Year built",
    height_m: "Height (m)",
    reservoir_capacity: "Reservoir capacity",
    construction: "Construction",
    purpose: "Purpose",
    volume_released: "Volume released",
    breach_size: "Breach size",
    downstream_risk: "Downstream at risk",
    economic_damage: "Economic damage",
    investigating_agency: "Investigating agency",
    severity: "Severity",
    flood_type: "Flood type",
    river_or_basin: "River / basin",
    peak_discharge: "Peak discharge",
    return_period: "Return period",
    rainfall_mm: "Rainfall",
    inundation_area: "Inundation area",
    warning_issued: "Warning issued",
    related_dam_id: "Related dam record",
  };

  const DAM_KEYS = [
    "owner_operator", "year_built", "height_m", "reservoir_capacity",
    "construction", "purpose", "type",
  ];
  const FLOOD_KEYS = [
    "flood_type", "river_or_basin", "peak_discharge", "return_period",
    "rainfall_mm", "inundation_area", "warning_issued", "related_dam_id",
  ];
  const IMPACT_KEYS = [
    "severity", "volume_released", "breach_size", "downstream_risk",
    "economic_damage", "investigating_agency",
  ];
  const META_KEYS = [
    "id", "country", "region", "river_or_facility", "lat", "lng",
    "geo_accuracy", "geo_source", "era", "latest_report_date",
    "last_updated", "category", "verification",
  ];

  const PRIMARY_KEYS = new Set([
    "name", "location_label", "incident_date", "category", "type", "verification",
    "causes", "cause_summary", "what_happened", "status", "deaths", "injured",
    "affected_or_evacuated", "notes", "sources",
    "owner_operator", "year_built", "height_m", "reservoir_capacity",
    "construction", "purpose", "volume_released", "breach_size",
    "downstream_risk", "economic_damage", "investigating_agency", "severity",
    "id", "country", "region", "river_or_facility", "lat", "lng",
    "geo_accuracy", "geo_source", "era", "latest_report_date",
    "last_updated", "in_baseline",
    "flood_type", "river_or_basin", "peak_discharge", "return_period",
    "rainfall_mm", "inundation_area", "warning_issued", "related_dam_id",
    "changelog",
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
    if (key === "construction") return CONSTRUCTION_LABEL[value] || value;
    if (key === "purpose") return PURPOSE_LABEL[value] || value;
    if (key === "severity") return SEVERITY_LABEL[value] || value;
    if (key === "flood_type") return FLOOD_TYPE_LABEL[value] || value;
    return String(value);
  }

  function attrListHtml(inc, keys) {
    const rows = keys.map((k) => {
      return "<div class=\"attr-row\"><dt>" + escapeHtml(ATTR_LABEL[k] || k.replace(/_/g, " ")) +
        "</dt><dd>" + escapeHtml(formatAttrValue(k, inc[k])) + "</dd></div>";
    }).join("");
    return '<dl class="attr-list">' + rows + "</dl>";
  }

  function extraAttributesHtml(inc) {
    const keys = Object.keys(inc).filter((k) => !PRIMARY_KEYS.has(k));
    keys.sort((a, b) => (ATTR_LABEL[a] || a).localeCompare(ATTR_LABEL[b] || b));
    if (!keys.length) return "";
    return "<h3>Additional attributes</h3>" + attrListHtml(inc, keys);
  }

  function changelogHtml(inc) {
    const log = inc.changelog;
    if (!log || !Array.isArray(log) || log.length === 0) return "";
    
    const BY_LABEL = {
      night_qc: "Night QC",
      historic_backfill: "Historic backfill",
      hourly_watch: "Hourly watch",
      qc: "QC",
      backfill: "Backfill",
    };
    
    const items = log.map((entry) => {
      const dateStr = entry.date || "";
      const formattedDate = formatDate(dateStr);
      const byLabel = BY_LABEL[entry.by] || entry.by || "";
      const changeText = escapeHtml(entry.change || "");
      
      return '<li class="changelog-item">' +
        '<span class="changelog-date">' + escapeHtml(formattedDate) + '</span>' +
        (byLabel ? ' · <span class="changelog-by">' + escapeHtml(byLabel) + '</span>' : '') +
        (changeText ? ' · ' + changeText : '') +
        '</li>';
    }).join("");
    
    return "<h3>Change log</h3><ul class='changelog'>" + items + "</ul>";
  }

  function setDetailTab(name) {
    const allowed = ["event", "dam", "flood", "cause", "impact", "sources"];
    if (allowed.indexOf(name) < 0) name = "event";
    lastDetailTab = name;
    const root = els.detailBody;
    if (!root) return;
    root.querySelectorAll(".detail-tab").forEach((btn) => {
      const on = btn.dataset.tab === name;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    root.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.hidden = panel.dataset.tab !== name;
    });
  }

  function openDetail(inc) {
    const deaths = typeof inc.deaths === "number" ? formatNum(inc.deaths) : "Unknown";
    const injured = typeof inc.injured === "number" ? formatNum(inc.injured) : (inc.injured || "Unknown");
    const affected = inc.affected_or_evacuated || "Unknown";
    const geoText = locationLabel(inc);
    const geoNote = geoText
      ? '<p class="geo-note is-uncertain">' + escapeHtml(geoText) +
        (inc.geo_source ? " · " + escapeHtml(inc.geo_source) : "") +
        ' <button type="button" class="text-btn pin-fix" data-pin-fix="1">Suggest a better pin</button></p>'
      : "";
    const sources = (inc.sources || []).map((s) => {
      const url = s.url || "";
      const label = escapeHtml(s.label || url);
      if (!url) return "<li>" + label + "</li>";
      return '<li><a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + label + "</a></li>";
    }).join("");
    const causeBlock = (inc.causes && inc.causes.length
      ? '<div class="badges">' +
        inc.causes.map((c) => '<span class="badge">' + escapeHtml(CAUSE_LABEL[c] || c) + "</span>").join("") +
        "</div>" + (inc.cause_summary ? "<p>" + escapeHtml(inc.cause_summary) + "</p>" : "")
      : (inc.cause_summary ? "<p>" + escapeHtml(inc.cause_summary) + "</p>" : "<p>—</p>"));
    const tabs = [
      ["event", "Event"],
      [layer === "floods" ? "flood" : "dam", layer === "floods" ? "Flood" : "Dam"],
      ["cause", "Cause"],
      ["impact", "Impact"],
      ["sources", "Sources"],
    ].map((pair) => {
      return '<button type="button" class="detail-tab" role="tab" data-tab="' + pair[0] +
        '" aria-selected="false">' + pair[1] + "</button>";
    }).join("");

    els.detailBody.innerHTML =
      '<h2 id="detail-title">' + escapeHtml(inc.name) + "</h2>" +
      '<p class="detail-loc">' + escapeHtml(inc.location_label || [inc.region, inc.country].filter(Boolean).join(", ")) + "</p>" +
      '<p class="detail-date">' + formatDate(inc.incident_date) +
        (inc.river_or_facility ? " · " + escapeHtml(inc.river_or_facility) : "") + "</p>" +
      '<div class="badges">' +
        (layer === "floods"
          ? '<span class="badge cat-incident">' + escapeHtml(FLOOD_TYPE_LABEL[inc.flood_type] || inc.flood_type || "Flood") + "</span>"
          : '<span class="badge cat-' + inc.category + '">' + (CATEGORY_LABEL[inc.category] || inc.category) + "</span>" +
            '<span class="badge">' + (TYPE_LABEL[inc.type] || inc.type || "") + "</span>") +
        (inc.verification ? '<span class="badge">' + escapeHtml(inc.verification) + "</span>" : "") +
        (inc.severity ? '<span class="badge">' + escapeHtml(SEVERITY_LABEL[inc.severity] || inc.severity) + "</span>" : "") +
      "</div>" + geoNote +
      '<div class="detail-tabs" role="tablist" aria-label="Incident sections">' + tabs + "</div>" +
      '<div class="tab-panel" data-tab="event" role="tabpanel">' +
        "<h3>What happened</h3><p>" + escapeHtml(inc.what_happened) + "</p>" +
        "<h3>Status</h3><p>" + escapeHtml(inc.status || "—") + "</p>" +
        "<h3>Casualties</h3>" +
        '<div class="casualties">' +
          '<div><span class="cas-label">Deaths</span><span class="cas-value">' + deaths + "</span></div>" +
          '<div><span class="cas-label">Injured</span><span class="cas-value">' + escapeHtml(String(injured)) + "</span></div>" +
          '<div style="grid-column:1/-1"><span class="cas-label">Affected or evacuated</span><span class="cas-value" style="font-size:14px">' + escapeHtml(String(affected)) + "</span></div>" +
        "</div>" +
        (inc.notes ? "<h3>Notes</h3><p>" + escapeHtml(inc.notes) + "</p>" : "") +
      "</div>" +
      '<div class="tab-panel" data-tab="' + (layer === "floods" ? "flood" : "dam") + '" role="tabpanel" hidden>' +
        attrListHtml(inc, layer === "floods" ? FLOOD_KEYS : DAM_KEYS) +
      "</div>" +
      '<div class="tab-panel" data-tab="cause" role="tabpanel" hidden>' +
        causeBlock +
      "</div>" +
      '<div class="tab-panel" data-tab="impact" role="tabpanel" hidden>' +
        attrListHtml(inc, IMPACT_KEYS) +
      "</div>" +
      '<div class="tab-panel" data-tab="sources" role="tabpanel" hidden>' +
        "<h3>Sources</h3><ul class='sources'>" + sources + "</ul>" +
        "<h3>Record</h3>" + attrListHtml(inc, META_KEYS) +
        extraAttributesHtml(inc) +
        changelogHtml(inc) +
      "</div>";
    setDetailTab(lastDetailTab);
    els.detail.hidden = false;
  }


  function closeDetail() {
    selectedId = null;
    els.detail.hidden = true;
    writeHash(null);
    if (selectedLayer) selectedLayer.clearLayers();
    [...els.list.querySelectorAll(".incident-item")].forEach((b) => b.classList.remove("is-selected"));
  }

  function selectionPadding() {
    const narrow = window.matchMedia("(max-width: 980px)").matches;
    if (narrow) {
      const bottom = Math.round(window.innerHeight * 0.52) + 20;
      return { paddingTopLeft: [16, 20], paddingBottomRight: [16, bottom] };
    }
    return { paddingTopLeft: [416, 20], paddingBottomRight: [380, 64] };
  }

  function showSelectedPin(inc) {
    if (!selectedLayer || typeof inc.lat !== "number" || typeof inc.lng !== "number") return;
    selectedLayer.clearLayers();
    const m = L.circleMarker([inc.lat, inc.lng], {
      pane: "selectedPane",
      radius: 11,
      color: "#f3efe6",
      weight: 2,
      fillColor: markerColor(inc),
      fillOpacity: 0.95,
      interactive: false,
    });
    m._incidentName = inc.name;
    m._markerRadius = 11;
    m.addTo(selectedLayer);
    updateNameLabels();
  }

  function focusSelectedIncident(inc) {
    map.invalidateSize();
    map.setView([inc.lat, inc.lng], 13, { animate: false });
    const size = map.getSize();
    if (!size.x || !size.y) return;
    const narrow = window.matchMedia("(max-width: 980px)").matches;
    let dx = 0, dy = 0;
    if (narrow) {
      dy = -Math.round(size.y * 0.22);
    } else {
      const left = els.sidebar ? els.sidebar.getBoundingClientRect().width + 24 : 416;
      const right = (!els.detail.hidden && els.detail)
        ? els.detail.getBoundingClientRect().width + 24
        : 0;
      const visualCx = left + Math.max(80, size.x - left - right) / 2;
      dx = Math.round(size.x / 2 - visualCx);
    }
    if (dx || dy) map.panBy([dx, dy], { animate: false });
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
    if (typeof inc.lat === "number" && typeof inc.lng === "number") {
      requestAnimationFrame(function () {
        focusSelectedIncident(inc);
        showSelectedPin(inc);
      });
    }
    writeHash(id);
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

  function fillCauseFilter() {
    if (!els.cause) return;
    const keep = els.cause.querySelector('option[value=""]');
    els.cause.innerHTML = "";
    if (keep) els.cause.appendChild(keep);
    else {
      const o = document.createElement("option");
      o.value = "";
      o.textContent = "All causes";
      els.cause.appendChild(o);
    }
    const seen = new Set();
    all.forEach((i) => (i.causes || []).forEach((c) => seen.add(c)));
    [...seen].sort((a, b) => (CAUSE_LABEL[a] || a).localeCompare(CAUSE_LABEL[b] || b)).forEach((c) => {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = CAUSE_LABEL[c] || c;
      els.cause.appendChild(o);
    });
  }

  let goToLanding = function () {};

  function openStats() {
    if (!els.statsPanel || !els.statsBody) return;
    closeDetail();
    
    const data = cache[layer];
    if (data && window.worldwatcherStats) {
      dashboardYearBounds.min = yearBounds.min;
      dashboardYearBounds.max = yearBounds.max;
      
      setDashboardPeriod("century");
      renderDashboard();
    } else {
      els.statsBody.innerHTML = '<div class="stats-loading">Loading statistics...</div>';
    }
    
    els.statsPanel.hidden = false;
    if (els.sidebar) els.sidebar.classList.add("is-dashboard-open");
    if (els.statsOpen) {
      els.statsOpen.classList.add("is-active");
      els.statsOpen.setAttribute("aria-pressed", "true");
    }
  }

  function closeStats() {
    if (!els.statsPanel) return;
    els.statsPanel.hidden = true;
    if (els.sidebar) els.sidebar.classList.remove("is-dashboard-open");
    if (els.statsOpen) {
      els.statsOpen.classList.remove("is-active");
      els.statsOpen.setAttribute("aria-pressed", "false");
    }
  }

  function toggleDashboard() {
    if (!els.statsPanel) return;
    if (els.statsPanel.hidden) openStats();
    else closeStats();
  }

  function goHome() {
    if (els.search) els.search.value = "";
    if (els.chips) {
      els.chips.querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", "false"));
    }
    if (els.cause) els.cause.value = "";
    setPeriod("all");
    closeDetail();
    closeStats();
    apply();
    els.list.scrollTop = 0;
    goToLanding();
  }

  function bind() {
    if (els.home) els.home.addEventListener("click", goHome);
    if (els.statsOpen) els.statsOpen.addEventListener("click", toggleDashboard);
    if (els.statsClose) els.statsClose.addEventListener("click", closeStats);
    if (els.layerTabs) {
      els.layerTabs.addEventListener("click", (e) => {
        const btn = e.target.closest(".layer-tab");
        if (!btn || !btn.dataset.layer) return;
        setLayer(btn.dataset.layer);
      });
    }
    els.search.addEventListener("input", apply);
    if (els.cause) els.cause.addEventListener("change", apply);
    const onYearField = (which) => {
      let [a, b] = yearPair();
      if (a > b) {
        if (which === "min") a = b;
        else b = a;
      }
      setYearInputs(a, b);
      syncPeriodFromYears();
      apply();
    };
    els.yearMin.addEventListener("change", () => onYearField("min"));
    els.yearMax.addEventListener("change", () => onYearField("max"));
    if (els.yearSliderMin && els.yearSliderMax) {
      const fromSlider = (which) => {
        let a = posToYear(els.yearSliderMin.value);
        let b = posToYear(els.yearSliderMax.value);
        if (which === "min" && a > b) a = b;
        if (which === "max" && b < a) b = a;
        setYearInputs(a, b);
        syncPeriodFromYears();
        apply();
      };
      els.yearSliderMin.addEventListener("input", () => fromSlider("min"));
      els.yearSliderMax.addEventListener("input", () => fromSlider("max"));
      els.yearSliderMin.addEventListener("pointerdown", () => { els.yearSliderMin.style.zIndex = 4; els.yearSliderMax.style.zIndex = 3; });
      els.yearSliderMax.addEventListener("pointerdown", () => { els.yearSliderMax.style.zIndex = 4; els.yearSliderMin.style.zIndex = 3; });
    }
    if (els.periods) {
      els.periods.addEventListener("click", (e) => {
        const btn = e.target.closest(".chip");
        if (!btn) return;
        setPeriod(btn.dataset.period);
        apply();
      });
    }
    
    if (els.dashboardYearMin && els.dashboardYearMax) {
      const onDashboardYearField = (which) => {
        let [a, b] = dashboardYearPair();
        if (a > b) {
          if (which === "min") a = b;
          else b = a;
        }
        setDashboardYearInputs(a, b);
        syncDashboardPeriodFromYears();
        renderDashboard();
      };
      els.dashboardYearMin.addEventListener("change", () => onDashboardYearField("min"));
      els.dashboardYearMax.addEventListener("change", () => onDashboardYearField("max"));
    }
    
    if (els.dashboardYearSliderMin && els.dashboardYearSliderMax) {
      const fromDashboardSlider = (which) => {
        let a = posToYear(els.dashboardYearSliderMin.value);
        let b = posToYear(els.dashboardYearSliderMax.value);
        if (which === "min" && a > b) a = b;
        if (which === "max" && b < a) b = a;
        setDashboardYearInputs(a, b);
        syncDashboardPeriodFromYears();
        renderDashboard();
      };
      els.dashboardYearSliderMin.addEventListener("input", () => fromDashboardSlider("min"));
      els.dashboardYearSliderMax.addEventListener("input", () => fromDashboardSlider("max"));
      els.dashboardYearSliderMin.addEventListener("pointerdown", () => { els.dashboardYearSliderMin.style.zIndex = 4; els.dashboardYearSliderMax.style.zIndex = 3; });
      els.dashboardYearSliderMax.addEventListener("pointerdown", () => { els.dashboardYearSliderMax.style.zIndex = 4; els.dashboardYearSliderMin.style.zIndex = 3; });
    }
    
    if (els.dashboardPeriods) {
      els.dashboardPeriods.addEventListener("click", (e) => {
        const btn = e.target.closest(".chip");
        if (!btn) return;
        setDashboardPeriod(btn.dataset.period);
        renderDashboard();
      });
    }
    
    els.chips.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn || btn.id === "geo-uncertain") return;
      btn.setAttribute("aria-pressed", btn.getAttribute("aria-pressed") === "true" ? "false" : "true");
      apply();
    });
    els.detailBody.addEventListener("click", (e) => {
      const tab = e.target.closest(".detail-tab");
      if (tab) {
        setDetailTab(tab.dataset.tab);
        return;
      }
      if (e.target.closest("[data-pin-fix]")) {
        const title = document.getElementById("detail-title");
        window.dispatchEvent(new CustomEvent("worldwatch:report", {
          detail: {
            id: selectedId || "",
            label: title ? title.textContent : "",
            wrong: "Map pin is in the wrong place or only a town/district centroid.",
            correction: "Better coordinates (lat, lng) or a sourced dam location:",
          }
        }));
      }
    });
    els.detailClose.addEventListener("click", closeDetail);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (!els.detail.hidden) closeDetail();
        else if (!els.statsPanel.hidden) closeStats();
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
    const m = location.hash.match(/(?:^|[&#])id=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function hashLayer() {
    if (/(?:^|#|&)floods\b/.test(location.hash) || /layer=floods/.test(location.hash)) return "floods";
    return "dams";
  }

  function writeHash(id) {
    let h = layer === "floods" ? "#floods" : "";
    if (id) h += (h ? "&" : "#") + "id=" + encodeURIComponent(id);
    if (location.hash !== h) history.replaceState(null, "", h || (location.pathname + location.search));
  }

  function updateLayerChrome() {
    const s = spec();
    document.title = "worldwatcher.app · " + s.title;
    if (els.subtitle) els.subtitle.textContent = s.subtitle;
    if (els.statCountLabel) els.statCountLabel.textContent = s.statLabel;
    if (els.recentHeading) els.recentHeading.textContent = s.recentLabel;
    if (els.categoryBlock) els.categoryBlock.hidden = !s.showCategory;
    if (els.causeBlock) els.causeBlock.hidden = !s.showCause;
    if (els.layerTabs) {
      els.layerTabs.querySelectorAll(".layer-tab").forEach((b) => {
        const on = b.dataset.layer === layer;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
    }
  }


  function initMap() {
    map = L.map("map", {
      zoomControl: false,
      attributionControl: true,
      worldCopyJump: true,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
    }).setView([20, 12], 3);
    function landingView() {
      if (selectedId) return;
      const narrow = window.matchMedia("(max-width: 980px)").matches;
      const left = narrow ? 16 : 416;
      map.fitBounds([[-48, -128], [68, 158]], {
        paddingTopLeft: [left, 20],
        paddingBottomRight: [20, 64],
        animate: false,
        maxZoom: 4.25,
      });
      const z = map.getZoom();
      map.setMinZoom(Math.max(2.75, z - 0.35));
    }
    goToLanding = landingView;
    map.whenReady(landingView);
    window.addEventListener("resize", landingView);
    const zoom = L.control.zoom({ position: "bottomright" }).addTo(map);
    const dark = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    });
    const light = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    });
    const aerial = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Tiles &copy; Esri",
      maxZoom: 19,
    });
    const labels = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Labels &copy; Esri",
      maxZoom: 19,
    });
    const baseLayer = currentTheme === "light" ? light : dark;
    baseLayer.addTo(map);
    let baseMode = "auto";
    let lastAerialState = false;
    function wantAerial() {
      if (baseMode === "aerial") return true;
      if (baseMode === "map") return false;
      return map.getZoom() >= 8;
    }
    function showLayer(layer, on) {
      if (on && !map.hasLayer(layer)) layer.addTo(map);
      if (!on && map.hasLayer(layer)) map.removeLayer(layer);
    }
    function syncBase() {
      const aerialOn = wantAerial();
      const layerChanged = aerialOn !== lastAerialState;
      showLayer(aerial, aerialOn);
      showLayer(labels, aerialOn);
      if (layerChanged) {
        if (aerialOn && map.hasLayer(labels)) labels.bringToFront();
        if (cluster && map.hasLayer(cluster)) cluster.bringToFront();
        const markerPane = map.getPane("markerPane");
        if (markerPane) markerPane.style.zIndex = 650;
      }
      lastAerialState = aerialOn;
    }
    function switchBaseLayer() {
      const isLight = currentTheme === "light";
      const newBase = isLight ? light : dark;
      const oldBase = isLight ? dark : light;
      if (map.hasLayer(oldBase)) map.removeLayer(oldBase);
      if (!map.hasLayer(newBase) && !wantAerial()) newBase.addTo(map);
    }
    function setBaseMode(mode) {
      baseMode = mode;
      box.querySelectorAll("button").forEach((b) => {
        const on = b.dataset.base === mode;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      syncBase();
    }
    const BaseToggle = L.Control.extend({
      options: { position: "bottomright" },
      onAdd: function () {
        const el = L.DomUtil.create("div", "basemap-toggle");
        el.setAttribute("role", "group");
        el.setAttribute("aria-label", "Base map");
        [["auto", "Auto"], ["map", "Map"], ["aerial", "Aerial"]].forEach((pair) => {
          const b = L.DomUtil.create("button", pair[0] === "auto" ? "is-active" : "", el);
          b.type = "button";
          b.dataset.base = pair[0];
          b.textContent = pair[1];
          b.setAttribute("aria-pressed", pair[0] === "auto" ? "true" : "false");
        });
        L.DomEvent.disableClickPropagation(el);
        L.DomEvent.on(el, "click", function (e) {
          const btn = e.target.closest("button");
          if (btn && btn.dataset.base) setBaseMode(btn.dataset.base);
        });
        return el;
      }
    });
    const box = new BaseToggle().addTo(map).getContainer();
    
    const LabelsToggle = L.Control.extend({
      options: { position: "bottomright" },
      onAdd: function () {
        const el = L.DomUtil.create("div", "labels-toggle");
        el.setAttribute("role", "group");
        el.setAttribute("aria-label", "Pin labels");
        const b = L.DomUtil.create("button", pinNamesEnabled ? "is-active" : "", el);
        b.type = "button";
        b.id = "labels-toggle-btn";
        b.textContent = "Dam labels";
        b.setAttribute("aria-pressed", pinNamesEnabled ? "true" : "false");
        L.DomEvent.disableClickPropagation(el);
        L.DomEvent.on(el, "click", function () {
          pinNamesEnabled = !pinNamesEnabled;
          localStorage.setItem("ww-pin-names", pinNamesEnabled ? "on" : "off");
          b.classList.toggle("is-active", pinNamesEnabled);
          b.setAttribute("aria-pressed", pinNamesEnabled ? "true" : "false");
          updateNameLabels();
        });
        return el;
      }
    });
    const labelsBox = new LabelsToggle().addTo(map).getContainer();
    
    const ThemeToggle = L.Control.extend({
      options: { position: "bottomright" },
      onAdd: function () {
        const el = L.DomUtil.create("div", "theme-toggle");
        el.setAttribute("role", "group");
        el.setAttribute("aria-label", "Theme");
        const b = L.DomUtil.create("button", currentTheme === "light" ? "is-active" : "", el);
        b.type = "button";
        b.id = "theme-toggle-btn";
        b.textContent = "Light";
        b.setAttribute("aria-pressed", currentTheme === "light" ? "true" : "false");
        L.DomEvent.disableClickPropagation(el);
        L.DomEvent.on(el, "click", function () {
          currentTheme = currentTheme === "light" ? "dark" : "light";
          localStorage.setItem("ww-theme", currentTheme);
          document.documentElement.setAttribute("data-theme", currentTheme === "light" ? "light" : "");
          b.classList.toggle("is-active", currentTheme === "light");
          b.setAttribute("aria-pressed", currentTheme === "light" ? "true" : "false");
          switchBaseLayer();
        });
        return el;
      }
    });
    const themeBox = new ThemeToggle().addTo(map).getContainer();
    
    const wrap = document.createElement("div");
    wrap.className = "map-controls";
    wrap.appendChild(box);
    wrap.appendChild(labelsBox);
    wrap.appendChild(themeBox);
    wrap.appendChild(zoom.getContainer());
    document.body.appendChild(wrap);
    map.on("zoomend", syncBase);
    syncBase();
    map.createPane("selectedPane");
    map.getPane("selectedPane").style.zIndex = 660;
    map.createPane("fallbackPane");
    map.getPane("fallbackPane").style.zIndex = 655;
    selectedLayer = L.layerGroup().addTo(map);
    fallbackLayer = L.layerGroup().addTo(map);
    cluster = L.markerClusterGroup({
      maxClusterRadius: 42,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 8,
      animate: false,
      removeOutsideVisibleBounds: false,
    });
    map.addLayer(cluster);
    map.on("zoomend", updateFallbackMarkers);
    map.on("zoomend", updateNameLabels);
    map.on("moveend", updateNameLabels);
    const resize = () => { map.invalidateSize(); landingView(); };
    window.addEventListener("resize", resize);
    setTimeout(resize, 80);
  }

  function useData(data, keepSelection) {
    const s = spec();
    const currentLayer = layer;
    cache[currentLayer] = data;
    all = data[s.rowsKey] || data.incidents || data.events || [];
    updateLastScreen();
    const years = all.map(yearOf).filter((y) => y != null);
    if (years.length) {
      yearBounds.min = Math.min.apply(null, years);
      yearBounds.max = Math.max.apply(null, years);
    }
    if (currentLayer === "floods" && els.subtitle) {
      els.subtitle.textContent = "Major named floods only";
    }
    els.yearMin.min = yearBounds.min;
    els.yearMin.max = yearBounds.max;
    els.yearMax.min = yearBounds.min;
    els.yearMax.max = yearBounds.max;
    setYearInputs(yearBounds.min, yearBounds.max);
    setPeriod("all");
    fillCauseFilter();
    apply();
    if (!keepSelection) {
      els.list.scrollTop = 0;
      closeDetail();
      goToLanding();
    }
  }

  function loadLayer(name, opts) {
    opts = opts || {};
    layer = name === "floods" ? "floods" : "dams";
    updateLayerChrome();
    writeHash(opts.id || null);
    const s = spec();
    const done = (data) => {
      useData(data, !!opts.id);
      if (opts.id) selectIncident(opts.id);
    };
    if (cache[layer]) {
      done(cache[layer]);
      return;
    }
    fetch(s.dataUrl)
      .then((r) => {
        if (!r.ok) throw new Error("Could not load " + s.dataUrl);
        return r.json();
      })
      .then(done)
      .catch((err) => {
        els.empty.hidden = false;
        els.empty.textContent = "Could not load " + s.title.toLowerCase() + " data.";
        console.error(err);
      });
  }

  function setLayer(name) {
    if (name === layer && cache[layer]) {
      goHome();
      return;
    }
    selectedId = null;
    lastDetailTab = "event";
    if (els.search) els.search.value = "";
    if (els.chips) {
      els.chips.querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", "false"));
    }
    if (els.cause) els.cause.value = "";
    closeStats();
    loadLayer(name);
  }

  function watchFace() {
    const mark = document.querySelector(".brand-mark");
    if (!mark || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const looks = [
      [0, 0], [0.7, 0.15], [-0.7, 0.2], [0.15, -0.55],
      [-0.55, -0.25], [0.6, 0.35], [-0.2, 0.45], [0.35, -0.15]
    ];
    const look = () => {
      const [x, y] = looks[Math.floor(Math.random() * looks.length)];
      mark.style.setProperty("--look-x", x + "px");
      mark.style.setProperty("--look-y", y + "px");
    };
    const blink = () => {
      mark.classList.add("is-blink");
      setTimeout(() => mark.classList.remove("is-blink"), 120);
      if (Math.random() < 0.28) setTimeout(blink, 160);
    };
    look();
    const loop = () => {
      look();
      if (Math.random() < 0.45) blink();
      setTimeout(loop, 1400 + Math.random() * 2200);
    };
    setTimeout(loop, 800);
    setInterval(() => { if (Math.random() < 0.35) blink(); }, 2800);
  }

  layer = hashLayer();
  updateLayerChrome();
  initMap();
  bind();
  watchFace();
  loadLayer(layer, { id: hashId() });
})();
