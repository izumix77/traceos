import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["test/unit/**/*.test.js"],
    globals: false,
    environment: "node",
    onConsoleLog(log) {
      if (log.includes("ExperimentalWarning")) return false
    },
  },
})
