import { classifyFailure } from "./classify.js";
import { suggestFixes } from "./suggest.js";
import { fingerprintFailure } from "./fingerprints.js";
import { buildJiraDraft } from "./jira.js";
import type { ScenarioTriageRecord, RunContext } from "./types.js";
import type { ArtifactIndex } from "./load_artifacts.js";
import type { CucumberFailure } from "./cucumber_stream.js";

function firstLine(s?: string, max = 160): string {
  const line = (s ?? "").split("\n")[0] ?? "";
  return line.length > max ? line.slice(0, max - 1) + "…" : line;
}

function shortenForClassification(s: string, max = 12_000): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n...[truncated ${s.length - max} chars]`;
}

function extractRelevantConsole(consoleLog: string | undefined, scenario: string, errors: string[]): string {
  if (!consoleLog) return "";
  const lines = consoleLog.split(/\r?\n/);
  if (!lines.length) return "";

  const keywords = new Set<string>();
  for (const token of scenario.split(/\W+/)) {
    if (token.length >= 4) keywords.add(token.toLowerCase());
  }
  for (const e of errors) {
    for (const token of e.split(/\W+/)) {
      if (token.length >= 5) keywords.add(token.toLowerCase());
    }
  }

  let selected: string[] = [];
  if (keywords.size) {
    selected = lines.filter(line => {
      const lower = line.toLowerCase();
      for (const k of keywords) {
        if (lower.includes(k)) return true;
      }
      return false;
    });
  }

  if (!selected.length) {
    selected = lines.slice(-120);
  } else if (selected.length > 120) {
    selected = selected.slice(0, 120);
  }

  return shortenForClassification(selected.join("\n"));
}

export function triageFailuresPerScenario(args: {
  failures: CucumberFailure[];
  runFailureCount: number;
  consoleLog?: string;
  context: RunContext;
  jiraProjectKey: string;
  jiraIssueType: string;
  artifacts: ArtifactIndex;
}): ScenarioTriageRecord[] {
  const { failures, runFailureCount, consoleLog, context, jiraProjectKey, jiraIssueType, artifacts } = args;

  // Group by scenario identity (feature+scenario+uri+line)
  const groups = new Map<string, CucumberFailure[]>();
  for (const f of failures) {
    const key = `${f.uri ?? ""}:${f.line ?? ""}::${f.featureName ?? ""}::${f.scenarioName}`;
    const arr = groups.get(key) ?? [];
    arr.push(f);
    groups.set(key, arr);
  }

  const out: ScenarioTriageRecord[] = [];

  for (const items of groups.values()) {
    const any = items[0]!;
    const feature = any.featureName ?? "Feature";
    const scenario = any.scenarioName ?? "Scenario";
    const step = `${any.stepKeyword ?? ""}${any.stepName ?? ""}`.trim();
    const location = [any.uri, any.line].filter(Boolean).join(":") || "";

    const stepErrors = items.map(it => {
      const st = `${it.stepKeyword ?? ""}${it.stepName ?? ""}`.trim();
      return `STEP: ${st}\nSTATUS: ${it.status}\nERROR:\n${it.errorMessage ?? ""}`;
    }).join("\n\n---\n\n");

    const consoleContext = extractRelevantConsole(consoleLog, scenario, items.map(i => i.errorMessage ?? ""));
    const blob = `FEATURE: ${feature}\nSCENARIO: ${scenario}\nLOC: ${location}\n\n${stepErrors}\n\n==== CONSOLE ====\n${consoleContext}`;

    const cls = classifyFailure(blob, runFailureCount);
    const topError = firstLine(items.find(i => i.errorMessage)?.errorMessage);

    const fp = fingerprintFailure([cls.category, feature, scenario, topError, location]);

    const suggested = suggestFixes(cls.category, blob);

    const jiraDraft = buildJiraDraft({
      projectKey: jiraProjectKey,
      issueType: jiraIssueType,
      category: cls.category,
      confidence: cls.confidence,
      fingerprint: fp,
      feature,
      scenario,
      step,
      location,
      topErrorSnippet: (items.find(i => i.errorMessage)?.errorMessage ?? "").slice(0, 1500),
      suggestedFixes: suggested,
      context,
      artifacts
    });

    out.push({
      feature,
      scenario,
      step,
      location,
      category: cls.category,
      confidence: Number(cls.confidence.toFixed(2)),
      fingerprint: fp,
      topError,
      evidence: cls.evidence,
      suggestedFix: suggested,
      jiraDraft
    });
  }

  out.sort((a, b) => b.confidence - a.confidence || a.category.localeCompare(b.category) || a.scenario.localeCompare(b.scenario));
  return out;
}
