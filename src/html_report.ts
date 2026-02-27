import fs from "node:fs";
import type { RunContext, ScenarioTriageRecord } from "./types.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return "High";
  if (confidence >= 0.55) return "Medium";
  return "Low";
}

function confidenceClass(confidence: number): string {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.55) return "medium";
  return "low";
}

function categoryClass(category: string): string {
  const token = category.toLowerCase();
  if (token.includes("timeout")) return "cat-timeout";
  if (token.includes("env")) return "cat-env";
  if (token.includes("infra")) return "cat-infra";
  if (token.includes("test_bug")) return "cat-test";
  if (token.includes("regression")) return "cat-regression";
  if (token.includes("flake")) return "cat-flake";
  return "cat-neutral";
}

function categoryRows(records: ScenarioTriageRecord[]): Array<{ category: string; count: number; pct: string }> {
  const total = Math.max(records.length, 1);
  const counts = new Map<string, number>();
  for (const rec of records) {
    counts.set(rec.category, (counts.get(rec.category) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({
      category,
      count,
      pct: `${Math.round((count / total) * 100)}%`
    }));
}

function topActionItems(records: ScenarioTriageRecord[], maxItems = 8): string[] {
  const seen = new Set<string>();
  const actions: string[] = [];
  for (const rec of records) {
    const action = rec.suggestedFix[0];
    if (!action || seen.has(action)) continue;
    seen.add(action);
    actions.push(action);
    if (actions.length >= maxItems) break;
  }
  return actions;
}

function contextRows(context: RunContext): Array<[string, string]> {
  const items: Array<[string, string | undefined]> = [
    ["Repository", context.repo],
    ["Branch", context.branch],
    ["Commit", context.commitSha],
    ["Pull Request", context.prNumber],
    ["Environment", context.environment],
    ["Base URL", context.baseUrl],
    ["Workflow URL", context.workflowUrl],
  ];
  return items.filter((x): x is [string, string] => Boolean(x[1]));
}

export function writeHtmlReport(path: string, records: ScenarioTriageRecord[], context: RunContext): void {
  const totalFailures = records.length;
  const topCategory = categoryRows(records)[0]?.category ?? "UNKNOWN";
  const highConfidence = records.filter(r => r.confidence >= 0.8).length;
  const mediumConfidence = records.filter(r => r.confidence >= 0.55 && r.confidence < 0.8).length;
  const lowConfidence = records.filter(r => r.confidence < 0.55).length;
  const categories = categoryRows(records);
  const actions = topActionItems(records);
  const contextPairs = contextRows(context);
  const categoryOptions = categories.map(row => row.category);
  const generatedAt = new Date().toISOString();

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>E2E Triage Report</title>
  <style>
    :root {
      --bg: #f4f7fb;
      --card: #ffffff;
      --text: #0f172a;
      --muted: #475569;
      --border: #dbe3ef;
      --accent: #2563eb;
      --accent-soft: #e8f0ff;
      --shadow: 0 10px 30px rgba(2, 6, 23, 0.06);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.4;
    }
    .container { max-width: 1280px; margin: 24px auto; padding: 0 16px 32px; }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 14px;
      box-shadow: var(--shadow);
    }
    h1, h2, h3 { margin: 0 0 10px; letter-spacing: -0.01em; }
    h1 { font-size: 24px; }
    h2 { font-size: 18px; margin-top: 4px; color: #0b3a78; }
    h3 { font-size: 15px; }
    .meta { color: var(--muted); font-size: 13px; }
    .hero {
      background: linear-gradient(135deg, #0f3a7d 0%, #1d4ed8 65%, #2563eb 100%);
      color: #f8fbff;
      border: none;
    }
    .hero .meta { color: #dbeafe; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
      margin-top: 12px;
    }
    .metric {
      border: 1px solid #cfdcf8;
      border-radius: 10px;
      padding: 12px;
      background: #f9fbff;
    }
    .hero .metric {
      border-color: rgba(255, 255, 255, 0.3);
      background: rgba(255, 255, 255, 0.16);
      backdrop-filter: blur(2px);
    }
    .metric .label { color: #385175; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
    .hero .metric .label { color: #dbeafe; }
    .metric .value {
      font-size: clamp(18px, 2vw, 22px);
      font-weight: 800;
      margin-top: 3px;
      line-height: 1.15;
      overflow-wrap: anywhere;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      text-align: left;
      border-bottom: 1px solid var(--border);
      padding: 10px 10px;
      vertical-align: top;
    }
    th {
      background: #eef3fb;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #334155;
    }
    .scroll th {
      position: sticky;
      top: 0;
      z-index: 1;
    }
    tr:hover td { background: #f8fbff; }
    tbody tr:nth-child(even) td { background: #fcfdff; }
    .scroll {
      overflow: auto;
      max-height: 540px;
      border: 1px solid var(--border);
      border-radius: 10px;
    }
    .badge {
      display: inline-block;
      border-radius: 999px;
      padding: 3px 9px;
      font-size: 11px;
      font-weight: 700;
      border: 1px solid transparent;
      letter-spacing: 0.02em;
    }
    .cat-timeout { background: #fff7ed; color: #9a3412; border-color: #fed7aa; }
    .cat-env { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
    .cat-infra { background: #f5f3ff; color: #6d28d9; border-color: #ddd6fe; }
    .cat-test { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }
    .cat-regression { background: #fff1f2; color: #be123c; border-color: #fecdd3; }
    .cat-flake { background: #fefce8; color: #854d0e; border-color: #fef08a; }
    .cat-neutral { background: #f8fafc; color: #334155; border-color: #cbd5e1; }
    .confidence {
      font-weight: 700;
      border-radius: 7px;
      padding: 2px 7px;
      display: inline-block;
      border: 1px solid transparent;
    }
    .confidence.high { background: #ecfdf3; color: #166534; border-color: #bbf7d0; }
    .confidence.medium { background: #fffbeb; color: #92400e; border-color: #fde68a; }
    .confidence.low { background: #fff1f2; color: #9f1239; border-color: #fecdd3; }
    code {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 1px 6px;
    }
    .muted { color: var(--muted); }
    ul { margin: 8px 0 0; padding-left: 18px; }
    li { margin-bottom: 6px; }
    .two-col {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 14px;
    }
    .kpi-note {
      margin-top: 10px;
      font-size: 12px;
      color: #dbeafe;
    }
    .footer-note {
      text-align: center;
      color: #64748b;
      font-size: 12px;
      margin-top: 8px;
    }
    .tab-shell {
      margin: 14px 0;
      position: sticky;
      top: 8px;
      z-index: 5;
    }
    .tab-bar {
      display: inline-flex;
      gap: 6px;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 6px;
      background: #ffffffd9;
      backdrop-filter: blur(4px);
      box-shadow: var(--shadow);
    }
    .tab-btn {
      appearance: none;
      border: 1px solid transparent;
      background: transparent;
      color: #334155;
      font-weight: 700;
      font-size: 13px;
      border-radius: 10px;
      padding: 8px 12px;
      cursor: pointer;
    }
    .tab-btn:hover { background: #f1f5f9; }
    .tab-btn.active {
      background: var(--accent-soft);
      color: #1d4ed8;
      border-color: #bfdbfe;
    }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }
    .filters {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr auto;
      gap: 10px;
      margin: 10px 0 14px;
      align-items: end;
    }
    .filter-item label {
      display: block;
      font-size: 12px;
      color: #334155;
      font-weight: 700;
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .filter-item input,
    .filter-item select {
      width: 100%;
      border: 1px solid #cfd8e7;
      border-radius: 10px;
      padding: 10px 11px;
      font-size: 13px;
      color: #0f172a;
      background: #ffffff;
      outline: none;
    }
    .filter-item input:focus,
    .filter-item select:focus {
      border-color: #93c5fd;
      box-shadow: 0 0 0 3px #dbeafe;
    }
    .btn-reset {
      border: 1px solid #cfd8e7;
      border-radius: 10px;
      padding: 10px 12px;
      background: #fff;
      color: #1e293b;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-reset:hover { background: #f8fafc; }
    .details-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 6px;
    }
    .details-count {
      color: #334155;
      font-size: 12px;
      font-weight: 700;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 999px;
      padding: 5px 10px;
    }
    .empty-row td {
      text-align: center;
      color: #64748b;
      padding: 18px;
      font-style: italic;
      background: #fff;
    }
    .details-table {
      table-layout: fixed;
    }
    .details-table th:nth-child(1), .details-table td:nth-child(1) { width: 56px; text-align: center; }
    .details-table th:nth-child(4), .details-table td:nth-child(4) { width: 160px; text-align: center; }
    .details-table th:nth-child(5), .details-table td:nth-child(5) { width: 170px; text-align: center; }
    .details-table th:nth-child(8), .details-table td:nth-child(8) { width: 170px; text-align: center; }
    .details-table td:nth-child(6) { word-break: break-word; }
    .summary-table th:nth-child(2),
    .summary-table th:nth-child(3),
    .summary-table td:nth-child(2),
    .summary-table td:nth-child(3) {
      text-align: right;
    }
    .context-table th {
      width: 180px;
      text-transform: none;
      letter-spacing: 0;
      font-size: 13px;
      color: #1e3a8a;
      background: #f8fbff;
    }
    .context-table td {
      word-break: break-word;
    }
    @media print {
      body { background: #ffffff; }
      .card { box-shadow: none; break-inside: avoid; }
      .scroll { max-height: none; overflow: visible; }
      th { position: static; }
      .tab-shell { display: none; }
      .tab-panel { display: block !important; }
      .filters, .details-count, .btn-reset { display: none !important; }
    }
    @media (max-width: 900px) {
      .two-col { grid-template-columns: 1fr; }
      .filters { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <section class="card hero">
      <h1>Playwright + Cucumber Failure Triage Report</h1>
      <div class="meta">Generated at ${escapeHtml(generatedAt)}</div>
      <div class="grid">
        <div class="metric"><div class="label">Failed Scenarios</div><div class="value">${totalFailures}</div></div>
        <div class="metric"><div class="label">Top Category</div><div class="value">${escapeHtml(topCategory)}</div></div>
        <div class="metric"><div class="label">High Confidence</div><div class="value">${highConfidence}</div></div>
        <div class="metric"><div class="label">Medium Confidence</div><div class="value">${mediumConfidence}</div></div>
        <div class="metric"><div class="label">Low Confidence</div><div class="value">${lowConfidence}</div></div>
      </div>
      <div class="kpi-note">Designed for business and engineering review: where failures cluster, why they likely happened, and what to do next.</div>
    </section>

    <div class="tab-shell">
      <div class="tab-bar" role="tablist" aria-label="Report sections">
        <button class="tab-btn active" id="tab-summary-btn" role="tab" aria-selected="true" aria-controls="tab-summary" data-tab="summary">Summary</button>
        <button class="tab-btn" id="tab-details-btn" role="tab" aria-selected="false" aria-controls="tab-details" data-tab="details">Failed Scenario Details</button>
      </div>
    </div>

    <section id="tab-summary" class="tab-panel active" role="tabpanel" aria-labelledby="tab-summary-btn">
      <section class="card">
        <h2>Business Summary</h2>
        <p class="muted">
          This report groups failed scenarios into likely root causes and provides recommended next actions.
          Focus first on categories with the highest count and scenarios with higher confidence.
        </p>
        <div class="two-col">
          <div>
            <h3>Category Breakdown</h3>
            <table class="summary-table">
              <thead><tr><th>Category</th><th>Count</th><th>Share</th></tr></thead>
              <tbody>
                ${categories.map(row => `<tr><td><span class="badge ${categoryClass(row.category)}">${escapeHtml(row.category)}</span></td><td>${row.count}</td><td>${row.pct}</td></tr>`).join("")}
              </tbody>
            </table>
          </div>
          <div>
            <h3>Recommended Action Plan</h3>
            <ul>
              ${actions.map(a => `<li>${escapeHtml(a)}</li>`).join("")}
            </ul>
            <h3 style="margin-top: 14px;">Confidence Guide</h3>
            <ul>
              <li><strong>High</strong>: likely accurate categorization, prioritize immediately.</li>
              <li><strong>Medium</strong>: likely directionally correct, validate with traces/logs.</li>
              <li><strong>Low</strong>: needs human review before assigning ownership.</li>
            </ul>
          </div>
        </div>
    </section>
      <section class="card">
        <h2>Run Context</h2>
        ${contextPairs.length
          ? `<table class="context-table"><tbody>${contextPairs.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`).join("")}</tbody></table>`
          : `<p class="muted">No run context metadata was provided.</p>`
        }
      </section>
    </section>

    <section id="tab-details" class="tab-panel" role="tabpanel" aria-labelledby="tab-details-btn">
      <section class="card">
        <div class="details-head">
          <h2>Failed Scenario Details</h2>
          <div id="details-count" class="details-count">Showing ${records.length} of ${records.length} scenarios</div>
        </div>
        <div class="filters">
          <div class="filter-item">
            <label for="filter-search">Search</label>
            <input id="filter-search" type="text" placeholder="Feature, scenario, error, location, fingerprint..." />
          </div>
          <div class="filter-item">
            <label for="filter-category">Category</label>
            <select id="filter-category">
              <option value="all">All Categories</option>
              ${categoryOptions.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}
            </select>
          </div>
          <div class="filter-item">
            <label for="filter-confidence">Confidence</label>
            <select id="filter-confidence">
              <option value="all">All Levels</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <button id="filter-reset" class="btn-reset" type="button">Reset Filters</button>
        </div>
        <div class="scroll">
          <table class="details-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Feature</th>
                <th>Scenario</th>
                <th>Category</th>
                <th>Confidence</th>
                <th>Top Error</th>
                <th>Location</th>
                <th>Fingerprint</th>
              </tr>
            </thead>
            <tbody id="details-tbody">
              ${records.map((r, idx) => `
                <tr class="detail-row"
                    data-category="${escapeHtml(r.category)}"
                    data-confidence="${confidenceClass(r.confidence)}"
                    data-search="${escapeHtml(`${r.feature} ${r.scenario} ${r.topError || ""} ${r.location} ${r.fingerprint}`.toLowerCase())}">
                  <td>${idx + 1}</td>
                  <td>${escapeHtml(r.feature)}</td>
                  <td>${escapeHtml(r.scenario)}</td>
                  <td><span class="badge ${categoryClass(r.category)}">${escapeHtml(r.category)}</span></td>
                  <td><span class="confidence ${confidenceClass(r.confidence)}">${Math.round(r.confidence * 100)}% (${confidenceLabel(r.confidence)})</span></td>
                  <td>${escapeHtml(r.topError || "N/A")}</td>
                  <td>${escapeHtml(r.location)}</td>
                  <td><code>${escapeHtml(r.fingerprint)}</code></td>
                </tr>
              `).join("")}
              <tr id="details-empty" class="empty-row" style="display:none;">
                <td colspan="8">No scenarios match the selected filters.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>

    <div class="footer-note">Generated by PW Cucumber Triage Agent</div>
  </div>
  <script>
    (function () {
      var buttons = Array.prototype.slice.call(document.querySelectorAll('.tab-btn'));
      var panels = Array.prototype.slice.call(document.querySelectorAll('.tab-panel'));
      function activate(tab) {
        buttons.forEach(function (btn) {
          var selected = btn.getAttribute('data-tab') === tab;
          btn.classList.toggle('active', selected);
          btn.setAttribute('aria-selected', selected ? 'true' : 'false');
        });
        panels.forEach(function (panel) {
          var selected = panel.id === 'tab-' + tab;
          panel.classList.toggle('active', selected);
        });
      }
      buttons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var tab = btn.getAttribute('data-tab');
          if (tab) activate(tab);
        });
      });

      var searchInput = document.getElementById('filter-search');
      var categorySelect = document.getElementById('filter-category');
      var confidenceSelect = document.getElementById('filter-confidence');
      var resetButton = document.getElementById('filter-reset');
      var detailsCount = document.getElementById('details-count');
      var emptyRow = document.getElementById('details-empty');
      var rows = Array.prototype.slice.call(document.querySelectorAll('#details-tbody .detail-row'));
      var totalRows = rows.length;

      function applyFilters() {
        var search = (searchInput && searchInput.value ? searchInput.value : '').toLowerCase().trim();
        var category = categorySelect && categorySelect.value ? categorySelect.value : 'all';
        var confidence = confidenceSelect && confidenceSelect.value ? confidenceSelect.value : 'all';
        var visible = 0;

        rows.forEach(function (row) {
          var rowCategory = row.getAttribute('data-category') || '';
          var rowConfidence = row.getAttribute('data-confidence') || '';
          var rowSearch = row.getAttribute('data-search') || '';
          var matchesSearch = !search || rowSearch.indexOf(search) !== -1;
          var matchesCategory = category === 'all' || rowCategory === category;
          var matchesConfidence = confidence === 'all' || rowConfidence === confidence;
          var isVisible = matchesSearch && matchesCategory && matchesConfidence;
          row.style.display = isVisible ? '' : 'none';
          if (isVisible) visible += 1;
        });

        if (detailsCount) {
          detailsCount.textContent = 'Showing ' + visible + ' of ' + totalRows + ' scenarios';
        }
        if (emptyRow) {
          emptyRow.style.display = visible === 0 ? '' : 'none';
        }
      }

      if (searchInput) searchInput.addEventListener('input', applyFilters);
      if (categorySelect) categorySelect.addEventListener('change', applyFilters);
      if (confidenceSelect) confidenceSelect.addEventListener('change', applyFilters);
      if (resetButton) {
        resetButton.addEventListener('click', function () {
          if (searchInput) searchInput.value = '';
          if (categorySelect) categorySelect.value = 'all';
          if (confidenceSelect) confidenceSelect.value = 'all';
          applyFilters();
        });
      }

      applyFilters();
    })();
  </script>
</body>
</html>`;

  fs.writeFileSync(path, html, "utf-8");
}
