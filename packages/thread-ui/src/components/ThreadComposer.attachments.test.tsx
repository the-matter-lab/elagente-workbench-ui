// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThreadComposer, type ThreadComposerProps } from './ThreadComposer';
import type { PromptAttachmentUpload } from '../types';

let root: Root, host: HTMLDivElement;
let draft: { prompt: string; attachments: PromptAttachmentUpload[] };
const submit = vi.fn();
function Harness({
  caps,
  initial,
  picker,
  busy = false,
  error,
}: {
  caps?: ThreadComposerProps['attachmentCapabilities'];
  initial?: { prompt: string; attachments: PromptAttachmentUpload[] };
  picker?: ThreadComposerProps['onPickAttachment'];
  busy?: boolean;
  error?: string;
}) {
  const [value, setValue] = useState(
    initial ?? { prompt: '', attachments: [] },
  );
  draft = value;
  return (
    <ThreadComposer
      activeView="chat"
      busy={busy}
      disabled={busy}
      threadRunning={busy}
      error={error}
      onSubmit={submit}
      attachmentCapabilities={caps}
      onPickAttachment={picker}
      draftPrompt={value.prompt}
      draftAttachments={value.attachments}
      onDraftChange={setValue}
    />
  );
}
async function render(
  caps?: ThreadComposerProps['attachmentCapabilities'],
  initial?: { prompt: string; attachments: PromptAttachmentUpload[] },
  picker?: ThreadComposerProps['onPickAttachment'],
) {
  await act(async () =>
    root.render(<Harness caps={caps} initial={initial} picker={picker} />),
  );
}
function image(type = 'image/png') {
  return new File(['image'], 'image.png', { type });
}
function text() {
  return new File(['text'], 'notes.txt', { type: 'text/plain' });
}
async function transfer(kind: 'paste' | 'drop', files: File[]) {
  const event = new Event(kind, { bubbles: true, cancelable: true });
  Object.defineProperty(
    event,
    kind === 'paste' ? 'clipboardData' : 'dataTransfer',
    { value: { files, items: [], getData: () => '' } },
  );
  await act(async () =>
    host.querySelector('[role="textbox"]')?.dispatchEvent(event),
  );
  return event;
}
async function chooseFile(index: number, files: File[]) {
  const input =
    host.querySelectorAll<HTMLInputElement>('input[type="file"]')[index];
  Object.defineProperty(input, 'files', { configurable: true, value: files });
  await act(async () =>
    input.dispatchEvent(new Event('change', { bubbles: true })),
  );
}
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  submit.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe('composer filename chips', () => {
  it('keeps exact names, dims only shared endings, and removes directly without submitting', async () => {
    await render();
    const files = ['Caffeine_openbabel.xyz', 'theobromine_openbabel.xyz'].map(name => new File(['original'], name));
    await chooseFile(1, files);
    const chips = [...host.querySelectorAll<HTMLElement>('.composer-file-chip')];
    expect(chips.map(chip => chip.querySelector('.composer-file-name')?.textContent)).toEqual(files.map(file => file.name));
    expect(chips.map(chip => chip.querySelector('.composer-file-badge')?.textContent)).toEqual(['XYZ', 'XYZ']);
    expect(chips.map(chip => [...chip.querySelectorAll('.composer-file-name-shared')].map(part => part.textContent).join(''))).toEqual(['_openbabel.xyz', '_openbabel.xyz']);
    expect(chips[0].title).toBe(files[0].name);
    await act(async () => chips[0].querySelector<HTMLButtonElement>('[data-remove-attachment]')?.click());
    expect(host.querySelectorAll('.composer-file-chip')).toHaveLength(1);
    expect(host.querySelector('.composer-file-name-shared')).toBeNull();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 190)); });
    expect(draft.attachments).toHaveLength(1);
    expect(draft.attachments[0].file).toBe(files[1]);
    expect(submit).not.toHaveBeenCalled();
  });

  it('uses thumbnails for an image picked as File, and keeps mixed filenames normal', async () => {
    await render();
    const files = [new File(['svg'], 'exact Picture.svg', { type: 'image/svg+xml' }), new File(['text'], 'report.OUT')];
    await chooseFile(1, files);
    expect(host.querySelector('.composer-file-thumbnail img')?.getAttribute('src')).toBe('blob:preview');
    expect(host.querySelectorAll('.composer-file-name-shared')).toHaveLength(0);
    expect(host.querySelector('.composer-file-meta')?.textContent).toBe('4 B');
    expect(draft.attachments[0].kind).toBe('file');
    const image = host.querySelector('img')!;
    await act(async () => image.dispatchEvent(new Event('error')));
    expect(host.querySelector('.composer-file-badge')?.textContent).toBe('SVG');
  });

  it('retains long names and exact File objects on submit; keyboard removal never submits', async () => {
    await render();
    const name = 'A very long uploaded molecule Name with a charged ion and unicode CO₂.XYZ';
    const files = [new File(['bytes'], name), new File(['notes'], 'unknown.qwe')];
    await chooseFile(1, files);
    const chip = host.querySelector<HTMLElement>('.composer-file-chip')!;
    expect(chip.querySelector('.composer-file-name')?.textContent).toBe(name);
    expect(chip.querySelector('.composer-file-name-tail')?.textContent).toMatch(/\.XYZ$/);
    expect(chip.title).toBe(name);
    expect(host.querySelectorAll('.composer-file-badge')[1].textContent).toBe('FILE');
    await act(async () => host.querySelectorAll<HTMLButtonElement>('[data-remove-attachment]')[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 190)); });
    expect(draft.attachments).toHaveLength(1);
    expect(submit).not.toHaveBeenCalled();
    await act(async () => host.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(submit).toHaveBeenCalledOnce();
    expect(submit.mock.calls[0][0].attachments[0].file).toBe(files[0]);
  });
});

