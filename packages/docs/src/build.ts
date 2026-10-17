import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { prepare } from "@temples/ssr";
import { markdownToHtml } from "./markdown";

/** Root directory of the docs workspace. */
const DOCS_DIR = resolve(import.meta.dir, "..");

/**
 * Canonical public URL of the deployed site, used for the absolute links.
 *
 * Set `BASE_URL` at build time, for example
 * `BASE_URL=https://zipang.github.io/temples bun run build:docs`. A build
 * without the variable falls back to the canonical production URL. Set it to
 * the local origin (`BASE_URL=http://localhost:4173`) to keep the absolute
 * links local. A trailing slash is ignored.
 */
export const BASE_URL = (process.env.BASE_URL ?? "https://zipang.github.io/temples").replace(
	/\/+$/,
	""
);

/** The directory holding the markdown sources. */
const CONTENT_DIR = resolve(DOCS_DIR, "content");

/** The directory receiving the built site. */
const WWW_DIR = resolve(DOCS_DIR, "www");

/** Front-matter and body of one markdown source file. */
interface PageSource {
	slug: string;
	title: string;
	description: string;
	order: number;
	hidden: boolean;

	/** The full file, front-matter included, for the markdown export. */
	raw: string;

	/** The body, without the front-matter block, rendered into the HTML page. */
	markdown: string;
}

/** Options for `buildSite`. */
export interface BuildOptions {
	/** Canonical origin baked into every absolute link. Defaults to `BASE_URL`. */
	baseUrl?: string;

	/** Directory receiving the built site. Defaults to `www/`. */
	outDir?: string;
}

/** Metadata of one built page, as consumed by the layout and llms.txt. */
interface PageMeta extends Record<string, string> {
	slug: string;
	title: string;
	description: string;
	/** URL of the rendered page, relative to the site root. */
	url: string;
	/** URL of the raw markdown export, relative to the site root. */
	markdownUrl: string;
}

/**
 * Parse a `---` delimited front-matter block from the top of a markdown file.
 *
 * Each line of the block holds a `key: value` pair. Unknown keys are ignored.
 *
 * @param raw - The full markdown file content.
 * @param slug - The page slug, used for error messages.
 * @returns The parsed fields and the markdown body without the block.
 */
const parseFrontMatter = (
	raw: string,
	slug: string
): { fields: Record<string, string>; body: string } => {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);

	if (match === null || match[1] === undefined) {
		throw new Error(`Missing front-matter block in content/${slug}.md`);
	}

	const fields: Record<string, string> = {};

	for (const line of match[1].split(/\r?\n/)) {
		const index = line.indexOf(":");

		if (index > 0) {
			fields[line.slice(0, index).trim()] = line.slice(index + 1).trim();
		}
	}

	return { fields, body: raw.slice(match[0].length) };
};

/**
 * Load every markdown page from `content/`, nested directories included.
 *
 * A page in a subdirectory (such as `recipes/messages.md`) is a **referenced
 * page**: the build renders it and exports its markdown, and `llms.txt` lists
 * it, but it stays out of the page navigation. Its slug keeps the directory.
 *
 * @returns The page sources, sorted for the navigation.
 */
const loadPages = async (): Promise<PageSource[]> => {
	const glob = new Bun.Glob("**/*.md");
	const slugs: string[] = [];

	for await (const file of glob.scan({ cwd: CONTENT_DIR })) {
		slugs.push(file.replace(/\.md$/, ""));
	}

	const pages = await Promise.all(
		slugs.map(async (slug): Promise<PageSource> => {
			const raw = await Bun.file(resolve(CONTENT_DIR, `${slug}.md`)).text();
			const { fields, body } = parseFrontMatter(raw, slug);

			if (fields.title === undefined || fields.title === "") {
				throw new Error(`Missing title in front-matter of content/${slug}.md`);
			}

			return {
				slug,
				title: fields.title,
				description: fields.description ?? "",
				order: Number(fields.order ?? 100),
				hidden: fields.hidden === "true",
				raw,
				markdown: body
			};
		})
	);

	return pages.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
};

/**
 * Rewrite the relative page links of a markdown source to absolute URLs.
 *
 * An author writes a short relative link (`binding-syntax.html`). The build
 * makes it absolute, so a reader copies or fetches it without resolving a path.
 * The HTML page keeps the `.html` target. The markdown export points at the
 * `.md` twin, because agents read the markdown export.
 *
 * @param markdown - The markdown source.
 * @param extension - The target extension: `"html"` or `"md"`.
 * @param baseUrl - The canonical origin prefixed to every link.
 * @returns The markdown with every relative page link made absolute.
 */
const absoluteLinks = (markdown: string, extension: "html" | "md", baseUrl: string): string =>
	markdown.replace(/\]\(([^)\s]+)\)/g, (match, target: string) => {
		const hashAt = target.indexOf("#");
		const path = hashAt === -1 ? target : target.slice(0, hashAt);
		const hash = hashAt === -1 ? "" : target.slice(hashAt);

		if (!path.endsWith(".html")) return match;
		if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return match;

		return `](${baseUrl}/${path.slice(0, -".html".length)}.${extension}${hash})`;
	});

