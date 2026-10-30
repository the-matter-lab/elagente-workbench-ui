import { latestUsage, progressEvidence, scopeUsageItems, usageEvidenceResult, usageEvidence } from './structuredEvidence';
import { StructuredToolEvidence, TurnEvidenceStatusContext } from './StructuredToolEvidence';
import { StructuredUsageInline } from './StructuredUsageInline';
import { translate, useI18n } from '../../i18n';
import {
  Fragment,
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useMemo,
  useState,
  type RefCallback,
  type ReactNode,
  type RefObject,
} from 'react';
import { ChevronRight } from 'lucide-react';

import type { ThreadHistoryItemDto, ThreadTurnActivitySegmentDto } from '@remote-codex/shared';

import type { ThreadTimelineAdapter } from '../../adapters';
import {
  formatLongTimestamp,
  formatMessageTimestamp,
  formatPreciseMessageTimestamp,
  formatShortTimestamp,
} from '../threadPresentation';
import {
  GraphChatAgentToolCallItem as AgentToolCallItem,
  GraphChatArtifactHistoryItem as ArtifactHistoryItem,
  GraphChatCommandItem as CommandItem,
  GraphChatContextCompactionItem as ContextCompactionItem,
  GraphChatFileChangeItem as FileChangeItem,
  GraphChatFileReadItem as FileReadItem,
  GraphChatGenericHistoryItem as GenericHistoryItem,
  GraphChatHookItem as HookItem,
  GraphChatImageItem as ImageItem,
  GraphChatPlanHistoryItem as PlanHistoryItem,
  GraphChatSkillToolCallItem as SkillToolCallItem,
  GraphChatToolCallItem as ToolCallItem,
  GraphChatWebSearchItem as WebSearchItem,
} from '../graph-chat/GraphChatHistoryItems';
import { GraphChatCompactMessageItem as CompactMessageItem } from '../graph-chat/GraphChatCompactMessageItem';
import { MessageExpansionScope } from '../graph-chat/MessageExpansionScope';
import { GraphChatTurnBody } from '../graph-chat/GraphChatTurnBody';
import { GraphChatTurnFrame } from '../graph-chat/GraphChatTurnFrame';
import { echoesFailure, TurnPromptContext } from '../graph-chat/turnPrompts';
import { TurnHead } from './TurnHead';
import { TranscriptAgentByline } from '../graph-chat/TranscriptAgent';
import {
  countTurnSteps,
  getLiveOutputTailForTurn,
  groupTimelineHistoryItems,
  isActiveTurnStatus,
  isCompactChatItem,
  isRunningHistoryStatus,
  mergeLiveTurnItems,
  parseHookPromptText,
  prepareTurnItemsForRendering,
  type TimelineHistoryEntry,
  type TimelineTurn,
} from './timelineItems';
import { groupAnswerSections, isSubstantiveAnswer } from './answerSections';
import { TurnTokenSummary } from './tokenFormatting';
import { TurnStatusBar } from './turnStatus';
import { Collapse } from './Collapse';
import { turnErrorText } from './turnErrors';
import { activityParts, hasActivity, storySegments, stretchBetween, stretchFromItems, turnActivity, turnChangedFiles } from './activity';
import { ActivitySummary, ChangedFiles, isLogItem, LogRow, LogRun, opensDiff, Parts, RunPlaceholder } from './TranscriptLog';
import { useAppShellNav } from '../../app-shell/AppShellNavContext';

const FILE_PARTS = new Set(['edits', 'added', 'removed']);

type LivePlan = {
  turnId: string;
  explanation: string | null;
  plan: Array<{ step: string; status: string }>;
  updatedAt?: string | null;
};

type SelectArtifactHandler = (input: {
  item: ThreadHistoryItemDto & { kind: 'artifact' };
  artifact: NonNullable<ThreadHistoryItemDto['artifact']>;
}) => void;

type OpenExpandedTextHandler = (title: string, text: string) => void;

type OpenCommandDetailHandler = (
  item: ThreadHistoryItemDto & { kind: 'commandExecution' },
  title: string,
) => void;

type OpenToolCallDetailHandler = (
  item: ThreadHistoryItemDto & {
    kind: 'toolCall' | 'agentToolCall' | 'skillToolCall';
  },
  title: string,
) => void;

type OpenDeferredHistoryItemDetailHandler = (
  item: ThreadHistoryItemDto,
  title: string,
  fallbackText: string,
  loadingText: string,
  errorText: string,
) => void;

function timestampForHistoryItem(
  item: ThreadHistoryItemDto,
  fallback: string | null,
) {
  return item.createdAt ?? fallback;
}

interface HistoryItemRowProps {
  threadId: string | undefined;
  item: ThreadHistoryItemDto;
  scrollRootRef: RefObject<HTMLDivElement | null>;
  timeLabel?: ReactNode;
  timeTitle?: string | null | undefined;
  timeMeta?: ReactNode;
  autoOpenToolDetails?: boolean;
  onOpenExpandedText: OpenExpandedTextHandler;
  onOpenCommandDetail: OpenCommandDetailHandler;
  onOpenToolCallDetail: OpenToolCallDetailHandler;
  onOpenDeferredHistoryItemDetail: OpenDeferredHistoryItemDetailHandler;
  onSelectArtifact?: SelectArtifactHandler;
  onBeforeMessageResize?: (anchor?: Element | null) => void;
  adapter?: ThreadTimelineAdapter | undefined;
}

