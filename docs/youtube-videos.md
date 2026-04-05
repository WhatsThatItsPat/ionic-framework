# YouTube Video Series — Contributing to Ionic Framework

A proposed series walking through the real process of authoring a Feature Request for the Ionic Framework, discovering the root cause through hands-on DOM inspection, implementing the fix, and submitting a PR — with a focus on Angular, Shadow DOM, accessibility, and open source best practices.

---

## Episode 1 — The Problem: Building the Example App

**Duration:** ~20 min  
**Commit covered:** playground app only (no framework changes yet)

### What to cover

- **Introduce yourself and the series.** You authored this Feature Request — this isn't a contrived tutorial example, it's a real problem you encountered at your day job. You needed to hide a custom element when the keyboard opened, and the existing API wasn't accessible from where you needed it.

- **Create the playground app.** Use the Ionic CLI to scaffold a tabbed Angular app:
  ```bash
  ionic start keyboard-demo tabs --type=angular
  ```
  Add a single text input to one of the tabs so the software keyboard opens on focus.

- **Show the problem on a real device or simulator.** When the text input receives focus, the tab bar disappears — but there's no way to know when that happens from anywhere else in the app without bringing in `@capacitor/keyboard`. Show that if you add a custom footer or FAB button inside the tab content, it doesn't know to hide itself.

- **Implement the workaround from the Feature Request.** Add the `@capacitor/keyboard` listener + `signal()` approach from the FR:
  ```typescript
  isKeyboardShowing = signal(false);
  constructor() {
    Keyboard.addListener('keyboardWillShow', () => this.isKeyboardShowing.set(true));
    Keyboard.addListener('keyboardWillHide', () => setTimeout(() => this.isKeyboardShowing.set(false), 50));
  }
  ```
  Show why this is imperfect: it requires a separate Capacitor plugin, and the `setTimeout(50)` is a timing hack you had to discover by trial and error.

  > **Angular tip:** This is a great moment to explain **Angular Signals** (`signal()`, `computed()`) as the modern reactive state primitive — introduced in Angular 16+. Compare it to `BehaviorSubject` for those coming from RxJS. This is exactly the kind of thing a GDE would explain clearly.

- **Transition to the itch.** This works, but it's fragile. Why should app developers have to replicate timing logic that Ionic already implements internally?

### Tips & lessons

- **Do your due diligence before filing an issue.** Try to solve the problem with the existing API first. Understanding *why* the existing approach is limited makes for a much stronger Feature Request.
- **Don't spam a repo with issues.** The FR is stronger because you showed both the problem and the current workaround.
- **Angular Signals vs RxJS:** Even if the video isn't primarily about Angular, this is a natural place to introduce Signals as the modern alternative. Show how `isKeyboardShowing = signal(false)` is cleaner than a `BehaviorSubject`.

---

## Episode 2 — Safari DevTools: Reading the DOM to Find the Solution

**Duration:** ~25 min  
**Commit covered:** still pre-coding

### What to cover

- **Enable Safari Web Inspector.** Show how to enable it on a Mac + iOS Simulator:
  1. In Safari → Settings → Advanced → "Show features for web developers"
  2. In the iOS Simulator, open the page in Safari
  3. Safari → Develop → [Simulator] → connect

- **Inspect the DOM while the keyboard opens.** Show the element tree live. Identify:
  - `ion-app` → `ion-router-outlet` → `app-tabs` → `ion-tabs` → `ion-tab-bar`
  - Watch `ion-tab-bar` gain the class `tab-bar-hidden` when the keyboard opens
  - Note how deeply nested it is — this is exactly why it's not useful from the outside

