// @vitest-environment jsdom

import { setLocale } from '../../i18n';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ThreadDetailDto } from '@remote-codex/shared';
import type {
  ThreadWorkspaceAdapter,
  ThreadWorkspaceFilePreview,
  ThreadWorkspaceTreeNode,
} from '../../adapters';
import { createDefaultPluginContextValue } from '../../plugins/plugin-context';
import { GraphWorkspaceExplorer } from './GraphWorkspaceExplorer';

vi.mock('./GraphWorkspacePreviewPane', () => ({
  graphWorkspacePreviewTargetFromNode: (
    node: { kind: string; path: string } | null,
  ) => (node ? { kind: node.kind, node } : null),
  GraphWorkspacePreviewPane: ({
    focusLine,
    breadcrumbNode,
    mobileNavigation,
    onCollapse,
    onExpandExplorer,
    onShowTree,
    pdfUrl,
    previewFile,
    downloadOnly,
    downloadReason,
    error,
    missingPath,
  }: {
    breadcrumbNode?: { path: string; kind: string } | null;
    error?: string | null;
    missingPath?: string | null;
    downloadOnly?: boolean;
    downloadReason?: string | null;
    pdfUrl?: string | null;
    focusLine?: number | null;
    mobileNavigation?: boolean;
    onCollapse?: () => void;
    onShowTree?: (path?: string) => void;
    onExpandExplorer?: () => void;
    previewFile?: ThreadWorkspaceFilePreview | null;
  }) => (
    <div data-testid="preview-file" data-breadcrumb-path={breadcrumbNode?.path} data-focus-line={focusLine ?? undefined} data-pdf-url={pdfUrl ?? undefined}
      data-download-only={downloadOnly ? 'true' : undefined} data-download-reason={downloadReason ?? undefined}
      data-missing-path={missingPath ?? undefined} data-error={error ?? undefined}>
      {previewFile?.path ?? 'none'}
      {onShowTree && <button type="button" aria-label="Event parent breadcrumb" onClick={() => onShowTree('thread-events:/turn-1')} />}
      {onCollapse ? (
        <button type="button" aria-label="Hide Editor" onClick={onCollapse} />
      ) : null}
      {onExpandExplorer ? (
        <button
          type="button"
          aria-label={mobileNavigation ? "Back to files" : "Show Explorer"}
          onClick={onExpandExplorer}
        />
      ) : null}
    </div>
  ),
}));

vi.mock('./GraphResizablePanels', () => ({
  ResizablePanelGroup: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  ResizablePanel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  ResizableHandle: () => <div role="separator" />,
}));

const detail = {
  thread: {
    id: 'thread-1',
    workspaceId: 'workspace-1',
    activeTurnId: null,
    status: 'idle',
  },
  workspace: {
    id: 'workspace-1',
    label: 'Demo workspace',
    absPath: '/workspace/demo',
  },
  turns: [],
  liveItems: null,
} as unknown as ThreadDetailDto;

function directory(
  path: string,
  children: ThreadWorkspaceTreeNode[] = [],
  childrenLoaded = true,
): ThreadWorkspaceTreeNode {
  return {
    name: path.split('/').at(-1) || 'Demo workspace',
    path,
    kind: 'directory',
    children,
    childrenLoaded,
    hasChildren: children.length > 0 || !childrenLoaded,
  };
}

function file(path: string): ThreadWorkspaceTreeNode {
  return {
    name: path.split('/').at(-1) ?? path,
    path,
    kind: 'file',
    size: 18,
  };
}

