import { describe, expect, it } from 'vitest';
import { codexPages } from './codex-data';

const byGem = (pages: ReturnType<typeof codexPages>) =>
  Object.fromEntries(pages.map((p) => [p.gem, p]));

describe('codex pages', () => {
  it('start with only Channel readable', () => {
    const p = byGem(codexPages({ solved: [] }, []));
    expect(p.channel.status).toBe('yours');
    expect(p.channel.unlocked).toBe(true);
    expect(p.channel.fresh).toBe(false);
    for (const g of ['bend', 'split', 'amplify', 'gate', 'capacitor']) {
      expect(p[g].status, g).toBe('unknown');
      expect(p[g].unlocked, g).toBe(false);
      expect(p[g].fresh, g).toBe(false);
    }
  });

  it('open a page when the gem is met, before it is earned', () => {
    const p = byGem(codexPages({ solved: [] }, [], ['bend', 'amplify']));
    expect(p.bend.status).toBe('seen');
    expect(p.bend.unlocked).toBe(true);
    expect(p.bend.fresh).toBe(true);
    expect(p.amplify.status).toBe('seen');
    expect(p.split.status).toBe('unknown');
  });

  it('mark earned gems as yours, met or not', () => {
    const p = byGem(codexPages({ solved: ['intake-desk'] }, ['bend'], []));
    expect(p.bend.status).toBe('yours');
    expect(p.bend.fresh).toBe(false);
  });
});