- **Understand `ion-tabs` shadow DOM structure.** In the inspector, expand `ion-tabs`'s shadow root. You'll see the insertion points inside the shadow tree:
  ```
  #shadow-root (open)
    <slot name="top"></slot>
    <div class="tabs-inner">
      <slot></slot>
    </div>
    <slot name="bottom"></slot>  ← the insertion point
  ```
  But in the light DOM (outside the shadow root), the actual element is:
  ```html
  <ion-tab-bar slot="bottom" role="tablist" class="md hydrated">
  ```
  The `slot="bottom"` attribute on `ion-tab-bar` is what tells the browser to project it into `<slot name="bottom">`. The tab bar element itself lives in the light DOM — that's what gains the `tab-bar-hidden` class. This distinction matters for CSS: `ion-tab-bar`'s classes live in the light DOM, so in principle they're accessible from anywhere, but the CSS rule that *uses* them (`:host(.tab-bar-hidden)`) lives inside the shadow DOM stylesheet.

  > **Sidebar: The hack at your day job.** You once needed to create a custom element that sat between the content and the tab bar. You added a sibling to `.tabs-inner` *inside* `ion-tabs`'s shadow DOM and discovered you could target `.tab-bar-hidden` from there. Why did it work?
  >
  > It worked because you were **inside the same shadow root**. Within a shadow root, CSS works normally across its own DOM elements and across slotted elements' host classes. The `ion-tab-bar` element's classes (including `tab-bar-hidden`) are visible to CSS selectors written inside `ion-tabs`'s shadow root. If you'd been outside the shadow root writing a global CSS selector, it wouldn't work — shadow DOM encapsulation prevents that.
  >
  > This distinction matters: it wasn't that they were siblings per se; it was that you were inside the same shadow root as the slot that held `ion-tab-bar`.

- **Ask the question the video is really about.** If `tab-bar-hidden` is buried in shadow DOM and only useful from inside `ion-tabs`'s shadow root, where *should* keyboard state live so that any component in the app can use it? The answer: `ion-app`.

- **Look at `ion-app` in the inspector.** It's the outermost component. It's not shadow DOM (note the lack of `#shadow-root`). Classes applied to it are accessible from anywhere: global CSS, Angular component styles with `:host-context()`, `document.querySelector`.

- **Now transition to the code.** We know what we're looking for — let's find it.

### Tips & lessons

- **Start from the DOM, not the code.** The DOM inspector showed us `tab-bar-hidden` appearing on keyboard open. That gave us the vocabulary to search the codebase.
- **Shadow DOM boundaries matter for CSS.** Understand which boundary you're on before deciding whether a CSS approach will work.
- **`ion-app` is not shadow DOM.** This is a key observation — classes on `ion-app` are globally accessible, making it the ideal place to expose app-wide state.

---

## Episode 3 — Navigating the Ionic Codebase

**Duration:** ~20 min  
**Commit covered:** still pre-coding; exploration

### What to cover

- **Clone and set up the fork.** Show the fork button on GitHub, then:
  ```bash
  git clone https://github.com/<you>/ionic-framework.git
  cd ionic-framework
  git checkout -b feat/keyboard-showing-on-ion-app
  cd core && npm install
  ```

- **Follow the DOM observation back to source.** We saw `tab-bar-hidden` appear in the DOM. Use grep to find it:
  ```bash
  grep -rn "tab-bar-hidden" core/src/ --include="*.tsx" --include="*.scss"
  ```
  This leads to `tab-bar.tsx` (where it's emitted) and `tab-bar.scss` (where it's styled).

- **Read `tab-bar.tsx` end-to-end.** Trace the full chain:
  1. `keyboardWillShow` event → `KeyboardController` callback
  2. `@State() keyboardVisible = true` → triggers re-render
  3. `render()` computes `shouldHide` → sets `tab-bar-hidden` class and `aria-hidden`
  4. CSS rule applies `display: none !important`

- **Read `keyboard-controller.ts`.** Understand: event listeners, the `waitForResize` promise (why it exists — flicker prevention), the `init`/`destroy` lifecycle, and the async race condition guard.

- **Find `ion-app` in the code.** Open `app.tsx`. Note it already has `connectedCallback`/`disconnectedCallback` for other utilities. This is our destination — we'll add the keyboard controller here.

- **Find patterns to follow.** Search for other uses of `:host-context()` in the codebase. Show `label.scss`, `searchbar.scss`. Then find the **reason it's NOT used for RTL in `toggle.scss`** — the comment explaining Safari's limitation. This teaches when it's safe and when it's not.

### Tips & lessons

- **Search before you read.** Start from what you observed in the DOM, not from the top of the codebase.
- **The data flow chain.** For this feature, the chain is: `window event → controller → @State → re-render → class → CSS`. Understanding this lets you see exactly what to move.
- **Existing utilities.** `createKeyboardController` exists and already handles all the hard parts. Never reinvent.

---

## Episode 4 — Implementing: Adding `keyboard-showing` to `ion-app`

**Duration:** ~25 min  
**Commit covered:** `feat(app): add keyboard-showing class to ion-app when keyboard is open`

### What to cover

