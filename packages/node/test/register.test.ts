import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("register entry", () => {
  it("loads without throwing when the SDK is disabled", async () => {
    process.env.OTEL_SDK_DISABLED = "true";
    process.env.OWLPANE_INGEST_URL = "http://127.0.0.1:9";
    await import("../src/register.ts");
    assert.equal(process.env.OTEL_SDK_DISABLED, "true");
  });
});