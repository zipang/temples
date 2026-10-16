import { describe, expect, test } from "bun:test";
import { type AttributeType, TemplesComponent } from "./component";
import { subscribe } from "./reactive";

describe("TemplesComponent.define", () => {
	test("defines a custom element from a tag, a class, and a template", () => {
		class Greeter extends TemplesComponent {}

		TemplesComponent.define("greeter-card", Greeter, {
			template: "<p data-bind='text=title'>Hello</p>"
		});

		const elt = document.createElement("greeter-card") as Greeter;

		expect(elt).toBeInstanceOf(Greeter);
		expect(customElements.get("greeter-card")).toBe(Greeter);
	});

	test("inserts a template keyed by tag name into the document head", () => {
		class Greeter extends TemplesComponent {}

		TemplesComponent.define("greeter-head", Greeter, {
			template: "<p data-bind='text=title'>Hello</p>"
		});

		const template = document.head.querySelector<HTMLTemplateElement>("template#greeter-head");

		expect(template).not.toBeNull();
		expect(template?.id).toBe("greeter-head");
	});

	test("renders from state and re-renders on a state mutation", () => {
		class Greeter extends TemplesComponent {
			constructor() {
				super({ title: "Hello" });
			}
		}

		TemplesComponent.define("greeter-render", Greeter, {
			template: "<p data-bind='text=title'>Hello</p>"
		});

		const elt = document.createElement("greeter-render") as Greeter;
		document.body.appendChild(elt);

		expect(elt.querySelector("p")?.textContent).toBe("Hello");

		elt.state.title = "World";

		expect(elt.querySelector("p")?.textContent).toBe("World");
		elt.remove();
	});

	test("wraps the initial state into a reactive proxy at construction", () => {
		let changes = 0;

		class Counter extends TemplesComponent {
			constructor() {
				super({ count: 0 });
			}
		}

		TemplesComponent.define("counter-autowrap", Counter, {
			template: "<span data-bind='text=count'>0</span>"
		});

		const elt = document.createElement("counter-autowrap") as Counter;
		document.body.appendChild(elt);

		const unsubscribe = subscribe(elt.state, () => {
			changes += 1;
		});

		elt.state.count = 1;

		expect(changes).toBe(1);
		unsubscribe();
		elt.remove();
	});

	test("re-renders on a nested state mutation", () => {
		class Profile extends TemplesComponent {
			constructor() {
				super({ user: { name: "Jane" } });
			}
		}

		TemplesComponent.define("profile-card", Profile, {
			template: "<span data-bind='text=user.name'>?</span>"
		});

		const elt = document.createElement("profile-card") as Profile;
		document.body.appendChild(elt);

		expect(elt.querySelector("span")?.textContent).toBe("Jane");

		const user = elt.state.user as { name: string };
		user.name = "Jane Eyre";

		expect(elt.querySelector("span")?.textContent).toBe("Jane Eyre");
		elt.remove();
	});

	test("coerces attributes declared in the attributes map into state and re-renders", () => {
		class Meter extends TemplesComponent {
			constructor() {
				super({ count: 0, done: false });
			}
		}

		TemplesComponent.define("meter-card", Meter, {
			template: "<p data-bind='text=count'>0</p><span data-bind='text=done'>?</span>",
			attributes: { count: "number", done: "boolean" }
		});

		const elt = document.createElement("meter-card") as Meter;
		elt.setAttribute("count", "3");
		elt.setAttribute("done", "true");
		document.body.appendChild(elt);

		expect(elt.state.count).toBe(3);
		expect(elt.state.done).toBe(true);
		expect(elt.querySelector("p")?.textContent).toBe("3");
		expect(elt.querySelector("span")?.textContent).toBe("true");

		elt.setAttribute("count", "5");

		expect(elt.state.count).toBe(5);
		expect(elt.querySelector("p")?.textContent).toBe("5");
		elt.remove();
	});

	test("maps a falsey boolean attribute to false", () => {
		class Flag extends TemplesComponent {
			constructor() {
				super({ done: true });
			}
		}

		TemplesComponent.define("flag-card", Flag, {
			template: "<span data-bind='text=done'>?</span>",
			attributes: { done: "boolean" }
		});

		const elt = document.createElement("flag-card") as Flag;
		elt.setAttribute("done", "false");
		document.body.appendChild(elt);

		expect(elt.state.done).toBe(false);
		expect(elt.querySelector("span")?.textContent).toBe("false");
		elt.remove();
	});

	test("removing an observed attribute resets the coerced state", () => {
		class Meter extends TemplesComponent {
			constructor() {
				super({ count: 0 });
			}
		}

		TemplesComponent.define("meter-remove", Meter, {
			template: "<p data-bind='text=count'>0</p>",
			attributes: { count: "number" }
		});

		const elt = document.createElement("meter-remove") as Meter;
		elt.setAttribute("count", "7");
		document.body.appendChild(elt);

		expect(elt.state.count).toBe(7);

		elt.removeAttribute("count");

		expect(elt.state.count).toBe(0);
		elt.remove();
	});

	test("disconnectedCallback cleans up the children", () => {
		class Greeter extends TemplesComponent {
			constructor() {
				super({ title: "Hi" });
			}
		}

		TemplesComponent.define("greeter-cleanup", Greeter, {
			template: "<p data-bind='text=title'>Hello</p>"
		});

		const elt = document.createElement("greeter-cleanup") as Greeter;
		document.body.appendChild(elt);

		expect(elt.children.length).toBeGreaterThan(0);

		elt.remove();

		expect(elt.children.length).toBe(0);
	});

	test("composed components re-render when the parent state changes", () => {
		class TodoItem extends TemplesComponent {
			constructor() {
				super({ label: "" });
			}
		}

		TemplesComponent.define("todo-item", TodoItem, {
			template: "<li data-bind='text=label'></li>",
			attributes: { label: "string" }
		});

		class TodoList extends TemplesComponent {
			constructor() {
				super({ items: [{ label: "A" }, { label: "B" }] });
			}
		}

		TemplesComponent.define("todo-list", TodoList, {
			template:
				"<ul data-iterate='item: items'><todo-item data-bind='label=item.label'></todo-item></ul>"
		});

		const list = document.createElement("todo-list") as TodoList;
		document.body.appendChild(list);

		expect(list.querySelectorAll("todo-item").length).toBe(2);

		const items = list.state.items as Array<{ label: string }>;
		items.push({ label: "C" });

		expect(list.querySelectorAll("todo-item").length).toBe(3);
		expect(list.querySelectorAll("todo-item")[2]?.textContent).toBe("C");

		const firstItem = items[0];

		if (firstItem !== undefined) firstItem.label = "A1";

		expect(list.querySelectorAll("todo-item")[0]?.textContent).toBe("A1");
		list.remove();
	});

	test("define(tagName, componentClass, options) registers and copies options to the class", () => {
		const clicks: string[] = [];

		class Counter extends TemplesComponent {
			constructor() {
				super({ label: "" });
			}

			onClick(): void {
				clicks.push("clicked");
			}
		}

		TemplesComponent.define("canonical-counter", Counter, {
			template: "<button class='inc' data-bind='text=label'>x</button>",
			attributes: { label: "string" },
			events: {
				"click .inc": "onClick"
			},
			css: "canonical-counter { color: black; }",
			globalStore: { label: "Count" }
		});

		expect(Counter.tag).toBe("canonical-counter");
		expect(Counter.css).toBe("canonical-counter { color: black; }");

		const elt = document.createElement("canonical-counter") as Counter;
		document.body.appendChild(elt);

		expect(elt.querySelector("button")?.textContent).toBe("Count");

		elt.querySelector("button")?.dispatchEvent(new Event("click", { bubbles: true }));

		expect(clicks).toEqual(["clicked"]);
		elt.remove();
	});

	test("define(tagName, componentClass, options) without events preserves the class events map", () => {
		const hits: TemplesComponent[] = [];

		class Counter extends TemplesComponent {
			static override events = { "click .inc": "onInc" };

			constructor() {
				super({ count: 0 });
			}

			onInc(): void {
				hits.push(this);
			}
		}

		TemplesComponent.define("canonical-preserve-events", Counter, {
			template: "<button class='inc'>+1</button>"
		});

		const elt = document.createElement("canonical-preserve-events") as Counter;
		document.body.appendChild(elt);

		elt.querySelector("button")?.dispatchEvent(new Event("click", { bubbles: true }));

		expect(hits).toEqual([elt]);
		elt.remove();
	});

	test("define(tagName, componentClass, options) lets an explicit attribute override the store", () => {
		class Greeter extends TemplesComponent {
			constructor() {
				super({ name: "" });
			}
		}

		TemplesComponent.define("canonical-greeter", Greeter, {
			template: "<p data-bind='text=name'>?</p>",
			attributes: { name: "string" },
			globalStore: { name: "From Store" }
		});

		const fromStore = document.createElement("canonical-greeter") as Greeter;
		document.body.appendChild(fromStore);

		expect(fromStore.querySelector("p")?.textContent).toBe("From Store");

		const explicit = document.createElement("canonical-greeter") as Greeter;
		explicit.setAttribute("name", "Explicit");
		document.body.appendChild(explicit);

		expect(explicit.querySelector("p")?.textContent).toBe("Explicit");

		fromStore.remove();
		explicit.remove();
	});

	test("define(tagName, componentClass, options) derives the observed attributes from the attributes map", () => {
		class Card extends TemplesComponent {
			constructor() {
				super({ title: "", hidden: false });
			}
		}

		TemplesComponent.define("attrs-derive", Card, {
			template: "<p data-bind='text=title'>?</p>",
			attributes: { title: "string", hidden: "boolean" }
		});

		expect(Card.observedAttributes).toEqual(["title", "hidden"]);
		expect(Card.attributeTypes).toEqual({ title: "string", hidden: "boolean" });

		const elt = document.createElement("attrs-derive") as Card;

		elt.setAttribute("title", "Hello");
		elt.setAttribute("hidden", "true");
		document.body.appendChild(elt);

		expect(elt.state.title).toBe("Hello");
		expect(elt.state.hidden).toBe(true);
		expect(elt.querySelector("p")?.textContent).toBe("Hello");
		elt.remove();
	});

	test("define(tagName, componentClass, options) coerces every attribute type in the attributes map", () => {
		class Meter extends TemplesComponent {
			constructor() {
				super({ count: 0, done: false, meta: null, label: "" });
			}
		}

		TemplesComponent.define("attrs-coerce", Meter, {
			template: "<p data-bind='text=count'>0</p>",
			attributes: { count: "number", done: "boolean", meta: "json", label: "string" }
		});

		const elt = document.createElement("attrs-coerce") as Meter;

		elt.setAttribute("count", "3");
		elt.setAttribute("done", "false");
		elt.setAttribute("meta", '{"a":1}');
		elt.setAttribute("label", "Hi");
		document.body.appendChild(elt);

		expect(elt.state.count).toBe(3);
		expect(elt.state.done).toBe(false);
		expect(elt.state.meta).toEqual({ a: 1 });
		expect(elt.state.label).toBe("Hi");

		elt.setAttribute("count", "5");

		expect(elt.state.count).toBe(5);
		expect(elt.querySelector("p")?.textContent).toBe("5");
		elt.remove();
	});

	test("define(tagName, componentClass, options) rejects a class that declares attribute statics", () => {
		class Card extends TemplesComponent {
			static override observedAttributes = ["title"];

			constructor() {
				super({ title: "" });
			}
		}

		expect(() =>
			TemplesComponent.define("attrs-conflict-observed", Card, {
				template: "<p>?</p>",
				attributes: { title: "string" }
			})
		).toThrow("declares attributes on static fields");

		class Badge extends TemplesComponent {
			static override attributeTypes: Record<string, AttributeType> = { level: "number" };

			constructor() {
				super({ level: 0 });
			}
		}

		expect(() =>
			TemplesComponent.define("attrs-conflict-types", Badge, {
				template: "<p>?</p>",
				attributes: { level: "number" }
			})
		).toThrow("declares attributes on static fields");
	});

	test("subclasses initialize the state through the constructor", () => {
		class Card extends TemplesComponent {
			constructor() {
				super({ title: "Hello" });
			}
		}

		TemplesComponent.define("ctor-state", Card, {
			template: "<p data-bind='text=title'>?</p>"
		});

		const elt = document.createElement("ctor-state") as Card;
		document.body.appendChild(elt);

		expect(elt.state.title).toBe("Hello");
		expect(elt.querySelector("p")?.textContent).toBe("Hello");
		elt.remove();
	});
});

