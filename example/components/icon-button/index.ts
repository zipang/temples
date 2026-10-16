import { TemplesComponent } from "@temples/components";
import template from "./icon-button.html" with { type: "text" };

import "./icon-button.css";

/**
 * The payload published by an `icon-button` action event.
 *
 * `source` is the `icon-button` host that fired, so a parent with several
 * buttons reacts only to its own.
 */
export interface IconButtonAction {
	source: Element;
}

/**
 * Check that a message payload is an icon button action.
 *
 * @param value - The message payload to check.
 * @returns True when the payload carries the emitting host.
 */
export const isIconButtonAction = (value: unknown): value is IconButtonAction => {
	if (typeof value !== "object" || value === null) return false;
	if (!("source" in value)) return false;

	return value.source instanceof Element;
};

/**
 * The complete state shape of an icon button: the three observed attributes.
 *
 * `title` labels the button and feeds its native tooltip; `type` is the native
 * button type (`"button"` by default, `"submit"` inside a form); `action` names
 * what the button does and travels with the click message.
 */
type IconButtonState = {
	title: string;
	type: string;
	action: string;
};

const INITIAL_STATE: IconButtonState = {
	title: "",
	type: "button",
	action: ""
};

/**
 * A button whose label is an icon authored on the tag.
 *
 * The `title` attribute feeds the accessible name, while the default `slot`
 * receives the icon markup — an inline SVG. A click publishes the `action`
 * attribute as the event name (`icon-button:save`, `icon-button:remove`), so
 * the message reads as the intent, not as a generic click. The payload carries
 * the host element as `source`: the bus broadcasts to every subscriber, so a
 * parent that owns several buttons uses `source` to handle only its own.
 *
 * With `type="submit"` the button submits its form instead, and no action is
 * published.
 */
export class IconButton extends TemplesComponent<IconButtonState> {
	constructor() {
		super(INITIAL_STATE);
	}

	/**
	 * Publish the button action, named by the event, when the inner button is
	 * clicked.
	 */
	onClick(): void {
		if (this.state.action === "") return;

		this.emit(this.state.action, { source: this });
	}
}

TemplesComponent.define("icon-button", IconButton, {
	template,
	attributes: { title: "string", type: "string", action: "string" },
	events: {
		"click button": "onClick"
	}
});
