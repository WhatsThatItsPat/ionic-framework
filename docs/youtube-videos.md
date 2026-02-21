# YouTube Video Series — Contributing to Ionic Framework

A proposed series of videos walking through the process of discovering, implementing, and submitting a real feature request to the Ionic Framework open source project. Each video builds on the last.

---

## Episode 1 — Reading the Issue & Making a Game Plan

**Duration:** ~15 min  
**Commit covered:** none (pure planning)

### What to cover

- **Find the issue.** Visit [ionic-team/ionic-framework#29887](https://github.com/ionic-team/ionic-framework/issues/29887). Read the full description aloud and pause to explain what the user is asking for.
- **Understand the problem space.** Explain what `.tab-bar-hidden` is today and why it's limited (lives inside shadow DOM, nested deep in the component tree, inaccessible to other components like `ion-fab` or custom footers).
- **Look at the alternative the user is already doing.** Walk through the `@capacitor/keyboard` + `setTimeout` workaround in the issue. Point out the friction: requiring a separate Capacitor plugin, manual timing, and the risk of timing mismatches.
- **Formulate the goal.** We want `ion-app` to expose a public CSS class (`keyboard-showing`) so anyone in the app can write `ion-app.keyboard-showing { ... }` without Capacitor or timers.
- **Sketch the solution.** Draw on a whiteboard or annotate the GitHub page:
  1. `ion-app` needs to listen to the same keyboard events `ion-tab-bar` already listens to
  2. `ion-tab-bar` can then delegate its hiding logic to CSS via `:host-context()`
  3. `.tab-bar-hidden` gets deprecated, not removed — we explain why (user impact, deprecation period)
- **Identify the files to change** before touching any code. Use GitHub's file browser or local `find` to locate: `app.tsx`, `tab-bar.tsx`, `tab-bar.scss`, test directories.

### Tips & lessons

- **Read the whole issue** including comments before writing a line of code. Feature requests often have constraints or edge cases buried in the thread.
- **Look at what already exists.** The `KeyboardController` utility in `core/src/utils/keyboard/` already solves the hard part. Don't reinvent it.
- **Formulate a plan with commit-sized chunks** before you start coding. A clear plan prevents mid-implementation pivots that pollute your git history.
- **Things to avoid:** Jumping straight into code without understanding the existing behavior. You'll likely over-engineer or miss edge cases.

---

## Episode 2 — Navigating a Large Codebase You Don't Own

**Duration:** ~20 min  
**Commit covered:** still pre-coding; exploration

### What to cover

- **How to find things fast.** Use `grep`/ripgrep to trace the existing keyboard behavior:
  ```bash
  grep -rn "keyboardWillShow\|keyboardWillHide" core/src/ --include="*.ts" --include="*.tsx"
  ```
  Show how this leads you from `keyboard-controller.ts` → `tab-bar.tsx` → `app.tsx`.
- **Read `keyboard-controller.ts` end-to-end.** Understand: event listeners, the `waitForResize` promise (why it exists — flicker prevention), the `init`/`destroy` lifecycle, the race condition guard.
- **Read `tab-bar.tsx` end-to-end.** Note the `@State() keyboardVisible`, the re-render cycle, `aria-hidden`, the slot check (`slot !== 'top'`).
- **Find patterns to follow.** Look at other components that use `KeyboardController` (just `tab-bar`). Then look at how `ion-app` already has a `connectedCallback`/`disconnectedCallback` for other utilities (modal, focus-visible).
- **Find the CSS patterns.** Search for existing uses of `:host-context()` in the codebase. Understand when Ionic uses it (label, searchbar, buttons) and why — then understand why it's not used for RTL on toggle (the Safari caveat comment).
- **Understand shadow DOM.** Briefly explain why `.tab-bar-hidden` in a shadow root is invisible to the outside world — and why a class on `ion-app` (which is not shadow) is universally accessible.

### Tips & lessons

- **Search before you read.** Don't read every file — use targeted searches to triangulate the relevant code in minutes.
- **Follow the data flow.** The event → controller → `@State` → re-render → CSS chain is the pattern to understand, and you want to shorten it.
- **Look for existing utilities.** Ionic already has `createKeyboardController`, `printIonWarning`, `createColorClasses`. Always check if the tool you need exists.
- **Understand the constraints before designing the solution.** `:host-context()` browser support becomes relevant only when you know the feature is Capacitor-only.

---

## Episode 3 — Implementing the Feature (`ion-app` + Unit Tests)

**Duration:** ~25 min  
**Commit covered:** `feat(app): add keyboard-showing class to ion-app when keyboard is open`

### What to cover

- **Start with the simplest piece.** We add `keyboard-showing` to `ion-app` first, before touching `ion-tab-bar`. This is independently testable.
- **Walk through the implementation in `app.tsx`** step by step:
  - Import `State` from Stencil (explain what `@State` does — triggers a re-render)
  - Import the controller types
  - Add private fields (explain the pattern: `keyboardCtrl` + `keyboardCtrlPromise` to handle the async race)
  - Write `connectedCallback` (explain: it's async because `createKeyboardController` is async; explain `waitForResize`)
  - Extend `disconnectedCallback` (explain why cleanup is essential to prevent memory leaks in long-lived apps)
  - Add `keyboard-showing` to the `Host` class map
- **Write the unit tests.** Introduce `newSpecPage` from Stencil's testing library. Show:
  - How to mount a component in a test
  - How to dispatch custom window events to simulate keyboard behavior
  - How to `await page.waitForChanges()` to let Stencil process state updates
- **Run the tests.** `./node_modules/.bin/stencil test --spec --testPathPattern="app.spec"` — show the green output.
- **Run the linter.** Briefly show `npm run lint.ts` catching any issues.

### Tips & lessons

- **Write the test first** (or immediately after) — it forces you to think about observable behavior, not implementation details.
- **`@State` vs direct DOM mutation.** Explain the tradeoff: `@State` triggers a re-render (clean, declarative) but has overhead. We'll see in a later video when direct `classList.toggle` is the right call.
- **Async lifecycle in Stencil.** `connectedCallback` can be async, but you need to handle the race condition where the component disconnects before the promise resolves.
- **Things to avoid:** Skipping `waitForResize` when hiding — this causes a visible flicker as content reflows before the keyboard animation finishes.

---

## Episode 4 — CSS Architecture: `:host-context()` and Shadow DOM

**Duration:** ~20 min  
**Commit covered:** `feat(tab-bar): move keyboard hiding to CSS :host-context()`

### What to cover

- **What is shadow DOM and why does it matter here?** Briefly explain encapsulation: styles outside the shadow root can't reach inside, and `:host-context()` is the escape hatch that lets a shadow component react to an ancestor's class.
- **Why `:host-context()` is safe in this specific context.** Keyboard events only fire in Capacitor/Cordova — meaning WKWebView (iOS) or Chromium (Android). Both fully support `:host-context()` in shadow DOM. Desktop Firefox/Safari caveats don't apply.
- **Why `display: none` handles accessibility automatically.** An element with `display: none` is removed from the accessibility tree — no explicit `aria-hidden="true"` is needed. This simplifies the implementation significantly.
- **Walk through the SCSS change:**
  - The combined selector `:host(.tab-bar-hidden), :host-context(ion-app.keyboard-showing):not([slot="top"])`
  - Why we keep `:host(.tab-bar-hidden)` as a fallback (deprecation period — covered next episode)
  - Why `:not([slot="top"])` — top-slotted tab bars should not hide
- **Simplify `tab-bar.tsx`.** Remove `@State`, `@Element`, the controller, `aria-hidden`, and `tab-bar-hidden` from render. Show the before/after line count.

### Tips & lessons

- **CSS can replace JS when the signal is in the DOM.** Once `ion-app` exposes the keyboard state as a class, the tab bar doesn't need its own event listeners at all.
- **Fewer moving parts = fewer bugs.** Removing the `KeyboardController` from `tab-bar` eliminates a class of timing bugs and memory leak risks.
- **Understand browser-specific constraints.** The `:host-context()` toggle comment in `toggle.scss` is a great example of documenting why you're NOT using a pattern somewhere — emulate that discipline.
- **Things to avoid:** Using `:host-context()` for styling that must work in general web (PWA, browser) contexts where Firefox users might be affected.

---

## Episode 5 — Deprecating APIs the Right Way

**Duration:** ~20 min  
**Commits covered:**
- `fix(tab-bar): restore tab-bar-hidden emission for proper deprecation period`
- `feat(tab-bar): add deprecation warning for tab-bar-hidden class`

### What to cover

- **What is a deprecation?** A deprecation gives users a release cycle to migrate. Removing a feature without deprecating is a breaking change — even if the feature was "internal."
- **The mistake we corrected.** We initially removed `.tab-bar-hidden` in the same commit we replaced it — giving users zero migration time. Walk through why that's wrong.
- **The fix: keep the class alive, but emit it differently.**
  - `classList.toggle` vs `@State`: Why we don't want a re-render here. The class is a backward-compat shim, not part of the component's visual logic anymore.
  - Explain that `@Element` is needed to access `this.el` for `classList.toggle`.
- **The deprecation warning pattern.** Find `picker-legacy/picker.tsx` in the repo — it's the template. Show `printIonWarning(...)` with the element reference.
- **One-shot warnings.** Explain `hasWarnedDeprecation` flag. Console.warn on every keyboard open would be unbearable for developers. Once per component instance is the right balance.
- **Write the warning test.** Introduce `jest.spyOn(console, 'warn')`. Show how to verify the warning fires exactly once across multiple keyboard open/close cycles.
- **The full picture.** Draw the state diagram:
  - `ion-app.keyboard-showing` class (new, public API) → handled by `ion-app` KeyboardController
  - `:host-context(ion-app.keyboard-showing)` CSS → handles hiding visually and in a11y tree
  - `tab-bar-hidden` class (deprecated) → still emitted via `classList.toggle` for backward compat
  - Console warning → fires once on first keyboard open, directs user to migrate

### Tips & lessons

- **Deprecations should span at least one major version.** Add a TODO comment or file a tracking issue for when to remove the deprecated API.
- **Search the repo for the pattern before implementing.** `grep -rn "printIonWarning" core/src/components/` showed us the exact pattern to follow.
- **Document both why it still exists AND what to use instead.** A good deprecation message is self-contained: "X is deprecated, use Y instead."
- **Things to avoid:** Removing deprecated APIs in the same PR that introduces the replacement. Give users a release cycle.

---

## Episode 6 — Testing Patterns in Ionic (Spec vs E2E)

**Duration:** ~20 min  
**Covers testing across all commits**

### What to cover

- **Two test types in this repo:**
  - **Spec tests** (`*.spec.ts`) — fast, JS-only, use Stencil's `newSpecPage`. Good for unit behavior, event handling, class manipulation.
  - **E2E tests** (`*.e2e.ts`) — run in a real browser via Playwright. Good for visual regression, CSS rendering (including `:host-context()`), real keyboard events.
- **Walk through `app.spec.ts`.** Show the full anatomy of a Stencil spec test.
- **Walk through `tab-bar.spec.ts`.** Show how to test deprecated behavior — and why the test comments say "delete me in the next major version."
- **When to write which kind.** For this PR:
  - Spec: keyboard class toggling, deprecation warning (no browser needed)
  - E2E would be needed for: verifying `:host-context()` applies in a real WebView, visual regression of the hidden state
- **Running tests efficiently.** Show `--testPathPattern` to run only the relevant tests during development.
- **The spec test gotcha.** The `slot="top"` test failed in jsdom because `getAttribute('slot')` doesn't work the same way in the test environment. Show why this is a test-env limitation and how to handle it (skip to e2e, or document the limitation).

### Tips & lessons

- **Start with spec tests** — they're 10x faster than e2e and catch most regressions.
- **Know your test environment.** jsdom (used by Stencil spec) doesn't render CSS. If you're testing a CSS behavior (like `:host-context()`), that needs an e2e test.
- **`jest.spyOn` with `mockRestore()`.** Always restore mocks in tests that spy on `console`. Failing to do so pollutes other tests in the suite.
- **Test the behavior, not the implementation.** Test that the class is present/absent, not which internal method was called.

---

## Episode 7 — The PR Process

**Duration:** ~15 min  
**No new code**

### What to cover

- **Fork vs branch.** You're working on a fork (`WhatsThatItsPat/ionic-framework`), not the upstream. Show the relationship on GitHub.
- **Commit message conventions.** The Ionic repo follows Conventional Commits: `type(scope): description`. Walk through the four commit messages in this PR and explain each part.
  - Types used: `feat`, `fix`, `refactor`, `docs`, `chore`
  - Scopes: `app`, `tab-bar`
- **Opening the PR.** Walk through the PR template. Show how to fill in: description, related issues, testing done, screenshots (if UI changed).
- **Review feedback.** Walk through the actual back-and-forth in this PR (naming decisions, the deprecation period question, the `:host-context()` browser support discussion). Show how to address review comments with follow-up commits vs amending.
- **The "squash vs merge vs rebase" decision.** Ionic uses conventional commits, which implies a clean history. In a real PR to `ionic-team`, they'd likely squash. On your fork, the history documents your thinking process.
- **How to test your PR locally** using `npm pack` (points to Episode/README on local dev).

### Tips & lessons

- **Small, focused commits make reviews easier.** Each of the four commits in this PR tells a clear story and is independently reviewable.
- **Name things after what they do, not how they work.** `keyboard-showing` is named for the user-facing state, not `keyboard-controller-active` or `keyboard-open-state`.
- **Open source norms.** Search for existing issues before creating a new one. Cross-reference related issues and PRs. Keep the scope focused — this PR doesn't add Angular/React/Vue wrappers for `keyboard-showing` because the feature is pure CSS.
- **Things to avoid:** One giant commit that changes everything at once. It's harder to review, harder to revert a single piece if something goes wrong, and harder to understand 6 months later.

---

## Full series at a glance

| # | Title | Key Concept |
|---|-------|-------------|
| 1 | Reading the Issue & Making a Game Plan | Planning before coding |
| 2 | Navigating a Large Codebase You Don't Own | Searching, tracing, pattern-finding |
| 3 | Implementing the Feature + Unit Tests | `ion-app`, `@State`, `newSpecPage` |
| 4 | CSS Architecture: `:host-context()` and Shadow DOM | CSS-over-JS, shadow encapsulation |
| 5 | Deprecating APIs the Right Way | `printIonWarning`, `classList.toggle`, migration paths |
| 6 | Testing Patterns (Spec vs E2E) | jsdom limits, Playwright, `jest.spyOn` |
| 7 | The PR Process | Commit conventions, review, open source norms |
