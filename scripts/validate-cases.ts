import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateCase } from "../src/shared/validate";

const dir = "cases";
let bad = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const errors = validateCase(JSON.parse(readFileSync(join(dir, f), "utf8")));
  if (errors.length) {
    bad++;
    console.log(`FAIL ${f}`);
    for (const e of errors) console.log(`  - ${e}`);
  } else {
    console.log(`ok   ${f}`);
  }
}
process.exit(bad ? 1 : 0);
