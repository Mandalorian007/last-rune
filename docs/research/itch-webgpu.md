# Research: shipping a WebGPU game as an itch.io HTML5 game

Ship-ops research, 2026-11-02. Every source was accessed on 2026-11-02. "Observed" means we checked it directly against live itch.io pages or with a local browser experiment (§2.3).

## TL;DR

| Question | Verdict | Confidence |
|---|---|---|
| Does WebGPU work inside itch's iframe? | **Yes.** No browser implements a `webgpu` permissions-policy feature, so the iframe's `allow` list cannot block it. We checked this on real `html-classic.itch.zone` frames in Chromium 156 and WebKit 27.2. | High for Chrome, Edge and Safari. Medium for Firefox, which we checked by reading the source but did not run live. |
| Does `localStorage` work and persist? | **Yes.** It is partitioned under top-level site `itch.io` and origin `html-classic.itch.zone`. **Every classic itch HTML5 game shares that partition.** Prefix every key, never call `localStorage.clear()`, and wrap access in try/catch. | High in Chromium and WebKit (observed). Medium for Firefox and for how long Safari keeps the data. |
| Audio | The iframe has `allow="autoplay"`, but browsers still require a user gesture inside the game. Create or resume the `AudioContext` on the first click or key press. | High |
| Fullscreen | The iframe has `allow="fullscreen *"` and `allowfullscreen`, so `requestFullscreen()` works from a gesture. Also turn on itch's fullscreen button. | High |
| Recommended embed | Embed in page at **960×540**. Click to Play **on**. Fullscreen button **on**. Scrollbars off. SharedArrayBuffer **off**. Mobile Friendly **off** for v1. | |

## 1. itch.io HTML5 upload requirements

