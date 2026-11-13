import * as react from 'react';
import { RefObject, TouchEvent, MouseEvent, ReactNode, Dispatch, SetStateAction, Component, ErrorInfo, Ref, ComponentType, ForwardRefExoticComponent, RefAttributes, ComponentProps } from 'react';
import { a as GraphMoleculeViewerSnapshot } from './GraphMoleculeViewerData-DHnrXMbl.js';
import { T as ThreadShellControlState$1, P as PromptAttachmentUpload, S as SettingsSection, a as ThreadTimelineAdapter, b as ThreadShellAdapter, c as ThreadGraphWorkspacePanelProps, d as PluginContextValue, e as ThreadDetailUiAdapter, f as ThreadGraphWorkspaceFeatures, W as WorkspaceHostPanel, g as WorkspaceHostPanelRequest, h as SettingsPanels, i as ThreadWorkspaceAdapter } from './workspace-panel-C_e3uVsA.js';
export { D as DescribeThread, E as ExtensionPluginApi, j as PluginContext, k as PluginProvider, l as PluginProviderAdapter, m as SendPromptInput, n as ShellSocketConnection, o as ShellSocketHandlers, p as ThreadImageAssetVariant, q as ThreadLinkInfo, r as ThreadToolArtifact, s as ThreadWorkspaceArchiveFormat, t as ThreadWorkspaceCapabilities, u as ThreadWorkspaceTrashEntry, v as ThreadWorkspaceTrashList, w as WorkspaceDocumentSaveInput, x as WorkspaceDocumentSnapshot, y as WorkspaceSaveReceipt, z as WorkspaceTab, A as createDefaultPluginContextValue, B as createExtensionPluginApi, C as extensionModuleAvailable, F as mergePluginState } from './workspace-panel-C_e3uVsA.js';
import { ReasoningEffortDto, ModelOptionDto, CollaborationModeDto, SandboxModeDto, ThreadContextUsageDto, AgentProviderCapabilitiesDto, AgentBackendToolboxItemSchemaDto, AgentBackendHookCommandTemplateDto, AgentBackendManagementSchemaDto, PromptAttachmentKindDto, ThreadSkillsDto, ThreadMcpServersDto, ThreadHooksDto, ThreadForkTurnOptionDto, ThreadGoalDto, CreateThreadHookInput, UpdateThreadHookInput, ThreadGoalStatusDto, ProviderHostFileDto, AgentSubscriptionUsageDto, UpdateThreadSettingsInput, StructuredUsage, ThreadTurnDto, ThreadTurnTokenBreakdownDto, ThreadTurnPriceEstimateDto, AgentBackendIdDto, ThreadDto, AgentRuntimeStatusDto, ThreadActionRequestDto, ThreadHistoryItemDto, RespondThreadActionRequestInput, ThreadAnsweredRequestNoteDto, ThreadActivityNoteDto, ThreadPendingSteerDto, ThreadHistoryItemDetailDto, ShellStatusDto, ThreadExportTurnOptionsDto, ThreadExportFormatDto, ExportThreadTranscriptInput, ThreadDetailDto, PluginDto, ImportPluginInput } from '@remote-codex/shared';
import { P as PluginActionOutputContext, T as ThreadPluginAdapter } from './plugin-types-C1Ip6feU.js';
export { A as ArtifactRenderContext, E as ExtensionHostAdapter, a as ExtensionRenderContext, F as FrontendPluginModule, I as InlineCodeRenderContext, M as MessagePresentation, b as MessagePresentationContext, c as PluginSettingsContext, d as PluginSettingsContribution, e as PluginSettingsSnapshot, f as ThreadPanelContribution, g as ThreadPluginDto, h as ThreadPluginSettingsInput, i as ThreadPluginSettingsSnapshot, U as UpstreamConnectionHost, j as UpstreamConnectionPickerProps, k as UpstreamConnectionPickerValue, l as UpstreamConnectionProtocol, V as ViewerToolbarContext, m as ViewerToolbarContribution } from './plugin-types-C1Ip6feU.js';
import * as DialogPrimitive from '@radix-ui/react-dialog';
export { DEFAULT_LOCALE, I18nProvider, LOCALE_OPTIONS, LOCALE_STORAGE_KEY, LanguageSwitcher, Locale, SUPPORTED_LOCALES, TranslationKey, TranslationValues, detectLocale, formatDate, formatNumber, getLocale, initializeI18n, normalizeLocale, setLocale, t, translate, useI18n } from './i18n.js';
import '3dmol';

type CopyState = 'idle' | 'copied' | 'failed';
/** Copies `value`; returns the state to show. Shared by every copy control. */
declare function useCopy(): {
    state: CopyState;
    copy: (value: string) => Promise<boolean>;
};
/** The one copy control: a two-page icon that turns into a check when copied, or
    a red warning with "Copy failed" beside it; either is announced. */
declare function CopyButton({ value, label, className, onCopied }: {
    value: string | (() => string);
    /** What it copies, e.g. "Copy path". */
    label: string;
    className?: string | undefined;
    onCopied?: (() => void) | undefined;
}): react.JSX.Element;

declare function formatFileSize(bytes: number): string;

/** Clipboard access for the terminal. The async API needs a secure page (https
    or localhost); over plain http, copying falls back to a hidden textarea and
    reading is not possible, so callers offer a paste field instead. */
declare function copyText(text: string): Promise<boolean>;

/** A displayed path: monospace, shortened in the middle (its start and last
    segment stay), with a copy button. Tapping it shows the whole path. */
declare function PathChip({ path, display, copyValue, label, className }: {
    path: string;
    /** What to show when it differs from the path (e.g. `~` for home). */
    display?: string | undefined;
    /** What to copy when it differs from the path. */
    copyValue?: string | undefined;
    /** The copy button's name; "Copy path" by default. */
    label?: string | undefined;
    className?: string | undefined;
}): react.JSX.Element;

/**
 * The keyboard of every app menu (see docs/ui-principles.md §3): focus goes to
 * the first item when it opens; ↑/↓ move and wrap, Home/End jump; Esc closes it
 * and returns focus to the trigger; Tab closes it and moves on.
 */
declare function useMenuKeyboard(menuRef: RefObject<HTMLElement | null>, open: boolean, onClose: (restoreFocus: boolean) => void, itemSelector?: string): void;

/**
 * A modal window's focus (see docs/ui-principles.md §4): it moves in when the
 * window opens (to `initial`, else the first control), Tab and Shift+Tab stay
 * inside, Esc closes it, and focus returns to what had it before.
 */
declare function useModalFocus(windowRef: RefObject<HTMLElement | null>, open: boolean, onClose?: () => void, initial?: string): void;

/** A touch held still for half a second opens the same menu as a right click or
    the ⋯ button (iOS fires no contextmenu); the click that follows is dropped. */
declare function useLongPress(onLongPress: (point: {
    x: number;
    y: number;
}) => void, delay?: number): {
    onTouchStart(event: TouchEvent): void;
    onTouchMove(event: TouchEvent): void;
    onTouchEnd: () => void;
    onTouchCancel: () => void;
    onClickCapture(event: MouseEvent): void;
};

/** The app's own confirmation in place of `window.confirm` (see
    docs/ui-principles.md §11): resolves true when confirmed. */
declare function confirmAsync({ title, description, confirmLabel, cancelLabel }: {
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel?: string;
}): Promise<boolean>;

/** What each navigation status is called (see docs/ui-principles.md §6). */
declare function navigationStatusLabel(status: string): string;
/** The one thread status mark: spinner ring, green dot, hollow dot, amber square,
    red diamond or orange hollow square, with its name for assistive technology. */
declare function StatusMark({ status, label }: {
    status: string;
    label?: string | undefined;
}): react.JSX.Element;

/**
 * Generic live-structure data for {@link LiveStructuresPanel}. Hosts translate
 * their transport (for example a latest-only telemetry stream) into these
 * shapes; the panel never talks to a server.
 */
type LiveStructureStatus = 'running' | 'done' | 'failed';
type LiveStructureSummaryValue = string | number | boolean | null;
type LiveStructureSummary = Record<string, LiveStructureSummaryValue>;
/** A stream is identified by its producer and its ID within that producer. */
interface LiveStructureKey {
    producer: string;
    id: string;
}
interface LiveStructureRow extends LiveStructureKey {
    status: LiveStructureStatus;
    seq?: number;
    summary?: LiveStructureSummary | null;
    updatedAt?: string | null;
}
/** The latest single frame of a watched stream (XYZ or extXYZ text). */
interface LiveStructureFrame extends LiveStructureKey {
    seq?: number;
    format: string;
    xyz: string;
}
/** One frame of a watched stream's trajectory, in `seq` order. */
interface LiveTrajectoryFrame {
    seq: number;
    format: string;
    xyz: string;
}
interface LiveStructureTotals {
    streams: number;
    running: number;
    done: number;
    failed: number;
}
interface LiveStructureProducer {
    id: string;
    streams: number;
    updatedAt?: string | null;
}
type LiveStructureStatusFilter = LiveStructureStatus | null;
interface LiveStructureColumn {
    /** `id` and `status` are the row's own fields; other keys read the summary. */
    key: string;
    label: string;
    numeric?: boolean;
}
declare const LIVE_STRUCTURES_MAX_SELECTED = 4;
declare const LIVE_STRUCTURES_PAGE_SIZE = 100;
/** A stable string identity for a stream. */
declare function liveStructureKey(key: LiveStructureKey): string;
declare function sameLiveStructure(a: LiveStructureKey, b: LiveStructureKey): boolean;
/**
 * Columns for the loaded rows: ID, then label, stage, step and energy when
 * any row reports them, then other summary keys in alphabetical order, then
 * status. `unit` is shown with the energy rather than as its own column.
 */
