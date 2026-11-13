import { z } from "zod";

const SuspectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  publicStatement: z.string().min(1),
  persona: z.string().min(1),
  secret: z.string().min(1),
  alibi: z.string().min(1),
  knows: z.array(z.string()),
  claimedLocationId: z.string().min(1),
});

const LocationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

const MapSchema = z.object({
  locations: z.array(LocationSchema).min(3).max(8),
  victimLocationId: z.string().min(1),
});

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const CaseSchema = z.object({
  id: z.string().min(1),
  difficulty: z.enum(DIFFICULTIES),
  title: z.string().min(1),
  setting: z.string().min(1),
  victim: z.string().min(1),
  briefing: z.string().min(1),
  suspects: z.array(SuspectSchema).length(3),
  map: MapSchema,
  motives: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).length(4),
  clues: z.array(z.string()),
  solution: z.object({
    killerId: z.string().min(1),
    motiveId: z.string().min(1),
    motiveKeyword: z.string().min(1),
    explanation: z.string().min(1),
  }),
});

export type Case = z.infer<typeof CaseSchema>;
export type Suspect = Case["suspects"][number];

export type CaseMap = Case["map"];

export type PublicCase = {
  id: string;
  difficulty: Difficulty;
  title: string;
  setting: string;
  victim: string;
  briefing: string;
  suspects: {
    id: string;
    name: string;
    role: string;
    publicStatement: string;
    claimedLocationId: string;
  }[];
  map: CaseMap;
  motives: { id: string; label: string }[];
};

export function toPublicCase(c: Case): PublicCase {
  return {
    id: c.id,
    difficulty: c.difficulty,
    title: c.title,
    setting: c.setting,
    victim: c.victim,
    briefing: c.briefing,
    suspects: c.suspects.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      publicStatement: s.publicStatement,
      claimedLocationId: s.claimedLocationId,
    })),
    map: {
      locations: c.map.locations.map((l) => ({ id: l.id, name: l.name, x: l.x, y: l.y })),
      victimLocationId: c.map.victimLocationId,
    },
    motives: c.motives.map((m) => ({ id: m.id, label: m.label })),
  };
}
