/** @vitest-environment jsdom */
import { act, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShellNavContext, type AppShellNavContextValue } from '../app-shell/AppShellNavContext';
import { setLocale } from '../i18n';
import { MatterWorkbench, type MatterWorkbenchOptions } from './MatterWorkbench';
import { defaultPresentation } from './workbench/presentation';

let host: HTMLDivElement, root: Root;
const usage = vi.fn();
const download = vi.fn();
const compute = vi.fn();
const thread = (key: string) => ({ key, title: `Thread ${key}`, subtitle: '', href: `/threads/${key}`, status: 'idle', favorite: false });
const base: MatterWorkbenchOptions = {
  hideRail: true, showShortcuts: false, showNotifications: false,
  threads: [thread('a'), thread('b')], currentKey: 'a', favorite: false, workspacePath: '',
  activeView: 'chat', terminalEnabled: false, onViewChange: vi.fn(), onToggleFavorite: vi.fn(),
  onNavigate: vi.fn(), onSearch: vi.fn(), notifications: [], unreadCount: 0, onReadNotifications: vi.fn(),
  threadHeader: { status: 'Running', tone: 'running', onOpenToolUsage: usage },
};
let options: MatterWorkbenchOptions;

function ConversationActions() {
  const [open, setOpen] = useState(false);
  return <>
    <button aria-label="Conversation toolbar" onClick={() => setOpen(true)}>Share conversation</button>
    <button aria-label="Download transcript" onClick={download}>Download</button>
    {open && createPortal(<div role="dialog" aria-label="Conversation actions">Existing conversation dialog</div>, document.body)}
  </>;
}
function Settings() {
  const [open, setOpen] = useState(false);
  return <>
    <button aria-label="Open settings" onClick={() => setOpen(true)}>Settings</button>
    {open && createPortal(<div role="dialog" aria-label="Appearance settings">Existing settings</div>, document.body)}
  </>;
}
function Fixture({ title = '', slot = false, children }: { title?: string; slot?: boolean; children?: ReactNode }) {
  return <div className="thread-ui-shell">
    <AppShellNavContext.Provider value={{ openThreadMap: vi.fn(), phoneDock: true } as unknown as AppShellNavContextValue}>
      <MatterWorkbench options={options} title={title} settings={<Settings />} newThread={null}
        actions={<ConversationActions />} threadMenu={<button aria-label="Compute jobs" onClick={compute}>Compute</button>}
        connection={null} explorer={<p>Existing file explorer</p>} revealExplorer={0}>
        {children ?? <p>Existing conversation</p>}
      </MatterWorkbench>
    </AppShellNavContext.Provider>
    {slot && <div id="chat-appearance-settings" />}
  </div>;
}
const render = (props: Parameters<typeof Fixture>[0] = {}) => act(() => root.render(<Fixture {...props} />));
const header = () => host.querySelector<HTMLElement>('.matter-thread-header')!;
const more = () => header().querySelector<HTMLButtonElement>('[aria-label="More actions"]')!;
const openMenu = () => host.querySelector<HTMLElement>('[role="menu"][data-open]');
const menuItem = (text: string) => [...openMenu()!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(item => item.textContent === text)!;
const key = (value: string) => act(() => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true })));

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  options = { ...base };
  setLocale('en', false);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.clearAllMocks(); vi.useRealTimers(); });

