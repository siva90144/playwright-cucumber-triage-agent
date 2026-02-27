import fs from "node:fs";
import streamChain from "stream-chain";
import streamJson from "stream-json";
import StreamArray from "stream-json/streamers/StreamArray";

export type CucumberFailure = {
  featureName?: string;
  scenarioName: string;
  uri?: string;
  line?: number;
  stepName?: string;
  stepKeyword?: string;
  status: string;
  durationNs?: number;
  errorMessage?: string;
};

function s(v: any): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/**
 * Streaming extraction of failed steps from a Cucumber JSON report.
 * Designed for large reports (e.g., 35MB+) without JSON.parse of entire file.
 *
 * Assumes top-level JSON is an array of "feature" objects (common cucumber-json format).
 */
export async function extractFailuresStreaming(filePath: string, maxFailures = 500): Promise<CucumberFailure[]> {
  const failures: CucumberFailure[] = [];

  const pipeline = streamChain.chain([
    fs.createReadStream(filePath),
    streamJson.parser(),
    StreamArray.streamArray()
  ]);

  pipeline.on("data", ({ value }: { value: any }) => {
    if (failures.length >= maxFailures) {
      // stop early; likely meltdown
      pipeline.destroy();
      return;
    }

    const featureName = s(value?.name);
    const uri = s(value?.uri) ?? s(value?.path);

    const elements = Array.isArray(value?.elements) ? value.elements : (Array.isArray(value?.scenarios) ? value.scenarios : []);

    for (const el of elements) {
      const scenarioName = s(el?.name) ?? "Unknown scenario";
      const line = typeof el?.line === "number" ? el.line : undefined;

      const steps = Array.isArray(el?.steps) ? el.steps : [];
      for (const st of steps) {
        const result = st?.result ?? st?.match?.result ?? {};
        const status = s(result?.status) ?? s(st?.status) ?? "unknown";

        if (status === "failed" || status === "ambiguous" || status === "undefined") {
          const errorMessage = s(result?.error_message) ?? s(st?.error_message) ?? s(result?.message);
          failures.push({
            featureName,
            scenarioName,
            uri,
            line,
            stepName: s(st?.name),
            stepKeyword: s(st?.keyword),
            status,
            durationNs: typeof result?.duration === "number" ? result.duration : undefined,
            errorMessage
          });
          if (failures.length >= maxFailures) {
            pipeline.destroy();
            return;
          }
        }
      }
    }
  });

  return await new Promise((resolve, reject) => {
    let settled = false;
    const resolveOnce = () => {
      if (settled) return;
      settled = true;
      resolve(dedupe(failures));
    };
    const rejectOnce = (err: unknown) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    pipeline.on("end", resolveOnce);
    pipeline.on("error", rejectOnce);
    pipeline.on("close", resolveOnce); // in case we destroy early
  });
}

function dedupe(items: CucumberFailure[]): CucumberFailure[] {
  const seen = new Set<string>();
  const out: CucumberFailure[] = [];
  for (const f of items) {
    const key = `${f.uri ?? ""}:${f.line ?? ""}:${f.scenarioName}:${f.stepName ?? ""}:${(f.errorMessage ?? "").split("\n")[0]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}
