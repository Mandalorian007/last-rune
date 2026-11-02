import { describe } from 'vitest';
import { MACHINE_IDS } from '../../rules/types';
import { solverChecks } from './solver-checks';

// The finale has its own file so the suite runs it in parallel with this one.
const ids = MACHINE_IDS.filter((id) => id !== 'the-last-rune');

describe.each(ids)('%s (solver)', (id) => {
  solverChecks(id);
});
