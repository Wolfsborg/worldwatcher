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
  };
  const TYPE_LABEL = {
    reservoir_dam: "Reservoir dam",
    tailings: "Tailings",
    levee_embankment: "Levee / embankment",
    weir: "Weir",
    spillway: "Spillway",
    sluice: "Sluice",
  };
  const CATEGORY_LABEL = {
    failure: "Failure",
    partial_breach: "Partial breach",
    incident: "Incident",
    watch: "Watch",
    controlled_release: "Controlled release",
  };

  const panel = document.getElementById("maintain");
  const form = document.getElementById("maintain-form");
  const matchesEl = document.getElementById("maintain-matches");
  const resultEl = document.getElementById("maintain-result");
  const openBtn = document.getElementById("maintain-open");
  const closeBtn = document.getElementById("maintain-close");
  const checkBtn = document.getElementById("maintain-check");
  const saveBtn = document.getElementById("maintain-save");
  const updateBtn = document.getElementById("detail-update");
  const targetHint = document.getElementById("maintain-target");
  const causesBox = document.getElementById("maintain-causes");
  if (!panel || !form) return;

  let targetId = null;
  let recordId = null;

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fillSelect(el, map, blank) {
    if (!el) return;
    el.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = blank;
    el.appendChild(empty);
    Object.keys(map).forEach((k) => {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = map[k];
      el.appendChild(o);
    });
  }

  function buildCauses() {
    if (!causesBox) return;
    causesBox.innerHTML = "";
    Object.keys(CAUSE_LABEL).forEach((slug) => {
      const id = "cause-" + slug;
      const label = document.createElement("label");
      label.className = "maintain-cause";
      label.innerHTML =
        '<input type="checkbox" name="causes" value="' + slug + '" id="' + id + '">' +
        '<span>' + escapeHtml(CAUSE_LABEL[slug]) + "</span>";
      causesBox.appendChild(label);
    });
  }

  fillSelect(form.elements.type, TYPE_LABEL, "Type");
  fillSelect(form.elements.category, CATEGORY_LABEL, "Category");
  buildCauses();

  function setResult(text, kind) {
    resultEl.hidden = !text;
    resultEl.textContent = text || "";
    resultEl.className = "maintain-result" + (kind ? " is-" + kind : "");
  }

  function setTarget(id, name) {
    targetId = id || null;
    if (targetHint) {
      if (targetId) {
        targetHint.hidden = false;
        targetHint.textContent = "Merge into: " + (name || targetId);
      } else {
        targetHint.hidden = true;
        targetHint.textContent = "";
      }
    }
    if (matchesEl) {
      [...matchesEl.querySelectorAll(".maintain-match")].forEach((b) => {
        b.classList.toggle("is-selected", b.dataset.id === targetId);
      });
    }
  }

  function resetForm() {
    form.reset();
    recordId = null;
    setTarget(null);
    matchesEl.innerHTML = "";
    matchesEl.hidden = true;
    setResult("");
  }

  function openPanel() {
    panel.hidden = false;
    const first = form.querySelector("input, select, textarea");
    if (first) first.focus();
  }

  function closePanel() {
    panel.hidden = true;
  }

  function collectIncident() {
    const get = (name) => {
      const el = form.elements[name];
      return el ? String(el.value || "").trim() : "";
    };
    const inc = {};
    ["name", "country", "region", "location_label", "incident_date",
      "type", "category", "what_happened", "status"].forEach((k) => {
      const v = get(k);
      if (v) inc[k] = v;
    });
    const deaths = get("deaths");
    if (deaths !== "") {
      const n = Number(deaths);
      if (Number.isFinite(n)) inc.deaths = n;
    }
    const lat = get("lat");
    const lng = get("lng");
    if (lat !== "" && Number.isFinite(Number(lat))) inc.lat = Number(lat);
    if (lng !== "" && Number.isFinite(Number(lng))) inc.lng = Number(lng);
    const causes = [...form.querySelectorAll('input[name="causes"]:checked')].map((c) => c.value);
    if (causes.length) inc.causes = causes;
    const url = get("source_url");
    const label = get("source_label");
    if (url || label) inc.sources = [{ label: label || url, url: url }];
    if (recordId) inc.id = recordId;
    return inc;
  }

  function fillForm(inc) {
    resetForm();
    if (!inc) return;
    recordId = inc.id || null;
    const set = (name, val) => {
      const el = form.elements[name];
      if (el && val != null) el.value = val;
    };
    set("name", inc.name || "");
    set("country", inc.country || "");
    set("region", inc.region || "");
    set("location_label", inc.location_label || "");
    set("incident_date", inc.incident_date || "");
    set("type", inc.type || "");
    set("category", inc.category || "");
    set("what_happened", inc.what_happened || "");
    set("status", inc.status || "");
    set("deaths", typeof inc.deaths === "number" ? inc.deaths : "");
    set("lat", typeof inc.lat === "number" ? inc.lat : "");
    set("lng", typeof inc.lng === "number" ? inc.lng : "");
    const src = (inc.sources && inc.sources[0]) || {};
    set("source_url", src.url || "");
    set("source_label", src.label || "");
    const causes = inc.causes || [];
    form.querySelectorAll('input[name="causes"]').forEach((box) => {
      box.checked = causes.indexOf(box.value) !== -1;
    });
    if (recordId) setTarget(recordId, inc.name);
  }

  function renderMatches(matches) {
    matchesEl.innerHTML = "";
    if (!matches || !matches.length) {
      matchesEl.hidden = false;
      matchesEl.innerHTML = '<p class="maintain-empty">No matching records.</p>';
      return;
    }
    matchesEl.hidden = false;
    const head = document.createElement("p");
    head.className = "maintain-empty";
    head.textContent = matches.length + " possible match" + (matches.length === 1 ? "" : "es") + ". Select one to merge into.";
    matchesEl.appendChild(head);
    matches.forEach((m) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "maintain-match" + (m.id === targetId ? " is-selected" : "");
      btn.dataset.id = m.id || "";
      btn.innerHTML =
        '<span class="maintain-match-name">' + escapeHtml(m.name || m.id) + "</span>" +
        '<span class="maintain-match-meta">' + escapeHtml(m.incident_date || "") +
        (m.country ? " · " + escapeHtml(m.country) : "") + "</span>";
      btn.addEventListener("click", () => {
        if (targetId === m.id) setTarget(null);
        else setTarget(m.id, m.name);
      });
      matchesEl.appendChild(btn);
    });
  }

  function apiHint(res) {
    if (res && res.status === 404) return true;
    return false;
  }

  async function callApi(path, body) {
    let res;
    try {
      res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      setResult("Start with python server.py", "error");
      return null;
    }
    if (apiHint(res)) {
      setResult("Start with python server.py", "error");
      return null;
    }
    if (!res.ok) {
      setResult("Request failed (" + res.status + ")", "error");
      return null;
    }
    return res.json();
  }

  async function onCheck() {
    setResult("");
    const data = await callApi("/api/check", collectIncident());
    if (!data) return;
    renderMatches(data.matches || []);
  }

  async function onSave() {
    const incident = collectIncident();
    if (!incident.name && !incident.id) {
      setResult("Name is required to save a record.", "error");
      return;
    }
    const payload = { incident: incident };
    if (targetId) payload.target_id = targetId;
    const data = await callApi("/api/upsert", payload);
    if (!data) return;
    if (data.action === "rejected") {
      setResult("Rejected. Provide a name or choose a record to merge into.", "error");
      return;
    }
    const changed = (data.changes || []).join(", ") || "none";
    const name = (data.record && data.record.name) || "";
    if (data.action === "created") {
      setResult("Created " + name + ". Fields: " + changed, "ok");
    } else {
      setResult("Merged into " + name + ". Changed: " + changed, "ok");
    }
    window.dispatchEvent(new CustomEvent("worldwatch:reload"));
  }

  async function loadIncident(id) {
    try {
      const res = await fetch("data/incidents.json");
      if (!res.ok) return null;
      const db = await res.json();
      return (db.incidents || []).find((r) => r.id === id) || null;
    } catch (err) {
      return null;
    }
  }

  function hashId() {
    const m = location.hash.match(/id=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); onSave(); });

  if (openBtn) {
    openBtn.addEventListener("click", () => {
      resetForm();
      openPanel();
    });
  }
  if (closeBtn) closeBtn.addEventListener("click", closePanel);
  if (checkBtn) checkBtn.addEventListener("click", onCheck);
  if (saveBtn) saveBtn.addEventListener("click", onSave);
  if (updateBtn) {
    updateBtn.addEventListener("click", async () => {
      const id = hashId();
      const inc = id ? await loadIncident(id) : null;
      fillForm(inc);
      openPanel();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) {
      e.stopPropagation();
      closePanel();
    }
  }, true);
})();
