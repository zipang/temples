import { Renderer, type TemplesData } from "@temples/engine";
import { reactive, subscribe } from "./reactive";

/**
 * Type an observed attribute's value as it flows into `state`.
 *
 * Without a type, an attribute writes a raw string. `boolean` maps `"false"`
 * and `"0"` to `false`, `number` parses a number, and `json` parses an object
 * or array literal.
 */
export type AttributeType = "boolean" | "number" | "json" | "string";

/**
 * Handler invoked by an event binding.
 *
 * A handler is a component method that receives the event — either a DOM event
 * (`"eventType selector"` binding) or a `CustomEvent` carrying a message
 * (`"tag:name"` binding). It runs with `this` bound to the component instance,
 * so handlers can read `this.state` and call other component methods directly.
 */
export type EventHandler = (this: TemplesComponent<object>, event: Event) => void;

/**
 * Declarative map of event bindings.
 *
 * Each key maps to the name of a handler method on the component class. A key
 * with a space is a DOM binding, `"eventType selector"` (e.g.
 * `"click .add-btn"`), run when an event of that type bubbles from an element
 * matching the selector. A key without a space is an inter-component message
 * name, `"tag:name"` (e.g. `"shopping-item:updated"`), delivered by the shared
 * event bus. Both are handled by the same method-name lookup.
 */
export type EventMap = Record<string, string>;

/**
 * Options passed to `TemplesComponent.define(tagName, componentClass, options)`.
 *
 * The template is required: a component cannot exist without markup. The other
 * options are optional and are copied onto the component class's static fields
 * so server-side rendering can read them.
 */
export interface DefineOptions {
	/**
	 * The HTML template string, parsed once by `define()`.
	 */
	template: string;

	/**
	 * Declarative attribute map, `"name": type`.
	 *
	 * Each key names an observed attribute that flows into `state`, coerced by
	 * its `AttributeType`. `define()` derives the class `observedAttributes`
	 * and `attributeTypes` statics from this map, which is the single source of
	 * truth: a class that also declares those statics makes `define()` throw.
	 */
	attributes?: Record<string, AttributeType>;

	/**
	 * Optional declarative event map, mapping a binding to a handler method name.
	 */
	events?: EventMap;

	/**
	 * The component stylesheet, concatenated into the SSR output by `prepare()`.
	 */
	css?: string;

	/**
	 * The global data store shared by every component.
	 * It seeds observed attributes that are absent on the tag.
	 */
	globalStore?: TemplesData;
}

/**
 * The structural type of any `TemplesComponent` subclass constructor.
 *
 * `define()` and the server-side rendering pipeline accept any subclass,
 * whatever state type its instances carry. The construct signature uses
 * `never[]` arguments so every subclass constructor is assignable, and it
 * returns the `HTMLElement` surface because no boundary consumer reads
 * instance state.
 */
export interface TemplesComponentClass {
	/**
	 * The custom element tag name, e.g. `"todo-app"`.
	 */
	tag: string;

	/**
	 * The HTML template string, parsed once by `define()`.
	 */
	template: string;

	/**
	 * The component stylesheet, concatenated into the SSR output by `prepare()`.
	 */
	css: string;

	/**
	 * The declarative event map, mapping a binding to a handler method name.
	 */
	events: EventMap;

	/**
	 * Attribute names observed for changes, written into `state`.
	 */
	observedAttributes: string[];

	/**
	 * The coercion map from attribute name to `AttributeType`.
	 */
	attributeTypes: Record<string, AttributeType>;

	/**
	 * The global data store shared by every component.
	 */
	globalStore?: TemplesData;

	/**
	 * Create a component instance. `never[]` accepts any subclass constructor
	 * parameter list.
	 */
	new (...args: never[]): HTMLElement;
}

/**
 * A message subscription, tying a handler method to the component that owns it.
 *
 * The bus stores the component and the resolved handler so delivery can invoke
 * the handler with `this` bound to the owning component.
 */
interface MessageSubscription {
	component: TemplesComponent<object>;
	handler: EventHandler;
}

/**
 * Document-level listeners, one per event type, shared by every component.
 *
 * The listener resolves the closest `TemplesComponent` ancestor of the event
 * target and dispatches to that component's own `eventHandlers` map, so a single
 * listener serves all instances of all classes that use the same event type.
 */
