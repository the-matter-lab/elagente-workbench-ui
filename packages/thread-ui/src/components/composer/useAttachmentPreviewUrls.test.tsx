/**
 * @vitest-environment jsdom
 */
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ComposerAttachmentDraft } from './composerUtils';
import {
  useAttachmentPreviewUrls,
  type AttachmentPreviewMap,
} from './useAttachmentPreviewUrls';

let latestPreviewUrls: AttachmentPreviewMap | null = null;
let harnessRenders = 0;

function makeAttachment(
  clientId: string,
  kind: ComposerAttachmentDraft['kind'],
): ComposerAttachmentDraft {
  const extension = kind === 'photo' ? 'png' : 'txt';
  return {
    clientId,
    kind,
    originalName: `${clientId}.${extension}`,
    placeholder: `[${kind.toUpperCase()} ${clientId}.${extension}]`,
    file: new File(['content'], `${clientId}.${extension}`, {
      type: kind === 'photo' ? 'image/png' : 'text/plain',
    }),
  };
}

function HookHarness({
  attachments,
  isShellView,
}: {
  attachments: ComposerAttachmentDraft[];
  isShellView: boolean;
}) {
  harnessRenders += 1;
  latestPreviewUrls = useAttachmentPreviewUrls({ attachments, isShellView });
  return null;
}

function renderHookHarness(input: {
  attachments: ComposerAttachmentDraft[];
  isShellView: boolean;
}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  flushSync(() => {
    root.render(<HookHarness {...input} />);
  });

  return {
    rerender(nextInput: {
      attachments: ComposerAttachmentDraft[];
      isShellView: boolean;
    }) {
      flushSync(() => {
        root.render(<HookHarness {...nextInput} />);
      });
    },
    unmount() {
      flushSync(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('useAttachmentPreviewUrls', () => {
  let createObjectUrl: ReturnType<typeof vi.fn>;
  let revokeObjectUrl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    let nextUrlId = 0;
    createObjectUrl = vi.fn(() => {
      nextUrlId += 1;
      return `blob:preview-${nextUrlId}`;
    });
    revokeObjectUrl = vi.fn();
    URL.createObjectURL = createObjectUrl;
    URL.revokeObjectURL = revokeObjectUrl;
    latestPreviewUrls = null;
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    latestPreviewUrls = null;
    vi.restoreAllMocks();
  });

  it('creates preview URLs for photos and reuses cached URLs', async () => {
    const photo = makeAttachment('photo-a', 'photo');
    const file = makeAttachment('file-a', 'file');
    const harness = renderHookHarness({
      attachments: [photo, file],
      isShellView: false,
    });

    await vi.waitFor(() => {
      expect(latestPreviewUrls).toEqual({ 'photo-a': 'blob:preview-1' });
    });
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(createObjectUrl).toHaveBeenCalledWith(photo.file);

    harness.rerender({
      attachments: [photo, file],
      isShellView: false,
    });

    await vi.waitFor(() => {
      expect(latestPreviewUrls).toEqual({ 'photo-a': 'blob:preview-1' });
    });
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).not.toHaveBeenCalled();
    harness.unmount();
  });

  it('previews images picked as files, and revokes a replaced File even when its client ID is reused', async () => {
    const first = { ...makeAttachment('same-id', 'file'), file: new File(['svg'], 'picture.svg') };
    const harness = renderHookHarness({ attachments: [first], isShellView: false });
    await vi.waitFor(() => expect(latestPreviewUrls).toEqual({ 'same-id': 'blob:preview-1' }));
    const second = { ...first, file: new File(['new svg'], 'picture.svg') };
    harness.rerender({ attachments: [second], isShellView: false });
    await vi.waitFor(() => expect(latestPreviewUrls).toEqual({ 'same-id': 'blob:preview-2' }));
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:preview-1');
    harness.unmount();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:preview-2');
  });

  it('previews an extensionless image by MIME without changing its upload kind', async () => {
    const image = { ...makeAttachment('mime-image', 'file'), file: new File(['png'], 'Screenshot', { type: 'image/png' }) };
    const harness = renderHookHarness({ attachments: [image], isShellView: false });
    await vi.waitFor(() => expect(latestPreviewUrls).toEqual({ 'mime-image': 'blob:preview-1' }));
    expect(image.kind).toBe('file');
    harness.unmount();
  });

  it('does not update state when a new array has the same entries (ELA-229)', async () => {
    const photo = makeAttachment('photo-a', 'photo');
    const empty = renderHookHarness({ attachments: [], isShellView: false });
    const initialMap = latestPreviewUrls;
    harnessRenders = 0;
    // Each keystroke used to hand over a fresh empty array and re-set the map.
    for (let index = 0; index < 60; index += 1) {
      empty.rerender({ attachments: [], isShellView: false });
      await Promise.resolve();
    }
    expect(harnessRenders).toBe(60);
    expect(latestPreviewUrls).toBe(initialMap);
    empty.unmount();

    const withPhoto = renderHookHarness({ attachments: [photo], isShellView: false });
    await vi.waitFor(() => {
      expect(latestPreviewUrls).toEqual({ 'photo-a': 'blob:preview-1' });
    });
    const photoMap = latestPreviewUrls;
    harnessRenders = 0;
    withPhoto.rerender({ attachments: [photo], isShellView: false });
    await Promise.resolve();
    expect(harnessRenders).toBe(1);
    expect(latestPreviewUrls).toBe(photoMap);
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    withPhoto.unmount();
  });

  it('revokes URLs for removed photos and on unmount', async () => {
    const firstPhoto = makeAttachment('photo-a', 'photo');
    const secondPhoto = makeAttachment('photo-b', 'photo');
    const harness = renderHookHarness({
      attachments: [firstPhoto, secondPhoto],
      isShellView: false,
    });

    await vi.waitFor(() => {
      expect(latestPreviewUrls).toEqual({
        'photo-a': 'blob:preview-1',
        'photo-b': 'blob:preview-2',
      });
    });

    harness.rerender({
      attachments: [secondPhoto],
      isShellView: false,
    });

    await vi.waitFor(() => {
      expect(latestPreviewUrls).toEqual({ 'photo-b': 'blob:preview-2' });
    });
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:preview-1');

    harness.unmount();

    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:preview-2');
  });

  it('clears and revokes preview URLs while shell view is active', async () => {
    const photo = makeAttachment('photo-a', 'photo');
    const harness = renderHookHarness({
      attachments: [photo],
      isShellView: false,
    });

    await vi.waitFor(() => {
      expect(latestPreviewUrls).toEqual({ 'photo-a': 'blob:preview-1' });
    });

    harness.rerender({
      attachments: [photo],
      isShellView: true,
    });

    await vi.waitFor(() => {
      expect(latestPreviewUrls).toEqual({});
    });
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:preview-1');

    harness.rerender({
      attachments: [photo],
      isShellView: false,
    });

    await vi.waitFor(() => {
      expect(latestPreviewUrls).toEqual({ 'photo-a': 'blob:preview-2' });
    });
    harness.unmount();
  });
});
