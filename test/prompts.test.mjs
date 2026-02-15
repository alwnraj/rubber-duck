import test from "node:test";
import assert from "node:assert/strict";

const prompts = await import("../dist/prompts.js");

test("socratic prompt includes both history and context", () => {
  const prompt = prompts.getSocraticPrompt("gentle", "why failing", "User: hello", "trace line");
  assert.match(prompt, /Session history:/);
  assert.match(prompt, /Additional context:/);
});

test("context is truncated when oversized", () => {
  const big = "a".repeat(prompts.MAX_PROMPT_CONTEXT_CHARS + 200);
  const prompt = prompts.getSocraticPrompt("tough", "why", "", big);
  assert.match(prompt, /\.\.\.\[truncated\]/);
});