describe('opt-in selected thread header', () => {
  it('sits below tabs, shows the selected title and lifecycle, and replaces tab tools', () => {
    options.settingsPortalTargetId = 'chat-appearance-settings';
    render({ title: 'Grafico · Nov 4, 11:52 PM', slot: true });
    expect(host.querySelector('.matter-tabs-row')!.nextElementSibling).toBe(header());
    expect(header().querySelector('h1')?.textContent).toBe('Grafico · Nov 4, 11:52 PM');
    expect(header().querySelector('[role="status"]')?.textContent).toBe('Running');
    expect(header().querySelector('[role="status"]')?.getAttribute('data-tone')).toBe('running');
    expect(header().querySelector('button[aria-label="Files"]')?.textContent).toBe('Files');
    expect(more().querySelector('svg')?.classList.contains('lucide-ellipsis')).toBe(true);
    expect(host.querySelector('.matter-toolbar-toggle, [data-icon="thread-tools"]')).toBeNull();
    expect(host.querySelector('.matter-tabs-row [data-icon="explorer"], .matter-tabs-row [data-icon="settings"], .matter-tabs-row [data-icon="thread-map"]')).toBeNull();
    expect(host.querySelectorAll('[aria-label="Files"]')).toHaveLength(1);
    expect(host.querySelectorAll('[aria-label="Open settings"]')).toHaveLength(1);
  });

  it('updates the selected title and closes menus on thread selection', () => {
    render();
    expect(header().querySelector('h1')?.textContent).toBe('Thread a');
    act(() => more().click());
    options = { ...options, currentKey: 'b' }; render();
    expect(header().querySelector('h1')?.textContent).toBe('Thread b');
    expect(openMenu()).toBeNull();
    render({ title: 'Renamed selected conversation' });
    expect(header().querySelector('h1')?.textContent).toBe('Renamed selected conversation');
  });

  it('gives kept-alive and split workbenches independent menu ids', () => {
    act(() => root.render(<><Fixture /><Fixture title="Other pane" /></>));
    const triggers = [...host.querySelectorAll<HTMLButtonElement>('.matter-thread-header [aria-haspopup="menu"]')];
    expect(triggers).toHaveLength(2);
    expect(new Set(triggers.map(trigger => trigger.getAttribute('aria-controls'))).size).toBe(2);
    for (const trigger of triggers) {
      act(() => trigger.click());
      expect(document.getElementById(trigger.getAttribute('aria-controls')!)?.hasAttribute('data-open')).toBe(true);
      key('Escape'); expect(document.activeElement).toBe(trigger);
    }
    expect(host.querySelectorAll('[aria-label="Open settings"]')).toHaveLength(0);
  });

  it.each(['stopped', 'failed', 'pending'] as const)('keeps %s controls visible and disabled in an empty workspace', tone => {
    options = { ...options, emptyWorkspace: true, threadHeader: { status: tone, tone } };
    render();
    expect(header().querySelector('[role="status"]')?.getAttribute('data-tone')).toBe(tone);
    const controls = [...header().querySelectorAll<HTMLButtonElement>('.matter-thread-header-actions > button')];
    expect(controls).toHaveLength(2);
    expect(controls.every(button => button.disabled)).toBe(true);
    act(() => controls.forEach(button => button.click()));
    expect(openMenu()).toBeNull();
    expect(host.querySelector('.matter-explorer')).toBeNull();
    expect(usage).not.toHaveBeenCalled();
  });

  it('disables live controls when disconnected and closes an already open menu', () => {
    render(); act(() => more().click());
    expect(openMenu()).not.toBeNull();
    options = { ...options, threadHeader: { ...base.threadHeader!, toolsDisabled: true } }; render();
    expect(more().disabled).toBe(true);
    expect(openMenu()).toBeNull();
  });

  it('toggles the existing explorer and uses the existing split presentation callback', () => {
    render();
    act(() => header().querySelector<HTMLButtonElement>('[aria-label="Files"]')!.click());
    expect(host.querySelector('.matter-explorer')).not.toBeNull();
    expect(host.querySelector('.matter-explorer-heading')).toBeNull();
    expect(host.querySelector('[aria-label="Close Explorer"]')).toBeNull();
    act(() => header().querySelector<HTMLButtonElement>('[aria-label="Files"]')!.click());
    expect(host.querySelector('.matter-explorer')).toBeNull();
    const onPresentationChange = vi.fn();
    options = { ...options, panels: {
      deviceLabel: '', workspaceLabel: '', primaryTitle: 'Thread a', primaryStatus: 'idle', primaryHarness: '',
      presentation: { ...defaultPresentation, mode: 'thread', referenceId: 'b' }, candidates: [], onMakePrimary: vi.fn(), onPresentationChange,
    } };
    render();
    act(() => header().querySelector<HTMLButtonElement>('[aria-label="Files"]')!.click());
    expect(onPresentationChange).toHaveBeenLastCalledWith({ mode: 'files' });
    options = { ...options, panels: { ...options.panels!, presentation: { ...options.panels!.presentation, mode: 'files' } } }; render();
    expect(header().querySelector('[aria-label="Files"]')?.getAttribute('aria-pressed')).toBe('true');
    act(() => header().querySelector<HTMLButtonElement>('[aria-label="Files"]')!.click());
    expect(onPresentationChange).toHaveBeenLastCalledWith({ mode: 'thread' });
  });

  it('offers exactly two keyboard-operable entries, calls Tool Usage, and restores focus on Escape', () => {
    render(); act(() => more().focus()); key('ArrowDown');
    expect([...openMenu()!.querySelectorAll('[role="menuitem"]')].map(item => item.textContent)).toEqual(['Save & export', 'Tool Usage']);
    expect(document.activeElement?.textContent).toBe('Save & export');
    key('ArrowDown'); expect(document.activeElement?.textContent).toBe('Tool Usage');
    key('ArrowDown'); expect(document.activeElement?.textContent).toBe('Save & export');
    key('End'); expect(document.activeElement?.textContent).toBe('Tool Usage');
    key('Escape'); expect(openMenu()).toBeNull(); expect(document.activeElement).toBe(more());
    act(() => more().click()); act(() => menuItem('Tool Usage').click());
    expect(usage).toHaveBeenCalledOnce(); expect(openMenu()).toBeNull();
  });

  it('closes on outside press and Tab', () => {
    render(); act(() => more().click());
    act(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(openMenu()).toBeNull();
    act(() => more().click()); key('Tab'); expect(openMenu()).toBeNull();
  });

  it('opens the original export dialog directly when the host provides its callback', () => {
    const onSaveExport = vi.fn();
    options = { ...options, threadHeader: { ...base.threadHeader!, onSaveExport } };
    render(); act(() => more().click()); act(() => menuItem('Save & export').click());
    expect(onSaveExport).toHaveBeenCalledOnce();
    expect(openMenu()).toBeNull();
    // Existing host controls remain mounted for their own dialogs and panels.
    expect(host.querySelector('[aria-label="Compute jobs"]')).not.toBeNull();
  });

  it('opens existing conversation and compute actions from Save & export without unmounting their dialogs', () => {
    options = { ...options, statusActions: <button aria-label="Host panel">Panel</button> };
    render(); act(() => more().click());
    act(() => menuItem('Save & export').click());
    expect(openMenu()!.querySelector('[aria-label="Conversation toolbar"]')).not.toBeNull();
    expect(openMenu()!.querySelector('[aria-label="Compute jobs"]')).not.toBeNull();
    expect(openMenu()!.querySelector('[aria-label="Host panel"]')).not.toBeNull();
    vi.useFakeTimers();
    act(() => openMenu()!.querySelector<HTMLButtonElement>('[aria-label="Conversation toolbar"]')!.click());
    act(() => vi.runAllTimers());
    expect(openMenu()).toBeNull();
    expect(document.querySelector('[role="dialog"][aria-label="Conversation actions"]')?.textContent).toBe('Existing conversation dialog');
    act(() => more().click()); act(() => menuItem('Save & export').click());
    act(() => openMenu()!.querySelector<HTMLButtonElement>('[aria-label="Compute jobs"]')!.click());
    expect(compute).toHaveBeenCalledOnce();
  });

  it('supports a phone dock without duplicating host actions, and disables its Files shortcut while stopped', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    options = { ...options, emptyWorkspace: true, threadHeader: { status: 'Stopped', tone: 'stopped' } }; render();
    expect(header()).not.toBeNull(); expect(host.querySelector('.matter-phone-dock')).not.toBeNull();
    expect(host.querySelector<HTMLButtonElement>('.matter-phone-dock [aria-label="Toggle Explorer"]')?.disabled).toBe(true);
    expect(host.querySelectorAll('[aria-label="Conversation toolbar"]')).toHaveLength(1);
    expect(host.querySelector('[aria-label="Open settings"]')).toBeNull();
  });
});