describe('composer attachment capability admission', () => {
  it('dismisses a rejection while busy without submitting or losing the draft, then shows a new rejection', async () => {
    await render({ files: true, images: false }, { prompt: 'Keep this draft', attachments: [] });
    await transfer('paste', [image()]);
    expect(host.querySelector('[role="alert"]')).not.toBeNull();

    await act(async () => root.render(<Harness caps={{ files: true, images: false }} busy />));
    const dismiss = host.querySelector<HTMLButtonElement>('[aria-label="Dismiss attachment error"]');
    expect(dismiss).not.toBeNull();
    expect(dismiss?.disabled).toBe(false);
    await act(async () => dismiss?.click());
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(submit).not.toHaveBeenCalled();
    expect(draft.prompt).toBe('Keep this draft');
    expect(draft.attachments).toEqual([]);

    await render({ files: true, images: false });
    await transfer('paste', [image()]);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('unavailable');
  });

  it('does not offer attachment dismissal for a host error', async () => {
    await render({ files: true, images: false });
    await transfer('paste', [image()]);
    await act(async () => root.render(<Harness caps={{ files: true, images: false }} error="Connection failed" />));
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Connection failed');
    expect(host.querySelector('[aria-label="Dismiss attachment error"]')).toBeNull();
  });

  it('omission preserves the generic photo and file menu', async () => {
    await render();
    await act(async () =>
      host
        .querySelector<HTMLButtonElement>('[aria-label="Add attachment"]')
        ?.click(),
    );
    expect(document.body.textContent).toContain('Photo');
    expect(document.body.textContent).toContain('File');
    await transfer('paste', [image()]);
    expect(draft.attachments[0]?.kind).toBe('photo');
  });
  it.each([
    { files: true, images: false },
    { files: false, images: true },
    { files: false, images: false },
  ])('gates menu and hidden inputs for %j', async (caps) => {
    await render(caps);
    const add = host.querySelector<HTMLButtonElement>(
      '[aria-label="Add attachment"]',
    );
    expect(Boolean(add)).toBe(caps.files || caps.images);
    await act(async () => add?.click());
    const labels = [...document.querySelectorAll('button')].map((button) =>
      button.textContent?.trim(),
    );
    expect(labels.includes('Photo')).toBe(caps.images);
    expect(labels.includes('File')).toBe(caps.files);
    const inputs =
      host.querySelectorAll<HTMLInputElement>('input[type="file"]');
    expect(inputs[0].disabled).toBe(!caps.images);
    expect(inputs[1].disabled).toBe(!caps.files);
  });
  it.each(['paste', 'drop'] as const)(
    'rejects image %s visibly while admitting ordinary files',
    async (kind) => {
      await render({ files: true, images: false });
      const event = await transfer(kind, [image(), text()]);
      expect(event.defaultPrevented).toBe(true);
      expect(draft.attachments.map((value) => value.originalName)).toEqual([
        'notes.txt',
      ]);
      expect(host.querySelector('[role="alert"]')?.textContent).toContain(
        'unavailable',
      );
    },
  );
  it('does not admit disabled images through the ordinary file picker or an empty MIME', async () => {
    await render({ files: true, images: false });
    await chooseFile(1, [image(), image('')]);
    expect(draft.attachments).toEqual([]);
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
  });
  it('admits only photos when ordinary files are disabled', async () => {
    await render({ files: false, images: true });
    await transfer('drop', [text(), image()]);
    expect(draft.attachments.map((value) => value.kind)).toEqual(['photo']);
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
  });
  it('keeps existing photo previews and removal after the model disables images', async () => {
    const photo: PromptAttachmentUpload = {
      clientId: 'old',
      kind: 'photo',
      originalName: 'image.png',
      placeholder: '[PHOTO image.png]',
      file: image(),
    };
    await render(
      { files: true, images: true },
      { prompt: photo.placeholder, attachments: [photo] },
    );
    await render({ files: true, images: false });
    expect(draft.attachments).toEqual([photo]);
    expect(host.querySelector('img')?.getAttribute('src')).toBe('blob:preview');
    const editor = host.querySelector<HTMLElement>('[role="textbox"]')!;
    vi.useFakeTimers();
    await act(async () => {
      editor.replaceChildren();
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    expect(draft.attachments).toEqual([]);
  });
  it('checks the current gate when a prior custom picker returns after model switch', async () => {
    let append!: (files: FileList | null) => boolean;
    const picker: ThreadComposerProps['onPickAttachment'] = (input) => {
      append = input.appendAttachments;
    };
    await render({ files: true, images: true }, undefined, picker);
    await act(async () =>
      host
        .querySelector<HTMLButtonElement>('[aria-label="Add attachment"]')
        ?.click(),
    );
    const photoButton = [
      ...document.querySelectorAll<HTMLButtonElement>('button'),
    ].find((button) => button.textContent === 'Photo');
    await act(async () => photoButton?.click());
    expect(append).toBeTypeOf('function');
    await render({ files: true, images: false }, undefined, picker);
    await act(async () =>
      expect(append([image()] as unknown as FileList)).toBe(false),
    );
    expect(draft.attachments).toEqual([]);
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
  });
});
