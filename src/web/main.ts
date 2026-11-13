import { DIFFICULTIES, type Difficulty, type PublicCase } from "../shared/case";
import { caseDetails, difficultyLabel, initials, loadingLabel, mapView, percent } from "./format";

type Verdict = {
  correctKiller: boolean;
  correctMotive: boolean;
  solved: boolean;
  solution: { killerId: string; motiveId: string; explanation: string };
};

const app = document.getElementById("app") as HTMLElement;

// One persistent live region announces waiting states (spinners themselves are aria-hidden).
const liveRegion = document.createElement("div");
liveRegion.className = "sr-only";
liveRegion.setAttribute("role", "status");
liveRegion.setAttribute("aria-live", "polite");
document.body.append(liveRegion);

async function api<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? "request failed");
  return json as T;
}

function spinnerNode(label: string): HTMLElement {
  return el(
    "span",
    { className: "loading" },
    el("span", { className: "spinner", ariaHidden: "true" }),
    label,
  );
}

// Swaps the button's content for a spinner + label while fn runs; restores it afterwards
// (unless the screen was replaced in the meantime).
async function withSpinner<T>(button: HTMLButtonElement, label: string, fn: () => Promise<T>) {
  const saved = [...button.childNodes];
  button.replaceChildren(spinnerNode(label));
  liveRegion.textContent = label;
  try {
    return await fn();
  } finally {
    liveRegion.textContent = "";
    if (button.isConnected) button.replaceChildren(...saved);
  }
}

function mount(...nodes: (Node | string)[]) {
  app.replaceChildren(...nodes);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children);
  return e;
}

function showCase(gameId: string, c: PublicCase) {
  mount(
    el(
      "section",
      { className: "paper" },
      el("span", { className: "stamp" }, "CONFIDENTIAL"),
      el("h1", {}, c.title),
      el("p", { className: "muted" }, c.setting),
      el("p", {}, el("strong", {}, "Victim: "), c.victim),
      el("p", {}, c.briefing),
    ),
    el("h2", {}, "Suspects"),
    el(
      "div",
      { className: "grid" },
      ...c.suspects.map((s) =>
        el(
          "article",
          { className: "card" },
          el(
            "div",
            { className: "head" },
            el("span", { className: "avatar" }, initials(s.name)),
            el(
              "div",
              {},
              el("div", { className: "name" }, s.name),
              el("div", { className: "muted" }, s.role),
            ),
          ),
          el("p", { className: "statement" }, s.publicStatement),
        ),
      ),
    ),
    el(
      "div",
      { className: "actions" },
      el(
        "button",
        { className: "primary", onclick: () => showInterrogation(gameId, c, [], 20, 0) },
        "Begin investigation",
      ),
    ),
    menuButton(),
  );
}

type CaseListItem = { caseId: string; title: string; difficulty: Difficulty };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? "request failed");
  return json as T;
}

function menuButton(): HTMLElement {
  return el(
    "div",
    { className: "actions" },
    el("button", { onclick: () => void showMenu() }, "Main menu"),
  );
}

async function play(caseId: string, button?: HTMLButtonElement) {
  const start = () => api<{ gameId: string; case: PublicCase }>("/api/games", { caseId });
  const g = button ? await withSpinner(button, loadingLabel("start"), start) : await start();
  showCase(g.gameId, g.case);
}

function generateSection(): HTMLElement {
  const error = el("p", { className: "error", role: "alert" });
  const btn = el("button", { className: "primary" }, "Generate");
  const radios = DIFFICULTIES.map((d) =>
    el(
      "label",
      { className: "radio" },
      el("input", { type: "radio", name: "difficulty", value: d, checked: d === "medium" }),
      ` ${difficultyLabel(d)}`,
    ),
  );
  btn.onclick = async () => {
    const buttons = app.querySelectorAll("button");
    const inputs = app.querySelectorAll("input");
    const disable = (on: boolean) => {
      buttons.forEach((b) => (b.disabled = on));
      inputs.forEach((i) => (i.disabled = on));
    };
    const difficulty =
      radios.map((r) => r.querySelector("input")).find((i) => i?.checked)?.value ?? "medium";
    disable(true);
    error.textContent = "";
    try {
      const { caseId } = await withSpinner(btn, loadingLabel("generate"), () =>
        api<{ caseId: string; title: string }>("/api/cases/generate", { difficulty }),
      );
      await play(caseId, btn);
    } catch (e) {
      error.textContent = (e as Error).message;
      disable(false);
    }
  };
  return el(
    "section",
    { className: "paper" },
    el("h2", {}, "Generate a new case"),
    el("fieldset", { className: "difficulty" }, el("legend", {}, "Difficulty"), ...radios),
    el("div", { className: "actions" }, btn, error),
  );
}