declare function deriveLiveStructureColumns(rows: readonly LiveStructureRow[], labels?: Partial<Record<string, string>>): LiveStructureColumn[];
declare function formatLiveStructureValue(value: LiveStructureSummaryValue | undefined): string;
/** The text of one cell; energy carries its unit when the row has one. */
declare function liveStructureCell(row: LiveStructureRow, key: string): string;
/**
 * Toggles one stream in a selection of at most `max` streams. Selecting past
 * the limit returns the selection unchanged.
 */
declare function toggleLiveStructure(selected: readonly LiveStructureKey[], key: LiveStructureKey, max?: number): LiveStructureKey[];
declare function liveStructurePageCount(total: number, pageSize?: number): number;
/**
 * The durable trajectory file a stream's summary names (`summary.trajectory`),
 * when it is a plain workspace-relative path; null otherwise.
 */
declare function liveStructureTrajectoryPath(row: Pick<LiveStructureRow, 'summary'> | null | undefined): string | null;

interface LiveStructuresPanelProps {
    totals: LiveStructureTotals;
    producers?: readonly LiveStructureProducer[];
    /**
     * The rows to show. With `onPageChange` these are the rows of `page`
     * (the host pages); without it the panel pages through them itself.
     */
    rows: readonly LiveStructureRow[];
    /** Zero-based page; host-controlled together with `onPageChange`. */
    page?: number;
    onPageChange?: (page: number) => void;
    /** Rows available across all pages (host paging); defaults to the matching total. */
    rowCount?: number;
    pageSize?: number;
    /** Host-controlled status filter; the totals become filter toggles. */
    statusFilter?: LiveStructureStatusFilter;
    onStatusFilterChange?: (filter: LiveStructureStatusFilter) => void;
    selected: readonly LiveStructureKey[];
    onSelectionChange: (selected: LiveStructureKey[]) => void;
    maxSelected?: number;
    /** Latest frames of watched streams; others are ignored. */
    frames?: readonly LiveStructureFrame[];
    /** Latest known rows of selected streams that may not be on the shown page. */
    selectedRows?: readonly LiveStructureRow[];
    /** The producing turn has ended: the panel shows the last reported state. */
    ended?: boolean;
    loading?: boolean;
    error?: string | null;
    title?: ReactNode;
    defaultOpen?: boolean;
    columns?: readonly LiveStructureColumn[];
    /** Replaces the default inline molecule viewer for one frame. */
    renderViewer?: (frame: LiveStructureFrame) => ReactNode;
    /**
     * Opens a stream's trajectory player in the host's side panel. When given,
     * watched viewers and table rows offer "Open trajectory".
     */
    onOpenTrajectory?: (stream: LiveStructureKey) => void;
    className?: string;
}
/**
 * Summaries and latest frames of many concurrently relaxing or simulated
 * structures. Totals and producers head a paged summary table; selected rows
 * (at most four by default) open inline viewers of their latest frame. The
 * panel is data-only: the host supplies rows, frames and paging, and turns
 * selection changes into whatever watch request its transport needs.
 */
declare function LiveStructuresPanel({ totals, producers, rows, page: controlledPage, onPageChange, rowCount, pageSize, statusFilter, onStatusFilterChange, selected, onSelectionChange, maxSelected, frames, selectedRows, ended, loading, error, title, defaultOpen, columns: columnsOverride, renderViewer, onOpenTrajectory, className, }: LiveStructuresPanelProps): react.JSX.Element;

/**
 * The shared molecule viewer for one inline frame. The object identity is the
 * stream, not the frame, so a new frame redraws the model and keeps the
 * personal camera, as a streamed trajectory revision does.
 */
declare function LiveStructureFrameViewer({ frame }: {
    frame: LiveStructureFrame;
}): react.JSX.Element;

/** How often a growing trajectory reaches the viewer, at most. */
declare const LIVE_TRAJECTORY_UPDATE_MS = 1000;
interface LiveTrajectoryPlayerProps {
    stream: LiveStructureKey;
    /** The stream's latest summary row: status, step, energy and `trajectory`. */
    row?: LiveStructureRow | null;
    /** Received frames in `seq` order; the host appends to them as the stream grows. */
    frames: readonly LiveTrajectoryFrame[];
    /** Frames before the first one were not kept (evicted or never retained). */
    truncated?: boolean;
    /** Earlier frames are being loaded. */
    loading?: boolean;
    error?: string | null;
    /** The producing turn has ended. */
    ended?: boolean;
    updateIntervalMs?: number;
    /**
     * Opens the durable trajectory file (`summary.trajectory`, workspace-relative)
     * through the host's file viewer when the reader asks; the player never opens
     * it by itself. The file is offered only with this handler and
     * `trajectoryAvailable`.
     */
    onOpenTrajectory?: (path: string) => void;
    /**
     * The host has seen the trajectory file in the workspace. A stream can be
     * done well before its run syncs the file, so until then the player says the
     * file will be available when the run syncs and keeps playing its frames.
     */
    trajectoryAvailable?: boolean;
    onClose?: () => void;
    /** Replaces the default molecule viewer (tests, custom hosts). */
    renderViewer?: (source: GraphMoleculeViewerSnapshot) => ReactNode;
    className?: string;
}
/**
 * A side-panel player for one watched stream's trajectory. It plays the
 * frames received so far through the shared molecule viewer (play/pause,
 * frame slider, LIVE follow) and grows as frames arrive, at most once per
 * second, keeping the camera. Once the stream is done and its summary names a
 * durable `trajectory` file, the player keeps playing and offers that file as
 * soon as the host reports it in the workspace.
 */
declare function LiveTrajectoryPlayer({ stream, row, frames, truncated, loading, error, ended, updateIntervalMs, onOpenTrajectory, trajectoryAvailable, onClose, renderViewer, className, }: LiveTrajectoryPlayerProps): react.JSX.Element;

interface SlashPanelState<T> {
    status: 'idle' | 'loading' | 'ready' | 'failed';
    data: T | null;
    error: string | null;
}

type ComposerSendShortcut = 'ctrlEnter' | 'enter';

/** `reasoningEffort: null` is the deliberate upstream Auto, never "Agent default". */
interface ModelPolicySelectionDto {
    model: string;
    reasoningEffort: ReasoningEffortDto | null;
    settings?: Record<string, unknown>;
}
interface ModelPolicyPresetDto {
    id: string;
    label: string;
    description?: string | null;
}
interface ModelPolicyGroupDto {
    id: string;
    label: string;
    description?: string | null;
    members: string[];
    defaultSelection: ModelPolicySelectionDto;
    effectiveSelection: ModelPolicySelectionDto;
    isOverridden: boolean;
    /** The existing `model/list` options this group may use. */
    models: ModelOptionDto[];
}
interface ModelPolicyViewDto {
    version: number;
    revision: string;
    policyRevision: string;
    /** A declared preset, or null for the custom group selection. */
    presetId: string | null;
    overrides: Record<string, ModelPolicySelectionDto>;
    presets: ModelPolicyPresetDto[];
    groups: ModelPolicyGroupDto[];
    recovery: {
        code: string;
        message: string;
    } | null;
}
interface ModelPolicyUpdateSelection {
    presetId: string | null;
    overrides: Record<string, {
        model: string;
        reasoningEffort: ReasoningEffortDto | null;
    }>;
}
/** The two settings-controlled displays. Neither changes the execution selection. */
type ModelPolicyDisplay = 'presets' | 'groups';
interface ComposerModelPolicyProps {
    display: ModelPolicyDisplay;
    view: ModelPolicyViewDto | null;
    /** loading: first read; saving: an update is in flight. */
    status: 'loading' | 'ready' | 'saving';
    /** A read or update failure, shown with Retry. */
    error?: string | null;
    /** Why changes cannot be made now, for example while a turn runs. */
    lockedReason?: string | null;
    /** The host needs an explicit preset or group choice before the next turn
        (for example a conversation that still carries a single-model selection).
        Choosing the current preset again then counts as that confirmation. */
    confirmationRequired?: string | null;
    onUpdate: (selection: ModelPolicyUpdateSelection) => void;
    onRetry: () => void;
}

