import { hasWorkspacePathSyntax } from '../workspacePathLinks';
import { translate, useI18n } from '../../i18n';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

import { messagePreview } from './messagePreview';
import { useMessageExpansion } from './MessageExpansionScope';
import { ScrollAnchorContext } from '../timeline/scrollAnchor';
import { MessageAttachment } from '../attachments/AttachmentTile';
import type { ThreadTimelineAdapter } from '../../adapters';
import { hasLikelyMarkdownSyntax } from '../markdownHeuristics';
import { GraphChatMessageContent } from './GraphChatMessageContent';

const LARGE_MESSAGE_PREVIEW_CHARS = 2_400;
const PLAIN_URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const TRAILING_URL_PUNCTUATION_PATTERN = /[),.;:!?]+$/;

type UserMessageSegment =
  | { type: 'text'; key: string; text: string }
  | { type: 'photo'; key: string; path: string }
  | { type: 'file'; key: string; path: string };

function normalizeHref(value: string) {
  return value.startsWith('www.') ? `https://${value}` : value;
}

function basenameFromAssetPath(value: string) {
  const normalized = value.replace(/[\\/]+$/, '').trim();
  if (!normalized) {
    return '';
  }
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments.at(-1) ?? normalized;
}

function tokenizeUserMessageText(text: string): UserMessageSegment[] {
  if (!text) {
    return [];
  }

  const matcher = /\[(PHOTO|FILE)\s+([^\]]+)\]/g;
  const segments: UserMessageSegment[] = [];
  let cursor = 0;
  let index = 0;

  for (const match of text.matchAll(matcher)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      segments.push({
        type: 'text',
        key: `text-${index}`,
        text: text.slice(cursor, start),
      });
      index += 1;
    }

    const kind = match[1];
    const path = match[2]?.trim() ?? '';
    if (kind === 'PHOTO' && path) {
      segments.push({ type: 'photo', key: `photo-${index}`, path });
    } else if (kind === 'FILE' && path) {
      segments.push({ type: 'file', key: `file-${index}`, path });
    } else {
      segments.push({
        type: 'text',
        key: `text-${index}`,
        text: match[0],
      });
    }
    index += 1;
    cursor = start + match[0].length;
  }

  if (cursor < text.length) {
    segments.push({
      type: 'text',
      key: `text-${index}`,
      text: text.slice(cursor),
    });
  }

  return segments;
}

export function GraphChatLinkifiedPlainText({ text }: { text: string }) {
  const { locale: i18nLocale } = useI18n();
  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(PLAIN_URL_PATTERN)) {
    const rawMatch = match[0];
    const index = match.index ?? 0;
    const trailingPunctuation =
      rawMatch.match(TRAILING_URL_PUNCTUATION_PATTERN)?.[0] ?? '';
    const urlText = trailingPunctuation
      ? rawMatch.slice(0, -trailingPunctuation.length)
      : rawMatch;

    if (!urlText) {
      continue;
    }

    if (index > cursor) {
      parts.push(text.slice(cursor, index));
    }

    parts.push(
      <a
        key={`${index}-${urlText}`}
        href={normalizeHref(urlText)}
        target="_blank"
        rel="noreferrer"
        className="thread-inline-link"
      >
        {urlText}
      </a>,
    );

    if (trailingPunctuation) {
      parts.push(trailingPunctuation);
    }

    cursor = index + rawMatch.length;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return <>{parts.length > 0 ? parts : text}</>;
}

type ScrollAnchor = { root: HTMLDivElement; element: Element; top: number };

/** Collapsing keeps the toggle where it is on screen, so it can be clicked again
    in place; expanding keeps the message's top, so reading continues below. */
function captureToggleAnchor(
  root: HTMLDivElement | null,
  expanded: boolean,
  message: Element | null,
  toggle: Element | null,
  onBeforeResize?: (anchor?: Element | null) => void,
): ScrollAnchor | null {
  const element = expanded ? toggle ?? message : message;
  onBeforeResize?.(element);
  return root && element ? { root, element, top: element.getBoundingClientRect().top } : null;
}

