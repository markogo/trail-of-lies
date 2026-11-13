import type { PublicCase } from "../shared/case";

const TITLES = new Set(["dr", "mr", "mrs", "ms", "miss", "prof", "sir", "lady", "lord", "mx"]);

export function initials(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((w) => w && !TITLES.has(w.toLowerCase().replace(/\.$/, "")));
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function percent(used: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((used / total) * 100)));
}

export type CaseDetails = {
  title: string;
  setting: string;
  victim: string;
  briefing: string;
  suspects: { name: string; role: string; publicStatement: string }[];
  motives: string[];
};

export function caseDetails(c: PublicCase): CaseDetails {
  return {
    title: c.title,
    setting: c.setting,
    victim: c.victim,
    briefing: c.briefing,
    suspects: c.suspects.map((s) => ({
      name: s.name,
      role: s.role,
      publicStatement: s.publicStatement,
    })),
    motives: c.motives.map((m) => m.label),
  };
}

export type MapPoint = {
  name: string;
  x: number;
  y: number;
  victim: boolean;
  suspects: { name: string; initials: string }[];
};

export function mapView(c: PublicCase): MapPoint[] {
  return c.map.locations.map((l) => ({
    name: l.name,
    x: l.x,
    y: l.y,
    victim: l.id === c.map.victimLocationId,
    suspects: c.suspects
      .filter((s) => s.claimedLocationId === l.id)
      .map((s) => ({ name: s.name, initials: initials(s.name) })),
  }));
}

export function difficultyLabel(d: string): string {
  return d.charAt(0).toUpperCase() + d.slice(1);
}

export type LoadingKind = "ask" | "generate" | "start" | "accuse";

export function loadingLabel(kind: LoadingKind, name?: string): string {
  switch (kind) {
    case "ask":
      return `${name ?? "The suspect"} is thinking…`;
    case "generate":
      return "Writing a new case…";
    case "start":
      return "Opening the case file…";
    case "accuse":
      return "Weighing the evidence…";
  }
}
