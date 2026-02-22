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
- `core/src/components/app/test/app.spec.ts`

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

### 1c. Write the unit tests

Create `core/src/components/app/test/app.spec.ts` with two tests:

- `should add keyboard-showing class to ion-app when keyboard opens`
- `should remove keyboard-showing class from ion-app when keyboard closes`

Each test uses `newSpecPage`, dispatches `keyboardWillShow` / `keyboardWillHide` on `window`, then asserts the class.

### 1d. Verify

```bash
cd core
./node_modules/.bin/stencil test --spec --testPathPattern="app.spec"
npm run lint.ts
```

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
./node_modules/.bin/stencil test --spec --testPathPattern="tab-bar|app.spec"
```

---

## Commit 3 — `fix(tab-bar): restore tab-bar-hidden emission for proper deprecation period`

**Files changed:**
- `core/src/components/tab-bar/tab-bar.tsx`
- `core/src/components/tab-bar/test/tab-bar.spec.ts`

**What to do:**

### 3a. The problem with commit 2

Commit 2 stopped emitting `tab-bar-hidden` entirely. That's not a deprecation — it's an immediate breaking change. Any user whose CSS or JS references `.tab-bar-hidden` silently breaks with no warning.

### 3b. Restore class emission — but leaner

Bring `KeyboardController` back to `tab-bar.tsx`, but use it only to maintain backward compatibility. Key differences from the original:

- Use `this.el.classList.toggle('tab-bar-hidden', shouldHide)` **directly** — no `@State`, no re-render
- No `aria-hidden` management (CSS `display: none` handles that)
- Add a `@deprecated` JSDoc comment in the callback explaining the situation

This requires `@Element() el` and the full controller lifecycle, but no `@State()`.

### 3c. Write backward-compat tests

Create `core/src/components/tab-bar/test/tab-bar.spec.ts` with tests marked `@deprecated`:

- `should add tab-bar-hidden class when keyboard opens`
- `should remove tab-bar-hidden class when keyboard closes`

### 3d. Verify

```bash
./node_modules/.bin/stencil test --spec --testPathPattern="tab-bar.spec"
```

---

## Commit 4 — `feat(tab-bar): add deprecation warning for tab-bar-hidden class`

**Files changed:**
- `core/src/components/tab-bar/tab-bar.tsx`
- `core/src/components/tab-bar/test/tab-bar.spec.ts`

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

### 4d. Update the test

Add a third test to `tab-bar.spec.ts`:

- `should warn about tab-bar-hidden deprecation when keyboard first opens`
  - Spy on `console.warn` with `jest.spyOn`
  - Verify it's called exactly once on the first keyboard open
  - Verify it's NOT called again on the second keyboard open

### 4e. Final verification

```bash
./node_modules/.bin/stencil test --spec --testPathPattern="tab-bar.spec|app.spec"
npm run lint.ts && npm run lint.sass
```

---

## Commit 5 — `test(app,tab-bar): add e2e tests for keyboard-showing and CSS hiding`

**Files changed:**
- `core/src/components/app/test/keyboard/app.e2e.ts`
- `core/src/components/tab-bar/test/keyboard/tab-bar.e2e.ts`

**What to do:**

### 5a. Why e2e (not more spec tests)

The two behaviors we're adding e2e tests for can't be validated in jsdom (the spec test environment):
- Whether the `keyboard-showing` class actually appears on the rendered `ion-app` element in a real browser
- Whether the `:host-context()` CSS rule makes `ion-tab-bar` `display: none` — jsdom doesn't render CSS, so spec tests can't verify this
- Whether the `slot="top"` exception works — jsdom has known quirks with the `slot` attribute

### 5b. Create `app/test/keyboard/app.e2e.ts`

```ts
configs({ modes: ['ios'], directions: ['ltr'] }).forEach(({ title, config }) => {
  test.describe(title('app: keyboard'), () => {
    test('should add keyboard-showing class when keyboard opens', async ({ page }) => {
      await page.setContent(`<ion-app></ion-app>`, config);
      const ionApp = page.locator('ion-app');
      await expect(ionApp).not.toHaveClass(/keyboard-showing/);
      await page.evaluate(() => window.dispatchEvent(new Event('keyboardWillShow')));
      await page.waitForChanges();
      await expect(ionApp).toHaveClass(/keyboard-showing/);
    });
    // ... and the remove test
  });
});
```

Key APIs:
- `page.evaluate(fn)` — runs `fn` in the browser context (not Node.js). This is how you dispatch the native-equivalent keyboard events.
- `page.waitForChanges()` — waits for Stencil to process the state change and re-render.
- `expect(locator).toHaveClass(/regex/)` — matches against any class in the class list.

### 5c. Create `tab-bar/test/keyboard/tab-bar.e2e.ts`

Four tests:
1. `should hide via CSS when keyboard opens` — `toBeHidden()` after `keyboardWillShow`
2. `should show again when keyboard closes` — `toBeVisible()` after `keyboardWillHide`
3. `should not hide when slot="top"` — `toBeVisible()` even after `keyboardWillShow` (the test that couldn't be written as a spec test)
4. `@deprecated` — `should still set deprecated tab-bar-hidden class` — `toHaveClass(/tab-bar-hidden/)` (remove in next major version)

Why `toBeHidden()` works for the `:host-context()` test: Playwright checks computed CSS visibility. When the shadow DOM rule applies `display: none` to the `:host` element, the `ion-tab-bar` element's computed `display` is `none` from the light DOM. Playwright can see this — which is exactly what makes this test valuable.

### 5d. Verify the TypeScript compiles

```bash
cd core && npm run lint.ts
```

> **Note on running the e2e tests locally:** E2E tests run against the built `dist/` files (not TypeScript source). You need `npm run build` first, then a Playwright-compatible browser. The CI handles this automatically. For local runs:
> ```bash
> npm run build
> npx playwright test --grep "keyboard" --project=chromium
> ```

---

## Summary of commits

| # | Message | Files |
|---|---------|-------|
| 1 | `feat(app): add keyboard-showing class to ion-app when keyboard is open` | `app.tsx`, `app.spec.ts` |
| 2 | `feat(tab-bar): move keyboard hiding to CSS :host-context()` | `tab-bar.scss`, `tab-bar.tsx` |
| 3 | `fix(tab-bar): restore tab-bar-hidden emission for proper deprecation period` | `tab-bar.tsx`, `tab-bar.spec.ts` |
| 4 | `feat(tab-bar): add deprecation warning for tab-bar-hidden class` | `tab-bar.tsx`, `tab-bar.spec.ts` |
| 5 | `test(app,tab-bar): add e2e tests for keyboard-showing and CSS hiding` | `app/test/keyboard/app.e2e.ts`, `tab-bar/test/keyboard/tab-bar.e2e.ts` |

---

## Known testing gaps

The e2e tests in commit 5 cover the CSS and class behavior. What's still not covered:

1. **Accessibility e2e.** The existing `tab-button.e2e.ts` uses axe-core to verify no accessibility violations. A similar test with a keyboard-hidden `ion-tab-bar` would confirm `display: none` properly removes the element from the AT tree in a real browser. This is worth adding if the PR receives feedback about accessibility coverage.

---

## Further reading

- [Local Dev Playground Guide](./local-dev-playground.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [Stencil Component Lifecycle](https://stenciljs.com/docs/component-lifecycle)
- [Stencil Shadow DOM & Scoped CSS](https://stenciljs.com/docs/styling)