const documentListeners = new Map<string, (event: Event) => void>();

/**
 * Shared messaging bus, mapping a fully qualified message name to its handlers.
 *
 * Every component emits and subscribes through the same bus, so any component
 * can talk to any other regardless of class or DOM position. Message names are
 * prefixed with the emitting tag (`task-item:completed`) to keep classes from
 * colliding on the same local name.
 */
const messageHandlers = new Map<string, Set<MessageSubscription>>();

/**
 * Deliver a message to every subscribed handler.
 *
 * A snapshot of the handler set is iterated so a handler that unsubscribes
 * during dispatch does not affect the current delivery. Each handler runs with
 * `this` bound to its owning component.
 *
 * @param type - The fully qualified message name.
 * @param detail - The payload delivered on the message's `detail` property.
 */
const dispatchMessage = (type: string, detail: unknown): void => {
	const subscriptions = messageHandlers.get(type);

	if (subscriptions === undefined) return;

	const event = new CustomEvent(type, { detail });

	for (const { component, handler } of [...subscriptions]) handler.call(component, event);
};

/**
 * Base class for declarative Web Components with reactive state.
 *
 * Declare a component with `TemplesComponent.define(tagName, componentClass,
 * options)`: the options carry the `template`, the `attributes` map, the
 * `events`, the `css`, and the `globalStore`, while the class carries its
 * `state` and handler methods. `define()` parses the template once, derives
 * the `observedAttributes` and `attributeTypes` statics from the `attributes`
 * map, and registers the custom element. On connection the state is rendered
 * from the template, and any state mutation re-renders.
 *
 * @template T - The complete state shape: the observed attributes plus every
 * internal value. Declared on the `extends` clause. The `object` bound accepts
 * every interface and type alias; the default keeps untyped components
 * working.
 */
export class TemplesComponent<T extends object = Record<string, unknown>> extends HTMLElement {
	/**
	 * The custom element tag name, e.g. `"todo-app"`.
	 */
	static tag = "";

	/**
	 * The HTML template string, parsed once by `define()`.
	 */
	static template = "";

	/**
	 * The component stylesheet, concatenated into the SSR output by `prepare()`.
	 *
	 * Fed by bun's CSS bundling (`import stylesheet from "./component.css"`) in
	 * the browser path, or assigned directly. `prepare()` reads it to build one
	 * `<style>` tag for every used component.
	 */
	static css = "";

	/**
	 * Optional declarative event map, mapping a binding to a handler method name.
	 *
	 * A binding is either `"eventType selector"` (DOM event) or `"tag:name"`
	 * (inter-component message). Handlers are methods on the component class,
	 * run with `this` bound to the component instance.
	 */
	static events: EventMap = {};

	/**
	 * Attribute names observed for changes, written into `state`.
	 */
	static observedAttributes: string[] = [];

	/**
	 * Optional coercion map from attribute name to `AttributeType`.
	 */
	static attributeTypes: Record<string, AttributeType> = {};

	/**
	 * The global data store shared by every component.
	 *
	 * Set through `define({ globalStore })`. A component consults it on mount as
	 * a fallback for its observed attributes: an explicit attribute on the tag
	 * wins, and the store key of the same name is used only when the attribute
	 * is absent.
	 */
	static globalStore: TemplesData | undefined;

	/**
	 * Reactive component state.
	 *
	 * Initialized through the constructor: a subclass passes its initial plain
	 * object to `super()`, e.g. `super({ count: 0 })`. The object is wrapped in
	 * a reactive proxy at construction, so any mutation re-renders the
	 * component once it is connected. The property is defined by the
	 * constructor, non-writable and non-configurable.
	 */
	declare readonly state: T;

	private renderer: Renderer | null = null;
	private unsubscribeState: (() => void) | null = null;

	/**
	 * The children authored on the tag, captured on the first connection and
	 * projected into the template's `<slot>` elements.
	 *
	 * They are held here rather than read from `childNodes` on every render: a
	 * transient disconnect destroys the rendered subtree, and a later connect
	 * must project the same authored children again.
	 */
	private slotted: Node[] | null = null;

