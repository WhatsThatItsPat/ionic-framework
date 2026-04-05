# Reproducing This PR From Scratch

A clean, step-by-step guide to implement the `keyboard-showing` feature — the way you'd do it knowing the full solution upfront, organized into one sensible commit per logical unit of work.

**The feature:** Add a `keyboard-showing` CSS class to `ion-app` when the software keyboard opens, so any component in the app can respond to keyboard visibility without relying on the internal `tab-bar-hidden` class.

**Issue reference:** [ionic-team/ionic-framework#29887](https://github.com/ionic-team/ionic-framework/issues/29887)

---

## Before you start

```bash
# Fork ionic-framework on GitHub, then:
git clone https://github.com/<you>/ionic-framework.git
cd ionic-framework
git checkout -b feat/keyboard-showing-on-ion-app

cd core
npm install
```

---

## Commit 1 — `feat(app): add keyboard-showing class to ion-app when keyboard is open`

**Files changed:**
- `core/src/components/app/app.tsx`

**What to do:**

### 1a. Understand the existing pattern

Before writing any code, read how `ion-tab-bar` already handles keyboard state:

```
core/src/components/tab-bar/tab-bar.tsx
core/src/utils/keyboard/keyboard-controller.ts
```

Key observations:
- `createKeyboardController()` wraps `keyboardWillShow` / `keyboardWillHide` window events
- It provides a `waitForResize` promise so you can wait for the webview to resize before updating UI
- The controller must be destroyed in `disconnectedCallback` to avoid leaks

### 1b. Add the controller to `ion-app`

In `core/src/components/app/app.tsx`:

1. Import `State` from `@stencil/core` (add to existing import)
2. Import `KeyboardController` type and `createKeyboardController` from `@utils/keyboard/keyboard-controller`
3. Add private fields `keyboardCtrl`, `keyboardCtrlPromise`
4. Add `@State() keyboardVisible = false`
5. Add `async connectedCallback()` following the same pattern as `tab-bar.tsx`:
   - Create the controller with a callback that awaits `waitForResize` before updating `keyboardVisible`
   - Store the promise/controller safely (handles the race condition if the component disconnects during the `await`)
6. Extend `disconnectedCallback()` to destroy the controller
7. Add `'keyboard-showing': this.keyboardVisible` to the `Host` class map in `render()`

### 1c. Verify

```bash
cd core
npm run lint.ts
```

> **Note — no tests.** Ionic never tested `tab-bar-hidden` (the previous equivalent keyboard-driven class on `ion-tab-bar`). Dispatching synthetic `keyboardWillShow`/`keyboardWillHide` events in spec or e2e tests would test the wiring between JS and CSS, but that wiring only fires in Capacitor/Cordova contexts — synthetic events in a Playwright/jsdom environment don't represent the real scenario. Following Ionic's own precedent, we verify this manually during development.

---

## Commit 2 — `refactor(tab-bar): replace KeyboardController with MutationObserver on ion-app`

**Files changed:**
- `core/src/components/tab-bar/tab-bar.scss`
- `core/src/components/tab-bar/tab-bar.tsx`

**What to do:**

### 2a. Replace the KeyboardController in `tab-bar.tsx`

Now that `ion-app` manages keyboard state and exposes it as a class, `ion-tab-bar` no longer needs its own `KeyboardController`. Instead, use a `MutationObserver` to watch `ion-app` for the `keyboard-showing` class:

- Remove `KeyboardController` imports
- Remove the old `keyboardWillShow`/`keyboardWillHide` logic
- Keep `@Element() el` — needed for `this.el.closest('ion-app')`
- Change `@State() keyboardVisible` to `@State() keyboardHidden = false` — this tracks whether the tab bar should be hidden
- In `connectedCallback`, set up a `MutationObserver` on the closest `ion-app`, watching `{ attributes: true, attributeFilter: ['class'] }`. When `keyboard-showing` appears, set `this.keyboardHidden = true` (respecting `slot="top"`)
- Clean up the observer in `disconnectedCallback`
- In `render()`, add `'tab-bar-hidden': this.keyboardHidden` to the `Host` class map
- Remove the `aria-hidden` attribute — `display: none` handles the accessibility tree

**Why `@State` + `render()` instead of `classList.toggle`?** This is the idiomatic Stencil approach. `@State` tells Stencil "this value drives my rendered output — when it changes, re-run `render()`." Using `classList.toggle` outside `render()` bypasses Stencil's VDOM — and a re-render triggered by another cause (e.g., `color` or `translucent` prop change) could overwrite the class list with what Stencil *thinks* it should be, silently removing `tab-bar-hidden`. With `@State`, the class survives re-renders because Stencil manages it in the VDOM.

**Why not `:host-context()`?** You might consider using `:host-context(ion-app.keyboard-showing)` in the CSS to eliminate the need for a `MutationObserver` entirely. However, `:host-context()` is **not supported on Safari/WebKit (iOS)**. Since keyboard events primarily fire in Capacitor/Cordova contexts — and iOS is the primary target — `:host-context()` doesn't work where it matters most. See:
- https://caniuse.com/?search=host-context
- https://github.com/w3c/csswg-drafts/issues/1914

Ionic's own RTL mixin (`ionic.mixins.scss`) already demonstrates this limitation: it generates three separate fallback selectors because `:host-context()` is unreliable across browsers.

### 2b. Update `tab-bar.scss`

Update the CSS comment on the `.tab-bar-hidden` rule to explain the architecture:

```scss
/**
 * Hide the tab bar when the keyboard is open. The `keyboard-showing` class
 * is set on `ion-app` by the KeyboardController when the soft keyboard opens.
 * The `tab-bar.tsx` component watches for this class via a MutationObserver
 * and sets the `tab-bar-hidden` host class, which triggers this rule.
 *
 * NOTE: We use `:host(.tab-bar-hidden)` rather than
 * `:host-context(ion-app.keyboard-showing)` because `:host-context()`
 * is not supported on Safari/WebKit (iOS). See:
 * https://caniuse.com/?search=host-context
 * https://github.com/w3c/csswg-drafts/issues/1914
 */
:host(.tab-bar-hidden) {
  /* stylelint-disable-next-line declaration-no-important */
  display: none !important;
}
```

Why `display: none` handles accessibility: an element with `display: none` is automatically removed from the browser's accessibility tree. No explicit `aria-hidden="true"` is needed.

### 2c. Verify

```bash
npm run lint.ts && npm run lint.sass
```

---

## Summary of commits

| # | Message | Files |
|---|---------|-------|
| 1 | `feat(app): add keyboard-showing class to ion-app when keyboard is open` | `app.tsx` |
| 2 | `refactor(tab-bar): replace KeyboardController with MutationObserver on ion-app` | `tab-bar.scss`, `tab-bar.tsx` |

---

## A note on testing

This PR adds no new spec or e2e tests, and that is intentional.

- **Ionic never tested `tab-bar-hidden`** — the previous keyboard-driven class behavior on `ion-tab-bar` had zero test coverage in the original framework.
- **Keyboard events are Capacitor/Cordova-only** — `keyboardWillShow` and `keyboardWillHide` are fired by native runtime bridges. Dispatching synthetic equivalents in Playwright/jsdom tests doesn't represent the real device scenario.
- **`printIonWarning` is not called per-component.** We considered adding a console warning for `tab-bar-hidden`, but the warning would fire for **every** Capacitor/Cordova user on every keyboard open — not just users whose CSS or JS relies on `.tab-bar-hidden`. There's no way to detect actual usage of the class.
- **Manual verification is appropriate here** — use the playground app (see [local-dev-playground.md](./local-dev-playground.md)) with Safari DevTools on a real or simulated device to confirm the behavior.

---

## Further reading

- [Local Dev Playground Guide](./local-dev-playground.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [Stencil Component Lifecycle](https://stenciljs.com/docs/component-lifecycle)
- [Stencil Shadow DOM & Scoped CSS](https://stenciljs.com/docs/styling)
