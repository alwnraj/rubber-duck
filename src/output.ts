import chalk from "chalk";
import { CELEBRATION, DUCK_ART, DUCK_QUACK } from "./art.js";
import type { OutputFormat, SessionSummary, Stats } from "./types.js";

export interface OutputEvent {
  type: string;
  timestamp: number;
  payload?: Record<string, unknown>;
}

interface OutputManagerOptions {
  format: OutputFormat;
  nonInteractive: boolean;
}

export class OutputManager {
  private readonly format: OutputFormat;

  private readonly nonInteractive: boolean;

  private readonly events: OutputEvent[] = [];

  constructor(options: OutputManagerOptions) {
    this.format = options.format;
    this.nonInteractive = options.nonInteractive;
  }

  event(type: string, payload?: Record<string, unknown>): void {
    const event: OutputEvent = { type, timestamp: Date.now(), payload };
    this.events.push(event);

    if (this.format === "jsonl") {
      process.stdout.write(`${JSON.stringify(event)}\n`);
    }
  }

  warning(message: string): void {
    this.event("warning", { message });
    if (this.format === "text") {
      const out = this.nonInteractive ? `Warning: ${message}` : chalk.yellow(`Warning: ${message}`);
      console.log(out);
    }
  }

  info(message: string): void {
    this.event("info", { message });
    if (this.format === "text") {
      console.log(this.nonInteractive ? message : chalk.cyan(message));
    }
  }

  error(message: string): void {
    this.event("error", { message });
    if (this.format === "text") {
      console.error(this.nonInteractive ? message : chalk.red(message));
    }
  }

  renderIntro(): void {
    this.event("intro_shown");
    if (this.format !== "text") return;

    if (this.nonInteractive) {
      console.log("Quack! Tell me what's bugging you.");
      console.log('Usage: rubber-duck "my API returns 500"');
      console.log("Or pipe: cat error.log | rubber-duck");
      return;
    }

    console.log(DUCK_ART);
    console.log(chalk.cyan("  Quack! Tell me what's bugging you."));
    console.log(chalk.dim('  Usage: rubber-duck "my API returns 500"'));
    console.log(chalk.dim("  Or pipe: cat error.log | rubber-duck"));
  }

  renderQuack(): void {
    this.event("duck_quack");
    if (this.format !== "text") return;
    if (this.nonInteractive) {
      console.log("Quack!");
      return;
    }
    console.log(DUCK_QUACK);
  }

  renderCelebration(): void {
    this.event("celebration");
    if (this.format !== "text") return;
    if (this.nonInteractive) {
      console.log("Quack! You figured it out!");
      return;
    }
    console.log(CELEBRATION);
  }

  renderStats(stats: Stats): void {
    this.event("stats", { stats });
    if (this.format !== "text") return;

    if (this.nonInteractive) {
      console.log(`Problems solved: ${stats.problemsSolved}`);
      console.log(`Aha moments: ${stats.ahaMoments}`);
      console.log(`Total sessions: ${stats.totalSessions}`);
      console.log(`Current streak: ${stats.currentStreak}`);
      console.log(`Mode: ${stats.mode}`);
      return;
    }

    console.log(chalk.yellow("\n  📊 Rubber Duck Stats\n"));
    console.log(chalk.white(`  Problems solved:     ${stats.problemsSolved}`));
    console.log(chalk.white(`  Aha moments:        ${stats.ahaMoments}`));
    console.log(chalk.white(`  Total sessions:     ${stats.totalSessions}`));
    console.log(chalk.white(`  Current streak:     ${stats.currentStreak}`));
    console.log(chalk.white(`  Mode:               ${stats.mode}`));
    console.log("");
  }

  renderSessionList(sessions: SessionSummary[]): void {
    this.event("session_list", { count: sessions.length, sessions });
    if (this.format !== "text") return;

    if (sessions.length === 0) {
      console.log(this.nonInteractive ? "No sessions found." : chalk.dim("No sessions found."));
      return;
    }

    for (const session of sessions) {
      console.log(
        `${session.id} | ${new Date(session.startedAt).toISOString()} | ${session.mode} | messages=${session.messageCount}`
      );
    }
  }

  renderResponse(message: string): void {
    this.event("response", { message });
    if (this.format !== "text") return;
    if (this.nonInteractive) {
      console.log(message);
      return;
    }
    console.log(chalk.cyan(`\n${message}\n`));
  }

  renderGiveUpPreamble(): void {
    this.event("give_up_requested");
    if (this.format !== "text") return;
    if (this.nonInteractive) {
      console.log("Fetching direct help.");
      return;
    }
    console.log(chalk.yellow("  The duck relents... fetching direct help.\n"));
  }

  flushJsonSummary(summary: Record<string, unknown>): void {
    if (this.format === "json") {
      process.stdout.write(`${JSON.stringify({ events: this.events, ...summary })}\n`);
    }
  }
}
