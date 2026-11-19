import type {
  ShellEventEnvelope,
  ShellSessionDto,
  ThreadDto,
  ThreadHistoryItemDetailDto,
  ThreadHistoryItemDto,
  ThreadShellStateDto,
  ThreadTurnDto,
  UpdateShellInput,
  UpdateThreadSettingsInput,
} from '@remote-codex/shared';
import type { ReactNode } from 'react';
import type { SendPromptInput } from './types';

/**
 * `thumbnail` asks for a small preview for inline chips. Supervisors without
 * the variant answer with the original, so callers must not rely on its size.
 */
export type ThreadImageAssetVariant = 'thumbnail';

/**
 * What a page knows of another thread on its device, for naming it where it is
 * linked (a task's sender, a sub-thread's parent). `workspaceLabel` may be absent
 * while it is unknown.
 */
export interface ThreadLinkInfo {
  title: string;
  workspaceId?: string | null;
  workspaceLabel?: string | null;
}
/**
 * Looks up a thread of this device: its info, `null` when it is gone or the
 * reader cannot open it, `undefined` while the page does not know yet.
 */
export type DescribeThread = (threadId: string) => ThreadLinkInfo | null | undefined;

/** An artifact a tool reported (`progress.artifactIds`), as the host resolved it. */
export interface ThreadToolArtifact {
  id: string;
  name: string;
  /** IANA media type, e.g. `image/png`; images with a URL are shown inline. */
  mediaType?: string | undefined;
  /** The host's artifact kind (e.g. `file`, `chem.structure`). */
  kind?: string | undefined;
  /** A same-origin or https address of the artifact bytes; never a data URL. */
  url?: string | undefined;
  size?: number | undefined;
}

/** Presentation of the shared user body; stored content and copy remain intact. */
export interface ThreadUserMessageContentOptions {
  /** Show FILE tiles. Disable when the host renders its own file list. Photos remain visible. */
  fileAttachments?: boolean | undefined;
}

/** Content rendered inside a user bubble; the shared frame keeps its metadata. */
export interface ThreadUserMessageContentInput {
  threadId?: string | undefined;
  messageId: string;
  item: ThreadHistoryItemDto;
  /** Original stored text, before prompt-envelope parsing or presentation. */
  content: string;
  /** Shared body, including attachments and Show more. Omit text for the default. */
  renderDefaultContent: (content?: string, options?: ThreadUserMessageContentOptions) => ReactNode;
  /** Call before host disclosure changes so the timeline can preserve its anchor. */
  onBeforeResize?: ((anchor?: Element | null) => void) | undefined;
}

export interface ThreadTimelineAdapter {
  /**
   * Replaces user bubble content. Return null/undefined to keep the shared body.
   * Peer envelope headers and system notices retain their shared presentation.
   */
  renderUserMessageContent?: (input: ThreadUserMessageContentInput) => ReactNode;
  /** Resolves an artifact a tool reported; null when the host does not know it. */
  resolveArtifact?: (artifactId: string) => ThreadToolArtifact | null;
  resolveWorkspacePath?: (path: string) => Promise<boolean>;
  workspaceRootPath?: string | undefined;
  getImageAssetUrl?: (input: {
    threadId: string;
    path: string;
    variant?: ThreadImageAssetVariant;
  }) => string;
  resolveHref?: (href: string) => string;
  onOpenLinkedThread?: (threadId: string) => void;
  /** An address for a thread on this device, so links to it can open in a new tab. */
  getThreadHref?: (threadId: string) => string;
  /** Names linked threads by their titles instead of short IDs. */
  describeThread?: DescribeThread;
  onOpenWorkspaceFile?: (input: { path: string; line?: number }) => void;
  cancelPendingSteer?: (
    threadId: string,
    pendingSteerId: string,
  ) => Promise<void> | void;
  onLoadHistoryItemDetail?: (
    itemId: string,
  ) => Promise<ThreadHistoryItemDetailDto> | ThreadHistoryItemDetailDto;
  onLoadTurnDetail?: (
    turnId: string,
  ) => Promise<ThreadTurnDto> | ThreadTurnDto;
}

export interface ShellSocketHandlers {
  onConnected?: (event: unknown) => void;
  onShellEvent?: (event: ShellEventEnvelope) => void;
}

export interface ShellSocketConnection {
  socket: WebSocket;
  send(message: unknown): void;
  close?: () => void;
}

export interface ThreadWorkspaceTreeNode {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  size?: number;
  /** RFC 3339 times and permissions, for the explorer's Properties (newer devices). */
  modifiedAt?: string;
  createdAt?: string;
  accessedAt?: string;
  /** Unix permission bits such as "rw-r--r--". */
  mode?: string;
  readonly?: boolean;
  symlink?: boolean;
  hasChildren?: boolean;
  childrenLoaded?: boolean;
  truncated?: boolean;
  children?: ThreadWorkspaceTreeNode[];
}

