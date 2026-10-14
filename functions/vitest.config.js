import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // The first import of the Firebase SDKs can be slow on a cold cache.
    testTimeout: 30000,
  },
});
