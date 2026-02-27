import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { writeHtmlReport } from "../src/html_report.js";
import type { ScenarioTriageRecord } from "../src/types.js";

test("writeHtmlReport writes business-readable HTML with escaped values", () => {
  const outPath = path.join(os.tmpdir(), `triage-report-${Date.now()}.html`);
  const records: ScenarioTriageRecord[] = [
    {
      feature: "Feature <A>",
      scenario: "Scenario & one",
      step: "Then",
      location: "feature.file:10",
      category: "TEST_BUG",
      confidence: 0.72,
      fingerprint: "abc123",
      topError: "Expected <x> to equal y",
      evidence: [{ kind: "HEURISTIC", message: "m" }],
      suggestedFix: ["Use stable locator"],
      jiraDraft: {
        projectKey: "E2E",
        issueType: "Bug",
        summary: "s",
        description: "d",
        labels: []
      }
    }
  ];

  try {
    writeHtmlReport(outPath, records, { repo: "repo-1", environment: "staging" });
    const html = fs.readFileSync(outPath, "utf-8");
    assert.match(html, /Playwright \+ Cucumber Failure Triage Report/);
    assert.match(html, /Feature &lt;A&gt;/);
    assert.match(html, /Scenario &amp; one/);
    assert.match(html, /Recommended Action Plan/);
  } finally {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  }
});
