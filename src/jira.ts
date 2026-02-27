import type { ArtifactIndex } from "./load_artifacts.js";
import type { JiraDraft, RootCauseCategory, RunContext } from "./types.js";

export function buildJiraDraft(args: {
  projectKey: string;
  issueType: string;
  category: RootCauseCategory;
  confidence: number;
  fingerprint: string;
  feature: string;
  scenario: string;
  step?: string;
  location?: string;
  topErrorSnippet?: string;
  suggestedFixes: string[];
  context: RunContext;
  artifacts: ArtifactIndex;
}): JiraDraft {
  const {
    projectKey, issueType, category, confidence, fingerprint,
    feature, scenario, step, location, topErrorSnippet,
    suggestedFixes, context, artifacts
  } = args;

  const summary = `[E2E][Cucumber][Playwright] ${category} (${Math.round(confidence * 100)}%) • ${scenario} • ${fingerprint}`;

  const ctxLines = [
    context.repo && `- Repo: ${context.repo}`,
    context.branch && `- Branch: ${context.branch}`,
    context.commitSha && `- Commit: ${context.commitSha}`,
    context.prNumber && `- PR: ${context.prNumber}`,
    context.environment && `- Env: ${context.environment}`,
    context.baseUrl && `- Base URL: ${context.baseUrl}`,
    context.workflowUrl && `- CI Run: ${context.workflowUrl}`
  ].filter(Boolean);

  const artifactLines = [
    artifacts.traces.length ? `- Traces: ${artifacts.traces.slice(0, 5).join(", ")}${artifacts.traces.length > 5 ? " …" : ""}` : undefined,
    artifacts.screenshots.length ? `- Screenshots: ${artifacts.screenshots.slice(0, 5).join(", ")}${artifacts.screenshots.length > 5 ? " …" : ""}` : undefined,
    artifacts.videos.length ? `- Videos: ${artifacts.videos.slice(0, 5).join(", ")}${artifacts.videos.length > 5 ? " …" : ""}` : undefined
  ].filter(Boolean);

  const description = [
    `h2. Automated Triage`,
    `*Category:* ${category}`,
    `*Confidence:* ${Math.round(confidence * 100)}%`,
    `*Fingerprint:* ${fingerprint}`,
    ``,
    `h2. Failure`,
    `- *Feature:* ${feature}`,
    `- *Scenario:* ${scenario}`,
    step ? `- *Step:* ${step}` : undefined,
    location ? `- *Location:* ${location}` : undefined,
    ``,
    topErrorSnippet ? `h2. Top Error\n{code}\n${topErrorSnippet}\n{code}\n` : "",
    `h2. Suggested Fix`,
    ...suggestedFixes.map(s => `- ${s}`),
    ``,
    `h2. Run Context`,
    ...ctxLines,
    ``,
    artifactLines.length ? `h2. Artifacts\n${artifactLines.join("\n")}\n` : ""
  ].filter(Boolean).join("\n");

  const labels = ["playwright", "cucumber", "e2e", "triage-agent", category.toLowerCase(), `fp-${fingerprint}`];

  return {
    projectKey,
    issueType,
    summary,
    description,
    labels,
    priority: confidence >= 0.85 ? "High" : "Medium"
  };
}
