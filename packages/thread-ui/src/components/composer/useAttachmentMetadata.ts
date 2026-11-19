import { useEffect, useRef, useState } from 'react';

import type { ComposerAttachmentDraft } from './composerUtils';
import {
  readAttachmentMetadata,
  supportsAttachmentMetadata,
  type AttachmentMetadata,
} from './attachmentMetadata';

export type AttachmentMetadataMap = Record<string, AttachmentMetadata>;
type Pending = { controller: AbortController };

export function useAttachmentMetadata(
  attachments: ComposerAttachmentDraft[],
  enabled: boolean,
): AttachmentMetadataMap {
  const cache = useRef(new WeakMap<File, AttachmentMetadata | undefined>());
  const pending = useRef(new Map<File, Pending>());
  // One parser at a time bounds aggregate reads and worker memory, even when a
  // user drops many attachments at once. Queued jobs can be cancelled as well.
  const queue = useRef(Promise.resolve());
  const active = useRef(new Map<string, File>());
  const shown = useRef<AttachmentMetadataMap>({});
  const visibleMap = useRef<AttachmentMetadataMap>({});
  const [metadata, setMetadata] = useState<AttachmentMetadataMap>({});
  const publish = useRef(() => {});

  publish.current = () => {
    const next: AttachmentMetadataMap = {};
    for (const [clientId, file] of active.current) {
      const value = cache.current.get(file);
      if (value) next[clientId] = value;
    }
    const keys = Object.keys(next);
    if (keys.length === Object.keys(shown.current).length &&
        keys.every((key) => shown.current[key] === next[key])) return;
    shown.current = next;
    setMetadata(next);
  };

  useEffect(() => {
    const next = new Map<string, File>();
    if (enabled) {
      for (const attachment of attachments) {
        if (supportsAttachmentMetadata(attachment.file)) next.set(attachment.clientId, attachment.file);
      }
    }
    active.current = next;
    const files = new Set(next.values());
    for (const [file, job] of pending.current) {
      if (!files.has(file)) {
        pending.current.delete(file);
        job.controller.abort();
      }
    }
    for (const file of files) {
      if (cache.current.has(file) || pending.current.has(file)) continue;
      const job = { controller: new AbortController() };
      pending.current.set(file, job);
      queue.current = queue.current.then(async () => {
        if (job.controller.signal.aborted) return;
        const value = await readAttachmentMetadata(file, job.controller.signal);
        if (job.controller.signal.aborted || pending.current.get(file) !== job) return;
        pending.current.delete(file);
        cache.current.set(file, value);
        publish.current();
      });
    }
    publish.current();
  }, [attachments, enabled]);

  useEffect(() => () => {
    active.current.clear();
    for (const job of pending.current.values()) job.controller.abort();
    pending.current.clear();
  }, []);

  // Filter synchronously so a removed/replaced file cannot display a stale count
  // during the render before the effect reconciles pending work.
  const visible: AttachmentMetadataMap = {};
  if (enabled) {
    for (const attachment of attachments) {
      if (metadata[attachment.clientId] && active.current.get(attachment.clientId) === attachment.file) {
        visible[attachment.clientId] = metadata[attachment.clientId];
      }
    }
  }
  const keys = Object.keys(visible);
  if (keys.length !== Object.keys(visibleMap.current).length ||
      keys.some((key) => visibleMap.current[key] !== visible[key])) visibleMap.current = visible;
  return visibleMap.current;
}
