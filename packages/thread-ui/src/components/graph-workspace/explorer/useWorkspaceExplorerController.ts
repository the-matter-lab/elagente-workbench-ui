import { translate, useI18n } from '../../../i18n';
import { relativeWorkspacePath } from '../../workspacePaths';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  AgentRuntimeStatusDto,
  ThreadArtifactDto,
  ThreadDetailDto,
} from '@remote-codex/shared';
import type { ThreadWorkspaceAdapter } from '../../../adapters';
import {
  ancestorDirectoryPaths,
  collectAncestorPaths,
  collectWorkspaceItems,
  findFirstPreviewNode,
  findFirstWorkspaceFile,
  flattenWorkspaceNodes,
  hasWorkspacePath,
  workspaceRelativeFocusPath,
  workspaceTreeNodeToGraphNode,
  type WorkspaceTreeNode,
} from '../workspaceTree';
import {
  createWorkspaceExplorerModel,
  findWorkspaceExplorerNodeByPath,
  hasWorkspaceExplorerPath,
  mergeWorkspaceExplorerSubtree,
  workspaceExplorerModelToTree,
} from './workspaceExplorerModel';
import type {
  WorkspaceExplorerModel,
  WorkspaceExplorerAdapter,
  WorkspaceExplorerCapabilities,
} from './workspaceExplorerTypes';
import { useWorkspaceExplorerPersistence } from './useWorkspaceExplorerPersistence';
import { validateWorkspaceOperationCapabilities } from './workspaceOperationCapabilities';
import { linkedDirectoryNodes, linkedParentDirectory } from './workspaceLinkedFiles';
import {
  isInternalWorkspacePath,
  parentWorkspacePath,
  withoutDotEntries,
} from './workspaceHiddenPaths';

export interface UseWorkspaceExplorerControllerInput {
  activeView: 'chat' | 'shell';
  detail: ThreadDetailDto;
  artifacts: ThreadArtifactDto[];
  status: AgentRuntimeStatusDto | null;
  focusPathRequest?: {
    path: string;
    line?: number;
    requestId: number;
    artifactId?: string;
  } | null;
  workspaceAdapter?: ThreadWorkspaceAdapter | null;
}

function selectedPathForId(
  selectedId: string | null,
  nodeMap: Map<string, WorkspaceTreeNode>,
) {
  if (!selectedId) {
    return null;
  }
  const mappedPath = nodeMap.get(selectedId)?.path;
  if (mappedPath !== undefined) {
    return mappedPath;
  }
  return selectedId.startsWith('workspace:')
    ? selectedId.slice('workspace:'.length)
    : null;
}