type ThreadComposerAttachmentPicker = (input: {
    kind: PromptAttachmentKindDto;
    appendAttachments: (files: FileList | null, kind?: PromptAttachmentKindDto) => boolean;
    defaultPick: () => void;
}) => void;
interface ThreadComposerProps {
    activeView: 'chat' | 'shell';
    sendShortcut?: ComposerSendShortcut;
    edgeToEdgeMobile?: boolean;
    busy?: boolean;
    settingsBusy?: boolean;
    compactBusy?: boolean;
    error?: string | null;
    model?: string | null;
    agentLabel?: string | null;
    reasoningEffort?: ReasoningEffortDto | null;
    fastMode?: boolean;
    collaborationMode?: CollaborationModeDto;
    sandboxMode?: SandboxModeDto | null;
    hideSandboxModeControl?: boolean;
    modelOptions?: ModelOptionDto[];
    contextUsage?: ThreadContextUsageDto | null | undefined;
    capabilities?: AgentProviderCapabilitiesDto | null | undefined;
    toolboxItems?: AgentBackendToolboxItemSchemaDto[] | null | undefined;
    hookCommandTemplates?: AgentBackendHookCommandTemplateDto[] | null | undefined;
    mcpConfigFormat?: AgentBackendManagementSchemaDto['mcpConfigFormat'] | null | undefined;
    followTail?: boolean;
    threadConnected?: boolean;
    shellAvailable?: boolean;
    disabled?: boolean;
    /** A turn is running; the chat panel supplies it from the thread when omitted. */
    threadRunning?: boolean;
    disabledPlaceholder?: string | undefined;
    shellControlState?: ThreadShellControlState$1 | null;
    draftPrompt?: string | undefined;
    draftAttachments?: PromptAttachmentUpload[] | undefined;
    onPickAttachment?: ThreadComposerAttachmentPicker | undefined;
    /** Omitted flags retain the generic composer's existing attachment behavior. */
    attachmentCapabilities?: {
        files: boolean;
        images: boolean;
    };
    skillsState?: SlashPanelState<ThreadSkillsDto>;
    mcpState?: SlashPanelState<ThreadMcpServersDto>;
    hooksState?: SlashPanelState<ThreadHooksDto>;
    forkTurnOptionsState?: SlashPanelState<ThreadForkTurnOptionDto[]>;
    goalState?: SlashPanelState<ThreadGoalDto | null | undefined>;
    goalHistory?: ThreadGoalDto[];
    onDraftChange?: Dispatch<SetStateAction<{
        prompt: string;
        attachments: PromptAttachmentUpload[];
    }>> | undefined;
    onSubmit: (input: {
        prompt: string;
        attachments?: PromptAttachmentUpload[];
        delivery?: 'steer';
    }) => Promise<boolean | void> | boolean | void;
    onInterrupt?: () => Promise<void> | void;
    onCompact?: () => Promise<void> | void;
    onOpenSkills?: () => Promise<void> | void;
    onOpenMcp?: () => Promise<void> | void;
    onOpenHarness?: (composerFocusOwner?: string) => Promise<void> | void;
    onOpenHooks?: () => Promise<void> | void;
    onCreateHook?: (input: CreateThreadHookInput) => Promise<void> | void;
    onUpdateHook?: (input: UpdateThreadHookInput) => Promise<void> | void;
    onTrustHook?: (input: {
        key: string;
        currentHash: string;
    }) => Promise<void> | void;
    onUntrustHook?: (input: {
        key: string;
    }) => Promise<void> | void;
    onOpenGoal?: () => Promise<void> | void;
    onPrepareGoalSubmit?: (input: {
        objective: string;
        tokenBudget: number | null;
    }) => Promise<boolean | void> | boolean | void;
    onUpdateGoal?: (input: {
        objective?: string | null;
        status?: ThreadGoalStatusDto | null;
        tokenBudget?: number | null;
    }) => Promise<void> | void;
    onOpenForkTurns?: () => Promise<void> | void;
    onForkLatest?: () => Promise<void> | void;
    onForkTurn?: (turnId: string) => Promise<void> | void;
    onReadProviderConfig?: (() => Promise<ProviderHostFileDto> | ProviderHostFileDto) | undefined;
    onWriteProviderConfig?: ((content: string) => Promise<ProviderHostFileDto> | ProviderHostFileDto) | undefined;
    onToggleFollow?: () => void;
    canJumpToPreviousTurn?: boolean;
    onJumpToPreviousTurn?: () => void;
    canJumpToNextTurn?: boolean;
    onJumpToNextTurn?: () => void;
    subscriptionUsage?: AgentSubscriptionUsageDto | null;
    onUpdateSettings?: (input: UpdateThreadSettingsInput) => Promise<void> | void;
    /** Group model policy view and actions; the model menu edits it instead of one model. */
    modelPolicy?: ComposerModelPolicyProps | null;
    /** The model menu opened: the host may refresh the model list. */
    onModelMenuOpen?: () => void;
    onToggleView?: () => void;
    onShellCopy?: () => Promise<void> | void;
    onShellControl?: (action: 'ctrl_c' | 'ctrl_d' | 'esc' | 'tab' | 'up' | 'down' | 'clear') => Promise<void> | void;
    canInterrupt?: boolean;
    pendingPrompts?: Array<{
        id: string;
        prompt: string;
        optimistic?: boolean;
    }>;
    onSteerPendingPrompt?: (pendingPromptId: string) => Promise<void> | void;
    onCancelPendingPrompt?: (pendingPromptId: string) => Promise<void> | void;
}
declare function ThreadComposer({ activeView, sendShortcut, edgeToEdgeMobile, busy, settingsBusy, compactBusy, error, model, agentLabel, reasoningEffort, fastMode, collaborationMode, sandboxMode, hideSandboxModeControl, modelOptions, contextUsage, capabilities, toolboxItems, hookCommandTemplates, mcpConfigFormat, followTail, threadConnected, shellAvailable, disabled, threadRunning, disabledPlaceholder, shellControlState, draftPrompt, draftAttachments, onPickAttachment, attachmentCapabilities, skillsState, mcpState, hooksState, goalState, goalHistory, forkTurnOptionsState, onDraftChange, onSubmit, onInterrupt, onCompact, onOpenSkills, onOpenMcp, onOpenHooks, onOpenHarness, onCreateHook, onUpdateHook, onTrustHook, onUntrustHook, onOpenGoal, onPrepareGoalSubmit, onUpdateGoal, onOpenForkTurns, onForkLatest, onForkTurn, onReadProviderConfig, onWriteProviderConfig, onToggleFollow, canJumpToPreviousTurn, onJumpToPreviousTurn, canJumpToNextTurn, onJumpToNextTurn, subscriptionUsage, onUpdateSettings, modelPolicy, onModelMenuOpen, onToggleView, onShellCopy, onShellControl, canInterrupt, pendingPrompts, onSteerPendingPrompt, onCancelPendingPrompt, }: ThreadComposerProps): react.JSX.Element;

type TimelineUsageByScope = Record<string, {
    usage?: StructuredUsage;
}>;
type TimelineTurn = Omit<ThreadTurnDto, "status"> & {
    usageByScope?: TimelineUsageByScope;
    status: ThreadTurnDto["status"] | "sending";
};

/** A host's clock for running-turn timers. Turn times come from the server,
    so `now` should be server time on a monotonic base: then a phone whose
    clock is off does not add its error to a running timer. While the host
    cannot confirm that a turn is still running (its live connection is down),
    `frozenAt` holds the moment it noticed the loss and running timers stop
    there instead of counting time nobody observed. That value is an
    unconfirmed estimate: the turn may have finished earlier or still be
    running. Completed turns always use their own recorded start and end.
    Without a provider, the device clock is used. */
interface TurnClock {
    now: () => number;
    frozenAt?: number | null;
}
declare const TurnClockContext: react.Context<TurnClock | null>;

interface TokenUsageCostProps {
    usage?: ThreadTurnTokenBreakdownDto | null;
    price?: Pick<ThreadTurnPriceEstimateDto, 'totalUsd' | 'inputUsd' | 'cachedInputUsd' | 'cacheWriteInputUsd' | 'outputUsd'> | null;
    readOnly?: boolean;
    costLabel?: string;
    detailsNote?: string;
    tooltipZIndex?: number;
}
declare function TokenUsageCost({ usage, price, readOnly, costLabel, detailsNote, tooltipZIndex, }: TokenUsageCostProps): react.JSX.Element | null;

type ReferenceMode = 'focus' | 'thread' | 'files' | 'collaboration';
interface WorkbenchPresentation {
    referenceId: string | null;
    /** Null (and legacy absence) resolves to the host device. */
    referenceDeviceId?: string | null;
    mode: ReferenceMode;
    ratio: number;
}
/** Members and arrangement are independent. Pending identity never discards an explicit layout action. */
declare function useWorkbenchPresentation(scope: string | null, contextKey?: string | null): {
    value: WorkbenchPresentation;
    update: (patch: Partial<WorkbenchPresentation>) => void;
    storageFailed: boolean;
};

type WorkbenchPane = 'primary' | 'reference';
/** A phone split shows one conversation at a time; the composer switches it. */
interface WorkbenchPaneSwitch {
    pane: WorkbenchPane;
    active: WorkbenchPane;
    titles: Record<WorkbenchPane, string>;
    /** Each pane's thread status, shown beside its title. */
    marks?: Partial<Record<WorkbenchPane, string | undefined>>;
    select: (pane: WorkbenchPane) => void;
    /** A rendered switch claims its pane, so the panels need no fallback there. */
    claim: (pane: WorkbenchPane) => () => void;
}

/** Passed to bottom-panel content so its title bar can own the panel actions. */
interface WorkbenchToolPanelControls {
    maximized: boolean;
    collapsed: boolean;
    /** Phone-sized workbench: no hover, touch-sized targets, stacked splits. */
    compact: boolean;
    toggleMaximized: () => void;
    toggleCollapsed: () => void;
    close: () => void;
}

interface WorkbenchPanelsOptions {
    deviceLabel: string;
    workspaceLabel: string;
    primaryTitle: string;
    /** Receives the phone split switch, for a dock that shows the pinned conversations. */
    onPaneSwitchChange?: ((value: WorkbenchPaneSwitch | null) => void) | undefined;
    primaryStatus: string;
    primaryHarness: string;
    presentation: WorkbenchPresentation;
    onPresentationChange: (patch: Partial<WorkbenchPresentation>) => boolean | void;
    candidates: Array<{
        id: string;
        title: string;
    }>;
    referenceTitle?: string;
    /** Navigation status of each pane's thread, for the phone's pinned titles. */
    marks?: Partial<Record<WorkbenchPane, string | undefined>>;
    referenceContent?: ReactNode;
    collaborationContent?: ReactNode;
    onMakePrimary: () => void;
    storageFailed?: boolean;
    focusedPane?: 'primary' | 'reference';
    onFocusPane?: (pane: 'primary' | 'reference') => boolean | void;
    /** Bottom panel content (the terminal). A function receives the panel actions. */
    toolContent?: ReactNode | ((controls: WorkbenchToolPanelControls) => ReactNode);
    toolTitle?: string;
    toolsTargetLabel?: string;
    /** The file explorer provides its own single toolbar and close action. */
    inlineFilesHeader?: boolean;
    toolsOpen?: boolean;
    onCloseTools?: () => void;
}

