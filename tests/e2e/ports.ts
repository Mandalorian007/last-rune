/**
 * E2E server ports, shared by playwright.config.ts and the specs.
 *
 * Several worktree agents may run `pnpm test:e2e` at once, and `reuseExistingServer` would
 * silently test whichever build already holds a port. So each checkout gets its own offset:
 * `E2E_PORT_OFFSET` if set, else a stable offset derived from the checkout path for git
 * worktrees under `.claude/worktrees/`, else 0 (the main checkout keeps the documented ports).
 */
import { createHash } from 'node:crypto';

function offset(): number {
  const env = process.env.E2E_PORT_OFFSET;
  if (env !== undefined && env !== '') return Number(env);
  const cwd = process.cwd();
  if (!cwd.includes('/.claude/worktrees/')) return 0;
  const n = createHash('sha1').update(cwd).digest().readUInt16BE(0);
  return 10 + (n % 90) * 10; // 10..900, step 10
}

export const PORT_OFFSET = offset();
export const PREVIEW_PORT = 4173 + PORT_OFFSET;
export const DEV_PORT = 5175 + PORT_OFFSET;

export const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;
export const DEV_URL = `http://127.0.0.1:${DEV_PORT}/`;
/** `pnpm social` (scripts/cover/) serves the social card page here. */
export const COVER_PORT = 6290 + PORT_OFFSET;