	/**
	 * The instance's active event bindings, mapping a binding to its resolved
	 * handler method. Seeded from the class `events` map on connection and
	 * extended by dynamic `on()` calls.
	 */
	private eventHandlers: Record<string, EventHandler> = {};

	/**
	 * Unsubscribe functions for the message subscriptions made by this instance.
	 */
	private messageUnsubscribers: (() => void)[] = [];

	/**
	 * Create the component with its initial state.
	 *
	 * The platform instantiates custom elements with no arguments, so the
	 * initial state defaults to an empty object. A subclass passes its own
	 * initial values with `super({ count: 0 })`; `connectedCallback` then seeds
	 * the observed attributes and the global store on top of them.
	 *
	 * The initial object is copied before it becomes reactive, so two instances
	 * of the same class never share one `state` — even when the subclass passes
	 * a module-level constant. The copy is shallow: a nested object or array is
	 * still shared by reference, so nested state must be created per instance
	 * (pass it from the constructor) rather than baked into a shared constant.
	 *
	 * The `state` property is defined non-writable and non-configurable, so a
	 * subclass that redeclares it as a class field breaks at construction
	 * instead of silently replacing the reactive proxy.
	 *
	 * @param state - The initial state values, shaped by the subclass state
	 * type `T`.
	 */
	constructor(state: T = {} as T) {
		super();
		Object.defineProperty(this, "state", {
			value: reactive({ ...state }),
			writable: false,
			enumerable: true,
			configurable: false
		});
	}

	/**
	 * Register the custom element with an explicit tag, class, and options.
	 *
	 * The options carry the template, the `attributes` map, the events, the
	 * stylesheet, and the global store, while the class carries its `state` and
	 * handler methods. `define()` parses the template once, derives the class
	 * `observedAttributes` and `attributeTypes` statics from the `attributes`
	 * map so the platform observes the declared names, and copies the options
	 * onto the class's static fields so server-side rendering can read them.
	 *
	 * @param tagName - The custom element tag name (must contain a hyphen).
	 * @param componentClass - The class extending `TemplesComponent`.
	 * @param options - The template (required), the optional `attributes` map,
	 * events, css, and global store.
	 */
	static define(
		tagName: string,
		componentClass: TemplesComponentClass,
		options: DefineOptions
	): void {
		componentClass.tag = tagName;
		componentClass.template = options.template;

		if (options.attributes !== undefined) {
			TemplesComponent.assertNoStaticAttributes(tagName, componentClass);
			componentClass.attributeTypes = options.attributes;
			componentClass.observedAttributes = Object.keys(options.attributes);
		}

		if (options.events !== undefined) {
			componentClass.events = options.events;
		}

		componentClass.css = options.css ?? "";

		if (options.globalStore !== undefined) {
			TemplesComponent.globalStore = options.globalStore;
		}

		TemplesComponent.resolveTemplate(componentClass);
		TemplesComponent.registerEventTypes(componentClass);

		// The platform calls a custom element constructor with no arguments;
		// the `never[]` boundary signature accepts every subclass constructor.
		customElements.define(
			componentClass.tag,
			componentClass as unknown as CustomElementConstructor
		);
	}

	/**
	 * Reject a component that declares its attributes twice.
	 *
	 * The `attributes` option is the single source of truth for the observed
	 * attributes and their coercion types. A class that also declares its own
	 * `observedAttributes` or `attributeTypes` statics carries two competing
	 * sources, so `define()` refuses the registration.
	 *
	 * @param tagName - The custom element tag name, quoted in the error message.
	 * @param ctor - The component class to check.
	 */
	private static assertNoStaticAttributes(tagName: string, ctor: TemplesComponentClass): void {
		const hasOwnObserved = Object.hasOwn(ctor, "observedAttributes");
		const hasOwnTypes = Object.hasOwn(ctor, "attributeTypes");

		if (hasOwnObserved || hasOwnTypes) {
			throw new Error(
				`Component "${tagName}" declares attributes on static fields and in define() options. Remove the static declaration and pass { attributes } to define().`
			);
		}
	}

