# PW Cucumber Triage Agent (TypeScript)

A lightweight **AI-assisted, rule-based failure triage agent** for E2E runs that use **Playwright + Cucumber**.

It ingests **Cucumber JSON (large-file safe)** plus optional artifacts (console logs, traces, screenshots) and produces:

- **Root-cause category** (per failed scenario)
- **Confidence score** + evidence
- **Suggested fix** (actionable next steps)
- **Nice tabular output** for CI logs
- **Auto-drafted Jira ticket payloads** (human approval gate)
- **Eval record output** to measure accuracy over time

---

## Quick Start (TypeScript only)

```bash
npm install
npm run typecheck
npm test
npm run start -- --cucumberJson path/to/cucumber.json
```

Generate a business-friendly HTML report:

```bash
npm run start -- --cucumberJson path/to/cucumber.json --html triage-report.html
```

Optional compiled output:

```bash
npm run build
```

---

## Features

### Inputs
- **Cucumber JSON** report (**supports large files like 35MB** via streaming)
- Optional **console log** (`.log` / `.txt`)
- Optional **artifacts directory**:
  - screenshots (`.png`, `.jpg`, `.webp`)
  - traces (`trace*.zip`, `trace*.json`)
  - videos (`.webm`, `.mp4`)
- Optional run metadata:
  - repo, branch, commit, PR, CI run URL, environment, baseURL

### Outputs
- **Category + confidence** per failed scenario
- **Evidence** explaining why the classifier chose the category
- **Suggested fix** list per scenario
- **Summary table** grouped by category
- **Detailed table** per failing scenario (CI-friendly format)
- **Jira draft payloads** (title + description + labels)
- **Eval run record JSON** for accuracy tracking over time

### Guardrails
- **Confidence score (0–1)**
- **Human approval gate**:
  - default: prints drafts only
  - `--approve`: indicates approval intent (still draft-only in this project until you wire Jira API)

---

## Root-cause Categories

- `PRODUCT_REGRESSION`
- `TEST_BUG`
- `FLAKE`
- `ENV_DEPENDENCY`
- `INFRA`
- `PERFORMANCE_TIMEOUT`
- `DATA_STATE`
- `UNKNOWN`

> This starter version is rule-based. You can tune regex patterns to match your environment’s failure modes.
> It is AI-assisted via heuristic classification and recommendation logic (not an LLM-backed model in this version).

---

## Install

Requirements: Node 18+ (recommended 20+)

```bash
npm install
npm run typecheck
npm test
```

Run directly from TypeScript (no build required):

```bash
npm run start -- --cucumberJson path/to/cucumber.json
```

Optional (only if you want compiled output):

```bash
npm run build
```

---

## Usage

Draft-only (default):

```bash
npm run start -- \
  --cucumberJson cucumber-report/cucumber.json \
  --console artifacts/console.log \
  --artifacts artifacts/ \
  --repo my-repo \
  --workflowUrl "https://github.com/org/repo/actions/runs/123" \
  --commit abcdef123 \
  --branch main \
  --pr 42 \
  --env staging \
  --baseUrl "https://staging.example.com" \
  --jiraProject E2E \
  --jiraType Bug \
  --out triage-eval.json \
  --html triage-report.html
```

Approval intent:

```bash
npm run start -- --cucumberJson cucumber-report/cucumber.json --approve
```

Large runs / meltdown protection:

```bash
npm run start -- --cucumberJson cucumber-report/cucumber.json --maxFailures 200
```

---

## Consumer Guide (Other Projects)

This package is primarily a CLI tool. Most teams should consume it by running `pw-triage` in CI/local scripts.

### Best practice (recommended)

Install as a dev dependency in the consumer repository and run via an npm script. This keeps versions pinned and reproducible in CI.

```bash
npm install --save-dev pw-cucumber-triage-agent
```

Suggested script in consumer `package.json`:

```json
{
  "scripts": {
    "triage:e2e": "pw-triage --cucumberJson artifacts/cucumber.json --html artifacts/triage-report.html --out artifacts/triage-eval.json"
  }
}
```

Run:

```bash
npm run triage:e2e
```

### 1) Use with npx (no permanent install)

```bash
npx pw-cucumber-triage-agent --cucumberJson path/to/cucumber.json --html triage-report.html
```

### 2) Install in another project and run directly

```bash
npx pw-triage --cucumberJson path/to/cucumber.json --html triage-report.html
```

### 3) Global install (local machine convenience)

```bash
npm install -g pw-cucumber-triage-agent
pw-triage --cucumberJson path/to/cucumber.json --html triage-report.html
```

### Example CI command

