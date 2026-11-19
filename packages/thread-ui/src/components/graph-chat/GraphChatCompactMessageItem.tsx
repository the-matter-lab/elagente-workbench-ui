import { translate, useI18n } from '../../i18n';
import {
  memo,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { Brain } from 'lucide-react';
import { CopyButton } from '../copy/CopyButton';

import type { ThreadHistoryItemDto } from '@remote-codex/shared';
import type { ThreadTimelineAdapter, ThreadUserMessageContentOptions } from '../../adapters';
import { useMessagePresentation } from '../../plugins/useMessagePresentation';
import {
  GraphChatAgentMessageBody,
  GraphChatMarkdownAwareBody,
  GraphChatUserMessageBody,
} from './GraphChatMessageBody';
import { GraphChatMessageFrame } from './GraphChatMessageFrame';
import { parsePromptEnvelope, PromptEnvelopeHeader, PromptNotice } from './PromptEnvelope';
import { formatMessageTimestamp } from '../threadPresentation';
import { useAddedPrompt, useTurnFailure } from './turnPrompts';
import { AddedPromptIcon } from '../timeline/AddedPromptIcon';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from '../graph-workspace/GraphAccordion';

type GraphChatCompactMessageKind = Extract<
  ThreadHistoryItemDto['kind'],
  'userMessage' | 'agentMessage'
>;

type GraphChatReasoningItem = ThreadHistoryItemDto & { kind: 'reasoning' };

type GraphChatCompactMessage = ThreadHistoryItemDto & {
  kind: GraphChatCompactMessageKind;
  reasoningItems?: GraphChatReasoningItem[] | undefined;
  attachmentPreviewUrls?: Record<string, string> | undefined;
};

function isGraphChatRunningStatus(status?: string | null) {
  if (!status) {
    return false;
  }

  const normalized = status.toLowerCase();
  return (
    normalized.includes('running') ||
    normalized.includes('inprogress') ||
    normalized.includes('in_progress')
  );
}

function GraphChatRunningDots({ tone = 'amber' }: { tone?: 'amber' | 'sky' }) {
  const { locale: i18nLocale } = useI18n();
  const dotClassName = tone === 'sky' ? 'bg-sky-300/90' : 'bg-amber-200/90';

  return (
    <span className="ml-1.5 inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={`h-1.5 w-1.5 animate-pulse rounded-full ${dotClassName}`}
          style={{ animationDelay: `${index * 180}ms` }}
        />
      ))}
    </span>
  );
}

