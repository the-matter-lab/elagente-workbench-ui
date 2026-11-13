import { translate, useI18n } from '../../i18n';
import { normalizeFileSystemPath, relativeWorkspacePath } from '../workspacePaths';
import { validateArtifactMetadata } from '@remote-codex/shared';
import type {
  AgentRuntimeStatusDto,
  ThreadArtifactDto,
  ThreadDetailDto,
  ThreadHistoryItemDto,
} from '@remote-codex/shared';
import type {
  ThreadWorkspaceFilePreview,
  ThreadWorkspaceTreeNode,
} from '../../adapters';

interface MoleculeViewerSnapshot {
  content: string[];
  format: string;
  name: string;
  uuid: string;
}

export type WorkspaceNodeKind =
  | 'directory'
  | 'artifact'
  | 'file'
  | 'live-artifact'
  | 'event'
  | 'meta';

export interface WorkspaceTreeNode {
  id: string;
  name: string;
  path: string;
  kind: WorkspaceNodeKind;
  children: WorkspaceTreeNode[];
  artifact?: ThreadArtifactDto;
  item?: ThreadHistoryItemDto;
  preview?: string;
  detail?: string;
  size?: number;
  hasChildren?: boolean;
  childrenLoaded?: boolean;
  truncated?: boolean;
  workspaceNode?: ThreadWorkspaceTreeNode;
  /** Hidden from listings by default (`.workbenchignore`); shown only because a link opened it. */
  hiddenByDefault?: boolean;
}

export const MOLECULAR_EXTENSIONS = new Set([
  'xyz',
  'extxyz',
  'cif',
  'pdb',
  'sdf',
  'mol',
  // Gaussian cube volumetric grids (orbitals, densities, potentials).
  'cube',
  'cub',
]);
export const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
]);
export const PDF_EXTENSIONS = new Set(['pdf']);

export function collectArtifacts(detail: ThreadDetailDto): ThreadArtifactDto[] {
  const artifacts: ThreadArtifactDto[] = [...(detail.artifacts ?? [])];
  const listed = new Set(artifacts.map((artifact) => artifact.id));

  for (const turn of detail.turns) {
    for (const item of turn.items) {
      if (item.kind === 'artifact' && item.artifact && !listed.has(item.artifact.id)) {
        artifacts.push(item.artifact);
      }
    }
  }

  for (const item of detail.liveItems?.items ?? []) {
    if (item.kind === 'artifact' && item.artifact && !listed.has(item.artifact.id)) {
      artifacts.push(item.artifact);
    }
  }

  return artifacts;
}