/** Where a right-click opened a thread's menu, and how to end it. */
interface ThreadMenuContext {
    x: number;
    y: number;
    /** Takes focus back when the menu closes from the keyboard. */
    returnFocus?: HTMLElement | undefined;
    onClose: () => void;
}
interface WorkbenchThread {
    key: string;
    title: string;
    subtitle: string;
    href: string;
    status: string;
    favorite: boolean;
    parentKey?: string;
    rootKey?: string;
    /** Harness id such as `codex` or `claude`; themes may show it as an avatar. */
    agent?: string;
    /** A shortcut's place in the account's own order; unordered ones follow by recency. */
    shortcutOrder?: number;
}
interface WorkbenchNotification {
    id: string;
    title: string;
    href: string;
    occurredAt: string;
    summary?: string;
    /** The thread it is about, and for an agent thread its conversation's root:
        such notifications are listed under that conversation. */
    threadKey?: string;
    rootKey?: string;
    rootTitle?: string;
    rootHref?: string;
    /** How the turn ended: a completed one is marked like an unread thread. */
    status?: 'unread' | 'failed' | 'interrupted';
}
/** A plugin's thread panel in the workbench rail (it opens in the tools drawer). */
interface WorkbenchToolPanel {
    id: string;
    label: string;
    icon: ReactNode;
    active: boolean;
    onToggle: () => void;
}
interface MatterWorkbenchOptions {
    /** Host integration (ElAgente): its product name, an outer rail that replaces
        this one, and features the host cannot back. Omitted keeps upstream behavior. */
    brandName?: string;
    hideRail?: boolean;
    showShortcuts?: boolean;
    showNotifications?: boolean;
    showSearch?: boolean;
    searchLabel?: string;
    sidebarFooter?: ReactNode;
    renderNavigationHeader?: (input: {
        collapsed: boolean;
        closeNavigation: () => void;
    }) => ReactNode;
    panels?: WorkbenchPanelsOptions;
    /** Opt-in thread toolbar. Lifecycle belongs to the host. */
    threadHeader?: {
        /** Desktop: replace the tab row with one 44px header. Search and collapsed
            sidebar navigation stay in this row; phone navigation is unchanged.
            Empty workspaces omit both rows. Defaults to false. */
        singleRow?: boolean;
        status: string;
        /** Optional hover/focus explanation for the lifecycle pill. */
        statusDescription?: string;
        tone: 'running' | 'stopped' | 'failed' | 'pending';
        /** Defaults to disabled unless running; controls remain visible. */
        toolsDisabled?: boolean;
        /** Opens the host's existing Tool Usage panel. */
        onOpenToolUsage?: () => void;
        /** Opens the existing conversation export dialog directly. When omitted,
            Save & export opens the existing host action menu. */
        onSaveExport?: () => void;
    };
    /** Move the existing settings control/dialog to this global host rail slot.
        Only the visible workbench should receive a target. */
    settingsPortalTargetId?: string;
    statusActions?: ReactNode;
    /** Subscription usage windows (5-hour, weekly); the phone dock shows them in its status bar. */
    subscriptionUsage?: AgentSubscriptionUsageDto | null;
    emptyWorkspace?: boolean;
    navigationReady?: boolean;
    harnessSessionId?: string | null;
    harnessSessionUrl?: string | null;
    threads: WorkbenchThread[];
    workspaceThreads?: WorkbenchThread[];
    /** Heading of the `workspaceThreads` section; hosts that scope it (to one
        Agent, say) name that scope. Defaults to "This workspace". */
    workspaceSectionLabel?: string | undefined;
    /** Threads that want the reader, for the running count and its sheet: running
        ones beyond `threads` (other workspaces and devices, threads never opened)
        and finished ones the reader opened before and has not read since. */
    activeThreads?: WorkbenchThread[];
    currentKey: string;
    favorite: boolean;
    favoriteBusy?: boolean;
    error?: string | null;
    workspacePath: string;
    activeView: 'chat' | 'shell';
    terminalEnabled: boolean;
    onViewChange: (view: 'chat' | 'shell') => void;
    toolPanels?: WorkbenchToolPanel[];
    onToggleFavorite: () => void;
    onNavigate: (href: string) => void;
    /** Warm a thread's detail before it is opened (a row is pressed, or it is a
        dock swipe away), so opening it shows the conversation at once. */
    onPrefetchThread?: (href: string) => void;
    /** Store a new shortcut order (thread keys, first to last). */
    onReorderShortcuts?: (keys: string[]) => void;
    /** Store a new order of this workspace's conversations (root thread keys,
        first to last); `workspaceThreads` should then arrive in it. Without it
        tabs and lists keep the host's order and cannot be dragged. */
    onReorderWorkspaceThreads?: ((rootKeys: string[]) => void) | undefined;
    /** Desktop tabs: the conversations the reader opened (roots with their agent
        threads, in tab order), each closable; without it tabs list this workspace. */
    openTabs?: WorkbenchThread[] | undefined;
    onCloseTab?: ((rootKey: string) => void) | undefined;
    onReorderOpenTabs?: ((rootKeys: string[]) => void) | undefined;
    onSearch: () => void;
    search?: ReactNode;
    searchOpen?: boolean;
    notifications: WorkbenchNotification[];
    unreadCount: number;
    onReadNotifications: () => void;
    /** A thread's menu: its ⋯ button in a row, or, with `context`, the same menu
        opened where the thread was right-clicked (a tab or a row). */
    renderThreadMenu?: (thread: WorkbenchThread, context?: ThreadMenuContext) => ReactNode;
}
declare function MatterWorkbench({ options: o, title, homeHref, settings, newThread, actions, threadMenu, connection, deviceMonitor, explorer, revealExplorer, children, }: {
    options: MatterWorkbenchOptions;
    title: string;
    homeHref?: string | undefined;
    settings: ReactNode;
    newThread: ReactNode;
    actions: ReactNode;
    threadMenu: ReactNode;
    connection: ReactNode;
    deviceMonitor?: ReactNode;
    explorer: ReactNode;
    revealExplorer: number;
    children: ReactNode;
}): react.JSX.Element;

type ThemeMode = 'system' | 'light' | 'dark';
type PhoneHand = 'right' | 'left';
type AgentBackendId = AgentBackendIdDto;
interface AppShellNavContextValue {
    navOpen: boolean;
    openNav: () => void;
    toggleNav: () => void;
    closeNav: () => void;
    settingsOpen: boolean;
    openSettings: () => void;
    /** Opens settings on one section, such as `resources`. */
    openSettingsSection?: (sectionId: string) => void;
    /** The section the settings dialog opens on; the first one when unset. */
    settingsSection?: string | null;
    closeSettings: () => void;
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    effectiveTheme: 'light' | 'dark';
    defaultBackend: AgentBackendId;
    setDefaultBackend: (backend: AgentBackendId) => void;
    autoCollapseCompletedTurns?: boolean;
    setAutoCollapseCompletedTurns?: (enabled: boolean) => void;
    /** One-handed phone layout: status-only top bar, controls in a bottom dock. */
    phoneDock?: boolean;
    setPhoneDock?: (enabled: boolean) => void;
    /** The thumb the one-handed layout is arranged for; left mirrors it. */
    phoneHand?: PhoneHand;
    setPhoneHand?: (hand: PhoneHand) => void;
    /** Opens the map of every thread on the account's devices. */
    openThreadMap?: () => void;
    showReasoningSummaries?: boolean;
    setShowReasoningSummaries?: (enabled: boolean) => void;
    sendShortcut?: ComposerSendShortcut;
    setSendShortcut?: (shortcut: ComposerSendShortcut) => Promise<void>;
    sendShortcutLoading?: boolean;
    sendShortcutSaving?: boolean;
    sendShortcutError?: string | null;
    refreshSendShortcut?: () => Promise<void>;
}
declare const AppShellNavContext: react.Context<AppShellNavContextValue | null>;
declare function useAppShellNav(): AppShellNavContextValue | null;

