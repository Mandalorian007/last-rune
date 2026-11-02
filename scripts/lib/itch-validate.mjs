// Pure validation of a built web game against itch.io HTML5 upload rules.
// Limits come from https://itch.io/docs/creators/html5 (accessed 2026-11-02);
// see docs/research/itch-webgpu.md for the full citation list.

export const ITCH_LIMITS = Object.freeze({
  maxFiles: 1000,
  maxFileBytes: 200 * 1024 * 1024,
  maxTotalBytes: 500 * 1024 * 1024,
  maxPathLength: 240,
});

/** Our own performance budget (docs/engineering.md): initial download < 5 MB zipped. */
export const ZIP_BUDGET_BYTES = 5 * 1024 * 1024;

const TEXT_EXT = /\.(html?|css|js|mjs|json|svg|wgsl|txt)$/i;

/** Absolute root URLs ("/foo", not "//cdn" and not "./foo") break on itch's nested CDN path. */
const HTML_ATTR_ABS = /\b(?:src|href|poster|data)\s*=\s*["']\/(?!\/)([^"']*)["']/gi;
const CSS_URL_ABS = /url\(\s*["']?\/(?!\/)([^"')]*)["']?\s*\)/gi;
// In JS, only flag absolute paths that point at a file with a typical asset extension, so
// regex literals and route strings don't trip it.
const JS_ABS_ASSET =
  /["'`]\/(?!\/)([\w\-./]+\.(?:js|mjs|css|png|jpe?g|webp|gif|svg|wasm|wgsl|json|ogg|mp3|wav|woff2?|ttf|glb|bin))["'`]/gi;

const HTML_ATTR_REL = /\b(?:src|href)\s*=\s*["'](?![a-z][a-z0-9+.-]*:|\/\/|#|\/)([^"'#?]*)/gi;
const CSS_URL_REL = /url\(\s*["']?(?![a-z][a-z0-9+.-]*:|\/\/|#|\/)([^"')#?]+)["']?\s*\)/gi;
const JS_REL_IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["'](\.\.?\/[^"']+)["']/g;

/**
 * Resolve a relative reference against the directory of the referring file.
 * @param {string} fromPath
 * @param {string} ref
 */
export function resolveRef(fromPath, ref) {
  const parts = fromPath.split('/').slice(0, -1);
  for (const seg of ref.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

/**
 * @typedef {{ path: string; size: number; text?: string }} BuildFile
 * @typedef {{ allowSourceMaps?: boolean }} ValidateOptions
 * @typedef {{ errors: string[]; warnings: string[] }} ValidateResult
 */

/**
 * Validate a list of build files (paths relative to dist/, '/' separated).
 * `text` should be provided for text assets (html/css/js) so references can be checked.
 * @param {BuildFile[]} files
 * @param {ValidateOptions} [opts]
 * @returns {ValidateResult}
 */
export function validateBuild(files, opts = {}) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];
  const paths = new Set(files.map((f) => f.path));
  const lowerToActual = new Map(files.map((f) => [f.path.toLowerCase(), f.path]));

  if (!paths.has('index.html')) {
    errors.push('index.html must be at the root of the zip (itch serves it as the entry point).');
  }
  if (files.length > ITCH_LIMITS.maxFiles) {
    errors.push(`Too many files: ${files.length} > ${ITCH_LIMITS.maxFiles}.`);
  }
  let total = 0;
  for (const f of files) {
    total += f.size;
    if (f.size > ITCH_LIMITS.maxFileBytes) {
      errors.push(`${f.path} is ${f.size} bytes, over itch's 200 MB per-file limit.`);
    }
    if (f.path.length > ITCH_LIMITS.maxPathLength) {
      errors.push(`${f.path} path is ${f.path.length} chars, over itch's 240-char limit.`);
    }
    if (/\.map$/i.test(f.path) && !opts.allowSourceMaps) {
      errors.push(`${f.path}: source maps are not shipped (pass --allow-sourcemaps to override).`);
    }
    // biome-ignore lint/suspicious/noControlCharactersInRegex: deliberately rejecting control chars
    if (/[\s\u0000-\u001f\\]/.test(f.path) || /[^\x20-\x7e]/.test(f.path)) {
      warnings.push(`${f.path}: whitespace/non-ASCII in file names is risky on the itch CDN.`);
    }
    if (f.path.split('/').some((s) => s.startsWith('.'))) {
      warnings.push(`${f.path}: dotfile in build output.`);
    }
  }
  if (total > ITCH_LIMITS.maxTotalBytes) {
    errors.push(`Total extracted size ${total} bytes is over itch's 500 MB limit.`);
  }

  /** @param {string} from @param {string} ref @param {string} kind */
  const checkRef = (from, ref, kind) => {
    let decoded = ref;
    try {
      decoded = decodeURIComponent(ref);
    } catch {}
    if (decoded === '' || decoded === '.') return;
    if (decoded.endsWith('/')) {
      errors.push(
        `${from}: ${kind} "${ref}" points at a folder; itch returns 403 for folder URLs.`,
      );
      return;
    }
    const target = resolveRef(from, decoded);
    if (paths.has(target)) return;
    const ci = lowerToActual.get(target.toLowerCase());
    if (ci) {
      errors.push(
        `${from}: ${kind} "${ref}" only matches "${ci}" case-insensitively; itch is case sensitive.`,
      );
    } else {
      errors.push(`${from}: ${kind} "${ref}" does not exist in the build.`);
    }
  };

  for (const f of files) {
    if (f.text === undefined || !TEXT_EXT.test(f.path)) continue;
    const t = f.text;
    if (/\.html?$/i.test(f.path)) {
      for (const m of t.matchAll(HTML_ATTR_ABS)) {
        errors.push(`${f.path}: absolute URL "/${m[1]}"; use a relative path (Vite base './').`);
      }
      for (const m of t.matchAll(HTML_ATTR_REL)) checkRef(f.path, m[1], 'reference');
    }
    if (/\.(html?|css)$/i.test(f.path)) {
      for (const m of t.matchAll(CSS_URL_ABS)) {
        errors.push(`${f.path}: absolute CSS url("/${m[1]}"); use a relative path.`);
      }
      if (/\.css$/i.test(f.path)) {
        for (const m of t.matchAll(CSS_URL_REL)) checkRef(f.path, m[1], 'css url');
      }
    }
    if (/\.m?js$/i.test(f.path)) {
      for (const m of t.matchAll(JS_ABS_ASSET)) {
        errors.push(`${f.path}: absolute asset path "/${m[1]}"; itch serves from a nested path.`);
      }
      for (const m of t.matchAll(JS_REL_IMPORT)) checkRef(f.path, m[1], 'import');
    }
  }

  return { errors, warnings };
}

/** @param {number} n */
export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
