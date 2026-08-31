/**
 * `index.json` — the curated Tetravox extensions index, validated.
 *
 * ```sh
 * node scripts/validate-index.mjs                # validate ./index.json (what CI runs on every PR)
 * node scripts/validate-index.mjs <path>
 * node scripts/validate-index.mjs --check-urls   # …and HEAD every files[].url
 * ```
 *
 * ## Why a validator and not a JSON Schema
 *
 * The rules that matter here are not shape rules. "The asset is named by its own sha256", "the URL
 * is under the repository the entry claims", "both `index.js` and `manifest.json` are present" are
 * the rules that make an index entry *safe to install*, and none of them is expressible as a type.
 * So this is the same hand-written validator `scripts/check-modules-lock.mjs` is in the Tetravox
 * repository, in the same house style: no dependencies, and **every** problem reported at once
 * rather than stopping at the first, because an entry with three mistakes should cost one review
 * round trip, not three.
 *
 * ## What the app does with this file
 *
 * `packages/app/src/main/module-store.ts` (Tetravox, ARCHITECTURE §13.8) reads `modules[]` into its
 * `ExtensionEntry`/`ExtensionVersion`/`ExtensionFile` types, draws one card per entry in
 * File ▸ Extensions…, downloads `files[].url` into `~/.tetravox/modules/<id>/<version>/<name>` and
 * verifies each download against `bytes` and `sha256` before anything is written, then re-hashes
 * every file **again** at enable before it is put on the `tetravox://module` protocol map. A
 * mistyped hash here is therefore a module that cannot be installed — never a module that installs
 * wrongly — and that is the failure this file exists to catch before a user meets it.
 *
 * ## The schema
 *
 * ```json
 * { "schema": 1,
 *   "generated": "2026-09-05T00:00:00Z",
 *   "modules": [{
 *     "id": "tetravox.seeg",
 *     "title": "sEEG contacts",
 *     "summary": "One line, shown on the card and on the website.",
 *     "description": "A paragraph. Optional.",
 *     "repo": "https://github.com/idossha/tetravox-seeg",
 *     "author": "idossha",
 *     "licence": "MIT",
 *     "docs": "https://github.com/idossha/tetravox-seeg#readme",
 *     "screenshots": ["seeg-panel.png"],
 *     "versions": [{
 *       "version": "1.0.0",
 *       "hostApi": 1,
 *       "tag": "v1.0.0",
 *       "published": "2026-09-05",
 *       "permissions": ["Read .tsv, .csv files you choose"],
 *       "files": [
 *         { "name": "index.js",      "bytes": 81234, "sha256": "…64 hex…",
 *           "url": "https://github.com/idossha/tetravox-seeg/releases/download/v1.0.0/…64 hex…" },
 *         { "name": "manifest.json", "bytes": 3412,  "sha256": "…64 hex…", "url": "…" }
 *       ] }] }] }
 * ```
 *
 * `versions` is sorted **oldest first**, so publishing a release is a one-object append. `modules`
 * is sorted by `id`, so two submissions landing in the same week cannot silently reorder each
 * other's entries.
 *
 * `url` is derived, not free text: `<repo>/releases/download/<tag>/<sha256>`. An asset named by its
 * own content is the SlicerDataStore layout `idossha/tetravox-sample-data` already uses — "an
 * asset's content is its name, so re-uploading can only ever be a no-op or a mistake" — and pinning
 * the URL under the entry's own `repo` is what stops an entry naming one repository and downloading
 * from another.
 *
 * `permissions` is a redundant copy of what the module's manifest implies, carried so the website
 * and the catalogue card can say what a module asks for without downloading it. It is **not** what
 * the user consents to: the consent sheet always derives its list from the *installed* manifest
 * (`derivePermissions`), and a disagreement between the two is a review finding, not a runtime one.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const INDEX = 'index.json';

export const SCHEMA = 1;

/** `<vendor>.<name>` — the dot is what keeps two labs' `contacts` modules apart. */
export const ID_RE = /^[a-z0-9-]+\.[a-z0-9-]+$/;
export const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
export const TAG_RE = /^[A-Za-z0-9._-]+$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const GENERATED_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
/** A file name inside the app: one path segment, no separators, no `..`. */
export const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const SHA256_RE = /^[0-9a-f]{64}$/;
/** The one host an index entry may point at, so `url` is reviewable as a diff. */
export const REPO_RE = /^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
export const SCREENSHOT_RE = /\.(png|jpg|jpeg|webp)$/;

