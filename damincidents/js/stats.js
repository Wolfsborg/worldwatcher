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

  function formatNum(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function yearOf(inc) {
    if (!inc.incident_date) return null;
    const y = parseInt(String(inc.incident_date).slice(0, 4), 10);
    return Number.isFinite(y) ? y : null;
  }

  function computeStats(data, layer) {
    const incidents = data.incidents || [];
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
      if (inc.category) {
        categoryCounts[inc.category] = (categoryCounts[inc.category] || 0) + 1;
      }
    });

    const typeCounts = {};
    incidents.forEach(inc => {
      if (inc.type) {
        typeCounts[inc.type] = (typeCounts[inc.type] || 0) + 1;
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

  function renderOverview(stats) {
    const yearsSpan = stats.minYear && stats.maxYear 
      ? `${stats.minYear}–${stats.maxYear}`
      : "—";
    
    const deathsDisplay = stats.unknownDeaths > 0
      ? `${formatNum(stats.totalDeaths)}+`
      : formatNum(stats.totalDeaths);

    return `
      <div class="stat-card stat-overview">
        <div class="stat-overview-grid">
          <div class="stat-overview-item">
            <span class="stat-overview-value">${formatNum(stats.totalIncidents)}</span>
            <span class="stat-overview-label">Incidents</span>
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
      .slice(0, 15);

    if (causes.length === 0) {
      return `
        <div class="stat-card">
          <h2 class="stat-card-title">By Cause</h2>
          <p style="color: var(--muted); font-size: 13px;">No cause data available</p>
        </div>
      `;
    }

    const maxCount = causes[0][1];
    const items = causes.map(([cause, count]) => {
      const pct = (count / maxCount) * 100;
      const label = CAUSE_LABEL[cause] || cause;
      return `
        <li class="stat-bar-item">
          <div class="stat-bar-label">
            <span class="stat-bar-name">${label}</span>
            <span class="stat-bar-value">${formatNum(count)}</span>
          </div>
          <div class="stat-bar-track">
            <div class="stat-bar-fill" style="width: ${pct}%"></div>
          </div>
        </li>
      `;
    }).join("");

    return `
      <div class="stat-card">
        <h2 class="stat-card-title">By Cause</h2>
        <ul class="stat-bar-list">${items}</ul>
      </div>
    `;
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

  function renderByCategory(stats) {
    const categories = Object.entries(stats.categoryCounts)
      .sort((a, b) => b[1] - a[1]);

    if (categories.length === 0) {
      return `
        <div class="stat-card">
          <h2 class="stat-card-title">By Category</h2>
          <p style="color: var(--muted); font-size: 13px;">No category data available</p>
        </div>
      `;
    }

    const maxCount = categories[0][1];
    const items = categories.map(([category, count]) => {
      const pct = (count / maxCount) * 100;
      const label = CATEGORY_LABEL[category] || category;
      return `
        <li class="stat-bar-item">
          <div class="stat-bar-label">
            <span class="stat-bar-name">${label}</span>
            <span class="stat-bar-value">${formatNum(count)}</span>
          </div>
          <div class="stat-bar-track">
            <div class="stat-bar-fill" style="width: ${pct}%"></div>
          </div>
        </li>
      `;
    }).join("");

    return `
      <div class="stat-card">
        <h2 class="stat-card-title">By Category</h2>
        <ul class="stat-bar-list">${items}</ul>
      </div>
    `;
  }

  function renderByType(stats) {
    const types = Object.entries(stats.typeCounts)
      .sort((a, b) => b[1] - a[1]);

    if (types.length === 0) {
      return `
        <div class="stat-card">
          <h2 class="stat-card-title">By Type</h2>
          <p style="color: var(--muted); font-size: 13px;">No type data available</p>
        </div>
      `;
    }

    const maxCount = types[0][1];
    const items = types.map(([type, count]) => {
      const pct = (count / maxCount) * 100;
      const label = TYPE_LABEL[type] || type;
      return `
        <li class="stat-bar-item">
          <div class="stat-bar-label">
            <span class="stat-bar-name">${label}</span>
            <span class="stat-bar-value">${formatNum(count)}</span>
          </div>
          <div class="stat-bar-track">
            <div class="stat-bar-fill" style="width: ${pct}%"></div>
          </div>
        </li>
      `;
    }).join("");

    return `
      <div class="stat-card">
        <h2 class="stat-card-title">By Type</h2>
        <ul class="stat-bar-list">${items}</ul>
      </div>
    `;
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
        ${renderOverview(stats)}
        ${renderByCause(stats)}
        ${renderByCountry(stats)}
        ${renderByCategory(stats)}
        ${renderByType(stats)}
        ${renderByDecade(stats)}
      </div>
    `;

    return html;
  }

  window.worldwatcherStats = {
    render: renderStats,
  };
})();
