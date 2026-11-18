// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PromptAttachmentUpload } from '../types';
import { ThreadComposer, type ThreadComposerProps } from './ThreadComposer';

let root: Root;
let host: HTMLDivElement;
const submit = vi.fn();

function attachments(count: number): PromptAttachmentUpload[] {
  return Array.from({ length: count }, (_, index) => ({
    clientId: `file-${index}`,
    kind: 'file',
    originalName: `molecule-${index}.xyz`,
    placeholder: `[FILE molecule-${index}.xyz]`,
    file: new File(['original'], `molecule-${index}.xyz`),
  }));
}

async function render(props: Partial<ThreadComposerProps> = {}) {
  await act(async () => root.render(<ThreadComposer activeView="chat" onSubmit={submit} {...props} />));
}

function editor() {
  return host.querySelector<HTMLElement>('[role="textbox"]')!;
}

async function pressEnter(modifiers: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...modifiers });
  await act(async () => editor().dispatchEvent(event));
  return event;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
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

describe('composer attachment limit', () => {
  it.each([11, 30])('blocks click, form, Ctrl+Enter and steering for %i attachments without clearing', async count => {
    const files = attachments(count);
    await render({
      attachmentLimit: { count, max: 10 },
      draftPrompt: `Keep this draft ${files.map(file => file.placeholder).join(' ')}`, draftAttachments: files, onDraftChange: vi.fn(),
    });
    const send = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(send.disabled).toBe(true);
    expect(editor().getAttribute('contenteditable')).toBe('plaintext-only');
    await act(async () => send.click());
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect((await pressEnter({ ctrlKey: true })).defaultPrevented).toBe(true);
    expect((await pressEnter({ ctrlKey: true, shiftKey: true })).defaultPrevented).toBe(true);
    expect(submit).not.toHaveBeenCalled();
    expect(editor().textContent).toContain('Keep this draft');
    expect(host.querySelectorAll('[data-remove-attachment]')).toHaveLength(count);
  });

  it('blocks the Enter shortcut while leaving ordinary editing available', async () => {
    await render({ attachmentLimit: { count: 11, max: 10 }, sendShortcut: 'enter' });
    expect((await pressEnter()).defaultPrevented).toBe(true);
    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    await act(async () => editor().dispatchEvent(event));
    expect(event.defaultPrevented).toBe(false);
    expect(submit).not.toHaveBeenCalled();
  });

  it('guards the latest draft when attachments arrive before the host count rerenders', async () => {
    const onDraftChange = vi.fn();
    await render({
      attachmentLimit: { count: 0, max: 10 },
      draftPrompt: 'Keep this draft', draftAttachments: [], onDraftChange,
    });
    const files = attachments(11).map(attachment => attachment.file);
    const input = host.querySelectorAll<HTMLInputElement>('input[type="file"]')[1];
    Object.defineProperty(input, 'files', { configurable: true, value: files });
    // Both DOM events run before React can commit a new render.
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      editor().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
      host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(submit).not.toHaveBeenCalled();
    expect(editor().textContent).toContain('Keep this draft');
    expect(host.querySelectorAll('[data-remove-attachment]')).toHaveLength(11);
  });

  it('allows removal and interrupt while invalid, then sends the remaining original files at the limit', async () => {
    const files = attachments(11);
    const onInterrupt = vi.fn();
    function Harness() {
      const [draft, setDraft] = useState({ prompt: files.map(file => file.placeholder).join(' '), attachments: files });
      return <ThreadComposer activeView="chat" onSubmit={submit}
        draftPrompt={draft.prompt} draftAttachments={draft.attachments} onDraftChange={setDraft}
        attachmentLimit={{ count: draft.attachments.length, max: 10 }}
        canInterrupt threadRunning onInterrupt={onInterrupt} />;
    }
    await act(async () => root.render(<Harness />));
    const stop = host.querySelector<HTMLButtonElement>('[aria-label="Stop Current Turn"]')!;
    expect(stop.disabled).toBe(false);
    await act(async () => stop.click());
    expect(onInterrupt).toHaveBeenCalledOnce();
    const remove = host.querySelector<HTMLButtonElement>('[data-remove-attachment]')!;
    expect(remove.disabled).toBe(false);
    await act(async () => remove.click());
    // Contenteditable changes persist to the controlled host after its debounce.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 190)); });
    expect(host.querySelector('.composer-attachment-limit-alert')).toBeNull();
    const send = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(send.disabled).toBe(false);
    await act(async () => send.click());
    expect(submit).toHaveBeenCalledOnce();
    expect(submit.mock.calls[0][0].attachments.map((attachment: PromptAttachmentUpload) => attachment.file)).toEqual(files.slice(1).map(file => file.file));
  });

  it.each([
    { attachmentLimit: undefined, count: 11 },
    { attachmentLimit: { count: 10, max: 10 }, count: 10 },
  ])('allows $count attachments with $attachmentLimit and no warning', async ({ attachmentLimit, count }) => {
    const files = attachments(count);
    await render({ attachmentLimit, draftPrompt: `Send these ${files.map(file => file.placeholder).join(' ')}`, draftAttachments: files, onDraftChange: vi.fn() });
    expect(host.querySelector('.composer-attachment-limit-alert')).toBeNull();
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    await pressEnter({ ctrlKey: true });
    expect(submit).toHaveBeenCalledOnce();
    expect(submit.mock.calls[0][0].attachments).toHaveLength(count);
  });

  it('leaves shell submission unaffected by the chat attachment limit', async () => {
    await render({ activeView: 'shell', attachmentLimit: { count: 30, max: 10 } });
    const textarea = host.querySelector('textarea')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'pwd');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(host.querySelector('.composer-attachment-limit-alert')).toBeNull();
    expect(submit).toHaveBeenCalledWith({ prompt: 'pwd' });
  });
});
