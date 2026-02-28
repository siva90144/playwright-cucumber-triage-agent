# PW Cucumber Triage Agent

AI-assisted, rule-based CLI for triaging Playwright + Cucumber failures.

It classifies failed scenarios, provides confidence and suggested actions, and can generate a business-friendly HTML report.

## Quick Start

Requirements: Node 18+

```bash
npm install
npm run start -- --cucumberJson path/to/cucumber.json --html triage-report.html --out triage-eval.json
```

## Common Commands

Basic run:

```bash
npm run start -- --cucumberJson path/to/cucumber.json
```

With optional artifacts and run metadata:

```bash
npm run start -- \
  --cucumberJson artifacts/cucumber-report.json \
  --console artifacts/console.log \
  --artifacts artifacts/ \
  --repo my-repo \
  --branch main \
  --commit abc123 \
  --workflowUrl "https://github.com/org/repo/actions/runs/123" \
  --env staging \
  --html artifacts/triage-report.html \
  --out artifacts/triage-eval.json
```

## What You Get

- Category and confidence per failed scenario
- Suggested fix per scenario
- Terminal summary and details tables
- Jira draft payloads (draft-only)
- HTML report (`--html`)
- Eval JSON (`--out`)

## Consumer Guide (Other Projects)

Best practice: install as a dev dependency and run via script (stable and CI-friendly).

```bash
npm install --save-dev pw-cucumber-triage-agent
```

Example consumer script:

```json
{
  "scripts": {
    "triage:e2e": "pw-triage --cucumberJson artifacts/cucumber-report.json --html artifacts/triage-report.html --out artifacts/triage-eval.json"
  }
}
```

Alternatives:

- `npx pw-cucumber-triage-agent --cucumberJson path/to/cucumber.json --html triage-report.html`
- `npx pw-triage --cucumberJson path/to/cucumber.json --html triage-report.html` (after install)
- `npm install -g pw-cucumber-triage-agent` then `pw-triage ...`

## CI Examples

GitHub Actions step:

```yaml
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
      --html artifacts/triage-report.html \
      --out artifacts/triage-eval.json
```

Jenkins example:

```groovy
sh '''
  npx pw-triage \
    --cucumberJson artifacts/cucumber-report.json \
    --console artifacts/console.log \
    --artifacts artifacts/ \
    --repo "$JOB_NAME" \
    --branch "$BRANCH_NAME" \
    --commit "$GIT_COMMIT" \
    --workflowUrl "$BUILD_URL" \
    --html artifacts/triage-report.html \
    --out artifacts/triage-eval.json
'''
```

## CLI Options

| Option | Required | Description |
|---|---:|---|
| `--cucumberJson <path>` | ✅ | Path to Cucumber JSON report |
| `--console <path>` | ❌ | Console log text file |
| `--artifacts <dir>` | ❌ | Artifacts folder (screenshots/traces/videos) |
| `--maxFailures <n>` | ❌ | Stop after N failures (default `500`) |
| `--repo <name>` | ❌ | Repository name |
| `--workflowUrl <url>` | ❌ | CI run URL |
| `--commit <sha>` | ❌ | Commit SHA |
| `--branch <name>` | ❌ | Branch name |
| `--pr <num>` | ❌ | Pull request number |
| `--env <name>` | ❌ | Environment name |
| `--baseUrl <url>` | ❌ | Base URL |
| `--jiraProject <key>` | ❌ | Jira project key (default `E2E`) |
| `--jiraType <type>` | ❌ | Jira issue type (default `Bug`) |
| `--approve` | ❌ | Approval intent flag (still draft-only) |
| `--out <path>` | ❌ | Write eval JSON |
| `--html <path>` | ❌ | Write HTML report |

## Notes

- Current version is CLI-first (no programmatic import API).
- Jira integration is draft-only by design in this version.

## Troubleshooting

- `required option '--cucumberJson <path>' not specified`
  - Use: `--cucumberJson /absolute/or/relative/path/to/cucumber.json`
  - Example: `npm run start -- --cucumberJson artifacts/cucumber-report.json`

- `Cucumber JSON not found: ...`
  - Verify path and quoting for spaces.
  - Example: `--cucumberJson "/Users/me/Downloads/cucumber report.json"`

- `pw-triage: command not found` in another project
  - Run via `npx pw-triage ...`, or install as dev dependency first.
  - `npm install --save-dev pw-cucumber-triage-agent`

- `No failed scenarios found in cucumber JSON`
  - Confirm the report has failed steps and is the correct run artifact.
  - Ensure you are passing Cucumber JSON output (not HTML report).

- HTML report not generated
  - Add `--html <output-file>`, for example `--html artifacts/triage-report.html`
  - Check write permissions to the output directory.

## License

Apache-2.0