interface ThreadWorkspaceLayoutProps {
    workbench?: MatterWorkbenchOptions;
    /** Host navigation (ElAgente's Agent switcher) above the workbench thread list. */
    renderNavigationHeader?: (input: {
        collapsed: boolean;
        closeNavigation: () => void;
    }) => ReactNode;
    threads: ThreadDto[];
    status?: AgentRuntimeStatusDto | null;
    loading?: boolean;
    error?: string | null;
    viewportConstrained?: boolean;
    layoutMode?: "desktop" | "responsive" | "mobile";
    effectiveTheme?: "light" | "dark";
    themeMode?: ThemeMode;
    onThemeModeChange?: (mode: ThemeMode) => void;
    showMobileAppMenu?: boolean;
    showMobileThreadNavToggle?: boolean;
    showMobileNewThreadShortcut?: boolean;
    hideRoomsRail?: boolean;
    settingsDialogOpen?: boolean;
    onSettingsDialogOpenChange?: (open: boolean) => void;
    mobileHeaderAction?: ReactNode;
    currentThreadId?: string | undefined;
    currentThreadLabel?: string | null | undefined;
    currentWorkspaceId?: string | null | undefined;
    currentWorkspaceLabel?: string | null | undefined;
    harnessLabel?: string | null | undefined;
    sessionLabel?: string | null | undefined;
    usageLabel?: string | null | undefined;
    threadActionsButton?: ReactNode;
    topbarActions?: ReactNode;
    deviceMonitor?: ReactNode;
    workspaceLabels?: Record<string, string>;
    metaContent?: ReactNode;
    settingsContent?: ReactNode;
    globalSettingsContent?: ReactNode;
    settingsSections?: SettingsSection[];
    appMenuButton?: ReactNode;
    appNavigationMenu?: ReactNode;
    workspaceReturnHref?: string;
    onWorkspaceReturn?: () => void;
    getThreadHref?: (threadId: string) => string;
    onOpenThread?: (threadId: string) => void;
    getNewThreadHref?: (workspaceId?: string | null) => string;
    newThreadHref?: string;
    newThreadLabel?: string;
    /** Host scope disables global settings and home navigation; conversation creation stays available. */
    restrictedNavigation?: boolean;
    /** Keep Settings under restrictedNavigation; the host passes only the sections its scope allows. */
    scopedSettings?: boolean;
    onNewThread?: () => void;
    onNewThreadTitle?: (title: string) => Promise<void> | void;
    renderNewThreadDialogContent?: (input: {
        close: () => void;
        closeNavigation: () => void;
        currentWorkspaceId?: string | null;
    }) => ReactNode;
    renderThreadLink?: (input: {
        thread: ThreadDto;
        children: ReactNode;
        className: string;
        onClick: () => void;
    }) => ReactNode;
    onCloseAppNavigation?: () => void;
    onRenameThread?: ((threadId: string, title: string) => Promise<void> | void) | undefined;
    onDeleteThread?: ((thread: ThreadDto) => void) | undefined;
    workspaceContent?: ReactNode;
    workspaceTitle?: string;
    workspaceActions?: ReactNode;
    workspaceRevealRequestKey?: number;
    children: ReactNode;
}
interface ThreadCardsProps {
    threads: ThreadDto[];
    currentThreadId?: string | undefined;
    currentWorkspaceId?: string | null | undefined;
    workspaceLabels?: Record<string, string>;
    onOpenThread: (threadId: string) => void;
    getThreadHref?: ((threadId: string) => string) | undefined;
    renderThreadLink?: ThreadWorkspaceLayoutProps["renderThreadLink"] | undefined;
    onBeginRenameThread?: ((thread: ThreadDto) => void) | undefined;
    onDeleteThread?: ((thread: ThreadDto) => void) | undefined;
    scrollable?: boolean;
    maxHeightClassName?: string;
    showDeleteButton?: boolean;
    showSessionCopyButton?: boolean;
    collapsed?: boolean;
}
declare function ThreadCards({ threads, currentThreadId, currentWorkspaceId, workspaceLabels, onOpenThread, getThreadHref, renderThreadLink, onBeginRenameThread, onDeleteThread, scrollable, maxHeightClassName, showDeleteButton, showSessionCopyButton, collapsed, }: ThreadCardsProps): react.JSX.Element;
declare function ThreadWorkspaceLayout({ workbench, renderNavigationHeader, threads, status, loading, error, viewportConstrained, layoutMode, effectiveTheme: effectiveThemeProp, themeMode: themeModeProp, onThemeModeChange, showMobileNewThreadShortcut, hideRoomsRail, settingsDialogOpen, onSettingsDialogOpenChange, mobileHeaderAction, currentThreadId, currentThreadLabel, currentWorkspaceId, currentWorkspaceLabel, harnessLabel, sessionLabel, usageLabel, threadActionsButton, topbarActions, deviceMonitor, metaContent, settingsContent, globalSettingsContent, settingsSections, restrictedNavigation, scopedSettings, workspaceLabels, workspaceReturnHref, onWorkspaceReturn, getThreadHref, onOpenThread, getNewThreadHref, newThreadHref: explicitNewThreadHref, newThreadLabel, onNewThread, onNewThreadTitle, renderNewThreadDialogContent, renderThreadLink, onCloseAppNavigation, onRenameThread, onDeleteThread, workspaceContent, workspaceTitle, workspaceActions, workspaceRevealRequestKey, children, }: ThreadWorkspaceLayoutProps): react.JSX.Element;

interface ThreadTimelineProps {
    roomUsage?: StructuredUsage | null;
    threadId?: string | undefined;
    turns: Array<ThreadTurnDto & {
        usageByScope?: TimelineUsageByScope;
    }>;
    totalTurnCount?: number;
    pendingRequests?: ThreadActionRequestDto[];
    activeTurnId?: string | null;
    threadRunning?: boolean;
    backgroundAgentCount?: number;
    renderTurnNotification?: ((turnId: string) => React.ReactNode) | undefined;
    /**
     * Host content shown below a turn whether it is open or folded, such as a
     * live structures panel. Return null for turns without content; keep the
     * function stable and let the returned element subscribe to its own data.
     */
    renderTurnContent?: ((turnId: string) => React.ReactNode) | undefined;
    backendProgress?: {
        turnId: string;
        receivedAt: string;
    } | null;
    livePlan?: {
        turnId: string;
        explanation: string | null;
        plan: Array<{
            step: string;
            status: string;
        }>;
        updatedAt?: string | null;
    } | null;
    liveItems?: {
        turnId: string;
        items: ThreadHistoryItemDto[];
        updatedAt?: string | null;
    } | null;
    respondingRequestId?: string | null;
    onRespondToRequest?: (requestId: string, input: RespondThreadActionRequestInput) => Promise<void> | void;
    liveOutput: string;
    scrollRequestKey?: number;
    /** `query` is marked in the message the search landed on. */
    searchTarget?: {
        turnId: string;
        itemId: string;
        key: number;
        query?: string;
    };
    previousTurnScrollRequestKey?: number;
    nextTurnScrollRequestKey?: number;
    bottomSpacer?: number;
    className?: string;
    onTailVisibilityChange?: (isVisible: boolean) => void;
    onPreviousTurnAvailabilityChange?: (available: boolean) => void;
    onNextTurnAvailabilityChange?: (available: boolean) => void;
    loadingEarlier?: boolean;
    onLoadEarlier?: () => void;
    ephemeralUserNote?: string | null;
    answeredRequestNotes?: ThreadAnsweredRequestNoteDto[];
    activityNotes?: ThreadActivityNoteDto[];
    pendingSteers?: ThreadPendingSteerDto[];
    optimisticSteers?: Array<{
        id: string;
        clientRequestId: string;
        turnId: string;
        prompt: string;
        createdAt: string;
        status: 'steering' | 'accepted';
    }>;
    optimisticTurn?: TimelineTurn | null;
    onLoadHistoryItemDetail?: (itemId: string) => Promise<ThreadHistoryItemDetailDto> | ThreadHistoryItemDetailDto;
    onLoadTurnDetail?: (turnId: string) => Promise<ThreadTurnDto> | ThreadTurnDto;
    onOpenThread?: (threadId: string) => void;
    onSelectArtifact?: (input: {
        item: ThreadHistoryItemDto & {
            kind: 'artifact';
        };
        artifact: NonNullable<ThreadHistoryItemDto['artifact']>;
    }) => void;
    onSelectHistoryItemDetail?: (input: {
        item: ThreadHistoryItemDto;
        detail: ThreadHistoryItemDetailDto;
    }) => void;
    adapter?: ThreadTimelineAdapter | undefined;
    autoCollapseCompletedTurns?: boolean;
}
declare function ThreadTimelineComponent({ roomUsage, threadId, turns, totalTurnCount, pendingRequests, activeTurnId, threadRunning, backgroundAgentCount, renderTurnNotification, renderTurnContent, pendingSteers, livePlan, liveItems, backendProgress, respondingRequestId, onRespondToRequest, liveOutput, scrollRequestKey, searchTarget, previousTurnScrollRequestKey, nextTurnScrollRequestKey, bottomSpacer, className, onTailVisibilityChange, onPreviousTurnAvailabilityChange, onNextTurnAvailabilityChange, loadingEarlier, onLoadEarlier, ephemeralUserNote, answeredRequestNotes, activityNotes, optimisticSteers, optimisticTurn, onLoadHistoryItemDetail, onLoadTurnDetail, onOpenThread, onSelectArtifact, onSelectHistoryItemDetail, adapter, autoCollapseCompletedTurns, }: ThreadTimelineProps): react.JSX.Element;
declare const ThreadTimeline: react.MemoExoticComponent<typeof ThreadTimelineComponent>;

interface ThreadShellControlState {
    status: ShellStatusDto;
    connectionButtonDisabled: boolean;
    connectionButtonLabel: string;
    shellInputEnabled: boolean;
    isConnecting: boolean;
    isCommandRunning: boolean;
    promptLabel: string | null;
    isMobileShell: boolean;
    hasShell: boolean;
    busy: boolean;
    loading: boolean;
    error: string | null;
}

interface ThreadShellPanelProps {
    threadId: string;
    shellAdapter: ThreadShellAdapter;
    isVisible?: boolean;
    showHeader?: boolean;
    onBackToChat?: (() => void) | undefined;
    /** @deprecated The phone key bar replaced the floating toolbox. */
    showFloatingToolbox?: boolean;
    effectiveTheme?: 'light' | 'dark';
    /** @deprecated Split sizes are stored with the per-thread terminal layout. */
    loadSplitRatio?: (threadId: string) => number | null | undefined;
    /** @deprecated Split sizes are stored with the per-thread terminal layout. */
    saveSplitRatio?: (threadId: string, ratio: number) => void;
    onStateChange?: (state: ThreadShellControlState) => void;
    /** Bottom-panel actions (collapse, maximize, hide) rendered in the title bar. */
    panelControls?: WorkbenchToolPanelControls;
    /** Device · workspace · conversation the commands run in. */
    targetLabel?: string;
    layoutStorageKey?: string;
    /**
     * Bumped when the user opens the terminal for this target: focus it and create
     * a first terminal if there is none. 0 means no request, so following another
     * chat never spawns a shell. Omit it for the legacy behaviour of creating one
     * whenever the panel becomes visible empty.
     */
    openRequest?: number;
    /** Like VS Code, hide the panel after the last terminal is killed or exits. */
    onLastTerminalClosed?: () => void;
}
interface ThreadShellPanelHandle {
    toggleConnection: () => Promise<void>;
    sendInput: (data: string) => boolean;
    sendCommand: (command: string) => boolean;
    sendControl: (action: 'ctrl_c' | 'ctrl_d' | 'esc' | 'tab' | 'up' | 'down' | 'clear') => boolean;
    copyLastCommandOutput: () => Promise<boolean>;
    terminate: () => Promise<void>;
    focus: () => void;
    refreshLayout: (options?: {
        focus?: boolean;
        syncBackendSize?: boolean;
    }) => void;
}
declare const ThreadShellPanel: react.ForwardRefExoticComponent<ThreadShellPanelProps & react.RefAttributes<ThreadShellPanelHandle>>;