Source: [itch.io docs: Uploading HTML5 games](https://itch.io/docs/creators/html5)

- **Format.** Upload a **ZIP** with `index.html` at the root. ZIP is the only archive format itch accepts.
- **Limits.** At most **1,000 files**. Each extracted file at most **200 MB**. At most **500 MB** extracted in total. File paths at most **240 characters**.
- **File names.** Names are **case sensitive** on the CDN and must be UTF-8. A reference whose capitalization doesn't match the file works on macOS and Windows but returns 404 on itch.
- **Paths.** Use **relative paths**. Observed: the game is served from a nested path, `https://html-classic.itch.zone/html/<upload-id>/index.html`, so absolute `/assets/...` URLs break. A folder URL such as `.../assets/` returns 403. Vite's `base: './'` meets this rule.
- **HTTPS.** Everything is served over HTTPS. WebGPU needs this secure context.
- **Compression.** The CDN gzips text assets automatically and serves `.br` files as Brotli.
- **Embed options** on the game's edit page:
  - "Embed in page", with viewport width and height.
  - "Click to launch in fullscreen".
  - "**Click to Play**": shows a "Run game" button before the iframe loads.
  - "**Fullscreen button**".
  - "Enable scrollbars".
  - "**Mobile Friendly**", with an orientation setting.
  - "**SharedArrayBuffer support**" (§1.1).
- **Payments.** A browser-only game can be free or can take donations (§6).

`scripts/package-itch.mjs` checks these rules before it writes the zip. The checks live in `scripts/lib/itch-validate.mjs` and cover file count, file size, path length, `index.html` at the root, case-sensitive references, absolute URLs and source maps.

### 1.1 SharedArrayBuffer option: leave it OFF

Source: [leafo (itch.io staff), forum post on experimental SharedArrayBuffer support, Apr 2022](https://itch.io/t/2025776)

Turning this option on moves the game to a different origin, `html.itch.zone`, served with COOP/COEP headers. Consequences:

- Saves already in `localStorage` under `html-classic.itch.zone` are lost.
- Iframes inside the game break.
- Safari needs a popup window.

The Last Rune doesn't use threads, so keep the option off. Turning it on after launch would wipe every player's progress.

## 2. WebGPU inside the itch iframe (ship-blocking question)

### 2.1 What the iframe looks like (observed)

We checked four or more live game pages, including `0oq0o/black-hole-shepherd`, `xanderpatch/nucleon` and `featurekreep/sleigh-the-spire`. Each page has a `data-iframe` placeholder. When the player clicks "Run game", the page injects this:

```html
<iframe id="game_drop" src="https://html-classic.itch.zone/html/<id>/index.html"
  allow="autoplay; fullscreen *; geolocation; microphone; camera; midi; monetization; xr-spatial-tracking; gamepad; gyroscope; accelerometer; xr; cross-origin-isolated; web-share"
  allowfullscreen allowtransparency scrolling="no" frameborder="0"
  webkitallowfullscreen mozallowfullscreen msallowfullscreen></iframe>
```

- There is **no `sandbox` attribute**.
- The game page sends `content-security-policy: frame-ancestors 'self' https://itch.io`.
- Neither the itch.io page nor the CDN document sends a `Permissions-Policy` header.
- `webgpu` is **not** in the `allow` list. §2.2 shows why that doesn't matter.

### 2.2 Is there a `webgpu` permissions-policy feature?

**No browser ships one.** A `webgpu` feature, with default allowlist `self`, appears only as a *proposal* in the WebGPU design notes. None of the specs, registries or browser source files we checked include it:

| Where | Finding | Source |
|---|---|---|
| WebGPU design notes | Proposes a `"webgpu"` policy-controlled feature with default allowlist `self`. Proposal only. | [gpuweb design/AdapterIdentifiers.md](https://github.com/gpuweb/gpuweb/blob/main/design/AdapterIdentifiers.md) |
| WebGPU spec (Editor's Draft) | No permissions-policy integration. We searched the full text. | [WebGPU ED](https://gpuweb.github.io/gpuweb/) |
| W3C registry of policy-controlled features | No `webgpu` entry. | [webappsec-permissions-policy features.md](https://github.com/w3c/webappsec-permissions-policy/blob/main/features.md) |
| Chromium | No WebGPU entry in `permissions_policy_features.json5` or the mojom. Observed: an `allow` value containing `webgpu` logs `Unrecognized feature: 'webgpu'`. | [Chromium permissions_policy_features.json5](https://source.chromium.org/chromium/chromium/src/+/main:services/network/public/cpp/permissions_policy/permissions_policy_features.json5) |
| WebKit | No WebGPU feature in `PermissionsPolicy.h` or `PermissionsPolicy.cpp`. | [WebKit PermissionsPolicy.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/html/PermissionsPolicy.cpp) |
| Gecko (Firefox) | No WebGPU feature in `FeaturePolicyUtils.cpp`. | [searchfox FeaturePolicyUtils.cpp](https://searchfox.org/mozilla-central/source/dom/security/featurepolicy/FeaturePolicyUtils.cpp) |
| MDN | `webgpu` is not among the 51 `Permissions-Policy` directives MDN lists. | [MDN Permissions-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy) |

So inside a cross-origin iframe without a sandbox, `navigator.gpu.requestAdapter()` behaves the same as on a top-level page.

**Future risk.** If a browser ships the proposal with default allowlist `self`, itch would need to add `webgpu` to the iframe's `allow` list. If itch didn't, our fallback would be to link to `index.html` on the CDN so it opens in its own tab, where WebGPU would work at top level. Check this again whenever browser release notes mention a WebGPU permissions policy. The e2e test `itch-sim: cross-site iframe` uses itch's exact `allow` list, so it would fail in Chromium if Chromium shipped such a feature.

### 2.3 Experiments (2026-11-02, Playwright 1.64.1)

**A. Local cross-site iframe.** A page on `localhost:4301` embedded a frame from `127.0.0.1:4302`. "Adapter" and "device" mean `requestAdapter()` and `requestDevice()` succeeded.

| Variant | Chromium 156 (Metal) | WebKit 27.2 |
|---|---|---|
| itch's exact `allow` list | adapter ✓, device ✓ | adapter ✓, device ✓ |
| no `allow` attribute | ✓, ✓ | ✓, ✓ |
| `allow="webgpu 'none'"` | ✓, ✓ (console logs "unrecognized feature") | ✓, ✓ |
| parent sends `Permissions-Policy: webgpu=()` | ✓, ✓ | ✓, ✓ |
| `sandbox="allow-scripts"` | ✓, ✓, **but `localStorage` throws SecurityError** | ✓, ✓, `localStorage` throws |
| `allow` without `fullscreen` | `document.fullscreenEnabled === false` | same |

**B. Real itch.io frames.** Chromium and WebKit each loaded three live games, clicked "Run game" and ran checks inside the `html-classic.itch.zone` frame. Every run reported:

- adapter ✓ and device ✓
- `localStorage` ✓
- `fullscreenEnabled` ✓
- no `sandbox` attribute
- `window.top` not readable, which confirms the frame is cross-origin

**C. Firefox: not tested.** Playwright's Firefox 157 fails to launch on this machine ("Could not find profile folder"). Gecko has no WebGPU policy feature (§2.2), so we expect the same result as the other browsers. **Before announcing, check the live page by hand in Firefox 141+ on Windows or Firefox 145+ on an Apple Silicon Mac running macOS 26.**

### 2.4 Browser support for WebGPU

Source: [web.dev, "WebGPU is now supported in major browsers", 2025-11-25](https://web.dev/blog/webgpu-supported-major-browsers)

| Browser | WebGPU support |
|---|---|
| Chrome, Edge | Version 113+ on Windows, macOS and ChromeOS. Chrome 121+ on Android 12+ with Qualcomm or ARM GPUs. Linux is not supported by default yet. |
| Firefox | Version 141+ on Windows. Version 145+ on Apple Silicon Macs running macOS Tahoe 26. Linux, Android and Intel Macs are still in progress. |
| Safari | Safari 26 on macOS Tahoe, iOS, iPadOS and visionOS. |

The game's unsupported screen has to handle two cases: `navigator.gpu` is missing, or `requestAdapter()` returns `null` (for example, a blocklisted GPU). The e2e suite tests both.

## 3. `localStorage` in the itch iframe

**Every itch game shares one storage partition.** Browsers partition third-party storage by top-level site plus the frame's origin. For itch:

- `itch.io` is not on the [Public Suffix List](https://publicsuffix.org/list/public_suffix_list.dat), so every game page has the top-level site `https://itch.io`.
- Every classic HTML5 game is served from the origin `html-classic.itch.zone`.

So all classic itch games read and write the same `localStorage`. Rules for engine-systems:

- Prefix every key with `last-rune:`.
- Never call `localStorage.clear()`.
- Expect keys we didn't write.
- Wrap every access in try/catch and fall back to memory (see Chrome below).

**Chrome**

- Storage has been partitioned by origin plus top-level site since Chrome 115, and the partition persists like normal storage. ([Privacy Sandbox: storage partitioning](https://privacysandbox.google.com/cookies/storage-partitioning))
- Observed: values survived a full browser relaunch, including with `--test-third-party-cookie-phaseout`.
- Older forum reports say the "Block third-party cookies" setting makes `localStorage` throw "Access is denied for this document". In that case the game should keep progress in memory and show a "progress can't be saved in this browser" notice.

**Firefox**

- Firefox has partitioned third-party `localStorage` since version 103 (Total Cookie Protection), and the data persists within its partition. ([MDN: State partitioning](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/State_Partitioning))

**Safari / WebKit**

- Third-party storage is partitioned, and WebKit says it can be made ephemeral.
- WebKit deletes script-writable storage after 7 days without user interaction with the site. Playing the game counts as interaction with itch.io. ([WebKit: Tracking Prevention](https://webkit.org/tracking-prevention/))
- Observed: values survived a relaunch with a persistent WebKit profile.
- Caveat: we haven't proven long-term retention in real Safari. The page copy should say saves are per-browser.

**Sandboxing.** A `sandbox` attribute without `allow-same-origin` makes `localStorage` throw (observed). itch doesn't sandbox the iframe today. If it starts to, the try/catch fallback covers it.

## 4. Audio autoplay and fullscreen

**Audio**

- An `AudioContext` created before any user gesture starts `suspended`. Call `ctx.resume()` from a click or key press. ([Chrome autoplay policy](https://developer.chrome.com/blog/autoplay))
- Cross-origin iframes also need `allow="autoplay"`. itch sets it.
- Safari and Firefox require a gesture in the same way.
- The "Run game" click from Click to Play happens on the parent page, so it **doesn't count as a gesture inside the iframe**. The game still needs its own start click, or must resume audio on the first input.

**Fullscreen**

- `allow="fullscreen *"` plus `allowfullscreen` let the game call `element.requestFullscreen()` from a gesture inside the frame. Observed: `fullscreenEnabled === true`.
- itch's own fullscreen button makes the whole iframe fullscreen from the parent page.
- Either way, the canvas must resize to the new viewport: use a ResizeObserver and account for `devicePixelRatio`.

## 5. butler (itch's upload CLI): documented here, not used

Sources: butler docs on [installing](https://itch.io/docs/butler/installing.html), [logging in](https://itch.io/docs/butler/login.html) and [pushing builds](https://itch.io/docs/butler/pushing.html)

- **Credentials.**
  - `butler login` opens a browser and stores credentials in `~/Library/Application Support/itch/butler_creds` on macOS.
  - In CI, butler reads the `BUTLER_API_KEY` environment variable.
  - **We deliberately add neither to the repo or to CI.**
- **Pushing.**
  - `butler push <dir-or-zip> <user>/<game>:<channel> --userversion <v>` uploads a build. `--userversion-file` reads the version from a file instead.
  - `--dry-run` validates without uploading.
  - Pushing a directory that contains a single zip uploads the zip's contents.
- **Incremental uploads.** butler sends patches, so repeat uploads are small.
- **After the first push,** mark the upload "This file will be played in the browser" on the game's edit page.
- **Status.** `butler status <user>/<game>:<channel>` shows which build is live.

## 6. Tip jar (donations)

Sources: [itch.io docs: Pricing](https://itch.io/docs/creators/pricing), [itch.io docs: Payments](https://itch.io/docs/creators/payments)

**Price setting**

- On the game's edit page, set **Pricing** to **"$0 or donate"** and enter a suggested donation (for example $3).
- Donating is optional. The game stays free to play.

**Payment mode** (account settings)

- "**Direct to you**": payments go to your own PayPal or Stripe account, and you are the merchant of record.
- "**Collected by itch.io**": itch is the merchant of record and pays you out later.

**Payouts** (collected mode)

- A **tax interview** is required before payouts. Without a tax ID, payouts are subject to 30% default withholding.
- The minimum balance is **$5**.
- Revenue becomes available **7 days** after purchase, and in some cases up to 30 days.
- Payout review takes at least 7 days, typically 10–14.

**itch's revenue share** defaults to **10%** and can be set anywhere from 0% to 100% in seller settings.

None of this touches the repo. These are manual account steps, listed in `docs/shipping-itch.md`.

## 7. Headless WebGPU for automated tests

Tested 2026-11-02 with Playwright 1.64.1 and Chromium 156.

| Environment | Flags | Result |
|---|---|---|
| macOS headless shell | none | `requestAdapter()` returns `null` |
| macOS headless shell | `--enable-unsafe-webgpu` | SwiftShader software fallback |
| macOS headless shell | `--enable-unsafe-webgpu --use-angle=metal` | **real Apple GPU (metal-3)** ✓ |
| Linux arm64, `mcr.microsoft.com/playwright:v1.64.1-noble` | `--enable-unsafe-webgpu --enable-features=Vulkan --use-webgpu-adapter=swiftshader` | adapter found, but canvas screenshots are all black |
| Linux arm64, same image | the line above **plus `--use-angle=swiftshader`** | **works: 140/140 runs.** Before the WebGPU check retried both `requestAdapter` and `requestDevice`, 1–3% of runs failed. |
| Linux amd64, same image under QEMU emulation on Apple Silicon | n/a | Chromium failed to launch under emulation. Not tested on real x86 GitHub runners. |

This is why the e2e workflow is manual and runs on `ubuntu-24.04-arm` (see `.github/workflows/e2e.yml`).

## Clipboard and popups in the itch frame (PM, 2026-11-02)
- **Popups.** There is no `sandbox` attribute, so `<a target="_blank" rel="noopener noreferrer">` works under the normal popup blocker, which allows tabs opened by a real click or key press. A gamepad button press does not count as user activation, so `window.open` from the pad path can be blocked. Show a copy fallback there.
- **Clipboard.** `clipboard-write` is not in itch's `allow` list. Chromium rejects `navigator.clipboard.writeText` in the cross-origin frame. Firefox and Safari allow it on a gesture. The issue is open, unanswered by staff since 2021: https://github.com/itchio/itch.io/issues/1202. The community workaround is a hidden textarea plus `document.execCommand('copy')` inside the gesture handler. Last resort: a read-only field with the URL selected.
- itch's docs (https://itch.io/docs/creators/html5) don't document the iframe's permissions. Re-check the live `allow` list at launch.
