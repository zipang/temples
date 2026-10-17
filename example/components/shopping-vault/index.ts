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
 * The vault subscribes to `shopping-item:removed`, a change message the item
 * publishes. The vault is a decoupled subscriber: the item does not know it,
 * so the message travels on the bus after the app handles it. Each entry
 * exposes a recall button that sends `shopping-vault:recalled`, which the app
 * uses to restore the item into the active list.
 *
 * The recall button sends the `shopping-vault:recall` intent. The vault is the
 * nearest subscribed ancestor of its own button, so it receives the intent
 * first and stops the walk.
 */
export class ShoppingVault extends TemplesComponent<ShoppingVaultState> {
	constructor() {
		// `vaultItems` is a container: create it per instance, so two vaults
		// never share one array.
		super({ ...INITIAL_STATE, vaultItems: [] });
	}

	/**
	 * Collect a removed item into the vault.
	 */
	onShoppingItemRemoved(evt: CustomEvent): void {
		if (!isShoppingItemData(evt.detail)) return;

		this.state.vaultItems.push(evt.detail);
	}

	/**
	 * Remove an item from the vault and publish it for recall.
	 *
	 * The `recall` intent carries the emitting icon button; its `data-id`
	 * identifies the vault entry to restore.
	 */
	onShoppingVaultRecall(evt: CustomEvent): void {
		evt.stopPropagation();

		if (!isIconButtonAction(evt.detail)) return;

		const id = evt.detail.source.getAttribute("data-id");

		if (id === null) return;

		const item = this.state.vaultItems.find((entry) => entry.id === id);

		if (item === undefined) return;

		this.state.vaultItems = this.state.vaultItems.filter((entry) => entry.id !== id);
		this.emit("shopping-vault:recalled", item);
	}
}

TemplesComponent.define("shopping-vault", ShoppingVault, {
	template,
	events: {
		"shopping-item:removed": "onShoppingItemRemoved",
		"shopping-vault:recall": "onShoppingVaultRecall"
	}
});
