import path from "node:path";
import { defineConfig } from "vitest/config";

// Mirrors tsconfig.json's "@/*": ["./*"] path alias, and mocks the
// "server-only" marker package (which unconditionally throws on import
// outside a "react-server" bundler condition Vitest doesn't set) so
// server-only library modules can be unit tested under plain Node.
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