export const HistoryItemRow = memo(function HistoryItemRow({
  threadId,
  item,
  scrollRootRef,
  onOpenExpandedText,
  onOpenCommandDetail,
  onOpenToolCallDetail,
  onOpenDeferredHistoryItemDetail,
  onSelectArtifact,
  onBeforeMessageResize,
  adapter,
  timeLabel,
  timeTitle,
  timeMeta,
  autoOpenToolDetails = false,
}: HistoryItemRowProps) {
  const { locale: i18nLocale } = useI18n();
  const shellNav = useAppShellNav();
  const turnStatus = useContext(TurnEvidenceStatusContext);
  if (item.kind === 'reasoning' && !shellNav?.showReasoningSummaries) return null;
  // ElAgente structured evidence: validated tool progress and usage reports.
  if (item.progress !== undefined || item.extension?.type === 'elagente.progress') {
    return <StructuredToolEvidence item={item} scrollRootRef={scrollRootRef} adapter={adapter} onBeforeResize={onBeforeMessageResize} turnStatus={turnStatus} />;
  }
  const usageError = usageEvidenceResult(item).error;
  if (usageError) return <div role="alert">{translate('chat.usageUnavailable', { value1: usageError })}</div>;
  if (item.extension?.type === 'elagente.usage') return null;
  if (isCompactChatItem(item.kind)) {
    return (
      <CompactMessageItem
        threadId={threadId}
        item={
          item as ThreadHistoryItemDto & {
            kind: 'userMessage' | 'agentMessage';
          }
        }
        scrollRootRef={scrollRootRef}
        timeLabel={timeLabel}
        timeTitle={timeTitle}
        {...(onBeforeMessageResize ? { onBeforeMessageResize } : {})}
        {...(adapter ? { adapter } : {})}
      />
    );
  }

  if (item.kind === 'reasoning') {
    return (
      <CompactMessageItem
        item={{
          ...item,
          kind: 'agentMessage',
          status: item.status ?? null,
        }}
        variant="reasoning"
        scrollRootRef={scrollRootRef}
        timeLabel={timeLabel}
        timeTitle={timeTitle}
        {...(onBeforeMessageResize ? { onBeforeMessageResize } : {})}
      />
    );
  }

  if (item.kind === 'artifact') {
    return (
      <ArtifactHistoryItem
        {...(adapter?.onOpenWorkspaceFile ? { onOpenWorkspaceFile: adapter.onOpenWorkspaceFile } : {})}
        item={
          item as ThreadHistoryItemDto & {
            kind: 'artifact';
          }
        }
        timeMeta={timeMeta}
        {...(onSelectArtifact
          ? {
              onSelect: (nextItem, artifact) =>
                onSelectArtifact({ item: nextItem, artifact }),
            }
          : {})}
      />
    );
  }

  if (item.kind === 'commandExecution') {
    return (
      <CommandItem
        autoOpen={autoOpenToolDetails}
        item={
          item as ThreadHistoryItemDto & {
            kind: 'commandExecution';
          }
        }
        onOpen={onOpenCommandDetail}
        timeMeta={timeMeta}
      />
    );
  }

  if (item.kind === 'toolCall') {
    return (
      <ToolCallItem
        autoOpen={autoOpenToolDetails}
        item={
          item as ThreadHistoryItemDto & {
            kind: 'toolCall';
          }
        }
        onOpen={onOpenToolCallDetail}
        timeMeta={timeMeta}
      />
    );
  }

  if (item.kind === 'agentToolCall') {
    return (
      <AgentToolCallItem
        autoOpen={autoOpenToolDetails}
        item={
          item as ThreadHistoryItemDto & {
            kind: 'agentToolCall';
          }
        }
        onOpen={onOpenToolCallDetail}
        timeMeta={timeMeta}
      />
    );
  }

  if (item.kind === 'skillToolCall') {
    return (
      <SkillToolCallItem
        autoOpen={autoOpenToolDetails}
        item={
          item as ThreadHistoryItemDto & {
            kind: 'skillToolCall';
          }
        }
        onOpen={onOpenToolCallDetail}
        timeMeta={timeMeta}
      />
    );
  }

  if (item.kind === 'webSearch') {
    const typedItem = item as ThreadHistoryItemDto & {
      kind: 'webSearch';
    };
    const detailText =
      typedItem.detailText?.trim() || typedItem.text || translate("chat.webSearch");
    return (
      <WebSearchItem
        autoOpen={autoOpenToolDetails}
        item={typedItem}
        timeMeta={timeMeta}
        onOpen={() =>
          onOpenDeferredHistoryItemDetail(
            typedItem,
            translate("chat.webSearchDetails"),
            detailText,
            translate("chat.loadingFullWebSearchDetails"),
            translate("chat.unableToLoadFullWebSearchDetails"),
          )
        }
      />
    );
  }

  if (item.kind === 'fileRead') {
    const typedItem = item as ThreadHistoryItemDto & {
      kind: 'fileRead';
    };
    const detailText =
      typedItem.detailText?.trim() || typedItem.text || translate("chat.fileRead");
    return (
      <FileReadItem
        autoOpen={autoOpenToolDetails}
        item={typedItem}
        timeMeta={timeMeta}
        onOpen={() =>
          onOpenDeferredHistoryItemDetail(
            typedItem,
            translate("chat.fileReadDetails"),
            detailText,
            translate("chat.loadingFullFileReadDetails"),
            translate("chat.unableToLoadFullFileReadDetails"),
          )
        }
      />
    );
  }

  if (item.kind === 'image') {
    return (
      <ImageItem
        threadId={threadId}
        item={
          item as ThreadHistoryItemDto & {
            kind: 'image';
          }
        }
        onOpen={onOpenExpandedText}
        getImageAssetUrl={adapter?.getImageAssetUrl}
        timeMeta={timeMeta}
      />
    );
  }

  if (item.kind === 'plan') {
    return (
      <PlanHistoryItem
        item={
          item as ThreadHistoryItemDto & {
            kind: 'plan';
          }
        }
        scrollRootRef={scrollRootRef}
        timeMeta={timeMeta}
        {...(onBeforeMessageResize
          ? { onBeforeResize: onBeforeMessageResize }
          : {})}
      />
    );
  }

  if (item.kind === 'fileChange') {
    const typedItem = item as ThreadHistoryItemDto & {
      kind: 'fileChange';
    };
    const detailText =
      typedItem.detailText?.trim() || typedItem.text || translate("chat.fileChange");
    return (
      <FileChangeItem
        item={typedItem}
        timeMeta={timeMeta}
        onOpen={() =>
          onOpenDeferredHistoryItemDetail(
            typedItem,
            translate("chat.fileChangeDetails"),
            detailText,
            translate("chat.loadingFullFileChangeDetails"),
            translate("chat.unableToLoadFullFileChangeDetails"),
          )
        }
      />
    );
  }

  if (item.kind === 'contextCompaction') {
    return (
      <ContextCompactionItem
        item={
          item as ThreadHistoryItemDto & {
            kind: 'contextCompaction';
          }
        }
        timeMeta={timeMeta}
      />
    );
  }

  if (item.kind === 'hook') {
    return (
      <HookItem
        item={
          item as ThreadHistoryItemDto & {
            kind: 'hook';
          }
        }
        timeMeta={timeMeta}
      />
    );
  }

  return <GenericHistoryItem item={item} timeMeta={timeMeta} />;
});

interface ThreadTurnRowProps {
  peerWorkChildren?: ReactNode;
  peerWorkSteps?: number;
  peerWaitingForWake?: boolean;
  summaryAgentOverride?: (ThreadHistoryItemDto & { kind: 'agentMessage' }) | null;
  nestedPeerWork?: boolean;
  omitAgentId?: string | undefined;
  revealTarget?: { itemId: string; key: number } | undefined;
  threadId: string | undefined;
  adapter?: ThreadTimelineAdapter | undefined;
  turn: TimelineTurn;
  absoluteIndex: number;
  isCollapsed: boolean;
  livePlan: LivePlan | null;
  liveItems: ThreadHistoryItemDto[] | null;
  liveActivityAt?: string | null;
  liveOutput: string;
  forceActive?: boolean;
  backgroundAgentCount?: number;
  renderTurnNotification?: ((turnId: string) => ReactNode) | undefined;
  renderTurnContent?: ((turnId: string) => ReactNode) | undefined;
  onToggleCollapse: (turn: TimelineTurn, currentCollapsed: boolean, loadDetails?: boolean) => void;
  /** Loads a folded turn's operations without opening the turn. */
  onLoadTurnItems?: (turn: TimelineTurn) => void;
  /** Completed turns open as their narration (auto-collapse is off). */
  narrationMode?: boolean;
  deferredItemsLoading?: boolean;
  deferredItemsError?: string | undefined;
  onOpenExpandedText: OpenExpandedTextHandler;
  onOpenCommandDetail: OpenCommandDetailHandler;
  onOpenToolCallDetail: OpenToolCallDetailHandler;
  onOpenDeferredHistoryItemDetail: OpenDeferredHistoryItemDetailHandler;
  onSelectArtifact?: SelectArtifactHandler;
  onBeforeMessageResize?: (anchor?: Element | null) => void;
  scrollRootRef: RefObject<HTMLDivElement | null>;
  articleRef?: RefCallback<HTMLElement> | undefined;
}

