(function () {
  "use strict";

  const ISSUE_URL = "https://github.com/Wolfsborg/worldwatcher/issues/new";
  const panel = document.getElementById("report");
  const form = document.getElementById("report-form");
  const about = document.getElementById("report-about");
  const target = document.getElementById("report-target");
  const result = document.getElementById("report-result");
  const openBtn = document.getElementById("report-open");
  const closeBtn = document.getElementById("report-close");
  const sendBtn = document.getElementById("report-send");
  const detailBtn = document.getElementById("detail-report");
  if (!panel || !form) return;

  let incidentId = "";

  function openReport(prefill) {
    incidentId = (prefill && prefill.id) || "";
    about.value = prefill && prefill.label ? prefill.label : "";
    if (form.elements.wrong && prefill && prefill.wrong) form.elements.wrong.value = prefill.wrong;
    if (form.elements.correction && prefill && prefill.correction) form.elements.correction.value = prefill.correction;
    if (target) {
      if (prefill && prefill.label) {
        target.hidden = false;
        target.textContent = "About: " + prefill.label;
      } else {
        target.hidden = true;
        target.textContent = "";
      }
    }
    result.hidden = true;
    panel.hidden = false;
    form.elements.wrong.focus();
  }

  function closeReport() {
    panel.hidden = true;
  }

  function currentIncident() {
    const hash = location.hash.match(/id=([^&]+)/);
    const id = hash ? decodeURIComponent(hash[1]) : incidentId;
    const name = about.value || id || "unspecified incident";
    return { id: id, name: name };
  }

  function send() {
    if (!form.reportValidity()) return;
    const inc = currentIncident();
    const wrong = form.elements.wrong.value.trim();
    const correction = form.elements.correction.value.trim();
    const source = form.elements.source.value.trim();
    const title = "Correction: " + inc.name;
    const body = [
      "This is a correction report. It should not be applied automatically.",
      "",
      "Incident ID: " + (inc.id || "(none selected)"),
      "Incident: " + inc.name,
      "",
      "What is wrong:",
      wrong,
      "",
      "Suggested correction:",
      correction,
      "",
      "Source: " + (source || "(none)"),
    ].join("\n");
    const url = ISSUE_URL + "?title=" + encodeURIComponent(title) + "&body=" + encodeURIComponent(body);
    window.open(url, "_blank", "noopener,noreferrer");
    result.hidden = false;
    result.className = "maintain-result is-ok";
    result.textContent = "Opened a correction report. Nothing in the public database was changed.";
  }

  if (openBtn) openBtn.addEventListener("click", () => openReport(null));
  if (closeBtn) closeBtn.addEventListener("click", closeReport);
  if (sendBtn) sendBtn.addEventListener("click", send);
  if (detailBtn) {
    detailBtn.addEventListener("click", () => {
      const title = document.getElementById("detail-title");
      const hash = location.hash.match(/id=([^&]+)/);
      openReport({
        id: hash ? decodeURIComponent(hash[1]) : "",
        label: title ? title.textContent : "",
      });
    });
  }
  window.addEventListener("worldwatch:report", (e) => openReport(e.detail || {}));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) closeReport();
  });
})();