	/**
	 * Register one document listener per DOM event type declared in the class map.
	 *
	 * Listeners are deduplicated by event type across all component classes, so
	 * a click handler is attached to the document exactly once no matter how
	 * many classes or instances use it. Message bindings (no selector) need no
	 * document listener.
	 *
	 * @param ctor - The component class whose `events` map to register.
	 */
	private static registerEventTypes(ctor: TemplesComponentClass): void {
		for (const binding of Object.keys(ctor.events)) {
			const space = binding.indexOf(" ");

			if (space === -1) continue;

			TemplesComponent.ensureDocumentListener(binding.slice(0, space));
		}
	}

	/**
	 * Attach a document listener for an event type, deduplicated by type.
	 *
	 * The listener resolves the closest component of the event target and
	 * dispatches to its instance `eventHandlers` map.
	 *
	 * @param type - The event type to listen for.
	 */
	private static ensureDocumentListener(type: string): void {
		if (documentListeners.has(type)) return;

		const listener = (event: Event): void => TemplesComponent.dispatch(type, event);

		document.addEventListener(type, listener);
		documentListeners.set(type, listener);
	}

	/**
	 * Handle a document-level event for one event type.
	 *
	 * The closest `TemplesComponent` ancestor of the event target owns the
	 * event: only its instance `eventHandlers` map is consulted, and a missing
	 * selector match there leaves outer components untouched. The matched
	 * handler runs with `this` bound to the owning component.
	 *
	 * @param type - The event type this listener was registered for.
	 * @param event - The event that bubbled to the document.
	 */
	private static dispatch(type: string, event: Event): void {
		const component = TemplesComponent.resolveComponent(event);

		if (component === null) return;

		for (const [binding, handler] of Object.entries(component.eventHandlers)) {
			const separator = binding.indexOf(" ");
			const bindingType = binding.slice(0, separator);

			if (bindingType !== type) continue;

			const selector = binding.slice(separator + 1).trim();

			if (TemplesComponent.matchesSelector(event, selector, component)) {
				handler.call(component, event);
			}
		}
	}

	/**
	 * Find the closest `TemplesComponent` ancestor of the event target.
	 *
	 * Walks the composed path from the target upward and returns the first
	 * element that is a component instance, or null when the event originates
	 * outside every component.
	 *
	 * @param event - The event whose target to resolve.
	 * @returns The closest component ancestor, or null.
	 */
	private static resolveComponent(event: Event): TemplesComponent<object> | null {
		for (const node of event.composedPath()) {
			if (node instanceof TemplesComponent) return node;
		}

		return null;
	}

	/**
	 * Match a selector against the event target within the component subtree.
	 *
	 * Walks the composed path from the target up to the component itself; the
	 * first element that matches wins, and the component is the last node
	 * considered.
	 *
	 * @param event - The event whose target to match.
	 * @param selector - The CSS selector from the event binding.
	 * @param component - The owning component that bounds the match.
	 * @returns True when an element from the target up to the component matches.
	 */
	private static matchesSelector(
		event: Event,
		selector: string,
		component: TemplesComponent<object>
	): boolean {
		for (const node of event.composedPath()) {
			if (node === component) return component.matches(selector);
			if (node instanceof Element && node.matches(selector)) return true;
		}

		return false;
	}

	/**
	 * Resolve the class template in the document head, creating it if missing.
	 *
	 * The template is identified by the tag name: `template#<tag>`. When it is
	 * absent, a `<template id="<tag>">` is created, filled from the class
	 * `template` string, and appended to the head. Keeping templates in the
	 * document makes them inspectable and lets components clone their content
	 * without re-parsing the string.
	 *
	 * @param ctor - The component class whose template to resolve.
	 * @returns The template element in the document head.
	 */
	private static resolveTemplate(ctor: TemplesComponentClass): HTMLTemplateElement {
		let template = document.head.querySelector<HTMLTemplateElement>(`template#${ctor.tag}`);

		if (template === null) {
			template = document.createElement("template");
			template.id = ctor.tag;
			template.innerHTML = ctor.template;
			document.head.appendChild(template);
		}

		return template;
	}

