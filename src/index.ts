#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as outputStream } from "node:process";
import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { program } from "commander";
import { detectAha } from "./aha.js";
import { showThinking } from "./art.js";
import { askSocraticQuestion, giveUpAndGetAnswer, resolveProvider } from "./duck.js";
import { OutputManager } from "./output.js";
import { getGiveUpPrompt, getSocraticPrompt } from "./prompts.js";
import {
  addToSession,
  clearSession,
  createSession,
  getActiveSession,
  getSessionHistory,
  getStateWarnings,
  getStats,
  listSessions,
  readState,
  recordAha,
  resetStats,
  setMode,
} from "./storage.js";
import type { DuckMode, OutputFormat, RunResult, Session } from "./types.js";

program
  .name("rubber-duck")
  .description("A Socratic debugging companion - asks questions instead of giving answers")
  .version("1.0.0");

program
  .argument("[message]", "Your debugging problem or follow-up")
  .option("-c, --continue", "Continue existing session")
  .option("-s, --stats", "Show your debugging stats")
  .option("-m, --mode <mode>", "Duck personality: gentle | tough")
  .option("-g, --give-up", "Get direct help (breaks character)")
  .option("-x, --context <file>", "Attach a file for context")
  .option("--clear-session", "Clear current session")
  .option("--session-list", "List recent sessions")
  .option("--reset-stats", "Reset all stats")
  .option("--yes", "Confirm destructive actions without prompt")
  .option("--dry-run-prompt", "Print the generated prompt and exit")
  .option("--export-session <file>", "Export active session and stats to JSON")
  .option("--force", "Allow overwriting an existing export file")
  .option("--non-interactive", "Disable ANSI/art/spinner for scripting")
  .option("--output <format>", "Output format: text | jsonl | json", "text")
  .option("--provider <name>", "Provider name", "copilot")
  .action(async (message: string | undefined, opts) => {
    const result = await run(message, opts);
    process.exitCode = result.code;
  });

