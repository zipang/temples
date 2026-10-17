---
title: Communicate between loose components with a message bus
description: Let components talk without knowing each other. One message asks, and one message reports.
order: 10
---

# Communicate between loose components with a message bus

**Problem.** Two components must work together. You do not want either one to know the other.

## Solution

Think of a classroom. A student wants to add a name to the class list, and the teacher keeps the
list. The student does not know the other students. The teacher does not know who reads the board.

The **message bus** works the same way. A component publishes a **message** on a channel. Every
component that subscribed to that channel receives the message. The sender does not know the
receivers, and the receivers do not know the sender. This design is called **Event-Driven
Architecture** (EDA).

The message bus brings three advantages:

- **Loose coupling.** A component names a channel, not another component. You add a listener
  without a change to the sender.
- **One route for everyone.** A message goes up to the ancestor components first, then it reaches
  the bus. So the owner can answer, and the change still reaches the app.
- **Easy tests.** A test publishes a message and checks the result. It does not wire components
  together.

A message carries one of two meanings. Keep the two apart.

**An intent asks for an action.** It names what the user wants, for example `cart-item:remove`.
The intent goes up to the owner that holds the data. The owner handles it and stops the walk, so
the other instances never see it.

```javascript
// child: ask the owner to remove the line
this.emit("cart-item:remove", { source: this });
```

```javascript
// owner: handle the intent, then stop the walk
events: {
    "cart-item:remove": "onCartItemRemove",
},

onCartItemRemove(event) {
    event.stopPropagation();
    // remove the line, then publish the change
}
```

**A change reports a result.** It names what happened, for example `cart-item:removed`. The owner
publishes it after it updates its state. The change reaches every subscriber, so a component that
does not know the owner can react.

```javascript
// owner: report the result to the app
this.emit("cart-item:removed", { id });
```

Do not stop a change. Another component may need it.

Name a message handler `on<EventName>`, with the channel in PascalCase: `onCartItemUpdated` handles
`cart-item:updated`. A channel groups a domain family, not a component class.

The [components guide](components.html#events-and-messaging) explains the binding syntax.

## Why it works

- The channel name carries the meaning. Sender and receiver share a name, not a reference.
- The intent is directed and stops at the owner. The change is broadcast and reaches the bus.
- The owner is the only writer of its data. A listener reacts to the change and never mutates the
  owner's state.

## Pitfalls

- An intent that reaches the bus becomes a hidden command. Stop it at the owner.
- A change that a handler stops disappears for the other listeners. Do not stop a change.
- A listener that writes into the owner's state breaks the one-writer rule. React instead.

## Further reading

The message bus is one part of a larger design called Event-Driven Architecture. These sources
explain the ideas behind it.

- [What do you mean by "Event-Driven"?](https://martinfowler.com/articles/201701-event-driven.html)
  — Martin Fowler separates four patterns: event notification, event-carried state transfer,
  event sourcing, and CQRS.
- [Event-Driven Architecture Style](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/event-driven)
  — the Microsoft Azure Architecture Center describes producers, consumers, and event channels.
- [Don't let Event-Driven Architecture buzzwords fool you](https://event-driven.io/en/dont_let_event_driven_architecture_buzzwords_fool_you/)
  — Oskar Dudycz explains the difference between a command (an intent) and an event (a fact).
- [Event-driven = Loosely coupled? Not so fast!](https://www.enterpriseintegrationpatterns.com/ramblings/eventdriven_coupling.html)
  — Gregor Hohpe shows which part of the decoupling comes from the publish-subscribe channel.
- [Event bubbling](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Event_bubbling)
  — the MDN guide to the DOM behavior that the message bus follows.
