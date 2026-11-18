import { useEffect, useRef, useState } from 'react';

import type { ComposerAttachmentDraft } from './composerUtils';
import { composerImageFile } from './composerFileChips';

export type AttachmentPreviewMap = Record<string, string>;
type CachedPreview = { file: File; url: string };

function samePreviewUrls(current: AttachmentPreviewMap, next: AttachmentPreviewMap) {
  const keys = Object.keys(next);
  return keys.length === Object.keys(current).length &&
    keys.every((clientId) => current[clientId] === next[clientId]);
}

function revokeCachedPreviewUrls(previewUrlCache: Map<string, CachedPreview>) {
  for (const preview of previewUrlCache.values()) {
    URL.revokeObjectURL(preview.url);
  }
  previewUrlCache.clear();
}

export function useAttachmentPreviewUrls({
  attachments,
  isShellView,
}: {
  attachments: ComposerAttachmentDraft[];
  isShellView: boolean;
}) {
  const previewUrlCacheRef = useRef<Map<string, CachedPreview>>(new Map());
  const [attachmentPreviewUrls, setAttachmentPreviewUrls] =
    useState<AttachmentPreviewMap>({});
  const shownPreviewUrlsRef = useRef(attachmentPreviewUrls);

  useEffect(() => {
    const previewUrlCache = previewUrlCacheRef.current;
    // Typing re-runs this effect with a new (often empty) attachments array.
    // Even a bailing-out setState counts towards React's nested-update limit,
    // so only set the map when its entries change (ELA-229).
    const showPreviewUrls = (next: AttachmentPreviewMap) => {
      if (samePreviewUrls(shownPreviewUrlsRef.current, next)) return;
      shownPreviewUrlsRef.current = next;
      setAttachmentPreviewUrls(next);
    };

    if (isShellView) {
      revokeCachedPreviewUrls(previewUrlCache);
      showPreviewUrls({});
      return;
    }

    const nextPreviewUrls: AttachmentPreviewMap = {};
    const activeClientIds = new Set<string>();

    for (const attachment of attachments) {
      if (attachment.kind !== 'photo' && !attachment.file.type.startsWith('image/') && !composerImageFile(attachment.file.name)) {
        continue;
      }

      activeClientIds.add(attachment.clientId);
      let preview = previewUrlCache.get(attachment.clientId);
      if (preview?.file !== attachment.file) {
        if (preview) URL.revokeObjectURL(preview.url);
        preview = { file: attachment.file, url: URL.createObjectURL(attachment.file) };
        previewUrlCache.set(attachment.clientId, preview);
      }
      nextPreviewUrls[attachment.clientId] = preview.url;
    }

    for (const [clientId, preview] of previewUrlCache.entries()) {
      if (activeClientIds.has(clientId)) {
        continue;
      }
      URL.revokeObjectURL(preview.url);
      previewUrlCache.delete(clientId);
    }

    showPreviewUrls(nextPreviewUrls);
  }, [attachments, isShellView]);

  useEffect(() => {
    const previewUrlCache = previewUrlCacheRef.current;
    return () => {
      revokeCachedPreviewUrls(previewUrlCache);
    };
  }, []);

  return attachmentPreviewUrls;
}
