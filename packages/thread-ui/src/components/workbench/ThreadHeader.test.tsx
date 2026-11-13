/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { MatterWorkbenchOptions } from '../MatterWorkbench';
import { ThreadHeader } from './ThreadHeader';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function render(statusDescription?: string) {
  await act(async () => root.render(<ThreadHeader
    header={{ status: 'Idle', tone: 'running', statusDescription }}
    title="Conversation" threadKey="t1" explorerOpen={false} onToggleExplorer={vi.fn()}
    options={{ workspacePath: '/workspace' } as MatterWorkbenchOptions} actions={null}
  />));
  return host.querySelector<HTMLElement>('.matter-thread-lifecycle')!;
}

test('keeps the original lifecycle pill outside the tab order without a description', async () => {
  const pill = await render();
  expect(pill.textContent).toBe('Idle');
  expect(pill.dataset.tone).toBe('running');
  expect(pill.getAttribute('role')).toBe('status');
  expect(pill.hasAttribute('tabindex')).toBe(false);
  expect(pill.hasAttribute('data-state')).toBe(false);
  expect(document.querySelector('[role="tooltip"]')).toBeNull();
});

test('focus describes the unchanged pill through a dismissible accessible tooltip', async () => {
  const pill = await render('This Agent stops after 15 minutes of inactivity.');
  expect(pill.tabIndex).toBe(0);
  expect(pill.dataset.tone).toBe('running');
  await act(async () => pill.focus());
  const descriptionId = pill.getAttribute('aria-describedby');
  expect(descriptionId).toBeTruthy();
  const description = document.getElementById(descriptionId!);
  expect(description?.getAttribute('role')).toBe('tooltip');
  expect(description?.textContent).toBe('This Agent stops after 15 minutes of inactivity.');
  await act(async () => pill.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(pill.hasAttribute('aria-describedby')).toBe(false);
  expect(document.activeElement).toBe(pill);
});
