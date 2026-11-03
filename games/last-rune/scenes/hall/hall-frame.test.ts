import { describe, expect, it } from 'vitest';
import { initialState } from '../../rules/progression';
import {
  HALL_BAND,
  HALL_MIN_ZOOM,
  halfWorldWidth,
  hallFrame,
  IDENTITY_FRAME,
  sameFrame,
  spreadModel,
  toScreen,
  toWorld,
} from './hall-frame';
import { deriveHall } from './hall-state';

describe('hallFrame (mobile-5-chrome phone camera)', () => {
  it('is the identity when the whole design is visible (desktop, iPad)', () => {
    expect(hallFrame({ top: 0, height: 1080 })).toBe(IDENTITY_FRAME);
    expect(hallFrame({ top: 0, height: 1080 }, 80)).toBe(IDENTITY_FRAME);
  });

  it('zooms out to fit the doorway band in a short view, but no further than the floor', () => {
    const f = hallFrame({ top: 200, height: 667 });
    expect(f.zoom).toBeCloseTo(667 / (HALL_BAND.bottom - HALL_BAND.top));
    expect(hallFrame({ top: 300, height: 400 }).zoom).toBe(HALL_MIN_ZOOM);
  });

  it('puts the doorway band inside the visible view', () => {
    const view = { top: 206, height: 667 };
    const f = hallFrame(view);
    const top = toScreen(f, 960, HALL_BAND.top).y;
    const bottom = toScreen(f, 960, HALL_BAND.bottom).y;
    expect(top).toBeGreaterThanOrEqual(view.top - 0.5);
    expect(bottom).toBeLessThanOrEqual(view.top + view.height + 0.5);
  });

  it('round-trips world and screen points', () => {
    const f = hallFrame({ top: 180, height: 720 }, 40);
    const p = toWorld(f, ...(Object.values(toScreen(f, 420, 610)) as [number, number]));
    expect(p.x).toBeCloseTo(420);
    expect(p.y).toBeCloseTo(610);
  });

  it('spreads the doors out to use the wider wall, keeping them on screen past the reserve', () => {
    const reserve = 60;
    const f = hallFrame({ top: 206, height: 667 }, reserve);
    expect(f.spread).toBeGreaterThan(1);
    const model = spreadModel(deriveHall(initialState()), f);
    for (const a of model.alcoves) {
      const x = toScreen(f, a.x, a.y).x;
      expect(x - 100 * f.zoom).toBeGreaterThanOrEqual(reserve - 1);
      expect(x + 100 * f.zoom).toBeLessThanOrEqual(1920 - reserve + 1);
    }
    expect(halfWorldWidth(f)).toBeGreaterThan(960);
  });

  it('leaves the model alone when nothing spreads, and spots frames that draw the same', () => {
    const model = deriveHall(initialState());
    expect(spreadModel(model, IDENTITY_FRAME)).toBe(model);
    const a = hallFrame({ top: 206, height: 667 });
    expect(sameFrame(a, { ...a })).toBe(true);
    expect(sameFrame(a, hallFrame({ top: 206, height: 700 }))).toBe(false);
  });
});
