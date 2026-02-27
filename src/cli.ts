#!/usr/bin/env node
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";

import type { Inputs } from "./types.js";
import { extractFailuresStreaming } from "./cucumber_stream.js";
import { indexArtifacts } from "./load_artifacts.js";
import { triageFailuresPerScenario } from "./triage_per_scenario.js";
import { renderTable } from "./table.js";
import { writeEvalRunRecord } from "./eval.js";
import { parseMaxFailuresOption } from "./cli_options.js";
import { writeHtmlReport } from "./html_report.js";

function readTextIfExists(p?: string): string | undefined {
  if (!p) return undefined;
  if (!fs.existsSync(p)) return undefined;
  return fs.readFileSync(p, "utf-8");
}

function categorySummary(records: Array<{ category: string }>) {
  const total = records.length || 1;
  const counts = new Map<string, number>();
  for (const r of records) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  const rows = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cat, n]) => ({ category: cat, count: String(n), pct: `${Math.round((n / total) * 100)}%` }));
  return rows;
}

async function main() {
  const program = new Command();
  program
    .name("pw-triage")
    .description("Cucumber JSON + Playwright artifacts failure triage agent (per-scenario categories + tables + Jira draft)")
    .requiredOption("--cucumberJson <path>", "Path to cucumber.json")
    .option("--console <path>", "Path to console log text")
    .option("--artifacts <dir>", "Artifacts directory (screenshots/videos/traces)")
    .option("--maxFailures <n>", "Stop after N failures (default 500)", "500")

    .option("--repo <name>", "Repo name")
    .option("--workflowUrl <url>", "CI run URL")
    .option("--commit <sha>", "Commit SHA")
    .option("--branch <name>", "Branch")
    .option("--pr <num>", "PR number")
    .option("--env <name>", "Environment name")
    .option("--baseUrl <url>", "Base URL")

    .option("--jiraProject <key>", "Jira project key", "E2E")
    .option("--jiraType <type>", "Jira issue type", "Bug")

    .option("--approve", "Human approval gate to allow ticket submission (this project outputs drafts only)", false)
    .option("--out <path>", "Write eval run record JSON to this file")
    .option("--html <path>", "Write business-friendly HTML report to this file")
    .parse(process.argv);

  const opts = program.opts();

  const inputs: Inputs = {
    cucumberJsonPath: opts.cucumberJson,
    consoleLogPath: opts.console,
    artifactsDir: opts.artifacts,
    runContext: {
      repo: opts.repo,
      workflowUrl: opts.workflowUrl,
      commitSha: opts.commit,
      branch: opts.branch,
      prNumber: opts.pr,
      environment: opts.env,
      baseUrl: opts.baseUrl
    },
    jiraProjectKey: opts.jiraProject,
    jiraIssueType: opts.jiraType,
    approve: Boolean(opts.approve),
    outJsonPath: opts.out,
    htmlOutPath: opts.html
  };

  if (!fs.existsSync(inputs.cucumberJsonPath)) {
    throw new Error(`Cucumber JSON not found: ${inputs.cucumberJsonPath}`);
  }
  const maxFailures = parseMaxFailuresOption(opts.maxFailures, 500);

  const consoleLog = readTextIfExists(inputs.consoleLogPath);
  const artifacts = indexArtifacts(inputs.artifactsDir);

  const failures = await extractFailuresStreaming(inputs.cucumberJsonPath, maxFailures);

  if (!failures.length) {
    console.log("No failed scenarios found in cucumber JSON.");
    process.exit(0);
  }

  const records = triageFailuresPerScenario({
    failures,
    runFailureCount: failures.length,
    consoleLog,
    context: inputs.runContext,
    jiraProjectKey: inputs.jiraProjectKey,
    jiraIssueType: inputs.jiraIssueType,
    artifacts
  });

  console.log("\n=== Failure Categories (Summary) ===");
  console.log(renderTable(categorySummary(records), [
    { key: "category", label: "Category", width: 22 },
    { key: "count", label: "Count", width: 7 },
    { key: "pct", label: "%", width: 6 },
  ]));

  console.log("\n=== Failed Scenarios (Details) ===");
  const detailRows = records.map((r, idx) => ({
    "#": String(idx + 1),
    "Feature": r.feature,
    "Scenario": r.scenario,
    "Step": r.step,
    "Location": r.location,
    "Category": r.category,
    "Conf": `${Math.round(r.confidence * 100)}%`,
    "FP": r.fingerprint,
    "Top error": r.topError
  }));

  console.log(renderTable(detailRows, [
    { key: "#", label: "#", width: 3 },
    { key: "Feature", label: "Feature", width: 18 },
    { key: "Scenario", label: "Scenario", width: 30 },
    { key: "Step", label: "Step", width: 24 },
    { key: "Location", label: "Location", width: 22 },
    { key: "Category", label: "Category", width: 18 },
    { key: "Conf", label: "Conf", width: 6 },
    { key: "FP", label: "FP", width: 10 },
    { key: "Top error", label: "Top error", width: 40 },
  ]));

  console.log("\n=== Suggested Fixes (Top 1 per scenario) ===");
  for (const r of records.slice(0, 15)) {
    console.log(`- [${r.category} ${Math.round(r.confidence * 100)}%] ${r.feature} › ${r.scenario}: ${r.suggestedFix[0] ?? ""}`);
  }

  console.log("\n=== Jira Drafts (JSON) ===");
  const drafts = records.map(r => ({ fingerprint: r.fingerprint, category: r.category, confidence: r.confidence, jiraDraft: r.jiraDraft }));
  console.log(JSON.stringify(drafts, null, 2));

  if (inputs.outJsonPath) {
    writeEvalRunRecord(inputs.outJsonPath, inputs.runContext, records);
    console.log(`\nWrote eval run record: ${path.resolve(inputs.outJsonPath)}`);
  }

  if (inputs.htmlOutPath) {
    writeHtmlReport(inputs.htmlOutPath, records, inputs.runContext);
    console.log(`Wrote HTML report: ${path.resolve(inputs.htmlOutPath)}`);
  }

  if (!inputs.approve) {
    console.log("\nApproval gate: NOT approved. No tickets submitted (drafts only). Re-run with --approve to indicate approval intent.");
  } else {
    console.log("\nApproved: submission requested, but this project intentionally outputs drafts only. Wire Jira REST client to create issues.");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
