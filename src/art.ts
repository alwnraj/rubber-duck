import chalk from "chalk";

export const DUCK_ART = `
  ${chalk.yellow("__")}
 ${chalk.yellow("<")} ${chalk.yellow("o")} ${chalk.yellow(")")}
  ${chalk.yellow("\\\\")}___${chalk.yellow("//")}
   ${chalk.yellow("|")}   ${chalk.yellow("|")}
   ${chalk.yellow("/")}   ${chalk.yellow("\\\\")}
  ${chalk.yellow("~")}   ${chalk.yellow("~")}
`;

export const DUCK_QUACK = `
  ${chalk.yellow("__")}  ${chalk.cyan("Quack!")}
 ${chalk.yellow("<")} ${chalk.yellow("o")} ${chalk.yellow(")")}
  ${chalk.yellow("\\\\")}___${chalk.yellow("//")}
`;

export const CELEBRATION = `
  ${chalk.green("🎉")} ${chalk.yellow("★")} ${chalk.green("🎉")} ${chalk.yellow("★")} ${chalk.green("🎉")}
  ${chalk.cyan("Quack! You figured it out!")}
  ${chalk.green("🎉")} ${chalk.yellow("★")} ${chalk.green("🎉")} ${chalk.yellow("★")} ${chalk.green("🎉")}
`;

export const THINKING = "  ... the duck is thinking ...";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function showThinking(enabled: boolean): Promise<void> {
  if (!enabled) {
    return;
  }
  process.stdout.write(chalk.dim(THINKING));
  await sleep(800);
  process.stdout.write("\r" + " ".repeat(THINKING.length) + "\r");
}