function restoreToggleAnchor(anchor: ScrollAnchor, hold?: () => void) {
  // Inside a timeline, its hold also handles the top of the history.
  if (hold) {
    hold();
    return undefined;
  }
  const adjust = () => { anchor.root.scrollTop += anchor.element.getBoundingClientRect().top - anchor.top; };
  adjust();
  const frame = window.requestAnimationFrame(adjust);
  return () => window.cancelAnimationFrame(frame);
}

export const GraphChatMarkdownAwareBody = memo(
  function GraphChatMarkdownAwareBody({
    messageId,
    text,
    scrollRootRef,
    streaming = false,
    containerClassName = '',
    plainTextClassName = 'thread-graph-plain-text whitespace-pre-wrap break-words text-[15px] leading-6',
    markdownClassName = 'thread-graph-markdown',
    onBeforeResize,
    onOpenWorkspaceFile,
    workspaceRootPath,
    resolveWorkspacePath,
    resolveHref,
  }: {
    messageId?: string | undefined;
    text: string;
    scrollRootRef: RefObject<HTMLDivElement | null>;
    streaming?: boolean;
    containerClassName?: string;
    plainTextClassName?: string;
    markdownClassName?: string;
    onBeforeResize?: (anchor?: Element | null) => void;
    onOpenWorkspaceFile?: ThreadTimelineAdapter['onOpenWorkspaceFile'] | undefined;
    workspaceRootPath?: string | undefined;
    resolveWorkspacePath?: ThreadTimelineAdapter['resolveWorkspacePath'] | undefined;
    resolveHref?: ThreadTimelineAdapter['resolveHref'] | undefined;
  }) {
  const { locale: i18nLocale } = useI18n();
    const messageRef = useRef<HTMLDivElement | null>(null);
    const toggleRef = useRef<HTMLButtonElement | null>(null);
    const scrollAnchorRef = useRef<ScrollAnchor | null>(null);
    const [expanded, setExpanded] = useMessageExpansion(messageId, text, streaming);
    const shouldRenderMarkdown = hasLikelyMarkdownSyntax(text) || /\\\(|\\\[/.test(text) || Boolean(resolveWorkspacePath && hasWorkspacePathSyntax(text));
    const preview = useMemo(
      () => !streaming && text.length > LARGE_MESSAGE_PREVIEW_CHARS
        ? messagePreview(text, LARGE_MESSAGE_PREVIEW_CHARS)
        : text,
      [text, streaming],
    );
    const isLargeText = preview.length < text.length;
    const displayText = isLargeText && !expanded ? `${preview}\n\n...` : text;
    const [isActivated, setIsActivated] = useState(
      streaming || typeof IntersectionObserver === 'undefined',
    );

    const toggleExpanded = useCallback(() => {
      scrollAnchorRef.current = captureToggleAnchor(scrollRootRef.current, expanded, messageRef.current, toggleRef.current, onBeforeResize);
      setExpanded(!expanded);
    }, [expanded, setExpanded, onBeforeResize, scrollRootRef]);

    const { hold } = useContext(ScrollAnchorContext);
    useLayoutEffect(() => {
      const anchor = scrollAnchorRef.current;
      scrollAnchorRef.current = null;
      return anchor ? restoreToggleAnchor(anchor, hold) : undefined;
    }, [expanded]);

    useLayoutEffect(() => {
      // Decide before the first paint for messages on screen or near the end
      // (threads open at their end), so they never show raw markdown and then
      // jump; the observer below handles the ones far away.
      const node = messageRef.current;
      if (isActivated || !node) return;
      const root = scrollRootRef.current;
      const box = node.getBoundingClientRect();
      const view = root ? root.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      const height = view.bottom - view.top || window.innerHeight;
      const end = root ? view.top - root.scrollTop + root.scrollHeight : document.documentElement.scrollHeight;
      if ((box.bottom >= view.top - height && box.top <= view.bottom + height) || box.bottom >= end - 2 * height) setIsActivated(true);
      // Only the first layout: later moves are the observer's.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      if (streaming || typeof IntersectionObserver === 'undefined') {
        setIsActivated(true);
        return;
      }

      if (isActivated || !messageRef.current) {
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setIsActivated(true);
              observer.disconnect();
              break;
            }
          }
        },
        {
          root: scrollRootRef.current,
          threshold: 0,
        },
      );

      observer.observe(messageRef.current);
      return () => {
        observer.disconnect();
      };
    }, [isActivated, scrollRootRef, streaming]);

    return (
      <div ref={messageRef} className={containerClassName}>
        {isActivated && shouldRenderMarkdown ? (
          <GraphChatMessageContent
            content={displayText}
            streaming={streaming}
            className={markdownClassName}
            workspaceRootPath={workspaceRootPath}
            resolveWorkspacePath={resolveWorkspacePath}
            onOpenWorkspaceFile={onOpenWorkspaceFile}
            resolveHref={resolveHref}
          />
        ) : (
          <p className={plainTextClassName}>
            <GraphChatLinkifiedPlainText text={displayText} />
          </p>
        )}
        {isLargeText ? (
          <button
            ref={toggleRef}
            type="button"
            onClick={event => { event.stopPropagation(); toggleExpanded(); }}
            aria-expanded={expanded}
            className="thread-graph-show-more timeline-meta-text mt-1 inline-flex w-fit items-center gap-1 rounded px-1 text-xs transition"
          >
            {expanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
            <span>{expanded ? translate("chat.showLess") : translate("chat.showMore")}</span>
          </button>
        ) : null}
      </div>
    );
  },
);

