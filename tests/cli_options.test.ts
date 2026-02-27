import test from "node:test";
import assert from "node:assert/strict";

import { parseMaxFailuresOption } from "../src/cli_options.js";

test("parseMaxFailuresOption accepts positive integer strings", () => {
  assert.equal(parseMaxFailuresOption("200"), 200);
});

test("parseMaxFailuresOption rejects invalid values", () => {
  assert.throws(() => parseMaxFailuresOption("0"), /Invalid --maxFailures/);
  assert.throws(() => parseMaxFailuresOption("-1"), /Invalid --maxFailures/);
  assert.throws(() => parseMaxFailuresOption("abc"), /Invalid --maxFailures/);
  assert.throws(() => parseMaxFailuresOption("10.5"), /Invalid --maxFailures/);
});