describe("TemplesComponent typed state", () => {
	interface CounterState {
		count: number;
		done: boolean;
	}

	class TypedCounter extends TemplesComponent<CounterState> {
		constructor() {
			super({ count: 0, done: false });
		}

		increment(): void {
			this.state.count += 1;
		}
	}

	test("a subclass declares its state type and reads typed fields", () => {
		TemplesComponent.define("typed-counter", TypedCounter, {
			template: "<p data-bind='text=count'>?</p>"
		});

		const elt = document.createElement("typed-counter") as TypedCounter;
		document.body.appendChild(elt);

		expect(elt.state.count).toBe(0);
		expect(elt.state.done).toBe(false);
		expect(elt.querySelector("p")?.textContent).toBe("0");

		elt.increment();

		expect(elt.state.count).toBe(1);
		expect(elt.querySelector("p")?.textContent).toBe("1");

		elt.remove();
	});

	test("define() accepts a concrete typed subclass", () => {
		class Badge extends TemplesComponent<{ level: number }> {
			constructor() {
				super({ level: 0 });
			}
		}

		expect(() =>
			TemplesComponent.define("typed-badge", Badge, {
				template: "<p>?</p>",
				attributes: { level: "number" }
			})
		).not.toThrow();
	});

	test("a wrong-shape initial state is a compile error", () => {
		class WrongShape extends TemplesComponent<CounterState> {
			constructor() {
				// @ts-expect-error — the initial state must match the declared shape
				super({ wrong: true });
			}
		}

		void WrongShape;
	});

	test("a wrong-type state assignment is a compile error", () => {
		const counter = new TypedCounter();

		// @ts-expect-error — `count` is typed as a number
		counter.state.count = "not a number";

		void counter;
	});
});