- **Start with the smallest testable piece.** Add `keyboard-showing` to `ion-app` first, independently of any changes to `ion-tab-bar`.

- **Walk through `app.tsx` changes step by step:**
  - Import `State` from `@stencil/core` — explain: `@State` triggers a re-render when it changes
  - Import `KeyboardController` type and `createKeyboardController`
  - Add `keyboardCtrl` + `keyboardCtrlPromise` private fields — explain the async race pattern
  - Write `connectedCallback`: create the controller, await resize before updating state
  - Extend `disconnectedCallback`: destroy the controller to prevent memory leaks
  - Add `'keyboard-showing': this.keyboardVisible` to the `Host` class map

- **Run the linter:**
  ```bash
  npm run lint.ts
  ```

- **Test it in the playground app.** Use `npm pack` + `npm install file:...` (see the [Local Dev Playground guide](./local-dev-playground.md)) to load your local Ionic build in the playground app. Open Safari DevTools and verify `keyboard-showing` appears on `ion-app` when the keyboard opens.

  > **Why no spec test for `ion-app` keyboard behavior?** Ionic never tested `tab-bar-hidden` — the original keyboard-driven class behavior on `ion-tab-bar`. Dispatching synthetic `keyboardWillShow` events in spec or e2e tests doesn't test the real scenario (Capacitor/Cordova keyboard on an actual device). We follow Ionic's own precedent here: verify manually in the playground app.

  > **Angular tip:** In your Angular playground app, you can now use this class in two ways:
  > 1. **Global CSS** (in `global.scss`): `ion-app.keyboard-showing ion-footer { display: none; }`
  > 2. **Component-scoped with `ViewEncapsulation.None`** or `:host-context()` in component SCSS:
  >    ```scss
  >    :host-context(ion-app.keyboard-showing) .my-footer { display: none; }
  >    ```
  > Show how Angular's component styles are encapsulated by default (emulated shadow DOM) and what `:host-context()` means in that context vs in real shadow DOM.

### Tips & lessons

- **`@State` vs direct DOM mutation.** `@State` is clean and declarative — Stencil optimizes re-renders. We'll see in a later episode when `classList.toggle` is the right call instead.
- **Async lifecycle in Stencil.** `connectedCallback` can be async, but you must handle the disconnect race condition.
- **Things to avoid:** Skipping `waitForResize` — this causes visible flicker as content reflows before the keyboard animation completes.

---

## Episode 5 — CSS Architecture: Shadow DOM, `:host-context()`, and Why It Doesn't Work

**Duration:** ~20 min  
**Commit covered:** `refactor(tab-bar): replace KeyboardController with MutationObserver on ion-app`

### What to cover

- **The insight.** Now that `ion-app` exposes keyboard state as a class, `ion-tab-bar`'s own `KeyboardController` is redundant. The tab bar can react to `ion-app`'s state instead.

- **First attempt: `:host-context()`.** Explain what `:host-context()` is — a shadow DOM CSS pseudo-function that lets a shadow component react to an ancestor's state:
  ```scss
  :host-context(ion-app.keyboard-showing):not([slot="top"]) {
    display: none !important;
  }
  ```
  Show that Ionic already uses `:host-context()` in `label.scss`, `searchbar.scss`, `buttons.scss`.

- **Try it on a real device — and discover it doesn't work on iOS.** This is a key teaching moment. `:host-context()` is **not supported on Safari/WebKit**:
  - https://caniuse.com/?search=host-context
  - https://github.com/w3c/csswg-drafts/issues/1914 (CSSWG issue open since 2017, no resolution)
  
  The Ionic codebase already knows this — show the RTL mixin in `ionic.mixins.scss` which generates **three separate fallback selectors** specifically because `:host-context()` is unreliable. The irony: keyboard events primarily fire in Capacitor/Cordova contexts, and iOS (WKWebView/Safari) is the primary target. The CSS-only approach fails exactly where it matters most.

- **The working approach: `MutationObserver` + `@State` + `:host(.tab-bar-hidden)`.** Instead of pure CSS, tab-bar uses a `MutationObserver` to watch `ion-app` for the `keyboard-showing` class and manages its own `tab-bar-hidden` host class via `@State` + `render()`. The CSS rule `:host(.tab-bar-hidden) { display: none !important; }` does the hiding — this works cross-browser because it's a plain host class, not ancestor context.

