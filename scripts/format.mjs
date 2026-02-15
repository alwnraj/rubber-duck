import { promises as fs } from "node:fs";
import path from "node:path";

const mode = process.argv.includes("--write") ? "write" : "check";
const root = process.cwd();
const targets = ["src", "test", "scripts", "README.md", "RELEASING.md", "package.json", "tsconfig.json"];
const fileExtensions = new Set([".ts", ".js", ".mjs", ".json", ".md", ".yml", ".yaml"]);

async function listFiles(entry) {
  const full = path.join(root, entry);
  try {
    const stat = await fs.stat(full);
    if (stat.isFile()) {
      return [full];
    }
    if (!stat.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  const out = [];
  const queue = [full];
  while (queue.length > 0) {
    const current = queue.pop();
    const children = await fs.readdir(current, { withFileTypes: true });
    for (const child of children) {
      if (child.name === "node_modules" || child.name === "dist" || child.name === ".git") {
        continue;
      }
      const childPath = path.join(current, child.name);
      if (child.isDirectory()) {
        queue.push(childPath);
      } else if (fileExtensions.has(path.extname(child.name))) {
        out.push(childPath);
      }
    }
  }

  return out;
}

function normalize(content) {
  const lines = content.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").split("\n");
  const joined = lines.join("\n");
  return joined.endsWith("\n") ? joined : `${joined}\n`;
}

let hadDiff = false;
const files = (await Promise.all(targets.map((entry) => listFiles(entry)))).flat();

for (const file of files) {
  const before = await fs.readFile(file, "utf-8");
  const after = normalize(before);
  if (before !== after) {
    hadDiff = true;
    if (mode === "write") {
      await fs.writeFile(file, after, "utf-8");
    } else {
      console.error(`Formatting differs: ${path.relative(root, file)}`);
    }
  }
}

if (hadDiff && mode === "check") {
  process.exitCode = 1;
}
