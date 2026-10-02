import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { describe, it } from "node:test";
import { resources } from "@opentelemetry/sdk-node";
import { startProfiler } from "../src/profiler";

describe("profiler export", () => {
  it("sends profile.cpu spans with sample counts to the OTLP endpoint, even when trace sampling would drop them", async () => {
    const bodies: string[] = [];
    const auth: Array<string | undefined> = [];
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        if (req.url === "/v1/traces") {
          bodies.push(Buffer.concat(chunks).toString("utf8"));
          auth.push(req.headers.authorization);
        }
        res.writeHead(200, { "content-type": "application/json" }).end("{}");
      });
    });
    server.listen(0);
    await once(server, "listening");
    const port = (server.address() as { port: number }).port;

    const handle = startProfiler({
      endpoint: `http://127.0.0.1:${port}`,
      headers: { Authorization: "Bearer owl_ing_test" },
      resource: resources.resourceFromAttributes({ "service.name": "profiler-test" }),
      windowMs: 1000,
      everyMs: 60_000,
      samplingIntervalUs: 500,
    });
    await new Promise((r) => setTimeout(r, 100)); // let the first window start before burning CPU
    const end = Date.now() + 400;
    let x = 0;
    (function burnForExportTest() {
      while (Date.now() < end) x += Math.sqrt(x + 1);
    })();
    await handle.stop();
    server.close();

    assert.ok(x > 0);
    const all = bodies.join("\n");
    assert.match(all, /profile\.cpu/);
    assert.match(all, /profiling\.samples/);
    assert.match(all, /burnForExportTest/);
    assert.match(all, /profiler-test/);
    assert.ok(auth.every((a) => a === "Bearer owl_ing_test"));
  });
});