describe("TemplesComponent events", () => {
	test("registers a single document listener per event type", () => {
		const original = document.addEventListener;
		const added: string[] = [];
		const spy = ((
			type: string,
			listener: EventListenerOrEventListenerObject | null,
			options?: AddEventListenerOptions | boolean
		) => {
			added.push(type);
			original.call(document, type, listener as EventListenerOrEventListenerObject, options);
		}) as typeof document.addEventListener;

		document.addEventListener = spy;

		try {
			class Alpha extends TemplesComponent {
				onX(): void {}
			}

			class Beta extends TemplesComponent {
				onX(): void {}
			}

			TemplesComponent.define("event-alpha", Alpha, {
				template: "<b class='x'>a</b>",
				events: { "dblclick .x": "onX" }
			});
			TemplesComponent.define("event-beta", Beta, {
				template: "<i class='x'>b</i>",
				events: { "dblclick .x": "onX" }
			});

			expect(added.filter((type) => type === "dblclick")).toHaveLength(1);
		} finally {
			document.addEventListener = original;
		}
	});

	test("runs the handler with this bound to the component and the event passed", () => {
		const captured: Array<{ evt: Event; self: TemplesComponent }> = [];

		class Counter extends TemplesComponent {
			constructor() {
				super({ count: 0 });
			}

			onInc(evt: Event): void {
				captured.push({ evt, self: this });
			}
		}

		TemplesComponent.define("event-counter", Counter, {
			template: "<input class='field'><button class='inc'>+1</button>",
			events: { "click .inc": "onInc" }
		});

		const elt = document.createElement("event-counter") as Counter;
		document.body.appendChild(elt);

		elt.querySelector("button.inc")?.dispatchEvent(new Event("click", { bubbles: true }));

		expect(captured).toHaveLength(1);
		expect(captured[0]?.self).toBe(elt);
		expect(captured[0]?.evt).toBeInstanceOf(Event);
		elt.remove();
	});

	test("handlers receive a live event with preventDefault and target access", () => {
		let defaultPrevented = false;
		let inputValue = "";

		class Form extends TemplesComponent {
			onSubmit(evt: Event): void {
				evt.preventDefault();
				defaultPrevented = evt.defaultPrevented;
				inputValue = (evt.target as HTMLFormElement).querySelector("input")?.value ?? "";
			}
		}

		TemplesComponent.define("event-form", Form, {
			template: "<form class='form'><input class='field' value='hi'></form>",
			events: { "submit .form": "onSubmit" }
		});

		const elt = document.createElement("event-form") as Form;
		document.body.appendChild(elt);

		elt
			.querySelector("form")
			?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

		expect(defaultPrevented).toBe(true);
		expect(inputValue).toBe("hi");
		elt.remove();
	});

	test("a single document listener serves every instance", () => {
		const clicked: TemplesComponent[] = [];

		class Counter extends TemplesComponent {
			constructor() {
				super({ count: 0 });
			}

			onInc(): void {
				clicked.push(this);
			}
		}

		TemplesComponent.define("event-multi", Counter, {
			template: "<button class='inc'>+1</button>",
			events: { "click .inc": "onInc" }
		});

		const first = document.createElement("event-multi") as Counter;
		const second = document.createElement("event-multi") as Counter;

		document.body.appendChild(first);
		document.body.appendChild(second);

		first.querySelector("button")?.dispatchEvent(new Event("click", { bubbles: true }));

		expect(clicked).toHaveLength(1);
		expect(clicked[0]).toBe(first);

		second.querySelector("button")?.dispatchEvent(new Event("click", { bubbles: true }));

		expect(clicked).toHaveLength(2);
		expect(clicked[1]).toBe(second);

		first.remove();
		second.remove();
	});

	test("resolves the closest component and ignores outer handlers", () => {
		const innerHits: TemplesComponent[] = [];
		const outerHits: TemplesComponent[] = [];

		class Inner extends TemplesComponent {
			onAct(): void {
				innerHits.push(this);
			}
		}

		class Outer extends TemplesComponent {
			onAct(): void {
				outerHits.push(this);
			}
		}

		TemplesComponent.define("event-inner", Inner, {
			template: "<button class='act'>go</button>",
			events: { "click .act": "onAct" }
		});
		TemplesComponent.define("event-outer", Outer, {
			template: "<event-inner></event-inner>",
			events: { "click .act": "onAct" }
		});

		const outer = document.createElement("event-outer") as Outer;
		document.body.appendChild(outer);

		const inner = outer.querySelector("event-inner") as Inner;
		inner.querySelector("button")?.dispatchEvent(new Event("click", { bubbles: true }));

		expect(innerHits).toHaveLength(1);
		expect(innerHits[0]).toBe(inner);
		expect(outerHits).toHaveLength(0);

		outer.remove();
	});

	test("ignores events that do not match the selector", () => {
		let hits = 0;

		class Counter extends TemplesComponent {
			onInc(): void {
				hits++;
			}
		}

		TemplesComponent.define("event-mismatch", Counter, {
			template: "<button class='other'>x</button>",
			events: { "click .inc": "onInc" }
		});

		const elt = document.createElement("event-mismatch") as Counter;
		document.body.appendChild(elt);

		elt.querySelector("button")?.dispatchEvent(new Event("click", { bubbles: true }));

		expect(hits).toBe(0);
		elt.remove();
	});

	test("ignores events from outside any component", () => {
		let hits = 0;

		class Counter extends TemplesComponent {
			onInc(): void {
				hits++;
			}
		}

		TemplesComponent.define("event-outside", Counter, {
			template: "<button class='inc'>+1</button>",
			events: { "click .inc": "onInc" }
		});

		const elt = document.createElement("event-outside") as Counter;
		document.body.appendChild(elt);

		const stray = document.createElement("button");

		stray.className = "inc";
		document.body.appendChild(stray);
		stray.dispatchEvent(new Event("click", { bubbles: true }));

		expect(hits).toBe(0);
		stray.remove();
		elt.remove();
	});
});

