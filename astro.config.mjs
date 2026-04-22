import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://piotrekwitkowski.github.io",
  output: "static",
  integrations: [react()],
  vite: {
    ssr: {
      noExternal: [/@cloudscape-design\//, "dom-helpers"],
    },
  },
});