declare function ThreadGraphWorkspacePanel(props: ThreadGraphWorkspacePanelProps): react.JSX.Element;
declare const MemoizedThreadGraphWorkspacePanel: react.MemoExoticComponent<typeof ThreadGraphWorkspacePanel>;

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    busyLabel?: string;
    busy?: boolean;
    error?: string | null;
    onCancel: () => void;
    onConfirm: () => void | Promise<void>;
    /** A third, non-destructive way out (e.g. "Save and close"). */
    secondaryLabel?: string;
    onSecondary?: () => void | Promise<void>;
    /** The cancel button's label, "Cancel" by default. */
    cancelLabel?: string;
}
declare function ConfirmDialog({ open, title, description, confirmLabel, busyLabel, busy, error, onCancel, onConfirm, secondaryLabel, onSecondary, cancelLabel, }: ConfirmDialogProps): react.ReactPortal | null;

/** A page opened before a deployment asks for a build chunk that no longer exists. */
declare function isStaleBuildError(error: unknown): boolean;
declare function RenderErrorFallback({ error, className }: {
    error: unknown;
    className?: string;
}): react.JSX.Element;
/** Keeps a failed part of the page from unmounting everything around it. */
declare class RenderErrorBoundary extends Component<{
    children: ReactNode;
    className?: string;
}, {
    failed: boolean;
    error: unknown;
}> {
    state: {
        failed: boolean;
        error: unknown;
    };
    static getDerivedStateFromError(error: unknown): {
        failed: boolean;
        error: unknown;
    };
    componentDidCatch(error: unknown, info: ErrorInfo): void;
    render(): string | number | bigint | boolean | Iterable<ReactNode> | Promise<string | number | bigint | boolean | react.ReactPortal | react.ReactElement<unknown, string | react.JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | react.JSX.Element | null | undefined;
}

type ThreadActionMode = ThreadExportFormatDto | 'share' | 'link';
type RelayThreadAccess = 'read' | 'control';
type RelayWorkspaceAccess = 'none' | 'read' | 'write';
interface ExportTurnsState {
    status: 'idle' | 'loading' | 'ready' | 'failed';
    data: ThreadExportTurnOptionsDto | null;
    error: string | null;
}
interface CreateThreadShareInput {
    scope?: 'thread' | 'device';
    targetIdentifier: string;
    threadAccess: RelayThreadAccess;
    workspaceAccess: RelayWorkspaceAccess;
    label?: string | null;
}
interface ThreadShareSummary {
    trustContent?: ReactNode;
    scope?: 'thread' | 'device';
    id: string;
    targetUsername: string;
    label: string | null;
    threadAccess?: RelayThreadAccess;
    workspaceAccess?: RelayWorkspaceAccess;
    createdAt?: string | null;
}
interface ShareState {
    status: 'idle' | 'loading' | 'ready' | 'failed';
    shares: ThreadShareSummary[];
    error: string | null;
}
interface ThreadActionsDialogProps {
    appearance?: 'default' | 'matter';
    open: boolean;
    busy?: boolean;
    turnsState: ExportTurnsState;
    shareAvailable?: boolean;
    shareUnavailableMessage?: string;
    shareState?: ShareState;
    initialMode?: ThreadActionMode;
    onCancel: () => void;
    onLoadTurns: () => void | Promise<void>;
    onExport: (input: ExportThreadTranscriptInput) => void | Promise<void>;
    onCreateShare?: (input: CreateThreadShareInput) => void | Promise<void>;
    onRevokeShare?: (shareId: string) => void | Promise<void>;
    onOpenDeviceSharing?: () => void;
    deviceShareAvailable?: boolean;
    linkContent?: ReactNode;
    onUpdateShare?: (id: string, input: CreateThreadShareInput) => void | Promise<void>;
}
declare function ThreadActionsDialog({ appearance, open, busy, turnsState, shareAvailable, shareUnavailableMessage, shareState, initialMode, onCancel, onLoadTurns, onExport, onCreateShare, onRevokeShare, deviceShareAvailable, linkContent, onUpdateShare, }: ThreadActionsDialogProps): react.ReactPortal | null;
declare const ExportTranscriptDialog: typeof ThreadActionsDialog;

interface LongTextDialogProps {
    open: boolean;
    title: string;
    text: string;
    kind?: string | undefined;
    /** ElAgente: a deferred detail that failed to load, with a retry. */
    error?: string | undefined;
    onRetry?: (() => void) | undefined;
    onClose: () => void;
    /** ElAgente: tool-call evidence renders as Markdown with workspace file links. */
    onOpenWorkspaceFile?: ThreadTimelineAdapter['onOpenWorkspaceFile'];
    workspaceRootPath?: string | undefined;
    resolveHref?: ThreadTimelineAdapter['resolveHref'];
}
/** A command's whole output or a whole diff. A modal window: focus moves in and
    stays there, Esc closes it, and focus returns to what opened it. */
declare function LongTextDialog({ open, title, text, kind, error, onRetry, onClose, onOpenWorkspaceFile, workspaceRootPath, resolveHref, }: LongTextDialogProps): react.JSX.Element;

declare function formatShortTimestamp(value: string | null): string;
declare function formatLongTimestamp(value: string | null): string;
declare function threadStatusLabel(status: ThreadDto['status']): string;
declare function threadStatusClassName(status: ThreadDto['status']): "ui-status-warning" | "ui-status-neutral" | "ui-status-info" | "ui-status-danger";
declare function turnStatusLabel(status: ThreadTurnDto['status'] | 'sending'): string;
declare function historyItemAccentClassName(kind: ThreadHistoryItemDto['kind']): "ui-status-neutral" | "timeline-kind-user" | "timeline-kind-agent" | "timeline-kind-action" | "timeline-kind-command" | "timeline-kind-search" | "timeline-kind-file-read" | "timeline-kind-reasoning" | "timeline-kind-agent-tool" | "timeline-kind-skill-tool" | "timeline-kind-plan" | "timeline-kind-file";
declare function historyItemLabel(kind: ThreadHistoryItemDto['kind']): string;

declare function hasLikelyMarkdownSyntax(text: string): boolean;

interface ThreadDetailSurfaceProps {
    threads: ThreadDto[];
    detail: ThreadDetailDto | null;
    loading: boolean;
    error: string | null;
    status?: AgentRuntimeStatusDto | null;
    capabilities?: AgentProviderCapabilitiesDto | null;
    managementSchema?: AgentBackendManagementSchemaDto | null;
    plugins?: PluginContextValue;
    adapter: ThreadDetailUiAdapter;
    metaContent?: ReactNode;
    settingsContent?: ReactNode;
    globalSettingsContent?: ReactNode;
    settingsSections?: SettingsSection[];
    settingsDialogOpen?: boolean;
    onSettingsDialogOpenChange?: (open: boolean) => void;
    mobileHeaderAction?: ReactNode;
    appMenuButton?: ReactNode;
    appNavigationMenu?: ReactNode;
    renderNavigationHeader?: (input: {
        collapsed: boolean;
        closeNavigation: () => void;
    }) => ReactNode;
    workspaceReturnHref?: string;
    restrictedNavigation?: boolean;
    /** See ThreadWorkspaceLayout `scopedSettings`. */
    scopedSettings?: boolean;
    onWorkspaceReturn?: () => void;
    threadActionsButton?: ReactNode;
    surfaceActions?: ReactNode;
    workbench?: MatterWorkbenchOptions;
    deviceMonitor?: ReactNode;
    floatingPanel?: ReactNode;
    workspaceContent?: ReactNode;
    workspaceTitle?: string;
    workspaceActions?: ReactNode;
    workspaceFeatures?: ThreadGraphWorkspaceFeatures;
    workspaceFocusPathRequest?: {
        /** Inspect this exact projected artifact; takes precedence over the file path. */
        artifactId?: string;
        path: string;
        line?: number;
        requestId: number;
    } | null;
    /** Host tabs in the workspace side panel, such as a live trajectory player. */
    workspacePanels?: readonly WorkspaceHostPanel[];
    /** Opens the side panel on the host panel `id`; each new `requestId` opens it again. */
    workspacePanelRequest?: WorkspaceHostPanelRequest | null;
    onNewThreadTitle?: (title: string) => Promise<void> | void;
    beforeTimelineContent?: ReactNode;
    errorContent?: ReactNode;
    workspaceMissingContent?: ReactNode;
    dialogs?: ReactNode;
    currentThreadId?: string;
    /** null shows all supplied navigation threads, regardless of their file workspace. */
    currentWorkspaceId?: string | null;
    currentWorkspaceLabel?: string | null;
    /** Names what the New Chat button creates (e.g. "New Grafico conversation"). */
    newThreadLabel?: string;
    onCloseAppNavigation?: () => void;
    presentation?: "workspace" | "embedded-single-thread";
    className?: string;
    activeView?: "chat" | "shell";
    liveOutput?: string;
    timelineProps?: Partial<Omit<ThreadTimelineProps, "threadId" | "turns" | "liveOutput" | "adapter">>;
    composerProps?: Omit<ThreadComposerProps, "activeView" | "onSubmit">;
    /** Host content attached above the chat composer, inside its measured host. */
    composerNotice?: ReactNode;
    shellComposerProps?: Omit<ThreadComposerProps, "activeView" | "onSubmit">;
    useFloatingMobileComposer?: boolean;
    floatingMobileComposerBottomOffset?: number;
    composerHostRef?: RefObject<HTMLDivElement | null>;
    shellPanelRef?: Ref<ThreadShellPanelHandle>;
    shellEffectiveTheme?: "light" | "dark";
    shellThemeMode?: ThemeMode;
    onShellThemeModeChange?: (mode: ThemeMode) => void;
    onShellStateChange?: (state: ThreadShellControlState) => void;
    shellUnavailableContent?: ReactNode;
    shellDisconnectedContent?: ReactNode;
    timelineComponent?: ComponentType<ThreadTimelineProps>;
    shellPanelComponent?: ForwardRefExoticComponent<{
        threadId: string;
        shellAdapter: NonNullable<ThreadDetailUiAdapter["shell"]>;
        isVisible?: boolean;
        showHeader?: boolean;
        showFloatingToolbox?: boolean;
        onBackToChat?: (() => void) | undefined;
        effectiveTheme?: "light" | "dark";
        onStateChange?: (state: ThreadShellControlState) => void;
    } & RefAttributes<ThreadShellPanelHandle>>;
    shellContent?: ReactNode;
    loadingContent?: ReactNode;
    emptyContent?: ReactNode;
}
declare function ThreadDetailSurface({ threads, detail: rawDetail, loading, error, status, plugins: providedPlugins, adapter, metaContent, settingsContent, globalSettingsContent, settingsSections, settingsDialogOpen, onSettingsDialogOpenChange, mobileHeaderAction, appMenuButton, appNavigationMenu, renderNavigationHeader, workspaceReturnHref, restrictedNavigation, scopedSettings, onWorkspaceReturn, threadActionsButton, surfaceActions, workbench, deviceMonitor, floatingPanel, workspaceContent, workspaceTitle, workspaceActions, workspaceFeatures, workspaceFocusPathRequest, workspacePanels, workspacePanelRequest, onNewThreadTitle, beforeTimelineContent, errorContent, workspaceMissingContent, dialogs, currentThreadId, currentWorkspaceId, currentWorkspaceLabel, newThreadLabel, onCloseAppNavigation, presentation, className, activeView, liveOutput, timelineProps, composerProps, composerNotice, shellComposerProps, useFloatingMobileComposer, floatingMobileComposerBottomOffset, composerHostRef, shellPanelRef, shellEffectiveTheme, shellThemeMode, onShellThemeModeChange, onShellStateChange, shellUnavailableContent, shellDisconnectedContent, timelineComponent: TimelineComponent, shellPanelComponent: ShellPanelComponent, shellContent, loadingContent, emptyContent, }: ThreadDetailSurfaceProps): react.JSX.Element;