async function showMenu() {
  const list = el("ul", { className: "case-list" });
  const error = el("p", { className: "error", role: "alert" });
  mount(
    el("h1", {}, "TrAIl of Lies"),
    el("p", { className: "muted" }, "A murder mystery. Every suspect is played by Claude."),
    el("h2", {}, "Ready cases"),
    list,
    error,
    generateSection(),
  );
  try {
    const cases = await getJson<CaseListItem[]>("/api/cases");
    if (cases.length === 0) {
      list.replaceChildren(el("li", { className: "muted" }, "No cases yet — generate one below."));
      return;
    }
    list.replaceChildren(
      ...cases.map((c) =>
        el(
          "li",
          { className: "card case-item" },
          el("span", { className: "name" }, c.title),
          el("span", { className: `badge badge-${c.difficulty}` }, difficultyLabel(c.difficulty)),
          el(
            "button",
            {
              onclick: (ev: MouseEvent) => {
                const all = app.querySelectorAll("button");
                all.forEach((b) => (b.disabled = true));
                error.textContent = "";
                void play(c.caseId, ev.currentTarget as HTMLButtonElement).catch((e) => {
                  error.textContent = (e as Error).message;
                  all.forEach((b) => (b.disabled = false));
                });
              },
            },
            "Play",
          ),
        ),
      ),
    );
  } catch (e) {
    error.textContent = (e as Error).message;
  }
}

type Line = { mine: boolean; who: string; text: string; suspectId: string };

function meter(label: string, value: string, pct: number, cls = ""): HTMLElement {
  const bar = el("progress", { className: `bar ${cls}`.trim(), max: 100, value: pct });
  return el(
    "div",
    { className: "meter" },
    el("div", { className: "meter-row" }, el("span", {}, label), el("strong", {}, value)),
    bar,
  );
}

type PanelTab = "details" | "map";

// Survives re-renders (after an answer, or coming back from the accusation screen).
let panelTab: PanelTab | null = null;

const PANEL_ID = "case-panel";
const BODY_ID = "case-panel-body";

const SVG_NS = "http://www.w3.org/2000/svg";