```bash
npx pw-triage \
  --cucumberJson artifacts/cucumber-report.json \
  --console artifacts/console.log \
  --artifacts artifacts/ \
  --repo my-repo \
  --branch "$GITHUB_REF_NAME" \
  --commit "$GITHUB_SHA" \
  --workflowUrl "https://github.com/org/repo/actions/runs/$GITHUB_RUN_ID" \
  --env staging \
  --out artifacts/triage-eval.json \
  --html artifacts/triage-report.html
```

### GitHub Actions example

```yaml
- name: Install triage tool
  run: npm install --save-dev pw-cucumber-triage-agent

- name: Run failure triage
  if: always()
  run: |
    npx pw-triage \
      --cucumberJson artifacts/cucumber-report.json \
      --console artifacts/console.log \
      --artifacts artifacts/ \
      --repo "${{ github.repository }}" \
      --branch "${{ github.ref_name }}" \
      --commit "${{ github.sha }}" \
      --workflowUrl "https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}" \
      --out artifacts/triage-eval.json \
      --html artifacts/triage-report.html

- name: Upload triage artifacts
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: triage-report
    path: |
      artifacts/triage-report.html
      artifacts/triage-eval.json
```

> Note: this package is currently CLI-first; importing it as a programmatic library API is not supported in this version.

### Jenkins Pipeline example

```groovy
pipeline {
  agent any
  stages {
    stage('Install') {
      steps {
        sh 'npm ci'
        sh 'npm install --save-dev pw-cucumber-triage-agent'
      }
    }
    stage('Run Triage') {
      steps {
        sh '''
          npx pw-triage \
            --cucumberJson artifacts/cucumber-report.json \
            --console artifacts/console.log \
            --artifacts artifacts/ \
            --repo "$JOB_NAME" \
            --branch "$BRANCH_NAME" \
            --commit "$GIT_COMMIT" \
            --workflowUrl "$BUILD_URL" \
            --out artifacts/triage-eval.json \
            --html artifacts/triage-report.html
        '''
      }
    }
  }
  post {
    always {
      archiveArtifacts artifacts: 'artifacts/triage-report.html,artifacts/triage-eval.json', allowEmptyArchive: true
    }
  }
}
```

---

## CLI Options

| Option | Required | Description |
|---|---:|---|
| `--cucumberJson <path>` | ✅ | Path to `cucumber.json` |
| `--console <path>` | ❌ | Console log file path |
| `--artifacts <dir>` | ❌ | Directory containing traces/screenshots/videos |
| `--maxFailures <n>` | ❌ | Stop after N failures (default 500) |
| `--repo <name>` | ❌ | Repo name |
| `--workflowUrl <url>` | ❌ | CI run URL |
| `--commit <sha>` | ❌ | Commit SHA |
| `--branch <name>` | ❌ | Branch |
| `--pr <num>` | ❌ | PR number |
| `--env <name>` | ❌ | Environment name |
| `--baseUrl <url>` | ❌ | baseURL |
| `--jiraProject <key>` | ❌ | Jira project key (default `E2E`) |
| `--jiraType <type>` | ❌ | Jira issue type (default `Bug`) |
| `--approve` | ❌ | Human approval intent (draft-only unless you wire Jira API) |
| `--out <path>` | ❌ | Write eval run record JSON |
| `--html <path>` | ❌ | Write business-friendly HTML report |

---

## Output

### 1) Category Summary Table
Shows how failures split across categories.

### 2) Detailed Scenario Table
One row per failed scenario with category, confidence, fingerprint, and top error.

### 3) Suggested Fixes
Compact list: top fix per scenario.

### 4) Jira Drafts (JSON)
Prints draft payloads you can submit via Jira REST API once you add a client.

### 5) Business HTML Report
Generates an executive-friendly HTML report with summary metrics, category breakdown, action plan, and scenario detail table.

---

## Handling 35MB JSON

This project uses a **streaming Cucumber JSON parser** (`stream-json`) so it does **not** `JSON.parse()` the full report.
It extracts only failed steps, which keeps memory stable in CI.

---

## Jira submission (optional)

This project intentionally does **draft-only** output to keep it safe and portable.

Recommended next step:
- Implement a Jira REST client that:
  - requires `--approve`
  - requires `confidence >= 0.70`
  - dedupes by label `fp-<fingerprint>`

---

## Project Structure

```
src/
  cli.ts
  cucumber_stream.ts
  classify.ts
  suggest.ts
  triage_per_scenario.ts
  jira.ts
  fingerprints.ts
  load_artifacts.ts
  table.ts
  eval.ts
  types.ts
```

---

## License
Apache-2.0