export const GraphChatAgentMessageBody = memo(
  function GraphChatAgentMessageBody({
    messageId,
    text,
    scrollRootRef,
    streaming = false,
    onBeforeResize,
    onOpenWorkspaceFile,
    workspaceRootPath,
    resolveWorkspacePath,
    resolveHref,
  }: {
    messageId?: string | undefined;
    text: string;
    scrollRootRef: RefObject<HTMLDivElement | null>;
    streaming?: boolean;
    onBeforeResize?: (anchor?: Element | null) => void;
    onOpenWorkspaceFile?: ThreadTimelineAdapter['onOpenWorkspaceFile'] | undefined;
    workspaceRootPath?: string | undefined;
    resolveWorkspacePath?: ThreadTimelineAdapter['resolveWorkspacePath'] | undefined;
    resolveHref?: ThreadTimelineAdapter['resolveHref'] | undefined;
  }) {
  const { locale: i18nLocale } = useI18n();
    return (
      <GraphChatMarkdownAwareBody
        messageId={messageId}
        text={text}
        scrollRootRef={scrollRootRef}
        streaming={streaming}
        containerClassName="thread-graph-message-prose"
        {...(onBeforeResize ? { onBeforeResize } : {})}
        workspaceRootPath={workspaceRootPath}
            resolveWorkspacePath={resolveWorkspacePath}
        {...(onOpenWorkspaceFile ? { onOpenWorkspaceFile } : {})}
        {...(resolveHref ? { resolveHref } : {})}
      />
    );
  },
);