declare function usePlugins(): PluginContextValue;

/** A plugin's own report when it renders one, otherwise bounded JSON; raw JSON stays one click away. */
declare function PluginActionOutput({ pluginId, action, output, }: PluginActionOutputContext & {
    pluginId: string;
}): react.JSX.Element;

/**
 * Opens one plugin's settings above the host dialog. Renders nothing for plugins that
 * contribute no settings or are unavailable on this device; disabled plugins stay
 * configurable.
 */
declare function PluginSettingsButton({ plugin, className }: {
    plugin: Pick<PluginDto, 'id' | 'name' | 'description'>;
    className?: string;
}): react.JSX.Element | null;

/** The device-wide plugin context, even inside a conversation scope. */
declare function useDevicePlugins(): PluginContextValue;
/**
 * Gives one conversation its effective plugins: renderers, panels and actions below
 * follow its switches, while global management (switches, device settings) still
 * reaches the device. It follows `threadId` in place: when the conversation
 * changes, the previous one's answers are never shown as the new one's; until the
 * new one answers, the device's plugins stand. So a host need not remount the
 * conversation (and lose its drafts and chrome) to switch it.
 */
declare function ThreadPluginScope({ threadId, adapter, children, }: {
    threadId: string;
    /** For a conversation on another route or device; defaults to the provider's. */
    adapter?: ThreadPluginAdapter;
    children: ReactNode;
}): react.JSX.Element;

/**
 * The conversation's plugin button: one place to see which plugins work here, follow
 * or override the global switch, and edit this conversation's own settings.
 */
declare function ThreadPluginsControl({ readOnly, onOpenGlobalSettings, }: {
    /** View-only sessions see the effective state but cannot change it. */
    readOnly?: boolean;
    onOpenGlobalSettings?: () => void;
}): react.JSX.Element | null;

/** Right or left thumb for the one-handed phone layout, as a two-way switch. */
declare function PhoneHandChoice({ hand, onChange }: {
    hand: PhoneHand;
    onChange: (hand: PhoneHand) => void;
}): react.JSX.Element;

interface AppShellNavigationItem {
    label: string;
    href: string;
}
interface AppShellNavigationMenuProps {
    className?: string;
    currentPath?: string;
    items?: AppShellNavigationItem[];
    onNavigate?: (href: string) => void;
}
declare function AppShellMenuButton({ className }: {
    className?: string;
}): react.JSX.Element | null;
declare function AppShellNavigationMenu({ className, currentPath, items, onNavigate, }: AppShellNavigationMenuProps): react.JSX.Element | null;
interface AppShellSettingsDialogProps {
    extraContent?: ReactNode;
    importPluginInput?: (draft: string) => ImportPluginInput;
}
declare function AppShellSettingsDialog({ extraContent, importPluginInput, }?: AppShellSettingsDialogProps): react.JSX.Element | null;

type ThreadMapPrice = Pick<ThreadTurnPriceEstimateDto, 'inputUsd' | 'cachedInputUsd' | 'cacheWriteInputUsd' | 'outputUsd' | 'totalUsd'>;
/** One conversation on the map: a root thread with its agent threads folded in. */
interface ThreadMapThread {
    key: string;
    title: string;
    href: string;
    /** Theme agent key (`codex`, `claude`, …), see themeAgentKey. */
    agent?: string | undefined;
    agentName?: string | undefined;
    running: boolean;
    /** Turns ever started, agent threads included; null when the device cannot say. */
    turns: number | null;
    /** Time turns ran inside the activity window; null when the device cannot say. */
    activeMs: number | null;
    /** Time every turn ever ran; null when the device cannot say. */
    totalMs?: number | null | undefined;
    /** The window's running time hour by hour, oldest first. */
    hourlyMs?: number[] | undefined;
    createdAt?: string | undefined;
    /** When a turn last started or finished. */
    lastActiveAt?: string | undefined;
    model?: string | undefined;
    /** The person's latest prompt. */
    lastPrompt?: string | undefined;
    /** The last turn failed. */
    failed?: boolean | undefined;
    /** The last turn was interrupted. */
    interrupted?: boolean | undefined;
    /** Tokens of every turn, agent threads included. */
    tokenUsage?: ThreadTurnTokenBreakdownDto | undefined;
    /** The API price of those tokens. */
    priceEstimate?: ThreadMapPrice | undefined;
    /** Some turns had no known price; the price leaves them out. */
    pricePartial?: boolean | undefined;
    /** Agent threads this one started, each on its own; shown when the tile is opened up. */
    children?: ThreadMapThread[] | undefined;
    /** Agent threads folded into this one. */
    agentThreads?: number | undefined;
    /**
     * For an agent thread on a tile of its own (it works in another workspace than
     * its conversation): the title of the thread that started it.
     */
    from?: string | undefined;
}
interface ThreadMapWorkspace {
    id: string;
    label: string;
    path?: string | undefined;
    threads: ThreadMapThread[];
}
interface ThreadMapDevice {
    id: string;
    name: string;
    state: 'ready' | 'loading' | 'offline' | 'error';
    error?: string | null | undefined;
    workspaces: ThreadMapWorkspace[];
}

/**
 * Every thread on every device as a zoomable treemap: devices hold workspaces,
 * workspaces hold threads. A thread's area follows its turns and its color the
 * time it ran in the last `hours`; running threads breathe. Tapping a device or a
 * workspace fills the map with it (what is inside shows as a preview until
 * then), tapping a thread opens it. On touch, pinching in goes up a level,
 * spreading opens the block under the fingers and dragging down dismisses.
 */
declare function ThreadMap({ devices, currentKey, hours, heading, actions, onOpen, onRetry, onDismiss }: {
    devices: ThreadMapDevice[];
    currentKey?: string | undefined;
    hours?: number;
    heading?: ReactNode;
    actions?: ReactNode;
    onOpen: (thread: ThreadMapThread) => void;
    onRetry?: ((deviceId: string) => void) | undefined;
    /** Closes the map; a downward drag on it asks for this. */
    onDismiss?: (() => void) | undefined;
}): react.JSX.Element;

/** The thread map in a dialog: full screen on a phone, a large panel elsewhere. */
declare function ThreadMapDialog({ open, onOpenChange, themeMode, effectiveTheme, ...map }: Omit<ComponentProps<typeof ThreadMap>, 'heading' | 'actions'> & {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    themeMode?: string | undefined;
    effectiveTheme?: 'light' | 'dark' | undefined;
}): react.JSX.Element;

interface PublicTranscriptMessage {
    role: 'user' | 'assistant';
    text: string;
    createdAt?: string | null;
}
interface PublicTranscriptTurn {
    messages: PublicTranscriptMessage[];
    startedAt?: string | null;
    completedAt?: string | null;
    model?: ThreadTurnDto['model'];
    reasoningEffort?: ThreadTurnDto['reasoningEffort'];
    tokenUsage?: ThreadTurnDto['tokenUsage'];
    priceEstimate?: ThreadTurnDto['priceEstimate'];
}
interface PublicTranscriptSnapshot {
    title: string;
    createdAt: string;
    turnCount: number;
    turns: PublicTranscriptTurn[];
    theme?: 'light' | 'dark';
    images?: Record<string, string>;
    live?: boolean;
    stale?: boolean;
    updatedAt?: string;
}
declare function transcriptSnapshot(title: string, turns: ThreadTurnDto[], theme: 'light' | 'dark'): PublicTranscriptSnapshot;
declare function PublicTranscript({ snapshot }: {
    snapshot: PublicTranscriptSnapshot;
}): react.JSX.Element;

declare function Dialog({ ...props }: ComponentProps<typeof DialogPrimitive.Root>): react.JSX.Element;
declare function DialogContent({ children, className, showCloseButton, overlayClassName, ...props }: ComponentProps<typeof DialogPrimitive.Content> & {
    showCloseButton?: boolean;
    overlayClassName?: string;
}): react.JSX.Element;
declare function DialogHeader({ className, ...props }: ComponentProps<'div'>): react.JSX.Element;
declare function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>): react.JSX.Element;
declare function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>): react.JSX.Element;