describe("TemplesComponent messaging", () => {
	test("emits a tag-prefixed message that a different class can subscribe to", () => {
		const received: Array<{ evt: CustomEvent; self: TemplesComponent }> = [];

		class TaskItem extends TemplesComponent {}

		class TaskList extends TemplesComponent {
			onCompleted(evt: CustomEvent): void {
				received.push({ evt, self: this });
			}
		}

		TemplesComponent.define("msg-item-a", TaskItem, {
			template: "<li>task</li>"
		});
		TemplesComponent.define("msg-list-a", TaskList, {
			template: "<ul></ul>"
		});

		const item = document.createElement("msg-item-a") as TaskItem;
		const list = document.createElement("msg-list-a") as TaskList;

		list.on({ "msg-item-a:completed": "onCompleted" });
		item.emit("completed", { id: 1 });

		expect(received).toHaveLength(1);
		expect(received[0]?.evt.type).toBe("msg-item-a:completed");
		expect(received[0]?.evt.detail).toEqual({ id: 1 });
		expect(received[0]?.self).toBe(list);
	});

	test("separates same local name emitted by different classes", () => {
		const items: unknown[] = [];
		const notes: unknown[] = [];

		class TaskItem extends TemplesComponent {
			onChanged(evt: CustomEvent): void {
				items.push(evt.detail);
			}
		}

		class TaskNote extends TemplesComponent {
			onChanged(evt: CustomEvent): void {
				notes.push(evt.detail);
			}
		}

		TemplesComponent.define("msg-item-b", TaskItem, {
			template: "<li></li>"
		});
		TemplesComponent.define("msg-note-b", TaskNote, {
			template: "<p></p>"
		});

		const item = document.createElement("msg-item-b") as TaskItem;
		const note = document.createElement("msg-note-b") as TaskNote;

		item.on({ "msg-item-b:changed": "onChanged" });
		note.on({ "msg-note-b:changed": "onChanged" });

		item.emit("changed", "item-a");
		note.emit("changed", "note-b");

		expect(items).toEqual(["item-a"]);
		expect(notes).toEqual(["note-b"]);
	});

	test("does not deliver to a listener on the unprefixed name", () => {
		let hits = 0;

		class TaskItem extends TemplesComponent {
			onPing(): void {
				hits++;
			}
		}

		TemplesComponent.define("msg-item-c", TaskItem, {
			template: "<li></li>"
		});

		const item = document.createElement("msg-item-c") as TaskItem;

		item.on({ completed: "onPing" });
		item.emit("completed");

		expect(hits).toBe(0);
	});

	test("disconnecting stops message delivery", () => {
		let hits = 0;

		class Emitter extends TemplesComponent {}

		class Listener extends TemplesComponent {
			onPing(): void {
				hits++;
			}
		}

		TemplesComponent.define("msg-emitter", Emitter, {
			template: "<i></i>"
		});
		TemplesComponent.define("msg-listener", Listener, {
			template: "<span></span>",
			events: { "msg-emitter:ping": "onPing" }
		});

		const emitter = document.createElement("msg-emitter") as Emitter;
		const listener = document.createElement("msg-listener") as Listener;

		document.body.appendChild(listener);
		emitter.emit("ping");
		expect(hits).toBe(1);

		listener.remove();
		emitter.emit("ping");
		expect(hits).toBe(1);
	});

	test("messaging works without connecting the components to the DOM", () => {
		let hits = 0;

		class TaskItem extends TemplesComponent {}

		class TaskList extends TemplesComponent {
			onCompleted(): void {
				hits++;
			}
		}

		TemplesComponent.define("msg-item-d", TaskItem, {
			template: "<li></li>"
		});
		TemplesComponent.define("msg-list-d", TaskList, {
			template: "<ul></ul>"
		});

		const item = document.createElement("msg-item-d") as TaskItem;
		const list = document.createElement("msg-list-d") as TaskList;

		list.on({ "msg-item-d:completed": "onCompleted" });
		item.emit("completed");

		expect(hits).toBe(1);
	});
});