	/**
	 * Render the state and seed the observed attributes.
	 *
	 * The template content is rendered into an internal container, the authored
	 * children are projected into its slots, and the result is adopted into the
	 * host. The host's own attributes are left untouched so a parent component
	 * can feed it through `data-bind`; rendering against the container prevents
	 * the renderer from stripping those attributes.
	 *
	 * Called by the browser when the element connects to the DOM.
	 */
	connectedCallback(): void {
		const ctor = this.constructor as typeof TemplesComponent;
		const template = TemplesComponent.resolveTemplate(ctor);
		const content = template.content.cloneNode(true) as DocumentFragment;
		const container = document.createElement("div");

		container.appendChild(content);
		this.renderer = new Renderer(container);

		// Capture the authored children once. On a later connection the host
		// already holds the previously rendered markup, not the authored set.
		if (this.slotted === null) this.slotted = Array.from(this.childNodes);

		for (const name of ctor.observedAttributes) {
			const state = this.state as Record<string, unknown>;

			if (this.hasAttribute(name)) {
				state[name] = this.coerceAttribute(name, this.getAttribute(name));
			} else if (
				TemplesComponent.globalStore !== undefined &&
				name in TemplesComponent.globalStore
			) {
				state[name] = TemplesComponent.globalStore[name];
			}
		}

		this.renderer.render(this.state as TemplesData);
		this.projectSlots(container);

		while (container.firstChild !== null) this.appendChild(container.firstChild);

		this.unsubscribeState = subscribe(this.state, () => this.rerender());
		this.on(ctor.events);
	}

	/**
	 * Release the state subscription, the event bindings, and the children.
	 *
	 * Message subscriptions are unsubscribed so a removed component stops
	 * receiving inter-component messages. Document-level event listeners
	 * persist for the lifetime of the document and are not tied to any single
	 * instance.
	 *
	 * Called by the browser when the element disconnects from the DOM.
	 */
	disconnectedCallback(): void {
		if (this.unsubscribeState !== null) {
			this.unsubscribeState();
			this.unsubscribeState = null;
		}

		for (const unsubscribe of this.messageUnsubscribers) unsubscribe();
		this.messageUnsubscribers = [];
		this.eventHandlers = {};

		this.renderer = null;
		this.replaceChildren();
	}

	/**
	 * Write a coerced attribute into `state` and re-render.
	 *
	 * Called by the browser for every attribute listed in the subclass's
	 * `observedAttributes` array.
	 *
	 * @param name - The changed attribute name.
	 * @param _oldValue - The previous value, or null when newly set.
	 * @param newValue - The new value, or null when removed.
	 */
	attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
		(this.state as Record<string, unknown>)[name] = this.coerceAttribute(name, newValue);