type ConversationSearchScope = 'thread' | 'workspace' | 'device';
/** Where a search looks: a small menu of our own at the field's start (§3
    keyboard). The host supplies labels and permissions; it never infers access. */
declare function ConversationSearchScopePicker({ value, onChange, labels, allowGlobal }: {
    value: ConversationSearchScope;
    onChange: (scope: ConversationSearchScope) => void;
    labels: {
        scope: string;
        thread: string;
        workspace: string;
        device: string;
    };
    allowGlobal: boolean;
}): react.JSX.Element;
declare function ConversationSearchExcerpt({ text, query }: {
    text: string;
    query: string;
}): react.JSX.Element;

/** Drafts are only in memory; confirm before intentional app/source navigation. */
declare function confirmWorkspaceDocumentLeave(): boolean;

/** One settings shell for the workbench and pages outside conversations. */
declare function SettingsDialog({ sections, themeMode, effectiveTheme, trigger, extraContent, initialId, section, onSectionChange, panelScroll, contentProps, ...rootProps }: ComponentProps<typeof Dialog> & {
    sections: SettingsSection[];
    section?: string | undefined;
    onSectionChange?: ((id: string) => void) | undefined;
    panelScroll?: ComponentProps<typeof SettingsPanels>['scroll'];
    themeMode?: string;
    effectiveTheme?: 'light' | 'dark';
    trigger?: ReactNode;
    extraContent?: ReactNode;
    initialId?: string;
    contentProps?: Omit<ComponentProps<typeof DialogContent>, 'children' | 'className' | 'overlayClassName'> & {
        'data-testid'?: string;
    };
}): react.JSX.Element;

type WorkspacePathResolver = (path: string) => Promise<boolean>;
/** A resolver belongs to one adapter/device/workspace; never cache across scopes. */
declare function createWorkspacePathResolver(adapter: Pick<ThreadWorkspaceAdapter, 'listTree' | 'statLinkedFile' | 'hiddenFiles'>, identity: {
    threadId: string;
    workspaceId?: string | null;
}, workspaceRoot: string): WorkspacePathResolver;

interface GraphChatThreadChatPanelProps {
    detail: ThreadDetailDto;
    adapter: ThreadDetailUiAdapter;
    timelineAdapter: ThreadTimelineAdapter;
    TimelineComponent?: ComponentType<ThreadTimelineProps>;
    liveOutput?: string;
    beforeTimelineContent?: ReactNode;
    composerProps?: Omit<ThreadComposerProps, 'activeView' | 'onSubmit'>;
    composerNotice?: ReactNode;
    timelineProps?: Partial<Omit<ThreadTimelineProps, 'threadId' | 'turns' | 'liveOutput' | 'adapter'>>;
    transcriptItemCount: number;
    useFloatingMobileComposer?: boolean;
    floatingDesktopComposer?: boolean;
    floatingMobileComposerBottomOffset?: number;
    composerHostRef?: RefObject<HTMLDivElement | null>;
    /** While another conversation loads: shown in the transcript's place, so the
        panel and its composer stay mounted (no flash, the draft keeps its focus). */
    timelinePending?: ReactNode;
}
declare function GraphChatThreadChatPanel({ detail, adapter, timelineAdapter, TimelineComponent, liveOutput, beforeTimelineContent, composerProps, composerNotice, timelineProps, transcriptItemCount, useFloatingMobileComposer, floatingDesktopComposer, floatingMobileComposerBottomOffset, composerHostRef, timelinePending, }: GraphChatThreadChatPanelProps): react.JSX.Element;

/** Capability flags a theme pack may declare in `theme.json` `features`. Unknown
 *  flags are ignored. Version 1 of the catalog; see docs/theme-packs.md. */
declare const THEME_FEATURES: readonly ["workbench.phoneDrawerTools", "composer.modelAvatar", "composer.richMenus", "composer.intentIcons", "transcript.agentByline", "explorer.shortMenuLabels", "code.cssSyntaxPalette"];
type ThemeFeature = (typeof THEME_FEATURES)[number];
declare function isThemeFeature(value: unknown): value is ThemeFeature;
/** The flags of the applied theme pack. */
declare function documentThemeFeatures(): ThemeFeature[];
/** Whether the applied theme pack declares `flag`; re-renders when the theme changes. */
declare function useThemeFeature(flag: ThemeFeature): boolean;

/** Keys a theme pack may declare art for: lowercase letters and digits in dash-separated words. */
declare const THEME_AGENT_KEY_PATTERN: RegExp;
/** The theme agent key for a thread's agent id, provider or harness label;
 *  undefined for nothing or the bare `acp` provider. */
declare function themeAgentKey(value: string | null | undefined): string | undefined;
/** The key for a thread: its agent id, else its provider. */
declare function threadThemeAgentKey(thread: {
    provider?: string | null;
    agentId?: string | null;
}): string | undefined;
/** Display name for an agent: the family name, else the raw id in title case. */
declare function themeAgentName(raw: string, key?: string | undefined): string;

declare function ThreadLoadingIndicator({ inline, label }: {
    inline?: boolean;
    label?: string;
}): react.JSX.Element;

/** Account persistence is supplied by the host; this control only renders state. */
declare function TurnNotificationButton({ subscribed, busy, error, onToggle, onRetry }: {
    subscribed: boolean;
    busy?: boolean;
    error?: string | null;
    onToggle: () => void;
    onRetry: () => void;
}): react.JSX.Element;

export { type AgentBackendId, AppShellMenuButton, AppShellNavContext, type AppShellNavContextValue, type AppShellNavigationItem, AppShellNavigationMenu, type AppShellNavigationMenuProps, AppShellSettingsDialog, type AppShellSettingsDialogProps, type ComposerModelPolicyProps, type ComposerSendShortcut, ConfirmDialog, ConversationSearchExcerpt, type ConversationSearchScope, ConversationSearchScopePicker, CopyButton, type CreateThreadShareInput, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, ExportTranscriptDialog, GraphChatThreadChatPanel, LIVE_STRUCTURES_MAX_SELECTED, LIVE_STRUCTURES_PAGE_SIZE, LIVE_TRAJECTORY_UPDATE_MS, type LiveStructureColumn, type LiveStructureFrame, LiveStructureFrameViewer, type LiveStructureKey, type LiveStructureProducer, type LiveStructureRow, type LiveStructureStatus, type LiveStructureStatusFilter, type LiveStructureSummary, type LiveStructureSummaryValue, type LiveStructureTotals, LiveStructuresPanel, type LiveStructuresPanelProps, type LiveTrajectoryFrame, LiveTrajectoryPlayer, type LiveTrajectoryPlayerProps, LongTextDialog, MatterWorkbench, type MatterWorkbenchOptions, MemoizedThreadGraphWorkspacePanel, type ModelPolicyDisplay, type ModelPolicyGroupDto, type ModelPolicyPresetDto, type ModelPolicySelectionDto, type ModelPolicyUpdateSelection, type ModelPolicyViewDto, PathChip, type PhoneHand, PhoneHandChoice, PluginActionOutput, PluginActionOutputContext, PluginContextValue, PluginSettingsButton, PromptAttachmentUpload, PublicTranscript, type PublicTranscriptSnapshot, type ReferenceMode, RenderErrorBoundary, RenderErrorFallback, SettingsDialog, SettingsPanels, SettingsSection, StatusMark, THEME_AGENT_KEY_PATTERN, THEME_FEATURES, type ThemeFeature, type ThemeMode, ThreadActionsDialog, type ThreadActionsDialogProps, ThreadCards, ThreadComposer, type ThreadComposerProps, ThreadDetailSurface, type ThreadDetailSurfaceProps, ThreadDetailUiAdapter, ThreadGraphWorkspaceFeatures, ThreadGraphWorkspacePanel, ThreadGraphWorkspacePanelProps, ThreadLoadingIndicator, ThreadMap, type ThreadMapDevice, ThreadMapDialog, type ThreadMapPrice, type ThreadMapThread, type ThreadMapWorkspace, type ThreadMenuContext, ThreadPluginAdapter, ThreadPluginScope, ThreadPluginsControl, type ThreadShareSummary, ThreadShellAdapter, ThreadShellControlState$1 as ThreadShellControlState, ThreadShellPanel, type ThreadShellPanelHandle, ThreadTimeline, ThreadTimelineAdapter, type ThreadTimelineProps, ThreadWorkspaceAdapter, ThreadWorkspaceLayout, TokenUsageCost, type TokenUsageCostProps, type TurnClock, TurnClockContext, TurnNotificationButton, type WorkbenchNotification, type WorkbenchPanelsOptions, type WorkbenchPresentation, type WorkbenchThread, type WorkbenchToolPanel, type WorkbenchToolPanelControls, WorkspaceHostPanel, WorkspaceHostPanelRequest, confirmAsync, confirmWorkspaceDocumentLeave, copyText, createWorkspacePathResolver, deriveLiveStructureColumns, documentThemeFeatures, formatFileSize, formatLiveStructureValue, formatLongTimestamp, formatShortTimestamp, hasLikelyMarkdownSyntax, historyItemAccentClassName, historyItemLabel, isStaleBuildError, isThemeFeature, liveStructureCell, liveStructureKey, liveStructurePageCount, liveStructureTrajectoryPath, navigationStatusLabel, sameLiveStructure, themeAgentKey, themeAgentName, threadStatusClassName, threadStatusLabel, threadThemeAgentKey, toggleLiveStructure, transcriptSnapshot, turnStatusLabel, useAppShellNav, useCopy, useDevicePlugins, useLongPress, useMenuKeyboard, useModalFocus, usePlugins, useThemeFeature, useWorkbenchPresentation };
