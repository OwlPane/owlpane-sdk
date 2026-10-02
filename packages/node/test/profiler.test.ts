import assert from "node:assert/strict";
import { Session } from "node:inspector";
import { describe, it } from "node:test";
import { hotFunctions, type CpuProfile } from "../src/profiler";

const frame = (functionName: string, url = "", lineNumber = 0) => ({ functionName, url, lineNumber });

describe("hotFunctions", () => {
  // Durations: a sample lasts until the next one. samples [2,2,4,3,2,4], deltas [1000,2000,1000,5000,1000,3000] us,
  // last sample gets the 500 us interval. Node 2 handleOrder: 2000 + 1000 + 3000 = 6000 us over 3 samples.
  // Node 4 hash: 5000 + 500 = 5500 us over 2 samples. Node 3 is (idle) and node 1 is (root): both dropped.
  const profile: CpuProfile = {
    nodes: [
      { id: 1, callFrame: frame("(root)") },
      { id: 2, callFrame: frame("handleOrder", "file:///app/orders.js", 9) },
      { id: 3, callFrame: frame("(idle)") },
      { id: 4, callFrame: frame("hash", "file:///app/crypto.js", 41) },
    ],
    samples: [2, 2, 4, 3, 2, 4],
    timeDeltas: [1000, 2000, 1000, 5000, 1000, 3000],
  };

  it("ranks functions by samples and sums their self time", () => {
    assert.deepEqual(hotFunctions(profile, 500), [
      { function: "handleOrder", file: "file:///app/orders.js", line: 10, samples: 3, selfMs: 6 },
      { function: "hash", file: "file:///app/crypto.js", line: 42, samples: 2, selfMs: 5.5 },
    ]);
  });

  it("limits to the top N, names anonymous functions, and handles an empty profile", () => {
    assert.equal(hotFunctions(profile, 500, 1).length, 1);
    const anon = hotFunctions({ nodes: [{ id: 7, callFrame: frame("", "file:///a.js", 0) }], samples: [7], timeDeltas: [0] }, 1000);
    assert.equal(anon[0].function, "(anonymous)");
    assert.equal(anon[0].selfMs, 1);
    assert.deepEqual(hotFunctions({ nodes: [] }, 1000), []);
  });

  it("keeps the garbage collector, which is real CPU, and breaks ties on name", () => {
    const p: CpuProfile = {
      nodes: [{ id: 1, callFrame: frame("zeta") }, { id: 2, callFrame: frame("(garbage collector)") }, { id: 3, callFrame: frame("alpha") }],
      samples: [1, 2, 3],
      timeDeltas: [0, 1000, 1000],
    };
    assert.deepEqual(hotFunctions(p, 1000).map((f) => f.function), ["(garbage collector)", "alpha", "zeta"]);
  });

  it("finds a function that really burns CPU in a V8 profile", async () => {
    const session = new Session();
    session.connect();
    const post = <T>(m: string, params?: object) => new Promise<T>((res, rej) => session.post(m, params, (e, r) => (e ? rej(e) : res(r as T))));
    await post("Profiler.enable");
    await post("Profiler.setSamplingInterval", { interval: 200 });
    await post("Profiler.start");
    const end = Date.now() + 250;
    let x = 0;
    (function spinForProfilerTest() {
      while (Date.now() < end) x += Math.sqrt(x + 1);
    })();
    const { profile } = await post<{ profile: CpuProfile }>("Profiler.stop");
    session.disconnect();
    const top = hotFunctions(profile, 200, 5);
    assert.ok(top.some((f) => f.function === "spinForProfilerTest"), JSON.stringify(top));
    assert.ok(x > 0);
  });
});
