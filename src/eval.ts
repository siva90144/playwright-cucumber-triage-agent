import fs from "node:fs";
import type { RunContext, ScenarioTriageRecord } from "./types.js";

export type EvalRunRecord = {
  timestampIso: string;
  context: RunContext;
  results: Array<{
    fingerprint: string;
    feature: string;
    scenario: string;
    category: string;
    confidence: number;
    topError: string;
    location: string;
  }>;
};

export function writeEvalRunRecord(path: string, context: RunContext, records: ScenarioTriageRecord[]) {
  const rec: EvalRunRecord = {
    timestampIso: new Date().toISOString(),
    context,
    results: records.map(r => ({
      fingerprint: r.fingerprint,
      feature: r.feature,
      scenario: r.scenario,
      category: r.category,
      confidence: r.confidence,
      topError: r.topError,
      location: r.location
    }))
  };
  fs.writeFileSync(path, JSON.stringify(rec, null, 2));
}