export function sanitizePathSegment(value: string) {
  return value
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function extensionOf(path: string) {
  return path.split('.').pop()?.toLowerCase() || '';
}

export function fileNameFromPath(path: string) {
  return path.split('/').filter(Boolean).at(-1) ?? path;
}

export function workspaceTreeNodeToGraphNode(
  node: ThreadWorkspaceTreeNode,
): WorkspaceTreeNode {
  const kind: WorkspaceNodeKind =
    node.kind === 'directory' ? 'directory' : 'file';
  // The device API uses "." for the root and "./name" for its children.
  // Explorer lookups and link focus must use the same path representation.
  // Keep absolute linked-file paths intact, including Windows and UNC paths.
  const normalized = normalizeFileSystemPath(node.path);
  const path =
    normalized.startsWith('/') || /^[a-z]:\//i.test(normalized)
      ? normalized
      : (relativeWorkspacePath(normalized, '') ?? normalized);
  const children = (node.children ?? []).map(workspaceTreeNodeToGraphNode);
  return {
    id: `workspace:${path}`,
    name: node.name,
    path,
    kind,
    ...(node.size !== undefined ? { size: node.size } : {}),
    ...(node.hasChildren !== undefined
      ? { hasChildren: node.hasChildren }
      : kind === 'directory'
        ? { hasChildren: children.length > 0 }
        : {}),
    ...(node.childrenLoaded !== undefined
      ? { childrenLoaded: node.childrenLoaded }
      : kind === 'directory'
        ? { childrenLoaded: node.children !== undefined }
        : {}),
    ...(node.truncated !== undefined ? { truncated: node.truncated } : {}),
    workspaceNode: { ...node, path },
    children,
  };
}

export function replaceWorkspaceNodeChildren(
  node: WorkspaceTreeNode,
  targetPath: string,
  children: WorkspaceTreeNode[],
  options: { truncated?: boolean } = {},
): WorkspaceTreeNode {
  if (node.path === targetPath) {
    return {
      ...node,
      children,
      hasChildren: children.length > 0,
      childrenLoaded: true,
      truncated: options.truncated ?? node.truncated,
    };
  }

  if (node.children.length === 0) {
    return node;
  }

  let changed = false;
  const nextChildren = node.children.map((child) => {
    const nextChild = replaceWorkspaceNodeChildren(
      child,
      targetPath,
      children,
      options,
    );
    if (nextChild !== child) {
      changed = true;
    }
    return nextChild;
  });

  return changed ? { ...node, children: nextChildren } : node;
}

export function findFirstWorkspaceFile(
  node: WorkspaceTreeNode,
): WorkspaceTreeNode | null {
  if (node.kind === 'file') {
    return node;
  }
  for (const child of node.children) {
    const found = findFirstWorkspaceFile(child);
    if (found) {
      return found;
    }
  }
  return null;
}

export function findWorkspaceNodeByPath(
  node: WorkspaceTreeNode | null,
  targetPath: string | null,
): WorkspaceTreeNode | null {
  if (!node || targetPath === null) {
    return null;
  }
  if (node.path === targetPath) {
    return node;
  }
  for (const child of node.children) {
    const found = findWorkspaceNodeByPath(child, targetPath);
    if (found) {
      return found;
    }
  }
  return null;
}

export function normalizeWorkspacePath(path: string) {
  return path
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '');
}

export function workspaceRelativeFocusPath(
  path: string,
  workspaceRootPath: string,
) {
  return (
    relativeWorkspacePath(path, workspaceRootPath) ??
    normalizeFileSystemPath(path)
  );
}

export function ancestorDirectoryPaths(path: string) {
  const normalized = normalizeWorkspacePath(path);
  const segments = normalized.split('/').filter(Boolean);
  segments.pop();
  const paths: string[] = [];
  let current = '';
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    paths.push(current);
  }
  return paths;
}

export function replaceWorkspaceNode(
  node: WorkspaceTreeNode,
  targetPath: string,
  replacement: WorkspaceTreeNode,
): WorkspaceTreeNode {
  if (node.path === targetPath) {
    return replacement;
  }
  if (node.children.length === 0) {
    return node;
  }
  let changed = false;
  const children = node.children.map((child) => {
    const next = replaceWorkspaceNode(child, targetPath, replacement);
    if (next !== child) {
      changed = true;
    }
    return next;
  });
  return changed ? { ...node, children } : node;
}

export function hasWorkspacePath(
  node: WorkspaceTreeNode | null,
  targetPath: string | null,
): boolean {
  if (!node || !targetPath) {
    return false;
  }
  if (node.path === targetPath) {
    return true;
  }
  return node.children.some((child) => hasWorkspacePath(child, targetPath));
}

export function buildMoleculePreviewSnapshot(
  file: ThreadWorkspaceFilePreview | null,
): MoleculeViewerSnapshot | null {
  if (!file) {
    return null;
  }
  const extension = extensionOf(file.path);
  if (!MOLECULAR_EXTENSIONS.has(extension)) {
    return null;
  }
  return {
    content: [file.content.endsWith('\n') ? file.content : `${file.content}\n`],
    format:
      extension === 'extxyz' ? 'xyz' : extension === 'cub' ? 'cube' : extension,
    name: file.name,
    uuid: file.path,
  };
}

export function buildMoleculePreviewSource(
  file: ThreadWorkspaceFilePreview | null,
): ThreadArtifactDto | null {
  const snapshot = buildMoleculePreviewSnapshot(file);
  if (!file || !snapshot) {
    return null;
  }
  return {
    id: file.path,
    title: file.name,
    pluginId: 'remote-codex.workspace-molecule-preview',
    type: 'chemistry.molecule3d',
    payload: snapshot,
    createdAt: new Date(0).toISOString(),
  };
}

