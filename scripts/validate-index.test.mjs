/**
 * `index.json`'s validator, driven red (`node --test scripts/validate-index.test.mjs`).
 *
 * Every rule has a fixture that breaks it, because this validator is what stands between a mistyped
 * hash and a card nobody can install — and a rule nobody has watched fail is a rule nobody can
 * trust. The index in the tree is checked here too, so the file this repository ships is always one
 * of the fixtures.
 *
 * `node:test` and nothing else: this repository has no dependencies and no install step, so a
 * reviewer with node can run the whole suite in the time it takes to read the diff.
 */

import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  INDEX,
  MAX_FILE_BYTES,
  RECEIPT_NAME,
  REPO_ROOT,
  checkUrls,
  compareVersions,
  readIndex,
  urlsOf,
  validateIndex,
} from './validate-index.mjs';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const REPO = 'https://github.com/idossha/tetravox-seeg';
const asset = (sha, tag = 'v1.0.0') => `${REPO}/releases/download/${tag}/${sha}`;

/** An index that passes, as the object every fixture below mutates one field of. */
const good = () => ({
  schema: 1,
  generated: '2026-09-05T00:00:00Z',
  modules: [
    {
      id: 'tetravox.seeg',
      title: 'sEEG contacts',
      summary: 'Place, label and export stereo-EEG contacts on a volume.',
      description: 'A paragraph about the module.',
      repo: REPO,
      author: 'idossha',
      licence: 'MIT',
      docs: 'https://github.com/idossha/tetravox-seeg#readme',
      versions: [
        {
          version: '1.0.0',
          hostApi: 1,
          tag: 'v1.0.0',
          published: '2026-09-05',
          permissions: ['Read .tsv, .csv files you choose'],
          files: [
            { name: 'index.js', bytes: 81234, sha256: HASH_A, url: asset(HASH_A) },
            { name: 'manifest.json', bytes: 3412, sha256: HASH_B, url: asset(HASH_B) },
          ],
        },
      ],
    },
  ],
});

/** The errors a mutated fixture produces. */
const errorsOf = (mutate) => {
  const index = good();
  mutate(index);
  return validateIndex(index).errors;
};

const complains = (mutate, needle) => {
  const errors = errorsOf(mutate);
  ok(
    errors.some((e) => e.includes(needle)),
    `expected an error mentioning "${needle}", got:\n${errors.join('\n') || '(none)'}`
  );
};

const entry = (index) => index.modules[0];
const version = (index) => index.modules[0].versions[0];
const file = (index) => index.modules[0].versions[0].files[0];

// ------------------------------------------------------------------------------------------------
// The fixtures that must pass
// ------------------------------------------------------------------------------------------------

test('the fixture passes, so every failure below is about the one field it changed', () => {
  deepStrictEqual(validateIndex(good()), { ok: true, errors: [] });
});

test('an empty index is valid — a registry with nothing in it yet is a legal registry', () => {
  deepStrictEqual(validateIndex({ schema: 1, modules: [] }), { ok: true, errors: [] });
});

test('$comment is allowed at the top level, as in the copy the app ships', () => {
  deepStrictEqual(validateIndex({ $comment: 'why', schema: 1, modules: [] }), { ok: true, errors: [] });
});

test('the optional entry keys really are optional', () => {
  const index = good();
  const e = entry(index);
  delete e.description;
  delete e.author;
  delete e.docs;
  delete index.generated;
  delete version(index).tag;
  delete version(index).published;
  delete version(index).permissions;
  deepStrictEqual(validateIndex(index), { ok: true, errors: [] });
});

test('the index in the tree is valid, screenshots and all', () => {
  const parsed = readIndex(join(REPO_ROOT, INDEX));
  ok(parsed.ok, (parsed.errors ?? []).join('\n'));
  const { ok: valid, errors } = validateIndex(parsed.index, {
    screenshotsDir: join(REPO_ROOT, 'screenshots'),
  });
  ok(valid, errors.join('\n'));
});

// ------------------------------------------------------------------------------------------------
// The top level
// ------------------------------------------------------------------------------------------------

