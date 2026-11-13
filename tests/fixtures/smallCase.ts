// Small in-test case. Shape assumption (implementer's CaseSchema must accept it):
// victim: string, knows: string[], clues: string[], solution.explanation: string.
export function makeSmallCase(): Record<string, any> {
  const suspect = (key: string, name: string, claimedLocationId: string) => ({
    id: `id-${key}`,
    name,
    role: `role-${key}`,
    publicStatement: `public-${key}`,
    persona: `PERSONA-${key}`,
    secret: `SECRET-${key}`,
    alibi: `ALIBI-${key}`,
    knows: key === "b" ? [`KNOWS-${key}`] : [`KNOWS-${key} saw Bob near the stairs and heard talk of revenge`],
    claimedLocationId,
  });
  return {
    id: "small",
    title: "Small Case",
    setting: "A small setting",
    difficulty: "medium",
    victim: "Victim Vic",
    briefing: "Briefing text",
    suspects: [
      suspect("a", "Alice", "loc-jetty"),
      suspect("b", "Bob", "loc-kitchen"),
      suspect("c", "Carol", "loc-cellar"),
    ],
    map: {
      locations: [
        { id: "loc-jetty", name: "The Jetty", x: 10, y: 80 },
        { id: "loc-kitchen", name: "Kitchen", x: 50, y: 30 },
        { id: "loc-cellar", name: "Cellar", x: 90, y: 60 },
        { id: "loc-stairs", name: "Back Stairs", x: 50, y: 70 },
      ],
      victimLocationId: "loc-stairs",
    },
    motives: [
      { id: "m1", label: "Money" },
      { id: "m2", label: "Revenge" },
      { id: "m3", label: "Love" },
      { id: "m4", label: "Fear" },
    ],
    clues: ["CLUE-ONE-TEXT", "CLUE-TWO-TEXT"],
    solution: { killerId: "id-b", motiveId: "m2", motiveKeyword: "revenge", explanation: "EXPLANATION-TEXT" },
  };
}