describe('single desktop header', () => {
  beforeEach(() => { options = { ...base, workspaceThreads: base.threads, threadHeader: { ...base.threadHeader!, status: 'Idle', singleRow: true } }; });

  it('renders one 44px row with the full selected title, status and existing tools, while keeping sidebar conversations', () => {
    render({ title: 'Estructural 2026-11-12 08:41 EST' });
    expect(host.querySelector('.matter-tabs-row, .matter-thread-tabs')).toBeNull();
    expect(host.querySelectorAll('.matter-main > header')).toHaveLength(1);
    expect(header().style.height).toBe('44px');
    expect(header().style.flexWrap).toBe('nowrap');
    expect(header().querySelector('h1')?.textContent).toBe('Estructural 2026-11-12 08:41 EST');
    expect(header().querySelector('[role="status"]')?.textContent).toBe('Idle');
    const sidebar = host.querySelector('.matter-sidebar')!;
    expect(sidebar.querySelector('a[href="/threads/a"]')).not.toBeNull();
    const other = sidebar.querySelector<HTMLAnchorElement>('a[href="/threads/b"]')!;
    act(() => other.click()); expect(base.onNavigate).toHaveBeenCalled();
    act(() => header().querySelector<HTMLButtonElement>('[aria-label="Files"]')!.click());
    expect(host.querySelector('.matter-explorer')).not.toBeNull();
    act(() => more().click()); act(() => menuItem('Tool Usage').click());
    expect(usage).toHaveBeenCalledOnce();
  });

  it('moves the sidebar toggle and history navigation into the same row when collapsed and restores the sidebar', () => {
    render();
    act(() => host.querySelector<SVGElement>('.matter-sidebar [data-icon="sidebar"]')!.closest('button')!.click());
    expect(host.querySelector('.matter-workbench')?.classList.contains('is-sidebar-hidden')).toBe(true);
    const toggle = header().querySelector<SVGElement>('[data-icon="sidebar"]')!.closest('button')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBeTruthy();
    const back = vi.spyOn(history, 'back').mockImplementation(() => {});
    const forward = vi.spyOn(history, 'forward').mockImplementation(() => {});
    act(() => header().querySelector<SVGElement>('[data-icon="back"]')!.closest('button')!.click());
    act(() => header().querySelector<SVGElement>('[data-icon="forward"]')!.closest('button')!.click());
    expect(back).toHaveBeenCalledOnce(); expect(forward).toHaveBeenCalledOnce();
    act(() => toggle.click());
    expect(host.querySelector('.matter-workbench')?.classList.contains('is-sidebar-hidden')).toBe(false);
    expect(header().querySelector('[data-icon="sidebar"]')).toBeNull();
    back.mockRestore(); forward.mockRestore();
  });

  it('retains the search button and Ctrl/Cmd+F without a tab row', () => {
    render();
    const search = header().querySelector<HTMLButtonElement>('.matter-search-trigger')!;
    expect(search.getAttribute('aria-label')).toBe('Search conversation');
    act(() => search.click()); expect(base.onSearch).toHaveBeenCalledOnce();
    for (const modifier of ['ctrlKey', 'metaKey']) {
      const event = new KeyboardEvent('keydown', { key: 'f', [modifier]: true, bubbles: true, cancelable: true });
      act(() => window.dispatchEvent(event)); expect(event.defaultPrevented).toBe(true);
    }
    expect(base.onSearch).toHaveBeenCalledTimes(3);
  });

  it('mounts the existing host search once in the summary, preserves its state and focuses/selects its input on Ctrl+F', () => {
    function SearchSlot() {
      const [value, setValue] = useState('molecule');
      return <div className="workbench-search is-open"><input aria-label="Find in conversation" value={value} onChange={e => setValue(e.target.value)} /><button aria-label="Close search" onClick={() => { options = { ...options, searchOpen: false, search: undefined }; render(); }}>Close</button></div>;
    }
    options = { ...options, searchOpen: true, search: <SearchSlot /> }; render();
    const field = header().querySelector<HTMLInputElement>('input')!;
    expect(host.querySelectorAll('.workbench-search')).toHaveLength(1);
    expect(field.closest('.matter-thread-header-summary')).not.toBeNull();
    render({ title: 'Updated title' }); expect(header().querySelector('input')).toBe(field);
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true })));
    expect(document.activeElement).toBe(field);
    expect(field.selectionStart).toBe(0); expect(field.selectionEnd).toBe('molecule'.length);
    expect(base.onSearch).not.toHaveBeenCalled();
    act(() => header().querySelector<HTMLButtonElement>('[aria-label="Close search"]')!.click());
    expect(header().querySelector('input')).toBeNull();
    expect(header().querySelector('h1')?.textContent).toBe('Thread a');
    expect(header().querySelector('.matter-search-trigger')).not.toBeNull();
  });

  it('omits desktop header and tabs in an empty workspace while leaving sidebar navigation available', () => {
    options = { ...options, emptyWorkspace: true }; render();
    expect(host.querySelector('.matter-tabs-row, .matter-thread-header')).toBeNull();
    expect(host.querySelector('.matter-sidebar [data-icon="sidebar"]')).not.toBeNull();
  });

  it('keeps the phone header, dock and conversations sheet accessible', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    render();
    expect(header().hasAttribute('data-single-row')).toBe(false);
    expect(header().style.height).toBe('');
    expect(host.querySelector('.matter-phone-dock')).not.toBeNull();
    const threads = host.querySelector<HTMLButtonElement>('.matter-phone-thread');
    expect(threads).not.toBeNull();
    act(() => threads!.click());
    expect(host.querySelector('.matter-phone-sheet a[href="/threads/a"]')).not.toBeNull();
  });
});

