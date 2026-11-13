/** Additive extension data contract. Transport/feature support must be advertised separately. */
declare const EXTENSION_VERSION: 1;
declare const EXTENSION_TYPES: Readonly<Record<string, string>>;
type JsonValue = null | boolean | number | string | JsonValue[] | {[key: string]: JsonValue};
interface ExtensionEnvelope<T = JsonValue> {version: 1; type: string; data: T; [field: string]: unknown}
/** A deliberately bounded declarative schema; no refs, code, URLs or dynamic imports. */
type ValueSchema =
  | {type: 'string'; enum?: string[]; maxLength?: number}
  | {type: 'number' | 'integer'; minimum?: number; maximum?: number}
  | {type: 'boolean' | 'null'}
  | {type: 'array'; items: ValueSchema; maxItems: number}
  | {type: 'object'; properties: Record<string, ValueSchema>; required?: string[]; additionalProperties: false};
interface OptionDefinition {
  id: string; label: string; description?: string; schema: ValueSchema; default?: JsonValue;
  scope: 'thread' | 'turn'; apply: 'nextTurn' | 'restart'; mutable: boolean;
}
interface ActionDefinition {
  id: string; label: string; inputSchema: ValueSchema; resultSchema: ValueSchema;
  execution: 'browser' | 'native'; completion: 'applied';
}
interface ContributionDefinition {
  id: string; type: string; version: 1; minContractVersion: 1;
  rendererIds: string[]; panelIds: string[]; actionIds: string[]; optionIds: string[];
}
interface ExtensionDiscovery {
  contractVersion: 1; capabilities: Record<string, boolean>;
  contributions: ContributionDefinition[]; options: OptionDefinition[]; actions: ActionDefinition[];
  viewerState: 'personal-transient'; submission: 'explicit';
}
interface ScientificTarget {
  artifactId: string; objectId: string; sourceRevision: string; checksum: string;
  streamId?: string; frameId?: string; frameIndex?: number;
}
interface StructureCell {vectors: [[number, number, number], [number, number, number], [number, number, number]]; periodic: [boolean, boolean, boolean]; unit: 'angstrom' | 'bohr'}
interface ArtifactMetadata {
  version: 1; objectId: string; sourceRevision: string; checksum: string; format: string;
  stream?: {id: string; frameId: string; frameIndex: number};
  atoms?: {id: string; element: string}[];
  bonds?: {atomIds: [string, string]; order: number}[];
  cell?: StructureCell;
  /** One entry per `frameTargets` entry (null = no cell) when frame cells differ; mutually exclusive with `cell`. */
  frameCells?: (StructureCell | null)[];
  render?: {coordinateUnit: 'angstrom' | 'bohr'; bonding: 'provided' | 'infer' | 'none'; style?: 'ball-stick' | 'stick' | 'spacefill'; background?: string};
  [field: string]: unknown;
}
interface ViewerRequest {
  version: 1; requestId: string; operationId: string; actionId: string;
  target: ScientificTarget; payload: JsonValue;
}
interface ViewerInput extends ViewerRequest {
  kind: 'selection' | 'screenshot' | 'action'; submission: 'explicit';
}
interface ViewerAcknowledgement {
  version: 1; requestId: string; operationId: string; actionId: string;
  target: ScientificTarget; status: 'accepted' | 'applied' | 'rejected';
  result?: JsonValue; error?: {code: string; message: string};
}
interface StructuredProgress {
  version: 1; callId: string; status: 'queued' | 'running' | 'waitingForInput' | 'completed' | 'failed' | 'interrupted';
  label: string; arguments?: JsonValue; startedAt?: string; completedAt?: string;
  resultSummary?: string; logSummary?: string; artifactIds?: string[];
  completed?: number; total?: number; unit?: string; parentCallId?: string;
}
interface StructuredUsage {
  version: 1; scope: 'turn' | 'room' | 'tool'; availability: 'available' | 'unavailable';
  scopeId: string; observedAt: string;
  tokens?: {input?: number; output?: number; reasoning?: number; cacheRead?: number; cacheWrite?: number; total?: number};
  cost?: {amount: number; currency: string};
}
declare class ExtensionValidationError extends Error {code: string; path: string}
declare function validateValueSchema(value: unknown): asserts value is ValueSchema;
declare function validatePayload(schema: ValueSchema, value: unknown): asserts value is JsonValue;
declare function validateDiscovery(value: unknown): ExtensionDiscovery;
declare function hasCapability(discovery: ExtensionDiscovery | undefined, id: string): boolean;
declare function validateOptionValues(discovery: ExtensionDiscovery, values: unknown, scope?: 'thread' | 'turn'): Record<string, JsonValue>;
declare function validateArtifactMetadata(value: unknown): ArtifactMetadata;
declare function validateScientificTarget(value: unknown): ScientificTarget;
declare function validateViewerRequest(value: unknown, discovery: ExtensionDiscovery): ViewerRequest;
declare function validateViewerInput(value: unknown, discovery: ExtensionDiscovery): ViewerInput;
declare function validateViewerAcknowledgement(value: unknown, request: ViewerRequest, discovery: ExtensionDiscovery): ViewerAcknowledgement;
declare function validateProgress(value: unknown): StructuredProgress;
declare function validateUsage(value: unknown): StructuredUsage;
declare function validateExtension(value: unknown, discovery?: ExtensionDiscovery, originatingRequest?: ViewerRequest): ExtensionEnvelope<unknown>;
/** Unknown types retain data but never select executable UI. */
declare function extensionFallback(value: unknown): {kind: 'metadata-text-download'; type: string; text: string; metadata: unknown};

