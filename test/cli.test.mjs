import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const CLI_PATH = join(process.cwd(), "dist", "index.js");

function createHome() {
  return mkdtempSync(join(tmpdir(), "rubber-duck-test-"));
}

function configPath(home) {
  const candidates = [
    join(home, "rubber-duck-nodejs", "config.json"),
    join(home, ".config", "rubber-duck-nodejs", "config.json"),
    join(home, "Library", "Preferences", "rubber-duck-nodejs", "config.json"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function writeConfigToAllCandidatePaths(home, payload) {
  const candidates = [
    join(home, "rubber-duck-nodejs", "config.json"),
    join(home, ".config", "rubber-duck-nodejs", "config.json"),
    join(home, "Library", "Preferences", "rubber-duck-nodejs", "config.json"),
  ];

  const text = JSON.stringify(payload);
  for (const candidate of candidates) {
    mkdirSync(dirname(candidate), { recursive: true });
    writeFileSync(candidate, text, "utf-8");
  }
}

function runCli(args, options = {}) {
  const home = options.home ?? createHome();
  const result = spawnSync("node", [CLI_PATH, ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: home,
      XDG_DATA_HOME: home,
    },
    input: options.input,
    encoding: "utf-8",
  });

  return {
    home,
    code: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

test("session persists user and duck messages in order", () => {
  const home = createHome();
  const res = runCli(["--non-interactive", "first issue"], { home });
  assert.equal(res.code, 0);

  const stored = JSON.parse(readFileSync(configPath(home), "utf-8"));
  assert.equal(stored.session.messages.length, 2);
  assert.equal(stored.session.messages[0].role, "user");
  assert.equal(stored.session.messages[0].content, "first issue");
  assert.equal(stored.session.messages[1].role, "duck");
  assert.match(stored.session.messages[1].content, /Quack!/);
});

test("mode applies even with stats", () => {
  const home = createHome();
  const res = runCli(["--non-interactive", "--mode", "tough", "--stats"], { home });
  assert.equal(res.code, 0);
  assert.match(res.stdout, /Mode: tough/);
});

test("aha input does not create a new session", () => {
  const home = createHome();
  const res = runCli(["--non-interactive", "oh! fixed"], { home });
  assert.equal(res.code, 0);

  const stats = runCli(["--non-interactive", "--stats"], { home });
  assert.match(stats.stdout, /Total sessions: 0/);
  assert.match(stats.stdout, /Problems solved: 1/);
});

test("dry-run prompt merges session history and context", () => {
  const home = createHome();
  runCli(["--non-interactive", "first issue"], { home });

  const contextFile = join(home, "context.log");
  writeFileSync(contextFile, "Error: ECONNRESET\nline=22\n", "utf-8");

  const res = runCli(
    [
      "--non-interactive",
      "--continue",
      "--context",
      contextFile,
      "--dry-run-prompt",
      "second issue",
    ],
    { home }
  );

  assert.equal(res.code, 0);
  assert.match(res.stdout, /Session history:/);
  assert.match(res.stdout, /Additional context:/);
  assert.match(res.stdout, /first issue/);
  assert.match(res.stdout, /Error: ECONNRESET/);
});

test("invalid mode exits with code 2", () => {
  const res = runCli(["--mode", "invalid", "hello"]);
  assert.equal(res.code, 2);
  assert.match(res.stderr, /Invalid mode/);
});

test("reset-stats requires --yes in non-interactive mode", () => {
  const res = runCli(["--non-interactive", "--reset-stats"]);
  assert.equal(res.code, 2);
  assert.match(res.stderr, /without --yes/);
});

test("export-session refuses overwrite without --force", () => {
  const home = createHome();
  runCli(["--non-interactive", "first issue"], { home });

  const outPath = join(home, "exports", "session.json");
  let exportRes = runCli(["--non-interactive", "--export-session", outPath], { home });
  assert.equal(exportRes.code, 0);
  assert.equal(existsSync(outPath), true);

  exportRes = runCli(["--non-interactive", "--export-session", outPath], { home });
  assert.equal(exportRes.code, 2);
  assert.match(exportRes.stderr, /--force/);
});

test("json output includes provider_result event", () => {
  const res = runCli(["--non-interactive", "--output", "json", "first issue"]);
  assert.equal(res.code, 0);

  const payload = JSON.parse(res.stdout);
  assert.equal(payload.ok, true);
  const providerEvent = payload.events.find((entry) => entry.type === "provider_result");
  assert.ok(providerEvent);
  assert.ok(providerEvent.payload.source === "fallback" || providerEvent.payload.source === "provider");
  if (providerEvent.payload.source === "fallback") {
    assert.ok(
      ["spawn_error", "timeout", "nonzero_exit", "empty_output"].includes(providerEvent.payload.reason)
    );
  }
});

test("corrupt stats config is recovered with warning", () => {
  const home = createHome();
  writeConfigToAllCandidatePaths(home, {
      configVersion: 1,
      stats: { bad: true },
      session: null,
      sessions: [],
  });

  const res = runCli(["--non-interactive", "--output", "json", "--stats"], { home });
  assert.equal(res.code, 0);
  const payload = JSON.parse(res.stdout);
  const warningEvent = payload.events.find((event) => event.type === "warning");
  assert.ok(warningEvent);
  assert.match(warningEvent.payload.message, /Stats data was invalid/);
});
