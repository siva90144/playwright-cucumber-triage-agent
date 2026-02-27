import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { extractFailuresStreaming } from "../src/cucumber_stream.js";

function writeFixture(json: unknown): string {
  const p = path.join(os.tmpdir(), `cucumber-fixture-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  fs.writeFileSync(p, JSON.stringify(json));
  return p;
}

test("extractFailuresStreaming dedupes duplicate failing steps", async () => {
  const report = [
    {
      name: "Checkout",
      uri: "features/checkout.feature",
      elements: [
        {
          name: "fails once",
          line: 12,
          steps: [
            {
              keyword: "When ",
              name: "I submit",
              result: {
                status: "failed",
                error_message: "Timeout 30000ms exceeded\nstack..."
              }
            },
            {
              keyword: "When ",
              name: "I submit",
              result: {
                status: "failed",
                error_message: "Timeout 30000ms exceeded\nstack..."
              }
            }
          ]
        }
      ]
    }
  ];

  const fixture = writeFixture(report);
  try {
    const failures = await extractFailuresStreaming(fixture, 500);
    assert.equal(failures.length, 1);
    assert.equal(failures[0]?.scenarioName, "fails once");
  } finally {
    fs.unlinkSync(fixture);
  }
});

test("extractFailuresStreaming honors maxFailures", async () => {
  const report = [
    {
      name: "Auth",
      uri: "features/auth.feature",
      elements: [
        {
          name: "scenario A",
          line: 1,
          steps: Array.from({ length: 10 }, (_, idx) => ({
            keyword: "Then ",
            name: `step ${idx}`,
            result: {
              status: "failed",
              error_message: `Error ${idx}`
            }
          }))
        }
      ]
    }
  ];

  const fixture = writeFixture(report);
  try {
    const failures = await extractFailuresStreaming(fixture, 3);
    assert.equal(failures.length, 3);
  } finally {
    fs.unlinkSync(fixture);
  }
});