function filePreview(path: string): ThreadWorkspaceFilePreview {
  return {
    path,
    name: path.split('/').at(-1) ?? path,
    content: `content:${path}`,
    language: 'typescript',
    size: 18,
    truncated: false,
    nextOffset: 18,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function createAdapter() {
  const rootTree = directory('', [
    directory('src', [], false),
    file('README.md'),
  ]);
  const srcTree = directory('src', [file('src/index.ts')]);
  const listTree = vi.fn<ThreadWorkspaceAdapter['listTree']>(
    async ({ path }) => (path === 'src' ? srcTree : rootTree),
  );
  const readFile = vi.fn<ThreadWorkspaceAdapter['readFile']>(async ({ path }) =>
    filePreview(path),
  );
  return {
    adapter: { listTree, readFile } satisfies ThreadWorkspaceAdapter,
    listTree,
    readFile,
  };
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;
let mobileViewport = false;

async function renderExplorer(
  adapter: ThreadWorkspaceAdapter,
  focusPathRequest?: { path: string; line?: number; requestId: number } | null,
) {
  await act(async () => {
    root?.render(
      <GraphWorkspaceExplorer
        activeView="chat"
        detail={detail}
        artifacts={[]}
        plugins={createDefaultPluginContextValue()}
        status={null}
        workspaceAdapter={adapter}
        focusPathRequest={focusPathRequest}
      />,
    );
  });
}

function buttonNamed(name: string) {
  return [...(host?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find(
    (button) => button.textContent?.trim() === name,
  );
}

describe('GraphWorkspaceExplorer', () => {
  beforeEach(() => {
    setLocale('en', false);
    mobileViewport = false;
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: mobileViewport,
        media: '(max-width: 639px)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    window.requestAnimationFrame = vi.fn((callback) => {
      callback(0);
      return 1;
    });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    root = null;
    host?.remove();
    host = null;
    setLocale('en', false);
    window.localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('offers Show hidden files only when the host can list them, and relists root and open folders with showHidden', async () => {
    const { adapter, listTree } = createAdapter();
    await renderExplorer(adapter);
    await vi.waitFor(() => expect(listTree).toHaveBeenCalled());
    const more = () => host?.querySelector<HTMLButtonElement>('button[aria-label="More Explorer actions"]');
    // Without the host capability there is no hidden-files toggle; only the thread-events debug view.
    act(() => more()!.click());
    expect([...host!.querySelectorAll('[role="menuitemcheckbox"]')].map((item) => item.textContent)).toEqual(['Show thread events (debug)']);
    act(() => more()!.click());

    act(() => root?.unmount());
    root = createRoot(host!);
    listTree.mockClear();
    await renderExplorer({ ...adapter, hiddenFiles: true }, { path: 'src/index.ts', requestId: 1 });
    await vi.waitFor(() => expect(listTree.mock.calls.some(([input]) => input.path === 'src')).toBe(true));
    expect(listTree.mock.calls.every(([input]) => input.showHidden === undefined)).toBe(true);

    listTree.mockClear();
    act(() => more()!.click());
    const toggle = host!.querySelector<HTMLButtonElement>('[role="menuitemcheckbox"]')!;
    expect(toggle.textContent).toContain('Show hidden files');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    await act(async () => toggle.click());
    await vi.waitFor(() => {
      expect(listTree.mock.calls.some(([input]) => input.path === '' && input.showHidden === true)).toBe(true);
      expect(listTree.mock.calls.some(([input]) => input.path === 'src' && input.showHidden === true)).toBe(true);
    });
    expect(window.localStorage.getItem('workbench.explorer.showHidden')).toBe('true');
    act(() => more()!.click());
    expect(host!.querySelector('[role="menuitemcheckbox"]')?.getAttribute('aria-checked')).toBe('true');
  });

  describe('links into folders hidden by default (ELA-260)', () => {
    // `.workbenchignore` hides runs/ and tool-images/ from file/list; file/read still works.
    function createHiddenAdapter() {
      const visible: Record<string, ThreadWorkspaceTreeNode> = {
        '': directory('', [directory('src', [], false), file('README.md')]),
        src: directory('src', [file('src/index.ts')]),
      };
      const hidden: Record<string, ThreadWorkspaceTreeNode> = {
        '': directory('', [directory('runs', [], false), directory('src', [], false), directory('tool-images', [], false), file('README.md')]),
        src: directory('src', [file('src/index.ts')]),
        runs: directory('runs', [directory('runs/abc', [], false), directory('runs/def', [], false)]),
        'runs/abc': directory('runs/abc', [file('runs/abc/x.out'), file('runs/abc/y.log')]),
        'tool-images': directory('tool-images', [file('tool-images/a.png')]),
      };
      const listTree = vi.fn<ThreadWorkspaceAdapter['listTree']>(async ({ path, showHidden }) => {
        const tree = (showHidden ? hidden : visible)[path ?? ''];
        if (!tree) throw new Error(`No such file or directory: ${path}`);
        return tree;
      });
      const readFile = vi.fn<ThreadWorkspaceAdapter['readFile']>(async ({ path }) => filePreview(path));
      return { adapter: { listTree, readFile, hiddenFiles: true } satisfies ThreadWorkspaceAdapter, listTree, readFile };
    }
    const row = (path: string) => host?.querySelector<HTMLElement>(`[data-explorer-path="${path}"]`) ?? null;
    const preview = () => host?.querySelector('[data-testid="preview-file"]');

    it('opens the target and reveals only its chain, marked hidden by default, without the global toggle', async () => {
      const { adapter, listTree, readFile } = createHiddenAdapter();
      await renderExplorer(adapter, { path: '/workspace/demo/runs/abc/x.out', requestId: 1 });
      await vi.waitFor(() => expect(preview()?.textContent).toBe('runs/abc/x.out'));
      expect(readFile).toHaveBeenCalledWith(expect.objectContaining({ path: 'runs/abc/x.out' }));
      const target = row('runs/abc/x.out')!;
      expect(target.getAttribute('aria-selected')).toBe('true');
      expect(target.getAttribute('data-hidden-by-default')).toBe('true');
      expect(target.textContent).toContain('hidden by default');
      expect(row('runs/abc')?.getAttribute('data-hidden-by-default')).toBe('true');
      // Other hidden entries stay hidden.
      for (const path of ['tool-images', 'runs/def', 'runs/abc/y.log']) expect(row(path)).toBeNull();
      expect(row('src')?.getAttribute('data-hidden-by-default')).toBeNull();
      expect(window.localStorage.getItem('workbench.explorer.showHidden')).toBeNull();
      expect(preview()?.getAttribute('data-error')).toBeNull();
      // Only the chain is listed with showHidden; nothing hidden is listed without it.
      expect(listTree.mock.calls.filter(([input]) => input.showHidden).map(([input]) => input.path)).toEqual(['', 'runs', 'runs/abc']);
      expect(listTree.mock.calls.some(([input]) => !input.showHidden && String(input.path).startsWith('runs'))).toBe(false);

      // A refresh keeps the revealed file open.
      readFile.mockClear();
      const refreshes = listTree.mock.calls.length;
      await act(async () => host!.querySelector<HTMLButtonElement>('button[aria-label="Refresh workspace"]')!.click());
      await vi.waitFor(() => expect(listTree.mock.calls.length).toBeGreaterThan(refreshes));
      expect(row('runs/abc/x.out')?.getAttribute('aria-selected')).toBe('true');
      expect(preview()?.textContent).toBe('runs/abc/x.out');
    });

    it('opens a linked hidden folder with its contents, still without its hidden siblings', async () => {
      const { adapter } = createHiddenAdapter();
      await renderExplorer(adapter, { path: 'runs/abc', requestId: 1 });
      await vi.waitFor(() => expect(row('runs/abc/y.log')).not.toBeNull());
      expect(row('runs/abc')?.getAttribute('aria-expanded')).toBe('true');
      expect(row('runs/abc/x.out')?.getAttribute('data-hidden-by-default')).toBe('true');
      expect(row('runs/def')).toBeNull();
      expect(row('tool-images')).toBeNull();
    });

    it('shows the missing view for an absent file under a hidden folder and for .elagente paths', async () => {
      const { adapter, listTree } = createHiddenAdapter();
      await renderExplorer(adapter, { path: 'runs/abc/nope.out', requestId: 1 });
      await vi.waitFor(() => expect(preview()?.getAttribute('data-missing-path')).toBe('runs/abc/nope.out'));
      expect(preview()?.getAttribute('data-error')).toBeNull();
      expect(row('runs/abc/x.out')).toBeNull();
      expect(row('runs')).toBeNull();

      listTree.mockClear();
      await renderExplorer(adapter, { path: '.elagente/state.json', requestId: 2 });
      await vi.waitFor(() => expect(preview()?.getAttribute('data-missing-path')).toBe('.elagente/state.json'));
      expect(preview()?.getAttribute('data-error')).toBeNull();
      expect(listTree.mock.calls.some(([input]) => String(input.path).startsWith('.elagente'))).toBe(false);
      const calls = listTree.mock.calls.length;
      await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
      expect(listTree.mock.calls.length).toBe(calls);
    });

    it('leaves the global Show hidden files toggle as it was, and shows every hidden entry once it is on', async () => {
      const { adapter, listTree } = createHiddenAdapter();
      await renderExplorer(adapter, { path: 'runs/abc/x.out', requestId: 1 });
      await vi.waitFor(() => expect(row('runs/abc/x.out')).not.toBeNull());
      const more = () => host!.querySelector<HTMLButtonElement>('button[aria-label="More Explorer actions"]')!;
      act(() => more().click());
      const toggle = () => [...host!.querySelectorAll<HTMLButtonElement>('[role="menuitemcheckbox"]')].find((item) => item.textContent?.includes('Show hidden files'))!;
      expect(toggle().getAttribute('aria-checked')).toBe('false');
      await act(async () => toggle().click());
      await vi.waitFor(() => expect(row('tool-images')).not.toBeNull());
      expect(host!.querySelectorAll('[data-explorer-path="runs/abc/x.out"]')).toHaveLength(1);
      expect(window.localStorage.getItem('workbench.explorer.showHidden')).toBe('true');
      expect(listTree.mock.calls.some(([input]) => input.path === '' && input.showHidden === true)).toBe(true);
    });
  });

  it('hides internal thread events from the file tree unless the debug view is turned on', async () => {
    const { adapter, listTree } = createAdapter();
    const withEvents = {
      ...detail,
      turns: [{ id: 'turn-1', items: [{ id: 'call-1', kind: 'toolCall', text: 'expert', status: 'completed' }] }],
    } as unknown as ThreadDetailDto;
    await act(async () => {
      root?.render(
        <GraphWorkspaceExplorer activeView="chat" detail={withEvents} artifacts={[]}
          plugins={createDefaultPluginContextValue()} status={null} workspaceAdapter={adapter} />,
      );
    });
    await vi.waitFor(() => expect(listTree).toHaveBeenCalled());
    await vi.waitFor(() => expect(host!.textContent).toContain('README.md'));
    expect(host!.querySelector('[data-explorer-path="thread-events:"]')).toBeNull();
    expect(host!.textContent).not.toContain('thread-events');

    const more = () => host!.querySelector<HTMLButtonElement>('button[aria-label="More Explorer actions"]')!;
    act(() => more().click());
    const toggle = [...host!.querySelectorAll<HTMLButtonElement>('[role="menuitemcheckbox"]')]
      .find((item) => item.textContent?.includes('Show thread events'))!;
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    await act(async () => toggle.click());
    // Compact folders render the single turn as `thread-events/turn-1`.
    await vi.waitFor(() => expect(host!.textContent).toContain('thread-events/turn-1'));
    expect(window.localStorage.getItem('workbench.explorer.showThreadEvents')).toBe('true');
  });

  it('selects a file when the thread-events view is turned off while an event is selected', async () => {
    window.localStorage.setItem('workbench.explorer.showThreadEvents', 'true');
    const { adapter, readFile } = createAdapter();
    const withEvents = {
      ...detail,
      turns: [{ id: 'turn-1', items: [{ id: 'call-1', kind: 'toolCall', text: 'expert', status: 'completed' }] }],
    } as unknown as ThreadDetailDto;
    await act(async () => {
      root?.render(
        <GraphWorkspaceExplorer activeView="chat" detail={withEvents} artifacts={[]}
          plugins={createDefaultPluginContextValue()} status={null} workspaceAdapter={adapter} />,
      );
    });
    await vi.waitFor(() => expect(host!.textContent).toContain('thread-events/turn-1'));
    const eventRow = () => host!.querySelector<HTMLElement>('[data-explorer-path$="-tool-call.json"]');
    await vi.waitFor(() => expect(eventRow()).not.toBeNull());
    await act(async () => eventRow()!.click());
    await vi.waitFor(() => expect(host!.querySelector('[data-testid="preview-file"]')?.textContent).toContain('none'));
    readFile.mockClear();
    await act(async () => host!.querySelector<HTMLButtonElement>('[aria-label="Hide tree"]')!.click());
    await act(async () => host!.querySelector<HTMLButtonElement>('[aria-label="Event parent breadcrumb"]')!.click());
    expect(host!.querySelector('[role="tree"]')).toBeTruthy();
    expect(eventRow()).not.toBeNull();
    expect(readFile).not.toHaveBeenCalled();
    const more = () => host!.querySelector<HTMLButtonElement>('button[aria-label="More Explorer actions"]')!;
    act(() => more().click());
    const toggle = [...host!.querySelectorAll<HTMLButtonElement>('[role="menuitemcheckbox"]')]
      .find((item) => item.textContent?.includes('Show thread events'))!;
    await act(async () => toggle.click());
    await vi.waitFor(() => expect(host!.querySelector('[data-testid="preview-file"]')?.textContent).toContain('README.md'));
    expect(host!.textContent).not.toContain('thread-events');
  });

  it('lists an external linked file under its real parent directory, not a virtual folder', async () => {
    const { adapter, listTree } = createAdapter();
    const statLinkedFile = vi.fn(async () => file('/outside/docs/notes.txt'));
    await renderExplorer({ ...adapter, statLinkedFile }, { path: '/outside/docs/notes.txt', requestId: 1 });
    const parent = () => host?.querySelector('[data-explorer-path="/outside/docs"]');
    await vi.waitFor(() => expect(parent()?.getAttribute('aria-expanded')).toBe('true'));
    expect(parent()?.textContent).toContain('/outside/docs');
    expect(host?.querySelector('[data-explorer-path="/outside/docs/notes.txt"]')?.getAttribute('aria-selected')).toBe('true');
    expect(host?.textContent).not.toContain('Linked files');
    const calls = listTree.mock.calls.length;
    act(() => setLocale('zh-CN', false));
    expect(host?.textContent).not.toContain('链接文件');
    expect(host?.textContent).toContain('notes.txt');
    // Locale changes neither refetch nor list the host directory.
    expect(listTree).toHaveBeenCalledTimes(calls);
    expect(listTree.mock.calls.some(([input]) => String(input.path).startsWith('/outside'))).toBe(false);
    expect(statLinkedFile).toHaveBeenCalledTimes(1);
  });

  it('offers an ORCA .gbw as a download with its reason and never reads it as text', async () => {
    const { adapter, readFile } = createAdapter();
    await renderExplorer({ ...adapter, listTree: async () => directory('', [file('job.gbw')]) }, { path: 'job.gbw', requestId: 1 });
    const preview = () => host?.querySelector('[data-testid="preview-file"]');
    await vi.waitFor(() => expect(preview()?.getAttribute('data-download-only')).toBe('true'));
    expect(preview()?.getAttribute('data-download-reason')).toBe('scientificBinaryFile');
    expect(readFile).not.toHaveBeenCalled();
  });

  it('previews a PDF from bytes read through the adapter, not from a navigable URL', async () => {
    const { adapter } = createAdapter();
    const pdf = new Blob(['%PDF-1.4'], { type: 'application/octet-stream' });
    const readRawFile = vi.fn<NonNullable<ThreadWorkspaceAdapter['readRawFile']>>(async () => pdf);
    const getRawFileUrl = vi.fn(() => 'https://relay.example/relay/devices/d/api/raw');
    const created: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => { created.push(blob); return `blob:test/${created.length}`; });
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    await renderExplorer({ ...adapter, readRawFile, getRawFileUrl, listTree: async () => directory('', [file('report.pdf')]) }, { path: 'report.pdf', requestId: 1 });
    const preview = () => host?.querySelector('[data-testid="preview-file"]');
    await vi.waitFor(() => expect(preview()?.getAttribute('data-pdf-url')).toBe('blob:test/1'));
    expect(readRawFile).toHaveBeenCalledWith(expect.objectContaining({ threadId: 'thread-1', workspaceId: 'workspace-1', path: 'report.pdf' }));
    expect(created[0]?.type).toBe('application/pdf');
    act(() => root?.unmount());
    root = null;
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test/1');
  });

  it('loads the root, previews the first file, and preserves expanded directories on refresh', async () => {
    const { adapter, listTree, readFile } = createAdapter();
    await renderExplorer(adapter);

    await vi.waitFor(() => {
      expect(listTree).toHaveBeenCalledWith({
        threadId: 'thread-1',
        workspaceId: 'workspace-1',
        path: '',
      });
      expect(readFile).toHaveBeenCalledWith({
        threadId: 'thread-1',
        workspaceId: 'workspace-1',
        path: 'README.md',
        limit: 24_000,
      });
    });
    expect(
      host?.querySelector('[data-testid="preview-file"]')?.textContent,
    ).toBe('README.md');

    await act(async () => {
      host
        ?.querySelector<HTMLButtonElement>('[aria-label="Expand src"]')
        ?.click();
    });
    await vi.waitFor(() => {
      expect(
        listTree.mock.calls.filter(([input]) => input.path === 'src'),
      ).toHaveLength(1);
      expect(buttonNamed('index.ts')).not.toBeUndefined();
    });

    await act(async () =>
      host
        ?.querySelector<HTMLButtonElement>('[aria-label="Refresh workspace"]')
        ?.click(),
    );
    await vi.waitFor(() => {
      expect(
        listTree.mock.calls.filter(([input]) => input.path === ''),
      ).toHaveLength(2);
      expect(
        listTree.mock.calls.filter(([input]) => input.path === 'src'),
      ).toHaveLength(2);
      expect(buttonNamed('index.ts')).not.toBeUndefined();
    });
    expect(
      host?.querySelector('[data-testid="preview-file"]')?.textContent,
    ).toBe('README.md');
  });

  it('does not preview a fallback file while opening a deep link and ignores stale root refreshes', async () => {
    const staleRoot = deferred<ThreadWorkspaceTreeNode>();
    const targetRoot = directory('', [directory('src', [], false), file('WRONG.md')]);
    let rootReads = 0;
    const readFile = vi.fn<ThreadWorkspaceAdapter['readFile']>(async ({path})=>filePreview(path));
    const adapter: ThreadWorkspaceAdapter = {
      listTree: vi.fn(async ({path}) => path === 'src' ? directory('src', [file('src/index.ts')]) : ++rootReads === 1 ? staleRoot.promise : targetRoot),
      readFile,
    };
    await renderExplorer(adapter);
    await renderExplorer(adapter, {path:'/workspace/demo/src/index.ts', requestId:1});
    await vi.waitFor(()=>expect(host?.querySelector('[data-testid="preview-file"]')?.textContent).toBe('src/index.ts'));
    await act(async()=>staleRoot.resolve(directory('', [file('OLDER.md')])));
    expect(host?.querySelector('[data-testid="preview-file"]')?.textContent).toBe('src/index.ts');
    expect(readFile.mock.calls.map(([input])=>input.path)).toEqual(['src/index.ts']);
  });

  it('the newest link wins when ancestor loads finish out of order', async () => {
    const slow = deferred<ThreadWorkspaceTreeNode>();
    const readFile = vi.fn<ThreadWorkspaceAdapter['readFile']>(async ({path})=>filePreview(path));
    const adapter: ThreadWorkspaceAdapter = {
      listTree: vi.fn(async ({path}) => path === 'src' ? slow.promise : path === 'docs' ? directory('docs',[file('docs/new.md')]) : directory('',[directory('src',[],false),directory('docs',[],false)])), readFile,
    };
    await renderExplorer(adapter, {path:'src/old.md',requestId:1});
    await renderExplorer(adapter, {path:'docs/new.md',requestId:2});
    await vi.waitFor(()=>expect(host?.querySelector('[data-testid="preview-file"]')?.textContent).toBe('docs/new.md'));
    await act(async()=>slow.resolve(directory('src',[file('src/old.md')])));
    expect(host?.querySelector('[data-testid="preview-file"]')?.textContent).toBe('docs/new.md');
    expect(readFile.mock.calls.map(([input])=>input.path)).toEqual(['docs/new.md']);
  });

  it('loads missing ancestors and selects a deep focus request', async () => {
    const { adapter, listTree, readFile } = createAdapter();
    await renderExplorer(adapter);
    await vi.waitFor(() => expect(readFile).toHaveBeenCalled());

    await renderExplorer(adapter, {
      path: '/workspace/demo/src/index.ts',
      line: 7,
      requestId: 1,
    });

    await vi.waitFor(() => {
      expect(listTree.mock.calls.some(([input]) => input.path === 'src')).toBe(
        true,
      );
      expect(
        readFile.mock.calls.some(([input]) => input.path === 'src/index.ts'),
      ).toBe(true);
      expect(
        host?.querySelector('[data-testid="preview-file"]')?.textContent,
      ).toBe('src/index.ts');
      expect(
        host
          ?.querySelector('[data-testid="preview-file"]')
          ?.getAttribute('data-focus-line'),
      ).toBe('7');
    });
  });

  it('ignores a stale root response after a newer refresh completes', async () => {
    const firstRoot = deferred<ThreadWorkspaceTreeNode>();
    let rootRequestCount = 0;
    const listTree = vi.fn<ThreadWorkspaceAdapter['listTree']>(async () => {
      rootRequestCount += 1;
      if (rootRequestCount === 1) {
        return firstRoot.promise;
      }
      return directory('', [file('latest.ts')]);
    });
    const readFile = vi.fn<ThreadWorkspaceAdapter['readFile']>(
      async ({ path }) => filePreview(path),
    );
    const adapter = { listTree, readFile } satisfies ThreadWorkspaceAdapter;

    act(() => {
      root?.render(
        <GraphWorkspaceExplorer
          activeView="chat"
          detail={detail}
          artifacts={[]}
          plugins={createDefaultPluginContextValue()}
          status={null}
          workspaceAdapter={adapter}
        />,
      );
    });
    expect(listTree).toHaveBeenCalledTimes(1);

    await act(async () => {
      host
        ?.querySelector<HTMLButtonElement>('[aria-label="Refresh workspace"]')
        ?.click();
    });
    await vi.waitFor(() => {
      expect(host?.textContent).toContain('latest.ts');
      expect(readFile).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'latest.ts' }),
      );
    });

    await act(async () => {
      firstRoot.resolve(directory('', [file('stale.ts')]));
    });
    expect(host?.textContent).not.toContain('stale.ts');
    expect(
      readFile.mock.calls.some(([request]) => request.path === 'stale.ts'),
    ).toBe(false);
  });

  it('forwards upload and download capabilities through the adapter', async () => {
    const { adapter, listTree } = createAdapter();
    const uploadFile = vi.fn<NonNullable<ThreadWorkspaceAdapter['uploadFile']>>(
      async ({ file: uploadedFile }) => ({
        kind: 'file',
        file: {
          path: uploadedFile.name,
          name: uploadedFile.name,
          size: uploadedFile.size,
        },
      }),
    );
    const downloadNode =
      vi.fn<NonNullable<ThreadWorkspaceAdapter['downloadNode']>>();
    const capableAdapter = { ...adapter, uploadFile, downloadNode };
    await renderExplorer(capableAdapter);
    await vi.waitFor(() => expect(listTree).toHaveBeenCalled());

    const more = host!.querySelector<HTMLButtonElement>('[aria-label="More actions for README.md"]');
    expect(more).not.toBeNull();
    await act(async () => { more!.click(); });
    const download = document.querySelector<HTMLButtonElement>('[role="menuitem"]');
    expect(download?.textContent).toBe('Download file');
    await act(async () => { download!.click(); });
    expect(downloadNode).toHaveBeenCalledWith({
      threadId: 'thread-1',
      workspaceId: 'workspace-1',
      path: 'README.md',
      kind: 'file',
    });

    const input = host?.querySelector<HTMLInputElement>(
      '[data-testid="workspace-upload-file-input"]',
    );
    const uploadedFile = new File(['hello'], 'notes.txt', {
      type: 'text/plain',
    });
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [uploadedFile],
    });
    await act(async () => {
      input?.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(uploadFile).toHaveBeenCalledWith({
      threadId: 'thread-1',
      workspaceId: 'workspace-1',
      path: 'notes.txt',
      file: uploadedFile,
    });
    expect(
      listTree.mock.calls.filter(([request]) => request.path === ''),
    ).toHaveLength(2);
  });

  it('opens the mobile Viewer when a file row is selected', async () => {
    mobileViewport = true;
    const { adapter, readFile } = createAdapter();
    await renderExplorer(adapter);
    await vi.waitFor(() => expect(readFile).toHaveBeenCalled());

    expect(host?.querySelector('[data-testid="preview-file"]')).toBeNull();
    await act(async () => buttonNamed('README.md')?.click());
    expect(
      host?.querySelector('[data-testid="preview-file"]')?.textContent,
    ).toBe('README.md');
    expect(host?.querySelector('[role="tree"]')).toBeNull();
    await act(async () => host!.querySelector<HTMLButtonElement>('[aria-label="Show tree"]')!.click());
    expect(host?.querySelector('[role="tree"]')).toBeTruthy();
    expect(host?.querySelector('[data-testid="preview-file"]')).toBeNull();
    expect(host?.querySelector('[data-testid="workspace-upload-file-input"]')).toBeTruthy();
  });

  it('keeps one toolbar and tree toggle in place while hiding and showing the tree', async () => {
    const { adapter, readFile } = createAdapter();
    await renderExplorer(adapter);
    await vi.waitFor(() => expect(readFile).toHaveBeenCalled());
    const header = host!.querySelector('.thread-graph-explorer-header')!;
    const actions = () => Array.from(header.querySelectorAll('button')).map(button => button.getAttribute('aria-label'));
    const shownActions = actions();
    const toggle = host!.querySelector<HTMLButtonElement>('[aria-label="Hide tree"]')!;
    expect(toggle).toBeTruthy();
    expect(host?.querySelector('[aria-label="Hide Editor"]')).toBeNull();
    await act(async () => toggle.click());
    expect(host?.querySelector('[role="tree"]')).toBeNull();
    expect(host?.querySelector('[data-testid="preview-file"]')).toBeTruthy();
    expect(host?.querySelector('.thread-graph-explorer-header')).toBe(header);
    expect(host?.querySelector('[aria-label="Show tree"]')).toBe(toggle);
    expect(actions().slice(0, -1)).toEqual(shownActions.slice(0, -1));
    await act(async () => toggle.click());
    expect(host?.querySelector('[role="tree"]')).toBeTruthy();
    expect(host?.querySelector('[data-testid="preview-file"]')).toBeTruthy();
    expect(host?.querySelectorAll('[data-testid="toggle-explorer-tree"]')).toHaveLength(1);
    await act(async () => header.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', metaKey: true, bubbles: true })));
    expect(host?.querySelector('[role="tree"]')).toBeNull();
    await act(async () => header.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true })));
    expect(host?.querySelector('[role="tree"]')).toBeTruthy();
    await act(async () => toggle.click());
    await act(async () => host!.querySelector<HTMLButtonElement>('[aria-label="Filter workspace"]')!.click());
    expect(host?.querySelector('[role="tree"]')).toBeTruthy();
    expect(host?.querySelector('[aria-label="Filter workspace files"]')).toBeTruthy();
    await vi.waitFor(() => expect(document.activeElement).toBe(host?.querySelector('[aria-label="Filter workspace files"]')));
    await act(async () => toggle.click());
    await act(async () => host!.querySelector<HTMLButtonElement>('[aria-label="Filter workspace"]')!.click());
    await vi.waitFor(() => expect(document.activeElement).toBe(host?.querySelector('[aria-label="Filter workspace files"]')));
    const editor = document.createElement('textarea');
    editor.className = 'monaco-editor';
    host!.querySelector('[data-testid="preview-file"]')!.append(editor);
    await act(async () => editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', metaKey: true, bubbles: true })));
    expect(host?.querySelector('[role="tree"]')).toBeNull();
  });

  it('updates directory breadcrumbs on selection and expansion, then returns to the file path', async () => {
    const { adapter, listTree } = createAdapter();
    listTree.mockImplementation(async () => directory('', [file('README.md'), directory('src', [
      file('src/index.ts'), directory('src/nested', [file('src/nested/deep.txt')]),
    ])]));
    await renderExplorer(adapter);
    const path = () => host!.querySelector('[data-testid="preview-file"]')?.getAttribute('data-breadcrumb-path');
    await act(async () => buttonNamed('README.md')!.click());
    expect(path()).toBe('README.md');
    await act(async () => host!.querySelector<HTMLButtonElement>('[aria-label="Expand src"]')!.click());
    expect(path()).toBe('src');
    expect(host!.querySelector('[data-testid="preview-file"]')?.textContent).toContain('README.md');
    await act(async () => buttonNamed('nested')!.click());
    expect(path()).toBe('src/nested');
    await act(async () => host!.querySelector<HTMLButtonElement>('[aria-label="Expand nested"]')!.click());
    expect(path()).toBe('src/nested');
    await act(async () => buttonNamed('deep.txt')!.click());
    expect(path()).toBe('src/nested/deep.txt');
    await act(async () => host!.querySelector<HTMLButtonElement>('[data-explorer-path=""] button')!.click());
    expect(path()).toBe('');
  });

  it('collapses folders and filters across loaded descendants', async () => {
    const { adapter } = createAdapter();
    await renderExplorer(adapter);
    await act(async () => {
      host
        ?.querySelector<HTMLButtonElement>('[aria-label="Expand src"]')
        ?.click();
    });
    await vi.waitFor(() => expect(buttonNamed('index.ts')).not.toBeUndefined());

    await act(async () => {
      host
        ?.querySelector<HTMLButtonElement>('[aria-label="Collapse folders"]')
        ?.click();
    });
    expect(buttonNamed('index.ts')).toBeUndefined();

    await act(async () => {
      host
        ?.querySelector<HTMLButtonElement>('[aria-label="Filter workspace"]')
        ?.click();
    });
    const filter = host?.querySelector<HTMLInputElement>(
      '[aria-label="Filter workspace files"]',
    );
    await act(async () => {
      if (filter) {
        const valueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        )?.set;
        valueSetter?.call(filter, 'index');
        filter.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    expect(buttonNamed('index.ts')).not.toBeUndefined();
    expect(host?.textContent).toContain('1 match');
  });

  it('coalesces workspace change notifications into a refresh', async () => {
    vi.useFakeTimers();
    const { adapter, listTree } = createAdapter();
    let notifyChanged: (() => void) | null = null;
    const unsubscribe = vi.fn();
    const subscribedAdapter: ThreadWorkspaceAdapter = {
      ...adapter,
      subscribeWorkspaceChanged(_identity, onChanged) {
        notifyChanged = onChanged;
        return unsubscribe;
      },
    };
    await renderExplorer(subscribedAdapter);
    expect(listTree).toHaveBeenCalledTimes(1);

    act(() => {
      notifyChanged?.();
      notifyChanged?.();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180);
    });
    expect(listTree).toHaveBeenCalledTimes(2);

    act(() => root?.unmount());
    root = null;
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('shows a directory-scoped retry after lazy loading fails', async () => {
    let srcRequests = 0;
    const listTree = vi.fn<ThreadWorkspaceAdapter['listTree']>(
      async ({ path }) => {
        if (path !== 'src') {
          return directory('', [directory('src', [], false)]);
        }
        srcRequests += 1;
        if (srcRequests === 1) {
          throw new Error('Directory unavailable');
        }
        return directory('src', [file('src/index.ts')]);
      },
    );
    const adapter = {
      listTree,
      readFile: vi.fn<ThreadWorkspaceAdapter['readFile']>(async ({ path }) =>
        filePreview(path),
      ),
    } satisfies ThreadWorkspaceAdapter;
    await renderExplorer(adapter);

    await act(async () => {
      host
        ?.querySelector<HTMLButtonElement>('[aria-label="Expand src"]')
        ?.click();
    });
    await vi.waitFor(() =>
      expect(
        host?.querySelector('[aria-label="Retry loading src"]'),
      ).not.toBeNull(),
    );

    await act(async () => {
      host
        ?.querySelector<HTMLButtonElement>('[aria-label="Retry loading src"]')
        ?.click();
    });
    await vi.waitFor(() => expect(buttonNamed('index.ts')).not.toBeUndefined());
  });
});
