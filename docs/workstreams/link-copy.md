# Workstream: link-copy

User (2026-11-02): "make sure the discord link and kofi link have a copy option if pop ups are browser blocked or something".

## Scope
- Every outbound link gets a copy option. That means Join ThunderClap Gaming on the end card, plus Ko-fi on both the title and the end card. Code lives in `games/last-rune/ui/coffee.ts`, `scenes/ending/ending-scene.ts`, the title scene and `ui/menu-nav.ts`.
- Add a small, clearly secondary "Copy link" control beside each link (icon + text or tooltip). On success it shows "Copied!" briefly and announces it to screen readers (aria-live).
- Clipboard: use `navigator.clipboard.writeText`. If that throws, or clipboard access is blocked (itch iframe, insecure context), fall back to a read-only text field with the URL pre-selected, so the player can copy it by hand. Never fail silently.
- Popup blocked: when a link is activated by gamepad or keyboard in a way that goes through `window.open`, check the result. If it is null, show the URL and the copy fallback right there, e.g. "Your browser blocked the new tab. Copy the link:". Mouse clicks on a real `<a>` stay as they are.
- Keep D-013/D-034: nothing opens or copies without the user acting. No network calls. Reachable by keyboard, gamepad (menu-nav) and screen reader; axe stays clean. Must not crowd Play/Join or collide with FUSE's title caption or the release label.
- URLs come from the existing constants only.

## Scope change (D-036): build it in the engine
- Put the general logic in `engine/platform/links.ts` and a reusable widget in `engine/ui/`, with no game nouns, unit tests and a short API section in engine/ui/README.md (or the architecture doc's engine section).
- `games/last-rune/ui/coffee.ts`, the end-card Join button and the title Ko-fi pill become thin callers. Remove any duplicate game-side link code.

## Done when
- e2e covers both pages:
  - each copy button puts the right URL on the clipboard (grant clipboard permissions in Playwright);
  - the fallback field appears when clipboard is unavailable;
  - a blocked `window.open` (stub it to return null) shows the fallback;
  - nothing opens without a click.
- Screenshots at 1920 and at 1280 with 150% text: title, end card, the Copied state and the fallback state.
- `pnpm check`, `pnpm build` and `pnpm test:e2e` pass.

## Log

### 2026-11-02: link-copy agent, done (D-036 engine build)
- **Engine, logic** (`engine/platform/links.ts`, no game nouns): `safeExternalUrl` (plain https only, no credentials or spaces; otherwise null, and the control is hidden), `embedContext` (top, same-origin frame or cross-origin frame; detected by reading `top.location`, not assumed), `openExternal(url, {activation})` → `opened | blocked | invalid`, `copyText` → `copied | manual`, `execCopy` and `clipboardWriteAllowed`. Pointer and keyboard activation click a temporary `<a target=_blank rel="noopener noreferrer">`. Gamepad and script activation call `window.open(url, '_blank')`. A `null` return means `blocked`; on success `opener` is cleared.
- **Engine, widget** (`engine/ui/link.ts`): `externalLink(opts)` returns a real anchor plus a Copy link button ("Copied!" for 2.2 s and an aria-live polite announcement) and a fallback popover. The popover has a label, a selected read-only field sized to the URL, Close, and Escape to dismiss, which returns focus to Copy link. `activateLink(el, activation)` gives the gamepad path and is used by `PadNav` and the game's `menuNav`. Usage is documented in `engine/ui/README.md` (there is no platform README). Unit tests: `engine/platform/links.test.ts` and `engine/ui/link.test.ts`.
- **Game**: Join (end card) and both Ko-fi pills are thin callers. `ui/link-copy.ts` and `coffeeAnchor` are deleted. `coffee.ts` keeps only the cup icon, `linkLabels()` and `coffeeLinkWidget()`. Wording lives in `LINK_COPY_TEXT` in `content/ending.ts`.
- **itch findings.** itch's game iframe has no `sandbox`, but its `allow` list lacks `clipboard-write`, so Chromium refuses `navigator.clipboard.writeText` there (https://github.com/itchio/itch.io/issues/1202). Firefox and Safari allow it on a user gesture. Copy order is therefore: writeText, skipped when `document.featurePolicy`/`permissionsPolicy` says `clipboard-write` is not allowed, so Chrome logs no policy-violation error; then a hidden textarea + `execCommand('copy')`; then the selected field. The e2e test in the itch-sim frame (itch's exact allow list, cross-origin) proves the copy still lands on the clipboard there. Blocked-popup handling stays on the gamepad path.
- **Possible future option, not built:** `navigator.share` (Web Share) on mobile. It is also policy-gated (`web-share`) inside itch's iframe.
- **Engine input fix (found here).** Two taps of the same key on consecutive ticks were read as one hold, so the second press was dropped: quick arrow presses on menus skipped a step. `Input` now remembers the keys and buttons that were active on the last tick, and a tap of one of those counts as a new press. Rolling from one bound key to another still does not re-press. A unit test was added in `engine/input/input.test.ts`.
- **Referrer note.** The `window.open` path cannot pass `noreferrer` without losing block detection, because the `noopener` feature always returns null. Under the default referrer policy only the game's origin is sent.
- **Screenshots** (1920/100 and 1280/150; title, end, copied and fallback states) were checked by eye. Join stays centred with Copy link hung to its right. The title pill sits bottom-right, clear of Play/Settings and FUSE. The fallback is a popover that does not push Back off-screen.
