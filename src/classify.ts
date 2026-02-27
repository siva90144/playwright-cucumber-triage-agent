import type { Evidence, RootCauseCategory } from "./types.js";

type Classification = {
  category: RootCauseCategory;
  confidence: number;
  evidence: Evidence[];
};

const PATTERNS: Array<{
  category: RootCauseCategory;
  weight: number;
  regex: RegExp;
  evidenceKind: Evidence["kind"];
  note: string;
}> = [
  // Env / dependency
  { category: "ENV_DEPENDENCY", weight: 0.35, regex: /\b(503|502|504)\b|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|DNS/i, evidenceKind: "CONSOLE", note: "Network/dependency error pattern" },
  { category: "ENV_DEPENDENCY", weight: 0.25, regex: /\b(timeout|timed out)\b.*\b(connect|request|response)\b/i, evidenceKind: "CONSOLE", note: "Request/connect timeout pattern" },

  // Infra
  { category: "INFRA", weight: 0.35, regex: /browser has disconnected|Target closed|Protocol error|crash|Out of memory|ENOMEM/i, evidenceKind: "STACK", note: "Runner/browser instability pattern" },

  // Timeouts/perf
  { category: "PERFORMANCE_TIMEOUT", weight: 0.40, regex: /Timeout\s*\d*ms exceeded|Test timeout of \d+ms exceeded|waiting for .* timed out/i, evidenceKind: "STACK", note: "Timeout signature" },

  // Test bug (selectors / visibility / brittle assertions)
  { category: "TEST_BUG", weight: 0.40, regex: /strict mode violation|locator\(.+\) resolved to \d+ elements|Element is not attached|not visible|toBeVisible/i, evidenceKind: "STACK", note: "Locator/visibility/assertion brittleness signature" },

  // Product regression candidates (assertion mismatch without locator brittleness signatures)
  { category: "PRODUCT_REGRESSION", weight: 0.30, regex: /expected.+(to equal|to be|to contain)|received:.+expected:|assertionerror|expect\(received\)\./i, evidenceKind: "STACK", note: "Assertion mismatch pattern" },

  // Flake hints (transient/retry wording across runners and logs)
  { category: "FLAKE", weight: 0.30, regex: /\b(flaky|intermittent|transient)\b|retry(?:ing| #?\d+)/i, evidenceKind: "CONSOLE", note: "Flake/retry signature" },

  // Data / auth / state
  { category: "DATA_STATE", weight: 0.35, regex: /already exists|duplicate key|conflict|invalid state|not authorized|401|403/i, evidenceKind: "CONSOLE", note: "Auth/data/state pattern" },

  // Cucumber undefined / ambiguous steps
  { category: "TEST_BUG", weight: 0.35, regex: /Undefined\. Implement with the following snippet|Ambiguous match found/i, evidenceKind: "REPORT", note: "Undefined/ambiguous Cucumber step definition" },
];

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function classifyFailure(textBlob: string, runFailureCount: number): Classification {
  const scores: Record<RootCauseCategory, number> = {
    PRODUCT_REGRESSION: 0,
    TEST_BUG: 0,
    FLAKE: 0,
    ENV_DEPENDENCY: 0,
    INFRA: 0,
    PERFORMANCE_TIMEOUT: 0,
    DATA_STATE: 0,
    UNKNOWN: 0
  };

  const evidence: Evidence[] = [];

  for (const p of PATTERNS) {
    if (p.regex.test(textBlob)) {
      scores[p.category] += p.weight;
      evidence.push({ kind: p.evidenceKind, message: `${p.note} (${p.regex})` });
    }
  }

  // Many failures at once suggests env/infra issues
  if (runFailureCount >= 8) {
    scores.ENV_DEPENDENCY += 0.15;
    scores.INFRA += 0.15;
    evidence.push({ kind: "HEURISTIC", message: `Many failing scenarios in run (${runFailureCount}) suggests env/infra over isolated failures.` });
  }

  // If this is a pure expectation mismatch (without selector brittleness), bias toward regression.
  if (
    /expected.+(to equal|to be|to contain)|received:.+expected:|assertionerror|expect\(received\)\./i.test(textBlob) &&
    !/strict mode violation|locator\(.+\) resolved to \d+ elements|Element is not attached|not visible|toBeVisible/i.test(textBlob)
  ) {
    scores.PRODUCT_REGRESSION += 0.2;
    evidence.push({ kind: "HEURISTIC", message: "Expectation mismatch without locator instability is often product behavior drift." });
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topCat, topScore] = sorted[0] as [RootCauseCategory, number];
  const secondScore = sorted[1]?.[1] ?? 0;

  // Confidence: combine absolute score + separation gap
  const gap = topScore - secondScore;
  let confidence = clamp01(0.45 * topScore + 0.55 * clamp01(gap + 0.25));

  if (topScore < 0.15) {
    return {
      category: "UNKNOWN",
      confidence: 0.3,
      evidence: [{ kind: "HEURISTIC", message: "No strong pattern matched; needs human triage." }]
    };
  }

  // Assertion mismatch could be a regression; lower confidence slightly and add hint
  if (topCat === "TEST_BUG" && /Expected.*to equal|toContainText|toHaveText/i.test(textBlob) &&
      !/strict mode violation|locator\(.+\) resolved to \d+ elements/i.test(textBlob)) {
    evidence.push({ kind: "HEURISTIC", message: "Assertion mismatch could indicate a product regression; verify expected behavior vs recent changes." });
    confidence = clamp01(confidence - 0.1);
  }

  return { category: topCat, confidence, evidence };
}
