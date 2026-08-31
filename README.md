# tetravox-extensions

The curated extensions index behind **File ▸ Extensions…** in
[Tetravox](https://github.com/idossha/tetravox).

A Tetravox *module* is a panel, a set of keyboard commands, a file reader/writer pair and an
optional scene block, shipped from its own repository as a pair of release assets — `index.js` and
`manifest.json`. This repository holds one file that matters, [`index.json`](index.json): the list
of the modules the app offers, each version pinned to the sha256 of the exact bytes the app will
download.

Nothing here is code that runs. It is a list, reviewed by pull request, and that review is the
trust gate.

## What reads this file

| Consumer | What it does with it |
|---|---|
| **The Tetravox app** (`packages/app/src/main/module-store.ts`) | Draws one card per entry in File ▸ Extensions…, downloads `files[].url` into `~/.tetravox/modules/<id>/<version>/<name>`, verifies each file against `bytes` and `sha256` before writing it, and re-hashes every file **again** at enable before it is reachable through the `tetravox://module` protocol. |
| **The app's shipped copy** (`packages/app/src/shared/extensions-index.json`) | A Tetravox release refreshes that file from this one, so the dialog is correct and complete with no network at all. The live index is the fresher of the two, never the only one. |
| **The website** (`idossha.github.io/tetravox`) | The Extensions page is generated from this index: one section per module, its summary, licence, repository, screenshots from [`screenshots/`](screenshots), and a per-version file table with the sha256s. |

Because the app verifies every download against this file, a wrong hash here is a module that
**cannot be installed** — never a module that installs wrongly. That is the whole point of the
layout, and it is why the validator below is strict about things a JSON Schema could not express.

## The trust statement

This is a **curated** index. A module appears in it because a human read the pull request that
added it, opened the source repository, and checked the boxes in
[CONTRIBUTING.md](CONTRIBUTING.md). That is the only screening there is: nothing here is audited,
sandboxed, or signed by Anthropic, by Tetravox, or by anyone else.

**An enabled module is trusted renderer code.** It runs inside the Tetravox window with the same
access to the document and the same preload bridge as first-party code. Tetravox does not sandbox
it. What the app *does* guarantee is narrower and worth stating exactly:

* **Installing is not enabling.** A downloaded module sits inert on disk until you consent to it.
  Until then it is not on the `tetravox://module` map and the renderer cannot reach it at all.
* **Consent is per module, and it is shown before it is granted.** The sheet lists the permissions
  derived from the *installed* manifest — which file types it can read, what it can write beside a
  file you name, which keys it binds, which job operations it exposes, whether it stores data in
  your scenes.
* **The bytes are the bytes in this file.** Every download is verified against its sha256 at
  install and re-verified at enable. A tampered file is refused, not run.
* **Withdrawal is the app's, not the module's.** Disabling or removing a module drops it from the
  protocol map and revokes its write admissions in the main process — it is never a message the
  module has to cooperate with.

If you do not trust a module's authors, do not enable it. Listing here is not an endorsement of
what a module does with the access you grant it.

## The shape of an entry

```json
{
  "schema": 1,
  "generated": "2026-09-05T00:00:00Z",
  "modules": [
    {
      "id": "tetravox.seeg",
      "title": "sEEG contacts",
      "summary": "One line, shown on the card and on the website.",
      "description": "A paragraph. Optional.",
      "repo": "https://github.com/idossha/tetravox-seeg",
      "author": "idossha",
      "licence": "MIT",
      "docs": "https://github.com/idossha/tetravox-seeg#readme",
      "screenshots": ["seeg-panel.png"],
      "versions": [
        {
          "version": "1.0.0",
          "hostApi": 1,
          "tag": "v1.0.0",
          "published": "2026-09-05",
          "permissions": ["Read .tsv, .csv, .fcsv files you choose"],
          "files": [
            {
              "name": "index.js",
              "bytes": 81234,
              "sha256": "<64 hex>",
              "url": "https://github.com/idossha/tetravox-seeg/releases/download/v1.0.0/<64 hex>"
            },
            {
              "name": "manifest.json",
              "bytes": 3412,
              "sha256": "<64 hex>",
              "url": "https://github.com/idossha/tetravox-seeg/releases/download/v1.0.0/<64 hex>"
            }
          ]
        }
      ]
    }
  ]
}
```

### Field by field

**Top level** — `schema` (always `1`), optional `generated` (ISO 8601 UTC), `modules` (sorted by
`id`). `$comment` is allowed and ignored.

**Entry** — required `id`, `title`, `summary`, `repo`, `licence`, `versions`; optional
`description`, `author`, `docs`, `screenshots`.

| Field | Rule |
|---|---|
| `id` | `<vendor>.<name>`, lower case, `^[a-z0-9-]+\.[a-z0-9-]+$`. Unique across the index; the whole index is sorted by it. The same id as the module's `manifest.json`. |
| `title` | One line, ≤ 60 characters. What the card is called. |
| `summary` | One line, ≤ 200 characters. The sentence under the title. |
| `description` | Optional paragraph. |
| `repo` | `https://github.com/<owner>/<name>`, no trailing slash. Every `files[].url` must live under it. |
| `author` | Optional single line. |
| `licence` | Required, non-empty — an SPDX identifier such as `MIT` or `Apache-2.0`. |
| `docs` | Optional `https://…`. An installed module documents itself at a URL the card links to; only modules compiled into Tetravox get a heading in `USER_GUIDE.md`. |
| `screenshots` | Optional file names in [`screenshots/`](screenshots) — `.png`, `.jpg`, `.jpeg` or `.webp`, one path segment each, and the files must be in the same pull request. |
| `versions` | Non-empty, **sorted oldest first**, one object per published release, versions unique. |

**Version** — required `version`, `hostApi`, `files`; optional `tag`, `published`, `permissions`.

| Field | Rule |
|---|---|
| `version` | Semver `MAJOR.MINOR.PATCH` with an optional `-prerelease` tail. |
| `hostApi` | Positive integer: the `MODULE_HOST_VERSION` the module was built against. The app only offers versions whose `hostApi` equals its own, and refuses to activate any other — so this number is what makes a module compatible or greyed out. |
| `tag` | Optional git tag; must contain `version`. When present, every `url` must be exactly `<repo>/releases/download/<tag>/<sha256>`. |
| `published` | Optional `YYYY-MM-DD`. |
| `permissions` | Optional array of the sentences the consent sheet shows, copied so a card can be drawn without downloading anything. Redundant on purpose — the sheet always derives its list from the installed manifest, and a disagreement is a review finding. |

**File** — exactly `name`, `bytes`, `sha256`, `url`.

| Field | Rule |
|---|---|
| `name` | The name on disk: one path segment, no separators, no `..`. `index.js` and `manifest.json` are both required. Any other file must be `.js` or `.css` — nothing else is ever served. `tetravox-module.json` is reserved for the app's install receipt. |
| `bytes` | Positive integer, at most 33 554 432 (32 MiB), the app's per-file cap. |
| `sha256` | 64 lower-case hex characters. No two files of one version may share one. |
| `url` | `<repo>/releases/download/<tag>/<sha256>` — **the asset is named by its own sha256**, the layout [`idossha/tetravox-sample-data`](https://github.com/idossha/tetravox-sample-data) already uses. An asset's content is its name, so re-uploading can only ever be a no-op or a mistake, and a URL cannot point outside the repository the entry claims. |

## Validating

No dependencies and no install step. With any Node 20+:

```sh
node scripts/validate-index.mjs              # the shape rules, offline
node scripts/validate-index.mjs --check-urls # …and HEAD every release asset
node --test scripts/validate-index.test.mjs  # the validator's own fixtures, driven red
```

Every problem is reported at once rather than stopping at the first, so an entry with three
mistakes costs one round trip. `.github/workflows/validate.yml` runs all three on every pull
request.

## Submitting a module

Open a pull request that adds one entry — or, for a new release of a listed module, one object
appended to its `versions`. The full checklist is in [CONTRIBUTING.md](CONTRIBUTING.md); in short:

1. **Licence.** An OSI-approved licence file in the module repository, and its SPDX id in `licence`.
2. **Host range.** `hostApi` is the `MODULE_HOST_VERSION` you built against, and you have run the
   module in a Tetravox release that implements it.
3. **Screenshots.** At least one, of the module actually doing its job, in `screenshots/` in the
   same pull request.
4. **Permissions justified.** The pull request says, in words, why the module needs each thing its
   manifest asks for.
5. **Release assets under sha256 names.** `index.js` and `manifest.json` uploaded to a tagged
   release, each named by its own sha256, and the `bytes`/`sha256`/`url` in the entry matching.
6. **CI green in the module repository**, with a link to the run.

Then `node scripts/validate-index.mjs` before you push, so CI tells you nothing you could have
found in two seconds.

## Layout

```
index.json                          the index
scripts/validate-index.mjs          the validator, and the schema it enforces, documented in its header
scripts/validate-index.test.mjs     every rule with a fixture that breaks it
screenshots/                        the images entries name
.github/workflows/validate.yml      what runs on every pull request
CONTRIBUTING.md                     the submission checklist, as actionable items
```

## Licence

The index and the scripts in this repository are [MIT](LICENSE). Each listed module carries its own
licence, named in its entry and in its own repository; nothing in this repository relicenses
anything it points at.
