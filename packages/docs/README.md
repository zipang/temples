# @temples/docs

The documentation site of the temples packages — built **with temples itself**.

## How it works

```
content/**/*.md  ──Bun.markdown──▶  HTML fragments
                                     │
layout.html  ──@temples/ssr prepare()─▶  www/<slug>.html  +  www/assets/style.css
content/**/*.md  ──link rewrite──────▶  www/<slug>.md  (plain-text counterpart)
                                     │
                                     └──▶  www/llms.txt  (agent index, links the .md files)
```

- `content/*.md` — one file per page. The front-matter block carries `title`, `description`,
  and `order` (nav ordering). A page with `hidden: true` is built but stays out of the
  navigation, the markdown exports, and `llms.txt`.
- `content/recipes/*.md` — a page in a subdirectory is a **referenced page**: the build renders
  it and exports its markdown, and `llms.txt` lists it, but it stays out of the sidebar. A
  referenced page is reached from another page, such as the "Recipes and good practices" chapter
  of the components guide.
- **Links are absolute.** An author writes a short relative link (`binding-syntax.html`). The
  build rewrites it to the canonical URL: `.html` in the page, and the `.md` twin in the
  markdown export. The shell links (stylesheet, home, `llms.txt`, sidebar) stay relative, so the
  site renders locally and under any base path.
- **`BASE_URL`** is the canonical origin baked into those absolute links. The workflow sets it to
  the deployed URL. A build without it falls back to `https://zipang.github.io/temples`. To keep
  local links local, build with `BASE_URL=http://localhost:4173 bun run build:docs`.
- `content/404.md` — the 404 error page, kept out of the navigation by `hidden: true`.
- `layout.html` — a temples template: the nav iterates `site.pages` (`data-iterate`), the page
  body is injected with `data-bind="html=page.content"`. The head declares the markdown export
  of the page with `<link rel="alternate" type="text/markdown">`, kept only while
  `data-render-if="page.markdownUrl"` is truthy — hidden pages carry an empty `markdownUrl`,
  so they emit no link. It also declares `<link rel="describedby" href="llms.txt">`, the agent
  index covering the site, as recommended by [llmstxt.org](https://llmstxt.org/).
- `src/markdown.ts` — the only module that touches `Bun.markdown` (an unstable Bun API), so a
  parser swap stays a one-file change.
- `src/build.ts` — the pipeline. `buildSite()` is exported for tests; the script runs it when
  executed directly. It copies every visible page as raw markdown next to its HTML file.
- `src/serve.ts` — rebuilds the site with the local origin as `BASE_URL`, so every absolute
  link points back at the preview, then serves `www/` with a Bun file route for the root and a
  `fetch` handler for every other path. When the path does not name a file in `www/`, the
  handler serves `404.html` with status 404.

## Commands

Run these commands from inside `packages/docs/`. The build regenerates `www/` completely,
so never edit its files by hand.

```sh
bun run build    # build the site into www/
bun run serve    # rebuild with the local base URL, then serve www/ at http://localhost:4173
bun test         # the build has a smoke test (build.test.ts)
```

## Deployment

The site is a plain static output: any static host works, with `www/` as the publish directory
and `bun install && bun run build:docs` as the build command.

- **GitHub Pages** — `.github/workflows/deploy-docs.yml` deploys on every push to `master`. Pages serves
  the site under a subpath (`/temples/`), which the build supports because all asset and page
  links are relative. Pages also uses `www/404.html` as its error page.
- **Vercel / Netlify / Cloudflare Pages** — create a project pointed at this repository with:
  - build command: `bun install && bun run build:docs`
  - output directory: `packages/docs/www`
- **LLM agents** — the build emits `www/llms.txt`, an index of every page with absolute links
  to its raw markdown (`<slug>.md`), so agents fetch plain text instead of HTML.
