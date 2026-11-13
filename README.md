# TrAIl of Lies

A murder mystery where every suspect is played by Claude.

Read the case file, question three suspects (20 questions in total), then name the killer and the
motive. The innocent suspects are hiding secrets of their own. The killer lies.

## What you need

- **Node.js 22 or newer** (check with `node -v`). Download it from <https://nodejs.org>.
- **Claude Code**, installed and logged in with your own Claude subscription (Pro or Max).
  Install guide: <https://docs.claude.com/en/docs/claude-code/setup>.
  Check that it works: `claude --version`, then run `claude` once and log in.

There is no API key. The game runs the `claude` command on your computer, so the suspects use
your own Claude Code login.

## Launch the game

```bash
git clone <this repo's URL>
cd trail-of-lies
npm install
npm run dev
```

Then open <http://localhost:5173> in your browser.

To stop the game, press `Ctrl+C` in the terminal.

## How to play

1. Pick a case from the list. Or, under **Generate a new case**, choose a difficulty (easy,
   medium or hard) and click **Generate**. Generating a case takes a minute or two.
2. Read the case file: the victim, the scene, the suspects and the case map.
3. Question the suspects. You have 20 questions in total, up to 300 characters each.
4. Accuse: name the killer and the motive. The verdict then shows you the full truth.

## Subscription usage

- Every question to a suspect is one short call on **Haiku**.
- Generating a new case is one longer call on **Sonnet**. It can take a few retries if the first
  draft fails validation.
- Each case has a budget of 100k tokens. When it runs out, questioning ends and you must accuse.

The game only runs locally, on your own machine.

## Troubleshooting

- **`claude: command not found`**: Claude Code is not installed, or it is not on your `PATH`.
  Open a new terminal after installing it.
- **Suspects never answer, or you get an error**: run `claude -p "hello"` in a terminal. If that
  fails, log in again by running `claude`. You may also have hit your subscription's usage limit.
- **Port 5173 is busy**: Vite picks the next free port. Use the URL it prints in the terminal.

## For developers

```bash
npm run check       # typecheck + lint + unit tests + case validator
npm test            # unit tests only (they never call Claude)
npm run validate    # validate every cases/*.json
npm run generate    # generate a new case from the command line
npm run eval:leak   # leak eval: tries to make suspects reveal the truth (uses your subscription)
npm run eval:solve  # solver eval: an agent plays the cases (uses your subscription)
```

The project was built with an agentic workflow in Claude Code (spec, design, tests, build, review,
evals). See `CLAUDE.md`, the specs in `docs/specs/`, the decisions in `docs/adr/` and the
architecture diagrams in `docs/c4/`.