async function run(message: string | undefined, opts: Record<string, unknown>): Promise<RunResult> {
  const formatValue = String(opts.output ?? "text");
  if (!isOutputFormat(formatValue)) {
    console.error(`Invalid output format: ${formatValue}. Use text|jsonl|json.`);
    return { ok: false, code: 2, error: "invalid_output_format" };
  }

  const nonInteractive = Boolean(opts.nonInteractive);
  const format: OutputFormat = formatValue;
  const out = new OutputManager({ format, nonInteractive });

  const warnings = getStateWarnings();
  for (const warning of warnings) {
    out.warning(warning);
  }

  const modeValue = opts.mode ? String(opts.mode).toLowerCase() : undefined;
  if (modeValue !== undefined) {
    if (!isDuckMode(modeValue)) {
      out.error(`Invalid mode: ${modeValue}. Use gentle|tough.`);
      out.flushJsonSummary({ ok: false, code: 2, error: "invalid_mode" });
      return { ok: false, code: 2, error: "invalid_mode" };
    }

    const stats = getStats();
    if (stats.mode !== modeValue) {
      setMode(modeValue);
      out.info(`Duck mode set to: ${modeValue}`);
    }
  }

  if (opts.resetStats) {
    const confirmed = await confirmDestructiveAction({
      action: "reset stats",
      nonInteractive,
      yes: Boolean(opts.yes),
    });
    if (!confirmed.ok) {
      out.error(confirmed.error);
      out.flushJsonSummary({ ok: false, code: confirmed.code, error: "confirmation_required" });
      return { ok: false, code: confirmed.code, error: "confirmation_required" };
    }
    resetStats();
    out.info("Stats reset.");
    out.flushJsonSummary({ ok: true, code: 0, action: "reset_stats" });
    return { ok: true, code: 0 };
  }

  if (opts.clearSession) {
    clearSession();
    out.info("Session cleared. Quack!");
    out.flushJsonSummary({ ok: true, code: 0, action: "clear_session" });
    return { ok: true, code: 0 };
  }

  if (opts.stats) {
    out.renderStats(getStats());
    out.flushJsonSummary({ ok: true, code: 0, stats: getStats() });
    return { ok: true, code: 0 };
  }

  if (opts.sessionList) {
    const sessions = listSessions();
    out.renderSessionList(sessions);
    out.flushJsonSummary({ ok: true, code: 0, sessions });
    return { ok: true, code: 0 };
  }

  const activeSession = getActiveSession();
  if (opts.exportSession) {
    if (!activeSession) {
      out.error("No active session to export.");
      out.flushJsonSummary({ ok: false, code: 1, error: "no_active_session" });
      return { ok: false, code: 1, error: "no_active_session" };
    }

    const exportResult = await exportSession(String(opts.exportSession), activeSession, Boolean(opts.force));
    if (!exportResult.ok) {
      out.error(exportResult.error ?? "Export failed.");
      out.flushJsonSummary({ ok: false, code: exportResult.code, error: exportResult.error });
      return exportResult;
    }
    out.info(`Exported session to ${resolve(String(opts.exportSession))}`);
    out.flushJsonSummary({ ok: true, code: 0, action: "export_session" });
    return { ok: true, code: 0 };
  }

  const stdinContent = await readStdin();
  let userInput = (message ?? "").trim();

  let context = "";
  if (stdinContent) {
    context += `[Piped context]\n${stdinContent}`;
  }

  if (opts.context) {
    const contextPath = String(opts.context);
    try {
      const fileContent = (await fs.readFile(contextPath, "utf-8")).trim();
      context = `${context}${context ? "\n\n" : ""}[Context from ${contextPath}]\n${fileContent}`;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "unknown error";
      out.error(`Could not read file: ${contextPath} (${messageText})`);
      out.flushJsonSummary({ ok: false, code: 1, error: "context_read_failed" });
      return { ok: false, code: 1, error: "context_read_failed" };
    }
  }

  if (!userInput && stdinContent) {
    userInput = "Help me understand this:";
  }

  const mode = getStats().mode;
  const sessionForHistory = (opts.continue || opts.giveUp) && activeSession ? activeSession : null;
  const sessionHistory = sessionForHistory ? getSessionHistory(sessionForHistory) : "";

  if (opts.dryRunPrompt) {
    const prompt = opts.giveUp
      ? getGiveUpPrompt(userInput || "I'm stuck, help me", sessionHistory, context)
      : getSocraticPrompt(mode, userInput || "I'm stuck, help me", sessionHistory, context);
    out.renderResponse(prompt);
    out.flushJsonSummary({ ok: true, code: 0, prompt });
    return { ok: true, code: 0, response: prompt };
  }

  if (!userInput.trim()) {
    if (opts.giveUp && activeSession) {
      const lastUser = activeSession.messages.filter((entry) => entry.role === "user").pop();
      userInput = lastUser?.content || "I'm stuck, help me";
    } else {
      out.renderIntro();
      out.flushJsonSummary({ ok: true, code: 0 });
      return { ok: true, code: 0 };
    }
  }

  if (detectAha(userInput)) {
    recordAha();
    out.renderCelebration();
    clearSession();
    out.flushJsonSummary({ ok: true, code: 0, aha: true });
    return { ok: true, code: 0 };
  }

  let provider;
  try {
    provider = resolveProvider(String(opts.provider ?? "copilot"));
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "invalid provider";
    out.error(messageText);
    out.flushJsonSummary({ ok: false, code: 2, error: "invalid_provider" });
    return { ok: false, code: 2, error: "invalid_provider" };
  }

  if (opts.giveUp) {
    out.renderGiveUpPreamble();
    await showThinking(format === "text" && !nonInteractive);
    const answer = await giveUpAndGetAnswer(provider, userInput, sessionHistory);
    out.event("provider_result", { source: answer.source, reason: answer.reason ?? null });
    out.renderResponse(answer.text);
    clearSession();
    out.flushJsonSummary({ ok: true, code: 0, response: answer.text, source: answer.source });
    return { ok: true, code: 0, response: answer.text };
  }

  let session: Session | null = opts.continue ? activeSession : null;
  if (!session) {
    session = createSession(mode);
  }

  session = addToSession(session, "user", userInput);
  out.renderQuack();

  await showThinking(format === "text" && !nonInteractive);
  const result = await askSocraticQuestion(provider, {
    userInput,
    mode,
    sessionHistory: getSessionHistory(session),
    context,
  });
  out.event("provider_result", { source: result.source, reason: result.reason ?? null });

  session = addToSession(session, "duck", result.text);
  out.renderResponse(result.text);
  out.flushJsonSummary({ ok: true, code: 0, response: result.text, source: result.source, sessionId: session.id });
  return { ok: true, code: 0, response: result.text };
}

function isDuckMode(value: string): value is DuckMode {
  return value === "gentle" || value === "tough";
}

function isOutputFormat(value: string): value is OutputFormat {
  return value === "text" || value === "jsonl" || value === "json";
}

async function readStdin(): Promise<string> {
  if (!input.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of input) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf-8").trim();
  }
  return "";
}

async function confirmDestructiveAction(args: {
  action: string;
  nonInteractive: boolean;
  yes: boolean;
}): Promise<{ ok: true; code: 0 } | { ok: false; code: 2; error: string }> {
  if (args.yes) {
    return { ok: true, code: 0 };
  }

  if (args.nonInteractive) {
    return {
      ok: false,
      code: 2,
      error: `Refusing to ${args.action} in non-interactive mode without --yes.`,
    };
  }

  const rl = createInterface({ input, output: outputStream });
  try {
    const answer = await rl.question(`Confirm ${args.action}? (y/N) `);
    if (answer.trim().toLowerCase() !== "y") {
      return { ok: false, code: 2, error: `Cancelled ${args.action}.` };
    }
  } finally {
    rl.close();
  }

  return { ok: true, code: 0 };
}

async function exportSession(path: string, session: Session, force: boolean): Promise<RunResult> {
  const target = resolve(path);
  try {
    await fs.access(target);
    if (!force) {
      return {
        ok: false,
        code: 2,
        error: `Export target already exists: ${target}. Use --force to overwrite.`,
      };
    }
  } catch {
    // path does not exist; continue.
  }

  try {
    await fs.mkdir(dirname(target), { recursive: true });
    const snapshot = {
      exportedAt: new Date().toISOString(),
      session,
      stats: readState().stats,
    };
    await fs.writeFile(target, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
    return { ok: true, code: 0 };
  } catch (error) {
    return {
      ok: false,
      code: 1,
      error: error instanceof Error ? error.message : "Export failed",
    };
  }
}

program.parse();

export { run };
