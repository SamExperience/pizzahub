import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { configDefaults } from "vitest/config";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    // Cloud Functions have their own Node test setup (npm run test:functions).
    exclude: [...configDefaults.exclude, "functions/**"],
  },
});
