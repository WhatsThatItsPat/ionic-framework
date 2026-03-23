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

## Commit 2 — `feat(tab-bar): move keyboard hiding to CSS :host-context()`

**Files changed:**
- `core/src/components/tab-bar/tab-bar.scss`
- `core/src/components/tab-bar/tab-bar.tsx`

**What to do:**

### 2a. Add the CSS rule to `tab-bar.scss`

Append to the end of `core/src/components/tab-bar/tab-bar.scss`:

```scss
/**
 * @deprecated - The `tab-bar-hidden` class is deprecated in favor of using
 * `ion-app.keyboard-showing` (set by `ion-app` when the keyboard opens).
 * The new `:host-context(ion-app.keyboard-showing)` selector below handles
 * hiding the tab bar via CSS. The `:host(.tab-bar-hidden)` selector is kept
 * as a backward-compatible fallback and will be removed in a future major
 * version of Ionic.
 */
:host(.tab-bar-hidden),
:host-context(ion-app.keyboard-showing):not([slot="top"]) {
  /* stylelint-disable-next-line declaration-no-important */
  display: none !important;
}
```

Why `:host-context()` is safe here: keyboard events only fire in Capacitor/Cordova contexts (WKWebView on iOS, Chromium on Android). Both runtimes fully support `:host-context()` in shadow DOM, even where desktop Firefox/Safari might not.

Why `display: none` handles accessibility: an element with `display: none` is automatically removed from the browser's accessibility tree. No explicit `aria-hidden="true"` is needed.

Why `:not([slot="top"])`: tab bars placed at the top of the screen (`slot="top"`) should not hide when the keyboard opens — matching the existing JS logic.

### 2b. Simplify `tab-bar.tsx`

Now that `ion-app` manages keyboard state and the CSS handles hiding, `ion-tab-bar` no longer needs its own `KeyboardController` for these purposes. Remove:

- `@State() keyboardVisible`
- `@Element() el` (no longer needed)
- `KeyboardController` imports
- `connectedCallback` and `disconnectedCallback` (keyboard lifecycle only)
- `aria-hidden` attribute from `render()`
- `tab-bar-hidden` class from `render()`

The render function simplifies to:

```tsx
render() {
  const { color, translucent } = this;
  const mode = getIonMode(this);
  return (
    <Host role="tablist" class={createColorClasses(color, { [mode]: true, 'tab-bar-translucent': translucent })}>
      <slot></slot>
    </Host>
  );
}
```

> **Note — intentional "mistake":** This commit deliberately removes `tab-bar-hidden` emission entirely. This is a breaking change masquerading as a cleanup. We fix it properly in commit 3. Whether you're following this guide for a video series or just learning, the value of discovering this mistake (rather than pre-emptively avoiding it) is significant: it teaches the difference between "I no longer set this class" and "I deprecated this class." If you're working methodically rather than for video content, you can include the `classList.toggle` and deprecation warning here in commit 2 — but showing the mistake first and then restoring it more deliberately makes the reasoning clearer.

### 2c. Verify

```bash
npm run lint.ts && npm run lint.sass
```

---

## Commit 3 — `fix(tab-bar): restore tab-bar-hidden emission for proper deprecation period`

**Files changed:**
- `core/src/components/tab-bar/tab-bar.tsx`

**What to do:**

### 3a. The problem with commit 2

Commit 2 stopped emitting `tab-bar-hidden` entirely. That's not a deprecation — it's an immediate breaking change. Any user whose CSS or JS references `.tab-bar-hidden` silently breaks with no warning.

### 3b. Restore class emission — but leaner

Bring `KeyboardController` back to `tab-bar.tsx`, but use it only to maintain backward compatibility. Key differences from the original:

- Use `this.el.classList.toggle('tab-bar-hidden', shouldHide)` **directly** — no `@State`, no re-render
- No `aria-hidden` management (CSS `display: none` handles that)
- Add a `@deprecated` JSDoc comment in the callback explaining the situation

This requires `@Element() el` and the full controller lifecycle, but no `@State()`.

> **Why no test?** This adds keyboard event handling back to the tab bar — the same type of behavior that was in the original code and was never tested. Dispatching synthetic `keyboardWillShow` events in a test doesn't test the real Capacitor/Cordova scenario. Ionic's precedent is to not test this kind of keyboard-driven class behavior.

### 3c. Verify

```bash
npm run lint.ts
```

---

## Commit 4 — `feat(tab-bar): add deprecation warning for tab-bar-hidden class`

**Files changed:**
- `core/src/components/tab-bar/tab-bar.tsx`

**What to do:**

### 4a. Import `printIonWarning`

```ts
import { printIonWarning } from '@utils/logging';
```

### 4b. Add a one-shot warning flag

```ts
private hasWarnedDeprecation = false;
```

### 4c. Fire the warning once

Inside the `KeyboardController` callback, before `classList.toggle`, add:

```ts
if (shouldHide && !this.hasWarnedDeprecation) {
  printIonWarning(
    '[ion-tab-bar] - The `tab-bar-hidden` class is deprecated and will be removed in a future major version of Ionic. ' +
      'Use `ion-app.keyboard-showing` instead to respond to keyboard visibility changes.',
    this.el
  );
  this.hasWarnedDeprecation = true;
}
```

One-shot per instance: the flag prevents the warning from spamming on every keyboard open/close cycle. The element reference is passed as the second argument so the browser console can link to the element in the inspector.

> **Why no test?** `printIonWarning` itself is tested at the utility level in `core/src/utils/logging/test/logging.spec.ts`. No other component in the framework tests whether a specific `printIonWarning` call fires — we follow the same pattern here.

### 4d. Final verification

```bash
npm run lint.ts && npm run lint.sass
```

---

## Summary of commits

| # | Message | Files |
|---|---------|-------|
| 1 | `feat(app): add keyboard-showing class to ion-app when keyboard is open` | `app.tsx` |
| 2 | `feat(tab-bar): move keyboard hiding to CSS :host-context()` | `tab-bar.scss`, `tab-bar.tsx` |
| 3 | `fix(tab-bar): restore tab-bar-hidden emission for proper deprecation period` | `tab-bar.tsx` |
| 4 | `feat(tab-bar): add deprecation warning for tab-bar-hidden class` | `tab-bar.tsx` |

---

## A note on testing

This PR adds no new spec or e2e tests, and that is intentional.

- **Ionic never tested `tab-bar-hidden`** — the previous keyboard-driven class behavior on `ion-tab-bar` had zero test coverage in the original framework.
- **Keyboard events are Capacitor/Cordova-only** — `keyboardWillShow` and `keyboardWillHide` are fired by native runtime bridges. Dispatching synthetic equivalents in Playwright/jsdom tests doesn't represent the real device scenario.
- **`printIonWarning` is tested at the utility level** — `core/src/utils/logging/test/logging.spec.ts` verifies the function itself. No other component in the framework tests whether its specific `printIonWarning` call fires.
- **Manual verification is appropriate here** — use the playground app (see [local-dev-playground.md](./local-dev-playground.md)) with Safari DevTools on a real or simulated device to confirm the behavior.

---

## Further reading

- [Local Dev Playground Guide](./local-dev-playground.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [Stencil Component Lifecycle](https://stenciljs.com/docs/component-lifecycle)
- [Stencil Shadow DOM & Scoped CSS](https://stenciljs.com/docs/styling)
