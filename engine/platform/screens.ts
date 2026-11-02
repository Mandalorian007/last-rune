/**
 * Full-screen DOM message screens for fatal states (no WebGPU, device lost).
 * Styled dark slate + gold. Text is generic; the game passes its own title.
 */

export interface MessageScreenAction {
  label: string;
  onClick: () => void;
}

export interface MessageScreenOptions {
  /** Small caps line above the heading (e.g. the game's name). */
  eyebrow?: string;
  heading: string;
  /** Paragraphs of body text. */
  body: string[];
  actions?: MessageScreenAction[];
}

const STYLE_ID = 'engine-message-screen-style';
const CSS = `
.engine-msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(ellipse at 50% 40%,#1c2130 0%,#0b0d14 70%);z-index:1000;
  font-family:Georgia,'Iowan Old Style','Palatino Linotype',serif;color:#d9d3c3;padding:24px;box-sizing:border-box}
.engine-msg__card{max-width:560px;width:100%;padding:36px 40px;border:1px solid #a8863a;border-radius:10px;
  background:linear-gradient(180deg,#191d29,#12151f);box-shadow:0 0 0 4px #0b0d14,0 0 0 5px #5a4a24,0 20px 60px #000a}
.engine-msg__eyebrow{letter-spacing:.25em;text-transform:uppercase;font-size:12px;color:#a8863a;margin:0 0 10px}
.engine-msg__heading{font-size:28px;line-height:1.2;margin:0 0 16px;color:#f0cf74;
  text-shadow:0 2px 0 #4b2a6b,0 0 18px #f0cf7433}
.engine-msg__body{font-size:16px;line-height:1.55;margin:0 0 12px}
.engine-msg__actions{margin-top:22px;display:flex;gap:12px}
.engine-msg__btn{font:inherit;font-size:16px;padding:10px 22px;border-radius:6px;cursor:pointer;
  color:#1a1408;background:linear-gradient(180deg,#f5d77f,#c99a2e);border:1px solid #7a5c1a}
.engine-msg__btn:focus-visible{outline:2px solid #f0cf74;outline-offset:3px}
`;

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}

/** Show a modal message screen over `root`. Returns a function that removes it. */
export function showMessageScreen(root: HTMLElement, opts: MessageScreenOptions): () => void {
  ensureStyle();
  const wrap = document.createElement('div');
  wrap.className = 'engine-msg';
  wrap.setAttribute('role', 'alertdialog');
  wrap.setAttribute('aria-live', 'assertive');
  const card = document.createElement('div');
  card.className = 'engine-msg__card';
  if (opts.eyebrow) {
    const e = document.createElement('p');
    e.className = 'engine-msg__eyebrow';
    e.textContent = opts.eyebrow;
    card.appendChild(e);
  }
  const h = document.createElement('h1');
  h.className = 'engine-msg__heading';
  h.textContent = opts.heading;
  card.appendChild(h);
  for (const para of opts.body) {
    const p = document.createElement('p');
    p.className = 'engine-msg__body';
    p.textContent = para;
    card.appendChild(p);
  }
  if (opts.actions?.length) {
    const row = document.createElement('div');
    row.className = 'engine-msg__actions';
    for (const a of opts.actions) {
      const b = document.createElement('button');
      b.className = 'engine-msg__btn';
      b.type = 'button';
      b.textContent = a.label;
      b.addEventListener('click', a.onClick);
      row.appendChild(b);
    }
    card.appendChild(row);
  }
  wrap.appendChild(card);
  root.appendChild(wrap);
  wrap.querySelector('button')?.focus();
  return () => wrap.remove();
}

/** "Your browser can't run this" screen, naming browsers that ship WebGPU. */
export function showUnsupportedScreen(
  root: HTMLElement,
  opts: { title?: string; detail?: string } = {},
): () => void {
  const body = [
    'This game draws with WebGPU, and this browser (or this device) did not give us access to it.',
    'Try the latest Chrome or Edge on desktop, or Safari 26 or newer on macOS / iOS. On Linux, Chrome may need hardware acceleration enabled.',
  ];
  if (opts.detail) body.push(`Details: ${opts.detail}`);
  return showMessageScreen(root, { eyebrow: opts.title, heading: 'WebGPU is not available', body });
}

/** GPU device lost: offer a reload. */
export function showDeviceLostScreen(
  root: HTMLElement,
  opts: { title?: string; detail?: string; onReload?: () => void } = {},
): () => void {
  const body = ['The graphics device stopped responding. Your progress is saved locally.'];
  if (opts.detail) body.push(`Details: ${opts.detail}`);
  return showMessageScreen(root, {
    eyebrow: opts.title,
    heading: 'The lights went out',
    body,
    actions: [{ label: 'Reload', onClick: opts.onReload ?? (() => location.reload()) }],
  });
}
