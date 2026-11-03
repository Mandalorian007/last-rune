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
