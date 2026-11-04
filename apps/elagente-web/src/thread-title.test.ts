import { describe, expect, it } from 'vitest';
import { defaultThreadTitle } from './thread-title';

describe('defaultThreadTitle', () => {
  it('includes the agent name, short date and time', () => {
    const date = new Date('2026-11-04T18:16:00Z');
    expect(defaultThreadTitle('Grafico', date, 'en-US', 'America/Toronto')).toBe('Grafico · Nov 4, 1:16 PM');
  });
});
