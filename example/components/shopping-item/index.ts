import { TemplesComponent } from "@temples/components";
import type { ShoppingItemData } from "../../types.ts";
import template from "./shopping-item.html" with { type: "text" };

import "./shopping-item.css";

/**
 * The complete state shape of a shopping item: the observed attributes from
 * the `attributes` map, plus the internal editor flag and the two computed
 * helpers the template calls.
 */
type ShoppingItemState = ShoppingItemData & {
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
 * A single shopping list entry, configured through plain attributes.
 *
 * `id`, `label`, and `checked` are observed attributes declared in the
 * `attributes` map of `define()`, fed by the parent `shopping-app`. `editing`
 * is internal state that toggles the inline editor.
 *
 * The item owns the data it shows. When the user changes it, the item publishes
 * a change message on the `shopping-item` channel: `shopping-item:updated` on
 * an edit or a toggle, and `shopping-item:removed` on a removal. The app
 * subscribes to both, and the vault subscribes to `shopping-item:removed`. The
 * item never mutates the shared list directly.
 *
 * The item also handles the intents from its own icon buttons. The button sends
 * `shopping-item:save` or `shopping-item:remove`; the item is the nearest
 * subscribed ancestor, so it receives the intent first and stops the walk. The
 * intent never reaches the other items.
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
		this.emit("shopping-item:updated", this.snapshot());
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

		this.emit("shopping-item:updated", { id: this.state.id, label, checked: this.state.checked });
		this.state.editing = false;
	}

	/**
	 * Publish a removal request for this item.
	 */
	removeItem(): void {
		this.emit("shopping-item:removed", this.snapshot());
	}

	/**
	 * Apply a `save` intent from one of this item's icon buttons.
	 *
	 * The intent bubbles to the nearest subscribed ancestor, this item. The item
	 * stops the walk so the intent stays local to the item that owns the button.
	 */
	onShoppingItemSave(evt: CustomEvent): void {
		evt.stopPropagation();
		this.save();
	}

	/**
	 * Apply a `remove` intent from one of this item's icon buttons.
	 *
	 * The intent bubbles to the nearest subscribed ancestor, this item. The item
	 * stops the walk so the intent stays local to the item that owns the button.
	 */
	onShoppingItemRemove(evt: CustomEvent): void {
		evt.stopPropagation();
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
		"shopping-item:save": "onShoppingItemSave",
		"shopping-item:remove": "onShoppingItemRemove"
	}
});