function isTerminalTurnStatus(status: TimelineTurn['status']) {
  return (
    status === 'completed' || status === 'failed' || status === 'interrupted'
  );
}

// An item's last change: a tool that completes or reports progress updates in
// place, so its creation time alone would freeze "Last progress" (ELA-253).
function itemActivityAtMillis(item: ThreadHistoryItemDto) {
  const candidates = [Date.parse(item.createdAt ?? ''), Date.parse(item.updatedAt ?? '')]
    .filter(Number.isFinite);
  return candidates.length > 0 ? Math.max(...candidates) : null;
}

function latestItemTimestamp(items: ThreadHistoryItemDto[]) {
  let latest: number | null = null;
  for (const item of items) {
    const millis = itemActivityAtMillis(item);
    if (millis === null) {
      continue;
    }
    latest = latest === null ? millis : Math.max(latest, millis);
  }
  return latest;
}

export function latestActivityTimestamp(
  startedAt: string | null | undefined,
  items: ThreadHistoryItemDto[],
  liveActivityAt: string | null | undefined,
) {
  const candidates = [
    Date.parse(startedAt ?? ''),
    latestItemTimestamp(items) ?? Number.NaN,
    Date.parse(liveActivityAt ?? ''),
  ].filter(Number.isFinite);

  return candidates.length > 0
    ? new Date(Math.max(...candidates)).toISOString()
    : null;
}

export function formatWorkedDuration(
  startedAt: string | null | undefined,
  completedAt: string | null | undefined,
  items: ThreadHistoryItemDto[],
) {
  const startMillis = Date.parse(startedAt ?? '');
  const completedMillis = Date.parse(completedAt ?? '');
  const endMillis = Number.isFinite(completedMillis)
    ? completedMillis
    : latestItemTimestamp(items);
  if (
    !Number.isFinite(startMillis) ||
    endMillis === null ||
    endMillis < startMillis
  ) {
    return translate("chat.worked");
  }

  // Whole seconds rounded down, like the turn head, so both show the same time.
  const totalSeconds = Math.max(
    1,
    Math.floor((endMillis - startMillis) / 1000),
  );
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return translate("chat.workedForHours", { hours, minutes });
  }
  if (minutes > 0) {
    return translate("chat.workedForMinutes", { minutes, seconds });
  }
  return translate("chat.workedForSeconds", { seconds });
}

import { TimelineTimeToggle } from './TimelineTimeToggle';



function collapsedSummaryMessages(entries: TimelineHistoryEntry[], active: boolean) {
  const itemEntries = entries.filter(
    (entry): entry is TimelineHistoryEntry & { kind: 'item' } =>
      entry.kind === 'item',
  );
  const users = itemEntries
    .map((entry) => entry.item)
    .filter(
      (item): item is ThreadHistoryItemDto & { kind: 'userMessage' } =>
        item.kind === 'userMessage',
    );
  const latestAgent = itemEntries
    .map((entry) => entry.item)
    .reverse()
    .find(
      (item): item is ThreadHistoryItemDto & { kind: 'agentMessage' } =>
        item.kind === 'agentMessage' && item.text.trim().length > 0,
    );
  const hasBackgroundOrigin = (entry: TimelineHistoryEntry): boolean => {
    if (entry.kind === 'agentActivityGroup') return entry.entries.some(hasBackgroundOrigin);
    return entry.kind === 'item' &&
      (entry.item.origin === 'nativeBackgroundWait' || entry.item.origin === 'nativeTaskNotification');
  };
  const hasBackground = entries.some(hasBackgroundOrigin);
  // Keep the latest narration visible while working, including during tools or
  // a background wait. Completed background turns require a confirmed final
  // reply; a completed progress item alone is not proof that the turn finished.
  const summaryAgent = active || !hasBackground
    ? latestAgent
    : (latestAgent?.responsePhase === 'final' ? latestAgent : undefined);
  const hiddenEntries = entries.filter((entry) => {
    if (entry.kind !== 'item') {
      return true;
    }

    return (
      entry.item.kind !== 'userMessage' && entry.item.id !== summaryAgent?.id
    );
  });

  return {
    users,
    latestAgent,
    summaryAgent,
    hiddenEntries,
  };
}

