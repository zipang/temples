import { TemplesComponent } from "@temples/components";
import template from "./icon-button.html" with { type: "text" };

import "./icon-button.css";

/**
 * The payload published by an `icon-button` action message.
 *
 * `source` is the `icon-button` host that fired, so a subscriber can read the
 * button attributes, such as `data-id`.
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
 * the message channel the button publishes on a click.
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
 * attribute as a message channel (`shopping-item:save`), so the message reads
 * as the intent, not as a generic click. The payload carries the host element
 * as `source`.
 *
 * The message bubbles to the nearest subscribed ancestor, so the owner of the
 * button handles the intent and stops the walk. With `type="submit"` the button
 * submits its form instead, and no message is published.
 */
export class IconButton extends TemplesComponent<IconButtonState> {
	constructor() {
		super(INITIAL_STATE);
	}

	/**
	 * Publish the button intent, named by the `action` attribute, on a click.
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