/** Every module release carries these two, and the app needs both to install anything. */
export const REQUIRED_FILES = ['index.js', 'manifest.json'];

/** What main will ever put on the `tetravox://module` map. Anything else would ship dead weight. */
export const SERVABLE_RE = /\.(js|css)$/;

/**
 * The install receipt's name, and the one file name a module may **not** ship.
 *
 * `main/module-store.ts` writes a `tetravox-module.json` beside a module's files and re-hashes the
 * module against it before serving any of it. A release asset of that name would be overwritten at
 * install time — so it is refused here, where the message can say why.
 */
export const RECEIPT_NAME = 'tetravox-module.json';

/** `MAX_MODULE_FILE_BYTES` in `main/module-store.ts`: a module file is code, not a dataset. */
export const MAX_FILE_BYTES = 32 * 1024 * 1024;

const TOP_KEYS = ['$comment', 'schema', 'generated', 'modules'];
const ENTRY_KEYS = [
  'id',
  'title',
  'summary',
  'description',
  'repo',
  'author',
  'licence',
  'docs',
  'screenshots',
  'versions',
];
const ENTRY_REQUIRED = ['id', 'title', 'summary', 'repo', 'licence', 'versions'];
const VERSION_KEYS = ['version', 'hostApi', 'tag', 'published', 'permissions', 'files'];
const VERSION_REQUIRED = ['version', 'hostApi', 'files'];
const FILE_KEYS = ['name', 'bytes', 'sha256', 'url'];

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isLine = (v) => typeof v === 'string' && v.trim() !== '' && !/[\r\n]/.test(v);

/**
 * Validate a parsed index. Returns every problem, never just the first.
 *
 * `screenshotsDir`, when given, is the directory `screenshots[]` names are resolved against; omit
 * it and the names are checked for shape but not for existence, which is what the unit tests want.
 */