		this.rerender();
	}

	/**
	 * Emit a message on the shared event bus.
	 *
	 * The message is delivered under the fully qualified name `<tag>:<name>`, so
	 * an emitter writes a short local name and classes never collide. Subscribers
	 * elsewhere register `"<tag>:<name>"` in their `events` map.
	 *
	 * @param eventName - The local message name, prefixed with the emitting tag.
	 * @param detail - Optional payload delivered on the message's `detail`.
	 */
	emit(eventName: string, detail?: unknown): void {
		const ctor = this.constructor as typeof TemplesComponent;

		dispatchMessage(`${ctor.tag}:${eventName}`, detail);
	}

	/**
	 * Register a map of event bindings on this instance.
	 *
	 * Each binding maps to a handler method name. A binding with a space is a
	 * DOM event, `"eventType selector"`, delivered by a shared document
	 * listener; a binding without a space is an inter-component message,
	 * `"tag:name"`, delivered by the shared event bus. In both cases the handler
	 * runs with `this` bound to this component.
	 *
	 * The class `events` map is registered automatically on connection; this
	 * method also lets a component add bindings at runtime.
	 *
	 * @param events - The event bindings to register, `binding: methodName`.
	 */
	on(events: EventMap): void {
		for (const [binding, methodName] of Object.entries(events)) {
			const handler = this.resolveHandler(methodName);
			const space = binding.indexOf(" ");

			if (space === -1) {
				this.subscribeMessage(binding, handler);
			} else {
				this.eventHandlers[binding] = handler;
				TemplesComponent.ensureDocumentListener(binding.slice(0, space));
			}
		}
	}

	/**
	 * Resolve a handler method name to the method on this component.
	 *
	 * The method is looked up by name so handlers are declared as ordinary class
	 * methods and run with `this` bound to the component instance.
	 *
	 * @param methodName - The handler method name from an event binding.
	 * @returns The handler method.
	 */
	private resolveHandler(methodName: string): EventHandler {
		const method = (this as unknown as Record<string, EventHandler>)[methodName];

		if (typeof method !== "function") {
			throw new Error(`Event handler "${methodName}" is not a method of <${this.tagName}>`);
		}

		return method;
	}

	/**
	 * Subscribe this component to a message on the shared event bus.
	 *
	 * The subscription is stored with the owning component so delivery runs the
	 * handler with `this` bound to it. The unsubscribe function is retained so
	 * `disconnectedCallback` can release every subscription of the instance.
	 *
	 * @param name - The fully qualified message name to listen for.
	 * @param handler - The handler method invoked with the delivered `CustomEvent`.
	 */
	private subscribeMessage(name: string, handler: EventHandler): void {
		let set = messageHandlers.get(name);

		if (set === undefined) {
			set = new Set();
			messageHandlers.set(name, set);
		}

		const subscription: MessageSubscription = { component: this, handler };

		set.add(subscription);

		this.messageUnsubscribers.push(() => {
			set.delete(subscription);
		});
	}

	/**
	 * Re-render every binding from the current state.
	 *
	 * The renderer updates the existing elements in place, so a state change
	 * never detaches the subtree. A detached subtree would fire the nested
	 * components' `disconnectedCallback`, which discards the DOM they hold —
	 * including any content projected into their slots.
	 */
	private rerender(): void {
		if (this.renderer === null) return;

		this.renderer.render(this.state as TemplesData);
	}

	/**
	 * Distribute the authored children into the template's slots.
	 *
	 * Each `<slot>` or `<slot name="…">` receives the matching authored
	 * children; a slot with no match keeps its own fallback content. Every slot
	 * wrapper is then removed, promoting its projected or fallback children.
	 * Authored children that match no slot are appended after the template.
	 *
	 * @param container - The rendered template root, holding the `<slot>`
	 * elements.
	 */
	private projectSlots(container: Element): void {
		const authored = this.slotted ?? [];
		const slots = Array.from(container.querySelectorAll("slot"));
		const assigned = new Set<Node>();

		for (const slot of slots) {
			const name = slot.getAttribute("name");
			const matching =
				name === null
					? authored.filter(
							(node) => !(node instanceof Element && node.getAttribute("slot") !== null)
						)
					: authored.filter(
							(node) => node instanceof Element && node.getAttribute("slot") === name
						);

			if (matching.length === 0) continue;

			slot.replaceChildren();

			for (const node of matching) {
				slot.appendChild(node);
				assigned.add(node);
			}
		}

		// Remove every <slot> wrapper, promoting its (projected or fallback) children.
		for (const slot of slots) {
			const parent = slot.parentNode;

			if (parent === null) continue;

			while (slot.firstChild !== null) parent.insertBefore(slot.firstChild, slot);

			parent.removeChild(slot);
		}

		// Authored children that match no slot are appended after the template.
		for (const node of authored) {
			if (!assigned.has(node)) container.appendChild(node);
		}
	}

	/**
	 * Coerce a raw attribute value according to its declared type.
	 *
	 * An untyped attribute writes a raw string. `boolean` maps `"false"` and
	 * `"0"` to `false`, `number` parses a number (falling back to the raw
	 * string), and `json` parses an object or array (falling back to the raw
	 * string). A removed attribute (`null`) yields the neutral value.
	 *
	 * @param name - The attribute name, used to look up its declared type.
	 * @param raw - The raw attribute value, or null when removed.
	 * @returns The coerced value written into `state`.
	 */
	private coerceAttribute(name: string, raw: string | null): unknown {
		const ctor = this.constructor as typeof TemplesComponent;
		const type = ctor.attributeTypes[name] ?? "string";

		switch (type) {
			case "boolean":
				return raw === null ? false : raw !== "false" && raw !== "0";
			case "number": {
				if (raw === null) return 0;

				const value = Number(raw);

				return Number.isNaN(value) ? raw : value;
			}
			case "json": {
				if (raw === null) return null;

				try {
					return JSON.parse(raw);
				} catch {
					return raw;
				}
			}
			default:
				return raw ?? "";
		}
	}
}
