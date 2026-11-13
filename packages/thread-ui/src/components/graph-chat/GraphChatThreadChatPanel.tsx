import { translate, useI18n } from '../../i18n';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';

import type { ThreadDetailDto } from '@remote-codex/shared';
import type {
  ThreadDetailUiAdapter,
  ThreadTimelineAdapter,
} from '../../adapters';
import { ThreadComposer, type ThreadComposerProps } from '../ThreadComposer';
import {
  ThreadTimeline,
  type ThreadTimelineProps,
} from '../ThreadTimeline';
import { TranscriptAgentProvider, transcriptAgentFor } from './TranscriptAgent';
import { ThreadRelationBar } from './ThreadRelationBar';

export interface GraphChatThreadUsageSummary {
  input: number;
  output: number;
  cache: number;
  cacheWrite: number;
  priceUsd: number;
  pricedTurns: number;
  turns: number;
}

interface GraphChatThreadChatPanelProps {
  detail: ThreadDetailDto;
  adapter: ThreadDetailUiAdapter;
  timelineAdapter: ThreadTimelineAdapter;
  TimelineComponent?: ComponentType<ThreadTimelineProps>;
  liveOutput?: string;
  beforeTimelineContent?: ReactNode;
  composerProps?: Omit<ThreadComposerProps, 'activeView' | 'onSubmit'>;
  composerNotice?: ReactNode;
  timelineProps?: Partial<
    Omit<ThreadTimelineProps, 'threadId' | 'turns' | 'liveOutput' | 'adapter'>
  >;
  transcriptItemCount: number;
  useFloatingMobileComposer?: boolean;
  floatingDesktopComposer?: boolean;
  floatingMobileComposerBottomOffset?: number;
  composerHostRef?: RefObject<HTMLDivElement | null>;
  /** While another conversation loads: shown in the transcript's place, so the
      panel and its composer stay mounted (no flash, the draft keeps its focus). */
  timelinePending?: ReactNode;
}