export const GraphChatCompactMessageItem = memo(
  function GraphChatCompactMessageItem({
    threadId,
    item,
    scrollRootRef,
    streaming = false,
    adapter,
    timeLabel,
    timeTitle,
    onBeforeMessageResize,
    variant,
  }: {
    variant?: 'reasoning';
    threadId?: string | undefined;
    item: GraphChatCompactMessage;
    scrollRootRef: RefObject<HTMLDivElement | null>;
    streaming?: boolean;
    adapter?: ThreadTimelineAdapter;
    timeLabel?: ReactNode;
    timeTitle?: string | null | undefined;
    onBeforeMessageResize?: (anchor?: Element | null) => void;
  }) {
  const { locale: i18nLocale } = useI18n();
    const [reasoningOpen, setReasoningOpen] = useState(false);
    const failure = useTurnFailure(item.id);
    const added = useAddedPrompt(item.id) && item.kind === 'userMessage';
    const { presentation, text, showingOriginal, showOriginal } = useMessagePresentation({ item, streaming });
    const reasoningItems =
      item.kind === 'agentMessage' ? (item.reasoningItems ?? []) : [];
    const reasoningText = reasoningItems
      .map((entry) => entry.text.trim())
      .filter(Boolean)
      .join('\n\n');
    const queuedLikeStatus =
      item.kind === 'userMessage' &&
      (item.status === 'Steering' ||
        item.status === 'Accepted' ||
        item.status === 'Awaiting response');


    function toggleReasoning() {
      onBeforeMessageResize?.();
      setReasoningOpen((value) => !value);
    }

    const copyLabel = item.kind === 'agentMessage' ? translate("chat.agentReply") : 'prompt';
    const copyButton = (
      <CopyButton value={text} label={translate("chat.copy_6b0f10", { value1: copyLabel })} className="thread-graph-message-copy" />
    );

    const hasRunningReasoning = reasoningItems.some((entry) =>
      isGraphChatRunningStatus(entry.status),
    );
    const reasoningToggle =
      item.kind === 'agentMessage' && reasoningText ? (
        <button
          type="button"
          aria-label={
            reasoningOpen ? translate("chat.hideChainOfThought") : translate("chat.showChainOfThought")
          }
          aria-expanded={reasoningOpen}
          title={reasoningOpen ? translate("chat.hideCoT") : translate("chat.showCoT")}
          onClick={toggleReasoning}
          className={`thread-graph-thinking-toggle inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition ${
            reasoningOpen ? 'is-open' : ''
          }`}
        >
          <Brain
            data-icon="think"
            className={`h-3.5 w-3.5 ${hasRunningReasoning ? 'animate-pulse' : ''}`}
          />
          <span>{translate("chat.coT")}</span>
          {hasRunningReasoning ? <GraphChatRunningDots tone="sky" /> : null}
        </button>
      ) : null;

    const reasoning =
      item.kind === 'agentMessage' && reasoningText ? (
        <div className="thread-graph-message-thinking mb-3">
          <Accordion
            type="single"
            collapsible
            value={reasoningOpen ? 'thoughts' : ''}
            className="thread-graph-thinking-accordion w-full border-none"
            onValueChange={(value) => setReasoningOpen(Boolean(value))}
          >
            <AccordionItem value="thoughts" className="border-b-0">
              <AccordionContent className="thread-graph-thinking-content pb-0">
                <div className="thread-graph-thinking-body my-1 max-h-56 overflow-auto rounded-xl border p-3 text-[12px] leading-5">
                  <GraphChatMarkdownAwareBody text={reasoningText} scrollRootRef={scrollRootRef}
                    messageId={`${item.id}:reasoning`} onBeforeResize={onBeforeMessageResize}
                    workspaceRootPath={adapter?.workspaceRootPath} onOpenWorkspaceFile={adapter?.onOpenWorkspaceFile}
                    resolveHref={adapter?.resolveHref} />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      ) : null;

    const envelope = item.kind === 'userMessage' ? parsePromptEnvelope(item.text) : null;
    if (envelope?.type === 'notice') {
      return (
        <GraphChatMessageFrame messageId={item.id} kind={item.kind} variant="notice" timeLabel={timeLabel} timeTitle={timeTitle}>
          <PromptNotice envelope={envelope} />
        </GraphChatMessageFrame>
      );
    }

    const renderDefaultContent = (content = envelope?.type === 'peer' ? envelope.body : item.text, options?: ThreadUserMessageContentOptions) => (
      <GraphChatUserMessageBody
        messageId={item.id}
        scrollRootRef={scrollRootRef}
        onBeforeResize={onBeforeMessageResize}
        threadId={threadId}
        text={content}
        fileAttachments={options?.fileAttachments}
        attachmentPreviewUrls={item.attachmentPreviewUrls}
        getImageAssetUrl={adapter?.getImageAssetUrl}
        onOpenWorkspaceFile={adapter?.onOpenWorkspaceFile}
      />
    );
    const userContent = item.kind === 'userMessage'
      ? adapter?.renderUserMessageContent?.({
          threadId,
          messageId: item.id,
          item,
          content: item.text,
          renderDefaultContent,
          onBeforeResize: onBeforeMessageResize,
        }) ?? renderDefaultContent()
      : null;

    return (
      <GraphChatMessageFrame
        messageId={item.id}
        kind={item.kind}
        variant={envelope ? 'envelope' : variant}
        // Execution status belongs to the turn summary, not every emitted reply.
        status={queuedLikeStatus ? item.status : null}
        copyButton={copyButton}
        metaControl={reasoningToggle || presentation ? <>
          {reasoningToggle}
          {presentation && <span className="thread-message-presentation" role="group" aria-label={translate('chat.replyVersion')}>
            {[false, true].map(original => <button
              key={String(original)} type="button" aria-pressed={showingOriginal === original}
              onClick={() => { onBeforeMessageResize?.(); showOriginal(original); }}
            >{original ? presentation.originalLabel : presentation.label}</button>)}
          </span>}
        </> : null}
        reasoning={reasoning}
        timeLabel={timeLabel}
        timeTitle={timeTitle}
        actionsTime={item.createdAt ? formatMessageTimestamp(item.createdAt) : null}
        failure={item.kind === 'userMessage' ? failure : null}
        sender={item.kind === 'userMessage' ? item.sender : null}
        kicker={added && item.createdAt ? (
          <span className="thread-added-prompt" role="img" aria-label={translate('chat.promptAdded', { time: formatMessageTimestamp(item.createdAt) })}
            title={translate('chat.promptAdded', { time: formatMessageTimestamp(item.createdAt) })}>
            <AddedPromptIcon />{formatMessageTimestamp(item.createdAt)}
          </span>
        ) : null}
        onBeforeResize={onBeforeMessageResize}
      >
        {item.kind === 'agentMessage' ? (
          <GraphChatAgentMessageBody
            workspaceRootPath={adapter?.workspaceRootPath}
            resolveWorkspacePath={adapter?.resolveWorkspacePath}
            messageId={item.id}
            text={text}
            scrollRootRef={scrollRootRef}
            streaming={streaming}
            {...(onBeforeMessageResize
              ? { onBeforeResize: onBeforeMessageResize }
              : {})}
            {...(adapter?.onOpenWorkspaceFile
              ? { onOpenWorkspaceFile: adapter.onOpenWorkspaceFile }
              : {})}
            {...(adapter?.resolveHref
              ? { resolveHref: adapter.resolveHref }
              : {})}
          />
        ) : (
          <>
          {envelope?.type === 'peer' ? <PromptEnvelopeHeader envelope={envelope} /> : null}
          {userContent}
          </>
        )}
      </GraphChatMessageFrame>
    );
  },
);
