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
    const validCategories = ["failure", "partial_breach", "incident", "watch"];
    const categories = Object.entries(stats.categoryCounts)
      .filter(([cat]) => layer === "floods" || validCategories.includes(cat))
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

  function renderFailuresOverTime(incidents, layer, selectedCountry) {
    if (layer !== "dams") return "";
    
    const validCategories = ["failure", "partial_breach", "incident", "watch"];
    let filtered = incidents.filter(inc => validCategories.includes(inc.category));
    
    if (selectedCountry) {
      filtered = filtered.filter(inc => inc.country === selectedCountry);
    }
    
    if (filtered.length === 0) return "";

    const countries = Array.from(new Set(incidents.filter(inc => validCategories.includes(inc.category)).map(inc => inc.country).filter(Boolean))).sort();
    const countryOptions = countries.map(c => `<option value="${c}"${c === selectedCountry ? ' selected' : ''}>${c}</option>`).join("");

    function getBinStart(year) {
      const lastDigit = year % 10;
      if (lastDigit < 5) {
        return Math.floor(year / 10) * 10;
      } else {
        return Math.floor(year / 10) * 10 + 5;
      }
    }

    const binData = {};
    filtered.forEach(inc => {
      const y = yearOf(inc);
      if (y != null && y >= 1800) {
        const binStart = getBinStart(y);
        binData[binStart] = (binData[binStart] || 0) + 1;
      }
    });

    const bins = Object.keys(binData).map(Number).sort((a, b) => a - b);
    if (bins.length === 0) return "";

    const currentYear = new Date().getFullYear();
    const currentBin = getBinStart(currentYear);
    
    const historicalBins = bins.filter(b => b <= currentBin);
    const totals = historicalBins.map(b => binData[b]);
    
    let trend = 0;
    let residualStd = 0;
    if (totals.length >= 3) {
      const n = totals.length;
      const xMean = (n - 1) / 2;
      const yMean = totals.reduce((a, b) => a + b, 0) / n;
      let numerator = 0;
      let denominator = 0;
      totals.forEach((y, i) => {
        numerator += (i - xMean) * (y - yMean);
        denominator += (i - xMean) * (i - xMean);
      });
      trend = denominator > 0 ? numerator / denominator : 0;
      
      const residuals = totals.map((y, i) => y - (yMean + trend * (i - xMean)));
      residualStd = Math.sqrt(residuals.reduce((a, b) => a + b * b, 0) / Math.max(1, n - 2));
    }

    const projectionBins = [currentBin + 5, currentBin + 10, currentBin + 15, currentBin + 20];
    const lastHistoricalValue = totals[totals.length - 1] || 0;
    const lastHistoricalBin = historicalBins[historicalBins.length - 1];
    
    const projections = projectionBins.map((bin, idx) => {
      const step = idx + 1;
      const forecast = Math.max(0, lastHistoricalValue + trend * step);
      const spread = residualStd * Math.sqrt(1 + step * 0.3);
      return {
        bin,
        forecast,
        band50: [Math.max(0, forecast - 0.67 * spread), forecast + 0.67 * spread],
        band80: [Math.max(0, forecast - 1.28 * spread), forecast + 1.28 * spread],
        band95: [Math.max(0, forecast - 1.96 * spread), forecast + 1.96 * spread]
      };
    });

    const allValues = [
      ...totals,
      ...projections.flatMap(p => [p.band95[0], p.band95[1]])
    ];
    const maxValue = Math.max(...allValues, 10);
    const niceMax = Math.ceil(maxValue / 50) * 50;
    
    const width = 700;
    const height = 240;
    const leftPad = 50;
    const rightPad = 30;
    const topPad = 20;
    const bottomPad = 40;
    const plotWidth = width - leftPad - rightPad;
    const plotHeight = height - topPad - bottomPad;
    
    function toY(val) {
      return topPad + plotHeight - (val / niceMax) * plotHeight;
    }
    
    const minBin = historicalBins[0];
    const maxBin = projectionBins[projectionBins.length - 1];
    const binRange = maxBin - minBin;
    
    function toX(bin) {
      return leftPad + ((bin - minBin) / binRange) * plotWidth;
    }
    
    const nowX = toX(lastHistoricalBin);

    let svgContent = `<svg viewBox="0 0 ${width} ${height}" class="fan-chart">`;
    
    svgContent += `<rect x="${nowX}" y="${topPad}" width="${leftPad + plotWidth - nowX}" height="${plotHeight}" fill="rgba(232,234,237,0.04)"/>`;
    
    const yTicks = [];
    const yStep = niceMax <= 100 ? 25 : niceMax <= 200 ? 50 : 100;
    for (let i = 0; i <= niceMax; i += yStep) {
      yTicks.push(i);
    }
    
    yTicks.forEach(val => {
      const y = toY(val);
      svgContent += `<line x1="${leftPad - 6}" y1="${y}" x2="${leftPad}" y2="${y}" stroke="var(--line-strong)" stroke-width="1"/>`;
      svgContent += `<text x="${leftPad - 10}" y="${y}" text-anchor="end" dominant-baseline="middle" fill="var(--muted)" font-size="11">${val}</text>`;
      svgContent += `<line x1="${leftPad}" y1="${y}" x2="${leftPad + plotWidth}" y2="${y}" stroke="rgba(232, 234, 237, 0.04)" stroke-width="1"/>`;
    });
    
    svgContent += `<line x1="${leftPad}" y1="${topPad}" x2="${leftPad}" y2="${topPad + plotHeight}" stroke="var(--line-strong)" stroke-width="1.5"/>`;
    svgContent += `<line x1="${leftPad}" y1="${topPad + plotHeight}" x2="${leftPad + plotWidth}" y2="${topPad + plotHeight}" stroke="var(--line-strong)" stroke-width="1.5"/>`;
    
    [...historicalBins, ...projectionBins].forEach(bin => {
      if (bin % 10 === 0 || bin % 10 === 5) {
        const x = toX(bin);
        svgContent += `<line x1="${x}" y1="${topPad + plotHeight}" x2="${x}" y2="${topPad + plotHeight + 6}" stroke="var(--line-strong)" stroke-width="1"/>`;
        svgContent += `<text x="${x}" y="${topPad + plotHeight + 20}" fill="var(--muted)" font-size="11" text-anchor="middle">${bin}</text>`;
      }
    });
    
    if (projections.length > 0) {
      const interpPoints = 5;
      function smoothBand(upper, lower) {
        const points = [];
        
        points.push(`${nowX},${toY(lastHistoricalValue)}`);
        
        for (let i = 0; i < projections.length; i++) {
          const x = toX(projections[i].bin);
          const y = toY(upper[i]);
          
          if (i === 0) {
            for (let j = 1; j <= interpPoints; j++) {
              const t = j / interpPoints;
              const interpX = nowX + (x - nowX) * t;
              const interpY = toY(lastHistoricalValue) + (y - toY(lastHistoricalValue)) * t;
              points.push(`${interpX},${interpY}`);
            }
          } else {
            const prevX = toX(projections[i - 1].bin);
            const prevY = toY(upper[i - 1]);
            for (let j = 1; j <= interpPoints; j++) {
              const t = j / interpPoints;
              const interpX = prevX + (x - prevX) * t;
              const interpY = prevY + (y - prevY) * t;
              points.push(`${interpX},${interpY}`);
            }
          }
        }
        
        for (let i = projections.length - 1; i >= 0; i--) {
          const x = toX(projections[i].bin);
          const y = toY(lower[i]);
          
          if (i === projections.length - 1) {
            for (let j = interpPoints; j >= 1; j--) {
              const nextX = toX(projections[i].bin);
              const prevX = i > 0 ? toX(projections[i - 1].bin) : nowX;
              const t = j / interpPoints;
              const interpX = prevX + (nextX - prevX) * t;
              const interpY = toY(lower[i]) + (toY(i > 0 ? lower[i - 1] : lastHistoricalValue) - toY(lower[i])) * (1 - t);
              points.push(`${interpX},${interpY}`);
            }
          } else {
            const nextX = toX(projections[i + 1].bin);
            const nextY = toY(lower[i + 1]);
            for (let j = interpPoints; j >= 1; j--) {
              const t = j / interpPoints;
              const interpX = x + (nextX - x) * (1 - t);
              const interpY = y + (nextY - y) * (1 - t);
              points.push(`${interpX},${interpY}`);
            }
          }
        }
        
        points.push(`${nowX},${toY(lastHistoricalValue)}`);
        
        return `<polygon points="${points.join(' ')}" fill="currentColor" stroke="none"/>`;
      }
      
      const band95Upper = projections.map(p => p.band95[1]);
      const band95Lower = projections.map(p => p.band95[0]);
      svgContent += `<g style="color: rgba(139,145,154,0.15)">${smoothBand(band95Upper, band95Lower)}</g>`;
      
      const band80Upper = projections.map(p => p.band80[1]);
      const band80Lower = projections.map(p => p.band80[0]);
      svgContent += `<g style="color: rgba(139,145,154,0.25)">${smoothBand(band80Upper, band80Lower)}</g>`;
      
      const band50Upper = projections.map(p => p.band50[1]);
      const band50Lower = projections.map(p => p.band50[0]);
      svgContent += `<g style="color: rgba(139,145,154,0.4)">${smoothBand(band50Upper, band50Lower)}</g>`;
    }

    const linePoints = historicalBins.map(bin => 
      `${toX(bin)},${toY(binData[bin])}`
    ).join(' ');
    svgContent += `<polyline points="${linePoints}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>`;

    svgContent += `<line x1="${nowX}" y1="${topPad}" x2="${nowX}" y2="${topPad + plotHeight}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4,4"/>`;

    svgContent += `</svg>`;

    const legend = [
      '<div class="fan-legend-item"><span class="fan-legend-line"></span><span>Dam incidents</span></div>',
      '<div class="fan-legend-item"><span class="fan-legend-box fan-band-50"></span><span>50% range</span></div>',
      '<div class="fan-legend-item"><span class="fan-legend-box fan-band-80"></span><span>80% range</span></div>',
      '<div class="fan-legend-item"><span class="fan-legend-box fan-band-95"></span><span>95% range</span></div>',
    ].join('');

    return `
      <div class="stat-card timeline-card">
        <h2 class="stat-card-title">Incidents over time</h2>
        <div class="timeline-filter-row">
          <label class="timeline-filter-label">
            <span class="timeline-filter-text">Country</span>
            <select class="timeline-country-filter" data-timeline-country>
              <option value="">All countries</option>
              ${countryOptions}
            </select>
          </label>
        </div>
        ${svgContent}
        <div class="fan-legend">${legend}</div>
        <p class="fan-caption">Simple trend on archive counts in this database. Not global failure rates. Country filter applies to both history and projection.</p>
      </div>
    `;
  }

  let currentTimelineCountry = null;

  function renderStats(incidents, layer) {
    const stats = computeStats(incidents, layer);
    
    const html = `
      <div class="stats-grid">
        ${renderOverview(stats, layer)}
        ${renderFailuresOverTime(incidents, layer, currentTimelineCountry)}
        ${renderByCause(stats)}
        ${renderByCountry(stats)}
        ${renderByCategory(stats, layer)}
        ${renderByType(stats, layer)}
        ${renderByDecade(stats)}
      </div>
    `;

    return html;
  }

  function bindTimelineCountryFilter(onChangeCallback) {
    setTimeout(() => {
      const filter = document.querySelector("[data-timeline-country]");
      if (filter) {
        filter.addEventListener("change", (e) => {
          currentTimelineCountry = e.target.value || null;
          if (onChangeCallback) {
            onChangeCallback();
          }
        });
      }
    }, 10);
  }

  window.worldwatcherStats = {
    render: renderStats,
    bindTimelineCountryFilter: bindTimelineCountryFilter,
  };
})();