declare const agentBackendIds: readonly ["codex", "claude", "opencode", "elagente"];
type AgentBackendIdDto = (typeof agentBackendIds)[number];
declare const defaultAgentBackendId: AgentBackendIdDto;
interface AgentBackendMetadata {
    displayName: string;
    description: string;
    defaultTransport: 'stdio' | 'sdk' | 'none';
    homeEnvVar: string;
    commandEnvVar: string;
    defaultHomeDir: string;
    defaultCommand: string;
}
declare const agentBackendMetadata: Record<AgentBackendIdDto, AgentBackendMetadata>;
declare function isAgentBackendId(value: unknown): value is AgentBackendIdDto;
declare function normalizeAgentBackendId(value: unknown): AgentBackendIdDto | null;

interface ExtensionFixture {agentId: string; discovery: ExtensionDiscovery; artifacts: Array<{id: string; checksum: string; size: number; fixtureBytes: string; metadata: ArtifactMetadata; [key: string]: unknown}>; input: ViewerInput; acknowledgements: ViewerAcknowledgement[]; progress: StructuredProgress; usage: StructuredUsage; unavailableUsage: StructuredUsage; unknownItem: {extension: ExtensionEnvelope; [key: string]: unknown}}
declare const EXTENSION_FIXTURES: Readonly<Record<'grafico' | 'cuantico', ExtensionFixture>>;
declare const FRAME_CELL_FIXTURE: {artifact: {id: string; checksum: string; size: number; fixtureBytes: string; metadata: ArtifactMetadata; [key: string]: unknown}};