export function validateIndex(raw, { screenshotsDir } = {}) {
  const errors = [];
  const bad = (msg) => errors.push(msg);

  if (!isObject(raw)) return { ok: false, errors: [`${INDEX}: the top level must be an object.`] };
  if (raw.schema !== SCHEMA)
    bad(`${INDEX}: "schema" must be ${SCHEMA}, not ${JSON.stringify(raw.schema)}.`);
  if (raw.generated !== undefined && (typeof raw.generated !== 'string' || !GENERATED_RE.test(raw.generated))) {
    bad(`${INDEX}: "generated" must be an ISO 8601 UTC timestamp, not ${JSON.stringify(raw.generated)}.`);
  }
  for (const key of Object.keys(raw)) {
    if (!TOP_KEYS.includes(key)) bad(`${INDEX}: unknown top-level key "${key}".`);
  }
  if (!Array.isArray(raw.modules)) {
    bad(`${INDEX}: "modules" must be an array.`);
    return { ok: false, errors };
  }

  const seen = new Map();
  raw.modules.forEach((entry, i) => {
    const at = `${INDEX}: modules[${i}]`;
    if (!isObject(entry)) {
      bad(`${at} must be an object.`);
      return;
    }
    for (const key of Object.keys(entry)) {
      if (!ENTRY_KEYS.includes(key)) bad(`${at}: unknown key "${key}".`);
    }
    for (const key of ENTRY_REQUIRED) {
      if (!(key in entry)) bad(`${at}: missing "${key}".`);
    }

    if (typeof entry.id !== 'string' || !ID_RE.test(entry.id)) {
      bad(`${at}.id must be <vendor>.<name> in lower case, not ${JSON.stringify(entry.id)}.`);
    } else if (seen.has(entry.id)) {
      bad(
        `${at}.id "${entry.id}" is already listed at modules[${seen.get(entry.id)}] — one entry per module, ` +
          `with every release in its "versions".`
      );
    } else {
      seen.set(entry.id, i);
    }

    if (!isLine(entry.title) || entry.title.length > 60) {
      bad(`${at}.title must be one non-empty line of at most 60 characters, not ${JSON.stringify(entry.title)}.`);
    }
    if (!isLine(entry.summary) || entry.summary.length > 200) {
      bad(
        `${at}.summary must be one non-empty line of at most 200 characters — it is the sentence on the ` +
          `card and on the website, not ${JSON.stringify(entry.summary)}.`
      );
    }
    if (entry.description !== undefined && (typeof entry.description !== 'string' || entry.description.trim() === '')) {
      bad(`${at}.description, when present, must be a non-empty string.`);
    }
    if (typeof entry.repo !== 'string' || !REPO_RE.test(entry.repo)) {
      bad(
        `${at}.repo must be "https://github.com/<owner>/<name>" with no trailing slash, not ` +
          `${JSON.stringify(entry.repo)}. A curated index entry whose source nobody can open is not reviewable.`
      );
    }
    if (entry.author !== undefined && !isLine(entry.author)) {
      bad(`${at}.author, when present, must be one non-empty line.`);
    }
    if (!isLine(entry.licence)) {
      bad(
        `${at}.licence must name the module's licence (an SPDX identifier such as "MIT"), not ` +
          `${JSON.stringify(entry.licence)}. An unlicensed module is not redistributable and is not listed.`
      );
    }
    if (entry.docs !== undefined && (typeof entry.docs !== 'string' || !entry.docs.startsWith('https://'))) {
      bad(
        `${at}.docs, when present, must be an https URL. An installed module documents itself at a URL the ` +
          `card links to; only modules compiled into Tetravox have a USER_GUIDE heading.`
      );
    }

    if (entry.screenshots !== undefined) {
      if (!Array.isArray(entry.screenshots)) {
        bad(`${at}.screenshots, when present, must be an array of file names under screenshots/.`);
      } else {
        const shots = new Set();
        entry.screenshots.forEach((shot, k) => {
          const sat = `${at}.screenshots[${k}]`;
          if (typeof shot !== 'string' || !FILE_RE.test(shot) || !SCREENSHOT_RE.test(shot)) {
            bad(
              `${sat} must be a .png/.jpg/.jpeg/.webp file name under screenshots/ — one path segment, no ` +
                `separators — not ${JSON.stringify(shot)}.`
            );
            return;
          }
          if (shots.has(shot)) bad(`${sat} "${shot}" is listed twice.`);
          shots.add(shot);
          if (screenshotsDir !== undefined && !existsSync(join(screenshotsDir, shot))) {
            bad(`${sat} "${shot}" is not in screenshots/ — add the file in the same pull request.`);
          }
        });
      }
    }

    if (!Array.isArray(entry.versions) || entry.versions.length === 0) {
      bad(`${at}.versions must be a non-empty array — an entry with no release is not installable.`);
      return;
    }

    const versions = new Set();
    entry.versions.forEach((version, j) => {
      const vat = `${at}.versions[${j}]`;
      if (!isObject(version)) {
        bad(`${vat} must be an object.`);
        return;
      }
      for (const key of Object.keys(version)) {
        if (!VERSION_KEYS.includes(key)) bad(`${vat}: unknown key "${key}".`);
      }
      for (const key of VERSION_REQUIRED) {
        if (!(key in version)) bad(`${vat}: missing "${key}".`);
      }

      if (typeof version.version !== 'string' || !SEMVER_RE.test(version.version)) {
        bad(`${vat}.version must be semver, not ${JSON.stringify(version.version)}.`);
      } else if (versions.has(version.version)) {
        bad(`${vat}.version "${version.version}" is listed twice — a version is published once.`);
      } else {
        versions.add(version.version);
      }

      if (!Number.isInteger(version.hostApi) || version.hostApi < 1) {
        bad(
          `${vat}.hostApi must be the positive integer MODULE_HOST_VERSION the module was built against, ` +
            `not ${JSON.stringify(version.hostApi)}.`
        );
      }
      if (version.tag !== undefined) {
        if (typeof version.tag !== 'string' || !TAG_RE.test(version.tag)) {
          bad(`${vat}.tag, when present, must be a git tag, not ${JSON.stringify(version.tag)}.`);
        } else if (typeof version.version === 'string' && !version.tag.includes(version.version)) {
          bad(
            `${vat}.tag "${version.tag}" does not contain version "${version.version}". An entry whose tag ` +
              `and version disagree downloads one release and claims another.`
          );
        }
      }
      if (version.published !== undefined) {
        if (typeof version.published !== 'string' || !DATE_RE.test(version.published)) {
          bad(`${vat}.published, when present, must be a YYYY-MM-DD date, not ${JSON.stringify(version.published)}.`);
        } else if (Number.isNaN(Date.parse(version.published))) {
          bad(`${vat}.published "${version.published}" is not a real date.`);
        }
      }
      if (version.permissions !== undefined) {
        if (!Array.isArray(version.permissions) || version.permissions.some((p) => !isLine(p))) {
          bad(
            `${vat}.permissions, when present, must be an array of non-empty lines — the same sentences ` +
              `derivePermissions() builds from the module's manifest.`
          );
        }
      }

      if (!Array.isArray(version.files) || version.files.length === 0) {
        bad(`${vat}.files must be a non-empty array.`);
        return;
      }
      const names = new Set();
      const hashes = new Map();
      version.files.forEach((file, k) => {
        const fat = `${vat}.files[${k}]`;
        if (!isObject(file)) {
          bad(`${fat} must be an object.`);
          return;
        }
        for (const key of Object.keys(file)) {
          if (!FILE_KEYS.includes(key)) bad(`${fat}: unknown key "${key}".`);
        }
        for (const key of FILE_KEYS) {
          if (!(key in file)) bad(`${fat}: missing "${key}".`);
        }

        if (typeof file.name !== 'string' || !FILE_RE.test(file.name)) {
          bad(`${fat}.name must be one path segment (no separators, no ".."), not ${JSON.stringify(file.name)}.`);
        } else if (file.name === RECEIPT_NAME) {
          bad(
            `${fat}.name "${RECEIPT_NAME}" is reserved: the app writes the install receipt under that name ` +
              `and verifies the module against it.`
          );
        } else if (names.has(file.name)) {
          bad(`${fat}.name "${file.name}" appears twice in one version.`);
        } else {
          names.add(file.name);
          if (file.name !== 'manifest.json' && !SERVABLE_RE.test(file.name)) {
            bad(
              `${fat}.name "${file.name}" is neither manifest.json nor a .js/.css file. Only those are ever put ` +
                `on the tetravox://module map, so anything else would be downloaded and never used.`
            );
          }
        }

        if (!Number.isSafeInteger(file.bytes) || file.bytes <= 0) {
          bad(`${fat}.bytes must be a positive integer, not ${JSON.stringify(file.bytes)}.`);
        } else if (file.bytes > MAX_FILE_BYTES) {
          bad(
            `${fat}.bytes is ${file.bytes}, over the ${MAX_FILE_BYTES} B a module file may be. The app refuses ` +
              `it at install, so listing it would publish a card that cannot be used.`
          );
        }

        let sha = null;
        if (typeof file.sha256 !== 'string' || !SHA256_RE.test(file.sha256)) {
          bad(`${fat}.sha256 must be 64 lower-case hex characters, not ${JSON.stringify(file.sha256)}.`);
        } else if (hashes.has(file.sha256)) {
          bad(
            `${fat}.sha256 is the same as ${vat}.files[${hashes.get(file.sha256)}]'s. Two files of one version ` +
              `with identical content is a copy-paste, not a release.`
          );
        } else {
          hashes.set(file.sha256, k);
          sha = file.sha256;
        }

        if (typeof file.url !== 'string' || !file.url.startsWith('https://')) {
          bad(`${fat}.url must be an https URL, not ${JSON.stringify(file.url)}.`);
          return;
        }
        if (sha !== null && !file.url.endsWith(`/${sha}`)) {
          bad(
            `${fat}.url must end with "/${sha}": a release asset is named by its own sha256, so the URL and the ` +
              `hash cannot disagree.`
          );
        }
        if (typeof entry.repo === 'string' && REPO_RE.test(entry.repo)) {
          const prefix = `${entry.repo}/releases/download/`;
          if (!file.url.startsWith(prefix)) {
            bad(
              `${fat}.url must be under "${prefix}" — an entry may not name one repository and download from ` +
                `another.`
            );
          } else if (typeof version.tag === 'string' && TAG_RE.test(version.tag) && sha !== null) {
            const expected = `${prefix}${version.tag}/${sha}`;
            if (file.url !== expected) bad(`${fat}.url must be "${expected}".`);
          }
        }
      });
      for (const required of REQUIRED_FILES) {
        if (!names.has(required)) {
          bad(`${vat}.files has no "${required}" — every module release carries one.`);
        }
      }
    });

    const listed = entry.versions
      .map((v) => (isObject(v) ? v.version : null))
      .filter((v) => typeof v === 'string' && SEMVER_RE.test(v));
    const ordered = [...listed].sort(compareVersions);
    if (listed.join(' ') !== ordered.join(' ')) {
      bad(
        `${at}.versions must be sorted oldest first (${ordered.join(', ')}) so publishing a release is a ` +
          `one-object append.`
      );
    }
  });

  const ids = raw.modules.map((m) => (isObject(m) ? m.id : null)).filter((id) => typeof id === 'string');
  const sorted = [...ids].sort();
  if (ids.join(' ') !== sorted.join(' ')) {
    bad(`${INDEX}: "modules" must be sorted by id (${sorted.join(', ')}) so two submissions cannot reorder each other.`);
  }

  return { ok: errors.length === 0, errors };
}

