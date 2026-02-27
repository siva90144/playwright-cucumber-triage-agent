import test from "node:test";
import assert from "node:assert/strict";

import { classifyFailure } from "../src/classify.js";

test("classifies strict-mode locator issues as TEST_BUG", () => {
  const cls = classifyFailure("strict mode violation: locator(\".btn\") resolved to 2 elements", 1);
  assert.equal(cls.category, "TEST_BUG");
  assert.ok(cls.confidence > 0.4);
});

test("classifies expectation mismatch as PRODUCT_REGRESSION when no locator brittleness", () => {
  const cls = classifyFailure("AssertionError: expected status to equal 200 but got 500", 1);
  assert.equal(cls.category, "PRODUCT_REGRESSION");
});

test("classifies retry/transient wording as FLAKE", () => {
  const cls = classifyFailure("Intermittent failure observed, retry #2 passed", 1);
  assert.equal(cls.category, "FLAKE");
});
