import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://tools.piotrekwitkowski.com",
  output: "static",
  integrations: [react()],
  vite: {
    resolve: {
      noExternal: [/@cloudscape-design\//, "dom-helpers"],
    },
  },
});