export const ThreadTurnRow = memo(function ThreadTurnRow({
  peerWorkChildren,
  peerWorkSteps = 0,
  peerWaitingForWake,
  summaryAgentOverride,
  nestedPeerWork = false,
  omitAgentId,
  threadId,
  revealTarget,
  adapter,
  turn,
  absoluteIndex,
  isCollapsed,
  livePlan,
  liveItems,
  liveActivityAt = null,
  liveOutput,
  forceActive = false,
  backgroundAgentCount = 0,
  renderTurnNotification,
  renderTurnContent,
  onToggleCollapse,
  onLoadTurnItems,
  narrationMode = false,
  deferredItemsLoading = false,
  deferredItemsError,
  onOpenExpandedText,
  onOpenCommandDetail,
  onOpenToolCallDetail,
  onOpenDeferredHistoryItemDetail,
  onSelectArtifact,
  onBeforeMessageResize,
  scrollRootRef,
  articleRef,
}: ThreadTurnRowProps) {
  const { locale: i18nLocale } = useI18n();
  const showReasoningSummaries = useAppShellNav()?.showReasoningSummaries ?? false;
  const hasLiveActivity =
    Boolean(livePlan) ||
    Boolean(liveOutput) ||
    Boolean(liveItems && liveItems.length > 0);
  const activeForRendering =
    forceActive ||
    isActiveTurnStatus(turn.status) ||
    (hasLiveActivity && !isTerminalTurnStatus(turn.status));
  const activeFooterTurn: TimelineTurn =
    activeForRendering && !isActiveTurnStatus(turn.status)
      ? {
          ...turn,
          status: 'inProgress',
        }
      : turn;
  const mergedItems = useMemo(
    () => mergeLiveTurnItems(turn.items, liveItems),
    [liveItems, turn.items],
  );
  const stepCount = useMemo(
    () => countTurnSteps({ hasDeferredItems: turn.hasDeferredItems, deferredItemCount: turn.deferredItemCount }, mergedItems, turn.items),
    [mergedItems, turn.items, turn.hasDeferredItems, turn.deferredItemCount],
  );
  const lastActivityAt = useMemo(
    () => latestActivityTimestamp(turn.startedAt, mergedItems, liveActivityAt),
    [liveActivityAt, mergedItems, turn.startedAt],
  );
  // The plan reads as the agent last reported it; the transcript does not guess progress.
  const displayedLivePlan = livePlan;
  const visibleLiveOutput = useMemo(
    () => getLiveOutputTailForTurn(liveOutput, mergedItems),
    [liveOutput, mergedItems],
  );
  // A failed turn's error sits on its prompt; a reply that only repeats it is left out.
  const failedWith = turn.status === 'failed' && turn.error ? turn.error : null;
  const preparedItems = useMemo(() => {
    // ElAgente: a tool's usage report joins its progress row; a usage-only item has no row.
    const tools = new Map<string, NonNullable<ThreadHistoryItemDto['usage']>>();
    for (const item of scopeUsageItems({ id: turn.id, items: mergedItems, usageByScope: turn.usageByScope })) {
      const usage = usageEvidence(item);
      if (usage?.scope !== 'tool') continue;
      const previous = tools.get(usage.scopeId);
      if (!previous || Date.parse(usage.observedAt) >= Date.parse(previous.observedAt)) tools.set(usage.scopeId, usage);
    }
    return prepareTurnItemsForRendering(mergedItems, activeForRendering).filter(item =>
      (showReasoningSummaries || item.kind !== 'reasoning') &&
      (!nestedPeerWork || item.kind !== 'userMessage') && item.id !== omitAgentId &&
      !(failedWith && item.kind === 'agentMessage' && echoesFailure(failedWith, item.text)) &&
      !(item.kind === 'other' && !item.text?.trim() && !item.progress && usageEvidence(item)))
      .map(item => {
        const progress = progressEvidence(item).data;
        const usage = progress ? tools.get(progress.callId) : undefined;
        return usage ? { ...item, usage } : item;
      });
  }, [activeForRendering, mergedItems, showReasoningSummaries, nestedPeerWork, omitAgentId, failedWith, turn.id, turn.usageByScope]);
  // The first prompt started the turn; any later one was added while it worked.
  const prompts = preparedItems.filter(item => item.kind === 'userMessage');
  const firstPromptId = prompts[0]?.id;
  const promptContext = useMemo(
    () => firstPromptId ? { firstPromptId, error: failedWith } : null,
    [failedWith, firstPromptId],
  );
  const groupedItems = useMemo(
    () => groupTimelineHistoryItems(preparedItems),
    [preparedItems],
  );
  const autoOpenLatestToolDetails =
    activeForRendering;
  const turnTimeLabel = formatShortTimestamp(turn.startedAt);
  const turnTimeTitle = formatLongTimestamp(turn.startedAt);
  const visibleLiveHookPrompt = useMemo(
    () => parseHookPromptText(visibleLiveOutput),
    [visibleLiveOutput, i18nLocale],
  );
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );
  // The run a reader opened from a folded turn's narration; null is the last run.
  const [openRunBefore, setOpenRunBefore] = useState<string | null | undefined>(undefined);
  // The reader unfolded the turn from its work line: work that is one run opens with it.
  const [openSoleRun, setOpenSoleRun] = useState(false);
  // Stretches of work opened in a folded turn, by the answer they precede ('end' for the last).
  const [openStretches, setOpenStretches] = useState<Set<string>>(() => new Set());
  const revealedSearch = useRef<number | null>(null);
  useEffect(() => {
    if (!revealTarget || revealedSearch.current === revealTarget.key) return;
    const keys: string[] = [];
    function contains(entry: TimelineHistoryEntry): boolean {
      if (entry.kind === 'item') return entry.item.id === revealTarget?.itemId;
      const found = entry.kind === 'agentActivityGroup'
        ? entry.entries.some(contains)
        : entry.items.some(item => item.id === revealTarget?.itemId);
      if (found) keys.push(entry.key);
      return found;
    }
    if (groupedItems.some(contains)) {
      revealedSearch.current = revealTarget.key;
      setExpandedGroups(current => ({ ...current, ...Object.fromEntries(keys.map(key => [key, true])) }));
    }
  }, [groupedItems, revealTarget]);

  const toggleGroupedItem = useCallback((groupKey: string, currentExpanded: boolean) => {
    onBeforeMessageResize?.();
    setExpandedGroups((current) => ({
      ...current,
      [groupKey]: !currentExpanded,
    }));
  }, [onBeforeMessageResize]);

  const renderHistoryEntries = (entries: TimelineHistoryEntry[], options?: {
    collapsed?: boolean;
    onExpand?: () => void;
    /** Open the last run of these entries (a stretch of work opened by the reader). */
    openLastRun?: boolean;
  }) => (
    <TimelineHistoryEntries
      entries={entries}
      expandedGroups={options?.collapsed ? {} : expandedGroups}
      onToggleGroupedItem={options?.onExpand ? (key, current) => {
        if (options.collapsed) options.onExpand?.();
        toggleGroupedItem(key, options.collapsed ? false : current);
      } : toggleGroupedItem}
      threadId={threadId}
      scrollRootRef={scrollRootRef}
      onOpenExpandedText={onOpenExpandedText}
      onOpenCommandDetail={onOpenCommandDetail}
      onOpenToolCallDetail={onOpenToolCallDetail}
      onOpenDeferredHistoryItemDetail={onOpenDeferredHistoryItemDetail}
      {...(onBeforeMessageResize ? { onBeforeMessageResize } : {})}
      fallbackTimestamp={turn.startedAt}
      fallbackTimeLabel={turnTimeLabel}
      fallbackTimeTitle={turnTimeTitle}
      turnStartedAt={turn.startedAt}
      autoOpenLatestToolDetails={autoOpenLatestToolDetails && entries.at(-1)?.key === groupedItems.at(-1)?.key}
      {...(options?.openLastRun ? { openRunBefore: null } : openRunBefore !== undefined ? { openRunBefore } : {})}
      openSoleRun={openSoleRun}
      {...(onSelectArtifact ? { onSelectArtifact } : {})}
      {...(adapter ? { adapter } : {})}
    />
  );
  const historyNode = renderHistoryEntries(groupedItems);
  const liveHookPromptNode = visibleLiveHookPrompt ? (
    <HistoryItemRow
      threadId={threadId}
      item={visibleLiveHookPrompt}
      scrollRootRef={scrollRootRef}
      onOpenExpandedText={onOpenExpandedText}
      onOpenCommandDetail={onOpenCommandDetail}
      onOpenToolCallDetail={onOpenToolCallDetail}
      onOpenDeferredHistoryItemDetail={onOpenDeferredHistoryItemDetail}
      timeLabel={
        turn.startedAt
          ? formatPreciseMessageTimestamp(turn.startedAt)
          : turnTimeLabel
      }
      timeTitle={turnTimeTitle}
      timeMeta={null}
      {...(onSelectArtifact ? { onSelectArtifact } : {})}
      {...(adapter ? { adapter } : {})}
    />
  ) : null;
  const liveOutputNode =
    !visibleLiveHookPrompt && visibleLiveOutput ? (
      <CompactMessageItem
        item={{
          id: 'live-agent-message',
          kind: 'agentMessage',
          text: visibleLiveOutput,
        }}
        scrollRootRef={scrollRootRef}
        timeLabel={
          turn.startedAt
            ? formatPreciseMessageTimestamp(turn.startedAt)
            : turnTimeLabel
        }
        timeTitle={turnTimeTitle}
        streaming
        {...(adapter ? { adapter } : {})}
        {...(onBeforeMessageResize ? { onBeforeMessageResize } : {})}
      />
    ) : null;
  const footerNode = activeForRendering ? (
    <TurnStatusBar
      turn={activeFooterTurn}
      variant="footer"
      notificationControl={renderTurnNotification?.(activeFooterTurn.id)}
      lastActivityAt={lastActivityAt}
      backgroundAgentCount={backgroundAgentCount}
      waitingForWake={peerWaitingForWake ?? mergedItems.some(item => item.origin === 'nativeBackgroundWait' && item.status === 'waiting')}
    />
  ) : null;
  const collapsedSummary = useMemo(
    () => {
      const summary = collapsedSummaryMessages(groupedItems, activeForRendering);
      return summaryAgentOverride === undefined ? summary : {
        ...summary, summaryAgent: summaryAgentOverride ?? undefined,
        hiddenEntries: groupedItems.filter(entry => entry.kind !== 'item' || entry.item.kind !== 'userMessage'),
      };
    },
    [groupedItems, activeForRendering, summaryAgentOverride],
  );
  const workedLabel = useMemo(
    () => turn.status === 'recovering' ? translate("chat.confirmingStatus") : activeForRendering ? translate("chat.working") : formatWorkedDuration(turn.startedAt, turn.completedAt, mergedItems),
    [activeForRendering, mergedItems, turn.completedAt, turn.startedAt, turn.status, i18nLocale],
  );
  const interruptedLabel =
    turn.status === 'interrupted' ? (
      <span className="thread-graph-worked-interrupted shrink-0 text-[11px]">
        {translate("chat.interrupted")}</span>
    ) : null;
  const hasCollapsedHiddenItems =
    collapsedSummary.hiddenEntries.length > 0 || Boolean(turn.hasDeferredItems) || Boolean(peerWorkChildren);
  const effectiveCollapsed = isCollapsed && hasCollapsedHiddenItems;
  const visibleSummaryAgent = collapsedSummary.summaryAgent;
  const answerSections = useMemo(() =>
    groupedItems.some(entry => entry.kind === 'item' && isSubstantiveAnswer(entry.item) && (entry.item.id !== visibleSummaryAgent?.id || Array.from(entry.item.text.trim()).length >= 300))
      ? groupAnswerSections(groupedItems.filter(entry => entry.kind !== 'item' || entry.item.kind !== 'userMessage'), visibleSummaryAgent?.id) : null,
    [groupedItems, visibleSummaryAgent?.id]);

  const canToggleWorkedSummary =
    hasCollapsedHiddenItems;
  const activityCounts = useMemo(() => turnActivity(turn, mergedItems), [turn, mergedItems]);
  const summaryParts = hasActivity(activityCounts) ? activityParts(activityCounts) : [];
  // The edit counts open the changed files on their own, without opening the work.
  const fileParts = summaryParts.filter(part => FILE_PARTS.has(part.key));
  const workParts = summaryParts.filter(part => !FILE_PARTS.has(part.key));
  const [filesOpen, setFilesOpen] = useState(false);
  const changedFiles = useMemo(() => turnChangedFiles(turn, mergedItems), [turn, mergedItems]);
  // Only a finished turn is told from its summary; a working one loads as it streams.
  const story = effectiveCollapsed || !narrationMode || !isTerminalTurnStatus(turn.status) ? null : storySegments(turn);
  // When the turn started, its model and usage open the turn, above its prompt.
  // ElAgente: a turn's validated usage report, when its Agent reports one, follows the head.
  const structuredTurnUsage = latestUsage(scopeUsageItems({ id: turn.id, items: mergedItems, usageByScope: turn.usageByScope }), 'turn', turn.id);
  const headNode = (<>
    <TurnHead turn={turn} active={activeForRendering} added={Math.max(0, prompts.length - 1)}
      {...(onBeforeMessageResize ? { onBeforeResize: onBeforeMessageResize } : {})} />
    {structuredTurnUsage ? <StructuredUsageInline usage={structuredTurnUsage} scope="turn" /> : null}
  </>);
  // A turn that ended without recording anything (it was cut off before any
  // output reached the Supervisor) still opens: to say so, and why.
  const recordedNothing = isTerminalTurnStatus(turn.status) && !hasCollapsedHiddenItems
    && !groupedItems.some(entry => entry.kind !== 'item' || entry.item.kind !== 'userMessage');
  const [emptyOpen, setEmptyOpen] = useState(false);
  const terminalWorkedNode =
    isTerminalTurnStatus(turn.status) && !hasCollapsedHiddenItems ? recordedNothing ? (
      <>
        <div className="thread-graph-worked-summary flex w-full items-center gap-2 py-2 text-sm">
          <TranscriptAgentByline />
          <button type="button" className="thread-worked-toggle group flex min-w-0 items-center gap-2 text-left transition"
            aria-expanded={emptyOpen} onClick={(event) => { onBeforeMessageResize?.(event.currentTarget); setEmptyOpen(open => !open); }}>
            <ChevronRight className={`thread-worked-chevron h-4 w-4 shrink-0 transition ${emptyOpen ? 'rotate-90' : ''}`} />
            <span className="thread-graph-worked-label shrink-0">{workedLabel}</span>
            {interruptedLabel}
          </button>
          <span className="thread-graph-worked-rule h-px min-w-0 flex-1" aria-hidden="true" />
        </div>
        <Collapse open={emptyOpen}>
          <div className="thread-graph-turn-empty-note">
            <p>{translate('chat.turnRecordedNothing')}</p>
            {turn.error ? <p className="thread-graph-turn-empty-reason">{turnErrorText(turn.error)}</p> : null}
          </div>
        </Collapse>
      </>
    ) : (
      <div className="thread-graph-worked-summary flex w-full items-center gap-2 py-2 text-sm">
        <TranscriptAgentByline />
        <span className="thread-graph-worked-label shrink-0">
          {workedLabel}
        </span>
        {interruptedLabel}
        <ActivitySummary parts={summaryParts} />
        <span
          className="thread-graph-worked-rule h-px min-w-0 flex-1"
          aria-hidden="true"
        />
      </div>
    ) : null;
  const leadingUserCount = groupedItems.findIndex(
    (entry) => !(entry.kind === 'item' && entry.item.kind === 'userMessage'),
  );
  const renderSummaryAgent = (item: ThreadHistoryItemDto & { kind: 'agentMessage' }) => (
    <CompactMessageItem
      threadId={threadId}
      item={item}
      streaming={activeForRendering && isRunningHistoryStatus(item.status)}
      scrollRootRef={scrollRootRef}
      timeTitle={item.createdAt ? formatLongTimestamp(item.createdAt) : turnTimeTitle}
      {...(onBeforeMessageResize ? { onBeforeMessageResize } : {})}
      {...(adapter ? { adapter } : {})}
    />
  );
  // While a folded turn works, the operation after its latest narration says what it is doing now.
  const currentOperation = useMemo(() => {
    if (!activeForRendering) return null;
    const narration = visibleSummaryAgent ? mergedItems.findIndex(item => item.id === visibleSummaryAgent.id) : -1;
    const index = mergedItems.findLastIndex(item => isLogItem(item) && item.kind !== 'reasoning');
    return index > narration ? mergedItems[index]! : null;
  }, [activeForRendering, mergedItems, visibleSummaryAgent]);
  const logEntries = leadingUserCount < 0 ? [] : groupedItems.slice(leadingUserCount);
  // A finished turn's answer has one place, below its work, folded or open: it
  // never moves into the opening work (where it would vanish for a moment).
  const finalAnswer = isTerminalTurnStatus(turn.status) && visibleSummaryAgent ? visibleSummaryAgent : null;
  // Native runtimes can update an early assistant message in place and append
  // tool/artifact records after it. Its position is not a completion marker.
  const processEntries = finalAnswer ? logEntries.filter(entry =>
    entry.kind !== 'item' || entry.item.id !== finalAnswer.id) : logEntries;
  // Prompts that started the turn sit above its work line; prompts added while it
  // worked sit below it when folded, so opening or folding the turn never moves
  // what is above the line.
  const leadingPrompts = leadingUserCount < 0 ? collapsedSummary.users.length : leadingUserCount;
  const renderPrompt = (item: (typeof collapsedSummary.users)[number]) => (
    <CompactMessageItem
      key={item.id}
      threadId={threadId}
      item={item}
      scrollRootRef={scrollRootRef}
      timeTitle={item.createdAt ? formatLongTimestamp(item.createdAt) : turnTimeTitle}
      {...(onBeforeMessageResize ? { onBeforeMessageResize } : {})}
      {...(adapter ? { adapter } : {})}
    />
  );
  const collapsedSummaryNode =
    hasCollapsedHiddenItems ? (
      <div className="thread-graph-turn-collapsed-summary space-y-2">
        {collapsedSummary.users.slice(0, leadingPrompts).map(renderPrompt)}
        <div className="thread-graph-worked-summary flex w-full items-center gap-2 py-2 text-sm">
          <TranscriptAgentByline />
          <button
            type="button"
            className="thread-worked-toggle group flex min-w-0 items-center gap-2 text-left transition"
            onClick={(event) => {
              if (deferredItemsLoading) return;
              onBeforeMessageResize?.(event.currentTarget);
              setOpenSoleRun(effectiveCollapsed);
              onToggleCollapse(turn, effectiveCollapsed);
            }}
            aria-label={translate("chat.turn_6e6e38", { value1: workedLabel, value2: effectiveCollapsed ? translate("chat.expand") : translate("chat.collapse"), value3: absoluteIndex })}
            aria-expanded={!effectiveCollapsed}
            aria-busy={deferredItemsLoading}
            title={deferredItemsLoading ? translate("chat.loadingCompleteHistory") : undefined}
          >
            {/* Loading only turns the chevron into a spinner; the line itself stays put. */}
            {deferredItemsLoading
              ? <span className="tlog-spinner thread-worked-spinner" role="img" aria-label={translate("chat.loadingCompleteHistory")} />
              : <ChevronRight className={`thread-worked-chevron h-4 w-4 shrink-0 transition ${effectiveCollapsed ? '' : 'rotate-90'}`} />}
            <span className="thread-graph-worked-label shrink-0">
              {deferredItemsError ? translate("chat.historyUnavailableRetry") : workedLabel}
            </span>
            {interruptedLabel}
            {workParts.length
              ? <ActivitySummary parts={workParts} />
              : fileParts.length ? null : <span className="thread-execution-step-count">{stepCount + peerWorkSteps} {translate("chat.steps")}</span>}
          </button>
          {fileParts.length && changedFiles.length ? (
            <button type="button" className="tlog-files-toggle" aria-expanded={filesOpen} title={translate('chat.logShowFiles')}
              onClick={(event) => { onBeforeMessageResize?.(event.currentTarget); setFilesOpen(value => !value); }}>
              <span className="tlog-sep" aria-hidden="true">·</span><Parts parts={fileParts} />
            </button>
          ) : fileParts.length ? <span className="tlog-summary"><span className="tlog-sep" aria-hidden="true">·</span><Parts parts={fileParts} /></span> : null}
          <span
            className="thread-graph-worked-rule h-px min-w-0 flex-1"
            aria-hidden="true"
          />
        </div>
        <Collapse open={filesOpen}><ChangedFiles files={changedFiles} total={activityCounts?.fileCount} /></Collapse>
        {effectiveCollapsed ? collapsedSummary.users.slice(leadingPrompts).map(renderPrompt) : null}
        {/* The work: folded into the line above when the turn ends, unfolded on request. */}
        <Collapse open={!effectiveCollapsed}>
          {story ? (
            <div className="thread-execution-timeline is-story">
              {storyBlocks(processEntries, story, finalAnswer?.id ?? null).map((block) => block.kind === 'run'
                ? <RunPlaceholder key={`run:${block.segment.before ?? 'end'}`} segment={block.segment} loading={deferredItemsLoading}
                    onOpen={() => { setOpenRunBefore(block.segment.before); onToggleCollapse(turn, true, true); }} />
                : <Fragment key={block.entry.key}>{renderHistoryEntries([block.entry])}</Fragment>)}
              {peerWorkChildren}
            </div>
          ) : (
            <div className="thread-execution-timeline">
              {renderHistoryEntries(processEntries)}
              {peerWorkChildren}
            </div>
          )}
        </Collapse>
        {effectiveCollapsed && answerSections ? <div className="thread-answer-sequence">
          {foldedAnswerBlocks(answerSections, turn.activity?.segments, finalAnswer?.id).map(block => {
            if (block.kind === 'answer') return (
              <div className="thread-answer-section" key={block.entry.key}>
                {block.entry.item.kind !== 'agentMessage' ? renderHistoryEntries([block.entry]) : <CompactMessageItem threadId={threadId} item={block.entry.item as ThreadHistoryItemDto & { kind: 'agentMessage' }}
                  streaming={block.entry.item.id === visibleSummaryAgent?.id && activeForRendering && isRunningHistoryStatus(block.entry.item.status)}
                  scrollRootRef={scrollRootRef}
                  timeTitle={block.entry.item.createdAt ? formatLongTimestamp(block.entry.item.createdAt) : turnTimeTitle}
                  {...(onBeforeMessageResize ? { onBeforeMessageResize } : {})}
                  {...(adapter ? { adapter } : {})} />}
              </div>
            );
            // A stretch of work between two answers opens in place, under its line;
            // the rest of the turn stays folded and nothing above it moves.
            const key = block.before ?? 'end';
            const open = openStretches.has(key);
            return (
              <div className="thread-execution-timeline" key={`gap:${key}`}>
                <RunPlaceholder segment={block.stretch} loading={open && deferredItemsLoading} open={open && block.work.length > 0}
                  onOpen={() => {
                    setOpenStretches(current => { const next = new Set(current); if (!next.delete(key)) next.add(key); return next; });
                    if (!open && turn.hasDeferredItems) onLoadTurnItems?.(turn);
                  }} />
                {open && block.work.length > 0 ? <div className="thread-stretch-work">{renderHistoryEntries(block.work, { openLastRun: true })}</div> : null}
              </div>
            );
          })}
        </div> : null}
        {/* A finished turn's answer stays below its work, folded or not. */}
        {finalAnswer ? renderSummaryAgent(finalAnswer) : null}
        {effectiveCollapsed && !finalAnswer && visibleSummaryAgent && !answerSections?.some(entry => entry.kind === 'item' && entry.item.id === visibleSummaryAgent.id)
          ? renderSummaryAgent(visibleSummaryAgent) : null}
        {effectiveCollapsed && currentOperation ? <div className="tlog-current"><LogRow key={currentOperation.id} item={currentOperation} /></div> : null}
        {/* The plan and status leave with the work when the turn ends. */}
        <Collapse open={activeForRendering}>
          <GraphChatTurnBody
            footer={footerNode}
            history={null}
            liveHookPrompt={liveHookPromptNode}
            liveOutput={liveOutputNode}
            livePlan={displayedLivePlan}
          />
        </Collapse>
      </div>
    ) : null;
  // Prompt, what the agent did, then its answer and the receipt.
  const terminalHistoryNode =
    terminalWorkedNode && leadingUserCount > 0 ? (
      <>
        {renderHistoryEntries(groupedItems.slice(0, leadingUserCount))}
        {terminalWorkedNode}
        {renderHistoryEntries(groupedItems.slice(leadingUserCount))}
      </>
    ) : (
      <>{historyNode}{terminalWorkedNode}</>
    );
  const turnBody = (
    <GraphChatTurnBody
      footer={footerNode}
      history={terminalHistoryNode}
      liveHookPrompt={liveHookPromptNode}
      liveOutput={liveOutputNode}
      livePlan={displayedLivePlan}
    />
  );

  if (nestedPeerWork) return <MessageExpansionScope key={`${threadId ?? ''}:${turn.id}`}><TurnEvidenceStatusContext.Provider value={turn.status}>
    <div className="thread-peer-execution">{historyNode}{liveHookPromptNode}{liveOutputNode}
      {turn.error ? <p role="alert">{turn.error}</p> : null}
    </div>
  </TurnEvidenceStatusContext.Provider></MessageExpansionScope>;

  return (
    <MessageExpansionScope key={`${threadId ?? ''}:${turn.id}`}>
    <TurnEvidenceStatusContext.Provider value={turn.status}>
    <TurnPromptContext.Provider value={promptContext}>
    <GraphChatTurnFrame
      absoluteIndex={absoluteIndex}
      body={canToggleWorkedSummary ? collapsedSummaryNode : turnBody}
      collapsed={effectiveCollapsed}
      collapsedBody={collapsedSummaryNode}
      error={(failedWith && firstPromptId) || recordedNothing || !turn.error ? null : turnErrorText(turn.error)}
      head={headNode}
      headerStatus={<TurnStatusBar turn={turn} />}
      isActive={activeForRendering}
      status={turn.status}
      refCallback={articleRef}
      startedAt={turn.startedAt}
      timeLabel={turnTimeLabel}
      timeTitle={turnTimeTitle}
      tokenSummary={<TurnTokenSummary turn={turn} />}
      attachment={renderTurnContent?.(turn.id)}
    />
    </TurnPromptContext.Provider>
    </TurnEvidenceStatusContext.Provider>
    </MessageExpansionScope>
  );
});

