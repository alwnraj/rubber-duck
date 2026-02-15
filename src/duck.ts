import { CopilotProvider } from "./providers/copilot.js";
import type { AskOptions, AskResult, DuckProvider, GiveUpResult } from "./types.js";

export function resolveProvider(providerName: string): DuckProvider {
  if (providerName === "copilot") {
    return new CopilotProvider();
  }

  throw new Error(`Unknown provider: ${providerName}. Supported providers: copilot`);
}

export async function askSocraticQuestion(
  provider: DuckProvider,
  options: AskOptions
): Promise<AskResult> {
  return provider.askSocraticQuestion(options);
}

export async function giveUpAndGetAnswer(
  provider: DuckProvider,
  userInput: string,
  sessionHistory?: string
): Promise<GiveUpResult> {
  return provider.giveUpAndGetAnswer(userInput, sessionHistory);
}
