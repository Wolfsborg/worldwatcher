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
    try {
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
      if (historicalBins.length === 0) return "";
      
      const totals = historicalBins.map(b => binData[b]);
    
      let trend = 0;
      let residualStd = 0;
      const n = totals.length;
      if (n >= 3) {
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

      const lastHistoricalValue = totals[totals.length - 1] || 0;
      const lastHistoricalBin = historicalBins[historicalBins.length - 1];
      if (!Number.isFinite(lastHistoricalBin)) return "";
      
      const effectiveCurrentYear = currentYear > lastHistoricalBin ? currentYear : lastHistoricalBin;
    
    const projectionSteps = [];
    for (let h = 0; h <= 4; h += 0.2) {
      projectionSteps.push(h);
    }
    
    let effectiveStd = residualStd;
    if (effectiveStd === 0) {
      const maxHistorical = Math.max(...totals, 10);
      const tempNiceMax = Math.ceil(maxHistorical / 50) * 50;
      effectiveStd = Math.max(tempNiceMax * 0.05, 2);
    }
    
    const currentBinValue = binData[currentBin] || 0;
    
    const projections = projectionSteps.map(h => {
      const center = currentBinValue + trend * h;
      const se = effectiveStd * Math.sqrt(h);
      
      return {
        bin: currentYear + h * 5,
        h,
        center,
        band50: [Math.max(0, center - 0.674 * se), center + 0.674 * se],
        band80: [Math.max(0, center - 1.282 * se), center + 1.282 * se],
        band95: [Math.max(0, center - 1.960 * se), center + 1.960 * se]
      };
    });

      const allValues = [
        ...totals,
        ...projections.flatMap(p => [p.band95[0], p.band95[1]])
      ];
      let maxValue = allValues.length > 0 ? Math.max(...allValues) : 0;
      if (!Number.isFinite(maxValue) || maxValue <= 0) maxValue = 1;
      
      function computeNiceMax(max) {
        if (!Number.isFinite(max) || max <= 0) return 1;
        
        const logVal = Math.log10(max);
        if (!Number.isFinite(logVal)) return 1;
        
        const magnitude = Math.pow(10, Math.floor(logVal));
        const normalized = max / magnitude;
        
        let niceNormalized;
        if (normalized <= 1.2) niceNormalized = 1.5;
        else if (normalized <= 2) niceNormalized = 2;
        else if (normalized <= 2.5) niceNormalized = 2.5;
        else if (normalized <= 5) niceNormalized = 5;
        else niceNormalized = 10;
        
        return niceNormalized * magnitude;
      }
      
      const niceMax = computeNiceMax(maxValue * 1.05);
      if (!Number.isFinite(niceMax) || niceMax <= 0) return "";
    
    const recentBinValue = lastHistoricalValue;
    const trendPerFiveYears = trend;
    
    const width = 700;
    const height = 280;
    const leftPad = 70;
    const rightPad = 80;
    const topPad = 30;
    const bottomPad = 50;
    const plotWidth = width - leftPad - rightPad;
    const plotHeight = height - topPad - bottomPad;
    
    function toY(val) {
      return topPad + plotHeight - (val / niceMax) * plotHeight;
    }
    
    const minBin = historicalBins[0];
    let maxBin = lastHistoricalBin + 20;
    
    if (effectiveCurrentYear > maxBin) {
      maxBin = effectiveCurrentYear + 15;
    }
    
    const binRange = maxBin - minBin;
    
    function toX(bin) {
      return leftPad + ((bin - minBin) / binRange) * plotWidth;
    }
    
    const nowX = toX(currentYear);

    let svgContent = `<svg viewBox="0 0 ${width} ${height}" class="fan-chart">`;
    
    svgContent += `<rect x="${nowX}" y="${topPad}" width="${leftPad + plotWidth - nowX}" height="${plotHeight}" fill="rgba(232,234,237,0.04)"/>`;
    
      function computeYStep(max) {
        if (!Number.isFinite(max) || max <= 0) return 1;
        
        const targetTicks = 5;
        const roughStep = max / targetTicks;
        const logVal = Math.log10(roughStep);
        if (!Number.isFinite(logVal)) return 1;
        
        const magnitude = Math.pow(10, Math.floor(logVal));
        const normalized = roughStep / magnitude;
        
        let niceStep;
        if (normalized <= 1) niceStep = 1;
        else if (normalized <= 2) niceStep = 2;
        else if (normalized <= 2.5) niceStep = 2.5;
        else if (normalized <= 5) niceStep = 5;
        else niceStep = 10;
        
        return niceStep * magnitude;
      }
      
      const yTicks = [];
      const yStep = computeYStep(niceMax);
      if (!Number.isFinite(yStep) || yStep <= 0) return "";
      
      let tickCount = 0;
      for (let i = 0; i <= niceMax && tickCount < 12; i += yStep) {
        yTicks.push(i);
        tickCount++;
      }
    
    yTicks.forEach(val => {
      const y = toY(val);
      svgContent += `<line x1="${leftPad - 6}" y1="${y}" x2="${leftPad}" y2="${y}" stroke="var(--line-strong)" stroke-width="1"/>`;
      svgContent += `<text x="${leftPad - 10}" y="${y}" text-anchor="end" dominant-baseline="middle" fill="var(--muted)" font-size="11">${val}</text>`;
      svgContent += `<line x1="${leftPad}" y1="${y}" x2="${leftPad + plotWidth}" y2="${y}" stroke="rgba(232, 234, 237, 0.04)" stroke-width="1"/>`;
    });
    
    svgContent += `<line x1="${leftPad}" y1="${topPad}" x2="${leftPad}" y2="${topPad + plotHeight}" stroke="var(--line-strong)" stroke-width="1.5"/>`;
    svgContent += `<line x1="${leftPad}" y1="${topPad + plotHeight}" x2="${leftPad + plotWidth}" y2="${topPad + plotHeight}" stroke="var(--line-strong)" stroke-width="1.5"/>`;
    
    const timeSpan = maxBin - minBin;
    const labelInterval = timeSpan > 60 ? 10 : 5;
    
    for (let bin = minBin; bin <= maxBin; bin += 5) {
      if (bin % 5 === 0) {
        const x = toX(bin);
        svgContent += `<line x1="${x}" y1="${topPad + plotHeight}" x2="${x}" y2="${topPad + plotHeight + 6}" stroke="var(--line-strong)" stroke-width="1"/>`;
        
        if (bin % labelInterval === 0) {
          svgContent += `<text x="${x}" y="${topPad + plotHeight + 20}" fill="var(--muted)" font-size="11" text-anchor="middle">${bin}</text>`;
        }
      }
    }
    
    if (projections.length > 0) {
      function smoothBand(upper, lower) {
        const points = [];
        
        for (let i = 0; i < projections.length; i++) {
          const x = toX(projections[i].bin);
          const y = toY(upper[i]);
          points.push(`${x},${y}`);
        }
        
        for (let i = projections.length - 1; i >= 0; i--) {
          const x = toX(projections[i].bin);
          const y = toY(lower[i]);
          points.push(`${x},${y}`);
        }
        
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

    const linePoints = historicalBins
      .filter(b => b < currentBin)
      .map(bin => `${toX(bin)},${toY(binData[bin])}`)
      .concat([`${toX(currentYear)},${toY(binData[currentBin] || 0)}`])
      .join(' ');
    svgContent += `<polyline points="${linePoints}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>`;

    svgContent += `<line x1="${nowX}" y1="${topPad}" x2="${nowX}" y2="${topPad + plotHeight}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4,4"/>`;
    svgContent += `<text x="${nowX}" y="${topPad - 8}" fill="var(--muted)" font-size="11" text-anchor="middle" font-weight="500">now</text>`;
    
    const projectionX = (nowX + leftPad + plotWidth) / 2;
    svgContent += `<text x="${projectionX}" y="${topPad - 8}" fill="var(--muted)" font-size="11" text-anchor="middle" font-weight="500">Projection</text>`;
    
    svgContent += `<text x="${leftPad - 55}" y="${topPad + plotHeight / 2}" fill="var(--text)" font-size="12" text-anchor="middle" font-weight="500" transform="rotate(-90 ${leftPad - 55} ${topPad + plotHeight / 2})">Incidents per 5 years</text>`;
    svgContent += `<text x="${leftPad + plotWidth / 2}" y="${height - 5}" fill="var(--text)" font-size="12" text-anchor="middle" font-weight="500">Year</text>`;

    svgContent += `</svg>`;

    const legend = [
      '<div class="fan-legend-item"><span class="fan-legend-line"></span><span>Dam incidents — recorded counts in this archive</span></div>',
      '<div class="fan-legend-item"><span class="fan-legend-box fan-band-50"></span><span>50% range — central half of the prediction interval</span></div>',
      '<div class="fan-legend-item"><span class="fan-legend-box fan-band-80"></span><span>80% range</span></div>',
      '<div class="fan-legend-item"><span class="fan-legend-box fan-band-95"></span><span>95% range</span></div>',
    ].join('');
    
    const statsLine = n >= 3 
      ? `Current 5-year bin (${getBinStart(currentYear)}–${currentYear}): ${currentBinValue}  ·  trend: ${trendPerFiveYears >= 0 ? '+' : ''}${trendPerFiveYears.toFixed(1)} / 5y`
      : '';

      return `
        <div class="stat-card timeline-card">
          <h2 class="stat-card-title">Incidents over time</h2>
          <p class="stat-card-subtitle">Recorded dam incidents in this archive, 5-year bins. Projection is a trend on those counts, not a risk model.</p>
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
          <p class="fan-caption">History is observed archive counts (still backfilling; older bins are incomplete). The fan is residual spread × √horizon (accumulating error on archive bin counts). This is not the probability a given dam fails, and not a global ICOLD failure rate. Country filter refits both the line and the fan.${statsLine ? ' ' + statsLine : ''}</p>
        </div>
      `;
    } catch (error) {
      console.error("Fan chart render error:", error);
      return "";
    }
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
