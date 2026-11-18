import { useI18n } from '../../i18n';
import {
  useLayoutEffect,
  type MutableRefObject,
  type RefObject,
} from 'react';

import {
  type PromptSegment,
  type PromptSelectionRange,
} from './composerUtils';
import { composerAttachmentName, createPromptAttachmentToken } from './composerAttachmentToken';
import { sharedFilenameSuffix, type ComposerFileMetadata } from './composerFileChips';
import { restoreSelectionAfterInsertedAttachments } from './contentEditablePrompt';

interface UseComposerPromptDomSyncInput {
  promptRef: RefObject<HTMLDivElement | null>;
  isShellView: boolean;
  prompt: string;
  promptSegments: PromptSegment[];
  attachmentPreviewUrls: Record<string, string>;
  attachmentMetadata?: Record<string, ComposerFileMetadata>;
  previewSignature: string;
  pendingSelectionRef: MutableRefObject<PromptSelectionRange | null>;
  pendingInsertedAttachmentIdsRef: MutableRefObject<string[]>;
  selectionSnapshotRef: MutableRefObject<PromptSelectionRange | null>;
  renderedPreviewSignatureRef: MutableRefObject<string>;
  serializeEditorPrompt: () => string;
  /** The newest draft prompt, which may not be rendered yet. */
  readLatestPrompt?: () => string;
  restoreSelection: (selection: PromptSelectionRange | null) => void;
}

function buildPromptFragment(
  promptSegments: PromptSegment[],
  attachmentPreviewUrls: Record<string, string>,
  suffix: string,
  metadata: Record<string, ComposerFileMetadata>,
) {
  const fragment = document.createDocumentFragment();

  for (const segment of promptSegments) {
    if (segment.type === 'text') {
      fragment.append(
        document.createTextNode(segment.text === ' ' ? '\u00a0' : segment.text),
      );
      continue;
    }

    fragment.append(createPromptAttachmentToken(segment, attachmentPreviewUrls, suffix, metadata[segment.attachment.clientId]));
  }

  return fragment;
}

export function useComposerPromptDomSync({
  promptRef,
  isShellView,
  prompt,
  promptSegments,
  attachmentPreviewUrls,
  attachmentMetadata = {},
  previewSignature,
  pendingSelectionRef,
  pendingInsertedAttachmentIdsRef,
  selectionSnapshotRef,
  renderedPreviewSignatureRef,
  serializeEditorPrompt,
  readLatestPrompt,
  restoreSelection,
}: UseComposerPromptDomSyncInput) {
  const { locale } = useI18n();
  useLayoutEffect(() => {
    const editor = promptRef.current;
    if (!editor || isShellView || editor.dataset.imeComposing === 'true') {
      return;
    }

    const pendingSelection = pendingSelectionRef.current;
    const editorPrompt = serializeEditorPrompt();
    const latestPrompt = readLatestPrompt?.() ?? prompt;
    // During a burst of input events the editor can be ahead of this render
    // while its newer text is already the pending draft. Rebuilding the DOM
    // from the stale prompt would drop that text (ELA-229).
    const shouldSyncDom = editorPrompt !== prompt &&
      !(latestPrompt !== prompt && editorPrompt === latestPrompt);

    const attachmentSegments = promptSegments.filter(segment => segment.type === 'attachment');
    const suffix = sharedFilenameSuffix(attachmentSegments.map(composerAttachmentName));
    if (shouldSyncDom) {
      editor.replaceChildren(
        buildPromptFragment(promptSegments, attachmentPreviewUrls, suffix, attachmentMetadata),
      );
    } else {
      // A thumbnail becoming available must not replace the text nodes tracked
      // by native dictation/autocorrection, or disturb its live selection.
      const attachments = new Map(promptSegments.flatMap(segment =>
        segment.type === 'attachment' ? [[segment.attachment.clientId, segment] as const] : [],
      ));
      for (const token of editor.querySelectorAll<HTMLElement>('[data-segment-type="attachment"]')) {
        const segment = attachments.get(token.dataset.clientId ?? '');
        if (segment) createPromptAttachmentToken(segment, attachmentPreviewUrls, suffix, attachmentMetadata[segment.attachment.clientId], token);
      }
    }
    renderedPreviewSignatureRef.current = previewSignature;

    if (pendingSelection !== null) {
      editor.focus();
      if (
        !restoreSelectionAfterInsertedAttachments(
          editor,
          pendingInsertedAttachmentIdsRef.current,
        )
      ) {
        restoreSelection(pendingSelection);
      }
      selectionSnapshotRef.current = pendingSelection;
    } else if (document.activeElement === editor && shouldSyncDom) {
      restoreSelection(selectionSnapshotRef.current);
    }

    pendingSelectionRef.current = null;
    pendingInsertedAttachmentIdsRef.current = [];
  }, [
    attachmentPreviewUrls,
    attachmentMetadata,
    locale,
    isShellView,
    previewSignature,
    prompt,
    promptRef,
    promptSegments,
    pendingInsertedAttachmentIdsRef,
    pendingSelectionRef,
    renderedPreviewSignatureRef,
    readLatestPrompt,
    restoreSelection,
    selectionSnapshotRef,
    serializeEditorPrompt,
  ]);
}
