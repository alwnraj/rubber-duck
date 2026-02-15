import { spawn } from "node:child_process";
import { getGiveUpPrompt, getSocraticPrompt } from "../prompts.js";
import type { AskOptions, AskResult, DuckProvider, GiveUpResult } from "../types.js";

const FALLBACK_QUESTIONS = [
  "What exactly did you expect to happen?",
  "At what point does the behavior diverge from your expectation?",
  "Have you verified that the input is what you think it is?",
  "What would happen if you removed that part and tried again?",
  "When did you last know it was working?",
  "What's the smallest change you could make to test your hypothesis?",
];

const COPILOT_TIMEOUT_MS = 20_000;

export class CopilotProvider implements DuckProvider {
  async askSocraticQuestion(options: AskOptions): Promise<AskResult> {
    const prompt = getSocraticPrompt(options.mode, options.userInput, options.sessionHistory, options.context);
    return runCopilot(prompt, (reason) => ({
      text: `Quack! ${FALLBACK_QUESTIONS[Math.floor(Math.random() * FALLBACK_QUESTIONS.length)]}`,
      source: "fallback",
      reason,
    }));
  }

  async giveUpAndGetAnswer(userInput: string, sessionHistory?: string): Promise<GiveUpResult> {
    const prompt = getGiveUpPrompt(userInput, sessionHistory);
    return runCopilot(prompt, (reason) => ({
      text: "I couldn't reach Copilot. Try running `copilot` directly with your question.",
      source: "fallback",
      reason,
    }));
  }
}

function extractResponse(output: string): string {
  const lines = output
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
  return lines.join("\n").trim();
}

async function runCopilot(
  prompt: string,
  fallback: (reason: AskResult["reason"]) => AskResult
): Promise<AskResult> {
  return new Promise((resolve) => {
    let settled = false;

    const settle = (result: AskResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    };

    const proc = spawn("copilot", ["-p", prompt], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
      settle(fallback("timeout"));
    }, COPILOT_TIMEOUT_MS);

    let stdout = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.on("error", () => {
      clearTimeout(timeout);
      settle(fallback("spawn_error"));
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        settle(fallback("nonzero_exit"));
        return;
      }

      const response = extractResponse(stdout);
      if (!response) {
        settle(fallback("empty_output"));
        return;
      }

      settle({ text: response, source: "provider" });
    });

    proc.on("spawn", () => {
      proc.stdin?.end();
    });
  });
}
