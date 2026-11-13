import * as react from 'react';
import { ReactNode, MutableRefObject } from 'react';
import * as _remote_codex_shared from '@remote-codex/shared';
import { PromptAttachmentManifestEntryDto, ThreadDto, UpdateThreadSettingsInput, ThreadHistoryItemDetailDto, ThreadTurnDto, ThreadShellStateDto, ShellSessionDto, UpdateShellInput, ShellEventEnvelope, PluginDto, ImportPluginInput, UpdatePluginInput, ThreadArtifactDto, ThreadDetailDto, AgentRuntimeStatusDto } from '@remote-codex/shared';
import { F as FrontendPluginModule, E as ExtensionHostAdapter, m as ViewerToolbarContribution, f as ThreadPanelContribution, a as ExtensionRenderContext, U as UpstreamConnectionHost, T as ThreadPluginAdapter, e as PluginSettingsSnapshot, A as ArtifactRenderContext, I as InlineCodeRenderContext, b as MessagePresentationContext, M as MessagePresentation, P as PluginActionOutputContext, g as ThreadPluginDto, i as ThreadPluginSettingsSnapshot, h as ThreadPluginSettingsInput } from './plugin-types-BkQJk-w8.js';

interface PromptAttachmentUpload extends PromptAttachmentManifestEntryDto {
    file: File;
}
type SendPromptInput = {
    prompt: string;
    attachments?: PromptAttachmentUpload[];
    delivery?: 'steer';
};
interface ThreadShellControlState {
    status: _remote_codex_shared.ShellStatusDto;
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

/**
 * `thumbnail` asks for a small preview for inline chips. Supervisors without
 * the variant answer with the original, so callers must not rely on its size.
 */
type ThreadImageAssetVariant = 'thumbnail';
/**
 * What a page knows of another thread on its device, for naming it where it is
 * linked (a task's sender, a sub-thread's parent). `workspaceLabel` may be absent
 * while it is unknown.
 */
interface ThreadLinkInfo {
    title: string;
    workspaceId?: string | null;
    workspaceLabel?: string | null;
}
/**
 * Looks up a thread of this device: its info, `null` when it is gone or the
 * reader cannot open it, `undefined` while the page does not know yet.
 */
type DescribeThread = (threadId: string) => ThreadLinkInfo | null | undefined;
/** An artifact a tool reported (`progress.artifactIds`), as the host resolved it. */
interface ThreadToolArtifact {
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
interface ThreadTimelineAdapter {
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
    onOpenWorkspaceFile?: (input: {
        path: string;
        line?: number;
    }) => void;
    cancelPendingSteer?: (threadId: string, pendingSteerId: string) => Promise<void> | void;
    onLoadHistoryItemDetail?: (itemId: string) => Promise<ThreadHistoryItemDetailDto> | ThreadHistoryItemDetailDto;
    onLoadTurnDetail?: (turnId: string) => Promise<ThreadTurnDto> | ThreadTurnDto;
}
interface ShellSocketHandlers {
    onConnected?: (event: unknown) => void;
    onShellEvent?: (event: ShellEventEnvelope) => void;
}
interface ShellSocketConnection {
    socket: WebSocket;
    send(message: unknown): void;
    close?: () => void;
}
interface ThreadWorkspaceTreeNode {
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
interface ThreadWorkspaceFilePreview {
    path: string;
    name: string;
    content: string;
    language: string;
    size: number;
    truncated: boolean;
    nextOffset: number;
}
type ThreadWorkspaceUploadResult = {
    kind: 'file';
    file: {
        path: string;
        name: string;
        size: number;
    };
} | {
    kind: 'archive';
    archiveName: string;
    extractedCount: number;
    paths: string[];
    /** First committed file (paths can also contain directory entries). */
    firstFile?: string | null;
};
type ThreadWorkspaceArchiveFormat = 'tar' | 'zip';
interface ThreadWorkspaceTrashEntry {
    trashId: string;
    path: string;
    revision: string;
    size: number;
    trashedAt: string;
}
interface ThreadWorkspaceTrashList {
    version: 1;
    revision: string;
    entries: ThreadWorkspaceTrashEntry[];
}
interface ThreadWorkspaceCapabilities {
    download: {
        file: boolean;
        directory: false | 'tar';
    };
    archiveImport: false | 'tar';
    create?: boolean;
    mkdir?: boolean;
    delete?: 'file' | false;
    move?: 'file-new-destination' | false;
    maxFileBytes?: number;
    maxArchiveBytes?: number;
    maxArchiveEntries?: number;
    archives?: {
        version: 1;
        formats: ThreadWorkspaceArchiveFormat[];
    };
    trash?: {
        version: 1;
        files: boolean;
        restore: boolean;
        empty: boolean;
    };
}
interface ThreadWorkspaceAdapter {
    capabilities?: ThreadWorkspaceCapabilities;
    getCapabilities?: (threadId: string) => Promise<ThreadWorkspaceCapabilities>;
    importArchive?: (input: {
        threadId: string;
        workspaceId?: string | null;
        path: string;
        file: File;
        format?: ThreadWorkspaceArchiveFormat;
    }) => Promise<Extract<ThreadWorkspaceUploadResult, {
        kind: 'archive';
    }>>;
    /** Host freezes the source revision and binds it to the supplied operationId. */
    trashFile?: (input: {
        threadId: string;
        workspaceId?: string | null;
        path: string;
        operationId?: string;
    }) => Promise<ThreadWorkspaceTrashEntry>;
    listTrash?: (input: {
        threadId: string;
        workspaceId?: string | null;
    }) => Promise<ThreadWorkspaceTrashList>;
    restoreTrash?: (input: {
        threadId: string;
        workspaceId?: string | null;
        trashId: string;
        expectedRevision: string;
        expectedDestinationRevision: null;
        operationId?: string;
    }) => Promise<void> | void;
    emptyTrash?: (input: {
        threadId: string;
        workspaceId?: string | null;
        expectedRevision: string;
        operationId?: string;
    }) => Promise<void> | void;
    deleteFile?: (input: {
        threadId: string;
        workspaceId?: string | null;
        path: string;
    }) => Promise<void> | void;
    moveFile?: (input: {
        threadId: string;
        workspaceId?: string | null;
        path: string;
        destination: string;
    }) => Promise<void> | void;
    /** Opaque owner/device source identity; must change when either changes. */
    resourceScopeKey?: string;
    readDocument?: (input: {
        threadId: string;
        workspaceId?: string | null;
        path: string;
        signal?: AbortSignal;
    }) => Promise<WorkspaceDocumentSnapshot>;
    saveDocument?: (input: WorkspaceDocumentSaveInput & {
        threadId: string;
        workspaceId?: string | null;
    }) => Promise<WorkspaceSaveReceipt>;
    getSaveOperation?: (input: {
        threadId: string;
        workspaceId?: string | null;
        operationId: string;
    }) => Promise<WorkspaceSaveReceipt>;
    textRangeRead?: boolean;
    /** Owner-only, read-only host files explicitly opened from a thread link. */
    statLinkedFile?: (input: {
        threadId: string;
        path: string;
    }) => Promise<ThreadWorkspaceTreeNode>;
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
    renameNode?: (input: {
        threadId: string;
        workspaceId?: string | null;
        fromPath: string;
        toPath: string;
    }) => Promise<void>;
    /** Creates an empty file exclusively; an existing path must never be overwritten. */
    createFile?: (input: {
        threadId: string;
        workspaceId?: string | null;
        path: string;
    }) => Promise<{
        path: string;
    }>;
    deleteNode?: (input: {
        threadId: string;
        workspaceId?: string | null;
        path: string;
    }) => Promise<void>;
    listGarbage?: (input: {
        threadId: string;
        workspaceId?: string | null;
    }) => Promise<string[]>;
    emptyGarbage?: (input: {
        threadId: string;
        workspaceId?: string | null;
    }) => Promise<void> | void;
    subscribeWorkspaceChanged?: (input: {
        threadId: string;
        workspaceId?: string | null;
    }, onChanged: () => void) => (() => void) | void;
}
interface ThreadShellAdapter {
    fetchState(threadId: string): Promise<ThreadShellStateDto>;
    createShell(threadId: string, input?: {
        cols?: number;
        rows?: number;
        label?: string;
    }): Promise<ThreadShellStateDto>;
    terminateShell(shellId: string): Promise<ShellSessionDto>;
    updateShell(shellId: string, input: UpdateShellInput): Promise<ShellSessionDto>;
    connectSocket(handlers: ShellSocketHandlers): ShellSocketConnection;
}
interface ThreadDetailUiAdapter {
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
    cancelPendingSteer?: (threadId: string, pendingSteerId: string) => Promise<void> | void;
    steerPendingPrompt?: (threadId: string, pendingSteerId: string) => Promise<void> | void;
    sendPrompt(input: SendPromptInput): Promise<boolean | void> | boolean | void;
    interrupt?: () => Promise<void> | void;
    compact?: () => Promise<void> | void;
    updateSettings?: (input: UpdateThreadSettingsInput) => Promise<void> | void;
    loadHistoryItemDetail?: (itemId: string) => Promise<ThreadHistoryItemDetailDto> | ThreadHistoryItemDetailDto;
    loadTurnDetail?: (turnId: string) => Promise<ThreadTurnDto> | ThreadTurnDto;
    getImageAssetUrl?: (path: string, variant?: ThreadImageAssetVariant) => string;
    openWorkspaceFile?: (input: {
        path: string;
        line?: number;
    }) => void;
    workspace?: ThreadWorkspaceAdapter | null;
    shell?: ThreadShellAdapter | null;
}
/** Safe small-file editing is an explicit capability, never a legacy PUT option. */
interface WorkspaceDocumentSnapshot {
    path: string;
    name: string;
    language: string;
    workspaceRevision: string;
    fileIdentity: string;
    contentHash: string | null;
    content: string | null;
    size: number;
    encoding: string;
    bom: boolean;
    eol: string;
    readOnlyReason: string | null;
    truncated: boolean;
}
interface WorkspaceDocumentSaveInput {
    path: string;
    workspaceRevision: string;
    fileIdentity: string;
    expectedHash: string;
    content: string;
    draftRevision: number;
    operationId: string;
    operationCreatedAt: number;
}
interface WorkspaceSaveReceipt {
    status: 'pending' | 'saved' | 'conflict' | 'failedBeforeWrite' | 'uncertain';
    operationId: string;
    draftRevision: number;
    path: string;
    contentHash?: string;
    fileIdentity?: string;
    size?: number;
    workspaceRevision?: string;
    encoding?: string;
    bom?: boolean;
    eol?: string;
    snapshot?: WorkspaceDocumentSnapshot;
    code?: string;
    message?: string;
}

type SettingsSection = {
    id: string;
    label: string;
    description?: string;
    account?: boolean;
    content: ReactNode;
};
declare function SettingsPanels({ sections, initialId, selected: selectedId, onSelect, scroll }: {
    sections: SettingsSection[];
    initialId?: string;
    /** Held by the owner when the panels may remount while open. */
    selected?: string | undefined;
    onSelect?: ((id: string) => void) | undefined;
    /** The panel's scroll offset, kept by the owner across such a remount. */
    scroll?: MutableRefObject<number> | undefined;
}): react.JSX.Element | null;

/** Only reviewed, imported modules participate. Wire contribution IDs are data. */
declare function extensionModuleAvailable(module: FrontendPluginModule, host?: ExtensionHostAdapter): boolean;
declare function createExtensionPluginApi(modules: FrontendPluginModule[], adapter?: ExtensionHostAdapter): {
    extensionHost: ExtensionHostAdapter | undefined;
    hasCapability: (id: string) => boolean;
    getViewerToolbar: () => ViewerToolbarContribution[];
    getExtensionPanels: () => ThreadPanelContribution[];
    renderExtension: (context: ExtensionRenderContext) => string | number | bigint | boolean | react.ReactElement<unknown, string | react.JSXElementConstructor<any>> | Iterable<react.ReactNode> | Promise<string | number | bigint | boolean | react.ReactPortal | react.ReactElement<unknown, string | react.JSXElementConstructor<any>> | Iterable<react.ReactNode> | null | undefined> | null;
};
type ExtensionPluginApi = ReturnType<typeof createExtensionPluginApi>;

interface PluginProviderAdapter {
    connections?: UpstreamConnectionHost;
    /** Per-conversation plugin switches and settings, when the device supports them. */
    threads?: ThreadPluginAdapter;
    loadPluginSettings?: (pluginId: string) => Promise<PluginSettingsSnapshot>;
    savePluginSettings?: (pluginId: string, settings: PluginSettingsSnapshot) => Promise<PluginSettingsSnapshot>;
    fetchPlugins?: () => Promise<PluginDto[]> | PluginDto[];
    importPlugin?: (input: ImportPluginInput) => Promise<PluginDto> | PluginDto;
    updatePlugin?: (pluginId: string, input: UpdatePluginInput) => Promise<PluginDto> | PluginDto;
    deletePlugin?: (pluginId: string) => Promise<PluginDto> | PluginDto;
}
declare function PluginProvider({ adapter, builtinPlugins, extensionHost, children, }: {
    adapter?: PluginProviderAdapter;
    builtinPlugins?: FrontendPluginModule[];
    extensionHost?: ExtensionHostAdapter;
    children: ReactNode;
}): react.JSX.Element;

interface PluginContextValue {
    extensions?: ExtensionPluginApi;
    plugins: PluginDto[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    importPluginManifest: (input: ImportPluginInput) => Promise<void>;
    setPluginEnabled: (pluginId: string, enabled: boolean) => Promise<void>;
    /** Whether conversations that follow the device have the plugin on. */
    setPluginDefaultEnabled: (pluginId: string, enabled: boolean) => Promise<void>;
    uninstallPlugin: (pluginId: string) => Promise<void>;
    renderArtifact: (context: ArtifactRenderContext) => ReactNode | null;
    renderInlineCode: (context: InlineCodeRenderContext) => ReactNode | null;
    hasRendererForArtifact: (artifact: ThreadArtifactDto) => boolean;
    getThreadPanels: () => ThreadPanelContribution[];
    /** Sections are ids `plugin:<pluginId>:<sectionId>`; pass a plugin id for one plugin's sections. */
    getSettingsSections: (pluginId?: string) => SettingsSection[];
    presentMessage: (context: MessagePresentationContext) => MessagePresentation | null;
    renderActionOutput: (pluginId: string, context: PluginActionOutputContext) => ReactNode | null;
    /** The plugin modules this host ships. */
    modules?: FrontendPluginModule[];
    adapter?: PluginProviderAdapter;
    /** Changes whenever device-wide plugin settings are saved. */
    settingsVersion?: number;
    /** Whether `plugins` reflects the device's answer rather than module defaults. */
    devicePluginsKnown?: boolean;
    /** Inside a conversation scope: the device-wide context, for global management. */
    device?: PluginContextValue;
    /** Inside a conversation scope: its switches and settings. */
    thread?: ThreadPluginScopeState;
}
type ThreadPluginScopeStatus = 'loading' | 'ready' | 'unsupported' | 'forbidden' | 'error';
interface ThreadPluginScopeState {
    threadId: string;
    status: ThreadPluginScopeStatus;
    plugins: ThreadPluginDto[];
    error: string | null;
    /** Per plugin: the last failed change, kept until the next attempt. */
    pluginErrors: Record<string, {
        message: string;
        conflict: boolean;
    }>;
    pending: Record<string, boolean>;
    reload: () => Promise<void>;
    setEnabledOverride: (pluginId: string, enabled: boolean | null) => Promise<void>;
    resetSettings: (pluginId: string) => Promise<void>;
    loadSettings: (pluginId: string) => Promise<ThreadPluginSettingsSnapshot>;
    saveSettings: (pluginId: string, input: ThreadPluginSettingsInput) => Promise<ThreadPluginSettingsSnapshot>;
}
declare function mergePluginState(modules: FrontendPluginModule[], serverPlugins: PluginDto[]): PluginDto[];
declare function createDefaultPluginContextValue(modules?: FrontendPluginModule[], extensionHost?: ExtensionHostAdapter): PluginContextValue;
declare const PluginContext: react.Context<PluginContextValue>;

interface ThreadGraphWorkspacePanelProps {
    detail: ThreadDetailDto;
    status: AgentRuntimeStatusDto | null;
    plugins: PluginContextValue;
    workspaceAdapter?: ThreadWorkspaceAdapter | null;
    metaContent?: ReactNode;
    settingsContent?: ReactNode;
    activeView?: 'chat' | 'shell';
    features?: ThreadGraphWorkspaceFeatures;
    focusPathRequest?: {
        path: string;
        line?: number;
        requestId: number;
        artifactId?: string;
    } | null;
    /** The workspace-relative path of the file being read, or null. */
    onActiveFileChange?: (relativePath: string | null) => void;
    /** Host content shown as extra side-panel tabs, such as a trajectory player. */
    hostPanels?: readonly WorkspaceHostPanel[];
    /** Shows the host panel `id`; each new `requestId` shows it again. */
    hostPanelRequest?: WorkspaceHostPanelRequest | null;
}
/**
 * A host-supplied side-panel tab. It stays mounted while another tab is
 * shown, so its personal state (for example a viewer's camera) is kept.
 */
interface WorkspaceHostPanel {
    /** Stable identity, such as a stream key. */
    id: string;
    label: string;
    /** The tab's tooltip; defaults to the label. */
    title?: string;
    content: ReactNode;
    /** Adds a close button to the tab. */
    onClose?: () => void;
}
interface WorkspaceHostPanelRequest {
    id: string;
    requestId: number;
}
type WorkspaceTab = 'workspace' | 'tools' | 'guide' | 'graph' | 'extensions';
interface ThreadGraphWorkspaceFeatures {
    workspace?: boolean;
    toolUsage?: boolean;
    guide?: boolean;
    threadGraph?: boolean;
    extensions?: boolean;
    defaultTab?: WorkspaceTab;
}
declare function ThreadGraphWorkspacePanel({ detail, status, plugins, workspaceAdapter, metaContent, settingsContent, activeView, features: featureConfig, focusPathRequest, onActiveFileChange, hostPanels, hostPanelRequest, }: ThreadGraphWorkspacePanelProps): react.JSX.Element | null;
declare const MemoizedThreadGraphWorkspacePanel: react.MemoExoticComponent<typeof ThreadGraphWorkspacePanel>;

export { createDefaultPluginContextValue as A, createExtensionPluginApi as B, extensionModuleAvailable as C, type DescribeThread as D, type ExtensionPluginApi as E, mergePluginState as F, ThreadGraphWorkspacePanel as G, MemoizedThreadGraphWorkspacePanel as M, type PromptAttachmentUpload as P, type SettingsSection as S, type ThreadShellControlState as T, type WorkspaceHostPanel as W, type ThreadTimelineAdapter as a, type ThreadShellAdapter as b, type ThreadGraphWorkspacePanelProps as c, type PluginContextValue as d, type ThreadDetailUiAdapter as e, type ThreadGraphWorkspaceFeatures as f, type WorkspaceHostPanelRequest as g, SettingsPanels as h, type ThreadWorkspaceAdapter as i, PluginContext as j, PluginProvider as k, type PluginProviderAdapter as l, type SendPromptInput as m, type ShellSocketConnection as n, type ShellSocketHandlers as o, type ThreadImageAssetVariant as p, type ThreadLinkInfo as q, type ThreadToolArtifact as r, type ThreadWorkspaceArchiveFormat as s, type ThreadWorkspaceCapabilities as t, type ThreadWorkspaceTrashEntry as u, type ThreadWorkspaceTrashList as v, type WorkspaceDocumentSaveInput as w, type WorkspaceDocumentSnapshot as x, type WorkspaceSaveReceipt as y, type WorkspaceTab as z };
