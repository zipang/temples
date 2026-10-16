import { TemplesComponent } from "@temples/components";
import { isShoppingItemData, type ShoppingItemData } from "../../types.ts";
import { isIconButtonAction } from "../icon-button/index.ts";
import template from "./shopping-vault.html" with { type: "text" };
import "./shopping-vault.css";

/**
 * The complete state shape of the vault: the collected items and the
 * `isEmpty` helper the template calls.
 */
type ShoppingVaultState = {
	vaultItems: ShoppingItemData[];
	isEmpty(): boolean;
};

const INITIAL_STATE: ShoppingVaultState = {
	vaultItems: [],
	isEmpty() {
		return this.vaultItems.length === 0;
	}
};

/**
 * A holding place for removed items, with a way to bring them back.
 *
 * The vault listens to `shopping-item:removed` and collects the removed items.
 * Each entry exposes a recall button that emits `recalled`, which the app uses
 * to restore the item into the active list.
 */
export class ShoppingVault extends TemplesComponent<ShoppingVaultState> {
	constructor() {
		super(INITIAL_STATE);
	}

	/**
	 * Collect a removed item into the vault.
	 */
	collect(evt: CustomEvent): void {
		if (!isShoppingItemData(evt.detail)) return;

		this.state.vaultItems.push(evt.detail);
	}

	/**
	 * Remove an item from the vault and publish it for recall.
	 *
	 * The `recall` action carries the emitting icon button; its `data-id`
	 * identifies the vault entry to restore.
	 */
	recall(evt: CustomEvent): void {
		if (!isIconButtonAction(evt.detail)) return;

		const id = evt.detail.source.getAttribute("data-id");

		if (id === null) return;

		const item = this.state.vaultItems.find((entry) => entry.id === id);

		if (item === undefined) return;

		this.state.vaultItems = this.state.vaultItems.filter((entry) => entry.id !== id);
		this.emit("recalled", item);
	}
}

TemplesComponent.define("shopping-vault", ShoppingVault, {
	template,
	events: {
		"shopping-item:removed": "collect",
		"icon-button:recall": "recall"
	}
});
