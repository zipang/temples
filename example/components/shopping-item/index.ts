import { TemplesComponent } from "@temples/components";
import type { ShoppingItemData } from "../../types.ts";
import { isIconButtonAction } from "../icon-button/index.ts";
import template from "./shopping-item.html" with { type: "text" };

import "./shopping-item.css";

/**
 * The complete state shape of a shopping item: the observed attributes from
 * the `attributes` map, plus the internal editor flag and the two computed
 * helpers the template calls.
 */
type ShoppingItemState = ShoppingItemData & {
	checked: boolean;
	editing: boolean;
	checkedStatus(): string;
	editingStatus(): string;
};

const INITIAL_STATE: ShoppingItemState = {
	id: "",
	label: "",
	checked: false,
	editing: false,
	checkedStatus() {
		return this.checked ? "checked" : "";
	},
	editingStatus() {
		return this.editing ? "editing" : "";
	}
};

/**
 * Check that an icon button action comes from a button inside the owner.
 *
 * The bus broadcasts every action to every subscriber, so an item handles an
 * action only when the emitting `icon-button` is one of its own.
 *
 * @param detail - The message payload received by the item.
 * @param owner - The shopping item that received the message.
 * @returns True when the payload carries an emitting host inside `owner`.
 */
const isOwnIconButton = (detail: unknown, owner: Element): boolean =>
	isIconButtonAction(detail) && owner.contains(detail.source);

/**
 * A single shopping list entry, configured through plain attributes.
 *
 * `id`, `label`, and `checked` are observed attributes declared in the
 * `attributes` map of `define()`, fed by the parent `shopping-app`. `editing`
 * is internal state that toggles the inline editor. The component never
 * mutates the shared list directly: it emits `updated` and `removed` messages
 * carrying the full item, and the app owns the data.
 */
export class ShoppingItem extends TemplesComponent<ShoppingItemState> {
	constructor() {
		super(INITIAL_STATE);
	}

	/**
	 * Flip the checked flag and publish the updated item.
	 */
	toggle(): void {
		this.state.checked = !this.state.checked;
		this.emit("updated", this.snapshot());
	}

	/**
	 * Enter inline edit mode.
	 */
	edit(): void {
		this.state.editing = true;
	}

	/**
	 * Commit the edited label and leave edit mode.
	 */
	save(): void {
		const input = this.querySelector<HTMLInputElement>("input.edit-input");
		const label = input?.value.trim() ?? "";

		if (label === "") return;

		this.emit("updated", { id: this.state.id, label, checked: this.state.checked });
		this.state.editing = false;
	}

	/**
	 * Publish a removal request for this item.
	 */
	removeItem(): void {
		this.emit("removed", this.snapshot());
	}

	/**
	 * Apply a `save` action from one of this item's icon buttons.
	 *
	 * The action reaches every item on the shared bus, so it applies only when
	 * the emitting button is inside this item.
	 */
	saveAction(evt: CustomEvent): void {
		if (!isOwnIconButton(evt.detail, this)) return;

		this.save();
	}

	/**
	 * Apply a `remove` action from one of this item's icon buttons.
	 *
	 * The action reaches every item on the shared bus, so it applies only when
	 * the emitting button is inside this item.
	 */
	removeAction(evt: CustomEvent): void {
		if (!isOwnIconButton(evt.detail, this)) return;

		this.removeItem();
	}

	/**
	 * Commit the edited label when Enter is pressed in the edit input, as a
	 * click on the Save icon button does.
	 */
	commitOnEnter(evt: KeyboardEvent): void {
		if (evt.key !== "Enter") return;

		evt.preventDefault();
		this.save();
	}

	/**
	 * Build the plain data payload carried by every message.
	 */
	private snapshot(): ShoppingItemData {
		const { id, label, checked } = this.state;

		return { id, label, checked };
	}
}

TemplesComponent.define("shopping-item", ShoppingItem, {
	template,
	attributes: { id: "string", label: "string", checked: "boolean" },
	events: {
		"change .toggle": "toggle",
		"dblclick .label": "edit",
		"keydown .edit-input": "commitOnEnter",
		"icon-button:save": "saveAction",
		"icon-button:remove": "removeAction"
	}
});
