// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ThreadDetailDto } from '@remote-codex/shared';
import type { ThreadDetailUiAdapter, ThreadTimelineAdapter } from './adapters';
import { ThreadDetailSurface } from './ThreadDetailSurface';
import { GraphChatMessageContent } from './components/graph-chat/GraphChatMessageContent';

// Exercise the surface's resolver lifecycle without unrelated layout/viewer UI.
vi.mock('./components/ThreadWorkspaceLayout', () => ({
  ThreadWorkspaceLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('./components/graph-chat/GraphChatThreadChatPanel', () => ({
  GraphChatThreadChatPanel: ({ timelineAdapter }: { timelineAdapter: ThreadTimelineAdapter }) =>
    <GraphChatMessageContent content="Output: water/result.xyz" {...timelineAdapter} />,
}));

let root: Root | undefined;
let host: HTMLDivElement;
afterEach(() => { act(() => root?.unmount()); host?.remove(); });

function detail(threadId = 't', workspaceId = 'w', absPath = '/workspace'): ThreadDetailDto {
  return {
    thread: { id: threadId, workspaceId, provider: 'codex', providerSessionId: null,
      source: 'supervisor', title: 'Water', model: null, reasoningEffort: null,
      collaborationMode: 'default', approvalMode: 'guarded', status: 'idle',
      summaryText: null, lastError: null, activeTurnId: null, isLoaded: false,
      isPinned: false, createdAt: '', updatedAt: '', lastTurnStartedAt: null, lastTurnCompletedAt: null },
    workspace: { id: workspaceId, hostId: 'h', label: 'Workspace', absPath,
      isFavorite: false, createdAt: '', lastOpenedAt: null },
    workspacePathStatus: 'present', turns: [], pendingRequests: [], pendingSteers: [],
  };
}

it('keeps links and verification cache when unrelated host callbacks or snapshots change', async () => {
  const listTree = vi.fn(async () => ({ name: 'water', path: 'water', kind: 'directory' as const,
    children: [{ name: 'result.xyz', path: 'water/result.xyz', kind: 'file' as const }] }));
  const workspace = { listTree, readFile: vi.fn(async () => { throw new Error('Link verification must not read file contents'); }) };
  const paint = (adapter: ThreadDetailUiAdapter) => <ThreadDetailSurface threads={[]} detail={detail()}
    loading={false} error={null} adapter={adapter} workspaceContent={<span />} />;
  const adapter = { workspace, sendPrompt: vi.fn(async () => {}), openThread: vi.fn(), openWorkspaceFile: vi.fn() };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => { root!.render(paint(adapter)); });
  await vi.waitFor(() => expect(host.querySelector('a')).not.toBeNull());
  const link = host.querySelector('a');
  const calls = listTree.mock.calls.length;
  const open = vi.fn();
  act(() => root!.render(paint({ ...adapter, openThread: vi.fn(), openWorkspaceFile: open })));
  expect(host.querySelector('a')).toBe(link);
  expect(listTree).toHaveBeenCalledTimes(calls);
  expect(workspace.readFile).not.toHaveBeenCalled();
  act(() => host.querySelector('a')!.click());
  expect(open).toHaveBeenCalledWith({ path: 'water/result.xyz' });
});

it.each(['thread', 'workspace', 'root', 'adapter'] as const)('rechecks links after the %s boundary changes', async (boundary) => {
  const listTree = vi.fn(async () => ({ name: 'water', path: 'water', kind: 'directory' as const,
    children: [{ name: 'result.xyz', path: 'water/result.xyz', kind: 'file' as const }] }));
  const workspace = { listTree, readFile: vi.fn(async () => { throw new Error('Link verification must not read file contents'); }) };
  const adapter = { workspace, sendPrompt: vi.fn(async () => {}), openThread: vi.fn(), openWorkspaceFile: vi.fn() };
  const paint = (nextDetail: ThreadDetailDto, nextAdapter = adapter) => <ThreadDetailSurface
    threads={[]} detail={nextDetail} loading={false} error={null} adapter={nextAdapter} workspaceContent={<span />} />;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => { root!.render(paint(detail())); });
  await vi.waitFor(() => expect(host.querySelector('a')).not.toBeNull());
  const calls = listTree.mock.calls.length;
  act(() => root!.render(paint(
    detail(boundary === 'thread' ? 'other' : 't', boundary === 'workspace' ? 'other' : 'w', boundary === 'root' ? '/other' : '/workspace'),
    boundary === 'adapter' ? { ...adapter, workspace: { ...workspace } } : adapter,
  )));
  expect(host.querySelector('a')).toBeNull();
  expect(listTree.mock.calls.length).toBeGreaterThan(calls);
  await act(async () => {});
  expect(host.querySelector('a')).not.toBeNull();
});
