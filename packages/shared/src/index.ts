import type {
  AgentBackendIdDto,
} from './agent-providers';

export {
  agentBackendIds,
  agentBackendMetadata,
  defaultAgentBackendId,
  isAgentBackendId,
  normalizeAgentBackendId,
} from './agent-providers';
export type {
  AgentBackendIdDto,
  AgentBackendMetadata,
} from './agent-providers';

export type ApiErrorCode =
  | 'bad_request'
  | 'not_found'
  | 'conflict'
  | 'provider_goal_error'
  | 'forbidden'
  | 'goal_feature_disabled'
  | 'internal_error'
  | 'service_unavailable';

export interface ApiErrorShape {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

const AUTO_THREAD_TITLE_MAX_CHARS = 15;

function normalizeAutoThreadTitleWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function truncateAutoThreadTitle(value: string) {
  const normalized = normalizeAutoThreadTitleWhitespace(value);
  if (!normalized) {
    return '';
  }

  const characters = Array.from(normalized);
  if (characters.length <= AUTO_THREAD_TITLE_MAX_CHARS) {
    return normalized;
  }

  return `${characters.slice(0, AUTO_THREAD_TITLE_MAX_CHARS).join('')}...`;
}

export interface RuntimeConfigDto {
  appName: string;
  appVersion: string;
  host: string;
  port: number;
  workspaceRoot: string;
  environment: string;
}

export interface AgentRuntimeStatusDto {
  state: 'starting' | 'ready' | 'degraded' | 'stopped' | 'failed';
  transport: 'stdio' | 'sdk' | 'none';
  lastStartedAt: string | null;
  lastError: string | null;
  restartCount: number;
}

export interface AgentSubscriptionUsageWindowDto {
  id: string;
  durationMinutes: number | null;
  label: string;
  usedPercent: number;
  resetsAt: string | null;
}

export interface AgentSubscriptionUsageDto {
  provider: 'codex' | 'claude' | 'grok';
  authKind: 'subscription' | 'apiKey' | 'unknown';
  observedAt: string;
  stale: boolean;
  windows: AgentSubscriptionUsageWindowDto[];
}

export interface AgentProviderCapabilitiesDto {
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

export interface AgentBackendDto {
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

export interface AgentBackendInstallationDto {
  packageName: string | null;
  installed: boolean;
  installedVersion: string | null;
  latestVersion: string | null;
  installCommand: string | null;
  updateCommand: string | null;
  busy: boolean;
  lastError: string | null;
}

export interface AgentBackendConfigFileSchemaDto {
  name: string;
  label: string;
  description: string;
  roles?: Array<'runtime' | 'auth' | 'mcp' | 'hooks' | 'providerSettings'>;
}

export type AgentBackendToolboxActionDto =
  | 'fast'
  | 'compact'
  | 'goal'
  | 'fork'
  | 'skills'
  | 'mcp'
  | 'hooks'
  | 'prompt'
  | 'harness'
  | 'unsupported';

export interface AgentBackendToolboxItemSchemaDto {
  action: AgentBackendToolboxActionDto;
  command: string;
  label: string;
  description?: string | null;
  panel?: 'fork' | 'skills' | 'mcp' | 'hooks' | null;
}

export interface AgentBackendHookCommandTemplateDto {
  eventName: AgentHookEventNameDto;
  command: string;
}

export interface AgentBackendManagementSchemaDto {
  hostConfigFiles: AgentBackendConfigFileSchemaDto[];
  toolboxItems: AgentBackendToolboxItemSchemaDto[];
  hookCommandTemplates: AgentBackendHookCommandTemplateDto[];
  providerConfigFormat: 'toml' | 'json' | 'none';
  mcpConfigFormat: 'codex-toml' | 'claude-json' | 'none';
  configArchives: boolean;
  buildRestart: boolean;
}

export interface ModelOptionDto {
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

export interface VersionDto {
  name: string;
  version: string;
}

export interface HealthDto {
  status: 'ok';
  timestamp: string;
}

export type ProviderHostFileNameDto = string;

export interface ProviderHostFileDto {
  name: ProviderHostFileNameDto;
  path: string;
  exists: boolean;
  content: string;
}

export interface UpdateProviderHostFileInput {
  content: string;
}

export interface ProviderHostConfigArchiveFileDto {
  name: ProviderHostFileNameDto;
  exists: boolean;
}

export interface ProviderHostConfigArchiveDto {
  id: string;
  label: string;
  createdAt: string;
  updatedAt: string;
  files: Record<string, ProviderHostConfigArchiveFileDto>;
}

export interface CreateProviderHostConfigArchiveInput {
  label?: string;
}

export interface RenameProviderHostConfigArchiveInput {
  label: string;
}

export interface ApplyProviderHostConfigArchiveResultDto {
  archive: ProviderHostConfigArchiveDto;
  status: AgentRuntimeStatusDto;
}

export interface WorkspaceDto {
  id: string;
  hostId: string;
  label: string;
  absPath: string;
  isFavorite: boolean;
  createdAt: string;
  lastOpenedAt: string | null;
}

export interface CreateWorkspaceFromPathInput {
  absPath: string;
  label?: string;
}

export interface CreateWorkspaceFromGitInput {
  gitUrl: string;
  label?: string;
}

export type CreateWorkspaceInput = CreateWorkspaceFromPathInput | CreateWorkspaceFromGitInput;

export interface WorkspaceSettingsDto {
  workspaceRoot: string;
  devHome: string;
  defaultBackend: AgentBackendIdDto;
}

export interface UpdateWorkspaceSettingsInput {
  devHome: string;
  defaultBackend?: AgentBackendIdDto;
}

export interface UpdateWorkspaceInput {
  label: string;
}

export type ThreadSourceDto = 'supervisor' | 'local_codex_import';

export interface UpdateWorkspaceFavoriteInput {
  isFavorite: boolean;
}

export interface WorkspaceTreeNodeDto {
  name: string;
  absPath: string;
  kind: 'file' | 'directory';
  hasChildren: boolean;
  isHidden: boolean;
}

export interface WorkspaceTreeDto {
  rootPath: string;
  currentPath: string;
  nodes: WorkspaceTreeNodeDto[];
}

export type ApprovalMode = 'yolo' | 'guarded';
export type ReasoningEffortDto =
  | 'none'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max'
  | 'ultra'
  | (string & {}); // ACP values are opaque, including the provider-default empty value.
export type CollaborationModeDto = 'default' | 'plan';
export type SandboxModeDto = 'read-only' | 'workspace-write' | 'danger-full-access';

export interface ReasoningEffortOptionDto {
  reasoningEffort: ReasoningEffortDto;
  description: string;
}

export type ThreadStatusDto =
  | 'recovering'
  | 'idle'
  | 'running'
  | 'interrupted'
  | 'failed'
  | 'not_loaded'
  | 'system_error';

export interface ThreadContextUsageDto {
  availability: 'available' | 'unavailable';
  remainingPercent: number | null;
  tokensInContextWindow: number | null;
  modelContextWindow: number | null;
  updatedAt: string | null;
}

export interface ThreadDto {
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

export interface ThreadPeerWorkDto {
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
export interface MessageSenderDto {
  /** The sender's relay account ID. */
  userId: string;
  /** The account name the owner shared with, when the device knows it. */
  name?: string | null;
}

export interface ThreadHistoryItemDto {
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
  kind:
    | 'userMessage'
    | 'agentMessage'
    | 'artifact'
    | 'image'
    | 'plan'
    | 'contextCompaction'
    | 'reasoning'
    | 'commandExecution'
    | 'webSearch'
    | 'fileRead'
    | 'fileChange'
    | 'hook'
    | 'agentToolCall'
    | 'skillToolCall'
    | 'toolCall'
    | 'other';
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
  extension?: import('./extensions.mjs').ExtensionEnvelope<unknown>;
  progress?: import('./extensions.mjs').StructuredProgress;
  usage?: import('./extensions.mjs').StructuredUsage;
}

export interface PolishedReplyDto {
  text: string;
  preset: string;
  language: string;
  model: string;
  sourceHash: string;
  createdAt: string;
}

export interface ThreadHistoryItemDetailDto {
  id: string;
  kind: ThreadHistoryItemDto['kind'];
  title: string;
  text: string;
}

export interface ThreadArtifactDto {
  metadata?: import('./extensions.mjs').ArtifactMetadata;
  extension?: import('./extensions.mjs').ExtensionEnvelope<unknown>;
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

export interface PluginArtifactTypeDto {
  type: string;
  title: string;
  fileExtensions?: string[];
}

export interface PluginThreadPanelDto {
  id: string;
  label: string;
  kind?: 'artifact' | 'terminal' | string;
  artifactTypes: string[];
}

export interface PluginModelHintDto {
  id: string;
  text: string;
}

export interface PluginMcpServerDto {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface PluginCapabilitiesDto {
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

export interface PluginManifestDto {
  contribution?: import('./extensions.mjs').ContributionDefinition;
  id: string;
  name: string;
  version: string;
  description: string;
  remoteCodex: string;
  capabilities: PluginCapabilitiesDto;
}

export interface PluginDto extends PluginManifestDto {
  enabled: boolean;
  source?: 'builtin' | 'imported' | null;
  available?: boolean;
  unavailableReasonCode?: string | null;
  unavailableReason?: string | null;
  /** Whether a conversation that follows the device has it on (absent from older Supervisors). */
  defaultEnabled?: boolean;
}

export interface UpdatePluginInput {
  enabled?: boolean;
  /** Whether conversations that follow the device have the plugin on. */
  defaultEnabled?: boolean;
}

export interface ImportPluginInput {
  manifest?: unknown;
  manifestJson?: string;
  enabled?: boolean;
}

export interface ThreadTurnTokenBreakdownDto {
  totalTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens?: number;
  /** One-hour subset of cacheWriteInputTokens. */
  cacheWriteOneHourInputTokens?: number;
  outputTokens: number;
  reasoningOutputTokens: number;
}

export interface ThreadTurnTokenUsageDto {
  total: ThreadTurnTokenBreakdownDto;
  last: ThreadTurnTokenBreakdownDto;
  modelContextWindow: number | null;
  /** The models the turn's own agent called, in order; consecutive calls to
      one model form a run, so a switch mid-turn shows as a second run. */
  models?: { model: string; calls: number }[];
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

export type ThreadTurnPricingTierDto = 'standard' | 'fast';

export interface ThreadTurnPriceEstimateDto {
  pricingModelKey: string;
  pricingTierKey: ThreadTurnPricingTierDto;
  currency: 'USD';
  inputUsd: number;
  cachedInputUsd: number;
  cacheWriteInputUsd?: number;
  outputUsd: number;
  totalUsd: number;
}

export interface ThreadTurnDto {
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

export interface ThreadTurnActivityDto {
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

export type ThreadTurnActivitySegmentDto = Omit<ThreadTurnActivityDto, 'files' | 'segments' | 'fileCount'> & {
  before: string | null;
  startedAt?: string;
  endedAt?: string;
};

export interface ThreadTurnChangedFileDto {
  path: string;
  itemId: string;
  addedLines?: number;
  removedLines?: number;
}

export interface ThreadActionQuestionOptionDto {
  label: string;
  description: string;
}

export interface ThreadActionQuestionDto {
  id: string;
  header: string;
  question: string;
  multiSelect?: boolean;
  isOther: boolean;
  isSecret: boolean;
  options: ThreadActionQuestionOptionDto[] | null;
}

export interface ThreadActionRequestDto {
  id: string;
  kind: 'requestUserInput' | 'permissionRequest' | 'planDecision';
  title: string;
  description: string | null;
  turnId: string | null;
  itemId: string | null;
  createdAt: string;
  questions: ThreadActionQuestionDto[];
}

export interface ThreadAnsweredRequestNoteDto {
  id: string;
  turnId: string | null;
  title: string;
  summaryLines: string[];
  createdAt: string;
}

export interface ThreadActivityNoteDto {
  id: string;
  kind: 'fastMode' | 'goal' | 'forkCreated' | 'forkSource';
  createdAt: string;
  text?: string;
  anchorTurnId?: string | null;
  linkedThreadId?: string;
  linkedThreadTitle?: string | null;
  turnIndex?: number | null;
}

export type AgentSkillScopeDto = 'user' | 'repo' | 'system' | 'admin';

export interface AgentSkillInterfaceDto {
  displayName?: string;
  shortDescription?: string;
  brandColor?: string;
  defaultPrompt?: string;
}

export interface AgentSkillDto {
  name: string;
  description: string;
  shortDescription?: string;
  interface?: AgentSkillInterfaceDto;
  path: string;
  scope: AgentSkillScopeDto;
  enabled: boolean;
}

export interface AgentSkillErrorDto {
  path: string;
  message: string;
}

export interface ThreadSkillsDto {
  cwd: string;
  skills: AgentSkillDto[];
  errors: AgentSkillErrorDto[];
}

export type AgentMcpAuthStatusDto =
  | 'unsupported'
  | 'notLoggedIn'
  | 'bearerToken'
  | 'oAuth';

export interface AgentMcpToolDto {
  name: string;
  title: string | null;
  description: string | null;
}

export interface AgentMcpServerDto {
  name: string;
  authStatus: AgentMcpAuthStatusDto;
  tools: AgentMcpToolDto[];
  resourceCount: number;
  resourceTemplateCount: number;
}

export interface ThreadMcpServersDto {
  servers: AgentMcpServerDto[];
}

export type AgentHookEventNameDto =
  | 'preToolUse'
  | 'permissionRequest'
  | 'postToolUse'
  | 'preCompact'
  | 'postCompact'
  | 'sessionStart'
  | 'userPromptSubmit'
  | 'stop';

export type AgentHookHandlerTypeDto = 'command' | 'prompt' | 'agent';
export type AgentHookSourceDto =
  | 'system'
  | 'user'
  | 'project'
  | 'mdm'
  | 'sessionFlags'
  | 'plugin'
  | 'cloudRequirements'
  | 'legacyManagedConfigFile'
  | 'legacyManagedConfigMdm'
  | 'unknown';
export type AgentHookTrustStatusDto = 'managed' | 'untrusted' | 'trusted' | 'modified';

export interface AgentHookDto {
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

export interface AgentHookErrorDto {
  path: string;
  message: string;
}

export interface ThreadHooksDto {
  cwd: string;
  hooks: AgentHookDto[];
  warnings: string[];
  errors: AgentHookErrorDto[];
  globalHooksPath: string;
  projectHooksPath: string;
}

export interface CreateThreadHookInput {
  scope: 'global' | 'project';
  eventName: AgentHookEventNameDto;
  matcher?: string | null;
  command: string;
  timeoutSec?: number | null;
  statusMessage?: string | null;
}

export interface ThreadHookTargetInput {
  scope: 'global' | 'project';
  eventName: AgentHookEventNameDto;
  matcher?: string | null;
  command: string;
  timeoutSec?: number | null;
  statusMessage?: string | null;
}

export interface UpdateThreadHookInput extends CreateThreadHookInput {
  target: ThreadHookTargetInput;
}

export interface TrustThreadHookInput {
  key: string;
  currentHash: string;
}

export interface UntrustThreadHookInput {
  key: string;
}

export type ThreadGoalStatusDto =
  | 'active'
  | 'paused'
  | 'budgetLimited'
  | 'complete'
  | 'terminated';

export interface ThreadGoalDto {
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

export interface UpdateThreadGoalInput {
  objective?: string | null;
  status?: ThreadGoalStatusDto | null;
  tokenBudget?: number | null;
}

export interface ThreadLivePlanDto {
  turnId: string;
  explanation: string | null;
  plan: Array<{ step: string; status: string }>;
  updatedAt: string;
}

export interface ThreadPendingSteerDto {
  id: string;
  clientRequestId: string | null;
  turnId: string;
  prompt: string;
  delivery: "steer" | "continuation";
  createdAt: string;
  /** Set when someone other than the device owner sent it. */
  sender?: MessageSenderDto | null;
}

export interface ThreadSubagentDto {
  id: string;
  name: string | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  parentToolCallId: string | null;
  isBackground?: boolean;
}

export interface ThreadLiveItemsDto {
  turnId: string;
  items: ThreadHistoryItemDto[];
  updatedAt: string;
}

export interface ThreadDetailDto {
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

export interface ThreadExportTurnOptionDto {
  turnId: string;
  turnNumber: number;
  startedAt: string | null;
  status: ThreadTurnDto['status'];
  userPromptPreview: string;
}

export interface ThreadExportTurnOptionsDto {
  turns: ThreadExportTurnOptionDto[];
  totalTurnCount: number;
}

export type ThreadExportPdfModeDto = 'latest' | 'selected';
export type ThreadExportPdfProfileDto = 'review' | 'technical';
export type ThreadExportFormatDto = 'html';

export interface ExportThreadTranscriptInput {
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

export interface ThreadForkTurnOptionDto {
  turnId: string;
  turnIndex: number;
  startedAt: string | null;
  status: ThreadTurnDto['status'];
}

export interface ForkThreadInput {
  mode: 'latest' | 'turn';
  turnId?: string;
}

export interface ThreadForkResultDto {
  thread: ThreadDetailDto;
  sourceThreadId: string;
  sourceTurnId: string | null;
  sourceTurnIndex: number | null;
}

export type ShellStatusDto =
  | 'not_created'
  | 'creating'
  | 'running'
  | 'attached'
  | 'detached'
  | 'exited'
  | 'not_found'
  | 'workspace_missing';

export interface ShellSessionDto {
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

export interface ThreadShellStateDto {
  threadId: string;
  workspaceId: string;
  workspacePathStatus: 'present' | 'missing';
  state: ShellStatusDto;
  shell: ShellSessionDto | null;
  shells: ShellSessionDto[];
  activeShellId: string | null;
}

export interface ShellCreateInput {
  cols?: number;
  rows?: number;
  label?: string;
}

export interface UpdateShellInput {
  label?: string | null;
}

export interface ShellAttachInput {
  cols: number;
  rows: number;
}

export interface ShellDetachInput {
  viewerId: string;
}

export interface ShellInputInput {
  viewerId: string;
  data: string;
}

export interface ShellResizeInput {
  viewerId: string;
  cols: number;
  rows: number;
}

export interface CreateThreadInput {
  workspaceId: string;
  title?: string;
  provider?: AgentBackendIdDto;
  model: string;
  approvalMode: ApprovalMode;
}

export interface UpdateThreadSettingsInput {
  model?: string;
  reasoningEffort?: ReasoningEffortDto | null;
  fastMode?: boolean;
  collaborationMode?: CollaborationModeDto;
  sandboxMode?: SandboxModeDto | null;
}

export interface UpdateThreadInput {
  title: string;
}

export interface ImportThreadInput {
  sessionId: string;
}

export interface SendThreadPromptInput {
  prompt: string;
  clientRequestId?: string;
  model?: string;
  reasoningEffort?: ReasoningEffortDto | null;
  collaborationMode?: CollaborationModeDto;
  sandboxMode?: SandboxModeDto | null;
}

export type PromptAttachmentKindDto = 'photo' | 'file';

export interface PromptAttachmentManifestEntryDto {
  clientId: string;
  kind: PromptAttachmentKindDto;
  originalName: string;
  placeholder: string;
}

export interface InterruptTurnInput {
  turnId?: string;
}

export interface ResumeThreadInput {
  model?: string;
  sandboxMode?: SandboxModeDto | null;
}

export interface ThreadActionRequestAnswerDto {
  answers: string[];
}

export interface RespondThreadActionRequestInput {
  answers: Record<string, ThreadActionRequestAnswerDto>;
}

export interface ThreadEventPayloadMap {
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

export type ThreadEventEnvelope = {
  [Type in keyof ThreadEventPayloadMap]: {
    type: Type;
    threadId: string;
    timestamp: string;
    payload: ThreadEventPayloadMap[Type];
  };
}[keyof ThreadEventPayloadMap];

export interface ShellEventPayloadMap {
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

export type ShellEventEnvelope = {
  [Type in keyof ShellEventPayloadMap]: {
    type: Type;
    shellId: string;
    timestamp: string;
    payload: ShellEventPayloadMap[Type];
  };
}[keyof ShellEventPayloadMap];

export interface SupervisorConnectedEnvelope {
  type: 'supervisor.connected';
  timestamp: string;
}

export interface SupervisorPongEnvelope {
  type: 'supervisor.pong';
  timestamp: string;
  payload: {
    requestTimestamp: string | null;
  };
}

export type SupervisorSocketServerEnvelope =
  | SupervisorConnectedEnvelope
  | SupervisorPongEnvelope
  | ThreadEventEnvelope
  | ShellEventEnvelope;

export type SupervisorSocketClientEnvelope =
  | {
      type: 'supervisor.ping';
      timestamp: string;
    }
  | {
      type: 'shell.attach';
      shellId: string;
      cols: number;
      rows: number;
    }
  | {
      type: 'shell.detach';
      shellId: string;
      viewerId: string;
    }
  | {
      type: 'shell.input';
      shellId: string;
      viewerId: string;
      data: string;
    }
  | {
      type: 'shell.resize';
      shellId: string;
      viewerId: string;
      cols: number;
      rows: number;
    }
  | {
      type: 'shell.clear';
      shellId: string;
      viewerId: string;
    };


/** Text can arrive as a shorter summary; operation lifecycle must still advance. */
export function mergeThreadHistoryItem(
  current: ThreadHistoryItemDto | undefined,
  incoming: ThreadHistoryItemDto,
): ThreadHistoryItemDto {
  if (!current || current.kind !== incoming.kind) return incoming;
  const terminal = (status: string | null | undefined) =>
    ['completed', 'failed', 'interrupted', 'cancelled', 'canceled'].includes(status?.toLowerCase() ?? '');
  const richer = (previous: string | null | undefined, next: string | null | undefined) =>
    (previous?.length ?? 0) > (next?.length ?? 0) ? previous : next ?? previous;
  return {
    ...current,
    ...incoming,
    text: richer(current.text, incoming.text) ?? '',
    ...(current.detailText != null || incoming.detailText != null
      ? { detailText: richer(current.detailText, incoming.detailText) ?? '' } : {}),
    ...(current.previewText != null || incoming.previewText != null
      ? { previewText: richer(current.previewText, incoming.previewText) ?? '' } : {}),
    ...(current.status != null || incoming.status != null
      ? { status: terminal(current.status) && !terminal(incoming.status)
        ? current.status : incoming.status ?? current.status } : {}),
    ...(current.sequence != null || incoming.sequence != null
      ? { sequence: incoming.sequence ?? current.sequence } : {}),
  };
}

// Frozen ElAgente extension DTOs; no runtime UI loading from wire data.
export * from './extensions.mjs';
export { EXTENSION_FIXTURES, FRAME_CELL_FIXTURE } from './extension-fixtures.mjs';
