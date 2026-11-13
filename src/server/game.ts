import { randomUUID } from "node:crypto";
import { toPublicCase, type Case, type Difficulty, type PublicCase } from "../shared/case";
import { buildSuspectPrompt } from "../shared/suspectPrompt";
import type { ClaudeRunner } from "./claude";

export const MAX_QUESTIONS = 20;
export const MAX_QUESTION_LENGTH = 300;
export const TOKEN_BUDGET = 100_000;

export class GameError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Game = {
  c: Case;
  asked: number;
  tokens: number;
  accused: boolean;
  sessions: Map<string, string>;
};

export type Verdict = {
  correctKiller: boolean;
  correctMotive: boolean;
  solved: boolean;
  solution: Case["solution"];
};

export type GameStore = ReturnType<typeof createGameStore>;

export function createGameStore(deps: { cases: Case[]; runner: ClaudeRunner }) {
  const games = new Map<string, Game>();

  const get = (id: string): Game => {
    const g = games.get(id);
    if (!g) throw new GameError(404, "game not found");
    return g;
  };

  return {
    addCase(c: Case): void {
      deps.cases.push(c);
    },

    listCases(): { caseId: string; title: string; difficulty: Difficulty }[] {
      return deps.cases.map((c) => ({ caseId: c.id, title: c.title, difficulty: c.difficulty }));
    },

    createGame(caseId?: string): { gameId: string; case: PublicCase } {
      const c = caseId ? deps.cases.find((x) => x.id === caseId) : deps.cases[0];
      if (!c) throw new GameError(404, "case not found");
      const gameId = randomUUID();
      games.set(gameId, { c, asked: 0, tokens: 0, accused: false, sessions: new Map() });
      return { gameId, case: toPublicCase(c) };
    },

    async ask(gameId: string, suspectId: string, question: string) {
      const g = get(gameId);
      if (g.accused) throw new GameError(409, "game is over");
      if (typeof question !== "string" || question.trim() === "")
        throw new GameError(400, "question is empty");
      if (question.length > MAX_QUESTION_LENGTH)
        throw new GameError(400, `question over ${MAX_QUESTION_LENGTH} characters`);
      if (!g.c.suspects.some((s) => s.id === suspectId))
        throw new GameError(400, "unknown suspect");
      if (g.asked >= MAX_QUESTIONS) throw new GameError(409, "no questions left");
      if (g.tokens >= TOKEN_BUDGET) throw new GameError(409, "token budget used up");

      let sessionId = g.sessions.get(suspectId);
      const resume = sessionId !== undefined;
      if (!sessionId) {
        sessionId = randomUUID();
        g.sessions.set(suspectId, sessionId);
      }
      g.asked++;
      let r;
      try {
        r = await deps.runner({
          systemPrompt: buildSuspectPrompt(g.c, suspectId),
          question,
          sessionId,
          resume,
        });
      } catch {
        g.asked--;
        if (!resume) g.sessions.delete(suspectId);
        throw new GameError(502, "the suspect could not answer");
      }
      g.tokens += r.inputTokens + r.outputTokens;
      return { answer: r.text, questionsLeft: MAX_QUESTIONS - g.asked, tokensUsed: g.tokens };
    },

    accuse(gameId: string, suspectId: string, motiveId: string): Verdict {
      const g = get(gameId);
      if (g.accused) throw new GameError(409, "already accused");
      if (!g.c.suspects.some((s) => s.id === suspectId))
        throw new GameError(400, "unknown suspect");
      if (!g.c.motives.some((m) => m.id === motiveId)) throw new GameError(400, "unknown motive");
      g.accused = true;
      const correctKiller = suspectId === g.c.solution.killerId;
      const correctMotive = motiveId === g.c.solution.motiveId;
      return {
        correctKiller,
        correctMotive,
        solved: correctKiller && correctMotive,
        solution: g.c.solution,
      };
    },
  };
}
