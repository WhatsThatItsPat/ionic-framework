# Using a Forked Ionic Framework Locally

This guide explains how to use your local fork of `ionic-framework` as the dependency in a separate playground app, so you can test your changes end-to-end without publishing to npm.

The approach is **`npm pack`** — the same mechanism npm uses internally when you `npm install` a published package. It produces a `.tgz` tarball you can point any app at. This is more reliable than `npm link` (which has quirks with peer dependencies, module resolution, and Stencil's shadow DOM registry).

---

## Prerequisites

- Node.js ≥ 16
- Your fork cloned locally: `git clone https://github.com/<you>/ionic-framework.git`
- A separate Ionic playground app (e.g. `ionic start my-playground blank --type=angular`)

---

## Step 1 — Build `@ionic/core`

All framework wrappers (Angular, React, Vue) depend on `@ionic/core`, so you must build it first.

```bash
cd ionic-framework/core
npm install        # only needed once, or after package.json changes
npm run build      # outputs to core/dist/
```

> **Tip:** The build takes a minute or two. During active development you can use
> `npm start` instead, which watches for changes and rebuilds automatically.

---

## Step 2 — Pack the framework wrapper for your app's stack

Pick the section that matches your playground app.

### JavaScript / Web Components only

```bash
cd ionic-framework/core
npm pack --pack-destination ~
# Creates ~/ionic-core-8.x.x.tgz
```

In your playground app:

```bash
npm install file:/~/ionic-core-8.x.x.tgz
```

---

### Angular

The Angular package has a handy `local.sync.and.pack` script that does everything automatically:

```bash
cd ionic-framework/packages/angular
npm run local.sync.and.pack
# Creates ionic-angular-8.x.x.tgz in the current directory
```

What that script does under the hood:
1. Packs `@ionic/core` from `../../core`
2. Updates `package.json` to point at the local `.tgz`
3. Runs `npm install` and `npm run build`
4. Packs the final `@ionic/angular` dist

In your playground app:

```bash
rm -rf .angular/   # clear Angular's compilation cache
npm install file:/path/to/ionic-framework/packages/angular/ionic-core-8.x.x.tgz
npm install file:/path/to/ionic-framework/packages/angular/ionic-angular-8.x.x.tgz
```

Or do it manually step-by-step:

```bash
# Build core
cd ionic-framework/core
npm install && npm run build
npm pack --pack-destination ~   # ~/ionic-core-8.x.x.tgz

# Build angular
cd ../packages/angular
npm install
npm run sync      # copies generated proxies from core build into angular/src
npm run build
cd dist/
npm pack --pack-destination ~   # ~/ionic-angular-8.x.x.tgz

# Install in playground app
cd ~/my-playground
rm -rf .angular/
npm install file:/~/ionic-core-8.x.x.tgz
npm install file:/~/ionic-angular-8.x.x.tgz
```

---

### React

```bash
# Build core
cd ionic-framework/core
npm install && npm run build
npm pack --pack-destination ~   # ~/ionic-core-8.x.x.tgz

# Build react
cd ../packages/react
npm install
npm run sync
npm run build
npm pack --pack-destination ~   # ~/ionic-react-8.x.x.tgz

# Build react-router (if needed)
cd ../react-router
npm install
npm run sync
npm run build
npm pack --pack-destination ~   # ~/ionic-react-router-8.x.x.tgz

# Install in playground app
cd ~/my-playground
npm install file:/~/ionic-core-8.x.x.tgz
npm install file:/~/ionic-react-8.x.x.tgz
npm install file:/~/ionic-react-router-8.x.x.tgz
```

Or use the script:

```bash
cd ionic-framework/packages/react
npm run local.sync.and.pack
```

---

### Vue

```bash
# Build core
cd ionic-framework/core
npm install && npm run build
npm pack --pack-destination ~   # ~/ionic-core-8.x.x.tgz

# Build vue
cd ../packages/vue
npm install
npm run sync
npm run build
npm pack --pack-destination ~   # ~/ionic-vue-8.x.x.tgz

# Build vue-router (if needed)
cd ../vue-router
npm install
npm run sync
npm run build
npm pack --pack-destination ~   # ~/ionic-vue-router-8.x.x.tgz

# Install in playground app
cd ~/my-playground
npm install file:/~/ionic-core-8.x.x.tgz
npm install file:/~/ionic-vue-8.x.x.tgz
npm install file:/~/ionic-vue-router-8.x.x.tgz
```

Or use the script:

```bash
cd ionic-framework/packages/vue
npm run local.sync.and.pack
```

---

## Step 3 — Verify the playground app uses your local build

```bash
# In your playground app directory:
node -e "const p = require('@ionic/core/package.json'); console.log(p.version, p._resolved)"
```

The `_resolved` field will show `file:...` — confirming npm is using your local tarball rather than a registry version.

---

## Step 4 — Iterate

After making further changes to `ionic-framework`:

1. Rebuild core (and the framework wrapper if you changed anything there):
   ```bash
   cd ionic-framework/core && npm run build && npm pack --pack-destination ~
   ```
2. Reinstall in your playground app:
   ```bash
   cd ~/my-playground && npm install file:/~/ionic-core-8.x.x.tgz
   ```
   The filename stays the same between builds (it uses the version number from `package.json`), so you can re-run the same `npm install` command.

---

## Why not `npm link`?

`npm link` creates a symlink, which causes several problems with this kind of monorepo:

- **Peer dependency resolution** breaks because the linked package resolves peers from its own `node_modules`, not the consumer app's.
- **Stencil's custom element registry** can throw "element already defined" errors because the same Stencil runtime ends up loaded twice from different paths.
- **Angular's compiler cache** (`dist/` vs symlink path) can cause stale build artifacts.

`npm pack` + `npm install file:...` avoids all of this by behaving exactly like a real published package.

---

## Further reading

- [Ionic Contributing Guide — Previewing in an external app](./CONTRIBUTING.md#preview-changes)
- [Stencil docs](https://stenciljs.com/docs/introduction/)
