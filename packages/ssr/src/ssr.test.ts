import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { TemplesComponent } from "@temples/components";
import { prepare } from "./ssr";

describe("prepare", () => {
	test("returns an async render function that produces an HTML string", async () => {
		const render = prepare("<h1 data-bind='text=title'>old</h1>");

		expect(await render({ title: "Hello" })).toBe("<h1>Hello</h1>");
	});

	test("throws on a source with multiple root elements", () => {
		expect(() => prepare("<h1>a</h1><h1>b</h1>")).toThrow();
	});

	test("each render call is independent (no state leak)", async () => {
		const render = prepare("<p data-bind='text=value'></p>");

		expect(await render({ value: "first" })).toBe("<p>first</p>");
		expect(await render({ value: "second" })).toBe("<p>second</p>");
	});

	test("renders a whole HTML document and preserves the doctype", async () => {
		const render = prepare(
			"<!doctype html><html><head><title>T</title></head><body><h1 data-bind='text=title'>old</h1></body></html>"
		);

		const html = await render({ title: "Hello" });

		expect(html).toBe(
			"<!DOCTYPE html><html><head><title>T</title></head><body><h1>Hello</h1></body></html>"
		);
	});
});

describe("prepare webComponents", () => {
	test("renders a custom tag to its template and concatenates css", async () => {
		class Greeter extends TemplesComponent {
			static override tag = "ssr-greeter";
			static override template = "<p data-bind='text=name'>?</p>";
			static override observedAttributes = ["name"];
			static override css = "p { color: red; }";
			constructor() {
				super({ name: "" });
			}
		}

		const render = prepare("<div><ssr-greeter></ssr-greeter></div>", {
			templesComponents: [Greeter]
		});

		const html = await render({ name: "World" });

		expect(html).toContain("<p>World</p>");
		expect(html).toContain("<style>p { color: red; }</style>");
	});

	test("renders a full page with a custom tag and injects css into the head", async () => {
		class Greeter extends TemplesComponent {
			static override tag = "ssr-greet-page";
			static override template = "<p data-bind='text=name'>?</p>";
			static override observedAttributes = ["name"];
			static override css = "p { color: red; }";
			constructor() {
				super({ name: "" });
			}
		}

		const render = prepare(
			"<!doctype html><html><head><title>Page</title></head><body><ssr-greet-page></ssr-greet-page></body></html>",
			{ templesComponents: [Greeter] }
		);

		const html = await render({ name: "World" });

		expect(html).toContain("<p>World</p>");
		expect(html).toContain("<title>Page</title>");
		expect(html).toContain("<style>p { color: red; }</style>");
	});

	test("removeDataBinding unwraps component tags to plain markup", async () => {
		class Greeter extends TemplesComponent {
			static override tag = "ssr-rdb";
			static override template = "<p data-bind='text=name'>?</p>";
			static override observedAttributes = ["name"];
			constructor() {
				super({ name: "" });
			}
		}

		const render = prepare("<div><ssr-rdb></ssr-rdb></div>", {
			templesComponents: [Greeter],
			removeDataBindings: true
		});

		const html = await render({ name: "World" });

		expect(html).toBe("<div><p>World</p></div>");
	});
});