describe("TemplesComponent css and global store", () => {
	test("css defaults to an empty string", () => {
		class Widget extends TemplesComponent {}

		expect(Widget.css).toBe("");
	});

	test("define() seeds an observed attribute from the global store", () => {
		class Widget extends TemplesComponent {
			constructor() {
				super({ title: "" });
			}
		}

		TemplesComponent.define("store-seed", Widget, {
			template: "<p data-bind='text=title'>?</p>",
			attributes: { title: "string" },
			globalStore: { title: "From Store" }
		});

		const elt = document.createElement("store-seed") as Widget;

		document.body.appendChild(elt);

		expect(elt.querySelector("p")?.textContent).toBe("From Store");
		elt.remove();
	});

	test("an explicit attribute masks the same-named store key", () => {
		class Widget extends TemplesComponent {
			constructor() {
				super({ title: "" });
			}
		}

		TemplesComponent.define("store-mask", Widget, {
			template: "<p data-bind='text=title'>?</p>",
			attributes: { title: "string" },
			globalStore: { title: "From Store" }
		});

		const elt = document.createElement("store-mask") as Widget;

		elt.setAttribute("title", "Explicit");
		document.body.appendChild(elt);

		expect(elt.querySelector("p")?.textContent).toBe("Explicit");
		elt.remove();
	});
});