function svg(tag: string, attrs: Record<string, string>, text?: string): SVGElement {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

const FONT = 4.6;
const PAD = 12;

/** Rough text width in map units. */
function textWidth(text: string, size: number): number {
  return text.length * 0.55 * size;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function renderMap(c: PublicCase): Node[] {
  const points = mapView(c);
  const lo = -PAD + 1;
  const hi = 100 + PAD - 1;
  const root = svg("svg", {
    viewBox: `${-PAD} ${-PAD} ${100 + 2 * PAD} ${100 + 2 * PAD}`,
    class: "map-svg",
    role: "img",
  });
  root.setAttribute(
    "aria-label",
    `Map of ${c.setting}. ${points.length} locations; the text list below has the same facts.`,
  );
  root.append(
    svg("rect", {
      x: String(-PAD),
      y: String(-PAD),
      width: String(100 + 2 * PAD),
      height: String(100 + 2 * PAD),
      class: "map-bg",
    }),
  );
  for (const p of points) {
    const g = svg("g", { class: "map-loc" });
    const labelW = Math.max(
      textWidth(p.name, FONT),
      p.victim ? textWidth("Victim found here", FONT) : 0,
    );
    // Put the label on the side with room for its estimated width, then clamp it inside.
    const left = p.x + 3 + labelW > hi;
    const lx = left ? Math.max(p.x - 3, lo + labelW) : Math.min(p.x + 3, hi - labelW);
    const ly = clamp(p.y + 1.5, lo + FONT, hi - (p.victim ? 6 : 1));
    g.append(svg("circle", { cx: String(p.x), cy: String(p.y), r: "1.8", class: "map-dot" }));
    g.append(
      svg(
        "text",
        { x: String(lx), y: String(ly), "text-anchor": left ? "end" : "start", class: "map-label" },
        p.name,
      ),
    );
    if (p.victim) {
      const d = 2.6;
      g.append(
        svg("path", {
          d: `M${p.x - d} ${p.y - d}L${p.x + d} ${p.y + d}M${p.x - d} ${p.y + d}L${p.x + d} ${p.y - d}`,
          class: "map-cross",
        }),
        svg(
          "text",
          {
            x: String(lx),
            y: String(ly + 5.5),
            "text-anchor": left ? "end" : "start",
            class: "map-victim",
          },
          "Victim found here",
        ),
      );
    }
    const step = 8;
    const n = p.suspects.length;
    p.suspects.forEach((s, i) => {
      const bx = clamp(p.x + (i - (n - 1) / 2) * step, lo + 3.6, hi - 3.6);
      const by = clamp(p.y - 7, lo + 3.6, hi - 3.6);
      g.append(
        svg("circle", { cx: String(bx), cy: String(by), r: "3.6", class: "map-badge" }),
        svg(
          "text",
          { x: String(bx), y: String(by + 1.5), "text-anchor": "middle", class: "map-initials" },
          s.initials,
        ),
      );
    });
    root.append(g);
  }
  const legend = el(
    "ul",
    { className: "map-legend" },
    el("li", {}, "\u25CF Location"),
    el("li", {}, el("span", { className: "map-x" }, "\u2715"), " Victim found here"),
    el("li", {}, "(AB) Suspect's claimed location"),
  );
  const facts = el(
    "ul",
    { className: "map-facts" },
    ...points.flatMap((p) => [
      ...p.suspects.map((s) => el("li", {}, `${s.name} says: ${p.name}`)),
      ...(p.victim ? [el("li", {}, `Victim found: ${p.name}`)] : []),
    ]),
  );
  return [root, legend, facts];
}

function renderPanel(tab: PanelTab, c: PublicCase): Node[] {
  if (tab === "map") return renderMap(c);
  const label = (text: string) => el("div", { className: "label" }, text);
  if (tab === "details") {
    const d = caseDetails(c);
    return [
      el("h3", {}, d.title),
      label("SETTING"),
      el("p", {}, d.setting),
      label("VICTIM"),
      el("p", {}, d.victim),
      label("BRIEFING"),
      el("p", {}, d.briefing),
      label("SUSPECTS"),
      ...d.suspects.map((s) =>
        el("p", {}, el("strong", {}, `${s.name} \u2014 ${s.role}`), el("br"), s.publicStatement),
      ),
      label("MOTIVES"),
      el("ul", {}, ...d.motives.map((m) => el("li", {}, m))),
    ];
  }
  return [];
}

/** Builds the docked panel and its toggle; opening/closing only flips classes and hidden. */
function casePanel(c: PublicCase): {
  toggle: HTMLElement;
  mapToggle: HTMLElement;
  panel: HTMLElement;
} {
  const toggle = el("button", { className: "details-btn", type: "button" }, "Case details");
  toggle.setAttribute("aria-controls", PANEL_ID);
  const mapToggle = el("button", { className: "details-btn", type: "button" }, "Map");
  mapToggle.setAttribute("aria-controls", PANEL_ID);
  const tabBtn = el("button", { className: "panel-tab", type: "button" }, "Case details");
  tabBtn.setAttribute("role", "tab");
  tabBtn.setAttribute("aria-controls", BODY_ID);
  const mapTab = el("button", { className: "panel-tab", type: "button" }, "Map");
  mapTab.setAttribute("role", "tab");
  mapTab.setAttribute("aria-controls", BODY_ID);
  const closeBtn = el("button", { className: "panel-close", type: "button" }, "Close");
  closeBtn.setAttribute("aria-controls", PANEL_ID);
  const body = el("div", { className: "panel-body", id: BODY_ID });
  body.setAttribute("role", "tabpanel");
  const panel = el(
    "aside",
    { className: "panel", id: PANEL_ID },
    el(
      "div",
      { className: "panel-head" },
      el("div", { className: "panel-tabs", role: "tablist" }, tabBtn, mapTab),
      closeBtn,
    ),
    body,
  );
  panel.setAttribute("aria-label", "Case details");
  const apply = () => {
    const open = panelTab !== null;
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(panelTab === "details"));
    mapToggle.setAttribute("aria-expanded", String(panelTab === "map"));
    tabBtn.setAttribute("aria-selected", String(panelTab === "details"));
    mapTab.setAttribute("aria-selected", String(panelTab === "map"));
    panel.setAttribute("aria-label", panelTab === "map" ? "Map" : "Case details");
    panel.parentElement?.classList.toggle("panel-open", open);
    if (panelTab) body.replaceChildren(...renderPanel(panelTab, c));
  };
  const setTab = (tab: PanelTab) => {
    panelTab = panelTab === tab ? null : tab;
    apply();
  };
  toggle.onclick = () => setTab("details");
  mapToggle.onclick = () => setTab("map");
  tabBtn.onclick = () => setTab("details");
  mapTab.onclick = () => setTab("map");
  closeBtn.onclick = () => {
    const from = panelTab === "map" ? mapToggle : toggle;
    panelTab = null;
    apply();
    from.focus();
  };
  apply();
  return { toggle, mapToggle, panel };
}

function showInterrogation(
  gameId: string,
  c: PublicCase,
  transcript: Line[],
  questionsLeft: number,
  tokensUsed: number,
  selectedId: string = c.suspects[0]?.id ?? "",
) {
  const asked = (id: string) => transcript.filter((l) => l.mine && l.suspectId === id).length;
  const selected = c.suspects.find((s) => s.id === selectedId) ?? c.suspects[0];
  if (!selected) return;
  const { toggle, mapToggle, panel } = casePanel(c);
  const box = el("input", { type: "text", maxLength: 300, id: "question" });
  const error = el("p", { className: "error", role: "alert" });
  const ask = el("button", { className: "primary", type: "submit" }, "Ask");
  const setBusy = (busy: boolean) =>
    app
      .querySelectorAll("button:not(.details-btn):not(.panel-tab):not(.panel-close)")
      .forEach((b) => ((b as HTMLButtonElement).disabled = busy));
  const submit = async () => {
    const question = box.value;
    setBusy(true);
    error.textContent = "";
    const label = loadingLabel("ask", selected.name);
    liveRegion.textContent = label;
    const thinking = el("div", { className: "bubble them thinking" }, spinnerNode(label));
    const log = app.querySelector(".transcript");
    log?.append(thinking);
    thinking.scrollIntoView?.({ block: "nearest" });
    try {
      const r = await api<{ answer: string; questionsLeft: number; tokensUsed: number }>(
        `/api/games/${gameId}/ask`,
        { suspectId: selected.id, question },
      );
      showInterrogation(
        gameId,
        c,
        [
          ...transcript,
          { mine: true, who: "You", text: question, suspectId: selected.id },
          { mine: false, who: selected.name, text: r.answer, suspectId: selected.id },
        ],
        r.questionsLeft,
        r.tokensUsed,
        selected.id,
      );
    } catch (e) {
      thinking.remove();
      error.textContent = (e as Error).message;
      setBusy(false);
    } finally {
      liveRegion.textContent = "";
    }
  };
  const canAsk = questionsLeft > 0 && tokensUsed < 100_000;
  const form = canAsk
    ? el(
        "form",
        {
          className: "ask-form",
          onsubmit: (ev: Event) => {
            ev.preventDefault();
            void submit();
          },
        },
        el(
          "label",
          { htmlFor: "question", className: "label" },
          `Your question to ${selected.name}`,
        ),
        el("div", { className: "ask-row" }, box, ask),
        error,
      )
    : el(
        "div",
        { className: "ask-form" },
        el("p", {}, "No more questions. You must accuse."),
        error,
      );
  mount(
    el(
      "header",
      { className: "topbar" },
      el(
        "div",
        { className: "title-block" },
        el("h1", {}, c.title),
        el("div", { className: "title-btns" }, toggle, mapToggle),
      ),
      el(
        "div",
        { className: "meters" },
        meter("Questions left", `${questionsLeft} / 20`, percent(questionsLeft, 20)),
        meter(
          "Case token budget",
          `${Math.round(tokensUsed / 1000)}k / 100k`,
          percent(tokensUsed, 100_000),
          "budget",
        ),
      ),
    ),
    el(
      "div",
      { className: `interrogation${panelTab ? " panel-open" : ""}` },
      el(
        "div",
        { className: "suspect-list" },
        el("h2", {}, "Suspects"),
        ...c.suspects.map((s) => {
          const b = el(
            "button",
            { className: "suspect-btn", type: "button" },
            el("span", { className: "avatar" }, initials(s.name)),
            el(
              "span",
              { className: "info" },
              el("span", { className: "name" }, s.name),
              el("span", { className: "muted" }, s.role),
              el("span", { className: "muted" }, `${asked(s.id)} questions asked`),
            ),
          );
          b.setAttribute("aria-pressed", String(s.id === selected.id));
          b.onclick = () =>
            showInterrogation(gameId, c, transcript, questionsLeft, tokensUsed, s.id);
          return b;
        }),
      ),
      el(
        "section",
        { className: "chat" },
        el(
          "div",
          { className: "transcript" },
          ...transcript.map((l) =>
            el(
              "div",
              { className: `bubble ${l.mine ? "me" : "them"}` },
              el("span", { className: "who" }, l.mine ? "You" : l.who),
              l.text,
            ),
          ),
        ),
        form,
      ),
      panel,
    ),
    el(
      "div",
      { className: "actions" },
      el(
        "button",
        {
          className: "danger",
          onclick: () =>
            showAccusation(gameId, c, transcript, questionsLeft, tokensUsed, selected.id),
        },
        "Make accusation",
      ),
    ),
  );
}

function radioCard(
  group: string,
  value: string,
  checked: boolean,
  onSelect: () => void,
  ...content: (Node | string)[]
): HTMLElement {
  const input = el("input", { type: "radio", name: group, value, checked });
  input.onchange = onSelect;
  return el("label", { className: "choice" }, input, ...content);
}

function showAccusation(
  gameId: string,
  c: PublicCase,
  transcript: Line[],
  questionsLeft: number,
  tokensUsed: number,
  lastSelectedId?: string,
) {
  let killerId = c.suspects[0]?.id ?? "";
  let motiveId = c.motives[0]?.id ?? "";
  const error = el("p", { className: "error", role: "alert" });
  const back = el(
    "button",
    { className: "link", type: "button" },
    `Back to questioning (${questionsLeft} questions left)`,
  );
  const go = el("button", { className: "danger" });
  const nameOf = () => c.suspects.find((s) => s.id === killerId)?.name ?? "";
  const refresh = () => (go.textContent = `Accuse ${nameOf()}`);
  refresh();
  const lock = (on: boolean) => {
    go.disabled = on;
    app.querySelectorAll<HTMLInputElement>("input[type=radio]").forEach((i) => (i.disabled = on));
    back.disabled = on;
  };
  go.onclick = async () => {
    lock(true);
    try {
      const v = await withSpinner(go, loadingLabel("accuse"), () =>
        api<Verdict>(`/api/games/${gameId}/accuse`, { suspectId: killerId, motiveId }),
      );
      showVerdict(c, v);
    } catch (e) {
      error.textContent = (e as Error).message;
      lock(false);
      refresh();
    }
  };
  back.onclick = () =>
    showInterrogation(gameId, c, transcript, questionsLeft, tokensUsed, lastSelectedId);
  mount(
    el("h1", {}, "Accusation"),
    el("div", {}, back),
    el("h2", {}, "Who killed the victim?"),
    el(
      "div",
      { className: "grid" },
      ...c.suspects.map((s) =>
        radioCard(
          "killer",
          s.id,
          s.id === killerId,
          () => {
            killerId = s.id;
            refresh();
          },
          el("span", { className: "avatar" }, initials(s.name)),
          el(
            "span",
            {},
            el("span", { className: "name" }, s.name),
            el("br"),
            el("span", { className: "muted" }, s.role),
          ),
        ),
      ),
    ),
    el("h2", {}, "Why?"),
    el(
      "div",
      { className: "choices" },
      ...c.motives.map((m) =>
        radioCard("motive", m.id, m.id === motiveId, () => (motiveId = m.id), m.label),
      ),
    ),
    el("div", { className: "actions" }, go),
    error,
  );
}

function showVerdict(c: PublicCase, v: Verdict) {
  const name = c.suspects.find((s) => s.id === v.solution.killerId)?.name ?? v.solution.killerId;
  const motive = c.motives.find((m) => m.id === v.solution.motiveId)?.label ?? v.solution.motiveId;
  const result = (label: string, ok: boolean) =>
    el(
      "span",
      { className: `result ${ok ? "right" : "wrong"}` },
      `${label}: ${ok ? "Right" : "Wrong"}`,
    );
  const victim = c.victim;
  const heading = v.solved
    ? `Correct. ${name} killed ${victim}.`
    : v.correctKiller || v.correctMotive
      ? "Not quite."
      : "Wrong.";
  mount(
    el(
      "section",
      { className: "paper" },
      el(
        "span",
        { className: `stamp stamp-flow${v.solved ? " success" : ""}` },
        v.solved ? "CASE CLOSED" : "CASE UNSOLVED",
      ),
      el("h1", {}, heading),
      el(
        "div",
        { className: "results" },
        result("Killer", v.correctKiller),
        result("Motive", v.correctMotive),
      ),
      el("p", {}, `The killer was ${name}. Motive: ${motive}.`),
      el("p", {}, v.solution.explanation),
    ),
    menuButton(),
  );
}

void showMenu();
