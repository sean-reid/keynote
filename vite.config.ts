import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@grammar": fileURLToPath(new URL("./src/grammar", import.meta.url)),
      "@sync": fileURLToPath(new URL("./src/sync", import.meta.url)),
      "@audio": fileURLToPath(new URL("./src/audio", import.meta.url)),
      "@stream": fileURLToPath(new URL("./src/stream", import.meta.url)),
      "@stage": fileURLToPath(new URL("./src/stage", import.meta.url)),
      "@ui": fileURLToPath(new URL("./src/ui", import.meta.url)),
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