describe("slot support", () => {
	test("projects authored children into a default slot", () => {
		class Box extends TemplesComponent {
			static override tag = "slot-box";
		}

		TemplesComponent.define("slot-box", Box, {
			template: '<div class="box"><slot></slot></div>'
		});

		const elt = document.createElement("slot-box") as Box;
		const a = document.createElement("a");
		a.textContent = "Brand";
		elt.appendChild(a);
		document.body.appendChild(elt);

		expect(elt.querySelector(".box")?.innerHTML).toContain("<a>Brand</a>");
		expect(elt.querySelector("slot")).toBeNull();
		elt.remove();
	});

	test("slot content survives a parent re-render", () => {
		class Shell extends TemplesComponent {
			static override tag = "slot-shell";
		}

		TemplesComponent.define("slot-shell", Shell, {
			template: '<div class="shell"><slot></slot></div>'
		});

		class Page extends TemplesComponent {
			static override tag = "slot-page";

			constructor() {
				super({ n: 0 });
			}
		}

		TemplesComponent.define("slot-page", Page, {
			template:
				'<section><span data-bind="text=n">0</span><slot-shell><a href="#">Brand</a></slot-shell></section>'
		});

		const page = document.createElement("slot-page") as Page;
		document.body.appendChild(page);

		expect(page.querySelector("slot-shell .shell a")?.textContent).toBe("Brand");

		page.state.n = 1;

		expect(page.querySelectorAll("slot-shell .shell a").length).toBe(1);
		expect(page.querySelector("slot-shell")?.textContent).toBe("Brand");
		page.remove();
	});
});

describe("instance state isolation", () => {
	test("two instances passing the same INITIAL_STATE constant keep separate state", () => {
		type CardState = { title: string };

		const INITIAL_STATE: CardState = { title: "" };

		class Card extends TemplesComponent<CardState> {
			static override tag = "iso-card";

			constructor() {
				super(INITIAL_STATE);
			}
		}

		TemplesComponent.define("iso-card", Card, {
			template: "<p data-bind='text=title'>?</p>",
			attributes: { title: "string" }
		});

		const first = document.createElement("iso-card") as Card;
		first.setAttribute("title", "First");
		const second = document.createElement("iso-card") as Card;
		second.setAttribute("title", "Second");
		document.body.appendChild(first);
		document.body.appendChild(second);

		expect(first.querySelector("p")?.textContent).toBe("First");
		expect(second.querySelector("p")?.textContent).toBe("Second");
		first.remove();
		second.remove();
	});
});
