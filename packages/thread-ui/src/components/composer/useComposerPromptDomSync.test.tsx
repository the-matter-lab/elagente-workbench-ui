// @vitest-environment jsdom
import { createRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { serializeEditorPrompt } from './contentEditablePrompt';
import { useComposerPromptDomSync } from './useComposerPromptDomSync';
import type { PromptSegment } from './composerUtils';
import { setLocale } from '../../i18n';

it('refreshes count text and action labels when language changes without replacing the attachment identity', () => {
  setLocale('en', false);
  const editor = document.createElement('div');
  document.body.append(editor);
  const editorRef = { current: editor };
  const segments: PromptSegment[] = [{ type: 'attachment', key: 'pdf', attachment: {
    clientId: 'pdf', placeholder: '[FILE report.pdf]', kind: 'file', originalName: 'report.pdf', file: new File([], 'report.pdf'),
  } }];
  const metadata = { pdf: { pageCount: 3 } };
  const pending = { current: null }, inserted = { current: [] }, preview = { current: '' };
  const urls = {};
  function Harness() {
    useComposerPromptDomSync({ promptRef: editorRef, isShellView: false,
      prompt: '[FILE report.pdf]', promptSegments: segments, attachmentMetadata: metadata,
      attachmentPreviewUrls: urls, previewSignature: '', pendingSelectionRef: pending,
      pendingInsertedAttachmentIdsRef: inserted, selectionSnapshotRef: pending,
      renderedPreviewSignatureRef: preview, serializeEditorPrompt: () => serializeEditorPrompt(editor), restoreSelection: () => {},
    });
    return null;
  }
  const root = createRoot(document.createElement('div'));
  try {
    flushSync(() => root.render(<Harness />));
    const token = editor.firstChild;
    expect(editor.querySelector('.composer-file-meta')?.textContent).toBe('3 pages');
    flushSync(() => setLocale('zh-CN', false));
    expect(editor.firstChild).toBe(token);
    expect(editor.querySelector('.composer-file-meta')?.textContent).toBe('3 页');
    expect(editor.querySelector('[data-remove-attachment]')?.getAttribute('aria-label')).toBe('移除: report.pdf');
    expect(serializeEditorPrompt(editor)).toBe('[FILE report.pdf]');
  } finally {
    flushSync(() => root.unmount());
    setLocale('en', false);
    editor.remove();
  }
});

it('updates an asynchronous image preview without replacing dictation text or moving its selection', () => {
  const editor = document.createElement('div');
  editor.tabIndex = 0;
  editor.innerHTML = '<span style="color:inherit">dictated text</span><span data-segment-type="attachment" data-client-id="photo" data-placeholder="[PHOTO a.png]" contenteditable="false"></span> tail';
  document.body.append(editor);
  const dictated = editor.firstChild!.firstChild!;
  const editorRef = createRef<HTMLDivElement>();
  editorRef.current = editor;
  const segments: PromptSegment[] = [
    { type: 'text', key: 'before', text: 'dictated text' },
    { type: 'attachment', key: 'photo', attachment: { clientId: 'photo', placeholder: '[PHOTO a.png]', kind: 'photo', originalName: 'a.png', file: new File([], 'a.png') } },
    { type: 'text', key: 'after', text: ' tail' },
  ];
  const pending = { current: null };
  const inserted = { current: [] };
  const preview = { current: '' };
  function Harness({ url }: { url: string }) {
    useComposerPromptDomSync({ promptRef: editorRef, isShellView: false,
      prompt: 'dictated text[PHOTO a.png] tail', promptSegments: segments,
      attachmentPreviewUrls: url ? { photo: url } : {}, previewSignature: url,
      pendingSelectionRef: pending, pendingInsertedAttachmentIdsRef: inserted,
      selectionSnapshotRef: pending, renderedPreviewSignatureRef: preview,
      serializeEditorPrompt: () => serializeEditorPrompt(editor), restoreSelection: () => { throw new Error('Native selection must not be restored'); },
    });
    return null;
  }
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(<Harness url="" />));
  editor.focus();
  const range = document.createRange();
  range.setStart(dictated, 3); range.collapse(true);
  window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range);
  flushSync(() => root.render(<Harness url="blob:preview" />));
  expect(editor.firstChild!.firstChild).toBe(dictated);
  expect(window.getSelection()?.anchorNode).toBe(dictated);
  expect(window.getSelection()?.anchorOffset).toBe(3);
  expect(editor.querySelector('img')?.getAttribute('src')).toBe('blob:preview');
  expect(serializeEditorPrompt(editor)).toBe('dictated text[PHOTO a.png] tail');
  flushSync(() => root.unmount());
  editor.remove();
});

it('does not rebuild the editor from a render that lags behind its input events (ELA-229)', () => {
  const editor = document.createElement('div');
  editor.textContent = 'line one\nline two';
  document.body.append(editor);
  const typed = editor.firstChild;
  const editorRef = createRef<HTMLDivElement>();
  editorRef.current = editor;
  let latest = 'line one\nline two';
  const pending = { current: null };
  const inserted = { current: [] };
  const preview = { current: '' };
  function Harness({ prompt }: { prompt: string }) {
    useComposerPromptDomSync({ promptRef: editorRef, isShellView: false,
      prompt, promptSegments: prompt ? [{ type: 'text', key: 'text', text: prompt }] : [],
      attachmentPreviewUrls: {}, previewSignature: '',
      pendingSelectionRef: pending, pendingInsertedAttachmentIdsRef: inserted,
      selectionSnapshotRef: pending, renderedPreviewSignatureRef: preview,
      serializeEditorPrompt: () => serializeEditorPrompt(editor),
      readLatestPrompt: () => latest,
      restoreSelection: () => {},
    });
    return null;
  }
  const root = createRoot(document.createElement('div'));
  // The draft already holds both lines; this render still has only the first.
  flushSync(() => root.render(<Harness prompt="line one" />));
  expect(editor.firstChild).toBe(typed);
  expect(serializeEditorPrompt(editor)).toBe('line one\nline two');
  // A change that is not the editor's own text (a send clearing it) still syncs.
  latest = '';
  flushSync(() => root.render(<Harness prompt="" />));
  expect(serializeEditorPrompt(editor)).toBe('');
  flushSync(() => root.unmount());
  editor.remove();
});