interface TimelineHistoryEntriesProps {
  entries: TimelineHistoryEntry[];
  expandedGroups: Record<string, boolean>;
  onToggleGroupedItem: (groupKey: string, currentExpanded: boolean) => void;
  /** Open the run before this item (null: the last run), once the turn has loaded. */
  openRunBefore?: string | null;
  /** Open the run when it is the whole of these entries. */
  openSoleRun?: boolean;
  threadId: string | undefined;
  scrollRootRef: RefObject<HTMLDivElement | null>;
  fallbackTimestamp?: string | null | undefined;
  fallbackTimeLabel?: string | null | undefined;
  fallbackTimeTitle?: string | null | undefined;
  turnStartedAt?: string | null | undefined;
  autoOpenLatestToolDetails?: boolean;
  onOpenExpandedText: OpenExpandedTextHandler;
  onOpenCommandDetail: OpenCommandDetailHandler;
  onOpenToolCallDetail: OpenToolCallDetailHandler;
  onOpenDeferredHistoryItemDetail: OpenDeferredHistoryItemDetailHandler;
  onSelectArtifact?: SelectArtifactHandler;
  onBeforeMessageResize?: (anchor?: Element | null) => void;
  adapter?: ThreadTimelineAdapter | undefined;
}

function TimelineHistoryEntries({
  entries,
  expandedGroups,
  onToggleGroupedItem,
  threadId,
  scrollRootRef,
  onOpenExpandedText,
  onOpenCommandDetail,
  onOpenToolCallDetail,
  onOpenDeferredHistoryItemDetail,
  onSelectArtifact,
  onBeforeMessageResize,
  adapter,
  fallbackTimestamp,
  fallbackTimeLabel,
  fallbackTimeTitle,
  turnStartedAt,
  autoOpenLatestToolDetails = false,
  openRunBefore,
  openSoleRun = false,
}: TimelineHistoryEntriesProps) {
  const { locale: i18nLocale } = useI18n();
  const latestEntryKey = entries.at(-1)?.key ?? null;
  const relativeTimeMeta = useCallback(
    (timestamp: string | null | undefined, endTimestamp?: string | null) =>
      timestamp ? (
        <TimelineTimeToggle
          absoluteLabel={formatShortTimestamp(timestamp)}
          timestamp={timestamp}
          endTimestamp={endTimestamp}
          displayMode={endTimestamp ? 'duration' : 'offset'}
          turnStartedAt={turnStartedAt ?? fallbackTimestamp}
        />
      ) : null,
    [fallbackTimestamp, turnStartedAt],
  );

  const renderItem = (item: ThreadHistoryItemDto, key: string) => {
    const timestamp = timestampForHistoryItem(item, fallbackTimestamp ?? null);
    const isUserMessage = item.kind === 'userMessage';
    const isAgentMessage = item.kind === 'agentMessage' || item.kind === 'reasoning';
    const timeLabel = isUserMessage
      ? formatMessageTimestamp(timestamp)
      : isAgentMessage
        ? formatPreciseMessageTimestamp(timestamp)
        : fallbackTimeLabel;
    return (
      <HistoryItemRow
        key={key}
        threadId={threadId}
        item={item}
        scrollRootRef={scrollRootRef}
        // Messages read as one log; their time shows on hover.
        timeLabel={isAgentMessage || isUserMessage ? null : timeLabel}
        timeTitle={item.createdAt ? formatLongTimestamp(timestamp) : fallbackTimeTitle}
        // The offset from the turn start needs the step's own time: the turn
        // start as a fallback reads as "0s" on every step (ELA-257 048f).
        timeMeta={item.createdAt ? relativeTimeMeta(item.createdAt) : null}
        autoOpenToolDetails={autoOpenLatestToolDetails && key === latestEntryKey}
        onOpenExpandedText={onOpenExpandedText}
        onOpenCommandDetail={onOpenCommandDetail}
        onOpenToolCallDetail={onOpenToolCallDetail}
        onOpenDeferredHistoryItemDetail={onOpenDeferredHistoryItemDetail}
        {...(onBeforeMessageResize ? { onBeforeMessageResize } : {})}
        {...(onSelectArtifact ? { onSelectArtifact } : {})}
        {...(adapter ? { adapter } : {})}
      />
    );
  };

  const blocks = logBlocks(entries);
  const lastKey = blocks.at(-1)?.key;
  const lastRunKey = blocks.findLast((block) => block.kind === 'run')?.key;
  // Work that is one run opens with the work line the reader just unfolded: its
  // summary would only repeat that line.
  const soleRun = openSoleRun && blocks.length === 1 && blocks[0]!.kind === 'run';
  return (
    <>
      {blocks.map((block, index) => {
        if (block.kind === 'item') {
          // A lone operation between messages is already one line.
          // The latest operation of a working turn shows its edit; earlier ones stay folded.
          return isLogItem(block.item)
            ? <div key={block.key} className="tlog-single"><LogRow item={block.item} defaultOpen={autoOpenLatestToolDetails && block.key === lastKey && opensDiff(block.item)} /></div>
            : renderItem(block.item, block.key);
        }
        // The run a working turn is in stays open; once narration or another run follows, it folds.
        const live = autoOpenLatestToolDetails && block.key === lastKey;
        const next = blocks[index + 1];
        const opened = openRunBefore === null ? block.key === lastRunKey
          : openRunBefore !== undefined && (next?.kind === 'item'
            ? next.item.id === openRunBefore
            // The item it precedes may be the answer, shown below the work.
            : block.key === lastRunKey && !blocks.some(other => other.kind === 'item' && other.item.id === openRunBefore));
        const expanded = expandedGroups[block.key] ?? expandedGroups[block.parentKey] ?? (live || opened || soleRun);
        return (
          <LogRun
            key={block.key}
            items={block.items}
            expanded={expanded}
            live={live}
            onToggle={() => onToggleGroupedItem(block.key, expanded)}
          />
        );
      })}
    </>
  );
}

