import type { RootCauseCategory } from "./types.js";

export function suggestFixes(category: RootCauseCategory, _blob: string): string[] {
  switch (category) {
    case "PERFORMANCE_TIMEOUT":
      return [
        "Use trace/timestamps to identify the slowest step; wait on a stable UI state (locator visible/enabled) rather than fixed sleeps.",
        "Prefer expect-based waits and correct navigation/load-state synchronization (e.g., await navigation, network idle where appropriate).",
        "If a downstream API is slow, isolate it in setup or add a lightweight health check to fail fast with a clear message."
      ];
    case "ENV_DEPENDENCY":
      return [
        "Confirm environment health (5xx/DNS/timeouts) and baseURL availability; check dependent service status.",
        "Add dependency health checks (fail fast) and route incidents to the owning service when environment is down.",
        "If transient errors are expected, add retry/backoff at the dependency boundary (not at UI assertions)."
      ];
    case "INFRA":
      return [
        "Check CI runner stability (memory/disk/CPU); reduce parallelism or shard differently if resources are constrained.",
        "Ensure Playwright + browser versions are pinned/consistent in CI; capture additional logs around crashes/disconnects.",
        "If browser disconnects frequently, consider reducing video/trace overhead or increasing runner resources."
      ];
    case "DATA_STATE":
      return [
        "Make test data unique per run and ensure teardown is idempotent; avoid shared mutable accounts/state.",
        "Refresh auth/session state reliably; avoid long-lived cookies or cross-test contamination.",
        "Add explicit cleanup for created entities and validate preconditions in setup."
      ];
    case "TEST_BUG":
      return [
        "Harden locators: prefer getByRole/getByTestId; avoid brittle nth-child/text-only selectors.",
        "Remove arbitrary waits; wait for explicit UI states (visible/enabled) before actions and assertions.",
        "Fix undefined/ambiguous Cucumber steps by consolidating step definitions and improving match specificity."
      ];
    case "FLAKE":
      return [
        "Rerun to confirm intermittency; if it passes, track fingerprint frequency and prioritize top flaky tests.",
        "Improve synchronization around animations/transitions; eliminate races between navigation and assertions.",
        "Record and trend flakes by fingerprint over 7 days to guide stabilization work."
      ];
    case "PRODUCT_REGRESSION":
      return [
        "Validate expected behavior/spec against recent changes in the affected area; confirm determinism by rerunning locally.",
        "If spec changed intentionally, update assertions; otherwise file a regression with trace + exact repro steps.",
        "Add targeted assertions/logging around the first divergent step to speed debugging."
      ];
    default:
      return [
        "Open the trace (if available) and identify the first divergent step; capture full error + console output.",
        "Rerun once to help separate flake from deterministic regression, then escalate with artifacts.",
        "Add targeted logging around the failing step (requests/responses, UI state) to improve signal next time."
      ];
  }
}
