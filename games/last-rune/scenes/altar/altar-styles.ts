/**
 * Altar + solve-moment overlay styles (design px, 1920×1080). Kept with the scene so the
 * shared `ui/styles.ts` stays untouched; injected once per document.
 */
const CSS = /* css */ `
.tc-overlay .lr-altar { position: absolute; inset: 0; pointer-events: none; }
.tc-overlay .lr-altar button { pointer-events: auto; }
.tc-overlay .lr-altar kbd { font-family: var(--tc-font-mono); font-size: 18px; opacity: 0.65; margin-left: 10px; }

.tc-overlay .lr-altar-title {
  position: absolute; left: 50%; top: 18px; transform: translateX(-50%); text-align: center;
  font-family: var(--tc-font-display); color: #f4e6c4; text-shadow: 0 2px 10px rgba(0,0,0,0.9);
}
.tc-overlay .lr-altar-title h2 { margin: 0; font-size: 40px; letter-spacing: 2px; color: var(--lr-gold); }
.tc-overlay .lr-altar-title small { display: block; font-size: 22px; color: #bfae8a; letter-spacing: 1px; min-height: 26px; }

.tc-overlay .lr-altar-actions {
  position: absolute; right: 28px; top: 24px; display: flex; gap: 12px; align-items: center;
}
.tc-overlay .lr-altar-actions .lr-stone-button { min-width: 0; min-height: 56px; font-size: 24px; padding: 0 20px; }
.tc-overlay .lr-altar-actions .lr-gold-button { min-width: 0; min-height: 70px; font-size: 34px; padding: 0 34px; }
.tc-overlay .lr-altar-actions button:disabled { opacity: 0.45; cursor: default; filter: saturate(0.4); }

.tc-overlay .lr-altar-count {
  position: absolute; transform: translate(-50%, 0); min-width: 30px; padding: 2px 8px; border-radius: 12px;
  font-family: var(--tc-font-mono); font-size: 20px; text-align: center; color: #f4e6c4;
  background: rgba(20,16,12,0.85); border: 1px solid rgba(232,192,106,0.45);
}
.tc-overlay .lr-altar-count[data-empty] { opacity: 0.35; }
.tc-overlay .lr-altar-count[data-held] { border-color: var(--lr-gold); color: #fff6dd; box-shadow: 0 0 14px rgba(232,192,106,0.5); }
.tc-overlay .lr-altar-count .lr-k { opacity: 0.55; margin-right: 6px; }

.tc-overlay .lr-altar-need {
  position: absolute; transform: translate(-50%, -100%); padding: 4px 14px; border-radius: 10px; white-space: nowrap;
  font-family: var(--tc-font-display); font-size: 24px; color: #f4e6c4;
  background: linear-gradient(180deg, rgba(40,32,22,0.92), rgba(20,16,12,0.92));
  border: 2px solid rgba(232,192,106,0.5); box-shadow: 0 6px 16px rgba(0,0,0,0.6);
  transition: border-color 200ms, color 200ms;
}
.tc-overlay .lr-altar-need[data-state="exact"] { border-color: #3fe0ff; color: #dff9ff; box-shadow: 0 0 22px rgba(63,224,255,0.55); }
.tc-overlay .lr-altar-need[data-state="under"] { border-color: #ffb03f; }
.tc-overlay .lr-altar-need[data-state="over"] { border-color: #ff5a3c; color: #ffd7cc; box-shadow: 0 0 22px rgba(255,90,60,0.55); }

.tc-overlay .lr-altar-verdict {
  position: absolute; left: 50%; top: 96px; transform: translateX(-50%); padding: 10px 30px; border-radius: 12px;
  font-family: var(--tc-font-display); font-size: 30px; letter-spacing: 1px; white-space: nowrap; color: #f4e6c4;
  background: rgba(16,13,10,0.9); border: 2px solid rgba(232,192,106,0.55); box-shadow: 0 8px 24px rgba(0,0,0,0.6);
  animation: lr-altar-pop 260ms var(--tc-easing) both;
}
.tc-overlay .lr-altar-verdict[hidden] { display: none; }
.tc-overlay .lr-altar-verdict[data-outcome="over"] { border-color: #ff5a3c; }
.tc-overlay .lr-altar-verdict[data-outcome="under"] { border-color: #ffb03f; }
.tc-overlay .lr-altar-verdict[data-outcome="exact"] { border-color: #3fe0ff; color: #dff9ff; }

.tc-overlay .lr-altar-tag {
  position: absolute; transform: translate(-50%, -100%); padding: 4px 12px; border-radius: 8px; white-space: nowrap;
  font-size: 20px; color: #ffe3dc; background: rgba(60,14,10,0.9); border: 1px solid rgba(255,110,80,0.7);
  box-shadow: 0 4px 12px rgba(0,0,0,0.6); animation: lr-altar-pop 220ms var(--tc-easing) both;
}
.tc-overlay .lr-altar-tag::after {
  content: ''; position: absolute; left: 50%; bottom: -7px; margin-left: -6px;
  border: 6px solid transparent; border-bottom: 0; border-top-color: rgba(255,110,80,0.7);
}
.tc-overlay .lr-altar-tag[data-tone="info"] { color: #f4e6c4; background: rgba(20,16,12,0.9); border-color: rgba(232,192,106,0.6); }
.tc-overlay .lr-altar-tag[data-tone="info"]::after { border-top-color: rgba(232,192,106,0.6); }

.tc-overlay .lr-altar-hint {
  position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); white-space: nowrap;
  font-size: 19px; color: rgba(232,220,192,0.62); text-shadow: 0 1px 4px #000;
}
.tc-overlay .lr-altar-hint b { color: rgba(232,192,106,0.85); font-weight: 600; }
[data-reduced-motion] .tc-overlay .lr-altar-verdict, [data-reduced-motion] .tc-overlay .lr-altar-tag { animation: none; }

@keyframes lr-altar-pop { from { opacity: 0; transform: translate(-50%, -80%) scale(0.92); } to { opacity: 1; } }
.tc-overlay .lr-altar-verdict { animation-name: lr-altar-drop; }
@keyframes lr-altar-drop { from { opacity: 0; transform: translate(-50%, -14px); } to { opacity: 1; transform: translate(-50%, 0); } }

/* Solve moment: a left column (card, journal page, Continue) so the waking machine and the
   granted gem stay in view; FUSE's caption keeps the bottom-right corner. */
@keyframes lr-solve-in { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: none; } }
.tc-overlay .lr-solve {
  position: absolute; left: 40px; top: 170px; width: 500px; display: flex; flex-direction: column;
  align-items: stretch; gap: 26px; pointer-events: none;
}
.tc-overlay .lr-solve-card {
  padding: 24px 34px 28px; border-radius: 18px; text-align: left;
  background: linear-gradient(180deg, rgba(255,241,181,0.97) 0%, rgba(232,192,106,0.97) 40%, rgba(168,122,44,0.97) 100%);
  border: 3px solid #5a3d12; color: #2a1906; box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 80px rgba(255,214,120,0.4);
  animation: lr-solve-in 600ms var(--tc-easing) both;
}
.tc-overlay .lr-solve-card h2 { margin: 0; font-family: var(--tc-font-display); font-size: 42px; line-height: 1.1; letter-spacing: 1px; }
.tc-overlay .lr-solve-card .lr-solve-sub { margin: 6px 0 0; font-size: 24px; opacity: 0.8; }
.tc-overlay .lr-solve-grant {
  margin: 20px 0 0; display: flex; align-items: center; gap: 16px;
  font-family: var(--tc-font-display); font-size: 36px; animation: lr-solve-in 500ms var(--tc-easing) both;
}
.tc-overlay .lr-solve-grant .lr-gem-dot { flex: none; width: 40px; height: 40px; border-radius: 50%; background: currentColor; box-shadow: 0 0 22px currentColor, inset 0 -6px 10px rgba(0,0,0,0.35); }
.tc-overlay .lr-solve-codex { margin: 8px 0 0; font-size: 22px; font-style: italic; line-height: 1.4; opacity: 0.85; animation: lr-solve-in 500ms var(--tc-easing) both; }
.tc-overlay .lr-solve-opens { margin: 14px 0 0; font-size: 22px; animation: lr-solve-in 500ms var(--tc-easing) both; }
.tc-overlay .lr-solve .lr-page-note { position: relative; left: auto; bottom: auto; width: auto; margin: 0 18px; animation: lr-solve-in 500ms var(--tc-easing) both; }
.tc-overlay .lr-solve [hidden] { display: none; }
.tc-overlay .lr-solve-continue { align-self: flex-start; pointer-events: auto; }
[data-reduced-motion] .tc-overlay .lr-solve * { animation-duration: 1ms; }
`;

let injected: WeakSet<Document> | undefined;

export function ensureAltarStyles(doc: Document = document): void {
  injected ??= new WeakSet();
  if (injected.has(doc)) return;
  injected.add(doc);
  const el = doc.createElement('style');
  el.dataset.lr = 'altar';
  el.textContent = CSS;
  doc.head.append(el);
}
