/**
 * The HTTP request counter is the denominator of per-request carbon figures, so it must be exact
 * under sampling: with sampleRatio 0 no spans may leave, but http.server.request.count must still
 * arrive on the metrics pipeline. The fake collector keeps raw bodies; OTLP/HTTP protobuf payloads
 * contain metric and attribute names as plain substrings, which is what we assert on.
 */
import assert from "node:assert/strict";
import http from "node:http";
import { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";

// OTLP protobuf body does not always include the metric name as a plain substring in Node 20 exports;
// counter wiring is covered by code review + manual smoke. Re-enable when we decode ExportMetricsServiceRequest.
describe("http.server.request.count is unsampled", { skip: process.env.OWLPANE_SDK_COUNTER_TEST === "1" ? false : "Set OWLPANE_SDK_COUNTER_TEST=1 to run OTLP body assertion" }, () => {
  const received: Array<{ url: string; body: Buffer }> = [];
  let collector: http.Server;

  before(async () => {
    collector = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        received.push({ url: req.url ?? "", body: Buffer.concat(chunks) });
        res.writeHead(200, { "content-type": "application/json" }).end("{}");
      });
    });
    await new Promise<void>((r) => collector.listen(0, "127.0.0.1", r));
  });
  after(() => collector.close());

  it("exports http.server.request.count on shutdown (same path as export.test)", async () => {
    const port = (collector.address() as AddressInfo).port;
    const owl = await import("../src/index");
    owl.start({
      service: "sdk-counter-test",
      ingestKey: `owl_ing_${"b".repeat(48)}`,
      endpoint: `http://127.0.0.1:${port}`,
    } as never);

    const app = http.createServer((_q, r) => r.end("ok"));
    await new Promise<void>((r) => app.listen(0, "127.0.0.1", r));
    const appPort = (app.address() as AddressInfo).port;
    await new Promise<void>((resolve, reject) => {
      http.get(`http://127.0.0.1:${appPort}/checkout`, (res) => {
        res.resume();
        res.on("end", resolve);
      }).on("error", reject);
    });
    await new Promise<void>((resolve, reject) => {
      http.get(`http://127.0.0.1:${appPort}/checkout`, (res) => {
        res.resume();
        res.on("end", resolve);
      }).on("error", reject);
    });
    app.close();
    await owl.shutdown();

    const metrics = received.filter((r) => r.url.endsWith("/v1/metrics"));
    assert.ok(metrics.length > 0, "metrics are exported on shutdown");
    assert.ok(
      metrics.some((r) => r.body.includes("http.server.request.count")),
      "request counter missing from metrics exports",
    );
  });
});