/**
 * Build the llms.txt index consumed by AI coding agents.
 *
 * Each page links to its raw markdown export: agents read markdown, not HTML.
 * The index is the agent entry point, so it lists every page, the referenced
 * recipes included.
 *
 * @param pages - The metadata of every built page.
 * @param baseUrl - The canonical origin prefixed to every link.
 * @returns The llms.txt content.
 */
const buildLlmsTxt = (pages: PageMeta[], baseUrl: string): string => {
	const lines = [
		"# temples documentation",
		"",
		"> Declarative HTML templates: plain HTML with data-bind attributes, rendered by a DOM-based engine in the browser and on the server.",
		"",
		"## Pages",
		""
	];

	for (const page of pages) {
		const description = page.description === "" ? page.title : page.description;
		lines.push(`- [${page.title}](${baseUrl}/${page.markdownUrl}): ${description}`);
	}

	lines.push("", `Sources: https://github.com/zipang/temples`, "");

	return lines.join("\n");
};

/**
 * Build the static documentation site into `www/`.
 *
 * Every markdown page is converted to HTML, rendered through the temples
 * layout with `@temples/ssr`, and written as `<slug>.html`. Its raw markdown
 * source is rewritten with `.md` links and written next to it as `<slug>.md`,
 * for agents reading plain text. The stylesheet and an `llms.txt` agent index
 * are emitted alongside; the index references the markdown exports. Pages with
 * `hidden: true` are built but excluded from the navigation, the markdown
 * exports, and `llms.txt`. A page in a subdirectory is built and exported, and
 * it appears in `llms.txt`, but it stays out of the navigation.
 *
 * @param options - The build options: `baseUrl` and `outDir`.
 * @returns The metadata of every built page.
 */
export const buildSite = async (options: BuildOptions = {}): Promise<PageMeta[]> => {
	const baseUrl = options.baseUrl ?? BASE_URL;
	const outDir = options.outDir ?? WWW_DIR;
	const sources = await loadPages();
	const visible = sources.filter((source) => !source.hidden);
	const metas: PageMeta[] = visible.map((source) => ({
		slug: source.slug,
		title: source.title,
		description: source.description,
		url: `${source.slug}.html`,
		markdownUrl: `${source.slug}.md`
	}));
	// Only top-level pages enter the navigation. A page in a subdirectory is
	// referenced from another page and from llms.txt instead.
	const navMetas = metas.filter((meta) => !meta.slug.includes("/"));

	const layout = await Bun.file(resolve(DOCS_DIR, "layout.html")).text();
	const renderLayout = prepare(layout, { removeDataBindings: false });

	await mkdir(outDir, { recursive: true });

	await Bun.write(
		resolve(outDir, "assets", "style.css"),
		Bun.file(resolve(DOCS_DIR, "assets", "style.css"))
	);

	for (const source of sources) {
		// One `../` per directory level, so the shared asset, home, index, and
		// navigation links stay correct for a page in a subdirectory.
		const base = "../".repeat(source.slug.split("/").length - 1);

		/**
		 * The nav data of this page: every navigation page, with a helper that
		 * derives the `current` state class from the rendered page slug.
		 */
		const nav = navMetas.map((meta) => ({
			title: meta.title,
			url: `${base}${meta.url}`,
			/**
			 * The state class of the item: `current` when it matches the page.
			 */
			status: (): string => (meta.slug === source.slug ? "current" : "")
		}));

		const html = await renderLayout({
			site: {
				pages: nav,
				homeUrl: `${base}index.html`,
				styleUrl: `${base}assets/style.css`,
				llmsUrl: `${base}llms.txt`
			},
			page: {
				title: source.title,
				description: source.description,
				content: markdownToHtml(absoluteLinks(source.markdown, "html", baseUrl)),
				markdownUrl: source.hidden ? "" : `${baseUrl}/${source.slug}.md`
			}
		});

		const htmlPath = resolve(outDir, `${source.slug}.html`);

		await mkdir(dirname(htmlPath), { recursive: true });
		await Bun.write(htmlPath, html);

		if (!source.hidden) {
			const mdPath = resolve(outDir, `${source.slug}.md`);

			await mkdir(dirname(mdPath), { recursive: true });
			await Bun.write(mdPath, absoluteLinks(source.raw, "md", baseUrl));
		}
	}

	await Bun.write(resolve(outDir, "llms.txt"), buildLlmsTxt(metas, baseUrl));

	return metas;
};

if (import.meta.main) {
	const pages = await buildSite();
	console.log(`Built ${pages.length} pages into packages/docs/www (BASE_URL: ${BASE_URL}):`);

	for (const page of pages) {
		console.log(`  ${page.url}`);
	}
}