describe("prepare a full page with components and the full binding range", () => {
	class ArticleCard extends TemplesComponent {
		static override tag = "article-card";
		static override template =
			"<article class='article-card'><h4 data-bind='text=title'>Title</h4><span class='badge' data-bind='class[featured|popular|quote]=type, text=type'>type</span></article>";
		static override observedAttributes = ["title", "type"];
		static override css = "article-card { border: 1px solid #ccc; }";
		constructor() {
			super({ title: "", type: "" });
		}
	}

	class UserCard extends TemplesComponent {
		static override tag = "user-card";
		static override template =
			"<div class='user-card'><img data-bind='src=avatar' alt=''><span data-bind='text=name'>Name</span></div>";
		static override observedAttributes = ["name", "avatar"];
		static override css = "user-card { display: block; }";
		constructor() {
			super({ name: "", avatar: "" });
		}
	}

	const template = readFileSync(
		new URL("../test/fixtures/full-page.html", import.meta.url),
		"utf8"
	);

	const storeWithContent = {
		title: "Store Title",
		type: "featured",
		name: "Jane",
		avatar: "/img/jane.png",
		page: {
			title: "My temples Blog",
			tagline: "Templates you won't hate",
			footer: "© 2026 temples"
		},
		article: {
			title: "The Great Race",
			summary: "<em>An epic</em> tale of speed.",
			featured: true,
			type: "quote",
			quotes: [
				{ id: 1, text: "Quiet!", author: "Ann" },
				{ id: 2, text: "Pardon me, Mr Partner.", author: "Bob" }
			],
			tags: [
				{ label: "news", url: "/news" },
				{ label: "sports", url: "/sports" }
			]
		},
		user: { name: "John DOE", avatar: "/img/john.png" }
	};

	const storeChanged = {
		title: "Changed Title",
		type: "popular",
		name: "June",
		avatar: "/img/june.png",
		page: { title: "Second Edition", tagline: "New tagline", footer: "© 2026" },
		article: {
			title: "The Sequel",
			summary: "Short and sweet.",
			featured: false,
			type: "popular",
			quotes: [{ id: 3, text: "Never give up!", author: "Cara" }],
			tags: [{ label: "tech", url: "/tech" }]
		},
		user: { name: "June DOE", avatar: "/img/june.png" }
	};

	const storeEmpty = {
		page: { title: "Empty Page", tagline: "", footer: "" },
		article: { featured: false, type: "featured", quotes: [], tags: [] },
		user: { name: "", avatar: "" }
	};

	test("renders a full page: bindings, loops, conditionals, and components", async () => {
		const render = prepare(template, { templesComponents: [ArticleCard, UserCard] });

		const html = await render(storeWithContent);

		expect(html).toContain("<title>My temples Blog</title>");
		expect(html).toContain("<h1>My temples Blog</h1>");
		expect(html).toContain('<p class="tagline">Templates you won\'t hate</p>');
		expect(html).toContain("<h2>The Great Race</h2>");
		expect(html).toContain("<em>An epic</em> tale of speed.");
		expect(html).not.toContain("display:none");

		expect(html).toContain("<p>Quiet!</p>");
		expect(html).toContain("<cite>Ann</cite>");
		expect(html).toContain("<p>Pardon me, Mr Partner.</p>");
		expect(html).toContain('<a href="/news">news</a>');
		expect(html).toContain('<a href="/sports">sports</a>');
		expect(html).toContain('class="row quote"');
		expect(html).toContain('value="John DOE"');
		expect(html).toContain('src="/img/john.png"');
		expect(html).toContain('alt="John DOE"');

		expect(html).toContain("<h4>Store Title</h4>");
		expect(html).toContain('class="badge featured"');
		expect(html).toContain("<h4>Local Title</h4>");
		expect(html).toContain('class="badge popular"');
		expect(html).toContain("<span>Jane</span>");
		expect(html).toContain("<span>Bob</span>");
		expect(html).toContain('src="/img/bob.png"');

		expect(html).toContain("article-card { border: 1px solid #ccc; }");
		expect(html).toContain("user-card { display: block; }");

		expect(html).not.toContain("data-bind");
		expect(html).not.toContain("data-iterate");
		expect(html).not.toContain("data-render-if");
		expect(html).not.toContain("<article-card");
		expect(html).not.toContain("<user-card");
	});

	test("explicit component attributes override the global store", async () => {
		const render = prepare(
			'<div><article-card></article-card><article-card title="Local" type="quote"></article-card></div>',
			{ templesComponents: [ArticleCard] }
		);

		const html = await render(storeWithContent);

		expect(html).toContain("<h4>Store Title</h4>");
		expect(html).toContain('class="badge featured"');
		expect(html).toContain("<h4>Local</h4>");
		expect(html).toContain('class="badge quote"');
	});

	test("renders the same prepared page repeatedly with changing data", async () => {
		const render = prepare(template, { templesComponents: [ArticleCard, UserCard] });

		const first = await render(storeWithContent);

		expect(first).toContain("<h1>My temples Blog</h1>");
		expect(first).toContain("<p>Quiet!</p>");
		expect(first).toContain("<h4>Store Title</h4>");
		expect(first).not.toContain("display:none");

		const second = await render(storeChanged);

		expect(second).toContain("<h1>Second Edition</h1>");
		expect(second).toContain("<p>Never give up!</p>");
		expect(second).toContain("<cite>Cara</cite>");
		expect(second).toContain("<h4>Changed Title</h4>");
		expect(second).toContain("<span>June</span>");
		expect(second).toContain('class="row popular"');
		expect(second).not.toContain("The Sequel");
		expect(second).not.toContain("display:none");
		expect(second).not.toContain("temples says:");
		expect(second).not.toContain("Quiet!");
		expect(second).not.toContain("My temples Blog");
		expect(second).not.toContain("/news");
		expect(second).not.toContain("Store Title");

		const third = await render(storeEmpty);

		expect(third).toContain("<h1>Empty Page</h1>");
		expect(third).not.toContain("<h2");
		expect(third).not.toContain("<blockquote");
		expect(third).not.toContain("<a href=");
		expect(third).not.toContain("Quiet!");
		expect(third).not.toContain("Never give up!");
		expect(third).not.toContain("June");
	});

	test("omits elements whose data-render-if condition is falsy", async () => {
		const render = prepare("<section><p data-render-if='visible'>shown</p></section>");

		expect(await render({ visible: false })).toBe("<section></section>");
		expect(await render({ visible: true })).toBe("<section><p>shown</p></section>");
	});

	test("keeps data-show-if and data-hide-if elements with an inline display style", async () => {
		const render = prepare(
			"<section><p data-show-if='visible'>shown</p><q data-hide-if='muted'>muted</q></section>"
		);

		const html = await render({ visible: false, muted: true });

		expect(html).toContain('<p style="display:none">shown</p>');
		expect(html).toContain('<q style="display:none">muted</q>');

		const shown = await render({ visible: true, muted: false });

		expect(shown).toContain("<p>shown</p>");
		expect(shown).toContain("<q>muted</q>");
	});

	test("keeps component tags when removeDataBindings is false", async () => {
		const render = prepare("<div><article-card></article-card></div>", {
			templesComponents: [ArticleCard],
			removeDataBindings: false
		});

		const html = await render(storeWithContent);

		expect(html).toContain("<article-card>");
		expect(html).toContain("<h4>Store Title</h4>");
	});
});

describe("prepare slot support", () => {
	test("a slot receives the children authored on the tag", async () => {
		class DocsHeader extends TemplesComponent {
			static override tag = "docs-header";
			static override template = '<header class="docs-header"><slot></slot></header>';
			static override observedAttributes: string[] = [];
			static override css = ".docs-header { position: sticky; }";
		}

		TemplesComponent.define("docs-header", DocsHeader, {
			template: DocsHeader.template,
			css: DocsHeader.css
		});

		const render = prepare(
			"<!doctype html><html><head><title>t</title></head><body>" +
				"<docs-header><a href='#'>Brand</a><span>Tagline</span></docs-header>" +
				"</body></html>",
			{ removeDataBindings: false, templesComponents: [DocsHeader] }
		);

		const html = await render({});

		expect(html).toContain(
			'<header class="docs-header"><a href="#">Brand</a><span>Tagline</span></header>'
		);
	});
});
