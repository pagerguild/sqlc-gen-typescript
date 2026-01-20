import { defineConfig } from "rolldown";

export default defineConfig({
  input: "src/app.ts",
  output: {
    file: "out.js",
    format: "esm",
  },
  treeshake: true,
});
