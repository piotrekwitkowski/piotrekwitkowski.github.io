import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://tools.piotrekwitkowski.com",
  output: "static",
  integrations: [react()],
  vite: {
    plugins: [
      {
        name: "strip-cloudscape-fonts",
        enforce: "pre",
        transform(code, id) {
          if (!id.includes("@cloudscape-design/global-styles")) return;
          return code.replace(/@font-face\s*\{[^}]*\}/g, "");
        },
      },
    ],
    resolve: {
      noExternal: [/@cloudscape-design\//, "dom-helpers"],
    },
  },
});
