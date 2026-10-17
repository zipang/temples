---
title: How to send messages
description: Send an intent up to the owner and a change out to the app.
order: 10
---

# How to send messages

A component talks in two directions. An **intent** goes up to the owner that owns the data. A
**change** goes out on the message bus to the components that do not know the emitter.

## Send an intent to the owner

The reusable child publishes the intent. The owner is the nearest subscribed ancestor, so it
handles the intent first and stops the walk.

```javascript
// child: publish the intent
this.emit("cart-item:remove", { source: this });
```

```javascript
// owner: handle the intent and stop it
events: {
    "cart-item:remove": "onCartItemRemove",
},

onCartItemRemove(event) {
    event.stopPropagation();
    // remove the line, then publish the change
}
```

## Send a change to the app

The owner publishes the change after it updates its state. Do not stop a change that other
components need.

```javascript
this.emit("cart-item:removed", { id });
```