type FoldedAnswerBlock =
  | { kind: 'answer'; entry: TimelineHistoryEntry & { kind: 'item' } }
  | { kind: 'gap'; before: string | null; stretch: ThreadTurnActivitySegmentDto; work: TimelineHistoryEntry[] };

function entryItems(entry: TimelineHistoryEntry): ThreadHistoryItemDto[] {
  if (entry.kind === 'item') return [entry.item];
  if (entry.kind === 'agentActivityGroup') return entry.entries.flatMap(entryItems);
  return entry.items;
}

/** A folded turn reads as its answers. The work before the first one is the work
    line's; the work between two answers (and after the last) is one counted line,
    from the summary's stretches, else from loaded operations. */
function foldedAnswerBlocks(
  sections: TimelineHistoryEntry[],
  segments: readonly ThreadTurnActivitySegmentDto[] | null | undefined,
  // Rendered after the sequence by the turn itself; the sequence stops before it.
  finalId?: string,
): FoldedAnswerBlock[] {
  const blocks: FoldedAnswerBlock[] = [];
  let previous: string | null = null;
  let work: ThreadHistoryItemDto[] = [];
  let workEntries: TimelineHistoryEntry[] = [];
  const gap = (before: string | null) => {
    if (previous === null) return;
    const stretch = stretchBetween(segments, previous, before) ?? stretchFromItems(work, before);
    if (stretch) blocks.push({ kind: 'gap', before, stretch, work: workEntries });
  };
  for (const entry of sections) {
    if (entry.kind !== 'item') {
      work.push(...entryItems(entry));
      workEntries.push(entry);
      continue;
    }
    gap(entry.item.id);
    if (entry.item.id === finalId) return blocks;
    blocks.push({ kind: 'answer', entry });
    previous = entry.item.id;
    work = [];
    workEntries = [];
  }
  gap(null);
  return blocks;
}