type ApiErrorCode = 'bad_request' | 'not_found' | 'conflict' | 'provider_goal_error' | 'forbidden' | 'goal_feature_disabled' | 'internal_error' | 'service_unavailable';
interface ApiErrorShape {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
}
declare function truncateAutoThreadTitle(value: string): string;
interface RuntimeConfigDto {
    appName: string;
    appVersion: string;
    host: string;
    port: number;
    workspaceRoot: string;
    environment: string;
}
interface AgentRuntimeStatusDto {
    state: 'starting' | 'ready' | 'degraded' | 'stopped' | 'failed';
    transport: 'stdio' | 'sdk' | 'none';
    lastStartedAt: string | null;
    lastError: string | null;
    restartCount: number;
}
interface AgentSubscriptionUsageWindowDto {
    id: string;
    durationMinutes: number | null;
    label: string;
    usedPercent: number;
    resetsAt: string | null;
}
interface AgentSubscriptionUsageDto {
    provider: 'codex' | 'claude' | 'grok';
    authKind: 'subscription' | 'apiKey' | 'unknown';
    observedAt: string;
    stale: boolean;
    windows: AgentSubscriptionUsageWindowDto[];
}
interface AgentProviderCapabilitiesDto {
    sessions: {
        list: boolean;
        read: boolean;
        resume: boolean;
        importLocal: boolean;
    };
    turns: {
        start: boolean;
        streamInput: boolean;
        steer: boolean;
        interrupt: boolean;
        compact: boolean;
    };
    branching: {
        fork: boolean;
        forkAt?: boolean;
        hardRollback: boolean;
        resumeAt: boolean;
        rewindFiles: boolean;
    };
    controls: {
        planMode: boolean;
        permissionRequests: boolean;
        sandboxMode: boolean;
        performanceMode: boolean;
        goals: boolean;
        /** A model or effort changed during a turn applies from its next model call; otherwise from the next turn. */
        liveModelSwitch?: boolean;
    };
    management: {
        models: boolean;
        mcpStatus: boolean;
        skills: boolean;
        hooks: boolean;
        hookTrust: boolean;
        hostConfigFiles: boolean;
        providerSettings: boolean;
    };
    usage: {
        contextWindow: boolean;
        tokenUsage: boolean;
        costUsd: boolean;
    };
}
interface AgentBackendDto {
    provider: AgentBackendIdDto;
    displayName: string;
    description: string;
    enabled: boolean;
    isDefault: boolean;
    status: AgentRuntimeStatusDto;
    capabilities: AgentProviderCapabilitiesDto;
    managementSchema: AgentBackendManagementSchemaDto;
    installation: AgentBackendInstallationDto;
}
interface AgentBackendInstallationDto {
    packageName: string | null;
    installed: boolean;
    installedVersion: string | null;
    latestVersion: string | null;
    installCommand: string | null;
    updateCommand: string | null;
    busy: boolean;
    lastError: string | null;
}
interface AgentBackendConfigFileSchemaDto {
    name: string;
    label: string;
    description: string;
    roles?: Array<'runtime' | 'auth' | 'mcp' | 'hooks' | 'providerSettings'>;
}
type AgentBackendToolboxActionDto = 'fast' | 'compact' | 'goal' | 'fork' | 'skills' | 'mcp' | 'hooks' | 'prompt' | 'harness' | 'unsupported';
interface AgentBackendToolboxItemSchemaDto {
    action: AgentBackendToolboxActionDto;
    command: string;
    label: string;
    description?: string | null;
    panel?: 'fork' | 'skills' | 'mcp' | 'hooks' | null;
}
interface AgentBackendHookCommandTemplateDto {
    eventName: AgentHookEventNameDto;
    command: string;
}
interface AgentBackendManagementSchemaDto {
    hostConfigFiles: AgentBackendConfigFileSchemaDto[];
    toolboxItems: AgentBackendToolboxItemSchemaDto[];
    hookCommandTemplates: AgentBackendHookCommandTemplateDto[];
    providerConfigFormat: 'toml' | 'json' | 'none';
    mcpConfigFormat: 'codex-toml' | 'claude-json' | 'none';
    configArchives: boolean;
    buildRestart: boolean;
}
interface ModelOptionDto {
    id: string;
    model: string;
    displayName: string;
    description: string;
    isDefault: boolean;
    hidden: boolean;
    supportsPerformanceMode?: boolean;
    supportedReasoningEfforts: ReasoningEffortOptionDto[];
    defaultReasoningEffort: ReasoningEffortDto | null;
}
interface VersionDto {
    name: string;
    version: string;
}
interface HealthDto {
    status: 'ok';
    timestamp: string;
}
type ProviderHostFileNameDto = string;
interface ProviderHostFileDto {
    name: ProviderHostFileNameDto;
    path: string;
    exists: boolean;
    content: string;
}
interface UpdateProviderHostFileInput {
    content: string;
}
interface ProviderHostConfigArchiveFileDto {
    name: ProviderHostFileNameDto;
    exists: boolean;
}
interface ProviderHostConfigArchiveDto {
    id: string;
    label: string;
    createdAt: string;
    updatedAt: string;
    files: Record<string, ProviderHostConfigArchiveFileDto>;
}
interface CreateProviderHostConfigArchiveInput {
    label?: string;
}
interface RenameProviderHostConfigArchiveInput {
    label: string;
}
interface ApplyProviderHostConfigArchiveResultDto {
    archive: ProviderHostConfigArchiveDto;
    status: AgentRuntimeStatusDto;
}
interface WorkspaceDto {
    id: string;
    hostId: string;
    label: string;
    absPath: string;
    isFavorite: boolean;
    createdAt: string;
    lastOpenedAt: string | null;
}
interface CreateWorkspaceFromPathInput {
    absPath: string;
    label?: string;
}
interface CreateWorkspaceFromGitInput {
    gitUrl: string;
    label?: string;
}
type CreateWorkspaceInput = CreateWorkspaceFromPathInput | CreateWorkspaceFromGitInput;
interface WorkspaceSettingsDto {
    workspaceRoot: string;
    devHome: string;
    defaultBackend: AgentBackendIdDto;
}
interface UpdateWorkspaceSettingsInput {
    devHome: string;
    defaultBackend?: AgentBackendIdDto;
}
interface UpdateWorkspaceInput {
    label: string;
}
type ThreadSourceDto = 'supervisor' | 'local_codex_import';
interface UpdateWorkspaceFavoriteInput {
    isFavorite: boolean;
}
interface WorkspaceTreeNodeDto {
    name: string;
    absPath: string;
    kind: 'file' | 'directory';
    hasChildren: boolean;
    isHidden: boolean;
}
interface WorkspaceTreeDto {
    rootPath: string;
    currentPath: string;
    nodes: WorkspaceTreeNodeDto[];
}
type ApprovalMode = 'yolo' | 'guarded';
type ReasoningEffortDto = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'ultra' | (string & {});
type CollaborationModeDto = 'default' | 'plan';
type SandboxModeDto = 'read-only' | 'workspace-write' | 'danger-full-access';
interface ReasoningEffortOptionDto {
    reasoningEffort: ReasoningEffortDto;
    description: string;
}
type ThreadStatusDto = 'recovering' | 'idle' | 'running' | 'interrupted' | 'failed' | 'not_loaded' | 'system_error';
interface ThreadContextUsageDto {
    availability: 'available' | 'unavailable';
    remainingPercent: number | null;
    tokensInContextWindow: number | null;
    modelContextWindow: number | null;
    updatedAt: string | null;
}
interface ThreadDto {
    id: string;
    workspaceId: string;
    provider: AgentBackendIdDto;
    providerSessionId: string | null;
    source: ThreadSourceDto;
    title: string;
    model: string | null;
    reasoningEffort: ReasoningEffortDto | null;
    fastMode?: boolean;
    collaborationMode: CollaborationModeDto;
    approvalMode: ApprovalMode;
    sandboxMode?: SandboxModeDto | null;
    status: ThreadStatusDto;
    summaryText: string | null;
    lastError: string | null;
    activeTurnId: string | null;
    isLoaded: boolean;
    isPinned: boolean;
    createdAt: string;
    updatedAt: string;
    lastTurnStartedAt: string | null;
    lastTurnCompletedAt: string | null;
    contextUsage?: ThreadContextUsageDto;
    /** Immediate creator. Absent when a person started this thread. */
    parentThreadId?: string | null;
    /** Top-level ancestor; every thread in one delegation chain shares it. */
    rootThreadId?: string | null;
}
interface ThreadPeerWorkDto {
    taskTurnId: string;
    messages: Array<{
        id: string;
        fromThreadId?: string | null;
        fromDeviceId?: string | null;
        name?: string | null;
        kind: 'question' | 'result';
        subject?: string | null;
        text?: string | null;
        createdAt?: string | null;
    }>;
}
/** Who sent a prompt when it was not the device owner, as the device recorded it. */
interface MessageSenderDto {
    /** The sender's relay account ID. */
    userId: string;
    /** The account name the owner shared with, when the device knows it. */
    name?: string | null;
}
interface ThreadHistoryItemDto {
    /** Set when storage cleanup removed this command's output or this edit's diff. */
    outputPrunedAt?: string | null;
    outputPrunedBytes?: number | null;
    /** Set when storage cleanup shortened or removed this command's text. */
    textPruned?: 'truncated' | 'removed' | null;
    polishedReply?: PolishedReplyDto | null;
    peerWork?: ThreadPeerWorkDto | null;
    /** Set on prompts that someone other than the device owner sent. */
    sender?: MessageSenderDto | null;
    id: string;
    kind: 'userMessage' | 'agentMessage' | 'artifact' | 'image' | 'plan' | 'contextCompaction' | 'reasoning' | 'commandExecution' | 'webSearch' | 'fileRead' | 'fileChange' | 'hook' | 'agentToolCall' | 'skillToolCall' | 'toolCall' | 'other';
    text: string;
    previewText?: string;
    detailText?: string | null;
    hasDeferredDetail?: boolean | null;
    sequence?: number | null;
    transcriptOrder?: number | null;
    sourceTurnId?: string | null;
    origin?: string | null;
    /** A harness notice's level (`origin: 'sessionNotice'`). */
    severity?: 'info' | 'warning' | 'error' | null;
    taskStatus?: string | null;
    taskId?: string | null;
    waitingStartedAt?: string | null;
    awakenedAt?: string | null;
    backgroundTaskCount?: number | null;
    responsePhase?: 'commentary' | 'final' | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    status?: string | null;
    assetPath?: string | null;
    changedFiles?: number | null;
    addedLines?: number | null;
    removedLines?: number | null;
    hookEventName?: string | null;
    hookEventLabel?: string | null;
    hookHandlerType?: string | null;
    hookScope?: string | null;
    hookSource?: string | null;
    hookSourcePath?: string | null;
    hookStatusMessage?: string | null;
    hookOutputEntries?: Array<{
        kind: string;
        text: string;
    }> | null;
    artifact?: ThreadArtifactDto | null;
    extension?: ExtensionEnvelope<unknown>;
    progress?: StructuredProgress;
    usage?: StructuredUsage;
}
interface PolishedReplyDto {
    text: string;
    preset: string;
    language: string;
    model: string;
    sourceHash: string;
    createdAt: string;
}
interface ThreadHistoryItemDetailDto {
    id: string;
    kind: ThreadHistoryItemDto['kind'];
    title: string;
    text: string;
}
interface ThreadArtifactDto {
    metadata?: ArtifactMetadata;
    extension?: ExtensionEnvelope<unknown>;
    id: string;
    pluginId: string;
    type: string;
    title: string;
    /** Relative workspace file backing this artifact, when available. */
    workspacePath?: string;
    summaryText?: string | null;
    payload: unknown;
    assets?: Array<{
        id: string;
        mediaType: string;
        url: string;
        name?: string | null;
    }> | null;
    sourceTurnId?: string | null;
    sourceItemId?: string | null;
    createdAt: string;
}
interface PluginArtifactTypeDto {
    type: string;
    title: string;
    fileExtensions?: string[];
}
interface PluginThreadPanelDto {
    id: string;
    label: string;
    kind?: 'artifact' | 'terminal' | string;
    artifactTypes: string[];
}
interface PluginModelHintDto {
    id: string;
    text: string;
}
interface PluginMcpServerDto {
    id: string;
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
}
interface PluginCapabilitiesDto {
    actions?: string[];
    artifactTypes: PluginArtifactTypeDto[];
    timelineRenderers: string[];
    threadPanels: PluginThreadPanelDto[];
    modelHints?: PluginModelHintDto[];
    mcpServers?: PluginMcpServerDto[];
    frontend?: {
        entry?: string;
        style?: string;
    };
    backend?: {
        entry?: string;
    };
}
interface PluginManifestDto {
    contribution?: ContributionDefinition;
    id: string;
    name: string;
    version: string;
    description: string;
    remoteCodex: string;
    capabilities: PluginCapabilitiesDto;
}
interface PluginDto extends PluginManifestDto {
    enabled: boolean;
    source?: 'builtin' | 'imported' | null;
    available?: boolean;
    unavailableReasonCode?: string | null;
    unavailableReason?: string | null;
    /** Whether a conversation that follows the device has it on (absent from older Supervisors). */
    defaultEnabled?: boolean;
}
interface UpdatePluginInput {
    enabled?: boolean;
    /** Whether conversations that follow the device have the plugin on. */
    defaultEnabled?: boolean;
}
interface ImportPluginInput {
    manifest?: unknown;
    manifestJson?: string;
    enabled?: boolean;
}
interface ThreadTurnTokenBreakdownDto {
    totalTokens: number;
    inputTokens: number;
    cachedInputTokens: number;
    cacheWriteInputTokens?: number;
    /** One-hour subset of cacheWriteInputTokens. */
    cacheWriteOneHourInputTokens?: number;
    outputTokens: number;
    reasoningOutputTokens: number;
}
interface ThreadTurnTokenUsageDto {
    total: ThreadTurnTokenBreakdownDto;
    last: ThreadTurnTokenBreakdownDto;
    modelContextWindow: number | null;
    /** The models the turn's own agent called, in order; consecutive calls to
        one model form a run, so a switch mid-turn shows as a second run. */
    models?: {
        model: string;
        calls: number;
    }[];
    generationSpeed?: {
        outputTokens: number;
        llmTimeMs: number;
        averageTokensPerSecond: number | null;
        recentTokensPerSecond: number | null;
        windowSeconds: number;
        active: boolean;
        state: 'llm' | 'tool';
        measurement: 'usageIntervals';
        outputTimeMs?: number;
        averageOutputTokensPerSecond?: number | null;
        latestOutputTokensPerSecond?: number | null;
        latestOutputTimeMs?: number;
        latestOutputMeasuredAt?: string | null;
        /** How the split below was measured. Snapshots without it timed every
            request, bursts included, and are not shown. */
        splitMethod?: 'streamedRequests';
        /** Model requests that produced output in the turn, streamed or not. */
        llmRequests?: number;
        /** Per model request that visibly streamed: the average wait for its first
            output, including queueing, prefill and thinking that does not stream. */
        firstTokenMs?: number | null;
        firstTokenRequests?: number;
        /** Requests whose reply arrived in one piece, left out of the split. */
        burstRequests?: number;
        /** Uncached input prefilled before the first output, and the cached rest. */
        prefillTokens?: number;
        prefillCachedTokens?: number;
        prefillTokensPerSecond?: number | null;
        /** Each request's own answer tokens (reasoning left out), over the time its
            answer streamed. */
        decodeTokens?: number;
        decodeMs?: number;
        decodeTokensPerSecond?: number | null;
        updatedAt: string;
    } | null;
}
type ThreadTurnPricingTierDto = 'standard' | 'fast';
interface ThreadTurnPriceEstimateDto {
    pricingModelKey: string;
    pricingTierKey: ThreadTurnPricingTierDto;
    currency: 'USD';
    inputUsd: number;
    cachedInputUsd: number;
    cacheWriteInputUsd?: number;
    outputUsd: number;
    totalUsd: number;
}
interface ThreadTurnDto {
    id: string;
    startedAt: string | null;
    completedAt?: string | null;
    status: 'completed' | 'interrupted' | 'failed' | 'inProgress' | 'recovering';
    error: string | null;
    model?: string | null;
    reasoningEffort?: ReasoningEffortDto | null;
    reasoningEffortAvailable?: boolean | null;
    tokenUsage?: ThreadTurnTokenUsageDto | null;
    priceEstimate?: ThreadTurnPriceEstimateDto | null;
    hasDeferredItems?: boolean | null;
    deferredItemCount?: number | null;
    /** Operation counts of a summarized turn; present only with deferred items. */
    activity?: ThreadTurnActivityDto | null;
    items: ThreadHistoryItemDto[];
}
interface ThreadTurnActivityDto {
    commands?: number;
    fileChanges?: number;
    changedFiles?: number;
    addedLines?: number;
    removedLines?: number;
    reads?: number;
    searches?: number;
    tools?: number;
    agents?: number;
    reasoning?: number;
    failed?: number;
    /** Distinct changed paths. */
    fileCount?: number;
    /** Up to forty changed files, with the latest edit's item id. */
    files?: ThreadTurnChangedFileDto[];
    /** The same counts per stretch of operations, keyed by the conversation item after it. */
    segments?: ThreadTurnActivitySegmentDto[];
}
type ThreadTurnActivitySegmentDto = Omit<ThreadTurnActivityDto, 'files' | 'segments' | 'fileCount'> & {
    before: string | null;
    startedAt?: string;
    endedAt?: string;
};
interface ThreadTurnChangedFileDto {
    path: string;
    itemId: string;
    addedLines?: number;
    removedLines?: number;
}
interface ThreadActionQuestionOptionDto {
    label: string;
    description: string;
}
interface ThreadActionQuestionDto {
    id: string;
    header: string;
    question: string;
    multiSelect?: boolean;
    isOther: boolean;
    isSecret: boolean;
    options: ThreadActionQuestionOptionDto[] | null;
}
interface ThreadActionRequestDto {
    id: string;
    kind: 'requestUserInput' | 'permissionRequest' | 'planDecision';
    title: string;
    description: string | null;
    turnId: string | null;
    itemId: string | null;
    createdAt: string;
    questions: ThreadActionQuestionDto[];
}
interface ThreadAnsweredRequestNoteDto {
    id: string;
    turnId: string | null;
    title: string;
    summaryLines: string[];
    createdAt: string;
}
interface ThreadActivityNoteDto {
    id: string;
    kind: 'fastMode' | 'goal' | 'forkCreated' | 'forkSource';
    createdAt: string;
    text?: string;
    anchorTurnId?: string | null;
    linkedThreadId?: string;
    linkedThreadTitle?: string | null;
    turnIndex?: number | null;
}
type AgentSkillScopeDto = 'user' | 'repo' | 'system' | 'admin';
interface AgentSkillInterfaceDto {
    displayName?: string;
    shortDescription?: string;
    brandColor?: string;
    defaultPrompt?: string;
}
interface AgentSkillDto {
    name: string;
    description: string;
    shortDescription?: string;
    interface?: AgentSkillInterfaceDto;
    path: string;
    scope: AgentSkillScopeDto;
    enabled: boolean;
}
interface AgentSkillErrorDto {
    path: string;
    message: string;
}
interface ThreadSkillsDto {
    cwd: string;
    skills: AgentSkillDto[];
    errors: AgentSkillErrorDto[];
}
type AgentMcpAuthStatusDto = 'unsupported' | 'notLoggedIn' | 'bearerToken' | 'oAuth';
interface AgentMcpToolDto {
    name: string;
    title: string | null;
    description: string | null;
}
interface AgentMcpServerDto {
    name: string;
    authStatus: AgentMcpAuthStatusDto;
    tools: AgentMcpToolDto[];
    resourceCount: number;
    resourceTemplateCount: number;
}
interface ThreadMcpServersDto {
    servers: AgentMcpServerDto[];
}
type AgentHookEventNameDto = 'preToolUse' | 'permissionRequest' | 'postToolUse' | 'preCompact' | 'postCompact' | 'sessionStart' | 'userPromptSubmit' | 'stop';
type AgentHookHandlerTypeDto = 'command' | 'prompt' | 'agent';
type AgentHookSourceDto = 'system' | 'user' | 'project' | 'mdm' | 'sessionFlags' | 'plugin' | 'cloudRequirements' | 'legacyManagedConfigFile' | 'legacyManagedConfigMdm' | 'unknown';
type AgentHookTrustStatusDto = 'managed' | 'untrusted' | 'trusted' | 'modified';
interface AgentHookDto {
    key: string;
    eventName: AgentHookEventNameDto;
    handlerType: AgentHookHandlerTypeDto;
    matcher: string | null;
    command: string | null;
    timeoutSec: number;
    statusMessage: string | null;
    sourcePath: string;
    source: AgentHookSourceDto;
    pluginId: string | null;
    displayOrder: number;
    enabled: boolean;
    isManaged: boolean;
    currentHash: string;
    trustStatus: AgentHookTrustStatusDto;
}
interface AgentHookErrorDto {
    path: string;
    message: string;
}
interface ThreadHooksDto {
    cwd: string;
    hooks: AgentHookDto[];
    warnings: string[];
    errors: AgentHookErrorDto[];
    globalHooksPath: string;
    projectHooksPath: string;
}
interface CreateThreadHookInput {
    scope: 'global' | 'project';
    eventName: AgentHookEventNameDto;
    matcher?: string | null;
    command: string;
    timeoutSec?: number | null;
    statusMessage?: string | null;
}
interface ThreadHookTargetInput {
    scope: 'global' | 'project';
    eventName: AgentHookEventNameDto;
    matcher?: string | null;
    command: string;
    timeoutSec?: number | null;
    statusMessage?: string | null;
}
interface UpdateThreadHookInput extends CreateThreadHookInput {
    target: ThreadHookTargetInput;
}
interface TrustThreadHookInput {
    key: string;
    currentHash: string;
}
interface UntrustThreadHookInput {
    key: string;
}
type ThreadGoalStatusDto = 'active' | 'paused' | 'budgetLimited' | 'complete' | 'terminated';
interface ThreadGoalDto {
    threadId: string;
    localGoalId?: string | null;
    objective: string;
    status: ThreadGoalStatusDto;
    tokenBudget: number | null;
    tokensUsed: number;
    timeUsedSeconds: number;
    createdAt: string;
    updatedAt: string;
    completedAt?: string | null;
}
interface UpdateThreadGoalInput {
    objective?: string | null;
    status?: ThreadGoalStatusDto | null;
    tokenBudget?: number | null;
}
interface ThreadLivePlanDto {
    turnId: string;
    explanation: string | null;
    plan: Array<{
        step: string;
        status: string;
    }>;
    updatedAt: string;
}
interface ThreadPendingSteerDto {
    id: string;
    clientRequestId: string | null;
    turnId: string;
    prompt: string;
    delivery: "steer" | "continuation";
    createdAt: string;
    /** Set when someone other than the device owner sent it. */
    sender?: MessageSenderDto | null;
}
interface ThreadSubagentDto {
    id: string;
    name: string | null;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    parentToolCallId: string | null;
    isBackground?: boolean;
}
interface ThreadLiveItemsDto {
    turnId: string;
    items: ThreadHistoryItemDto[];
    updatedAt: string;
}
interface ThreadDetailDto {
    thread: ThreadDto;
    workspace: WorkspaceDto;
    workspacePathStatus: 'present' | 'missing';
    turns: ThreadTurnDto[];
    totalTurnCount?: number;
    pendingRequests: ThreadActionRequestDto[];
    pendingSteers: ThreadPendingSteerDto[];
    activeSubagents?: ThreadSubagentDto[];
    answeredRequestNotes?: ThreadAnsweredRequestNoteDto[];
    activityNotes?: ThreadActivityNoteDto[];
    goal?: ThreadGoalDto | null;
    goalHistory?: ThreadGoalDto[];
    livePlan?: ThreadLivePlanDto | null;
    liveItems?: ThreadLiveItemsDto | null;
    /**
     * Every published artifact in the host's publication order, including those
     * published outside a turn (an adopted structure). When present it is the
     * artifact list; turn items only add artifacts it lacks.
     */
    artifacts?: ThreadArtifactDto[];
}
interface ThreadExportTurnOptionDto {
    turnId: string;
    turnNumber: number;
    startedAt: string | null;
    status: ThreadTurnDto['status'];
    userPromptPreview: string;
}
interface ThreadExportTurnOptionsDto {
    turns: ThreadExportTurnOptionDto[];
    totalTurnCount: number;
}
type ThreadExportPdfModeDto = 'latest' | 'selected';
type ThreadExportPdfProfileDto = 'review' | 'technical';
type ThreadExportFormatDto = 'html';
interface ExportThreadTranscriptInput {
    format?: ThreadExportFormatDto;
    mode: ThreadExportPdfModeDto;
    limit?: number;
    turnIds?: string[];
    profile?: ThreadExportPdfProfileDto;
    options?: {
        includeTokenAndPrice?: boolean;
        includeCommandOutput?: boolean;
        includeAbsolutePaths?: boolean;
    };
}
interface ThreadForkTurnOptionDto {
    turnId: string;
    turnIndex: number;
    startedAt: string | null;
    status: ThreadTurnDto['status'];
}
interface ForkThreadInput {
    mode: 'latest' | 'turn';
    turnId?: string;
}
interface ThreadForkResultDto {
    thread: ThreadDetailDto;
    sourceThreadId: string;
    sourceTurnId: string | null;
    sourceTurnIndex: number | null;
}
type ShellStatusDto = 'not_created' | 'creating' | 'running' | 'attached' | 'detached' | 'exited' | 'not_found' | 'workspace_missing';
interface ShellSessionDto {
    id: string;
    threadId: string;
    workspaceId: string;
    label: string | null;
    tmuxSessionName: string;
    backend: 'pty' | 'tmux' | string;
    cwd: string;
    status: Exclude<ShellStatusDto, 'not_created' | 'workspace_missing'>;
    attachedViewerId: string | null;
    createdAt: string;
    updatedAt: string;
    lastActivityAt: string | null;
}
interface ThreadShellStateDto {
    threadId: string;
    workspaceId: string;
    workspacePathStatus: 'present' | 'missing';
    state: ShellStatusDto;
    shell: ShellSessionDto | null;
    shells: ShellSessionDto[];
    activeShellId: string | null;
}
interface ShellCreateInput {
    cols?: number;
    rows?: number;
    label?: string;
}
interface UpdateShellInput {
    label?: string | null;
}
interface ShellAttachInput {
    cols: number;
    rows: number;
}
interface ShellDetachInput {
    viewerId: string;
}
interface ShellInputInput {
    viewerId: string;
    data: string;
}
interface ShellResizeInput {
    viewerId: string;
    cols: number;
    rows: number;
}
interface CreateThreadInput {
    workspaceId: string;
    title?: string;
    provider?: AgentBackendIdDto;
    model: string;
    approvalMode: ApprovalMode;
}
interface UpdateThreadSettingsInput {
    model?: string;
    reasoningEffort?: ReasoningEffortDto | null;
    fastMode?: boolean;
    collaborationMode?: CollaborationModeDto;
    sandboxMode?: SandboxModeDto | null;
}
interface UpdateThreadInput {
    title: string;
}
interface ImportThreadInput {
    sessionId: string;
}
interface SendThreadPromptInput {
    prompt: string;
    clientRequestId?: string;
    model?: string;
    reasoningEffort?: ReasoningEffortDto | null;
    collaborationMode?: CollaborationModeDto;
    sandboxMode?: SandboxModeDto | null;
}
type PromptAttachmentKindDto = 'photo' | 'file';
interface PromptAttachmentManifestEntryDto {
    clientId: string;
    kind: PromptAttachmentKindDto;
    originalName: string;
    placeholder: string;
}
interface InterruptTurnInput {
    turnId?: string;
}
interface ResumeThreadInput {
    model?: string;
    sandboxMode?: SandboxModeDto | null;
}
interface ThreadActionRequestAnswerDto {
    answers: string[];
}
interface RespondThreadActionRequestInput {
    answers: Record<string, ThreadActionRequestAnswerDto>;
}
interface ThreadEventPayloadMap {
    'thread.updated': {
        status?: ThreadStatusDto | string | null;
        title?: string | null;
        reason?: string;
        turnId?: string;
        model?: string | null;
        reasoningEffort?: ReasoningEffortDto | string | null;
        fastMode?: boolean;
        collaborationMode?: CollaborationModeDto | string | null;
        sandboxMode?: SandboxModeDto | string | null;
    };
    'thread.context.updated': {
        contextUsage: ThreadContextUsageDto;
    };
    'thread.subagents.updated': {
        turnId: string;
        activeSubagents: ThreadSubagentDto[];
    };
    'thread.goal.updated': {
        turnId?: string | null;
        goal: ThreadGoalDto | null;
        goalHistory: ThreadGoalDto[];
    };
    'thread.goal.cleared': {
        goalHistory: ThreadGoalDto[];
    };
    'thread.turn.token.updated': {
        turnId: string;
        tokenUsage: ThreadTurnTokenUsageDto;
        priceEstimate: ThreadTurnPriceEstimateDto | null;
    };
    'thread.turn.started': {
        turnId: string;
    };
    'thread.item.started': {
        turnId: string;
        item: ThreadHistoryItemDto;
    };
    'thread.item.completed': {
        turnId: string;
        item: ThreadHistoryItemDto;
    };
    'thread.plan.updated': {
        turnId: string;
        explanation: string | null;
        plan: ThreadLivePlanDto['plan'];
    };
    'thread.request.created': {
        request: ThreadActionRequestDto;
    };
    'thread.request.resolved': {
        requestId: string;
    };
    'thread.output.delta': {
        turnId: string;
        itemId: string;
        sequence: number;
        delta: string;
    };
    'thread.turn.completed': {
        turnId: string;
        status: ThreadTurnDto['status'];
        error: string | null;
    };
    'thread.turn.failed': {
        turnId: string;
        error: string | null;
        willRetry?: boolean;
    };
}
type ThreadEventEnvelope = {
    [Type in keyof ThreadEventPayloadMap]: {
        type: Type;
        threadId: string;
        timestamp: string;
        payload: ThreadEventPayloadMap[Type];
    };
}[keyof ThreadEventPayloadMap];
interface ShellEventPayloadMap {
    'shell.connected': {
        viewerId: string;
    };
    'shell.status': {
        threadId: string;
        state: ShellStatusDto;
        viewerId?: string;
    };
    'shell.output': {
        data: string;
        replace?: boolean;
        cursorX?: number;
        cursorY?: number;
        paneHeight?: number;
        cwdBaseName?: string;
        envPrefix?: string;
        isCommandRunning?: boolean;
    };
    'shell.detached': {
        threadId: string;
        state: Extract<ShellStatusDto, 'detached'>;
        viewerId: string;
        reason?: string;
    };
    'shell.exited': {
        threadId: string;
        state: Extract<ShellStatusDto, 'exited' | 'not_found'>;
    };
    'shell.error': {
        code: string;
        message: string;
    };
}
type ShellEventEnvelope = {
    [Type in keyof ShellEventPayloadMap]: {
        type: Type;
        shellId: string;
        timestamp: string;
        payload: ShellEventPayloadMap[Type];
    };
}[keyof ShellEventPayloadMap];
interface SupervisorConnectedEnvelope {
    type: 'supervisor.connected';
    timestamp: string;
}
interface SupervisorPongEnvelope {
    type: 'supervisor.pong';
    timestamp: string;
    payload: {
        requestTimestamp: string | null;
    };
}
type SupervisorSocketServerEnvelope = SupervisorConnectedEnvelope | SupervisorPongEnvelope | ThreadEventEnvelope | ShellEventEnvelope;
type SupervisorSocketClientEnvelope = {
    type: 'supervisor.ping';
    timestamp: string;
} | {
    type: 'shell.attach';
    shellId: string;
    cols: number;
    rows: number;
} | {
    type: 'shell.detach';
    shellId: string;
    viewerId: string;
} | {
    type: 'shell.input';
    shellId: string;
    viewerId: string;
    data: string;
} | {
    type: 'shell.resize';
    shellId: string;
    viewerId: string;
    cols: number;
    rows: number;
} | {
    type: 'shell.clear';
    shellId: string;
    viewerId: string;
};
/** Text can arrive as a shorter summary; operation lifecycle must still advance. */
declare function mergeThreadHistoryItem(current: ThreadHistoryItemDto | undefined, incoming: ThreadHistoryItemDto): ThreadHistoryItemDto;