test('the top level is checked, not assumed', () => {
  ok(!validateIndex(null).ok);
  ok(!validateIndex([]).ok);
  ok(!validateIndex('{}').ok);
});

test('the schema number is pinned', () => {
  complains((i) => (i.schema = 2), '"schema" must be 1');
  complains((i) => delete i.schema, '"schema" must be 1');
});

test('an unknown top-level key is a typo, not an extension point', () => {
  complains((i) => (i.moduels = []), 'unknown top-level key "moduels"');
});

test('"generated" must be an ISO timestamp when it is there at all', () => {
  complains((i) => (i.generated = '2026-09-05'), '"generated" must be an ISO 8601 UTC timestamp');
});

test('"modules" must be an array, and nothing after that is guessed at', () => {
  const { ok: valid, errors } = validateIndex({ schema: 1, modules: {} });
  ok(!valid);
  ok(errors.some((e) => e.includes('"modules" must be an array')));
});

test('ids are unique and sorted, so two submissions cannot reorder each other', () => {
  complains((i) => i.modules.push(structuredClone(entry(i))), 'is already listed at modules[0]');
  complains((i) => {
    const second = structuredClone(entry(i));
    second.id = 'tetravox.aaa';
    i.modules.push(second);
  }, 'must be sorted by id');
});

// ------------------------------------------------------------------------------------------------
// The entry
// ------------------------------------------------------------------------------------------------

test('an entry must be an object with no unknown keys and no missing ones', () => {
  complains((i) => (i.modules[0] = 'tetravox.seeg'), 'modules[0] must be an object');
  complains((i) => (entry(i).licence_ = 'MIT'), 'unknown key "licence_"');
  complains((i) => delete entry(i).licence, 'missing "licence"');
});

test('an id is <vendor>.<name> in lower case', () => {
  complains((i) => (entry(i).id = 'seeg'), 'must be <vendor>.<name>');
  complains((i) => (entry(i).id = 'Tetravox.Seeg'), 'must be <vendor>.<name>');
  complains((i) => (entry(i).id = 'tetravox.seeg.extra'), 'must be <vendor>.<name>');
});

test('a title and a summary are one line each, and bounded', () => {
  complains((i) => (entry(i).title = ''), '.title must be one non-empty line');
  complains((i) => (entry(i).title = 'x'.repeat(61)), '.title must be one non-empty line');
  complains((i) => (entry(i).summary = 'two\nlines'), '.summary must be one non-empty line');
  complains((i) => (entry(i).summary = 'x'.repeat(201)), '.summary must be one non-empty line');
});

test('a description, when present, is not an empty string', () => {
  complains((i) => (entry(i).description = '   '), '.description, when present');
});

test('a repo is an https github URL with no trailing slash', () => {
  complains((i) => (entry(i).repo = 'idossha/tetravox-seeg'), '.repo must be "https://github.com/');
  complains((i) => (entry(i).repo = `${REPO}/`), '.repo must be "https://github.com/');
  complains((i) => (entry(i).repo = 'http://github.com/idossha/x'), '.repo must be "https://github.com/');
});

test('a licence is required and non-empty — an unlicensed module is not listed', () => {
  complains((i) => (entry(i).licence = ''), '.licence must name the module');
  complains((i) => (entry(i).licence = '  '), '.licence must name the module');
  complains((i) => delete entry(i).licence, '.licence must name the module');
});

test('docs, when present, is a URL — an external module has no USER_GUIDE heading', () => {
  complains((i) => (entry(i).docs = 'guide/seeg-contacts'), '.docs, when present, must be an https URL');
});

test('screenshots are file names under screenshots/, unique, and of an image type', () => {
  complains((i) => (entry(i).screenshots = 'shot.png'), '.screenshots, when present, must be an array');
  complains((i) => (entry(i).screenshots = ['../shot.png']), 'must be a .png/.jpg/.jpeg/.webp file name');
  complains((i) => (entry(i).screenshots = ['shot.gif']), 'must be a .png/.jpg/.jpeg/.webp file name');
  complains((i) => (entry(i).screenshots = ['shot.png', 'shot.png']), 'is listed twice');
});