export function languageForPath(path: string) {
  const extension = extensionOf(path);
  if (extension === 'tsx' || extension === 'jsx') {
    return 'tsx';
  }
  if (extension === 'yml') {
    return 'yaml';
  }
  return extension || 'text';
}

export function ensureDirectory(root: WorkspaceTreeNode, segments: string[]) {
  let current = root;
  let path = root.path;
  for (const segment of segments) {
    path = path ? `${path}/${segment}` : segment;
    let child = current.children.find(
      (node) => node.kind === 'directory' && node.name === segment,
    );
    if (!child) {
      child = {
        id: `dir:${path}`,
        name: segment,
        path,
        kind: 'directory',
        children: [],
      };
      current.children.push(child);
    }
    current = child;
  }
  return current;
}

export function addPathNode(
  root: WorkspaceTreeNode,
  path: string,
  node: WorkspaceTreeNode,
) {
  const segments = path.split('/').filter(Boolean);
  const fileName = segments.pop() ?? node.name;
  const parent = ensureDirectory(root, segments);
  parent.children.push({
    ...node,
    name: node.name || fileName,
    path: root.path ? `${root.path}/${path}` : path,
  });
}

export function compareWorkspaceNodes(
  left: Pick<WorkspaceTreeNode, 'id' | 'path' | 'kind' | 'name'>,
  right: Pick<WorkspaceTreeNode, 'id' | 'path' | 'kind' | 'name'>,
) {
  // Debug events are a virtual sibling of workspace files, never their parent.
  // Keep them after real files as well as real directories.
  const leftEvents = left.id === 'thread-events' && left.path === 'thread-events:';
  const rightEvents = right.id === 'thread-events' && right.path === 'thread-events:';
  if (leftEvents !== rightEvents) return leftEvents ? 1 : -1;
  if (left.kind === 'directory' && right.kind !== 'directory') {
    return -1;
  }
  if (left.kind !== 'directory' && right.kind === 'directory') {
    return 1;
  }
  return left.name.localeCompare(right.name);
}

export function sortWorkspaceTree(node: WorkspaceTreeNode) {
  node.children.sort(compareWorkspaceNodes);
  for (const child of node.children) {
    sortWorkspaceTree(child);
  }
  return node;
}

/** Personal inspector state follows a validated object stream, never an arbitrary file path. */
function artifactNodeIdentity(artifact: ThreadArtifactDto) {
  try {
    const metadata = validateArtifactMetadata(artifact.metadata);
    if (
      metadata.stream &&
      !(artifact as ThreadArtifactDto & { extensionError?: string })
        .extensionError
    )
      return JSON.stringify(['stream', artifact.type, metadata.objectId, metadata.stream.id]);
  } catch {
    /* Invalid metadata stays isolated by immutable artifact identity. */
  }
  return JSON.stringify(['artifact', artifact.id]);
}