export { type ActionDefinition, type AgentBackendConfigFileSchemaDto, type AgentBackendDto, type AgentBackendHookCommandTemplateDto, type AgentBackendIdDto, type AgentBackendInstallationDto, type AgentBackendManagementSchemaDto, type AgentBackendMetadata, type AgentBackendToolboxActionDto, type AgentBackendToolboxItemSchemaDto, type AgentHookDto, type AgentHookErrorDto, type AgentHookEventNameDto, type AgentHookHandlerTypeDto, type AgentHookSourceDto, type AgentHookTrustStatusDto, type AgentMcpAuthStatusDto, type AgentMcpServerDto, type AgentMcpToolDto, type AgentProviderCapabilitiesDto, type AgentRuntimeStatusDto, type AgentSkillDto, type AgentSkillErrorDto, type AgentSkillInterfaceDto, type AgentSkillScopeDto, type AgentSubscriptionUsageDto, type AgentSubscriptionUsageWindowDto, type ApiErrorCode, type ApiErrorShape, type ApplyProviderHostConfigArchiveResultDto, type ApprovalMode, type ArtifactMetadata, type CollaborationModeDto, type ContributionDefinition, type CreateProviderHostConfigArchiveInput, type CreateThreadHookInput, type CreateThreadInput, type CreateWorkspaceFromGitInput, type CreateWorkspaceFromPathInput, type CreateWorkspaceInput, EXTENSION_FIXTURES, EXTENSION_TYPES, EXTENSION_VERSION, type ExportThreadTranscriptInput, type ExtensionDiscovery, type ExtensionEnvelope, ExtensionValidationError, FRAME_CELL_FIXTURE, type ForkThreadInput, type HealthDto, type ImportPluginInput, type ImportThreadInput, type InterruptTurnInput, type JsonValue, type MessageSenderDto, type ModelOptionDto, type OptionDefinition, type PluginArtifactTypeDto, type PluginCapabilitiesDto, type PluginDto, type PluginManifestDto, type PluginMcpServerDto, type PluginModelHintDto, type PluginThreadPanelDto, type PolishedReplyDto, type PromptAttachmentKindDto, type PromptAttachmentManifestEntryDto, type ProviderHostConfigArchiveDto, type ProviderHostConfigArchiveFileDto, type ProviderHostFileDto, type ProviderHostFileNameDto, type ReasoningEffortDto, type ReasoningEffortOptionDto, type RenameProviderHostConfigArchiveInput, type RespondThreadActionRequestInput, type ResumeThreadInput, type RuntimeConfigDto, type SandboxModeDto, type ScientificTarget, type SendThreadPromptInput, type ShellAttachInput, type ShellCreateInput, type ShellDetachInput, type ShellEventEnvelope, type ShellEventPayloadMap, type ShellInputInput, type ShellResizeInput, type ShellSessionDto, type ShellStatusDto, type StructureCell, type StructuredProgress, type StructuredUsage, type SupervisorConnectedEnvelope, type SupervisorPongEnvelope, type SupervisorSocketClientEnvelope, type SupervisorSocketServerEnvelope, type ThreadActionQuestionDto, type ThreadActionQuestionOptionDto, type ThreadActionRequestAnswerDto, type ThreadActionRequestDto, type ThreadActivityNoteDto, type ThreadAnsweredRequestNoteDto, type ThreadArtifactDto, type ThreadContextUsageDto, type ThreadDetailDto, type ThreadDto, type ThreadEventEnvelope, type ThreadEventPayloadMap, type ThreadExportFormatDto, type ThreadExportPdfModeDto, type ThreadExportPdfProfileDto, type ThreadExportTurnOptionDto, type ThreadExportTurnOptionsDto, type ThreadForkResultDto, type ThreadForkTurnOptionDto, type ThreadGoalDto, type ThreadGoalStatusDto, type ThreadHistoryItemDetailDto, type ThreadHistoryItemDto, type ThreadHookTargetInput, type ThreadHooksDto, type ThreadLiveItemsDto, type ThreadLivePlanDto, type ThreadMcpServersDto, type ThreadPeerWorkDto, type ThreadPendingSteerDto, type ThreadShellStateDto, type ThreadSkillsDto, type ThreadSourceDto, type ThreadStatusDto, type ThreadSubagentDto, type ThreadTurnActivityDto, type ThreadTurnActivitySegmentDto, type ThreadTurnChangedFileDto, type ThreadTurnDto, type ThreadTurnPriceEstimateDto, type ThreadTurnPricingTierDto, type ThreadTurnTokenBreakdownDto, type ThreadTurnTokenUsageDto, type TrustThreadHookInput, type UntrustThreadHookInput, type UpdatePluginInput, type UpdateProviderHostFileInput, type UpdateShellInput, type UpdateThreadGoalInput, type UpdateThreadHookInput, type UpdateThreadInput, type UpdateThreadSettingsInput, type UpdateWorkspaceFavoriteInput, type UpdateWorkspaceInput, type UpdateWorkspaceSettingsInput, type ValueSchema, type VersionDto, type ViewerAcknowledgement, type ViewerInput, type ViewerRequest, type WorkspaceDto, type WorkspaceSettingsDto, type WorkspaceTreeDto, type WorkspaceTreeNodeDto, agentBackendIds, agentBackendMetadata, defaultAgentBackendId, extensionFallback, hasCapability, isAgentBackendId, mergeThreadHistoryItem, normalizeAgentBackendId, truncateAutoThreadTitle, validateArtifactMetadata, validateDiscovery, validateExtension, validateOptionValues, validatePayload, validateProgress, validateScientificTarget, validateUsage, validateValueSchema, validateViewerAcknowledgement, validateViewerInput, validateViewerRequest };
