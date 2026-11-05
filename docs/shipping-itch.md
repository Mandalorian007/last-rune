# Shipping to itch.io (retired)

> **Retired by D-047 (2026-11-04).** The Last Rune ships on GitHub Pages only. `pnpm package:itch`, itch-sim and `pnpm cover` were removed from the game. The engine still supports itch-style iframe embedding. This page is kept for reference if a later game goes to itch.

This runbook covers shipping The Last Rune as a free HTML5 game with a tip jar. The evidence behind each setting is in [`docs/research/itch-webgpu.md`](research/itch-webgpu.md).

Nothing in the repo or CI uploads to itch or holds itch credentials. Every upload and account step below is manual.

## 0. Pre-flight

- [ ] On `main`, CI (`.github/workflows/ci.yml`) is green.
- [ ] Bump `version` in `package.json`. It names the zip and the itch user version.
- [ ] `pnpm install --frozen-lockfile && pnpm check` passes.
- [ ] `pnpm test:e2e` passes locally (macOS: see `tests/e2e/README.md`). After engine-render merges, no tests should be `fixme`.
- [ ] Optional: run the **E2E (WebGPU smoke)** workflow by hand (Actions → Run workflow).
- [ ] Saves use `thunderclap:last-rune:`-prefixed `localStorage` keys, never call `localStorage.clear()`, and survive `localStorage` throwing (research §3).

## 1. Build and zip

```sh
pnpm package:itch          # runs pnpm build, validates dist/, writes build/last-rune-itch-<version>.zip
```

The script stops if any itch rule fails:

- `index.html` is not at the root
- more than 1,000 files, a file over 200 MB, or more than 500 MB in total
- a path longer than 240 characters
- absolute `/` URLs
- references whose capitalization doesn't match the file
- source maps (pass `--allow-sourcemaps` to allow them)

It also warns if the zip is larger than 5 MB.

`pnpm package:itch --skip-build` re-zips the existing `dist/`. CI uploads the same zip as the `itch-zip` artifact.

## 2. Test in a local itch simulation

```sh
pnpm itch:sim              # http://localhost:8790
```

This runs `dist/` inside a cross-site iframe (`127.0.0.1:8791/html/0000000/`) with itch's exact `allow` attribute, at 960×540, behind a "Run game" button. Check:

- The game boots and renders.
- Audio starts after the first click inside the game.
- Fullscreen works, both from itch's button and from in-game fullscreen if we have one.
- Progress survives a reload.

URL options:

- `?w=1280&h=720` changes the frame size.
- `?autoload=1` skips the button.
- `?allow=none` drops the `allow` list.
- `?sandbox=1` adds a sandbox. Use it to see the storage-failure path.

## 3. Upload

### Option A: web UI (recommended for the first release)

1. Go to itch.io → Dashboard → **Create new project**, or open the existing project's **Edit game**.
2. Set **Kind of project: HTML**.
3. **Uploads → Upload files**. Choose `build/last-rune-itch-<version>.zip`.
4. Tick **"This file will be played in the browser"** on that upload.

### Option B: butler (later releases)

Install butler from <https://itch.io/docs/butler/installing.html>, then:

```sh
butler login                                    # once; credentials stay in your home directory, never in the repo
butler push build/last-rune-itch-<version>.zip <itch-user>/last-rune:html5 \
  --userversion <version> --dry-run             # check first
butler push build/last-rune-itch-<version>.zip <itch-user>/last-rune:html5 --userversion <version>
butler status <itch-user>/last-rune:html5
```

After the first butler push, make sure the `html5` channel's upload is ticked "played in the browser". Don't add `BUTLER_API_KEY` to GitHub secrets without a separate decision; CI is meant to need no secrets.

## 4. Page settings

### Embed options (Edit game → Embed options)

| Setting | Value | Why |
|---|---|---|
| Embed mode | **Embed in page** | WebGPU works in itch's iframe (research §2) |
| Viewport dimensions | **960 × 540** | 16:9; fits the itch page column. The game scales to whatever size it gets. |
| Click to Play / "Run game" button | **On** | The game doesn't load until the player asks for it. This doesn't unlock audio (research §4). |
| Click to launch in fullscreen | **Off** | Only needed if embedding ever breaks. Fullscreen is still one click away. |
| Fullscreen button | **On** | The iframe allows fullscreen (`fullscreen *`) |
| Enable scrollbars | **Off** | The game fills the frame |
| Mobile Friendly | **Off** for v1 | Many phones lack WebGPU (Firefox Android, older Android, iOS < 26). Revisit after touch input is tested on iOS 26 and Android Chrome. |
| SharedArrayBuffer support | **Off** | Turning it on moves the game to another origin, which wipes saves (research §1.1). Not needed. |

### Pricing (the tip jar)

- **Pricing: "$0 or donate"**, with a suggested donation (for example $3).
- Optional: write a short thank-you message for donors.

### Account (one-time, manual, owner only)

- [ ] Set up **payments** (Settings → Payments). Choose either:
  - **Collected by itch.io**: itch is the merchant of record and handles VAT/sales tax. Payouts require the tax interview, a $5 minimum and a 7+ day hold.
  - **Direct to you**: your own PayPal or Stripe account.
- [ ] Complete the **tax interview**. Without it, payouts are subject to 30% default withholding.
- [ ] Choose **itch's revenue share** (default 10%, adjustable).

## 5. Page copy checklist

- [ ] Title, short tagline and a description with how to play.
- [ ] **System requirements:**
  - Chrome or Edge 113+ (Windows, macOS, ChromeOS).
  - Safari 26+ (macOS Tahoe, iOS/iPadOS 26).
  - Firefox 141+ on Windows, or 145+ on Apple Silicon macOS 26.
  - Linux Chrome needs WebGPU enabled.
- [ ] "Progress is saved in this browser only."
- [ ] Cover image (630×500): run `pnpm cover` and upload `build/last-rune-itch-cover.png` (fuse-portrait, D-043 addendum 1; `build/last-rune-itch-cover-thumb.png` shows it at browse size). Also screenshots and an optional GIF. The page background and colors should match the game's palette.
- [ ] Genre: Puzzle. Tags: puzzle, webgpu, browser, singleplayer.
- [ ] Credits and license. Fonts and audio must allow redistribution.

## 6. Before you publish

Keep the project as Draft or Restricted until these are done:

- [ ] Play the **live page** in Chrome or Edge (Windows or macOS), Safari 26 and **Firefox** (not tested automatically; research §2.3C). Check:
  - the game renders
  - audio plays after a click
  - the fullscreen button works
  - a reload keeps progress
- [ ] Open the page in a browser without WebGPU, or with WebGPU disabled. The unsupported screen should show readable advice and no blank canvas.
- [ ] Check the browser console in the game frame: no errors and no 404s.
- [ ] Set visibility to **Public**.

## 7. After launch

- Watch comments and the itch analytics dashboard. Look for reports of a blank canvas, missing saves or audio problems.
- To ship a fix:
  1. Bump the version and run `pnpm package:itch`.
  2. Upload a **replacement** of the same file, or `butler push` to the same channel. Don't create a second upload, or players will see two "Run game" options.
- Saves survive updates only if the key names and format stay compatible. A breaking change needs a migration.
- Never turn on SharedArrayBuffer or change the project's embed origin after launch (saves are lost).
