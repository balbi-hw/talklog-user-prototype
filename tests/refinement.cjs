// Run: node tests/refinement.cjs. No external calls or additional dependencies.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

let transport;
let hooks;
let deadline;
const cache = new Map();
const react = {
  useState(initial) {
    const index = hooks.index++;
    if (!(index in hooks.slots)) hooks.slots[index] = initial;
    return [hooks.slots[index], (value) => { hooks.slots[index] = value; }];
  },
  useRef(initial) {
    const index = hooks.index++;
    if (!(index in hooks.slots)) hooks.slots[index] = { current: initial };
    return hooks.slots[index];
  },
  useEffect(effect) {
    const index = hooks.index++;
    if (!(index in hooks.slots)) { hooks.slots[index] = true; effect(); }
  },
};
function load(file) {
  const absolute = path.resolve(file);
  if (cache.has(absolute)) return cache.get(absolute);
  const module = { exports: {} };
  cache.set(absolute, module.exports);
  const code = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (name) => name === "server-only" ? {} : name === "react" ? react
    : name.startsWith(".") ? load(path.resolve(path.dirname(absolute), `${name}.ts`)) : require(name);
  vm.runInNewContext(code, {
    module, exports: module.exports, require: localRequire, process,
    fetch: (...args) => transport(...args), Response, Request, Blob, FormData, AbortController,
    setTimeout, clearTimeout, Date, Uint8Array, TypeError,
    window: { setTimeout: (callback) => { deadline = callback; return 1; }, clearTimeout() {} },
  }, { filename: absolute });
  cache.set(absolute, module.exports);
  return module.exports;
}
const { useMessageUnderstanding } = load("app/hooks/useMessageUnderstanding.ts");
const { createClaudeRefinement } = load("app/lib/server/understanding/adapters/refinement.ts");
const { handleUnderstanding } = load("app/lib/server/understanding/http.ts");
const { POST } = load("app/api/refinement/route.ts");
const message = { id: "m1", sender: "me", source: "recorded", url: "blob:test" };
const transcript = "I go yesterday.";
const result = { refinedSentence: "I went yesterday.", reason: "지난 일이라 과거형을 썼어요.", changed: true, source: "real" };
const ok = (value) => Response.json({ ok: true, result: value });
const success = () => ok(result);
function render() { hooks.index = 0; return useMessageUnderstanding(); }
async function prepare() {
  hooks = { index: 0, slots: [] };
  transport = async (url) => url === "blob:test" ? new Response("voice") : ok({ text: transcript, source: "real" });
  await render().request(message, "en", "transcript");
  assert.equal(render().states.m1.transcript.status, "success");
}
const state = () => render().states.m1?.refinement;
async function main() {
  let checks = 0;
  await prepare();
  let requests = 0;
  let finish;
  transport = () => { requests++; return new Promise((resolve) => { finish = resolve; }); };
  const pending = render().request(message, "en", "refinement");
  assert.equal(state().status, "pending");
  await render().request(message, "en", "refinement");
  assert.equal(requests, 1);
  finish(success()); await pending;
  assert.equal(state().status, "success");
  for (let i = 0; i < 3; i++) await render().request(message, "en", "refinement");
  assert.equal(requests, 1); checks++;

  await prepare();
  transport = async () => ok({ ...result, refinedSentence: transcript, changed: false });
  await render().request(message, "en", "refinement");
  assert.equal(state().status, "unchanged"); checks++;

  for (const code of ["failed", "timeout", "limit", "network"]) {
    await prepare();
    transport = async () => Response.json({ ok: false, error: { code } }, { status: 502 });
    await render().request(message, "en", "refinement");
    assert.equal(state().status, code);
    transport = async () => success();
    await render().request(message, "en", "refinement", true);
    assert.equal(state().status, "success"); checks++;
  }
  await prepare();
  transport = async () => { throw new TypeError("offline"); };
  await render().request(message, "en", "refinement");
  assert.equal(state().status, "network"); checks++;

  for (const operation of ["delete", "transcript-retry"]) {
    await prepare();
    transport = () => new Promise((resolve) => { finish = resolve; });
    const old = render().request(message, "en", "refinement");
    const completeOld = finish;
    if (operation === "delete") render().remove([message.id]);
    else {
      transport = async (url) => url === "blob:test" ? new Response("voice") : ok({ text: "New transcript", source: "real" });
      await render().request(message, "en", "transcript", true);
    }
    completeOld(success()); await old;
    assert.equal(state()?.status, operation === "delete" ? undefined : "idle"); checks++;
  }

  await prepare();
  transport = (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted"))));
  const waiting = render().request(message, "en", "refinement");
  deadline(); await waiting;
  assert.equal(state().status, "timeout"); checks++;

  await prepare(); requests = 0;
  transport = async () => { requests++; return success(); };
  await render().request({ ...message, sender: "partner" }, "en", "refinement");
  await render().request({ ...message, id: "unprepared" }, "en", "refinement");
  assert.equal(requests, 0); checks++;

  const adapter = createClaudeRefinement("test-only", "test-model");
  let requestBody;
  const upstream = (text, stop_reason = "end_turn") => async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return Response.json({ content: [{ type: "text", text }], stop_reason });
  };
  const payload = { refinedSentence: result.refinedSentence, reason: result.reason, changed: true };
  transport = upstream(JSON.stringify(payload));
  const actual = await adapter.refinement({ transcript, language: "en", source: "real" }, new AbortController().signal);
  assert.equal(actual.refinedSentence, result.refinedSentence);
  assert.equal(requestBody.output_config.format.type, "json_schema");
  assert.match(requestBody.system, /beginner to intermediate/);
  assert.match(requestBody.system, /learning partner/); checks++;
  for (const [text, stop] of [
    ["broken", "end_turn"],
    [JSON.stringify({ ...payload, refinedSentence: "" }), "end_turn"],
    [JSON.stringify({ ...payload, changed: false }), "end_turn"],
    [JSON.stringify({ ...payload, reason: "x".repeat(1001) }), "end_turn"],
    [JSON.stringify({ ...payload, extra: true }), "end_turn"],
    [JSON.stringify(payload), "max_tokens"],
  ]) {
    transport = upstream(text, stop);
    await assert.rejects(adapter.refinement({ transcript, language: "en", source: "real" }, new AbortController().signal), (error) => error.code === "failed"); checks++;
  }
  transport = upstream(JSON.stringify({ ...payload, changed: false, refinedSentence: transcript }));
  assert.equal((await adapter.refinement({ transcript, language: "en", source: "real" }, new AbortController().signal)).changed, false); checks++;

  let release;
  const active = Array.from({ length: 4 }, () => handleUnderstanding(new Request("http://localhost"), () => new Promise((resolve) => { const previous = release; release = () => { previous?.(); resolve(result); }; })));
  assert.equal((await handleUnderstanding(new Request("http://localhost"), async () => result)).status, 429);
  release(); await Promise.all(active); checks++;

  const names = ["ANTHROPIC_API_KEY", "REFINEMENT_PROVIDER", "REFINEMENT_MODEL"];
  const saved = names.map((name) => process.env[name]);
  try {
    process.env.ANTHROPIC_API_KEY = "test-only";
    process.env.REFINEMENT_PROVIDER = "claude";
    process.env.REFINEMENT_MODEL = "test-model";
    for (const source of ["real", "mock"]) {
      transport = upstream(JSON.stringify(payload));
      const response = await POST(new Request("http://localhost/api/refinement", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript, language: "en", source }),
      }));
      assert.equal(response.status, 200);
      assert.equal((await response.json()).result.source, source);
      assert.equal(requestBody.model, "test-model"); checks++;
    }
    delete process.env.ANTHROPIC_API_KEY;
    transport = () => { throw new Error("Mock must not call upstream"); };
    const response = await POST(new Request("http://localhost/api/refinement", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcript, language: "en", source: "real" }),
    }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).result.source, "mock"); checks++;
  } finally {
    names.forEach((name, index) => { if (saved[index] === undefined) delete process.env[name]; else process.env[name] = saved[index]; });
  }
  console.log(`PASS ${checks} refinement state/adapter/concurrency scenarios`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
