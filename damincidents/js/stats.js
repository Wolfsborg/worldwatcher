(function () {
  "use strict";

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

  const CATEGORY_LABEL = {
    failure: "Failure",
    partial_breach: "Partial breach",
    incident: "Incident",
    watch: "Watch",
    controlled_release: "Controlled release",
  };

  const TYPE_LABEL = {
    reservoir_dam: "Reservoir dam",
    tailings: "Tailings",
    levee_embankment: "Levee / embankment",
    weir: "Weir",
    spillway: "Spillway",
    sluice: "Sluice",
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

  const SEVERITY_LABEL = {
    catastrophic: "Catastrophic",
    major: "Major",
    moderate: "Moderate",
    minor: "Minor",
  };

  const CAUSE_COLORS = {
    overtopping: "#4a9fd8",
    piping_internal_erosion: "#e8892c",
    structural_design: "#b85c9e",
    foundation: "#7a8894",
    earthquake: "#d4504b",
    landslide: "#8c6a3d",
    spillway: "#4aa3df",
    operational_gate: "#e8c84d",
    extreme_rainfall: "#5b8ac5",
    war_attack: "#e24b4a",
    tailings_liquefaction: "#c8763e",
    poor_maintenance: "#9b7a3a",
    construction_first_filling: "#6b94c4",
    unknown: "#6b717a",
    storm_surge: "#4a88b8",
    snowmelt: "#7ba8d4",
    ice_jam: "#5fa3c9",
    monsoon: "#4f7eb5",
    tropical_cyclone: "#4368a0",
    dam_release: "#567ab8",
    urban_drainage: "#8a9ab0",
  };

  const CATEGORY_COLORS = {
    failure: "#e24b4a",
    partial_breach: "#e8892c",
    incident: "#4aa3df",
    watch: "#d4b45a",
    controlled_release: "#7a8894",
  };

  const SEVERITY_COLORS = {
    catastrophic: "#e24b4a",
    major: "#e8892c",
    moderate: "#d4b45a",
    minor: "#7a8894",
  };

  const TYPE_COLORS = {
    reservoir_dam: "#4a9fd8",
    tailings: "#c8763e",
    levee_embankment: "#7a8894",
    weir: "#5b8ac5",
    spillway: "#4aa3df",
    sluice: "#6b94c4",
  };

  const FLOOD_TYPE_COLORS = {
    riverine: "#4a9fd8",
    flash: "#e8892c",
    coastal: "#5b8ac5",
    urban: "#7a8894",
    ice_jam: "#5fa3c9",
    glacial: "#7ba8d4",
    storm: "#4368a0",
  };

  function formatNum(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function renderPieChart(data, colorMap, title) {
    if (data.length === 0) {
      return `
        <div class="stat-card">
          <h2 class="stat-card-title">${title}</h2>
          <p style="color: var(--muted); font-size: 13px;">No data available</p>
        </div>
      `;
    }

    const total = data.reduce((sum, item) => sum + item.count, 0);
    let cumulativePercent = 0;
    const gradientStops = [];
    
    data.forEach((item, idx) => {
      const percent = (item.count / total) * 100;
      const color = colorMap[item.key] || "#6b717a";
      
      if (idx === 0) {
        gradientStops.push(`${color} 0%`);
      } else {
        gradientStops.push(`${color} ${cumulativePercent}%`);
      }
      
      cumulativePercent += percent;
      gradientStops.push(`${color} ${cumulativePercent}%`);
    });

    const gradientString = gradientStops.join(", ");
    
    const legendItems = data.map(item => {
      const percent = ((item.count / total) * 100).toFixed(1);
      const color = colorMap[item.key] || "#6b717a";
      return `
        <div class="pie-legend-item">
          <span class="pie-legend-swatch" style="background: ${color}"></span>
          <span class="pie-legend-label">${item.label}</span>
          <span class="pie-legend-value">${formatNum(item.count)} (${percent}%)</span>
        </div>
      `;
    }).join("");

    return `
      <div class="stat-card">
        <h2 class="stat-card-title">${title}</h2>
        <div class="pie-chart-container">
          <div class="pie-chart" style="background: conic-gradient(${gradientString})"></div>
          <div class="pie-legend">${legendItems}</div>
        </div>
      </div>
    `;
  }

  function yearOf(inc) {
    if (!inc.incident_date) return null;
    const y = parseInt(String(inc.incident_date).slice(0, 4), 10);
    return Number.isFinite(y) ? y : null;
  }

  function computeStats(data, layer) {
    const incidents = data.incidents || data.events || [];
    const totalIncidents = incidents.length;
    
    const countries = new Set();
    incidents.forEach(inc => {
      if (inc.country) countries.add(inc.country);
    });

    const knownDeaths = incidents.filter(inc => typeof inc.deaths === "number");
    const totalDeaths = knownDeaths.reduce((sum, inc) => sum + inc.deaths, 0);
    const unknownDeaths = incidents.length - knownDeaths.length;

    const years = incidents.map(yearOf).filter(y => y != null);
    const minYear = years.length ? Math.min(...years) : null;
    const maxYear = years.length ? Math.max(...years) : null;

    const causeCounts = {};
    incidents.forEach(inc => {
      if (inc.causes && Array.isArray(inc.causes)) {
        inc.causes.forEach(cause => {
          causeCounts[cause] = (causeCounts[cause] || 0) + 1;
        });
      }
    });

    const countryCounts = {};
    incidents.forEach(inc => {
      if (inc.country) {
        if (!countryCounts[inc.country]) {
          countryCounts[inc.country] = { count: 0, deaths: 0, hasUnknownDeaths: false };
        }
        countryCounts[inc.country].count += 1;
        if (typeof inc.deaths === "number") {
          countryCounts[inc.country].deaths += inc.deaths;
        } else {
          countryCounts[inc.country].hasUnknownDeaths = true;
        }
      }
    });

    const categoryCounts = {};
    incidents.forEach(inc => {
      const categoryKey = inc.category || inc.severity;
      if (categoryKey) {
        categoryCounts[categoryKey] = (categoryCounts[categoryKey] || 0) + 1;
      }
    });

    const typeCounts = {};
    incidents.forEach(inc => {
      const typeKey = inc.type || inc.flood_type;
      if (typeKey) {
        typeCounts[typeKey] = (typeCounts[typeKey] || 0) + 1;
      }
    });

    const decadeCounts = {};
    incidents.forEach(inc => {
      const y = yearOf(inc);
      if (y != null) {
        const decade = Math.floor(y / 10) * 10;
        decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;
      }
    });

    return {
      totalIncidents,
      totalCountries: countries.size,
      totalDeaths,
      unknownDeaths,
      minYear,
      maxYear,
      causeCounts,
      countryCounts,
      categoryCounts,
      typeCounts,
      decadeCounts,
    };
  }

  function renderOverview(stats, layer) {
    const yearsSpan = stats.minYear && stats.maxYear 
      ? `${stats.minYear}–${stats.maxYear}`
      : "—";
    
    const deathsDisplay = stats.unknownDeaths > 0
      ? `${formatNum(stats.totalDeaths)}+`
      : formatNum(stats.totalDeaths);

    const recordLabel = layer === "floods" ? "Events" : "Incidents";

    return `
      <div class="stat-card stat-overview">
        <div class="stat-overview-grid">
          <div class="stat-overview-item">
            <span class="stat-overview-value">${formatNum(stats.totalIncidents)}</span>
            <span class="stat-overview-label">${recordLabel}</span>
          </div>
          <div class="stat-overview-item">
            <span class="stat-overview-value">${formatNum(stats.totalCountries)}</span>
            <span class="stat-overview-label">Countries</span>
          </div>
          <div class="stat-overview-item">
            <span class="stat-overview-value">${deathsDisplay}</span>
            <span class="stat-overview-label">Known Deaths</span>
          </div>
          <div class="stat-overview-item">
            <span class="stat-overview-value">${yearsSpan}</span>
            <span class="stat-overview-label">Years Span</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderByCause(stats) {
    const causes = Object.entries(stats.causeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([cause, count]) => ({
        key: cause,
        label: CAUSE_LABEL[cause] || cause,
        count: count,
      }));

    return renderPieChart(causes, CAUSE_COLORS, "By Cause");
  }

  function renderByCountry(stats) {
    const countries = Object.entries(stats.countryCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15);

    if (countries.length === 0) {
      return `
        <div class="stat-card">
          <h2 class="stat-card-title">By Country</h2>
          <p style="color: var(--muted); font-size: 13px;">No country data available</p>
        </div>
      `;
    }

    const rows = countries.map(([country, data]) => {
      const deathsDisplay = data.hasUnknownDeaths
        ? `${formatNum(data.deaths)}+`
        : formatNum(data.deaths);
      return `
        <tr>
          <td class="stat-table-name">${country}</td>
          <td class="stat-table-value">${formatNum(data.count)}</td>
          <td class="stat-table-value">${deathsDisplay}</td>
        </tr>
      `;
    }).join("");

    return `
      <div class="stat-card">
        <h2 class="stat-card-title">By Country</h2>
        <table class="stat-table">
          <thead>
            <tr>
              <th>Country</th>
              <th style="text-align: right">Count</th>
              <th style="text-align: right">Deaths</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderByCategory(stats, layer) {
    const categories = Object.entries(stats.categoryCounts)
      .sort((a, b) => b[1] - a[1]);

    if (categories.length === 0) {
      return "";
    }

    const labelMap = layer === "floods" ? SEVERITY_LABEL : CATEGORY_LABEL;
    const colorMap = layer === "floods" ? SEVERITY_COLORS : CATEGORY_COLORS;
    const title = layer === "floods" ? "By Severity" : "By Category";
    
    const data = categories.map(([category, count]) => ({
      key: category,
      label: labelMap[category] || CATEGORY_LABEL[category] || category,
      count: count,
    }));

    return renderPieChart(data, colorMap, title);
  }

  function renderByType(stats, layer) {
    const types = Object.entries(stats.typeCounts)
      .sort((a, b) => b[1] - a[1]);

    if (types.length === 0) {
      return "";
    }

    const labelMap = layer === "floods" ? FLOOD_TYPE_LABEL : TYPE_LABEL;
    const colorMap = layer === "floods" ? FLOOD_TYPE_COLORS : TYPE_COLORS;
    const title = layer === "floods" ? "By Flood Type" : "By Type";
    
    const data = types.map(([type, count]) => ({
      key: type,
      label: labelMap[type] || type,
      count: count,
    }));

    return renderPieChart(data, colorMap, title);
  }

  function renderByDecade(stats) {
    const decades = Object.entries(stats.decadeCounts)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

    if (decades.length === 0) {
      return `
        <div class="stat-card">
          <h2 class="stat-card-title">By Decade</h2>
          <p style="color: var(--muted); font-size: 13px;">No temporal data available</p>
        </div>
      `;
    }

    const maxCount = Math.max(...decades.map(d => d[1]));
    const bars = decades.map(([decade, count]) => {
      const height = (count / maxCount) * 100;
      return `
        <div class="stat-histogram-bar" style="height: ${height}%" title="${decade}s: ${count}">
          <span class="stat-histogram-label">${decade}s</span>
        </div>
      `;
    }).join("");

    return `
      <div class="stat-card">
        <h2 class="stat-card-title">By Decade</h2>
        <div class="stat-histogram">${bars}</div>
      </div>
    `;
  }

  function renderStats(data, layer) {
    const stats = computeStats(data, layer);
    
    const html = `
      <div class="stats-grid">
        ${renderOverview(stats, layer)}
        ${renderByCause(stats)}
        ${renderByCountry(stats)}
        ${renderByCategory(stats, layer)}
        ${renderByType(stats, layer)}
        ${renderByDecade(stats)}
      </div>
    `;

    return html;
  }

  window.worldwatcherStats = {
    render: renderStats,
  };
})();
