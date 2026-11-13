import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { CaseSchema } from "../shared/case";
import { createApiHandler } from "./api";
import { claudeRunner, cleanupSession, generatorRunner } from "./claude";
import { createGameStore } from "./game";
import { generateCase } from "./generator";

export function loadCases(dir = "cases") {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => CaseSchema.parse(JSON.parse(readFileSync(join(dir, f), "utf8"))));
}

export function trailApi(): Plugin {
  return {
    name: "trail-api",
    configureServer(server) {
      const handler = createApiHandler(
        createGameStore({ cases: loadCases(), runner: claudeRunner }),
        {
          generate: (difficulty) =>
            generateCase({ runner: generatorRunner, cleanup: cleanupSession, difficulty }),
        },
      );
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        let raw = "";
        for await (const chunk of req) raw += chunk;
        let body: unknown;
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          res.statusCode = 400;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ message: "invalid JSON" }));
          return;
        }
        const r = await handler({ method: req.method ?? "GET", url: req.url, body });
        res.statusCode = r.status;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(r.body));
      });
    },
  };
}
