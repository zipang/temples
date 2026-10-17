import { describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { BASE_URL, buildSite } from "./build";

/**
 * Output directory of the tests. It is a temporary directory, so a test run
 * never overwrites the preview build in `www/`.
 */
const wwwDir = resolve(tmpdir(), "temples-docs-test");

/** Canonical public URL baked into the absolute links (from `BASE_URL`). */
const siteUrl = BASE_URL;

/**
 * Build the site for the test run: the canonical base URL, into the temporary
 * output directory.
 *
 * @returns The metadata of every built page.
 */
const build = () => buildSite({ baseUrl: siteUrl, outDir: wwwDir });

describe("docs build", () => {
	test("builds every page, the stylesheet, and llms.txt", async () => {
		const pages = await build();

		expect(pages.length).toBeGreaterThanOrEqual(3);

		const index = await Bun.file(resolve(wwwDir, "index.html")).text();

		expect(index).toContain("<!DOCTYPE html>");
		expect(index).toContain("assets/style.css");

		const llms = await Bun.file(resolve(wwwDir, "llms.txt")).text();

		expect(llms).toContain("# temples documentation");
		expect(llms).toContain("## Pages");

		for (const page of pages) {
			const html = await Bun.file(resolve(wwwDir, page.url)).text();

			expect(html).toContain("<!DOCTYPE html>");
			expect(html).toContain(page.title);
		}
	});

	test("builds a 404 page that is excluded from the navigation and llms.txt", async () => {
		await build();

		const index = await Bun.file(resolve(wwwDir, "index.html")).text();
		const llms = await Bun.file(resolve(wwwDir, "llms.txt")).text();
		const notFound = await Bun.file(resolve(wwwDir, "404.html")).text();

		expect(notFound).toContain("Page not found");
		expect(notFound).toContain('href="getting-started.html"');

		expect(index).not.toContain('href="404.html"');
		expect(llms).not.toContain("404");
	});

	test("exports each visible page as raw markdown, referenced by llms.txt", async () => {
		await build();

		const markdown = await Bun.file(resolve(wwwDir, "getting-started.md")).text();

		expect(markdown).toContain("title: Getting started");
		expect(markdown).toContain("# Getting started");

		const llms = await Bun.file(resolve(wwwDir, "llms.txt")).text();

		expect(llms).toContain(`(${siteUrl}/getting-started.md)`);
		expect(llms).not.toContain(".html");

		const notFoundMarkdown = Bun.file(resolve(wwwDir, "404.md"));

		expect(await notFoundMarkdown.exists()).toBe(false);
	});

	test("declares the llms.txt index as a describedby link", async () => {
		await build();

		const page = await Bun.file(resolve(wwwDir, "getting-started.html")).text();

		expect(page).toContain('<link rel="describedby" href="llms.txt">');
	});

	test("declares the absolute markdown export as an alternate link in each visible page", async () => {
		await build();

		const page = await Bun.file(resolve(wwwDir, "getting-started.html")).text();

		expect(page).toContain(
			`<link rel="alternate" type="text/markdown" href="${siteUrl}/getting-started.md">`
		);

		const notFound = await Bun.file(resolve(wwwDir, "404.html")).text();

		expect(notFound).not.toContain('type="text/markdown"');
	});

	test("builds a recipe in a subdirectory with shell links that resolve", async () => {
		await build();

		const recipe = await Bun.file(resolve(wwwDir, "recipes", "messages.html")).text();

		expect(recipe).toContain("How to send messages");
		expect(recipe).toContain('href="../assets/style.css"');
		expect(recipe).toContain('href="../components.html"');

		const markdown = Bun.file(resolve(wwwDir, "recipes", "messages.md"));

		expect(await markdown.exists()).toBe(true);
	});

	test("keeps recipes out of the navigation but lists them in llms.txt", async () => {
		await build();

		const components = await Bun.file(resolve(wwwDir, "components.html")).text();
		const llms = await Bun.file(resolve(wwwDir, "llms.txt")).text();

		expect(components).not.toContain('href="recipes/messages.html"');
		expect(llms).toContain(`(${siteUrl}/recipes/messages.md)`);
	});

	test("makes page links absolute: .html in a page, .md in a markdown export", async () => {
		await build();

		const page = await Bun.file(resolve(wwwDir, "getting-started.html")).text();
		const markdown = await Bun.file(resolve(wwwDir, "getting-started.md")).text();

		expect(page).toContain(`href="${siteUrl}/binding-syntax.html"`);
		expect(markdown).toContain(`](${siteUrl}/binding-syntax.md)`);
	});
});