export function GraphChatThreadChatPanel({
  detail,
  adapter,
  timelineAdapter,
  TimelineComponent = ThreadTimeline,
  liveOutput = '',
  beforeTimelineContent,
  composerProps,
  composerNotice,
  timelineProps,
  transcriptItemCount,
  useFloatingMobileComposer = false,
  floatingDesktopComposer = false,
  floatingMobileComposerBottomOffset = 0,
  composerHostRef,
  timelinePending,
}: GraphChatThreadChatPanelProps) {
  useI18n();
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileComposerHeight, setMobileComposerHeight] = useState(0);
  const [mobileComposerOverlap, setMobileComposerOverlap] = useState(0);
  const [mobileKeyboardInset, setMobileKeyboardInset] = useState(0);
  const [mobilePromptFocused, setMobilePromptFocused] = useState(false);
  const internalComposerHostRef = useRef<HTMLDivElement | null>(null);
  const panelRootRef = useRef<HTMLDivElement | null>(null);
  // Space between this chat and the window bottom (a terminal panel below it).
  // The keyboard covers that space first; only the rest overlaps this chat.
  const [panelBottomGap, setPanelBottomGap] = useState(0);
  const timelineTailVisibilityChange = timelineProps?.onTailVisibilityChange;
  const [tailVisible, setTailVisible] = useState(true);
  const [previousAvailable, setPreviousAvailable] = useState(false);
  const [nextAvailable, setNextAvailable] = useState(false);
  const [latestRequest, setLatestRequest] = useState(0);
  const [previousRequest, setPreviousRequest] = useState(0);
  const [nextRequest, setNextRequest] = useState(0);
  const hasPendingRequests = detail.pendingRequests.length > 0;
  const queuedPrompts = useMemo(() => {
    const pendingSteers = detail.pendingSteers ?? [];
    const materializedClientRequestIds = new Set(
      pendingSteers
        .map((prompt) => prompt.clientRequestId)
        .filter((value): value is string => Boolean(value)),
    );
    return [
      ...pendingSteers
        .filter((prompt) => prompt.delivery === "continuation")
        .map((prompt) => ({
          id: prompt.id,
          prompt: prompt.prompt,
          ...(prompt.id.startsWith("optimistic-") ? { optimistic: true } : {}),
        })),
      ...(timelineProps?.optimisticSteers ?? [])
        .filter(
          (prompt) => !materializedClientRequestIds.has(prompt.clientRequestId),
        )
        .map((prompt) => ({
          id: prompt.id,
          prompt: prompt.prompt,
          optimistic: true,
        })),
    ];
  }, [detail.pendingSteers, timelineProps?.optimisticSteers]);
  const steeredPrompts = useMemo(
    () =>
      (detail.pendingSteers ?? []).filter(
        (prompt) => prompt.delivery === "steer",
      ),
    [detail.pendingSteers],
  );
  const resolvedComposerProps = useMemo(
    () =>
      composerProps
        ? {
            ...composerProps,
            threadRunning: composerProps.threadRunning ??
              (detail.thread.status === 'running' || detail.thread.activeTurnId !== null),
            followTail: composerProps.followTail ?? tailVisible,
            onToggleFollow: composerProps.onToggleFollow ?? (() => setLatestRequest(value => value + 1)),
            canJumpToPreviousTurn: composerProps.canJumpToPreviousTurn ?? previousAvailable,
            onJumpToPreviousTurn: composerProps.onJumpToPreviousTurn ?? (() => setPreviousRequest(value => value + 1)),
            canJumpToNextTurn: composerProps.canJumpToNextTurn ?? nextAvailable,
            onJumpToNextTurn: composerProps.onJumpToNextTurn ?? (() => setNextRequest(value => value + 1)),
            pendingPrompts: queuedPrompts,
            ...(adapter.steerPendingPrompt &&
            composerProps.capabilities?.turns.steer
              ? {
                  onSteerPendingPrompt: (pendingPromptId: string) =>
                    adapter.steerPendingPrompt?.(
                      detail.thread.id,
                      pendingPromptId,
                    ),
                }
              : {}),
            ...(adapter.cancelPendingSteer
              ? {
                  onCancelPendingPrompt: (pendingPromptId: string) =>
                    adapter.cancelPendingSteer?.(
                      detail.thread.id,
                      pendingPromptId,
                    ),
                }
              : {}),
          }
        : null,
    [
      adapter.cancelPendingSteer,
      adapter.steerPendingPrompt,
      composerProps,
      detail.thread.activeTurnId,
      detail.thread.id,
      detail.thread.status,
      queuedPrompts,
      tailVisible, previousAvailable, nextAvailable,
    ],
  );

  const handleTailVisibilityChange = useCallback(
    (nextIsTailVisible: boolean) => {
      setTailVisible(nextIsTailVisible);
      timelineTailVisibilityChange?.(nextIsTailVisible);
    },
    [timelineTailVisibilityChange],
  );
  const handlePreviousAvailability = useCallback((available: boolean) => {
    setPreviousAvailable(available);
    timelineProps?.onPreviousTurnAvailabilityChange?.(available);
  }, [timelineProps?.onPreviousTurnAvailabilityChange]);
  const handleNextAvailability = useCallback((available: boolean) => {
    setNextAvailable(available);
    timelineProps?.onNextTurnAvailabilityChange?.(available);
  }, [timelineProps?.onNextTurnAvailabilityChange]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 639px)');
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);
    return () => {
      mediaQuery.removeEventListener('change', updateViewport);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const updateKeyboardInset = () => {
      const viewport = window.visualViewport;
      const keyboardInset = viewport
        ? Math.max(
            0,
            Math.round(window.innerHeight - viewport.height - viewport.offsetTop),
          )
        : 0;
      const viewportDelta = viewport
        ? Math.max(0, Math.round(window.innerHeight - viewport.height))
        : keyboardInset;
      const correctedInset = Math.min(keyboardInset, viewportDelta);
      const maxReasonableInset = Math.max(0, Math.round(window.innerHeight * 0.52));
      setMobileKeyboardInset(Math.min(correctedInset, maxReasonableInset));
    };

    updateKeyboardInset();
    window.visualViewport?.addEventListener('resize', updateKeyboardInset);
    window.visualViewport?.addEventListener('scroll', updateKeyboardInset);
    window.addEventListener('resize', updateKeyboardInset);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateKeyboardInset);
      window.visualViewport?.removeEventListener('scroll', updateKeyboardInset);
      window.removeEventListener('resize', updateKeyboardInset);
    };
  }, []);

  useLayoutEffect(() => {
    const node = internalComposerHostRef.current;
    if (!node || (!isMobileViewport && !floatingDesktopComposer)) {
      setMobileComposerHeight(0);
      return;
    }

    const updateHeight = () => {
      setMobileComposerHeight(Math.ceil(node.getBoundingClientRect().height));
    };

    updateHeight();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [isMobileViewport, floatingDesktopComposer, composerProps, composerNotice, hasPendingRequests]);

  useLayoutEffect(() => {
    const node = internalComposerHostRef.current;
    if (!node || (!isMobileViewport && !floatingDesktopComposer)) {
      setMobileComposerOverlap(0);
      return;
    }

    const updateOverlap = () => {
      const rect = node.getBoundingClientRect();
      const root = panelRootRef.current;
      // The navigation capsule sits above the host, outside its layout height.
      const navigation = node.querySelector('.thread-jump-latest-cluster');
      const top = navigation ? Math.min(rect.top, navigation.getBoundingClientRect().top) : rect.top;
      const bottom = useFloatingMobileComposer || !root
        ? window.innerHeight
        : Math.min(window.innerHeight, root.getBoundingClientRect().bottom);
      setPanelBottomGap(Math.max(0, Math.round(window.innerHeight - bottom)));
      setMobileComposerOverlap(
        Math.max(0, Math.ceil(bottom - top)),
      );
    };

    updateOverlap();
    window.addEventListener('resize', updateOverlap);
    window.visualViewport?.addEventListener('resize', updateOverlap);
    window.visualViewport?.addEventListener('scroll', updateOverlap);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateOverlap);
      observer.observe(node);
      const navigation = node.querySelector('.thread-jump-latest-cluster');
      if (navigation) observer.observe(navigation);
      if (panelRootRef.current) observer.observe(panelRootRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateOverlap);
      window.visualViewport?.removeEventListener('resize', updateOverlap);
      window.visualViewport?.removeEventListener('scroll', updateOverlap);
      observer?.disconnect();
    };
  }, [
    isMobileViewport,
    floatingDesktopComposer,
    mobileKeyboardInset,
    mobilePromptFocused,
    composerProps,
    composerNotice,
    hasPendingRequests,
    useFloatingMobileComposer,
  ]);

  useEffect(() => {
    if (!isMobileViewport) {
      setMobilePromptFocused(false);
      return;
    }

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        internalComposerHostRef.current?.contains(target)
      ) {
        setMobilePromptFocused(true);
      }
    };
    const handleFocusOut = (event: FocusEvent) => {
      const nextTarget = event.relatedTarget;
      if (
        nextTarget instanceof HTMLElement &&
        internalComposerHostRef.current?.contains(nextTarget)
      ) {
        return;
      }
      setMobilePromptFocused(false);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, [isMobileViewport]);

  const setComposerHostRefs = useCallback(
    (node: HTMLDivElement | null) => {
      internalComposerHostRef.current = node;
      if (composerHostRef) {
        (
          composerHostRef as RefObject<HTMLDivElement | null>
        ).current = node;
      }
    },
    [composerHostRef],
  );

  // A workbench pane switch briefly changes focus while the IME is still
  // visible. Both panes must keep avoiding that viewport, including the strip.
  const mobileComposerBottomOffset =
    isMobileViewport && (mobilePromptFocused || floatingDesktopComposer)
      ? Math.max(0, mobileKeyboardInset - (useFloatingMobileComposer ? floatingMobileComposerBottomOffset : 0) - panelBottomGap)
      : 0;
  // Above a bottom panel the chat is short; reserve the composer's real height.
  const effectiveMobileComposerHeight = panelBottomGap > 0
    ? mobileComposerHeight
    : Math.max(mobileComposerHeight, 144);
  const effectiveMobileComposerOverlap = Math.max(
    mobileComposerOverlap,
    effectiveMobileComposerHeight + mobileComposerBottomOffset,
  );
  const chatScrollBottomSpacer = isMobileViewport
    ? effectiveMobileComposerOverlap + 12
    : floatingDesktopComposer ? mobileComposerOverlap + 12 : 0;
  const panelStyle: CSSProperties | undefined =
    chatScrollBottomSpacer > 0
      ? ({
          '--thread-graph-chat-scroll-bottom-spacer': `${chatScrollBottomSpacer}px`,
          '--thread-composer-keyboard-inset': `${mobileComposerBottomOffset}px`,
        } as CSSProperties)
      : undefined;
  const floatingComposerStyle: CSSProperties | undefined =
    useFloatingMobileComposer && isMobileViewport
      ? {
          bottom: `${
            floatingMobileComposerBottomOffset + mobileComposerBottomOffset
          }px`,
          paddingBottom:
            'max(env(safe-area-inset-bottom), var(--android-safe-area-bottom, 0px))',
        }
      : undefined;
  const transcriptAgent = useMemo(
    () => transcriptAgentFor(detail.thread),
    [detail.thread],
  );
  const parentThreadId = detail.thread.parentThreadId;
  const timelineElement = useMemo(() => {
    const threadRunning =
      detail.thread.status === 'running' || detail.thread.activeTurnId !== null;

    return (
      <TimelineComponent
        key={detail.thread.id}
        threadId={detail.thread.id}
        turns={detail.turns}
        totalTurnCount={detail.totalTurnCount ?? detail.turns.length}
        pendingRequests={detail.pendingRequests}
        activeTurnId={detail.thread.activeTurnId}
        threadRunning={threadRunning}
        liveOutput={liveOutput}
        className="thread-timeline-surface min-h-0 flex-1"
        {...timelineProps}
        scrollRequestKey={timelineProps?.scrollRequestKey ?? latestRequest}
        previousTurnScrollRequestKey={timelineProps?.previousTurnScrollRequestKey ?? previousRequest}
        nextTurnScrollRequestKey={timelineProps?.nextTurnScrollRequestKey ?? nextRequest}
        onPreviousTurnAvailabilityChange={handlePreviousAvailability}
        onNextTurnAvailabilityChange={handleNextAvailability}
        pendingSteers={steeredPrompts}
        optimisticSteers={[]}
        adapter={timelineAdapter}
        onOpenThread={timelineProps?.onOpenThread ?? adapter.openThread}
        onTailVisibilityChange={handleTailVisibilityChange}
      />
    );
  }, [
    TimelineComponent,
    adapter.openThread,
    detail.pendingRequests,
    detail.thread.activeTurnId,
    detail.thread.id,
    detail.thread.status,
    detail.totalTurnCount,
    detail.turns,
    handleTailVisibilityChange,
    liveOutput,
    timelineAdapter,
    timelineProps,
    steeredPrompts,
    latestRequest, previousRequest, nextRequest, handlePreviousAvailability, handleNextAvailability,
  ]);

  const hasComposerNotice = composerNotice !== null && composerNotice !== undefined && composerNotice !== false;
  const notice = hasComposerNotice ? <div className="thread-composer-notice">{composerNotice}</div> : null;

  return (
    <div
      ref={panelRootRef}
      data-testid="chat-panel"
      className="thread-graph-chat-panel relative flex h-full min-h-0 flex-col"
      style={panelStyle}
    >
      {/* A sub-thread names the thread that started it, pinned above its conversation. */}
      {!timelinePending && parentThreadId && adapter.describeThread ? (
        <ThreadRelationBar
          parentThreadId={parentThreadId}
          parent={adapter.describeThread(parentThreadId)}
          currentWorkspaceId={detail.thread.workspaceId}
          href={adapter.getThreadHref?.(parentThreadId)}
          onOpen={adapter.openThread}
        />
      ) : null}
      {!timelinePending && beforeTimelineContent}
      {/* ElAgente: the same thread's timeline stays mounted (hidden) while it reloads,
          so molecular viewers keep their camera and frames instead of remounting. */}
      <div className="thread-timeline-frame" hidden={Boolean(timelinePending)} inert={Boolean(timelinePending)}>
        <TranscriptAgentProvider agent={transcriptAgent}>
          {timelineElement}
        </TranscriptAgentProvider>
      </div>
      {timelinePending ? (
        <div className="thread-timeline-surface thread-timeline-pending flex min-h-0 flex-1 flex-col">{timelinePending}</div>
      ) : null}
      <div className={`thread-chat-usage-footer hidden shrink-0 items-center px-4 py-1 text-[10px] leading-4 ${timelinePending ? '' : 'sm:flex'}`}>
        <span className="min-w-0">
          {detail.turns.length} {translate("chat.turn_b09c73")}{detail.turns.length !== 1 ? translate("chat.s") : ''}
          <span className="mx-1 text-[var(--theme-border-contrast)]">|</span>
          {transcriptItemCount} {translate("chat.item")}{transcriptItemCount !== 1 ? translate("chat.s") : ''}
        </span>
      </div>
      {resolvedComposerProps ? (
        useFloatingMobileComposer ? (
          <div
            ref={setComposerHostRefs}
            className="fixed inset-x-0 bottom-0 z-50 overflow-visible sm:hidden"
            data-composer-notice={hasComposerNotice ? 'true' : undefined}
            style={
              floatingComposerStyle ?? {
                bottom: `${floatingMobileComposerBottomOffset}px`,
                paddingBottom:
                  'max(env(safe-area-inset-bottom), var(--android-safe-area-bottom, 0px))',
              }
            }
          >
            {notice}
            <ThreadComposer
              key={detail.thread.id}
              {...resolvedComposerProps}
              activeView="chat"
              edgeToEdgeMobile
              onSubmit={adapter.sendPrompt}
            />
          </div>
        ) : (
          <div
            ref={setComposerHostRefs}
            className="thread-graph-composer-host shrink-0"
            data-composer-notice={hasComposerNotice ? 'true' : undefined}
          >
            {notice}
            <ThreadComposer
              key={detail.thread.id}
              {...resolvedComposerProps}
              activeView="chat"
              onSubmit={adapter.sendPrompt}
            />
          </div>
        )
      ) : null}
    </div>
  );
}