test('a screenshot must be in the tree when a directory is given to check against', () => {
  const index = good();
  entry(index).screenshots = ['absent.png'];
  const { errors } = validateIndex(index, { screenshotsDir: join(REPO_ROOT, 'screenshots') });
  ok(errors.some((e) => e.includes('is not in screenshots/')), errors.join('\n'));
});

test('an entry with no release is not installable', () => {
  complains((i) => (entry(i).versions = []), '.versions must be a non-empty array');
});

// ------------------------------------------------------------------------------------------------
// The version
// ------------------------------------------------------------------------------------------------

test('a version object is checked key by key', () => {
  complains((i) => (entry(i).versions[0] = '1.0.0'), 'versions[0] must be an object');
  complains((i) => (version(i).hostAPI = 1), 'unknown key "hostAPI"');
  complains((i) => delete version(i).files, 'missing "files"');
});

test('a version is semver, and published once', () => {
  complains((i) => (version(i).version = '1.0'), '.version must be semver');
  complains((i) => (version(i).version = 'v1.0.0'), '.version must be semver');
  complains((i) => entry(i).versions.push(structuredClone(version(i))), 'is listed twice');
});

test('hostApi is the positive integer the module was built against', () => {
  complains((i) => (version(i).hostApi = '1'), '.hostApi must be the positive integer');
  complains((i) => (version(i).hostApi = 1.5), '.hostApi must be the positive integer');
  complains((i) => (version(i).hostApi = 0), '.hostApi must be the positive integer');
});

test('a tag that disagrees with its version downloads one release and claims another', () => {
  complains((i) => (version(i).tag = 'v0.9.0'), 'does not contain version "1.0.0"');
  complains((i) => (version(i).tag = 'v 1.0.0'), '.tag, when present, must be a git tag');
});

test('published is a real YYYY-MM-DD date', () => {
  complains((i) => (version(i).published = '5 September 2026'), 'must be a YYYY-MM-DD date');
  complains((i) => (version(i).published = '2026-13-45'), 'is not a real date');
});

test('permissions are the sentences the consent sheet shows, not free-form JSON', () => {
  complains((i) => (version(i).permissions = { reads: ['tsv'] }), '.permissions, when present, must be an array');
  complains((i) => (version(i).permissions = ['']), '.permissions, when present, must be an array');
});

test('versions are sorted oldest first, so a release is a one-object append', () => {
  complains((i) => {
    const older = structuredClone(version(i));
    older.version = '0.9.0';
    older.tag = 'v0.9.0';
    entry(i).versions.push(older);
  }, 'must be sorted oldest first');
});

// ------------------------------------------------------------------------------------------------
// The files
// ------------------------------------------------------------------------------------------------

test('files is a non-empty array of objects with exactly the four keys', () => {
  complains((i) => (version(i).files = []), '.files must be a non-empty array');
  complains((i) => (version(i).files[0] = 'index.js'), 'files[0] must be an object');
  complains((i) => (file(i).size = 10), 'unknown key "size"');
  complains((i) => delete file(i).sha256, 'missing "sha256"');
});

test('both index.js and manifest.json are present', () => {
  complains((i) => (version(i).files = [version(i).files[0]]), 'has no "manifest.json"');
  complains((i) => (version(i).files = [version(i).files[1]]), 'has no "index.js"');
});

test('a file name is one path segment, unique, and not the reserved receipt', () => {
  complains((i) => (file(i).name = 'dist/index.js'), '.name must be one path segment');
  complains((i) => (file(i).name = '../index.js'), '.name must be one path segment');
  complains((i) => (version(i).files[1].name = 'index.js'), 'appears twice in one version');
  complains((i) => {
    version(i).files.push({ name: RECEIPT_NAME, bytes: 10, sha256: 'c'.repeat(64), url: asset('c'.repeat(64)) });
  }, `"${RECEIPT_NAME}" is reserved`);
});

