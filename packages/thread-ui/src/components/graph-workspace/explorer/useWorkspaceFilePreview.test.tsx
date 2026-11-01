// @vitest-environment jsdom
import { act, useMemo } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ThreadWorkspaceAdapter,
  ThreadWorkspaceFilePreview,
} from '../../../adapters';
import {
  MAX_CUBE_PREVIEW_BYTES,
  MAX_MOLECULAR_PREVIEW_BYTES,
  useWorkspaceFilePreview,
} from './useWorkspaceFilePreview';
import { syntheticCube } from '../GraphMoleculeCubeFixtures';
import { buildMoleculePreviewSnapshot } from '../workspaceTree';

function preview(
  path = 'notes.txt',
  extra: Partial<ThreadWorkspaceFilePreview> = {},
): ThreadWorkspaceFilePreview {
  return {
    path,
    name: path,
    content: 'first',
    language: 'text',
    size: 10,
    truncated: false,
    nextOffset: 5,
    ...extra,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
let host: HTMLDivElement;
let root: Root;
let result: ReturnType<typeof useWorkspaceFilePreview>;
let adapter: ThreadWorkspaceAdapter;
const onError = vi.fn();
const documents = { load: vi.fn(async () => null) } as unknown as Parameters<typeof useWorkspaceFilePreview>[0]['documents'];
function Harness({ threadId, path }: { threadId: string; path: string }) {
  const identity = useMemo(() => ({ threadId, workspaceId: null }), [threadId]);
  result = useWorkspaceFilePreview({
    activeNode: {
      id: `workspace:${path}`,
      path,
      name: path,
      kind: 'file',
      children: [],
    },
    adapter,
    identity,
    onError,
    documents,
  });
  return <span>{result.previewFile?.content}</span>;
}
async function render(threadId = 'one', path = 'notes.txt') {
  await act(async () =>
    root.render(<Harness threadId={threadId} path={path} />),
  );
}
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  onError.mockReset();
  adapter = {
    listTree: vi.fn(),
    readFile: vi.fn(async ({ path }) => preview(path)),
    textRangeRead: true,
  };
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('workspace preview recovery', () => {
  it('catches load-more rejections and retains the current content', async () => {
    adapter.readFile = vi.fn(async ({ offset }) => {
      if (offset) throw new Error('FILE_CONFLICT: reopen this file.');
      return preview('notes.txt', { truncated: true });
    });
    await render();
    await act(async () => result.loadMore());
    expect(onError).toHaveBeenLastCalledWith(
      'FILE_CONFLICT: reopen this file.',
    );
    expect(result.previewFile?.content).toBe('first');
    expect(result.loadingMore).toBe(false);
  });
  it('ignores a load-more result after switching threads with the same filename', async () => {
    const chunk = deferred<ThreadWorkspaceFilePreview>();
    adapter.readFile = vi.fn(async ({ threadId, offset }) =>
      offset
        ? chunk.promise
        : preview('notes.txt', { content: threadId, truncated: true }),
    );
    await render();
    let pending!: Promise<void>;
    await act(async () => {
      pending = result.loadMore();
    });
    await render('two');
    await act(async () => {
      chunk.resolve(preview('notes.txt', { content: 'stale', nextOffset: 10 }));
      await pending;
    });
    expect(result.previewFile?.content).toBe('two');
    expect(result.loadingMore).toBe(false);
  });
  it('deduplicates load-more clicks and reports a stalled read', async () => {
    const chunk = deferred<ThreadWorkspaceFilePreview>();
    adapter.readFile = vi.fn(async ({ offset }) =>
      offset ? chunk.promise : preview('notes.txt', { truncated: true }),
    );
    await render();
    let pending!: Promise<void>;
    await act(async () => {
      pending = result.loadMore();
      void result.loadMore();
    });
    expect(adapter.readFile).toHaveBeenCalledTimes(2);
    await act(async () => {
      chunk.resolve(preview('notes.txt', { truncated: true }));
      await pending;
    });
    expect(onError).toHaveBeenLastCalledWith(
      expect.stringContaining('made no progress'),
    );
  });
});

describe('cube previews', () => {
  // Serves `text` in the requested ranges, reporting `size` as the file size.
  function serve(text: string, size = text.length) {
    return vi.fn(async ({ path, offset = 0, limit = 24_000 }: { path: string; offset?: number; limit?: number }) => {
      const end = Math.min(text.length, offset + limit);
      return preview(path, {
        content: text.slice(offset, end),
        language: 'cube',
        size,
        truncated: end < size,
        nextOffset: end,
      });
    });
  }

  it('reads a whole cube in 2 MiB chunks and opens it in the molecule viewer', async () => {
    const cube = syntheticCube({ points: 20 });
    // Pad to a size between the molecular and cube caps.
    const padded = cube + ' '.repeat(MAX_MOLECULAR_PREVIEW_BYTES + 1024 - cube.length);
    adapter.readFile = serve(padded);
    await render('one', 'orbitals/homo.cub');
    expect(result.downloadOnly).toBe(false);
    expect(result.previewFile?.content).toBe(padded);
    const limits = vi.mocked(adapter.readFile).mock.calls.map(([request]) => request.limit);
    expect(limits[0]).toBe(24_000);
    expect(limits.slice(1, -1).every((limit) => limit === 2 * 1024 * 1024)).toBe(true);
    expect(limits).toHaveLength(1 + Math.ceil((padded.length - 24_000) / (2 * 1024 * 1024)));
    expect(buildMoleculePreviewSnapshot(result.previewFile)).toMatchObject({
      format: 'cube',
      uuid: 'orbitals/homo.cub',
    });
  });

  it('offers a cube above 20 MiB as a download with the reason', async () => {
    const cube = syntheticCube({ points: 20 });
    adapter.readFile = serve(cube, MAX_CUBE_PREVIEW_BYTES + 1);
    await render('one', 'homo.cube');
    expect(result.downloadOnly).toBe(true);
    expect(result.downloadReason).toBe('volumetricPreviewTooLarge');
    expect(adapter.readFile).toHaveBeenCalledTimes(1);
  });

  it('keeps the 10 MiB cap for other molecular formats', async () => {
    adapter.readFile = serve('1\nH\nH 0 0 0\n', MAX_MOLECULAR_PREVIEW_BYTES + 1);
    await render('one', 'big.xyz');
    expect(result.downloadOnly).toBe(true);
    expect(result.downloadReason).toBe('moleculePreviewTooLarge');
  });

  it('rejects a grid above 200³ points from the first chunk, before reading the rest', async () => {
    const huge = syntheticCube({ points: 2 }).replace(/^( {4})2/gm, '  201');
    adapter.readFile = serve(huge, 15 * 1024 * 1024);
    await render('one', 'huge.cube');
    expect(result.downloadOnly).toBe(true);
    expect(result.downloadReason).toBe('volumetricGridTooLarge');
    expect(adapter.readFile).toHaveBeenCalledTimes(1);
  });

  it('rejects a multi-orbital cube from the first chunk', async () => {
    adapter.readFile = serve(syntheticCube({ points: 4, orbitals: [5, 6] }));
    await render('one', 'orbitals.cube');
    expect(result.downloadReason).toBe('volumetricMultipleOrbitals');
  });
});