- **Why does `display: none` handle accessibility?** An element with `display: none` is removed from the browser's accessibility tree automatically — no explicit `aria-hidden="true"` is needed. (We'll explain why the original code had it anyway in the next episode.)

- **Walk through the SCSS change.** Show the combined selector, explain every part.

- **Simplify `tab-bar.tsx`.** Remove `@State`, the `KeyboardController`, `aria-hidden`, and `tab-bar-hidden` from `render()`. Show the before/after. The component becomes much simpler.

- **`classList.toggle` vs `@State` + `render()`.** Explain why we use `@State() keyboardHidden` and include `'tab-bar-hidden': this.keyboardHidden` in the `render()` class map instead of calling `this.el.classList.toggle(...)` directly. `@State` is idiomatic Stencil: it tells the framework "this value drives rendered output." Using `classList.toggle` outside `render()` bypasses the VDOM — a re-render triggered by another cause (prop change) could overwrite `tab-bar-hidden`. With `@State`, the class survives re-renders.

- **How useful is this feature if `:host-context()` doesn't work?** Very useful — the `keyboard-showing` class on `ion-app` is the primary deliverable. Users can use it in global CSS, Angular component styles, or any non-shadow-DOM context. The tab-bar's internal use of `:host(.tab-bar-hidden)` + `MutationObserver` is an implementation detail. The feature request was about exposing keyboard state globally — and that works everywhere.

### Tips & lessons

- **Test on real devices early.** `:host-context()` looked perfect in theory and passed linting. Only testing on an iOS simulator revealed the Safari limitation.
- **CSS can replace JS — but not always across shadow DOM.** `:host-context()` is the right idea but lacks browser support. `:host(.class)` + JS is the pragmatic alternative.
- **Fewer moving parts = fewer bugs.** One `KeyboardController` in `ion-app` vs two (one per component) eliminates timing and lifecycle risks.
- **Is this less performant than the original approach?** No — comparable today. The original: one `KeyboardController` in `ion-tab-bar` → `@State` change → full Stencil re-render. Our approach: one `KeyboardController` in `ion-app` → `@State` change → trivial re-render of `ion-app`; a `MutationObserver` in `ion-tab-bar` → `@State` change → re-render of `tab-bar`. Two re-renders instead of one, but both are minimal (just class map updates).
- **What about the CSS spec roadmap?** The CSSWG issue for `:host-context()` has been open since 2017 with no resolution. The closest alternatives on the horizon are container style queries (`@container style(--keyboard-showing: true)`) and the Open Stylable proposal, but neither is ready yet. For now, the JS bridge (MutationObserver) is the right approach.

---

## Episode 6 — Why `aria-hidden` Was There: Accessibility Deep Dive

**Duration:** ~15 min  
**Covers code removed in Episode 5**

### What to cover

- **The `ion-tab` parallel.** Find `tab.tsx` in the codebase — it uses **both** `aria-hidden={!active}` AND the `tab-hidden` class that sets `display: none !important`. This is the same belt-and-suspenders approach `ion-tab-bar` used.

- **Why does `display: none` not always suffice?**
  - CSS `display: none` is supposed to remove elements from the accessibility tree per the ARIA spec
  - But **CSS containment** (the `contain: strict` on `ion-tab-bar`) creates an isolated layout/paint context. While containment doesn't affect the AT tree per spec, there are historical browser AT inconsistencies when `display: none` is applied inside a shadow root with strict containment
  - **The shadow DOM boundary adds complexity.** Screen readers compose their accessibility tree from the "flat tree" (shadow DOM flattened), but older AT implementations had edge cases
  - `aria-hidden` is a semantic hint that AT can act on **without computing layout** — it's faster and more explicit

- **Why we removed it in this PR.** Our `display: none` is applied via `:host-context()`, which is inside the shadow root and directly on the host element — not on a child. The host element being `display: none` is as unambiguous as it gets. The belt-and-suspenders is still good practice in general, but for this specific case the CSS handles it.

### Tips & lessons

- **Understand why code exists before removing it.** "This seems redundant" is not a safe reason to delete accessibility code. Research first.
- **`display: none` vs `aria-hidden` vs `visibility: hidden`:** Each behaves differently for AT. `display: none` and `aria-hidden` remove from the tree entirely; `visibility: hidden` hides visually but may still be reachable. Know the difference.
- **CSS containment and AT.** `contain: strict` does not affect the accessibility tree, but has historically caused inconsistencies in some browsers. The spec says one thing; implementations vary.