export interface ThreadWorkspaceFilePreview {
  path: string;
  name: string;
  content: string;
  language: string;
  size: number;
  truncated: boolean;
  nextOffset: number;
}

export type ThreadWorkspaceUploadResult =
  | {
      kind: 'file';
      file: {
        path: string;
        name: string;
        size: number;
      };
    }
  | {
      kind: 'archive';
      archiveName: string;
      extractedCount: number;
      paths: string[];
      /** First committed file (paths can also contain directory entries). */
      firstFile?: string | null;
    };

export type ThreadWorkspaceArchiveFormat = 'tar' | 'zip';

export interface ThreadWorkspaceTrashEntry {
  trashId: string;
  path: string;
  revision: string;
  size: number;
  trashedAt: string;
}

export interface ThreadWorkspaceTrashList {
  version: 1;
  revision: string;
  entries: ThreadWorkspaceTrashEntry[];
}

export interface ThreadWorkspaceCapabilities {
  download: {file: boolean; directory: false | 'tar'};
  archiveImport: false | 'tar';
  create?: boolean;
  mkdir?: boolean;
  delete?: 'file' | false;
  move?: 'file-new-destination' | false;
  maxFileBytes?: number;
  maxArchiveBytes?: number;
  maxArchiveEntries?: number;
  archives?: {version: 1; formats: ThreadWorkspaceArchiveFormat[]};
  trash?: {version: 1; files: boolean; restore: boolean; empty: boolean};
}

export interface ThreadWorkspaceAdapter {
  capabilities?: ThreadWorkspaceCapabilities;
  getCapabilities?: (threadId: string) => Promise<ThreadWorkspaceCapabilities>;
  importArchive?: (input: {threadId: string; workspaceId?: string | null; path: string; file: File; format?: ThreadWorkspaceArchiveFormat}) => Promise<Extract<ThreadWorkspaceUploadResult, {kind: 'archive'}>>;
  /** Host freezes the source revision and binds it to the supplied operationId. */
  trashFile?: (input: {threadId: string; workspaceId?: string | null; path: string; operationId?: string}) => Promise<ThreadWorkspaceTrashEntry>;
  listTrash?: (input: {threadId: string; workspaceId?: string | null}) => Promise<ThreadWorkspaceTrashList>;
  restoreTrash?: (input: {threadId: string; workspaceId?: string | null; trashId: string; expectedRevision: string; expectedDestinationRevision: null; operationId?: string}) => Promise<void> | void;
  emptyTrash?: (input: {threadId: string; workspaceId?: string | null; expectedRevision: string; operationId?: string}) => Promise<void> | void;
  deleteFile?: (input: {threadId: string; workspaceId?: string | null; path: string}) => Promise<void> | void;
  moveFile?: (input: {threadId: string; workspaceId?: string | null; path: string; destination: string}) => Promise<void> | void;
  /** Opaque owner/device source identity; must change when either changes. */
  resourceScopeKey?: string;
  readDocument?: (input: { threadId: string; workspaceId?: string | null; path: string; signal?: AbortSignal }) => Promise<WorkspaceDocumentSnapshot>;
  saveDocument?: (input: WorkspaceDocumentSaveInput & { threadId: string; workspaceId?: string | null }) => Promise<WorkspaceSaveReceipt>;
  getSaveOperation?: (input: { threadId: string; workspaceId?: string | null; operationId: string }) => Promise<WorkspaceSaveReceipt>;
  textRangeRead?: boolean;
  /** Owner-only, read-only host files explicitly opened from a thread link. */
  statLinkedFile?: (input: { threadId: string; path: string }) => Promise<ThreadWorkspaceTreeNode>;
  /** The host lists entries its visibility rules hide when asked (`showHidden`);
      the Explorer then offers Show hidden files. */
  hiddenFiles?: boolean;
  listTree(input: {
    threadId: string;
    workspaceId?: string | null;
    path?: string | null;
    showHidden?: boolean;
  }): Promise<ThreadWorkspaceTreeNode>;
  readFile(input: {
    threadId: string;
    workspaceId?: string | null;
    path: string;
    offset?: number;
    limit?: number;
  }): Promise<ThreadWorkspaceFilePreview>;
  getRawFileUrl?: (input: {
    threadId: string;
    workspaceId?: string | null;
    path: string;
  }) => string;
  /**
   * File bytes through the authenticated (on a relay: encrypted) API. Previews
   * that the browser would otherwise navigate to, such as PDF frames, use this:
   * a frame or new tab on another origin bypasses the Web origin's transport.
   */
  readRawFile?: (input: {
    threadId: string;
    workspaceId?: string | null;
    path: string;
    signal?: AbortSignal;
  }) => Promise<Blob>;
  uploadFile?: (input: {
    threadId: string;
    workspaceId?: string | null;
    path: string;
    file: File;
  }) => Promise<ThreadWorkspaceUploadResult>;
  pickUploadFile?: (input: {
    threadId: string;
    workspaceId?: string | null;
    defaultPick: () => void;
    upload: (file: File) => Promise<void>;
  }) => Promise<void> | void;
  writeFile?: (input: {
    threadId: string;
    workspaceId?: string | null;
    path: string;
    content: string;
  }) => Promise<void> | void;
  downloadNode?: (input: {
    threadId: string;
    workspaceId?: string | null;
    path: string;
    kind: 'file' | 'directory';
    format?: ThreadWorkspaceArchiveFormat;
  }) => Promise<void> | void;
  renameNode?: (input: { threadId: string; workspaceId?: string | null; fromPath: string; toPath: string }) => Promise<void>;
  /** Creates an empty file exclusively; an existing path must never be overwritten. */
  createFile?: (input: { threadId: string; workspaceId?: string | null; path: string }) => Promise<{ path: string }>;
  deleteNode?: (input: { threadId: string; workspaceId?: string | null; path: string }) => Promise<void>;
  listGarbage?: (input: {
    threadId: string;
    workspaceId?: string | null;
  }) => Promise<string[]>;
  emptyGarbage?: (input: {
    threadId: string;
    workspaceId?: string | null;
  }) => Promise<void> | void;
  subscribeWorkspaceChanged?: (
    input: {
      threadId: string;
      workspaceId?: string | null;
    },
    onChanged: () => void,
  ) => (() => void) | void;
}

