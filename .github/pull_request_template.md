<!--
Adding or updating a module? Keep the checklist and fill in the sections above it.
Changing the scripts, the workflow or the docs? Delete everything below the first line and just say
what you changed.

Commits are Conventional Commits: `feat(index): add tetravox.seeg 1.0.0`.
-->

## The module

| | |
|---|---|
| **id** | `vendor.name` |
| **version** | `1.0.0` (`hostApi` N) |
| **repository** | https://github.com/… |
| **licence** | SPDX id, e.g. MIT |
| **new module / new release** | |

## What it does

One paragraph. What a user gets, and on what kind of data.

## Permissions, and why

One line per thing the manifest asks for. Copy the sentences the consent sheet shows.

| Permission | Why the module needs it |
|---|---|
| Read `.tsv`, `.csv` files you choose | … |
| Write `{name}.{stamp}.bak` beside the file you save | … |
| Bind the keys … while it is active | … |
| Run from a job file: … | … |
| Store its own data inside a saved scene | … |

## Proof it works

* Tested against Tetravox release: `vX.Y.Z`
* Module repository CI run: <link to the green run on the tagged commit>
* Release: <link to the tagged release whose assets this entry names>

---

## Checklist

Every box is explained in [CONTRIBUTING.md](../CONTRIBUTING.md).

**Licence**
- [ ] OSI-approved `LICENSE` in the module repository
- [ ] `licence` is that licence's SPDX identifier
- [ ] Bundled third-party code is compatible and credited

**Host range**
- [ ] `hostApi` is the `MODULE_HOST_VERSION` the module was built against
- [ ] The module's `manifest.json` declares the same `hostApi`
- [ ] Installed and enabled in a released Tetravox that implements it (named above)

**Screenshots**
- [ ] At least one, of the module doing its job, added to `screenshots/` in this PR
- [ ] Listed in the entry's `screenshots`, and free of identifiable patient data

**Permissions**
- [ ] The table above accounts for everything the manifest asks for
- [ ] The module asks for nothing it does not use
- [ ] `permissions` in the entry, if present, matches what the manifest implies

**Release assets**
- [ ] A tagged release whose `tag` contains `version`
- [ ] `index.js` and `manifest.json` uploaded under their own sha256 as the asset name
- [ ] `bytes`, `sha256` and `url` in the entry match the uploaded files
- [ ] `curl -fsSL <url> | shasum -a 256` returns the hash in the entry

**CI**
- [ ] The module repository's CI is green on the tagged commit (linked above)
- [ ] `node scripts/validate-index.mjs` passes locally
- [ ] `node scripts/validate-index.mjs --check-urls` passes
- [ ] `node --test scripts/validate-index.test.mjs` passes

**Shape**
- [ ] `modules` is still sorted by `id`; `versions` is still sorted oldest first
- [ ] A new release is one appended object and nothing else
