import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { DIFFICULTIES, type Difficulty } from "../src/shared/case";
import { cleanupSession, generatorRunner } from "../src/server/claude";
import { generateCase } from "../src/server/generator";

export function parseDifficultyArg(argv: string[]): Difficulty {
  const i = argv.indexOf("--difficulty");
  if (i === -1) return "medium";
  const v = argv[i + 1];
  if (!DIFFICULTIES.includes(v as Difficulty))
    throw new Error(`--difficulty must be one of ${DIFFICULTIES.join(", ")}`);
  return v as Difficulty;
}

async function main(): Promise<void> {
  try {
    const difficulty = parseDifficultyArg(process.argv.slice(2));
    const c = await generateCase({ runner: generatorRunner, cleanup: cleanupSession, difficulty });
    const file = `cases/${c.id}.json`;
    writeFileSync(file, JSON.stringify(c, null, 2) + "\n");
    console.log(`wrote ${file}: ${c.title} (${difficulty})`);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