export const GraphChatUserMessageBody = memo(
  function GraphChatUserMessageBody({
    threadId,
    text,
    attachmentPreviewUrls,
    getImageAssetUrl,
    onOpenWorkspaceFile,
    messageId,
    scrollRootRef,
    onBeforeResize,
  }: {
    messageId?: string | undefined;
    scrollRootRef?: RefObject<HTMLDivElement | null> | undefined;
    onBeforeResize?: ((anchor?: Element | null) => void) | undefined;
    threadId?: string | undefined;
    text: string;
    attachmentPreviewUrls?: Record<string, string> | undefined;
    getImageAssetUrl?: ThreadTimelineAdapter['getImageAssetUrl'] | undefined;
    onOpenWorkspaceFile?: ThreadTimelineAdapter['onOpenWorkspaceFile'] | undefined;
  }) {
  const { locale: i18nLocale } = useI18n();
    const allSegments = useMemo(() => tokenizeUserMessageText(text), [text]);
    const [expanded, setExpanded] = useMessageExpansion(messageId, text, false);
    const messageRef = useRef<HTMLDivElement>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);
    const scrollAnchor = useRef<ScrollAnchor | null>(null);
    const narrative = allSegments.filter(segment => segment.type === 'text').map(segment => segment.text).join('');
    const points = Array.from(narrative);
    const wordBoundary = [...narrative.matchAll(/\S+/gu)][160]?.index ?? narrative.length;
    const lineBoundary = narrative.split('\n').slice(0, 8).join('\n').length;
    const previewEnd = Math.min(points.slice(0, 600).join('').length, wordBoundary, lineBoundary);
    const isLong = previewEnd < narrative.length;
    // Attachment markers do not consume the preview budget; chips stay accessible.
    const segments: UserMessageSegment[] = isLong && !expanded ? [
      {type:'text',key:'preview',text:`${narrative.slice(0, previewEnd).trimEnd()}…`},
      ...allSegments.filter(segment => segment.type !== 'text'),
    ] : allSegments;
    const { hold } = useContext(ScrollAnchorContext);
    useLayoutEffect(() => {
      const anchor = scrollAnchor.current;
      scrollAnchor.current = null;
      return anchor ? restoreToggleAnchor(anchor, hold) : undefined;
    }, [expanded]);
    const toggle = () => {
      scrollAnchor.current = captureToggleAnchor(scrollRootRef?.current ?? null, expanded, messageRef.current, toggleRef.current, onBeforeResize);
      setExpanded(!expanded);
    };

    return (
      <div ref={messageRef} className="thread-graph-message-prose whitespace-pre-wrap break-words text-[15px] leading-6">
        {segments.map((segment) => {
          if (segment.type === 'text') {
            return <span key={segment.key} className={isLong && !expanded ? "thread-graph-user-preview-text" : undefined}>{segment.text}</span>;
          }

          if (segment.type === 'photo') {
            // Local previews of just-sent photos are already in memory.
            const localPreviewUrl = attachmentPreviewUrls?.[segment.path];
            const imageUrl =
              localPreviewUrl ??
              (threadId
                ? getImageAssetUrl?.({ threadId, path: segment.path, variant: 'thumbnail' }) ?? null
                : null);
            const fullImageUrl =
              localPreviewUrl ??
              (threadId
                ? getImageAssetUrl?.({ threadId, path: segment.path }) ?? undefined
                : undefined);
            const label = basenameFromAssetPath(segment.path) || translate("chat.attachedImage");
            return <MessageAttachment key={segment.key} kind="photo" path={segment.path} name={label}
              thumbnailUrl={imageUrl} fullUrl={fullImageUrl} />;
          }

          const fileName = basenameFromAssetPath(segment.path) || translate("chat.attachedFile");
          return <MessageAttachment key={segment.key} kind="file" path={segment.path} name={fileName}
            {...(onOpenWorkspaceFile ? { onOpenFile: onOpenWorkspaceFile } : {})} />;
        })}
        {isLong ? <button ref={toggleRef} type="button" onClick={event => {event.stopPropagation(); toggle();}} aria-expanded={expanded}
          className="thread-graph-show-more timeline-meta-text mt-1 flex w-fit items-center gap-1 rounded px-1 text-xs transition">
          {expanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          <span>{expanded ? translate('chat.showLess') : translate('chat.showMore')}</span>
        </button> : null}
      </div>
    );
  },
);
