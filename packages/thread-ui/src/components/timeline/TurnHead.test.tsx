/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getLocale } from '../../i18n';
import { TurnHead } from './TurnHead';

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 28, 12));
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('shows dates on first render for same-time turns across days and years', () => {
  const dates = [new Date(2026, 9, 28, 10, 41), new Date(2026, 9, 27, 10, 41), new Date(2025, 11, 31, 10, 41)];
  act(() => root.render(<>{dates.map((date, index) => <TurnHead key={index} added={0} active={false}
    turn={{ id: String(index), status: 'completed', startedAt: date.toISOString(), completedAt: date.toISOString(), items: [], error: null } as never} />)}</>));
  const buttons = [...host.querySelectorAll<HTMLButtonElement>('.thread-turn-head-time')];
  expect(buttons).toHaveLength(3);
  expect(new Set(buttons.map(button => button.textContent)).size).toBe(3);
  buttons.forEach((button, index) => {
    const date = dates[index]!;
    expect(button.textContent).toBe(date.toLocaleString(getLocale(), {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      ...(date.getFullYear() !== 2026 ? { year: 'numeric' } : {}),
    }));
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.title).toBe(date.toLocaleString(getLocale(), {
      year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
    }));
    expect(button.querySelector('time')?.dateTime).toBe(date.toISOString());
  });
  act(() => buttons[0]!.click());
  expect(buttons[0]!.textContent).toBe(dates[0]!.toLocaleTimeString(getLocale(), { hour: 'numeric', minute: '2-digit' }));
  act(() => buttons[0]!.click());
  expect(buttons[0]!.getAttribute('aria-pressed')).toBe('true');
});
