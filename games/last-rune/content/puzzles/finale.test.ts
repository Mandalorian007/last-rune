import { describe } from 'vitest';
import { solverChecks } from './solver-checks';

// Split from solve.test.ts so the finale's searches run in parallel with the rest.
describe('the-last-rune (solver)', () => {
  solverChecks('the-last-rune');
});