export function collectWorkspaceItems(
  detail: ThreadDetailDto,
  artifacts: ThreadArtifactDto[],
  status: AgentRuntimeStatusDto | null,
  activeView: 'chat' | 'shell',
  /** Internal tool/reasoning records are a debug view, not workspace files. */
  { includeThreadEvents = false }: { includeThreadEvents?: boolean } = {},
) {
  const root: WorkspaceTreeNode = {
    id: 'root',
    name: detail.workspace.label ?? translate("files.workspace"),
    path: '',
    kind: 'directory',
    children: [],
  };

  const artifactRoot: WorkspaceTreeNode = {
    id: 'artifacts',
    name: 'artifacts',
    path: 'artifacts:',
    kind: 'directory',
    children: [],
  };

  for (const artifact of artifacts) {
    const title = artifact.title || artifact.id;
    const safeName = sanitizePathSegment(title) || artifact.id;
    const identity = artifactNodeIdentity(artifact);
    const existing = artifactRoot.children.findIndex(
      (node) => node.id === `artifact:${identity}`,
    );
    const node: WorkspaceTreeNode = {
      id: `artifact:${identity}`,
      name: `${safeName}.artifact`,
      path: `artifacts:/${encodeURIComponent(identity)}.artifact`,
      kind: 'artifact',
      artifact,
      preview: artifact.summaryText ?? artifact.type,
      detail: JSON.stringify(artifact.payload, null, 2),
      children: [],
    };
    if (existing < 0) artifactRoot.children.push(node);
    else artifactRoot.children[existing] = node;
  }

  const eventRoot: WorkspaceTreeNode = {
    id: 'thread-events',
    name: 'thread-events',
    path: 'thread-events:',
    kind: 'directory',
    children: [],
  };

  const liveRoot: WorkspaceTreeNode = {
    id: 'live',
    name: 'live',
    path: 'live:',
    kind: 'directory',
    children: [],
  };

  let sequence = 0;
  const addEventNode = (
    turnId: string,
    item: ThreadHistoryItemDto,
    live = false,
  ) => {
    const liveArtifact = live && item.kind === 'artifact' && Boolean(item.artifact);
    if (!includeThreadEvents && !liveArtifact) return;
    sequence += 1;
    const label = item.kind.replace(/([A-Z])/g, '-$1').toLowerCase();
    const eventPath = `${live ? 'live:' : `thread-events:/${turnId}`}/${String(
      sequence,
    ).padStart(3, '0')}-${label}.json`;
    const preview =
      'text' in item && typeof item.text === 'string'
        ? item.text.slice(0, 160)
        : item.kind;
    const artifact =
      item.kind === 'artifact' && item.artifact ? item.artifact : null;
    const node: WorkspaceTreeNode =
      artifact && live
        ? {
            id: `live-artifact:${artifactNodeIdentity(artifact)}`,
            name: artifact.title || artifact.id,
            path: `live:/${encodeURIComponent(artifactNodeIdentity(artifact))}.artifact`,
            kind: 'live-artifact',
            artifact,
            item,
            preview: artifact.summaryText ?? artifact.type,
            detail: JSON.stringify(artifact.payload, null, 2),
            children: [],
          }
        : {
            id: `event:${item.id}`,
            name: fileNameFromPath(eventPath),
            path: eventPath,
            kind: 'event',
            item,
            preview,
            detail: JSON.stringify(item, null, 2),
            children: [],
          };
    if (live) {
      const existing = liveRoot.children.findIndex(
        (value) => value.id === node.id,
      );
      if (existing < 0) liveRoot.children.push(node);
      else liveRoot.children[existing] = node;
      return;
    }
    addPathNode(eventRoot, eventPath.replace(/^thread-events:\//, ''), node);
  };

  for (const turn of detail.turns) {
    for (const item of turn.items) {
      if (
        item.kind === 'commandExecution' ||
        item.kind === 'webSearch' ||
        item.kind === 'fileRead' ||
        item.kind === 'fileChange' ||
        item.kind === 'agentToolCall' ||
        item.kind === 'skillToolCall' ||
        item.kind === 'toolCall' ||
        item.kind === 'hook' ||
        item.kind === 'plan' ||
        item.kind === 'reasoning'
      ) {
        addEventNode(turn.id, item);
      }
    }
  }

  for (const item of detail.liveItems?.items ?? []) {
    addEventNode(detail.thread.activeTurnId ?? 'live', item, true);
  }

  void status;
  void activeView;

  root.children.push(artifactRoot);
  if (includeThreadEvents) root.children.push(eventRoot, liveRoot);
  else if (liveRoot.children.length) root.children.push(liveRoot);
  return sortWorkspaceTree(root);
}

export function flattenWorkspaceNodes(root: WorkspaceTreeNode) {
  const map = new Map<string, WorkspaceTreeNode>();
  const visit = (node: WorkspaceTreeNode) => {
    map.set(node.id, node);
    for (const child of node.children) {
      visit(child);
    }
  };
  visit(root);
  return map;
}

export function findFirstPreviewNode(
  node: WorkspaceTreeNode,
): WorkspaceTreeNode | null {
  if (
    node.kind === 'artifact' ||
    node.kind === 'live-artifact' ||
    node.kind === 'event' ||
    node.kind === 'file'
  ) {
    return node;
  }
  for (const child of node.children) {
    const found = findFirstPreviewNode(child);
    if (found) {
      return found;
    }
  }
  return null;
}

export function collectAncestorPaths(path: string) {
  const segments = path.split('/').filter(Boolean);
  const paths: string[] = [];
  for (let index = 1; index <= segments.length; index += 1) {
    paths.push(segments.slice(0, index).join('/'));
  }
  return paths;
}
