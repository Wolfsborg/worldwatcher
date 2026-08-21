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

  function renderFailuresOverTime(stats) {
    const years = {};
    Object.keys(stats.decadeCounts).forEach(decade => {
      const d = parseInt(decade);
      for (let y = d; y < d + 10; y++) {
        years[y] = 0;
      }
    });

    const incidents = Object.values(stats.decadeCounts).reduce((sum, c) => sum + c, 0);
    if (incidents === 0) {
      return `
        <div class="stat-card">
          <h2 class="stat-card-title">Incidents over time</h2>
          <p style="color: var(--muted); font-size: 13px;">No temporal data available</p>
        </div>
      `;
    }

    const allYears = Object.keys(years).map(Number).sort((a, b) => a - b);
    if (allYears.length === 0) return "";

    const minYear = Math.min(...allYears);
    const maxYear = Math.max(...allYears);
    const currentYear = new Date().getFullYear();

    const binWidth = 5;
    const bins = [];
    for (let y = minYear; y <= maxYear; y += binWidth) {
      const binStart = y;
      const binEnd = Math.min(y + binWidth - 1, maxYear);
      const binMid = (binStart + binEnd) / 2;
      let count = 0;
      Object.entries(stats.decadeCounts).forEach(([decade, c]) => {
        const d = parseInt(decade);
        for (let year = d; year < d + 10; year++) {
          if (year >= binStart && year <= binEnd) {
            count += c / 10;
          }
        }
      });
      bins.push({ start: binStart, end: binEnd, mid: binMid, count });
    }

    const historicalBins = bins.filter(b => b.end <= currentYear);
    const n = historicalBins.length;
    
    if (n < 2) {
      return `
        <div class="stat-card">
          <h2 class="stat-card-title">Incidents over time</h2>
          <p style="color: var(--muted); font-size: 13px;">Insufficient data for trend analysis</p>
        </div>
      `;
    }

    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    historicalBins.forEach((b, i) => {
      sumX += i;
      sumY += b.count;
      sumXY += i * b.count;
      sumXX += i * i;
    });

    const xMean = sumX / n;
    const yMean = sumY / n;
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = yMean - slope * xMean;

    let sumResidualSq = 0;
    historicalBins.forEach((b, i) => {
      const predicted = intercept + slope * i;
      const residual = b.count - predicted;
      sumResidualSq += residual * residual;
    });
    const residualStd = Math.sqrt(sumResidualSq / Math.max(1, n - 2));

    let Sxx = 0;
    historicalBins.forEach((b, i) => {
      Sxx += (i - xMean) * (i - xMean);
    });

    const lastHistoricalValue = historicalBins[n - 1].count;
    const forecastHorizon = 4;
    const forecastPoints = [];
    
    for (let h = 0; h <= forecastHorizon; h += 0.2) {
      const year = historicalBins[n - 1].mid + h * binWidth;
      
      let se;
      if (Sxx === 0 || n < 3) {
        se = residualStd * Math.sqrt(Math.max(h, 0.05));
      } else {
        const predVar = 1 + 1/n + Math.pow((n - 1 + h) - xMean, 2) / Sxx;
        se = residualStd * Math.sqrt(predVar);
      }

      const centerPred = lastHistoricalValue + slope * h;

      if (h === 0) {
        forecastPoints.push({
          year,
          se,
          center: lastHistoricalValue,
          band50_lower: lastHistoricalValue,
          band50_upper: lastHistoricalValue,
          band80_lower: lastHistoricalValue,
          band80_upper: lastHistoricalValue,
          band95_lower: lastHistoricalValue,
          band95_upper: lastHistoricalValue,
        });
      } else {
        forecastPoints.push({
          year,
          se,
          center: centerPred,
          band50_lower: Math.max(0, centerPred - 0.674 * se),
          band50_upper: centerPred + 0.674 * se,
          band80_lower: Math.max(0, centerPred - 1.282 * se),
          band80_upper: centerPred + 1.282 * se,
          band95_lower: Math.max(0, centerPred - 1.960 * se),
          band95_upper: centerPred + 1.960 * se,
        });
      }
    }

    const allValues = [
      ...historicalBins.map(b => b.count),
      ...forecastPoints.map(p => p.band95_upper)
    ];
    const maxValue = Math.max(...allValues);
    const minValue = 0;

    const chartWidth = 600;
    const chartHeight = 300;
    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 40;
    const plotWidth = chartWidth - paddingLeft - paddingRight;
    const plotHeight = chartHeight - paddingTop - paddingBottom;

    const xScale = (year) => {
      return paddingLeft + ((year - minYear) / (maxYear + forecastHorizon * binWidth - minYear)) * plotWidth;
    };
    const yScale = (value) => {
      return chartHeight - paddingBottom - ((value - minValue) / (maxValue - minValue)) * plotHeight;
    };

    const xTickYears = [];
    for (let y = Math.ceil(minYear / binWidth) * binWidth; y <= maxYear + forecastHorizon * binWidth; y += binWidth) {
      xTickYears.push(y);
    }

    const xAxisTicks = xTickYears.map(y => {
      const x = xScale(y);
      return `<line x1="${x}" y1="${chartHeight - paddingBottom}" x2="${x}" y2="${chartHeight - paddingBottom + 5}" stroke="var(--border)" stroke-width="1"/>
              <text x="${x}" y="${chartHeight - paddingBottom + 18}" text-anchor="middle" fill="var(--text)" font-size="11">${y}</text>`;
    }).join('');

    const yTicks = 5;
    const yAxisTicks = Array.from({length: yTicks + 1}, (_, i) => {
      const value = minValue + (maxValue - minValue) * i / yTicks;
      const y = yScale(value);
      return `<line x1="${paddingLeft - 5}" y1="${y}" x2="${paddingLeft}" y2="${y}" stroke="var(--border)" stroke-width="1"/>
              <text x="${paddingLeft - 8}" y="${y + 4}" text-anchor="end" fill="var(--muted)" font-size="11">${Math.round(value)}</text>`;
    }).join('');

    const band95Path = `M ${xScale(forecastPoints[0].year)} ${yScale(forecastPoints[0].band95_lower)} ` +
      forecastPoints.slice(1).map(p => `L ${xScale(p.year)} ${yScale(p.band95_lower)}`).join(' ') +
      forecastPoints.slice().reverse().map(p => `L ${xScale(p.year)} ${yScale(p.band95_upper)}`).join(' ') +
      ' Z';

    const band80Path = `M ${xScale(forecastPoints[0].year)} ${yScale(forecastPoints[0].band80_lower)} ` +
      forecastPoints.slice(1).map(p => `L ${xScale(p.year)} ${yScale(p.band80_lower)}`).join(' ') +
      forecastPoints.slice().reverse().map(p => `L ${xScale(p.year)} ${yScale(p.band80_upper)}`).join(' ') +
      ' Z';

    const band50Path = `M ${xScale(forecastPoints[0].year)} ${yScale(forecastPoints[0].band50_lower)} ` +
      forecastPoints.slice(1).map(p => `L ${xScale(p.year)} ${yScale(p.band50_lower)}`).join(' ') +
      forecastPoints.slice().reverse().map(p => `L ${xScale(p.year)} ${yScale(p.band50_upper)}`).join(' ') +
      ' Z';

    const historicalPath = historicalBins.map((b, i) => {
      const x = xScale(b.mid);
      const y = yScale(b.count);
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    }).join(' ');

    const nowLineX = xScale(currentYear);

    return `
      <div class="stat-card incidents-over-time-card">
        <h2 class="stat-card-title">Incidents over time</h2>
        <svg viewBox="0 0 ${chartWidth} ${chartHeight}" xmlns="http://www.w3.org/2000/svg" class="time-series-chart">
          <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${chartHeight - paddingBottom}" stroke="var(--border)" stroke-width="1"/>
          <line x1="${paddingLeft}" y1="${chartHeight - paddingBottom}" x2="${chartWidth - paddingRight}" y2="${chartHeight - paddingBottom}" stroke="var(--border)" stroke-width="1"/>
          
          ${xAxisTicks}
          ${yAxisTicks}
          
          <path d="${band95Path}" fill="var(--uncertainty-95)" stroke="none"/>
          <path d="${band80Path}" fill="var(--uncertainty-80)" stroke="none"/>
          <path d="${band50Path}" fill="var(--uncertainty-50)" stroke="none"/>
          
          <line x1="${nowLineX}" y1="${paddingTop}" x2="${nowLineX}" y2="${chartHeight - paddingBottom}" stroke="var(--border)" stroke-width="1" stroke-dasharray="4 2"/>
          
          <path d="${historicalPath}" stroke="#4aa3df" stroke-width="2" fill="none"/>
          
          ${historicalBins.map(b => `<circle cx="${xScale(b.mid)}" cy="${yScale(b.count)}" r="3" fill="#4aa3df"/>`).join('')}
        </svg>
        <div class="chart-legend">
          <div class="legend-item"><span class="legend-line" style="background: #4aa3df"></span> Dam incidents</div>
          <div class="legend-item"><span class="legend-swatch" style="background: var(--uncertainty-50)"></span> 50% range</div>
          <div class="legend-item"><span class="legend-swatch" style="background: var(--uncertainty-80)"></span> 80% range</div>
          <div class="legend-item"><span class="legend-swatch" style="background: var(--uncertainty-95)"></span> 95% range</div>
        </div>
        <p class="chart-caption">Archive counts; not a risk model. Bins are 5-year periods. Forecast bands show statistical uncertainty from a linear fit to historical data, not future risk assessment.</p>
      </div>
    `;
  }

  function renderStats(incidents, layer) {
    const stats = computeStats(incidents, layer);
    
    const html = `
      <div class="stats-grid">
        ${renderOverview(stats, layer)}
        ${renderFailuresOverTime(stats)}
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
