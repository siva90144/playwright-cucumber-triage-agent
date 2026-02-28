# PW Cucumber Triage Agent

AI-assisted, rule-based CLI for triaging Playwright + Cucumber failures.

## Quick Start

Requirements: Node 18+

```bash
npm install
npm run start -- --cucumberJson path/to/cucumber.json --html triage-report.html --out triage-eval.json
```

## Typical Usage

Basic run:

```bash
npm run start -- --cucumberJson path/to/cucumber.json
```

Full run with optional context:

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

## Output

- category and confidence per failed scenario
- suggested fixes
- terminal summary/detail tables
- Jira drafts (draft-only)
- HTML report (`--html`)
- eval JSON (`--out`)

## Use In Other Projects

Recommended:

```bash
npm install --save-dev pw-cucumber-triage-agent
```

Add script in consumer `package.json`:

```json
{
  "scripts": {
    "triage:e2e": "pw-triage --cucumberJson artifacts/cucumber-report.json --html artifacts/triage-report.html --out artifacts/triage-eval.json"
  }
}
```

Alternatives:

- `npx pw-cucumber-triage-agent --cucumberJson path/to/cucumber.json --html triage-report.html`
- `npx pw-triage --cucumberJson path/to/cucumber.json --html triage-report.html`
- global install: `npm install -g pw-cucumber-triage-agent`

## CI Snippets

GitHub Actions:

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

Jenkins:

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

| Option | Description |
|---|---|
| `--cucumberJson <path>` | Path to Cucumber JSON report (required) |
| `--console <path>` | Console log text file |
| `--artifacts <dir>` | Artifacts folder (screenshots/traces/videos) |
| `--maxFailures <n>` | Stop after N failures (default `500`) |
| `--repo <name>` | Repository name |
| `--workflowUrl <url>` | CI run URL |
| `--commit <sha>` | Commit SHA |
| `--branch <name>` | Branch name |
| `--pr <num>` | Pull request number |
| `--env <name>` | Environment name |
| `--baseUrl <url>` | Base URL |
| `--jiraProject <key>` | Jira project key (default `E2E`) |
| `--jiraType <type>` | Jira issue type (default `Bug`) |
| `--approve` | Approval intent flag (still draft-only) |
| `--out <path>` | Write eval JSON |
| `--html <path>` | Write HTML report |

## Troubleshooting

- `required option '--cucumberJson <path>' not specified`  
  Use: `--cucumberJson artifacts/cucumber-report.json`
- `Cucumber JSON not found`  
  Verify path and quote paths with spaces.
- `pw-triage: command not found`  
  Run with `npx pw-triage ...` or install as dev dependency first.
- `No failed scenarios found in cucumber JSON`  
  Confirm you passed the correct cucumber JSON output file.

## Notes

- CLI-first package (no programmatic import API yet)
- Jira submission is draft-only in this version

## License

Apache-2.0
