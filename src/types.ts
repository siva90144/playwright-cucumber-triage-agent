export type RootCauseCategory =
  | "PRODUCT_REGRESSION"
  | "TEST_BUG"
  | "FLAKE"
  | "ENV_DEPENDENCY"
  | "INFRA"
  | "PERFORMANCE_TIMEOUT"
  | "DATA_STATE"
  | "UNKNOWN";

export type Evidence = {
  kind: "STACK" | "CONSOLE" | "REPORT" | "TRACE" | "HEURISTIC";
  message: string;
};

export type RunContext = {
  repo?: string;
  workflowUrl?: string;
  runId?: string;
  commitSha?: string;
  branch?: string;
  prNumber?: string;
  baseUrl?: string;
  browser?: string;
  environment?: string;
};

export type JiraDraft = {
  projectKey: string;
  issueType: string; // Bug / Task
  summary: string;
  description: string; // Atlassian wiki/markdown-ish
  labels: string[];
  components?: string[];
  priority?: string;
};

export type ScenarioTriageRecord = {
  feature: string;
  scenario: string;
  step: string;
  location: string;
  category: RootCauseCategory;
  confidence: number; // 0..1
  fingerprint: string;
  topError: string;
  evidence: Evidence[];
  suggestedFix: string[];
  jiraDraft: JiraDraft;
};

export type Inputs = {
  cucumberJsonPath: string;
  consoleLogPath?: string;
  artifactsDir?: string;

  runContext: RunContext;

  jiraProjectKey: string;
  jiraIssueType: string;

  approve: boolean;
  outJsonPath?: string; // emit a machine-readable run record
  htmlOutPath?: string; // write business-friendly HTML report
};
