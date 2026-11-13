import { randomUUID } from "node:crypto";
import type { Case, Difficulty } from "../shared/case";
import { CaseSchema } from "../shared/case";
import { validateCase } from "../shared/validate";
import type { ClaudeRunner } from "./claude";
import { GameError } from "./game";

export function extractJson(text: string): unknown {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = fence?.[1] ?? text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object found in the answer");
  return JSON.parse(body.slice(start, end + 1));
}

const DIFFICULTY_RULES: Record<Difficulty, string> = {
  easy: `

Difficulty: easy
- Two witnesses contradict the killer's claim in plain words.
- One innocent states the motive outright in their "knows" (the motiveKeyword rule still holds).
- The killer's persona is nervous and fidgety.
- The innocents' secrets are clearly minor, so they hardly look guilty.`,
  medium: "",
  hard: `

Difficulty: hard
- Exactly ONE innocent states a direct contradiction of the killer's alibi. The OTHER innocent's fact that names the killer must NOT contradict the alibi on its own; it only exposes the alibi when combined with a second fact from someone else (what the killer carried, or when they were seen). It still names the killer.
- The killer's persona is calm and composed.
- The motive must be inferred from two facts in different suspects' "knows"; no single fact states it (the motiveKeyword rule still holds).
- One innocent's secret fits a wrong motive option (the killer's secret still must not).`,
};

export function buildGeneratorPrompt(difficulty: Difficulty = "medium"): string {
  return `You write murder mystery cases for a detective game. Answer with ONE JSON object and nothing else.

The JSON must have exactly this shape (3 suspects, 4 motives, clues, solution):

{
  "id": "any-short-id",
  "title": "Case title",
  "setting": "Where and when it happens",
  "victim": "Who died, where and how they were found",
  "briefing": "What the detective knows: time window of the murder, who was present",
  "map": {
    "locations": [{ "id": "short-id", "name": "Place in the setting", "x": 0-100, "y": 0-100 }],
    "victimLocationId": "a location id: where the body was found"
  },
  "suspects": [
    {
      "id": "short-lowercase-id",
      "name": "Full name",
      "role": "Job or relation to the victim",
      "publicStatement": "What they say openly to the police",
      "persona": "How they speak and behave",
      "secret": "Something embarrassing or illegal they hide",
      "alibi": "Where they claim to have been during the murder",
      "knows": ["Facts this suspect witnessed or knows, one per string"],
      "claimedLocationId": "a location id: where they SAY they were at the time of death"
    }
  ],
  "motives": [{ "id": "short-id", "label": "Motive shown to the player" }],
  "clues": ["Facts a detective can find by questioning"],
  "solution": { "killerId": "a suspect id", "motiveId": "a motive id", "motiveKeyword": "one word", "explanation": "How the detective can deduce it" }
}

Rules:
- Exactly 3 suspects and exactly 4 motives. Ids must be unique; solution.killerId must be a suspect id and solution.motiveId a motive id.
- The killer's persona must fit the difficulty (easy: nervous, fidgety; hard: calm, composed; medium: free).
- Vary the setting: do not use a stormy island lighthouse; choose a fresh place and era.
- Exactly one suspect is the killer. The other two are innocent.
- Fairness: the innocents' "knows" must contradict the killer's alibi, and at least two independent witnesses (two different suspects) each know a fact that exposes the killer's alibi.
- At least two innocents' "knows" must each name the killer (by name) and describe what they saw that contradicts the killer's claim. An innocent must never vouch for the killer's alibi.
- solution.motiveKeyword is one non-empty word that appears as a whole word in the true motive's label, in no other motive label, and in the "knows" of at least two innocents (the killer does not count), each in their own words.
- The killer's own secret must not match or hint at any wrong motive option, and the innocents' "knows" together must rule out every wrong motive.
- A suspect's "secret" must not contradict their own "knows".
- Each innocent has a "secret" that is plausible and makes them look suspicious, but is NOT the motive of the murder.
- The killer's own "knows" must state plainly that he or she is the killer and what really happened, so the suspect can lie convincingly while staying consistent.
- The true motive must be discoverable by questioning: put motive clues in the "knows" of the suspects and in "clues". The 3 wrong motives must be plausible but ruled out by the facts.
- "clues" are NOT visible during play. Every fact needed to identify the killer AND the motive must also appear in at least one innocent's "knows" (or be something the killer would have to lie about).
- Each suspect's "publicStatement" must be consistent with their own "knows" and with the time of death; the timeline must have no internal contradictions.
- Map: a schematic map of the setting with 3 to 8 locations (x and y are numbers from 0 to 100, like a small plan seen from above; place them so the layout makes sense). Location names must fit the setting and must NEVER contain any suspect's name or a word of it (write "Boat at the jetty", not "Mara's boat").
- victimLocationId must be a location id matching where the victim was found. Each suspect's claimedLocationId must be a location id consistent with their publicStatement and the time of death. Use only claimed positions: never the killer's true position, and never a location named after the weapon or a hiding place.
- Keep every string short (1-3 sentences). No text outside the JSON object.${DIFFICULTY_RULES[difficulty]}`;
}

function check(answer: string, difficulty: Difficulty): { errors: string[]; parsed?: Case } {
  let json: unknown;
  try {
    json = extractJson(answer);
    if (typeof json === "object" && json !== null) json = { ...json, difficulty };
  } catch (e) {
    return { errors: [`not valid JSON: ${(e as Error).message}`] };
  }
  const errors = validateCase(json);
  return errors.length === 0 ? { errors, parsed: CaseSchema.parse(json) } : { errors };
}

function runnerFailure(e: unknown): string {
  const err = e as { killed?: boolean; code?: unknown };
  return err.killed ? "timed out" : `claude exited with code ${String(err.code ?? "unknown")}`;
}

export async function generateCase(opts: {
  runner: ClaudeRunner;
  maxAttempts?: number;
  difficulty?: Difficulty;
  cleanup?: (sessionId: string) => void;
}): Promise<Case> {
  const max = opts.maxAttempts ?? 3;
  const difficulty = opts.difficulty ?? "medium";
  const systemPrompt = buildGeneratorPrompt(difficulty);
  let sessionId = randomUUID();
  let resume = false;
  const initialQuestion = "Write a new murder mystery case now. Answer with the JSON object only.";
  let question = initialQuestion;
  let last = "";
  const used = new Set([sessionId]);
  try {
    return await attempts();
  } finally {
    for (const id of used) opts.cleanup?.(id);
  }

  async function attempts(): Promise<Case> {
    for (let attempt = 1; attempt <= max; attempt++) {
      let errors: string[];
      try {
        const r = await opts.runner({ systemPrompt, question, sessionId, resume });
        const result = check(r.text, difficulty);
        if (result.parsed) return { ...result.parsed, id: `gen-${randomUUID().slice(0, 8)}` };
        errors = result.errors;
        resume = true;
        question = `Your answer was rejected. Fix these problems and answer with the full corrected JSON object only (3 suspects, 4 motives, valid schema):\n- ${errors.join("\n- ")}`;
      } catch (e) {
        // The session may not exist after a runner failure: start a fresh one and retry from scratch.
        errors = [`runner failed: ${runnerFailure(e)}`];
        sessionId = randomUUID();
        used.add(sessionId);
        resume = false;
        question = initialQuestion;
      }
      last = errors.join("; ");
    }
    throw new GameError(502, `could not generate a valid case: ${last}`);
  }
}
