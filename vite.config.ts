import { defineConfig } from "vite";
import { trailApi } from "./src/server/vitePlugin";

export default defineConfig({
  root: "src/web",
  plugins: [trailApi()],
  server: { port: 5173 },
});