/** `main/module-store.ts#compareVersions`, restated: a pre-release sorts below its release. */
export function compareVersions(a, b) {
  const parts = (v) =>
    v
      .split('-')[0]
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0);
  const left = parts(a);
  const right = parts(b);
  for (let i = 0; i < 3; i++) {
    const d = (left[i] ?? 0) - (right[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  const pre = (v) => v.split('-').slice(1).join('-');
  const pa = pre(a);
  const pb = pre(b);
  if (pa === pb) return 0;
  if (pa === '') return 1;
  if (pb === '') return -1;
  return pa < pb ? -1 : 1;
}

/** The index, parsed. A syntax error is reported the same way a rule violation is. */
export function readIndex(path) {
  try {
    return { ok: true, index: JSON.parse(readFileSync(path, 'utf8')) };
  } catch (err) {
    return { ok: false, errors: [`${path}: ${err instanceof Error ? err.message : String(err)}`] };
  }
}

/** Every `files[].url` in the index, in listing order. */
export function urlsOf(index) {
  const out = [];
  for (const entry of index.modules ?? []) {
    for (const version of entry.versions ?? []) {
      for (const file of version.files ?? []) {
        if (typeof file?.url === 'string') out.push({ id: entry.id, name: file.name, url: file.url });
      }
    }
  }
  return out;
}

/**
 * HEAD every asset. Off by default: the shape rules must be answerable with no network at all, so a
 * reviewer can run them offline and a fork's CI is not a flaky download.
 */
export async function checkUrls(index, { fetchImpl = fetch, log = console.log } = {}) {
  const errors = [];
  for (const { id, name, url } of urlsOf(index)) {
    try {
      const res = await fetchImpl(url, { method: 'HEAD', redirect: 'follow' });
      if (!res.ok) errors.push(`${id} ${name}: HTTP ${res.status} from ${url}`);
      else log(`  ok  ${id} ${name}`);
    } catch (err) {
      errors.push(`${id} ${name}: ${err instanceof Error ? err.message : String(err)} (${url})`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export async function main(argv = [], { root = REPO_ROOT, log = console.log, err = console.error } = {}) {
  const wantUrls = argv.includes('--check-urls');
  const rest = argv.filter((a) => a !== '--check-urls');
  const path = rest[0] === undefined ? join(root, INDEX) : resolve(rest[0]);
  const parsed = readIndex(path);
  if (!parsed.ok) {
    for (const line of parsed.errors) err(line);
    return 1;
  }
  const { ok, errors } = validateIndex(parsed.index, { screenshotsDir: join(root, 'screenshots') });
  if (!ok) {
    for (const line of errors) err(line);
    err('');
    err(`${errors.length} problem${errors.length === 1 ? '' : 's'} in ${path}.`);
    return 1;
  }

  const modules = parsed.index.modules;
  const releases = modules.reduce((n, m) => n + m.versions.length, 0);
  log(
    `${INDEX}: schema ${parsed.index.schema}, ${modules.length} module${modules.length === 1 ? '' : 's'}, ` +
      `${releases} release${releases === 1 ? '' : 's'}.`
  );
  for (const m of modules) {
    log(`  ${m.id}  ${m.licence}  ${m.versions.map((v) => `${v.version} (hostApi ${v.hostApi})`).join(', ')}`);
  }

  if (wantUrls) {
    log(`\nHEAD ${urlsOf(parsed.index).length} asset(s):`);
    const reached = await checkUrls(parsed.index, { log });
    if (!reached.ok) {
      for (const line of reached.errors) err(line);
      err('');
      err(`${reached.errors.length} unreachable asset${reached.errors.length === 1 ? '' : 's'}.`);
      return 1;
    }
  }
  return 0;
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exit(await main(process.argv.slice(2)));