---

## Episode 7 — API Deprecation, `@State` Design, and When NOT to Warn

**Duration:** ~20 min  
**No separate commit** — this is a discussion episode reflecting on decisions already made in Commit 2

### What to cover

- **Is `tab-bar-hidden` a public API?** It was never documented as a public API, but that doesn't matter. If people are using it — and they are (as you know from your own day job) — removing it without warning is a breaking change.

  > **Tip for the video:** Search for `tab-bar-hidden` on the official [Ionic docs site](https://ionicframework.com/docs). You'll find zero results. That confirms this was always an internal/undocumented API. But that doesn't make it safe to remove quietly — undocumented APIs get discovered through DOM inspection (exactly the way you found it), and once someone builds a production feature on top of one, it becomes effectively public. The lesson: be conservative about removals regardless of whether something is "public."

- **Why `@State` is the right choice in `tab-bar`.**
  `@State` exists to tell Stencil "this value drives my rendered output — when it changes, re-run `render()`." Since `tab-bar-hidden` is set in `render()` via the `Host` class map, `@State() keyboardHidden` is the idiomatic approach.

  An alternative would be `this.el.classList.toggle('tab-bar-hidden', ...)` outside `render()` — but this bypasses Stencil's VDOM. A re-render triggered by another cause (e.g., `color` prop change) would rebuild the Host's class list from the VDOM, silently dropping `tab-bar-hidden`. With `@State`, the class survives re-renders because Stencil manages it.

  This is an important Stencil (and more broadly, reactive UI) principle: **if a value drives rendered output, put it in `@State`.** If it drives only a side effect (not the template), it doesn't belong in `@State`.

- **Should we add a console deprecation warning?** This is a good question to raise with the audience. Ionic uses `printIonWarning` in some places (e.g. `picker-legacy`) to warn on deprecated usage. But there's a key difference: those warnings fire when a user *explicitly uses a deprecated component*. Here, we can't detect whether a user's CSS or JS actually relies on `.tab-bar-hidden` — the warning would fire for **every single user** with a tab bar in a Capacitor/Cordova app the first time the keyboard opens. That would be an unexpected warning in thousands of apps where the user didn't do anything "wrong." The right channel for this deprecation is the **release notes**, not the console.

- **The full picture.** Draw the architecture:
  - `ion-app.keyboard-showing` — new, public, CSS-accessible state (set via `KeyboardController` in `app.tsx`)
  - `tab-bar.tsx` `MutationObserver` — watches `ion-app` for `keyboard-showing`, sets `@State() keyboardHidden`
  - `render()` — includes `'tab-bar-hidden': this.keyboardHidden` in Host class map
  - `:host(.tab-bar-hidden)` CSS — hiding + AT removal (cross-browser, unlike `:host-context()`)
  - Deprecation announced in release notes — no surprise console warnings

### Tips & lessons

- **Deprecation ≠ removal.** These are two separate things. Removal happens in a future major version.
- **Not all deprecations warrant a console warning.** A warning is appropriate when you can detect *specific deprecated usage*. It's not appropriate when the warning fires unconditionally for all users. Know the difference.
- **`@State` when it drives render, `classList.toggle` when it doesn't.** This is a core Stencil principle that generalizes to any component framework.
- **Document the full migration path in release notes.** "X is deprecated, use Y instead" — self-contained.

---

## Episode 8 — Testing Philosophy: Why This PR Has No Tests

**Duration:** ~15 min  
**No new code**

### What to cover

- **The honest answer: Ionic never tested `tab-bar-hidden`.**
  Before this PR, `ion-tab-bar` had a `KeyboardController` that set `tab-bar-hidden` when the keyboard opened. Zero spec tests. Zero e2e tests. Search the repo — you won't find any. This PR moves keyboard handling to `ion-app`, adds a new CSS rule, and has `tab-bar` watch `ion-app`'s class via `MutationObserver` for backward compat. Following Ionic's own precedent, we add no tests.

- **Why did we go through the exercise?** Walk through the tests that were written and then deleted during the development of this PR — and why they were ultimately removed:
  1. `app.spec.ts` — 2 spec tests (add/remove `keyboard-showing`). Removed because: spec tests can't test CSS, and jsdom can't render `:host-context()`. Testing a class add/remove with synthetic events in jsdom tests the wiring, not the outcome.
  2. `app/test/keyboard/app.e2e.ts` — 2 e2e tests (add/remove `keyboard-showing` on `<ion-app>`). Removed because: this tests a mechanism, not a user-visible outcome.
  3. `tab-bar/test/keyboard/tab-bar.e2e.ts` — 4 e2e tests (CSS hide, re-show, slot="top", tab-bar-hidden backward compat). Removed because: even these, which test the actual CSS in a real browser, are testing behavior that Ionic never tested for `tab-bar-hidden`. Dispatching synthetic `keyboardWillShow` in Playwright doesn't represent a real Capacitor/Cordova keyboard.

- **What WOULD be worth testing?** Have an honest discussion about where the line is:
  - A screenshot e2e test showing the tab bar hidden when `keyboard-showing` is present — this is the Ionic way to verify visual behavior. But it requires a full build and baseline images.
  - An axe-core accessibility e2e test (like `tab-button.e2e.ts`) verifying that a hidden tab bar has no accessibility violations. Worth raising in the PR review.
  - Neither of these is the keyboard-event-dispatching pattern we wrote and deleted.

- **The broader lesson: match the codebase's standards.** When contributing to an open-source project, look at what they test and how. Don't introduce a test pattern that doesn't exist elsewhere — it creates inconsistency and often signals over-testing. A PR reviewer at Ionic would likely ask you to remove synthetic keyboard event tests because nothing else in the codebase does that.

- **Verify manually instead.** This is the right call for this feature. Use Safari DevTools on a real or simulated iOS device, open the playground app, tap a text input, and watch `keyboard-showing` appear on `<ion-app>` in the DOM inspector.

### Tips & lessons

- **Check what the project already tests before adding new tests.** `grep -rn "keyboardWillShow" core/src --include="*.spec.ts" --include="*.e2e.ts"` — before this PR, zero results.
- **Synthetic events ≠ real events.** `window.dispatchEvent(new Event('keyboardWillShow'))` in a test is not the same as a Capacitor plugin firing that event on a real device.
- **`printIonWarning` is tested once, at the utility level.** Components calling it don't test it again — that would be testing the framework, not the component.
- **When in doubt, ask during code review.** "Should I add tests for this?" is a legitimate PR comment. Don't assume more tests = better.

---

## Episode 9 — The PR Process and Open Source Norms

**Duration:** ~15 min  
**No new code**

### What to cover

- **Fork vs branch.** You're working on a fork (`WhatsThatItsPat/ionic-framework`), not upstream. Show the GitHub relationship between your fork and `ionic-team/ionic-framework`.

- **Commit message conventions.** The Ionic repo follows Conventional Commits: `type(scope): description`. Walk through the four commit messages, explain each part:
  - Types: `feat`, `fix`
  - Scopes: `app`, `tab-bar`

- **Opening the PR.** Walk through the PR template. Fill in: description, related issues, testing done.

- **Review feedback.** Walk through the actual back-and-forth in this PR:
  - The naming decision (`keyboard-is-open` → `keyboard-showing`)
  - The `:host-context()` browser support discussion
  - The deprecation period question
  - The `aria-hidden` removal rationale

- **How to test your PR in the playground app.** `npm pack` + `npm install file:...` (link to `local-dev-playground.md`).

  > **Angular tip:** If this PR were accepted by `ionic-team`, the `@ionic/angular` package would automatically pick up `keyboard-showing` without any changes — it's a pure CSS class on `ion-app`. Angular components can already use it via global CSS or `:host-context()`. If you wanted to add an Angular-specific helper (e.g., a `keyboardShowing` signal from an `InjectionToken`), that would be a follow-up PR to `packages/angular`.

- **The longer path.** Point out that this PR only touches `@ionic/core`. The feature is immediately usable from Angular, React, and Vue — they all depend on core and inherit the class.

### Tips & lessons

- **Small, focused commits make reviews easier.**
- **Name things after what they do.** `keyboard-showing` describes user-visible state, not the implementation mechanism.
- **Keep scope focused.** This PR doesn't add Angular/React/Vue wrappers because the feature is pure CSS — it doesn't need them.
- **Open source norms.** Search for related issues, cross-reference them, fill out templates thoroughly.

---

## Episode 10 — Angular Patterns Across the Series (Bonus / Recap)

**Duration:** ~20 min  
**No new code — synthesis**

### What to cover

This is a synthesis episode pulling out all the Angular threads from the series and placing them in context for developers working toward Angular expertise.

- **Ionic Angular vs Ionic Core.** Explain the relationship: `@ionic/core` is Stencil web components. `@ionic/angular` is a thin wrapper that generates Angular proxy components (directives wrapping the web components) and adds Angular-specific integrations like `ModalController`, `PopoverController`, `IonRouterOutlet`.

- **`IonTabs` in Angular is different.** Show `packages/angular/src/directives/navigation/ion-tabs.ts`. The Angular version is a true **Angular Component** (`@Component`) with:
  - `ng-content` instead of web component slots
  - `ViewChild`, `ContentChild`, `ContentChildren` for child queries
  - `IonRouterOutlet` — a custom Angular directive that extends Angular's router outlet
  - The same CSS styles inlined in `styles: [...]` (matching the Stencil component)

- **Angular standalone components.** Point to the workaround code in the FR — it already uses `standalone: true` with `imports: [IonApp, IonRouterOutlet]`. Show what this looks like in a modern Angular app vs `NgModule`.

- **Signals.** The FR workaround used `signal(false)` from `@angular/core`. Expand:
  - `signal()` — writable signal
  - `computed()` — derived signal
  - `effect()` — side effects (like subscribing)
  - How `keyboard-showing` (a CSS class) means you often don't need a signal at all for UI visibility — CSS handles it directly. Signals shine for data flow, not visual state that CSS can express.

- **Keyboard state in Angular — three approaches (from old to new).** This is a great teaching progression showing how Angular idioms have evolved:

  **Approach 1 — Class binding + `@HostListener` (older style):**
  ```typescript
  @Component({ selector: 'app-tabs', template: `...` })
  export class TabsComponent {
    isKeyboardShowing = false;

    @HostListener('window:keyboardWillShow')
    onKeyboardShow() { this.isKeyboardShowing = true; }

    @HostListener('window:keyboardWillHide')
    onKeyboardHide() { this.isKeyboardShowing = false; }
  }
  ```
  And in the template: `[class.keyboard-showing]="isKeyboardShowing"`.
  Explain: `@HostListener` attaches an event listener to the window or host element. This is the Angular "wrapper pattern" around native events. Note that this operates at the component level — you'd have to duplicate it everywhere you need keyboard state.

  > This is also a chance to discuss where this lives. If you put it in a tab component, it only affects that component. The Feature Request was asking for this to live on `ion-app`, which is exactly what our PR does — making it global. You could move it from `ion-app` up to `document.body` or even `html` (the root element), but `ion-app` is where Ionic puts other app-wide classes (like the mode class `md` or `ios`), so it's the natural home.

  **Approach 2 — Signal + `@Capacitor/Keyboard` (from the Feature Request, modern style):**
  ```typescript
  @Component({ standalone: true, selector: 'app-tabs', template: `...` })
  export class TabsComponent {
    isKeyboardShowing = signal(false);

    constructor() {
      Keyboard.addListener('keyboardWillShow', () => this.isKeyboardShowing.set(true));
      Keyboard.addListener('keyboardWillHide', () => setTimeout(() => this.isKeyboardShowing.set(false), 50));
    }
  }
  ```
  Show how `signal()` from `@angular/core` (Angular 16+) replaces the mutable boolean and integrates with the new change detection system. The `setTimeout` timing hack is the smell that motivates the PR.

  **Approach 3 — Pure CSS with `keyboard-showing` (after our PR):**
  No JavaScript needed for UI hiding. In `global.scss` or component CSS:
  ```scss
  ion-app.keyboard-showing .my-custom-footer {
    display: none;
  }
  // Or in a component with :host-context():
  :host-context(ion-app.keyboard-showing) .my-custom-footer {
    display: none;
  }
  ```
  For data-driven use cases (updating non-CSS state when keyboard opens), you can still use Signals — but bound to the DOM class, not a separate event listener:
  ```typescript
  @Component({ standalone: true })
  export class TabsComponent {
    isKeyboardShowing = signal(false);

    private ionAppMutation = new MutationObserver(() => {
      this.isKeyboardShowing.set(
        document.querySelector('ion-app')?.classList.contains('keyboard-showing') ?? false
      );
    });

    constructor() {
      const ionApp = document.querySelector('ion-app');
      if (ionApp) {
        this.ionAppMutation.observe(ionApp, { attributes: true, attributeFilter: ['class'] });
      }
    }
    ngOnDestroy() { this.ionAppMutation.disconnect(); }
  }
  ```
  Or more idiomatically, using `@capacitor/keyboard` listeners but reading the class state from `ion-app` (no timing hack needed since `keyboard-showing` has the right timing built in).

  > **Discussion for the video:** Ask whether moving the state from `ion-app` up to the document root element (`html`) would make any practical difference. The answer: probably not — `ion-app` is already at the top of the Ionic component tree. Ionic puts the mode class (`md`/`ios`), `ion-palette-*` classes, and now `keyboard-showing` on `ion-app`. That's the established convention.

- **The `async` pipe (legacy approach worth knowing).** Before Signals, keyboard state in Angular was often expressed as an Observable:
  ```typescript
  // keyboard.service.ts
  keyboardShowing$ = new BehaviorSubject(false);
  ```
  And in a template:
  ```html
  <footer [class.hidden]="keyboardShowing$ | async">...</footer>
  ```
  The `async` pipe subscribes and unsubscribes automatically. It's still valid, but Signals are the modern replacement. Show the comparison side-by-side: `signal()` vs `BehaviorSubject` vs reading from the DOM class.

- **Angular's `ChangeDetectionStrategy.OnPush`.** In a tabbed app, the tab components that aren't active shouldn't recheck on every cycle. Show how `OnPush` + Signals is the modern pattern.

- **Zone.js vs Zoneless.** Ionic components use native web events. When you call `Keyboard.addListener`, the callback fires outside Angular's zone (unless you use `NgZone.run(...)`). Show how Signals-based state management avoids this zone problem entirely — a signal update triggers change detection regardless of zone.

- **`:host-context()` in Angular component styles.** Ionic uses real shadow DOM for web components; Angular uses emulated shadow DOM (attribute selectors) by default. `:host-context()` works the same way in both contexts for Angular component styles.

  > Example: In your Angular tab component:
  > ```scss
  > // Hides your custom footer when the keyboard is showing
  > :host-context(ion-app.keyboard-showing) .my-custom-footer {
  >   display: none;
  > }
  > ```

- **Path to GDE.** Recap the Angular concepts covered across the series:
  - Standalone components and `NgModule`
  - Signals, `computed()`, `effect()`
  - `ChangeDetectionStrategy.OnPush`
  - Zone.js and zoneless change detection
  - `ViewChild`, `ContentChild`, custom Angular directives
  - `InjectionToken` and dependency injection
  - Angular component styles: `ViewEncapsulation`, `:host`, `:host-context()`
  - Angular router integration (`IonRouterOutlet`)
  - Open source contribution process

### Tips & lessons

- **The Angular wrapper is a thin proxy.** Most of the real behavior is in `@ionic/core`. Understanding the web components layer makes you a better Ionic+Angular developer.
- **Use CSS for visual state when possible.** `keyboard-showing` is a perfect example — a CSS class eliminates the need for a signal, a subscription, or zone management for hiding UI.
- **Signals are the future of Angular state.** The `setTimeout` workaround in the FR is a smell. Modern Angular + Signals + `keyboard-showing` eliminates it entirely.

---

## Full series at a glance

| # | Title | Key Concept | Angular Angle |
|---|-------|-------------|---------------|
| 1 | The Problem: Building the Example App | FR due diligence, workaround first | Signals, standalone components |
| 2 | Safari DevTools: Reading the DOM | DOM inspection, shadow root / slot structure | — |
| 3 | Navigating the Ionic Codebase | Grep-first, trace the data flow | — |
| 4 | Implementing: `keyboard-showing` on `ion-app` | `@State`, playground verification | `:host-context()` in Angular, `ViewEncapsulation` |
| 5 | CSS Architecture: Why `:host-context()` Doesn't Work | Shadow DOM, Safari limitations, MutationObserver bridge | — |
| 6 | Why `aria-hidden` Was There | CSS containment, AT tree, shadow DOM edge cases | — |
| 7 | API Deprecation, `@State` Design, When NOT to Warn | `@State` vs `classList.toggle`, when to warn, internal APIs | — |
| 8 | Testing Philosophy: Why This PR Has No Tests | Match the codebase's standards; synthetic ≠ real; manual verification | — |
| 9 | The PR Process | Conventional commits, fork, review | Angular wrapper layer, follow-up PRs |
| 10 | Angular Patterns Across the Series (Bonus) | Synthesis | `@HostListener`, Signals, `async` pipe, Zone.js, GDE path |

