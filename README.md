# Piotrek's Toolbox

Personal toolbox website built with [Astro](https://astro.build), [React](https://react.dev), and [Cloudscape Design System](https://cloudscape.design).

Live at [tools.piotrekwitkowski.com](https://tools.piotrekwitkowski.com).

## Tools

- **Domain Lookup** — DNS, WHOIS, and registry info for any domain
- **Datasets** — Public datasets for download

## Data

Datasets are auto-updated by GitHub Actions workflows. See `scripts/` and `.github/workflows/`.

## Development

```bash
npm install
npm run dev       # Start dev server
npm run build     # Production build → dist/
```

## Adding a Tool

1. Add a navigation entry in `src/components/SideNav.tsx`.
2. Create a page at `src/pages/<tool-name>.astro`.
3. Wrap content in `<Layout>`. Add `client:idle` to the React component for interactivity, or `client:only="react"` if it uses browser-only APIs (`window`, `localStorage`, etc.).
