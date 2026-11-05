/**
 * @vitest-environment jsdom
 */
import { act, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ThreadDto } from '@remote-codex/shared';

import { ThreadWorkspaceLayout } from './ThreadWorkspaceLayout';
import type { MatterWorkbenchOptions } from './MatterWorkbench';

// ElAgente host adaptations of the upstream workbench: an outer platform rail,
// an Agent switcher above the thread list, and rename/delete through the layout.
let root: Root | null = null;
let container: HTMLDivElement | null = null;

const workbench: MatterWorkbenchOptions = {
  brandName: 'ElAgente', hideRail: true, showShortcuts: false, showNotifications: false,
  threads: [{ key: 't1', title: 'Benzene', subtitle: 'Grafico', href: '/chat?thread=t1', status: 'idle', favorite: false }],
  currentKey: 't1',
  workspaceThreads: [{ key: 't1', title: 'Benzene', subtitle: 'Grafico', href: '/chat?thread=t1', status: 'idle', favorite: false }], favorite: false, workspacePath: 'Grafico', activeView: 'chat', terminalEnabled: false,
  onViewChange: () => {}, onToggleFavorite: () => {}, onNavigate: () => {}, onSearch: () => {},
  notifications: [], unreadCount: 0, onReadNotifications: () => {},
};
const thread = { id: 't1', title: 'Benzene' } as ThreadDto;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn((query: string) => ({
    matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(), onchange: null,
  })) });
});
afterEach(() => { act(() => root?.unmount()); container?.remove(); root = null; container = null; });

function render(onDelete = vi.fn(), actions?: ReactNode, options: Partial<MatterWorkbenchOptions> = {}, newThreadLabel?: string) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  flushSync(() => root!.render(
    <ThreadWorkspaceLayout workbench={{ ...workbench, ...options }} {...(newThreadLabel ? { newThreadLabel } : {})} threads={[thread]} currentThreadId="t1"
      renderNavigationHeader={({ collapsed }) => <nav aria-label="Agents" data-collapsed={collapsed}>Grafico</nav>}
      settingsSections={[{ id: 'preferences', label: 'Preferences', content: <p>Preferences</p> }]}
      {...(actions ? { threadActionsButton: actions } : {})}
      onRenameThread={vi.fn()} onDeleteThread={onDelete}>
      <div />
    </ThreadWorkspaceLayout>,
  ));
  return container;
}

describe('ThreadWorkspaceLayout host adaptations', () => {
  it('portals the existing SettingsDialog into a sibling host rail slot on initial mount', async () => {
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    act(() => root!.render(<>
      <ThreadWorkspaceLayout workbench={{ ...workbench, emptyWorkspace: true,
        threadHeader: { status: 'Stopped', tone: 'stopped', toolsDisabled: true },
        settingsPortalTargetId: 'chat-appearance-settings',
      }} threads={[thread]} currentThreadId="t1" currentThreadLabel="Selected Benzene"
        settingsSections={[{ id: 'preferences', label: 'Preferences', content: <p>Existing appearance preferences</p> }]}>
        <p>Start the Agent to continue</p>
      </ThreadWorkspaceLayout>
      <div id="chat-appearance-settings" />
    </>));
    expect(container.querySelector('.matter-thread-header-title')?.textContent).toBe('Selected Benzene');
    expect(container.querySelectorAll('[aria-label="Open settings"]')).toHaveLength(1);
    const trigger = container.querySelector<HTMLButtonElement>('#chat-appearance-settings [aria-label="Open settings"]');
    expect(trigger).not.toBeNull();
    await act(async () => trigger!.click());
    expect(document.querySelector('[data-testid="settings-dialog"]')?.getAttribute('role')).toBe('dialog');
    expect(document.querySelector('[data-testid="settings-dialog"]')?.textContent).toContain('Existing appearance preferences');
  });

  it('drops its own rail for the host rail and keeps upstream tabs, tools and settings', () => {
    const view = render();
    expect(view.querySelector('.matter-workbench.has-host-rail')).toBeTruthy();
    expect(view.querySelector('.matter-rail')).toBeNull();
    expect(view.querySelector('.matter-tabs-end [aria-label="Open settings"]')).toBeTruthy();
    expect(view.querySelector('.matter-tabs-end [aria-label="Toggle Explorer"], .matter-tabs-end [data-icon="explorer"]')).toBeTruthy();
    // No host actions, path or shortcuts: no empty Thread tools menu.
    expect(view.querySelector('.matter-toolbar-toggle')).toBeNull();
    expect(view.textContent).not.toContain('Shortcuts');
  });

  it('shows Thread tools when the host has a real action', () => {
    const view = render(vi.fn(), <button type="button" aria-label="Tool Usage">t</button>);
    expect(view.querySelector('.matter-toolbar-toggle')).toBeTruthy();
  });

  it('shows the host Agent switcher in the sidebar', () => {
    const view = render();
    const nav = view.querySelector('.matter-sidebar nav[aria-label="Agents"]');
    expect(nav?.textContent).toBe('Grafico');
    expect(nav?.getAttribute('data-collapsed')).toBe('false');
  });

  it('names the conversation section and New Chat after the host scope (B09/B10)', () => {
    const scoped = render(vi.fn(), undefined, { workspaceSectionLabel: 'Grafico conversations' }, 'New Grafico conversation');
    const heading = scoped.querySelector('.matter-section-heading-row .matter-section-heading');
    expect(heading?.textContent).toContain('Grafico conversations');
    expect(scoped.querySelector('.matter-section-add [aria-label="New Grafico conversation"]')).toBeTruthy();
    act(() => root?.unmount()); container?.remove();
    const plain = render();
    expect(plain.querySelector('.matter-section-heading-row .matter-section-heading')?.textContent).toContain('This workspace');
  });

  it("opens the upstream thread menu and deletes through the host", async () => {
    const onDelete = vi.fn();
    const view = render(onDelete);
    const trigger = view.querySelector<HTMLButtonElement>('.recent-thread-actions');
    expect(trigger?.getAttribute('aria-label')).toBe('Actions for Benzene');
    await act(async () => trigger!.click());
    const menu = document.querySelector('.recent-thread-menu');
    expect(menu?.textContent).toContain('Rename thread');
    await act(async () => [...menu!.querySelectorAll('button')].find(b => b.textContent?.includes('Delete thread'))!.click());
    expect(onDelete).toHaveBeenCalledWith(thread);
  });
});
