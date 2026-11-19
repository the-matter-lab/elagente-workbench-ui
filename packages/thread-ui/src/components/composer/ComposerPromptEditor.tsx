import { translate, useI18n } from '../../i18n';
import { useRef, useState } from 'react';
import { GraphWorkspaceImageLightbox } from '../ZoomableImage';
import { X } from 'lucide-react';
import { AttachmentCard, FloatingCard, ViewAction } from '../attachments/AttachmentTile';
import type { FileFamily } from '../attachments/attachmentFiles';
import type {
  ClipboardEvent,
  DragEvent,
  KeyboardEvent,
  PointerEvent,
  RefObject,
} from 'react';

interface ComposerPromptEditorProps {
  promptRef: RefObject<HTMLDivElement | null>;
  prompt: string;
  disabled: boolean;
  promptPlaceholder: string;
  /** How to send, shown after the placeholder where there is a keyboard. */
  promptPlaceholderHint?: string;
  canInterrupt: boolean;
  interruptLabel: string;
  composerPromptRegionClassName: string;
  graphChatInputClassName: string;
  onInterrupt?: () => Promise<void> | void;
  onInput: () => void;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLDivElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onKeyUp: () => void;
  onMouseUp: () => void;
  onBlur: () => void;
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}

function hasIOSNativeBridge() {
  const nativeWindow = window as Window & {
    webkit?: {
      messageHandlers?: {
        remoteCodex?: unknown;
      };
    };
  };
  return Boolean(nativeWindow.webkit?.messageHandlers?.remoteCodex);
}

export function ComposerPromptEditor({
  promptRef,
  prompt,
  disabled,
  promptPlaceholder,
  promptPlaceholderHint = '',
  composerPromptRegionClassName,
  graphChatInputClassName,
  onInput,
  onPointerDown,
  onPaste,
  onKeyDown,
  onKeyUp,
  onMouseUp,
  onBlur,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: ComposerPromptEditorProps) {
  useI18n();
  const previewTrigger = useRef<HTMLElement | null>(null);
  const [preview, setPreview] = useState<{src: string; alt: string} | null>(null);
  // An attachment tile opens its card: name, kind, size, and view or remove.
  const [details, setDetails] = useState<HTMLElement | null>(null);
  function attachmentTile(target: EventTarget | null) {
    return target instanceof Element ? target.closest<HTMLElement>('[data-segment-type="attachment"]') : null;
  }
  function isRemove(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest('[data-remove-attachment]'));
  }
  function removeAttachment(tile: HTMLElement) {
    tile.remove();
    setDetails(null);
    onInput();
    promptRef.current?.focus({ preventScroll: true });
  }
  const detailsImage = details?.querySelector('img');
  const view = details && detailsImage ? () => {
    previewTrigger.current = details;
    setDetails(null);
    setPreview({ src: detailsImage.src, alt: details.dataset.name ?? '' });
  } : undefined;
  return (
    <div
      data-slot="input-group-control"
      className={`${composerPromptRegionClassName} relative w-full`}
    >
      <div className={graphChatInputClassName}>
        {prompt.length === 0 && promptPlaceholder && (
          <span
            className={`thread-composer-placeholder pointer-events-none absolute left-3 top-3 truncate text-slate-500 sm:left-4 sm:top-4 dark:text-slate-400 right-3 sm:right-4`}
          >
            {promptPlaceholder}
            {promptPlaceholderHint ? <span className="thread-composer-placeholder-hint">{promptPlaceholderHint}</span> : null}
          </span>
        )}
        <div
          ref={promptRef}
          role="textbox"
          aria-label={translate("chat.prompt")}
          aria-multiline="true"
          contentEditable={disabled ? false : 'plaintext-only'}
          inputMode="text"
          suppressContentEditableWarning
          onClick={event => {
            const tile = attachmentTile(event.target);
            if (tile) {
              event.preventDefault();
              if (isRemove(event.target)) removeAttachment(tile);
              else setDetails(current => current === tile ? null : tile);
            }
          }}
          onPointerDown={(event) => {
            if (attachmentTile(event.target)) { event.preventDefault(); return; }
            if (
              !disabled &&
              document.activeElement !== event.currentTarget &&
              hasIOSNativeBridge()
            ) {
              // WKWebView only opens the software keyboard reliably when focus
              // is requested synchronously from the user's touch gesture.
              event.currentTarget.focus({ preventScroll: true });
            }
            onPointerDown?.(event);
          }}
          onCompositionStart={event => {
            event.currentTarget.dataset.imeComposing = 'true';
          }}
          onCompositionEnd={event => {
            delete event.currentTarget.dataset.imeComposing;
            onInput();
          }}
          onInput={onInput}
          onPaste={onPaste}
          onKeyDown={event => {
            if (event.currentTarget.dataset.imeComposing === 'true' || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
            const tile = attachmentTile(event.target);
            if (tile && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              if (isRemove(event.target)) removeAttachment(tile);
              else setDetails(tile);
              return;
            }
            onKeyDown(event);
          }}
          onKeyUp={onKeyUp}
          onMouseUp={onMouseUp}
          onBlur={onBlur}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`relative z-[1] min-h-[4.25rem] whitespace-pre-wrap break-words pb-2 outline-none sm:min-h-[4.25rem] ${disabled ? 'cursor-not-allowed text-slate-500' : ''}`}
        />
      </div>
      {details?.isConnected ? (
        <FloatingCard anchor={details} onClose={() => setDetails(null)}>
          <AttachmentCard name={details.dataset.name ?? ''} family={(details.dataset.family ?? 'other') as FileFamily}
            size={details.dataset.size ? Number(details.dataset.size) : undefined} thumbnail={detailsImage?.src} onView={view}
            actions={<>
              {view ? <ViewAction onClick={view} /> : null}
              <button type="button" className="is-danger" onClick={() => {
                removeAttachment(details);
              }}><X aria-hidden="true" />{translate('chat.attachmentRemove')}</button>
            </>} />
        </FloatingCard>
      ) : null}
      {preview ? <GraphWorkspaceImageLightbox src={preview.src} alt={preview.alt} onClose={() => {
        setPreview(null);
        previewTrigger.current?.focus({preventScroll: true});
      }} /> : null}
    </div>
  );
}