test('only manifest.json and .js/.css files are ever served, so nothing else may be listed', () => {
  complains((i) => {
    version(i).files.push({ name: 'README.md', bytes: 10, sha256: 'c'.repeat(64), url: asset('c'.repeat(64)) });
  }, 'is neither manifest.json nor a .js/.css file');
  const index = good();
  version(index).files.push({ name: 'panel.css', bytes: 200, sha256: 'c'.repeat(64), url: asset('c'.repeat(64)) });
  deepStrictEqual(validateIndex(index), { ok: true, errors: [] });
});

test('bytes is a positive integer under the app’s per-file cap', () => {
  complains((i) => (file(i).bytes = 0), '.bytes must be a positive integer');
  complains((i) => (file(i).bytes = -1), '.bytes must be a positive integer');
  complains((i) => (file(i).bytes = 8.5), '.bytes must be a positive integer');
  complains((i) => (file(i).bytes = '81234'), '.bytes must be a positive integer');
  complains((i) => (file(i).bytes = MAX_FILE_BYTES + 1), `over the ${MAX_FILE_BYTES} B`);
});

test('a sha256 is 64 lower-case hex characters, and no two files of a version share one', () => {
  complains((i) => (file(i).sha256 = 'abc'), '.sha256 must be 64 lower-case hex');
  complains((i) => (file(i).sha256 = HASH_A.toUpperCase()), '.sha256 must be 64 lower-case hex');
  complains((i) => {
    version(i).files[1].sha256 = HASH_A;
    version(i).files[1].url = asset(HASH_A);
  }, 'is a copy-paste, not a release');
});

test('the URL is the asset named by its own hash, under the entry’s own repository', () => {
  complains((i) => (file(i).url = `${REPO}/releases/download/v1.0.0/index.js`), 'must end with "/');
  complains(
    (i) => (file(i).url = `https://github.com/attacker/mirror/releases/download/v1.0.0/${HASH_A}`),
    'may not name one repository and download from another'
  );
  complains((i) => (file(i).url = `http://github.com/idossha/tetravox-seeg/x/${HASH_A}`), '.url must be an https URL');
  complains((i) => (file(i).url = `${REPO}/releases/download/v2.0.0/${HASH_A}`), '.url must be "');
});

// ------------------------------------------------------------------------------------------------
// The helpers
// ------------------------------------------------------------------------------------------------

test('compareVersions orders releases the way the app does', () => {
  strictEqual(compareVersions('1.0.0', '1.0.1'), -1);
  strictEqual(compareVersions('1.10.0', '1.9.0'), 1);
  strictEqual(compareVersions('1.0.0', '1.0.0'), 0);
  strictEqual(compareVersions('1.0.0-rc.1', '1.0.0'), -1);
  strictEqual(compareVersions('1.0.0', '1.0.0-rc.1'), 1);
});

test('urlsOf walks every file of every version of every module', () => {
  const urls = urlsOf(good());
  deepStrictEqual(
    urls.map((u) => u.name),
    ['index.js', 'manifest.json']
  );
  deepStrictEqual(urlsOf({ modules: [] }), []);
});

test('checkUrls reports a bad status and a thrown fetch, and passes on 200', async () => {
  const seen = [];
  const okAll = await checkUrls(good(), {
    fetchImpl: async (url, init) => {
      seen.push([url, init.method]);
      return { ok: true, status: 200 };
    },
    log: () => {},
  });
  deepStrictEqual(okAll, { ok: true, errors: [] });
  strictEqual(seen.length, 2);
  strictEqual(seen[0][1], 'HEAD');

  const missing = await checkUrls(good(), {
    fetchImpl: async () => ({ ok: false, status: 404 }),
    log: () => {},
  });
  ok(!missing.ok);
  ok(missing.errors[0].includes('HTTP 404'));

  const offline = await checkUrls(good(), {
    fetchImpl: async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    },
    log: () => {},
  });
  ok(!offline.ok);
  ok(offline.errors[0].includes('ENOTFOUND'));
});

test('a syntax error is reported the way a rule violation is', () => {
  const parsed = readIndex(join(REPO_ROOT, 'scripts', 'validate-index.mjs'));
  ok(!parsed.ok);
  ok(parsed.errors.length === 1);
});
