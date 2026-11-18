/** @vitest-environment jsdom */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ComposerAttachmentDraft } from './composerUtils';
import { readAttachmentMetadata, type AttachmentMetadata } from './attachmentMetadata';
import { useAttachmentMetadata, type AttachmentMetadataMap } from './useAttachmentMetadata';

vi.mock('./attachmentMetadata', () => ({
  supportsAttachmentMetadata: (file: File) => file.name.endsWith('.zip'),
  readAttachmentMetadata: vi.fn(),
}));
const parse = vi.mocked(readAttachmentMetadata);
let root: Root | undefined;
let container: HTMLDivElement;
let latest: AttachmentMetadataMap;
let renders: number;
let requests: Array<{ file: File; signal: AbortSignal; resolve: (value: AttachmentMetadata | undefined) => void }>;

function attachment(clientId: string, file = new File(['zip'], 'files.zip')): ComposerAttachmentDraft {
  return { clientId, file, kind: 'file', originalName: file.name, placeholder: `[FILE ${file.name}]` };
}
function Harness({ attachments, enabled }: { attachments: ComposerAttachmentDraft[]; enabled: boolean }) {
  renders++;
  latest = useAttachmentMetadata(attachments, enabled);
  return null;
}
async function render(attachments: ComposerAttachmentDraft[], enabled = true) {
  await act(async () => {
    root ??= createRoot(container);
    root.render(createElement(Harness, { attachments, enabled }));
  });
}
async function resolve(index: number, value: AttachmentMetadata | undefined) {
  await act(async () => { requests[index].resolve(value); });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  requests = [];
  latest = {};
  renders = 0;
  parse.mockImplementation((file, signal) => new Promise((resolve) => { requests.push({ file, signal, resolve }); }));
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = undefined;
  container.remove();
  vi.resetAllMocks();
});

describe('useAttachmentMetadata', () => {
  it('parses lazily only when enabled and skips unsupported local files', async () => {
    const file = attachment('a');
    await render([file], false);
    expect(parse).not.toHaveBeenCalled();
    await render([attachment('text', new File(['x'], 'notes.txt'))]);
    expect(parse).not.toHaveBeenCalled();
    await render([file]);
    expect(parse).toHaveBeenCalledOnce();
    expect(latest).toEqual({});
    await resolve(0, { entryCount: 0 });
    expect(latest).toEqual({ a: { entryCount: 0 } });
  });

  it('reuses File identity across IDs and rerenders, including new arrays during typing', async () => {
    const file = attachment('a');
    await render([file]);
    for (let index = 0; index < 60; index++) await render([{ ...file }]);
    expect(parse).toHaveBeenCalledOnce();
    await resolve(0, { entryCount: 3 });
    const stable = latest;
    await render([{ ...file }]);
    expect(latest).toBe(stable);
    await render([{ ...file, clientId: 'b' }, { ...file, clientId: 'c' }]);
    expect(parse).toHaveBeenCalledOnce();
    expect(latest).toEqual({ b: { entryCount: 3 }, c: { entryCount: 3 } });
  });

  it('caches unknown results without retrying on typing and avoids endless updates', async () => {
    const file = attachment('a');
    await render([file]);
    await resolve(0, undefined);
    const before = renders;
    for (let index = 0; index < 100; index++) await render([{ ...file }]);
    expect(parse).toHaveBeenCalledOnce();
    expect(renders - before).toBe(100);
    expect(latest).toEqual({});
    for (let index = 0; index < 100; index++) await render([]);
    expect(renders - before).toBe(200);
  });

  it('cancels removal and never publishes a late result', async () => {
    const file = attachment('a');
    await render([file]);
    await render([]);
    expect(requests[0].signal.aborted).toBe(true);
    await resolve(0, { entryCount: 99 });
    expect(latest).toEqual({});
    await render([file]);
    expect(parse).toHaveBeenCalledTimes(2);
    await resolve(1, { entryCount: 2 });
    expect(latest).toEqual({ a: { entryCount: 2 } });
  });

  it('clears replaced files and parses each distinct File once', async () => {
    await render([attachment('a')]);
    await resolve(0, { entryCount: 1 });
    await render([attachment('a')]);
    expect(latest).toEqual({});
    await resolve(1, { entryCount: 2 });
    expect(latest).toEqual({ a: { entryCount: 2 } });
  });

  it('cancels on disabling and on unmount', async () => {
    const file = attachment('a');
    await render([file]);
    await render([file], false);
    expect(requests[0].signal.aborted).toBe(true);
    await resolve(0, { entryCount: 10 });
    expect(latest).toEqual({});
    await render([file]);
    await act(async () => { root?.unmount(); root = undefined; });
    expect(requests[1].signal.aborted).toBe(true);
    await resolve(1, { entryCount: 10 });
  });

  it('serializes parsing and cancels queued attachments before reading', async () => {
    const a = attachment('a');
    const b = attachment('b');
    const c = attachment('c');
    await render([a, b, c]);
    expect(parse).toHaveBeenCalledOnce();
    await render([a, c]);
    await resolve(0, { entryCount: 1 });
    expect(parse).toHaveBeenCalledTimes(2);
    expect(requests[1].file).toBe(c.file);
    await resolve(1, { entryCount: 3 });
    expect(latest).toEqual({ a: { entryCount: 1 }, c: { entryCount: 3 } });
  });
});