export interface ThreadShellAdapter {
  fetchState(threadId: string): Promise<ThreadShellStateDto>;
  createShell(
    threadId: string,
    input?: { cols?: number; rows?: number; label?: string },
  ): Promise<ThreadShellStateDto>;
  terminateShell(shellId: string): Promise<ShellSessionDto>;
  updateShell(
    shellId: string,
    input: UpdateShellInput,
  ): Promise<ShellSessionDto>;
  connectSocket(handlers: ShellSocketHandlers): ShellSocketConnection;
}

export interface ThreadDetailUiAdapter {
  renderUserMessageContent?: ThreadTimelineAdapter['renderUserMessageContent'];
  openThread(threadId: string): void;
  /** Resolves artifacts a tool reported, so tool cards can show them (images inline). */
  resolveArtifact?: (artifactId: string) => ThreadToolArtifact | null;
  getThreadHref?: (threadId: string) => string;
  /**
   * Names linked threads by their titles. With it, a sub-thread (one with a
   * `parentThreadId`) shows a bar above its conversation that leads to its parent.
   */
  describeThread?: DescribeThread;
  getNewThreadHref?: (workspaceId?: string | null) => string;
  renderNewThreadDialogContent?: (input: {
    close: () => void;
    closeNavigation: () => void;
    currentWorkspaceId?: string | null;
  }) => ReactNode;
  renameThread?: (threadId: string, title: string) => Promise<void> | void;
  deleteThread?: (thread: ThreadDto) => Promise<void> | void;
  cancelPendingSteer?: (
    threadId: string,
    pendingSteerId: string,
  ) => Promise<void> | void;
  steerPendingPrompt?: (
    threadId: string,
    pendingSteerId: string,
  ) => Promise<void> | void;
  sendPrompt(input: SendPromptInput): Promise<boolean | void> | boolean | void;
  interrupt?: () => Promise<void> | void;
  compact?: () => Promise<void> | void;
  updateSettings?: (input: UpdateThreadSettingsInput) => Promise<void> | void;
  loadHistoryItemDetail?: (
    itemId: string,
  ) => Promise<ThreadHistoryItemDetailDto> | ThreadHistoryItemDetailDto;
  loadTurnDetail?: (
    turnId: string,
  ) => Promise<ThreadTurnDto> | ThreadTurnDto;
  getImageAssetUrl?: (path: string, variant?: ThreadImageAssetVariant) => string;
  openWorkspaceFile?: (input: { path: string; line?: number }) => void;
  workspace?: ThreadWorkspaceAdapter | null;
  shell?: ThreadShellAdapter | null;
}

/** Safe small-file editing is an explicit capability, never a legacy PUT option. */
export interface WorkspaceDocumentSnapshot {
  path: string; name: string; language: string; workspaceRevision: string;
  fileIdentity: string; contentHash: string | null; content: string | null;
  size: number; encoding: string; bom: boolean; eol: string;
  readOnlyReason: string | null; truncated: boolean;
}
export interface WorkspaceDocumentSaveInput {
  path: string; workspaceRevision: string; fileIdentity: string;
  expectedHash: string; content: string; draftRevision: number; operationId: string; operationCreatedAt: number;
}
export interface WorkspaceSaveReceipt {
  status: 'pending' | 'saved' | 'conflict' | 'failedBeforeWrite' | 'uncertain';
  operationId: string; draftRevision: number; path: string;
  contentHash?: string; fileIdentity?: string; size?: number;
  workspaceRevision?: string; encoding?: string; bom?: boolean; eol?: string;
  snapshot?: WorkspaceDocumentSnapshot; code?: string; message?: string;
}
