import type { DuckMode } from "./types.js";

export const MAX_PROMPT_CONTEXT_CHARS = 64 * 1024;

function truncate(input: string): string {
  if (input.length <= MAX_PROMPT_CONTEXT_CHARS) {
    return input;
  }
  return `${input.slice(0, MAX_PROMPT_CONTEXT_CHARS)}\n...[truncated]`;
}

function buildContextBlock(sessionHistory?: string, context?: string): string {
  const blocks: string[] = [];

  if (sessionHistory && sessionHistory.trim()) {
    blocks.push(`Session history:\n${truncate(sessionHistory.trim())}`);
  }

  if (context && context.trim()) {
    blocks.push(`Additional context:\n${truncate(context.trim())}`);
  }

  return blocks.length > 0 ? `\n\n${blocks.join("\n\n")}` : "";
}

export function getSocraticPrompt(
  mode: DuckMode,
  userInput: string,
  sessionHistory?: string,
  context?: string
): string {
  const tone =
    mode === "tough"
      ? "Be direct and challenging. Push the user to think harder."
      : "Be gentle and encouraging. Guide them with curiosity.";

  return `You are a rubber duck debugging companion. Your ONLY job is to ask Socratic questions - NEVER give direct answers or solutions.

${tone}

The user said: "${userInput}"${buildContextBlock(sessionHistory, context)}

Respond with ONLY 1-3 probing questions. No explanations. No solutions. Just questions that help them think through the problem themselves.
Format: Start with "Quack!" then your questions.`;
}

export function getGiveUpPrompt(userInput: string, sessionHistory?: string, context?: string): string {
  return `The user has been debugging with a rubber duck and is now stuck. They asked for direct help.

Original problem: ${userInput}${buildContextBlock(sessionHistory, context)}

Provide a direct, helpful solution. Be concise but thorough.`;
}
