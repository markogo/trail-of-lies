import { CaseSchema } from "./case";

export function validateCase(input: unknown): string[] {
  const parsed = CaseSchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => `schema: ${i.path.join(".")} ${i.message}`);
  }
  const c = parsed.data;
  const errors: string[] = [];
  const suspectIds = c.suspects.map((s) => s.id);
  const motiveIds = c.motives.map((m) => m.id);
  if (new Set(suspectIds).size !== suspectIds.length) errors.push("duplicate suspect ids");
  if (new Set(motiveIds).size !== motiveIds.length) errors.push("duplicate motive ids");
  if (!suspectIds.includes(c.solution.killerId)) errors.push("solution.killerId is not a suspect");
  if (!motiveIds.includes(c.solution.motiveId)) errors.push("solution.motiveId is not a motive");
  const locationIds = c.map.locations.map((l) => l.id);
  if (new Set(locationIds).size !== locationIds.length) errors.push("duplicate location ids");
  if (!locationIds.includes(c.map.victimLocationId))
    errors.push("map.victimLocationId is not a location");
  for (const s of c.suspects) {
    if (!locationIds.includes(s.claimedLocationId))
      errors.push(`suspect ${s.id}: claimedLocationId is not a location`);
  }
  for (const l of c.map.locations) {
    const hit = c.suspects.find((s) => mentionsName(l.name, s.name));
    if (hit) errors.push(`map location "${l.name}" contains the name of suspect ${hit.id}`);
  }
  const killer = c.suspects.find((s) => s.id === c.solution.killerId);
  if (killer) {
    const witnesses = c.suspects.filter(
      (s) => s.id !== killer.id && s.knows.some((k) => mentionsName(k, killer.name)),
    );
    if (witnesses.length < 2)
      errors.push("fewer than two innocent suspects mention the killer by name in their knows");
  }
  const kw = c.solution.motiveKeyword;
  const trueMotive = c.motives.find((m) => m.id === c.solution.motiveId);
  if (trueMotive && !hasWord(trueMotive.label, kw))
    errors.push("solution.motiveKeyword is not a whole word in the true motive's label");
  if (c.motives.some((m) => m.id !== c.solution.motiveId && hasWord(m.label, kw)))
    errors.push("solution.motiveKeyword appears in a wrong motive's label");
  const keywordInnocents = c.suspects.filter(
    (s) => s.id !== c.solution.killerId && s.knows.some((k) => hasWord(k, kw)),
  );
  if (keywordInnocents.length < 2)
    errors.push("fewer than two innocent suspects have the motiveKeyword in their knows");
  return errors;
}

const TITLES = new Set(["dr", "mr", "mrs", "ms", "miss", "prof", "sir", "lady", "lord", "mx"]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter((w) => w !== "" && !TITLES.has(w));
}

/** Whole-word, case-insensitive: the full name, or any name word of 3+ letters. */
function mentionsName(text: string, name: string): boolean {
  const textWords = words(text);
  const nameParts = words(name);
  const padded = ` ${textWords.join(" ")} `;
  if (nameParts.length > 0 && padded.includes(` ${nameParts.join(" ")} `)) return true;
  return nameParts.some((w) => w.length >= 3 && textWords.includes(w));
}

/** Whole-word, case-insensitive match of a keyword (or phrase) in text. */
function hasWord(text: string, keyword: string): boolean {
  const kw = words(keyword).join(" ");
  return kw !== "" && ` ${words(text).join(" ")} `.includes(` ${kw} `);
}