export function useWorkspaceExplorerController({
  activeView,
  detail,
  artifacts,
  status,
  focusPathRequest = null,
  workspaceAdapter,
}: UseWorkspaceExplorerControllerInput) {
  const { locale } = useI18n();
  const workspaceIdentity = useMemo(
    () => ({
      threadId: detail.thread.id,
      workspaceId: detail.workspace.id ?? detail.thread.workspaceId ?? null,
    }),
    [detail.thread.id, detail.thread.workspaceId, detail.workspace.id],
  );
  // Show hidden files: a browser preference, offered only by hosts that can list them.
  const hiddenFilesAvailable = workspaceAdapter?.hiddenFiles === true;
  const [showHiddenPreference, setShowHiddenPreference] = useState(() => {
    try { return localStorage.getItem(SHOW_HIDDEN_KEY) === 'true'; } catch { return false; }
  });
  const showHidden = hiddenFilesAvailable && showHiddenPreference;
  // ELA-412: off, the Explorer also leaves out every entry named `.*`.
  const hideDotEntries = hiddenFilesAvailable && !showHidden;
  // Internal thread events (tool calls, reasoning) are a debug view: off unless asked for.
  const [showThreadEvents, setShowThreadEventsPreference] = useState(() => {
    try { return localStorage.getItem(SHOW_THREAD_EVENTS_KEY) === 'true'; } catch { return false; }
  });
  const listIdentity = useMemo(
    () => (showHidden ? { ...workspaceIdentity, showHidden: true } : workspaceIdentity),
    [showHidden, workspaceIdentity],
  );
  const listVisible = useCallback(
    async (path: string) => {
      const listing = await workspaceAdapter!.listTree({ ...listIdentity, path });
      return workspaceTreeNodeToGraphNode(hideDotEntries ? withoutDotEntries(listing) : listing);
    },
    [hideDotEntries, listIdentity, workspaceAdapter],
  );
  const capabilityAdapter = workspaceAdapter as
    | WorkspaceExplorerAdapter
    | null
    | undefined;
  const [capabilityState, setCapabilityState] = useState<{
    adapter: WorkspaceExplorerAdapter;
    threadId: string;
    capabilities: WorkspaceExplorerCapabilities;
  } | null>(null);
  const discoveredCapabilities =
    capabilityState?.adapter === capabilityAdapter &&
    capabilityState?.threadId === workspaceIdentity.threadId
      ? capabilityState.capabilities
      : capabilityAdapter?.getCapabilities
        ? null
        : (capabilityAdapter?.capabilities ?? null);
  const capabilities = useMemo(() => {
    if (!discoveredCapabilities) return null;
    try { return validateWorkspaceOperationCapabilities(discoveredCapabilities); }
    catch { return null; }
  }, [discoveredCapabilities]);
  const [capabilityEpoch, setCapabilityEpoch] = useState(0);
  const [capabilityError, setCapabilityError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setCapabilityState(null);
    setCapabilityError(null);
    if (!capabilityAdapter?.getCapabilities && capabilityAdapter?.capabilities) {
      try { validateWorkspaceOperationCapabilities(capabilityAdapter.capabilities); }
      catch (error) { setCapabilityError(error instanceof Error ? error.message : 'Unsupported workspace capabilities.'); }
    }
    if (capabilityAdapter?.getCapabilities) {
      void (async () => {
        try {
          const result = await capabilityAdapter.getCapabilities!(
            workspaceIdentity.threadId,
          );
          validateWorkspaceOperationCapabilities(result);
          if (!cancelled)
            setCapabilityState({
              adapter: capabilityAdapter,
              threadId: workspaceIdentity.threadId,
              capabilities: result,
            });
        } catch (error) {
          if (!cancelled)
            setCapabilityError(
              error instanceof Error
                ? error.message
                : 'Failed to discover file operations. Refresh the workspace to retry.',
            );
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [capabilityAdapter, workspaceIdentity.threadId, capabilityEpoch]);
  const persistence = useWorkspaceExplorerPersistence(workspaceIdentity);
  const fallbackTree = useMemo(
    () => collectWorkspaceItems(detail, artifacts, status, activeView, { includeThreadEvents: showThreadEvents }),
    [activeView, artifacts, detail, status, locale, showThreadEvents],
  );
  // Published artifacts are not tree rows (ELA-260): never the default selection.
  const fallbackFirstSelectableNode = findFirstPreviewNode({
    ...fallbackTree,
    children: fallbackTree.children.filter((node) => node.id !== 'artifacts'),
  });
  const initialPersistedState = useRef(persistence.read());
  const [adapterModel, setAdapterModel] =
    useState<WorkspaceExplorerModel | null>(null);
  const adapterTree = useMemo(
    () => (adapterModel ? workspaceExplorerModelToTree(adapterModel) : null),
    [adapterModel],
  );
  const [linkedFiles, setLinkedFiles] = useState<WorkspaceTreeNode[]>([]);
  const tree = useMemo(() => {
    // ElAgente: immutable artifacts stay inspectable beside the native workspace files.
    const root = adapterTree
      ? { ...adapterTree, children: [...adapterTree.children, ...fallbackTree.children] }
      : fallbackTree;
    return linkedFiles.length
      ? { ...root, children: [...root.children, ...linkedDirectoryNodes(linkedFiles)] }
      : root;
  }, [adapterTree, fallbackTree, linkedFiles, locale]);
  const nodeMap = useMemo(() => flattenWorkspaceNodes(tree), [tree]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(() => {
    const selectedPath = focusPathRequest
      ? workspaceRelativeFocusPath(
          focusPathRequest.path,
          detail.workspace.absPath,
        )
      : initialPersistedState.current.selectedPath;
    const virtualNode = [...flattenWorkspaceNodes(fallbackTree).values()].find(
      (node) =>
        focusPathRequest?.artifactId !== undefined
          ? node.artifact?.id === focusPathRequest.artifactId
          : node.path === selectedPath,
    );
    return focusPathRequest?.artifactId !== undefined
      ? (virtualNode?.id ?? null)
      : (virtualNode?.id ??
          (selectedPath
            ? `workspace:${selectedPath}`
            : (fallbackFirstSelectableNode?.id ?? null)));
  });
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () =>
      new Set([
        '',
        'artifacts:',
        'thread-events:',
        'live:',
        ...initialPersistedState.current.expandedPaths,
        ...collectAncestorPaths(fallbackFirstSelectableNode?.path ?? ''),
      ]),
  );
  const [filterQuery, setFilterQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'highlight' | 'filter'>(
    () => initialPersistedState.current.filterMode ?? 'filter',
  );
  const [loadingTree, setLoadingTree] = useState(false);
  const [loadingDirectoryPaths, setLoadingDirectoryPaths] = useState<
    Set<string>
  >(() => new Set());
  const [directoryErrors, setDirectoryErrors] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  // A link whose file or folder is not on this device: shown calmly in the
  // viewer with its path, not as a raw error.
  const [missingPath, setMissingPath] = useState<string | null>(null);
  const missingPathRef = useRef(missingPath);
  missingPathRef.current = missingPath;

  const activeNode =
    selectedNodeId === null ? null : (nodeMap.get(selectedNodeId) ?? null);
  const liveNodes = useMemo(
    () => tree.children.find((node) => node.id === 'live')?.children ?? [],
    [tree],
  );

  const adapterModelRef = useRef(adapterModel);
  const nodeMapRef = useRef(nodeMap);
  const treeRef = useRef(tree);
  const activeNodeRef = useRef(activeNode);
  const expandedPathsRef = useRef(expandedPaths);
  const loadingDirectoryPathsRef = useRef(loadingDirectoryPaths);
  const fallbackFirstSelectableNodeRef = useRef(fallbackFirstSelectableNode);
  const fallbackTreeRef = useRef(fallbackTree);
  const artifactFocusRef = useRef<string | null>(null);
  adapterModelRef.current = adapterModel;
  nodeMapRef.current = nodeMap;
  treeRef.current = tree;
  activeNodeRef.current = activeNode;
  expandedPathsRef.current = expandedPaths;
  loadingDirectoryPathsRef.current = loadingDirectoryPaths;
  fallbackFirstSelectableNodeRef.current = fallbackFirstSelectableNode;
  fallbackTreeRef.current = fallbackTree;

  const refreshGenerationRef = useRef(0);
  const focusGenerationRef = useRef(0);
  const focusPendingRef = useRef(false);
  const handledFocusRequestRef = useRef<string | null>(null);
  const workspaceGenerationRef = useRef(0);
  const directoryRequestGenerationsRef = useRef(new Map<string, number>());
  const skipPersistenceWriteRef = useRef(true);
  // ELA-412: a Show hidden files change relists the workspace. A link into a
  // hidden path turned it on and is focused again once relisted; otherwise
  // the current selection is kept if it is still listed.
  const pendingHiddenFocusRef = useRef<string | null>(null);
  const visibilityChangedRef = useRef(false);

  const refreshWorkspaceTree = useCallback(
    async (preferredPath?: string | null) => {
      if (!workspaceAdapter) {
        return;
      }
      const workspaceGeneration = workspaceGenerationRef.current;
      const refreshGeneration = refreshGenerationRef.current + 1;
      refreshGenerationRef.current = refreshGeneration;
      const currentSelectedPath =
        preferredPath ?? activeNodeRef.current?.path ?? null;
      setLoadingTree(true);
      setWorkspaceError(null);
      try {
        const refreshedTree = await listVisible('');
        if (
          workspaceGenerationRef.current !== workspaceGeneration ||
          refreshGenerationRef.current !== refreshGeneration
        ) {
          return;
        }
        const currentModel = adapterModelRef.current;
        let nextModel = createWorkspaceExplorerModel(
          refreshedTree,
          currentModel,
        );
        if (currentModel) {
          const expandedDirectories = [...expandedPathsRef.current]
            .filter((path) => path)
            .sort(
              (left, right) => left.split('/').length - right.split('/').length,
            );
          for (const path of expandedDirectories) {
            const previousNode = findWorkspaceExplorerNodeByPath(
              currentModel,
              path,
            );
            if (
              previousNode?.kind !== 'directory' ||
              previousNode.childrenState !== 'resolved'
            ) {
              continue;
            }
            const refreshedNode = await listVisible(path);
            if (
              workspaceGenerationRef.current !== workspaceGeneration ||
              refreshGenerationRef.current !== refreshGeneration
            ) {
              return;
            }
            nextModel = mergeWorkspaceExplorerSubtree(nextModel, refreshedNode);
          }
        }
        const nextTree = workspaceExplorerModelToTree(nextModel);
        adapterModelRef.current = nextModel;
        setAdapterModel(nextModel);
        const firstFile = findFirstWorkspaceFile(nextTree);
        setSelectedNodeId((current) => {
          const virtualNodes = flattenWorkspaceNodes(fallbackTreeRef.current);
          if (current && virtualNodes.has(current)) return current;
          if (artifactFocusRef.current) return null;
          // A missing link keeps its calm view, with nothing selected.
          if (current === null && missingPathRef.current !== null) return null;
          const fallbackPath =
            currentSelectedPath ??
            selectedPathForId(current, nodeMapRef.current);
          const virtualNode = [...virtualNodes.values()].find(
            (node) => node.path === fallbackPath,
          );
          if (virtualNode) return virtualNode.id;
          if (
            fallbackPath !== null &&
            hasWorkspaceExplorerPath(nextModel, fallbackPath)
          ) {
            return `workspace:${fallbackPath}`;
          }
          return firstFile?.id ?? null;
        });
      } catch (error) {
        if (
          workspaceGenerationRef.current !== workspaceGeneration ||
          refreshGenerationRef.current !== refreshGeneration
        ) {
          return;
        }
        setWorkspaceError(
          error instanceof Error ? error.message : translate("files.failedToLoadWorkspace"),
        );
        setAdapterModel(null);
      } finally {
        if (
          workspaceGenerationRef.current === workspaceGeneration &&
          refreshGenerationRef.current === refreshGeneration
        ) {
          setLoadingTree(false);
        }
      }
    },
    [listVisible, workspaceAdapter],
  );

  const loadDirectoryChildren = useCallback(
    async (path: string) => {
      if (!workspaceAdapter || !adapterModelRef.current) {
        return;
      }
      const workspaceGeneration = workspaceGenerationRef.current;
      const generation =
        (directoryRequestGenerationsRef.current.get(path) ?? 0) + 1;
      directoryRequestGenerationsRef.current.set(path, generation);
      setLoadingDirectoryPaths((current) => {
        if (current.has(path)) {
          return current;
        }
        const next = new Set(current);
        next.add(path);
        return next;
      });
      setWorkspaceError(null);
      setDirectoryErrors((current) => {
        if (!current.has(path)) {
          return current;
        }
        const next = new Map(current);
        next.delete(path);
        return next;
      });
      try {
        const loadedNode = await listVisible(path);
        if (
          workspaceGenerationRef.current !== workspaceGeneration ||
          directoryRequestGenerationsRef.current.get(path) !== generation
        ) {
          return;
        }
        setAdapterModel((current) =>
          current
            ? mergeWorkspaceExplorerSubtree(current, loadedNode)
            : current,
        );
        setDirectoryErrors((current) => {
          if (!current.has(path)) {
            return current;
          }
          const next = new Map(current);
          next.delete(path);
          return next;
        });
      } catch (error) {
        if (
          workspaceGenerationRef.current !== workspaceGeneration ||
          directoryRequestGenerationsRef.current.get(path) !== generation
        ) {
          return;
        }
        const message =
          error instanceof Error ? error.message : translate("files.failedToLoadDirectory");
        setWorkspaceError(message);
        setDirectoryErrors((current) => new Map(current).set(path, message));
      } finally {
        if (
          workspaceGenerationRef.current === workspaceGeneration &&
          directoryRequestGenerationsRef.current.get(path) === generation
        ) {
          setLoadingDirectoryPaths((current) => {
            if (!current.has(path)) {
              return current;
            }
            const next = new Set(current);
            next.delete(path);
            return next;
          });
        }
      }
    },
    [listVisible, workspaceAdapter],
  );

  const setShowHidden = useCallback(
    (value: boolean) => {
      if (!hiddenFilesAvailable) return;
      try { localStorage.setItem(SHOW_HIDDEN_KEY, String(value)); } catch { /* Applies to this page only. */ }
      if (value === showHidden) return;
      visibilityChangedRef.current = true;
      setShowHiddenPreference(value);
    },
    [hiddenFilesAvailable, showHidden],
  );

  /**
   * Opens `path` in the tree. A link into a hidden path turns Show hidden
   * files on first (ELA-412). `restore` keeps the current visibility and,
   * when the path is no longer listed, selects the first listed file.
   */
  const focusWorkspacePath = useCallback(
    async (path: string, { restore = false }: { restore?: boolean } = {}) => {
      artifactFocusRef.current = null;
      const virtualNode = [
        ...flattenWorkspaceNodes(fallbackTreeRef.current).values(),
      ].find((node) => node.path === path && node.kind !== 'directory');
      if (virtualNode) {
        ++focusGenerationRef.current;
        focusPendingRef.current = false;
        setSelectedNodeId(virtualNode.id);
        setFilterQuery('');
        setWorkspaceError(null);
        setExpandedPaths(
          (current) =>
            new Set([...current, ...collectAncestorPaths(virtualNode.path)]),
        );
        return;
      }
      const targetPath = workspaceRelativeFocusPath(
        path,
        detail.workspace.absPath,
      );
      if (!targetPath) {
        return;
      }
      const workspaceGeneration = workspaceGenerationRef.current;
      const generation = ++focusGenerationRef.current;
      ++refreshGenerationRef.current;
      focusPendingRef.current = true;
      const isCurrent = () =>
        workspaceGenerationRef.current === workspaceGeneration &&
        focusGenerationRef.current === generation;
      setSelectedNodeId(`workspace:${targetPath}`);
      setFilterQuery('');
      setMissingPath(null);
      const external = relativeWorkspacePath(path, detail.workspace.absPath) === null;
      const ancestors = external ? [linkedParentDirectory(targetPath)] : ancestorDirectoryPaths(targetPath);
      setExpandedPaths((current) => {
        const next = new Set(current);
        next.add('');
        for (const ancestor of ancestors) {
          next.add(ancestor);
        }
        return next;
      });

      if (!workspaceAdapter) {
        if (hasWorkspacePath(treeRef.current, targetPath)) {
          setSelectedNodeId(`workspace:${targetPath}`);
        }
        return;
      }

      setLoadingTree(true);
      setWorkspaceError(null);
      try {
        let nextModel =
          adapterModelRef.current ??
          createWorkspaceExplorerModel(await listVisible(''));
        if (!isCurrent()) {
          return;
        }
        if (external) {
          if (!workspaceAdapter.statLinkedFile) throw new Error(translate("files.onlyTheDeviceOwnerCanPreviewFiles"));
          const node = await workspaceAdapter.statLinkedFile({...workspaceIdentity, path: targetPath});
          if (!isCurrent()) return;
          const linked = workspaceTreeNodeToGraphNode({
            ...node,
            path: targetPath,
          });
          setLinkedFiles((current) => [
            ...current.filter((item) => item.path !== targetPath),
            linked,
          ]);
          adapterModelRef.current = nextModel;
          setAdapterModel(nextModel);
          return;
        }
        for (const ancestor of ancestors) {
          const existing = findWorkspaceExplorerNodeByPath(nextModel, ancestor);
          // Not in its parent's listing: hidden by default, or absent.
          if (!existing) break;
          if (
            existing.kind === 'directory' &&
            existing.childrenState === 'resolved'
          ) {
            continue;
          }
          const loadedNode = await listVisible(ancestor);
          if (!isCurrent()) {
            return;
          }
          nextModel = mergeWorkspaceExplorerSubtree(nextModel, loadedNode);
        }
        const target = findWorkspaceExplorerNodeByPath(nextModel, targetPath);
        // Not listed: it may be hidden. If a listing with hidden entries has
        // it, turn Show hidden files on and open it from that listing.
        if (!target && !restore && hiddenFilesAvailable && !showHidden && !isInternalWorkspacePath(targetPath)) {
          const hidden = await workspaceAdapter
            .listTree({ ...workspaceIdentity, path: parentWorkspacePath(targetPath), showHidden: true })
            .then(
              (listing) => (listing.children ?? []).some((child) => workspaceTreeNodeToGraphNode(child).path === targetPath),
              () => false,
            );
          if (!isCurrent()) return;
          if (hidden) {
            adapterModelRef.current = nextModel;
            setAdapterModel(nextModel);
            pendingHiddenFocusRef.current = path;
            setShowHidden(true);
            return;
          }
        }
        if (target?.kind === 'directory') {
          const loadedNode = await listVisible(targetPath);
          if (!isCurrent()) return;
          nextModel = mergeWorkspaceExplorerSubtree(nextModel, loadedNode);
          setExpandedPaths(current => new Set(current).add(targetPath));
        }
        adapterModelRef.current = nextModel;
        setAdapterModel(nextModel);
        if (!hasWorkspaceExplorerPath(nextModel, targetPath)) {
          throw new MissingTargetError(translate("files.fileNotFound", { value1: targetPath }));
        }
        setSelectedNodeId(`workspace:${targetPath}`);
      } catch (error) {
        if (!isCurrent()) {
          return;
        }
        if (isMissingTarget(error)) {
          // Never leave a node selected or expanded that the tree does not list.
          const model = adapterModelRef.current;
          if (!external) {
            setExpandedPaths((current) => {
              const next = new Set(current);
              for (const ancestor of ancestors) {
                if (!model || !hasWorkspaceExplorerPath(model, ancestor)) next.delete(ancestor);
              }
              return next;
            });
          }
          if (restore) {
            const firstFile = model ? findFirstWorkspaceFile(workspaceExplorerModelToTree(model)) : null;
            setSelectedNodeId(firstFile?.id ?? fallbackFirstSelectableNodeRef.current?.id ?? null);
            return;
          }
          setSelectedNodeId(null);
          setMissingPath(external ? path : targetPath);
          return;
        }
        setWorkspaceError(
          error instanceof Error
            ? error.message
            : translate("files.failedToOpen", { value1: targetPath }),
        );
      } finally {
        if (isCurrent()) {
          focusPendingRef.current = false;
          setLoadingTree(false);
        }
      }
    },
    [detail.workspace.absPath, hiddenFilesAvailable, listVisible, setShowHidden, showHidden, workspaceAdapter, workspaceIdentity],
  );

  const focusArtifact = useCallback((artifactId: string) => {
    artifactFocusRef.current = artifactId;
    ++focusGenerationRef.current;
    focusPendingRef.current = false;
    const node = [
      ...flattenWorkspaceNodes(fallbackTreeRef.current).values(),
    ].find((value) => value.artifact?.id === artifactId);
    setSelectedNodeId(node?.id ?? null);
    setLoadingTree(false);
    setFilterQuery('');
    setWorkspaceError(node ? null : `Artifact unavailable: ${artifactId}`);
    if (node)
      setExpandedPaths(
        (current) => new Set([...current, ...collectAncestorPaths(node.path)]),
      );
  }, []);

  const toggleDirectory = useCallback(
    (path: string) => {
      if (!path) {
        return;
      }
      const node = nodeMapRef.current.get(`workspace:${path}`);
      const isExpanded = expandedPathsRef.current.has(path);
      const shouldLoad =
        node?.kind === 'directory' &&
        node.hasChildren &&
        !node.childrenLoaded &&
        !loadingDirectoryPathsRef.current.has(path);
      setExpandedPaths((current) => {
        const next = new Set(current);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });
      if (!isExpanded && shouldLoad) {
        void loadDirectoryChildren(path);
      }
    },
    [loadDirectoryChildren],
  );

  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set(['']));
  }, []);

  useEffect(() => {
    setLinkedFiles([]);
    artifactFocusRef.current = null;
    skipPersistenceWriteRef.current = true;
    const persisted = persistence.read();
    const fallbackNode = fallbackFirstSelectableNodeRef.current;
    const selectedPath = focusPathRequest
      ? workspaceRelativeFocusPath(
          focusPathRequest.path,
          detail.workspace.absPath,
        )
      : persisted.selectedPath;
    const virtualNode = [
      ...flattenWorkspaceNodes(fallbackTreeRef.current).values(),
    ].find((node) =>
      focusPathRequest?.artifactId !== undefined
        ? node.artifact?.id === focusPathRequest.artifactId
        : node.path === selectedPath,
    );
    const nextSelectedId =
      focusPathRequest?.artifactId !== undefined
        ? (virtualNode?.id ?? null)
        : (virtualNode?.id ??
          (selectedPath
            ? `workspace:${selectedPath}`
            : (fallbackNode?.id ?? null)));
    setExpandedPaths(
      new Set([
        '',
        'artifacts:',
        'thread-events:',
        'live:',
        ...persisted.expandedPaths,
        ...collectAncestorPaths(fallbackNode?.path ?? ''),
      ]),
    );
    setSelectedNodeId(nextSelectedId);
    setFilterQuery('');
    setFilterMode(persisted.filterMode ?? 'filter');
  }, [persistence]);

  useEffect(() => {
    if (skipPersistenceWriteRef.current) {
      skipPersistenceWriteRef.current = false;
      return;
    }
    persistence.write({
      expandedPaths: [...expandedPaths],
      ...(selectedPathForId(selectedNodeId, nodeMap)
        ? { selectedPath: selectedPathForId(selectedNodeId, nodeMap)! }
        : {}),
      filterMode,
    });
  }, [expandedPaths, filterMode, nodeMap, persistence, selectedNodeId]);

  useEffect(() => {
    if (!workspaceAdapter || !adapterModel || focusPendingRef.current) {
      return;
    }
    for (const node of nodeMap.values()) {
      if (
        node.path &&
        node.kind === 'directory' &&
        expandedPaths.has(node.path) &&
        node.hasChildren &&
        !node.childrenLoaded &&
        !loadingDirectoryPaths.has(node.path) &&
        !directoryErrors.has(node.path)
      ) {
        void loadDirectoryChildren(node.path);
      }
    }
  }, [
    adapterModel,
    directoryErrors,
    expandedPaths,
    loadDirectoryChildren,
    loadingDirectoryPaths,
    nodeMap,
    workspaceAdapter,
  ]);

  useEffect(() => {
    workspaceGenerationRef.current += 1;
    refreshGenerationRef.current += 1;
    directoryRequestGenerationsRef.current.clear();
    adapterModelRef.current = null;
    setAdapterModel(null);
    setLoadingDirectoryPaths(new Set());
    setDirectoryErrors(new Map());
    setWorkspaceError(null);
    const pendingHiddenFocus = pendingHiddenFocusRef.current;
    const visibilityChanged = visibilityChangedRef.current;
    pendingHiddenFocusRef.current = null;
    visibilityChangedRef.current = false;
    // The thread's own link request stays handled across a visibility change.
    if (pendingHiddenFocus !== null) {
      void focusWorkspacePath(pendingHiddenFocus);
      return;
    }
    if (visibilityChanged) {
      const selected = activeNodeRef.current;
      const virtual = selected !== null && flattenWorkspaceNodes(fallbackTreeRef.current).has(selected.id);
      if (selected?.path && !virtual && missingPathRef.current === null) void focusWorkspacePath(selected.path, { restore: true });
      else void refreshWorkspaceTree();
      return;
    }
    handledFocusRequestRef.current = null;
    if (!focusPathRequest || focusPathRequest.artifactId !== undefined) {
      const persistedPath = persistence.read().selectedPath;
      if (persistedPath && !focusPathRequest) {
        const virtual = [
          ...flattenWorkspaceNodes(fallbackTreeRef.current).values(),
        ].some((node) => node.path === persistedPath);
        void focusWorkspacePath(persistedPath);
        if (virtual) void refreshWorkspaceTree();
      } else void refreshWorkspaceTree();
    }
  }, [refreshWorkspaceTree]);

  useEffect(() => {
    if (focusPathRequest) {
      const key = `${workspaceIdentity.threadId}:${focusPathRequest.requestId}`;
      if (handledFocusRequestRef.current === key) return;
      handledFocusRequestRef.current = key;
      if (focusPathRequest.artifactId !== undefined)
        focusArtifact(focusPathRequest.artifactId);
      else void focusWorkspacePath(focusPathRequest.path);
    }
  }, [focusPathRequest, focusWorkspacePath, focusArtifact]);

  useEffect(() => {
    if (!workspaceAdapter?.subscribeWorkspaceChanged) {
      return;
    }
    let refreshTimer: number | null = null;
    const unsubscribe = workspaceAdapter.subscribeWorkspaceChanged(
      workspaceIdentity,
      () => {
        if (refreshTimer !== null) {
          window.clearTimeout(refreshTimer);
        }
        refreshTimer = window.setTimeout(() => {
          refreshTimer = null;
          void refreshWorkspaceTree(activeNodeRef.current?.path ?? null);
        }, 180);
      },
    );
    return () => {
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
      unsubscribe?.();
    };
  }, [refreshWorkspaceTree, workspaceAdapter, workspaceIdentity]);

  return {
    capabilities,
    capabilityError,
    refreshCapabilities: () => setCapabilityEpoch((current) => current + 1),
    activeNode,
    adapterModel,
    collapseAll,
    directoryErrors,
    expandedPaths,
    filterMode,
    filterQuery,
    focusWorkspacePath,
    liveNodes,
    loadingDirectoryPaths,
    loadingTree,
    missingPath,
    nodeMap,
    refreshWorkspaceTree,
    retryDirectory: loadDirectoryChildren,
    selectedNodeId,
    setFilterMode,
    setFilterQuery,
    setLoadingTree,
    setSelectedNodeId: (id: string | null) => {
      artifactFocusRef.current = null;
      ++focusGenerationRef.current;
      ++refreshGenerationRef.current;
      focusPendingRef.current = false;
      setLoadingTree(false);
      setWorkspaceError(null);
      setMissingPath(null);
      setSelectedNodeId(id);
    },
    setWorkspaceError,
    toggleDirectory,
    tree,
    workspaceError,
    workspaceIdentity,
    showHidden: hiddenFilesAvailable ? showHidden : undefined,
    setShowHidden: hiddenFilesAvailable ? setShowHidden : undefined,
    showThreadEvents,
    setShowThreadEvents: (value: boolean) => {
      setShowThreadEventsPreference(value);
      // Hiding the events must not leave a hidden event selected: show a file instead.
      if (!value && selectedNodeId?.startsWith('event:')) setSelectedNodeId(firstNonEventNode(tree)?.id ?? null);
      try { localStorage.setItem(SHOW_THREAD_EVENTS_KEY, String(value)); } catch { /* Applies to this page only. */ }
    },
  };
}

const SHOW_HIDDEN_KEY = 'workbench.explorer.showHidden';
const SHOW_THREAD_EVENTS_KEY = 'workbench.explorer.showThreadEvents';

/** The first file or live artifact a tree row shows, outside the thread-events debug view. */
function firstNonEventNode(node: WorkspaceTreeNode): WorkspaceTreeNode | null {
  if (node.kind === 'file' || node.kind === 'artifact' || node.kind === 'live-artifact') return node;
  // Published artifacts are not tree rows (ELA-260).
  if (node.kind === 'event' || node.id === 'thread-events' || node.id === 'artifacts') return null;
  for (const child of node.children) {
    const found = firstNonEventNode(child);
    if (found) return found;
  }
  return null;
}

class MissingTargetError extends Error {}

/** A linked target that is not there: a workspace path absent from the tree,
    or a file outside it that the Supervisor cannot find. */
function isMissingTarget(error: unknown) {
  if (error instanceof MissingTargetError) return true;
  const code = (error as { code?: unknown; payload?: { code?: unknown } } | null)?.payload?.code ?? (error as { code?: unknown } | null)?.code;
  return code === 'file_unavailable' || (error instanceof Error && /no such file|not found|cannot find/i.test(error.message));
}
