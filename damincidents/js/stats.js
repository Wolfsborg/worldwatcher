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
    const str = String(inc.incident_date);
    const y = parseInt(str.startsWith("-") ? str.slice(0, 5) : str.slice(0, 4), 10);
    return Number.isFinite(y) ? y : null;
  }

  function formatYear(y) {
    if (y < 1) {
      const bc = y === 0 ? 1 : Math.abs(y);
      return bc + " BC";
    }
    return String(y);
  }

  function computeStats(incidents, layer) {
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
    const yearsSpan = stats.minYear != null && stats.maxYear != null
      ? `${formatYear(stats.minYear)}–${formatYear(stats.maxYear)}`
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
      .filter(([, count]) => count > 0)
      .sort((a, b) => parseInt(b[0]) - parseInt(a[0]));

    if (decades.length === 0) {
      return `
        <div class="stat-card">
          <h2 class="stat-card-title">By Decade</h2>
          <p style="color: var(--muted); font-size: 13px;">No temporal data available</p>
        </div>
      `;
    }

    const maxCount = Math.max(...decades.map(d => d[1]));
    const items = decades.map(([decade, count]) => {
      const width = maxCount ? (count / maxCount) * 100 : 0;
      const decadeNum = parseInt(decade);
      const decadeLabel = decadeNum < 1
        ? `${Math.abs(decadeNum)}s BC`
        : `${decadeNum}s`;
      return `
        <li class="stat-bar-item">
          <div class="stat-bar-label">
            <span class="stat-bar-name">${decadeLabel}</span>
            <span class="stat-bar-value">${formatNum(count)}</span>
          </div>
          <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${width}%"></div></div>
        </li>
      `;
    }).join("");

    return `
      <div class="stat-card">
        <h2 class="stat-card-title">By Decade</h2>
        <ul class="stat-bar-list">${items}</ul>
      </div>
    `;
  }

  function renderFailuresOverTime(incidents, layer) {
    if (layer !== "dams") {
      return "";
    }

    const failures = incidents.filter(inc => 
      inc.category === "failure" || inc.category === "partial_breach"
    );

    if (failures.length === 0) {
      return "";
    }

    const firstFillings = incidents.filter(inc => 
      (inc.category === "failure" || inc.category === "partial_breach") &&
      inc.causes && inc.causes.includes("construction_first_filling")
    );

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentDecade = Math.floor(currentYear / 10) * 10;

    const years = failures.map(yearOf).filter(y => y != null);
    if (years.length === 0) {
      return "";
    }

    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const minDecade = Math.floor(minYear / 10) * 10;

    const isShortWindow = (maxYear - minYear) < 15;

    let dataPoints = [];
    let forecastPoints = [];
    let firstFillingPoints = [];
    let uncertaintyBands = [];

    if (isShortWindow) {
      const yearCounts = {};
      const firstFillingYearCounts = {};
      
      failures.forEach(inc => {
        const y = yearOf(inc);
        if (y != null) {
          yearCounts[y] = (yearCounts[y] || 0) + 1;
        }
      });
      
      firstFillings.forEach(inc => {
        const y = yearOf(inc);
        if (y != null) {
          firstFillingYearCounts[y] = (firstFillingYearCounts[y] || 0) + 1;
        }
      });

      for (let y = minYear; y <= maxYear; y++) {
        dataPoints.push({ year: y, count: yearCounts[y] || 0 });
        firstFillingPoints.push({ year: y, count: firstFillingYearCounts[y] || 0 });
      }

      const recentYears = dataPoints.filter(p => p.year >= currentYear - 3 && p.year < currentYear);
      const baseline = recentYears.length > 0 
        ? recentYears.reduce((s, p) => s + p.count, 0) / recentYears.length
        : (dataPoints.reduce((s, p) => s + p.count, 0) / dataPoints.length);

      for (let i = 1; i <= 3; i++) {
        const forecastYear = maxYear + i;
        forecastPoints.push({ year: forecastYear, count: baseline });
      }
    } else {
      const decadeCounts = {};
      const firstFillingDecadeCounts = {};
      
      failures.forEach(inc => {
        const y = yearOf(inc);
        if (y != null) {
          const decade = Math.floor(y / 10) * 10;
          decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;
        }
      });
      
      firstFillings.forEach(inc => {
        const y = yearOf(inc);
        if (y != null) {
          const decade = Math.floor(y / 10) * 10;
          firstFillingDecadeCounts[decade] = (firstFillingDecadeCounts[decade] || 0) + 1;
        }
      });

      for (let d = minDecade; d <= maxYear; d += 10) {
        dataPoints.push({ decade: d, count: decadeCounts[d] || 0 });
        firstFillingPoints.push({ decade: d, count: firstFillingDecadeCounts[d] || 0 });
      }

      const completeDecades = dataPoints.filter(p => p.decade < currentDecade - 10);
      const last3Complete = completeDecades.slice(-3);
      
      let baseline = 0;
      let slope = 0;
      
      if (last3Complete.length >= 3) {
        baseline = last3Complete.reduce((s, p) => s + p.count, 0) / last3Complete.length;
        
        const y0 = last3Complete[0].count;
        const y2 = last3Complete[2].count;
        const span = 20;
        slope = (y2 - y0) / span;
        
        if (Math.abs(slope) > baseline * 0.15) {
          baseline = last3Complete[2].count;
        }
      } else if (completeDecades.length > 0) {
        baseline = completeDecades.reduce((s, p) => s + p.count, 0) / completeDecades.length;
      } else {
        baseline = dataPoints.reduce((s, p) => s + p.count, 0) / Math.max(dataPoints.length, 1);
      }

      for (let i = 1; i <= 2; i++) {
        const forecastDecade = currentDecade + (i * 10);
        const forecastCount = Math.max(0, baseline + slope * 10 * i);
        forecastPoints.push({ decade: forecastDecade, count: forecastCount });
      }

      dataPoints.forEach(p => {
        if (p.decade < 1980) {
          const observed = p.count;
          const uplift = Math.max(observed * 2.5, observed + 8);
          uncertaintyBands.push({
            x: p.decade,
            lower: observed,
            upper: uplift,
            type: "historical"
          });
        }
      });

      forecastPoints.forEach((p, idx) => {
        const step = idx + 1;
        const baselineVar = Math.max(baseline, 1);
        const margin = 1.96 * Math.sqrt(baselineVar) + 0.3 * step * Math.sqrt(baselineVar);
        uncertaintyBands.push({
          x: p.decade,
          lower: Math.max(0, p.count - margin),
          upper: p.count + margin,
          type: "forecast"
        });
      });
    }

    const allPoints = [...dataPoints, ...forecastPoints];
    const maxCount = Math.max(...allPoints.map(p => p.count), 
                               ...uncertaintyBands.map(b => b.upper));
    const chartHeight = 240;
    const chartWidth = 660;
    const padLeft = 40;
    const padRight = 20;
    const padTop = 20;
    const padBottom = 50;
    const plotWidth = chartWidth - padLeft - padRight;
    const plotHeight = chartHeight - padTop - padBottom;

    const xScale = plotWidth / (allPoints.length - 1 || 1);
    const yScale = plotHeight / (maxCount || 1);

    let xLabels = "";
    let yGridLines = "";
    let observedPath = "";
    let forecastPath = "";
    let firstFillingPath = "";
    let uncertaintyPaths = "";

    const yTicks = Math.ceil(maxCount / 10) * 10;
    const yStep = Math.max(1, Math.floor(yTicks / 5));
    for (let y = 0; y <= maxCount; y += yStep) {
      const yPos = padTop + plotHeight - (y * yScale);
      yGridLines += `<line x1="${padLeft}" y1="${yPos}" x2="${padLeft + plotWidth}" y2="${yPos}" stroke="var(--line)" stroke-width="1"/>`;
      yGridLines += `<text x="${padLeft - 8}" y="${yPos + 4}" fill="var(--muted)" font-size="11" text-anchor="end">${y}</text>`;
    }

    allPoints.forEach((p, idx) => {
      const x = padLeft + idx * xScale;
      const label = isShortWindow ? String(p.year) : `${p.decade}s`;
      const isForecast = idx >= dataPoints.length;
      const labelColor = isForecast ? "var(--muted)" : "var(--text)";
      xLabels += `<text x="${x}" y="${padTop + plotHeight + 30}" fill="${labelColor}" font-size="11" text-anchor="middle" opacity="${isForecast ? 0.6 : 1}">${label}</text>`;
    });

    uncertaintyBands.forEach(band => {
      const xKey = band.x;
      const idx = isShortWindow 
        ? allPoints.findIndex(p => p.year === xKey)
        : allPoints.findIndex(p => p.decade === xKey);
      
      if (idx >= 0) {
        const x = padLeft + idx * xScale;
        const y1 = padTop + plotHeight - (band.lower * yScale);
        const y2 = padTop + plotHeight - (band.upper * yScale);
        const opacity = band.type === "forecast" ? "0.15" : "0.08";
        const fill = band.type === "forecast" ? "#7a8894" : "var(--watch)";
        uncertaintyPaths += `<rect x="${x - xScale * 0.35}" y="${y2}" width="${xScale * 0.7}" height="${y1 - y2}" fill="${fill}" opacity="${opacity}" rx="2"/>`;
      }
    });

    dataPoints.forEach((p, idx) => {
      const x = padLeft + idx * xScale;
      const y = padTop + plotHeight - (p.count * yScale);
      if (idx === 0) {
        observedPath += `M ${x} ${y}`;
      } else {
        observedPath += ` L ${x} ${y}`;
      }
    });

    if (forecastPoints.length > 0 && dataPoints.length > 0) {
      const lastObsX = padLeft + (dataPoints.length - 1) * xScale;
      const lastObsY = padTop + plotHeight - (dataPoints[dataPoints.length - 1].count * yScale);
      forecastPath += `M ${lastObsX} ${lastObsY}`;
      
      forecastPoints.forEach((p, idx) => {
        const x = padLeft + (dataPoints.length + idx) * xScale;
        const y = padTop + plotHeight - (p.count * yScale);
        forecastPath += ` L ${x} ${y}`;
      });
    }

    firstFillingPoints.forEach((p, idx) => {
      if (p.count > 0) {
        const x = padLeft + idx * xScale;
        const y = padTop + plotHeight - (p.count * yScale);
        if (!firstFillingPath) {
          firstFillingPath += `M ${x} ${y}`;
        } else {
          firstFillingPath += ` L ${x} ${y}`;
        }
      }
    });

    const caption = isShortWindow
      ? "Observed archive counts. Band shows forecast uncertainty."
      : "Observed archive counts. Band is wide before 1980 because the historic backfill is still growing, and it widens on the forecast. Not a risk model.";

    return `
      <div class="stat-card">
        <h2 class="stat-card-title">Failures over time</h2>
        <svg class="timeline-chart" viewBox="0 0 ${chartWidth} ${chartHeight}" xmlns="http://www.w3.org/2000/svg">
          ${yGridLines}
          ${uncertaintyPaths}
          <path d="${observedPath}" fill="none" stroke="#e24b4a" stroke-width="2.5"/>
          ${firstFillingPath ? `<path d="${firstFillingPath}" fill="none" stroke="#6b94c4" stroke-width="1.5" opacity="0.85"/>` : ""}
          ${forecastPath ? `<path d="${forecastPath}" fill="none" stroke="#7a8894" stroke-width="2" stroke-dasharray="5,3" opacity="0.7"/>` : ""}
          ${xLabels}
        </svg>
        <div class="timeline-legend">
          <span class="timeline-legend-item"><span class="timeline-legend-dot" style="background: #e24b4a;"></span> Observed</span>
          <span class="timeline-legend-item"><span class="timeline-legend-dot" style="background: #6b94c4;"></span> First filling</span>
          <span class="timeline-legend-item"><span class="timeline-legend-dot" style="background: #7a8894;"></span> Forecast</span>
          <span class="timeline-legend-item"><span class="timeline-legend-dot timeline-legend-dot-band"></span> Uncertainty</span>
        </div>
        <p class="timeline-caption">${caption}</p>
      </div>
    `;
  }

  function renderStats(incidents, layer) {
    const stats = computeStats(incidents, layer);
    
    const html = `
      <div class="stats-grid">
        ${renderOverview(stats, layer)}
        ${renderFailuresOverTime(incidents, layer)}
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