type LogBlock =
  | { kind: 'item'; key: string; item: ThreadHistoryItemDto }
  | { kind: 'run'; key: string; parentKey: string; items: ThreadHistoryItemDto[] };

/** Messages and notices stay in the reading flow; operations between them form runs. */
function logBlocks(entries: TimelineHistoryEntry[]): LogBlock[] {
  const blocks: LogBlock[] = [];
  for (const entry of entries) {
    if (entry.kind === 'item') {
      blocks.push({ kind: 'item', key: entry.key, item: entry.item });
      continue;
    }
    let run: ThreadHistoryItemDto[] = [];
    let first = true;
    const flush = () => {
      if (run.length === 1) blocks.push({ kind: 'item', key: run[0]!.id, item: run[0]! });
      else if (run.length) blocks.push({ kind: 'run', key: first ? entry.key : `${entry.key}@${run[0]!.id}`, parentKey: entry.key, items: run });
      if (run.length) first = false;
      run = [];
    };
    for (const item of flattenHistoryEntries([entry])) {
      if (isLogItem(item)) run.push(item);
      else {
        flush();
        blocks.push({ kind: 'item', key: item.id, item });
      }
    }
    flush();
  }
  return blocks;
}

function flattenHistoryEntries(entries: TimelineHistoryEntry[]): ThreadHistoryItemDto[] {
  return entries.flatMap((entry) =>
    entry.kind === 'item' ? [entry.item]
      : entry.kind === 'agentActivityGroup' ? flattenHistoryEntries(entry.entries)
        : entry.items);
}

type StoryBlock =
  | { kind: 'entry'; entry: TimelineHistoryEntry }
  | { kind: 'run'; segment: ThreadTurnActivitySegmentDto };

/** A folded turn's summary items in order, each preceded by the work before it. */
function storyBlocks(entries: TimelineHistoryEntry[], segments: ThreadTurnActivitySegmentDto[], answerId: string | null): StoryBlock[] {
  const before = new Map(segments.flatMap((segment) => segment.before ? [[segment.before, segment] as const] : []));
  const blocks: StoryBlock[] = [];
  for (const item of flattenHistoryEntries(entries)) {
    const segment = before.get(item.id);
    if (segment) blocks.push({ kind: 'run', segment });
    blocks.push({ kind: 'entry', entry: { kind: 'item', key: item.id, item } });
  }
  // The work before the answer, which is shown outside the folding part.
  const beforeAnswer = answerId ? before.get(answerId) : undefined;
  if (beforeAnswer) blocks.push({ kind: 'run', segment: beforeAnswer });
  const end = segments.find((segment) => segment.before === null);
  if (end) blocks.push({ kind: 'run', segment: end });
  return blocks;
}
