# Contributing

Two kinds of pull request land here:

* **A new module** — one object appended to `modules`, keeping the array sorted by `id`.
* **A new release of a listed module** — one object appended to that entry's `versions`, oldest
  first. Nothing else in the entry changes unless the module itself changed (a new licence, a moved
  repository, a better summary).

Anything else — a change to `scripts/`, to the workflow, to this file — is an ordinary pull request
and needs no checklist.

Commits are [Conventional Commits](https://www.conventionalcommits.org/):
`feat(index): add tetravox.seeg 1.0.0`, `chore(index): tetravox.seeg 1.1.0`.

---

## Before you open the pull request

Work through this list; the pull request template repeats it as checkboxes, and a reviewer will ask
about any box you leave unticked.

### 1. Licence

- [ ] The module repository has a `LICENSE` file with an OSI-approved licence.
- [ ] `licence` in the entry is that licence's SPDX identifier (`MIT`, `Apache-2.0`, `BSD-3-Clause`,
      `GPL-3.0-only`, …) — not "open source", not a URL, not empty.
- [ ] Any third-party code bundled into `index.js` is compatible with that licence and credited in
      the module's README.

An unlicensed module is not redistributable, and a redistribution index is exactly what this is.

### 2. Host range

- [ ] `hostApi` is the `MODULE_HOST_VERSION` your build targets (an integer, currently `1`).
- [ ] You have installed and enabled the module in a released Tetravox that implements that
      `hostApi`, and the pull request says which release.
- [ ] The module's `manifest.json` declares the same `hostApi` as the entry.

Tetravox refuses to activate a module built against another host API. An entry with the wrong
number publishes a card that can be downloaded and never enabled.

### 3. Screenshots

- [ ] At least one screenshot, showing the module doing the thing its summary claims — its panel
      open, on real data, in the app.
- [ ] The files are added to `screenshots/` **in this pull request**, named `<vendor>-<what>.png`
      (for example `seeg-panel.png`), and listed in the entry's `screenshots`.
- [ ] `.png`, `.jpg`, `.jpeg` or `.webp`; no personal or identifiable patient data in the image.

The website's Extensions page is generated from these, and a card with no picture is a card nobody
clicks.

### 4. Permissions justified

- [ ] The pull request body lists what the module's manifest asks for — file types read, files
      written beside the one the user names, keys bound, job operations exposed, whether it stores a
      block in saved scenes — and **one sentence each** on why it needs that.
- [ ] `permissions` in the entry, if you fill it in, matches what the manifest implies. It is only a
      preview for the card and the website; the consent sheet always derives its list from the
      installed manifest, so a disagreement is a review finding.
- [ ] The module asks for nothing it does not use. A reader for an extension the module never opens
      is a permission the user grants for nothing.

An enabled module is trusted renderer code — see the trust statement in [README.md](README.md). The
review of this list is the only thing standing between a user and that trust.

### 5. Release assets under sha256 names

- [ ] The module is published as a **tagged release** in its own repository, and `tag` contains
      `version`.
- [ ] The release carries `index.js` and `manifest.json` (plus any `.css`), each uploaded under
      **its own sha256 as the asset name** — the same layout
      [`idossha/tetravox-sample-data`](https://github.com/idossha/tetravox-sample-data) uses:

      ```sh
      for f in dist/index.js dist/manifest.json; do
        sha=$(shasum -a 256 "$f" | cut -d' ' -f1)
        cp "$f" "/tmp/$sha"
        gh release upload "$TAG" "/tmp/$sha"    # never --clobber: an asset's content is its name
      done
      ```

- [ ] Every `files[]` entry's `name`, `bytes`, `sha256` and `url` matches the file you uploaded,
      with `url` = `<repo>/releases/download/<tag>/<sha256>`.
- [ ] `curl -fsSL <url> | shasum -a 256` returns the hash in the entry. If it does not, the app will
      refuse the install — check it here rather than in a bug report.

### 6. CI green in the module repository

- [ ] The module repository's CI passed on the tagged commit: typecheck against the pinned Tetravox
      module SDK, its unit tests, its `manifest.json` validation, and the bundle check that
      `index.js` carries no imports.
- [ ] The pull request links that run.

### 7. This repository's own checks

- [ ] `node scripts/validate-index.mjs` passes locally.
- [ ] `node scripts/validate-index.mjs --check-urls` passes — i.e. the release is public and every
      asset is reachable.
- [ ] `node --test scripts/validate-index.test.mjs` passes (it will, unless you changed the
      validator; if you added a rule, add the fixture that breaks it).

---

## What a reviewer does

1. Runs the checks above and reads the diff — a submission should be one object, and a release
   should be one object appended.
2. Opens the module repository: licence, README, the source of `index.js`, the linked CI run.
3. Downloads each asset and re-hashes it against the entry.
4. Installs the module in a release build, reads the consent sheet, and checks that what it lists
   matches what the pull request said the module needs.
5. Merges, or asks for exactly one thing at a time.

A module is listed because a human did that. Nothing here is audited, sandboxed or signed.

## Removing a module

Open an issue, or a pull request that deletes the entry. A module is removed when its repository
disappears, its licence becomes unclear, it stops working against every supported `hostApi`, or its
author asks. Removing an entry does not uninstall anything already on a user's machine — the app's
**Remove** button does that.

## Reporting a problem with a listed module

Bugs go to the module's own repository. Open an issue **here** only when the problem is with the
listing: a wrong hash, a dead URL, a licence that does not match, a permission the module asks for
and the entry does not mention, or anything that looks malicious. Security concerns about a module
that is already listed: mail the address in
[Tetravox's SECURITY.md](https://github.com/idossha/tetravox/blob/main/SECURITY.md) rather than
opening a public issue.