describe('global settings portal', () => {
  it('finds a host slot rendered after the workbench on initial mount and opens existing settings', () => {
    options.settingsPortalTargetId = 'chat-appearance-settings'; render({ slot: true });
    const trigger = host.querySelector<HTMLButtonElement>('#chat-appearance-settings [aria-label="Open settings"]');
    expect(trigger).not.toBeNull(); expect(host.querySelectorAll('[aria-label="Open settings"]')).toHaveLength(1);
    act(() => trigger!.click());
    expect(document.querySelector('[role="dialog"][aria-label="Appearance settings"]')?.textContent).toBe('Existing settings');
    options = { ...options, settingsPortalTargetId: undefined }; render({ slot: true });
    expect(host.querySelector('[aria-label="Open settings"]')).toBeNull();
  });

  it('waits for a late slot without rendering duplicate local settings', async () => {
    options.settingsPortalTargetId = 'late-settings'; render();
    expect(host.querySelector('[aria-label="Open settings"]')).toBeNull();
    const slot = document.createElement('div'); slot.id = 'late-settings'; host.append(slot);
    await act(async () => { await Promise.resolve(); });
    expect(slot.querySelector('[aria-label="Open settings"]')).not.toBeNull();
  });

  it('retains legacy tab controls and settings when the header is not enabled', () => {
    options = { ...options, threadHeader: undefined }; render();
    expect(host.querySelector('.matter-thread-header')).toBeNull();
    expect(host.querySelector('.matter-toolbar-toggle')).not.toBeNull();
    expect(host.querySelector('.matter-tabs-end [aria-label="Toggle Explorer"]')).not.toBeNull();
    expect(host.querySelector('.matter-tabs-end [aria-label="Thread map"]')).not.toBeNull();
    expect(host.querySelector('.matter-tabs-end [aria-label="Open settings"]')).not.toBeNull();
  });
});
