import {
  ConfirmDialog,
  CopyButton,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  MarkdownImageLinkContext,
  PathChip,
  RenameDialog,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  TabScrollButtons,
  WorkspaceFileLink,
  WorkspaceImagePreview,
  ZoomableImage,
  confirmAsync,
  copyText,
  documentListeners,
  documentStores,
  downloadDraft,
  editDraft,
  externalLinkProps,
  getGraphChatHighlighter,
  isProtected,
  markdownHtmlPlugins,
  newDraft,
  settleSave,
  syntaxThemeFor,
  useFilePanel,
  useLongPress,
  useMenuKeyboard,
  useTabScrollEdges
} from "./chunk-SM26PRC3.js";
import {
  GraphMoleculeViewer
} from "./chunk-NQIOS3XP.js";
import "./chunk-R24MQJGW.js";
import {
  DRAWIO_MAX_BYTES,
  downloadOnlyReason,
  isBinaryPreview,
  isDownloadOnlyPath,
  isDrawioPath
} from "./chunk-4LB7J3FW.js";
import {
  IMAGE_EXTENSIONS,
  MOLECULAR_EXTENSIONS,
  PDF_EXTENSIONS,
  ancestorDirectoryPaths,
  buildMoleculePreviewSnapshot,
  collectAncestorPaths,
  collectArtifacts,
  collectWorkspaceItems,
  compareWorkspaceNodes,
  extensionOf,
  findFirstPreviewNode,
  findFirstWorkspaceFile,
  flattenWorkspaceNodes,
  hasWorkspacePath,
  languageForPath,
  localFileHref,
  normalizeFileSystemPath,
  relativeWorkspacePath,
  shellThemeProps,
  useThemeFeature,
  workspaceRelativeFocusPath,
  workspaceTreeNodeToGraphNode
} from "./chunk-LPTBJWOL.js";
import {
  en,
  getLocale,
  translate,
  useI18n
} from "./chunk-S2ZDXRUN.js";

// src/components/ThreadGraphWorkspacePanel.tsx
import { memo as memo2, useEffect as useEffect12, useMemo as useMemo9, useState as useState11 } from "react";
import {
  GitBranch,
  Paperclip,
  Terminal,
  Trash2 as Trash23,
  Wrench,
  X as X5
} from "lucide-react";

// src/components/graph-workspace/explorer/useWorkspaceDocuments.ts
import { useCallback, useEffect, useReducer } from "react";
var listeners = documentListeners;
var notify = () => {
  for (const listener of listeners) listener();
};
function useWorkspaceDocuments(adapter, identity) {
  const source = JSON.stringify([
    adapter?.resourceScopeKey ?? identity.threadId,
    identity.workspaceId
  ]);
  let store = documentStores.get(source);
  if (!store) {
    store = /* @__PURE__ */ new Map();
    documentStores.set(source, store);
  }
  const documents = store;
  function replaceDocument(path, next) {
    const previous = documents.get(path);
    const key = JSON.stringify([source, next.snapshot.workspaceRevision, path]);
    if (previous && previous.key !== key)
      window.dispatchEvent(
        new CustomEvent("workspace-model-release", { detail: previous.key })
      );
    documents.set(path, { ...next, key });
  }
  const [, update] = useReducer((v) => v + 1, 0);
  useEffect(() => {
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  const load = useCallback(
    async (path, signal) => {
      if (!adapter?.readDocument) return null;
      const existing = documents.get(path);
      if (existing) return existing.snapshot;
      const snapshot = await adapter.readDocument({
        ...identity,
        path,
        signal
      });
      if (signal?.aborted) return null;
      if (!documents.has(path)) {
        const all = [...documentStores.values()].flatMap(
          (store2) => [...store2].map(([path2, doc]) => ({ store: store2, path: path2, doc }))
        );
        if (all.length >= 32) {
          const clean = all.find(
            ({ doc }) => !isProtected(doc) && !doc.editing
          );
          if (clean) {
            clean.store.delete(clean.path);
            window.dispatchEvent(
              new CustomEvent("workspace-model-release", {
                detail: clean.doc.key
              })
            );
          } else throw new Error(translate("files.safeDraftBudget"));
        }
        documents.set(
          path,
          newDraft(
            JSON.stringify([source, snapshot.workspaceRevision, path]),
            snapshot
          )
        );
        notify();
      }
      return documents.get(path).snapshot;
    },
    [adapter, documents, identity, source]
  );
  function change(path, content) {
    const doc = documents.get(path);
    if (!doc) return;
    documents.set(path, editDraft(doc, content));
    notify();
  }
  function setEditing(path, editing) {
    const doc = documents.get(path);
    if (!doc) return;
    documents.set(path, { ...doc, editing });
    notify();
  }
  function discard(path) {
    const doc = documents.get(path);
    if (!doc) return true;
    if (doc.phase === "saving" || doc.phase === "unknown") return false;
    documents.delete(path);
    window.dispatchEvent(
      new CustomEvent("workspace-model-release", { detail: doc.key })
    );
    notify();
    return true;
  }
  async function reconcile(path) {
    const doc = documents.get(path);
    if (!doc?.submitted || !adapter?.getSaveOperation) return false;
    try {
      const receipt = await adapter.getSaveOperation({
        ...identity,
        operationId: doc.submitted.operationId
      });
      const current = documents.get(path);
      if (current) replaceDocument(path, settleSave(current, receipt));
      notify();
      return receipt.status === "saved";
    } catch {
      const current = documents.get(path);
      if (current)
        documents.set(path, {
          ...current,
          phase: "unknown",
          error: translate("files.safeUnknown")
        });
      notify();
      return false;
    }
  }
  async function save(path, useConflict = false) {
    const doc = documents.get(path);
    if (!doc || !adapter?.saveDocument || ["saving", "unknown"].includes(doc.phase) || doc.snapshot.readOnlyReason)
      return false;
    const base = useConflict ? doc.conflict : doc.snapshot;
    if (!base?.contentHash || useConflict && base.readOnlyReason)
      return false;
    const operationCreatedAt = Date.now();
    const submitted = {
      content: doc.content,
      revision: doc.revision,
      operationId: crypto.randomUUID()
    };
    documents.set(path, { ...doc, phase: "saving", submitted, error: null });
    notify();
    try {
      const receipt = await adapter.saveDocument({
        ...identity,
        path,
        content: submitted.content,
        draftRevision: submitted.revision,
        operationId: submitted.operationId,
        operationCreatedAt,
        workspaceRevision: base.workspaceRevision,
        fileIdentity: base.fileIdentity,
        expectedHash: base.contentHash
      });
      const current = documents.get(path);
      if (current) replaceDocument(path, settleSave(current, receipt));
      notify();
    } catch (error) {
      const current = documents.get(path);
      if (!current) return false;
      documents.set(path, {
        ...current,
        phase: "unknown",
        error: error instanceof Error ? error.message : translate("files.safeUnknown")
      });
      notify();
      await reconcile(path);
    }
    const latest = documents.get(path);
    return latest?.phase === "clean" && latest.revision === submitted.revision;
  }
  function adoptDisk(path, revision) {
    const doc = documents.get(path);
    const disk = doc?.conflict;
    if (!doc || !disk || disk.content == null || doc.revision !== revision || doc.phase === "saving")
      return;
    replaceDocument(path, {
      ...newDraft(JSON.stringify([source, disk.workspaceRevision, path]), disk),
      revision: doc.revision + 1,
      editing: doc.editing,
      needsVerification: true
    });
    notify();
  }
  async function checkDisk(path) {
    const doc = documents.get(path);
    if (!doc || !adapter?.readDocument || doc.phase === "saving") return;
    const revision = doc.revision;
    try {
      const disk = await adapter.readDocument({ ...identity, path });
      const current = documents.get(path);
      if (!current) return;
      if (current.error) current.error = null;
      if (isProtected(current) || current.revision !== revision) {
        if (current.phase === "unknown" || disk.contentHash !== current.snapshot.contentHash || disk.fileIdentity !== current.snapshot.fileIdentity)
          documents.set(path, {
            ...current,
            phase: current.phase === "unknown" ? "unknown" : "conflict",
            conflict: disk,
            conflictFrom: current.phase === "conflict" && current.conflictFrom === "save" ? "save" : "check"
          });
      } else
        replaceDocument(path, {
          ...newDraft(
            JSON.stringify([source, disk.workspaceRevision, path]),
            disk
          ),
          revision: current.revision + 1,
          editing: current.editing
        });
      notify();
    } catch (error) {
      const current = documents.get(path);
      if (current) {
        documents.set(path, {
          ...current,
          error: error instanceof Error ? error.message : translate("files.safeMissing")
        });
        notify();
      }
    }
  }
  function acceptVerifiedDisk(path) {
    const doc = documents.get(path);
    const disk = doc?.conflict;
    if (!doc || !disk || doc.phase !== "unknown" || doc.operationPending) return;
    replaceDocument(path, {
      ...doc,
      snapshot: disk,
      baseContent: disk.content ?? "",
      submitted: void 0,
      phase: doc.content === disk.content ? "clean" : "dirty",
      conflict: void 0,
      error: null
    });
    notify();
  }
  return {
    documents,
    load,
    change,
    setEditing,
    discard,
    save,
    reconcile,
    adoptDisk,
    checkDisk,
    acceptVerifiedDisk,
    source
  };
}

// src/components/graph-workspace/GraphWorkspaceExplorer.tsx
import { useEffect as useEffect10, useLayoutEffect as useLayoutEffect3, useMemo as useMemo7, useRef as useRef10, useState as useState10 } from "react";

// src/components/graph-workspace/explorer/useWorkspaceExplorerController.ts
import { useCallback as useCallback2, useEffect as useEffect2, useMemo as useMemo2, useRef, useState } from "react";

// src/components/graph-workspace/explorer/workspaceExplorerModel.ts
function sourceWithoutChildren(node) {
  const source = { ...node };
  delete source.children;
  return source;
}
function childrenStateForNode(node) {
  if (node.kind !== "directory") {
    return "resolved";
  }
  if (node.childrenLoaded === true || node.children.length > 0) {
    return "resolved";
  }
  if (node.childrenLoaded === false || node.hasChildren) {
    return "unresolved";
  }
  return "resolved";
}
function copyPreviousSubtree(previous, nodeId, parentId, nodes, pathToId) {
  const previousNode = previous.nodes.get(nodeId);
  if (!previousNode) {
    return;
  }
  const copy = {
    ...previousNode,
    parentId,
    childIds: [...previousNode.childIds]
  };
  nodes.set(copy.id, copy);
  pathToId.set(copy.path, copy.id);
  for (const childId of copy.childIds) {
    copyPreviousSubtree(previous, childId, copy.id, nodes, pathToId);
  }
}
function createWorkspaceExplorerModel(root, previous = null) {
  const nodes = /* @__PURE__ */ new Map();
  const pathToId = /* @__PURE__ */ new Map();
  const visit = (node, parentId) => {
    const previousId = previous?.pathToId.get(node.path);
    const previousNode = previousId ? previous?.nodes.get(previousId) : void 0;
    const incomingChildrenState = childrenStateForNode(node);
    const canPreserveResolvedChildren = node.kind === "directory" && incomingChildrenState === "unresolved" && previousNode?.kind === "directory" && previousNode.childrenState === "resolved";
    const childIds = canPreserveResolvedChildren ? [...previousNode.childIds] : node.children.map((child) => child.id);
    const record = {
      id: node.id,
      parentId,
      name: node.name,
      path: node.path,
      kind: node.kind,
      childIds,
      childrenState: canPreserveResolvedChildren ? "resolved" : incomingChildrenState,
      hasChildren: node.hasChildren ?? (canPreserveResolvedChildren ? previousNode.hasChildren : childIds.length > 0),
      truncated: node.truncated ?? previousNode?.truncated ?? false,
      requestGeneration: previousNode?.requestGeneration ?? 0,
      source: sourceWithoutChildren(node)
    };
    nodes.set(record.id, record);
    pathToId.set(record.path, record.id);
    if (canPreserveResolvedChildren && previous) {
      for (const childId of childIds) {
        copyPreviousSubtree(previous, childId, record.id, nodes, pathToId);
      }
      return;
    }
    for (const child of node.children) {
      visit(child, record.id);
    }
  };
  visit(root, null);
  return { rootId: root.id, nodes, pathToId };
}
function workspaceExplorerModelToTree(model) {
  const visit = (nodeId) => {
    const record = model.nodes.get(nodeId);
    if (!record) {
      throw new Error(translate("files.workspaceExplorerNodeIsMissing", { value1: nodeId }));
    }
    const tree = {
      ...record.source,
      children: record.childIds.map(visit)
    };
    if (record.kind === "directory") {
      tree.childrenLoaded = record.childrenState === "resolved";
      tree.hasChildren = record.hasChildren;
    } else if (record.source.hasChildren !== void 0) {
      tree.hasChildren = record.hasChildren;
    }
    if (record.truncated || record.source.truncated !== void 0) {
      tree.truncated = record.truncated;
    }
    return tree;
  };
  return visit(model.rootId);
}
function findWorkspaceExplorerNodeByPath(model, path) {
  if (!model || path === null) {
    return null;
  }
  const id = model.pathToId.get(path);
  return id ? model.nodes.get(id) ?? null : null;
}
function hasWorkspaceExplorerPath(model, path) {
  return Boolean(model && path !== null && model.pathToId.has(path));
}
function replaceTreeNodeByPath(node, path, replacement) {
  if (node.path === path) {
    return replacement;
  }
  let changed = false;
  const children = node.children.map((child) => {
    const next = replaceTreeNodeByPath(child, path, replacement);
    changed ||= next !== child;
    return next;
  });
  return changed ? { ...node, children } : node;
}
function mergeWorkspaceExplorerSubtree(model, subtree) {
  const existing = findWorkspaceExplorerNodeByPath(model, subtree.path);
  if (!existing) {
    return model;
  }
  subtree = { ...subtree, id: existing.id, name: existing.name, path: existing.path };
  const root = workspaceExplorerModelToTree(model);
  return createWorkspaceExplorerModel(
    replaceTreeNodeByPath(root, subtree.path, subtree),
    model
  );
}

// src/components/graph-workspace/explorer/useWorkspaceExplorerPersistence.ts
import { useMemo } from "react";
var STORAGE_PREFIX = "remote-codex:graphchat:workspace:expanded:";
var MAX_PERSISTED_EXPANDED_PATHS = 500;
function storageKey(identity) {
  return `${STORAGE_PREFIX}${identity.workspaceId ?? "workspace"}:${identity.threadId}`;
}
function readWorkspaceExplorerState(identity) {
  const fallback = {
    version: 2,
    expandedPaths: []
  };
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(storageKey(identity));
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return {
        version: 2,
        expandedPaths: parsed.filter((value) => typeof value === "string").slice(0, MAX_PERSISTED_EXPANDED_PATHS)
      };
    }
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }
    const candidate = parsed;
    if (candidate.version !== 2 || !Array.isArray(candidate.expandedPaths)) {
      return fallback;
    }
    const selectedPath = typeof candidate.selectedPath === "string" ? candidate.selectedPath : void 0;
    const filterMode = candidate.filterMode === "filter" || candidate.filterMode === "highlight" ? candidate.filterMode : void 0;
    return {
      version: 2,
      expandedPaths: candidate.expandedPaths.filter((value) => typeof value === "string").slice(0, MAX_PERSISTED_EXPANDED_PATHS),
      ...selectedPath ? { selectedPath } : {},
      ...filterMode ? { filterMode } : {}
    };
  } catch {
    return fallback;
  }
}
function writeWorkspaceExplorerState(identity, state) {
  if (typeof window === "undefined") {
    return;
  }
  const expandedPaths = [...new Set(state.expandedPaths)].filter((path) => path.length > 0).slice(0, MAX_PERSISTED_EXPANDED_PATHS);
  const value = {
    version: 2,
    expandedPaths,
    ...state.selectedPath ? { selectedPath: state.selectedPath } : {},
    ...state.filterMode ? { filterMode: state.filterMode } : {}
  };
  try {
    window.localStorage.setItem(storageKey(identity), JSON.stringify(value));
  } catch {
  }
}
function useWorkspaceExplorerPersistence(identity) {
  useI18n();
  return useMemo(
    () => ({
      key: storageKey(identity),
      read: () => readWorkspaceExplorerState(identity),
      write: (state) => writeWorkspaceExplorerState(identity, state)
    }),
    [identity]
  );
}

// src/components/graph-workspace/explorer/workspaceOperationCapabilities.ts
function validateWorkspaceOperationCapabilities(capabilities) {
  const { archives, trash } = capabilities;
  if (archives !== void 0 && (archives.version !== 1 || !Array.isArray(archives.formats) || archives.formats.length > 2 || archives.formats.some((format) => format !== "tar" && format !== "zip") || new Set(archives.formats).size !== archives.formats.length)) {
    throw new Error(
      "Archive capability is unsupported. Refresh the workspace to retry discovery."
    );
  }
  if (trash !== void 0 && (trash.version !== 1 || ["files", "restore", "empty"].some(
    (key) => typeof trash[key] !== "boolean"
  ))) {
    throw new Error(
      "Trash capability is unsupported. Refresh the workspace to retry discovery."
    );
  }
  return capabilities;
}
function workspaceArchiveFormats(capabilities, operation) {
  if (!capabilities) return [];
  try {
    validateWorkspaceOperationCapabilities(capabilities);
  } catch {
    return [];
  }
  if (capabilities.archives) return capabilities.archives.formats;
  return (operation === "import" ? capabilities.archiveImport : capabilities.download.directory) === "tar" ? ["tar"] : [];
}
function workspaceTrashCapabilities(capabilities) {
  if (!capabilities) return null;
  try {
    validateWorkspaceOperationCapabilities(capabilities);
  } catch {
    return null;
  }
  return capabilities.trash ?? null;
}

// src/components/graph-workspace/explorer/workspaceLinkedFiles.ts
var LINKED_DIRECTORY_ID_PREFIX = "linked-dir:";
function linkedParentDirectory(path) {
  const index = path.lastIndexOf("/");
  const parent = index >= 0 ? path.slice(0, index) : "";
  if (/^[a-z]:$/i.test(parent)) return `${parent}/`;
  return parent || "/";
}
function linkedDirectoryNodes(files) {
  const groups = /* @__PURE__ */ new Map();
  for (const file of files) {
    const parent = linkedParentDirectory(file.path);
    groups.set(parent, [...groups.get(parent) ?? [], file]);
  }
  return [...groups].map(([parent, children]) => ({
    id: `${LINKED_DIRECTORY_ID_PREFIX}${parent}`,
    name: parent,
    path: parent,
    kind: "directory",
    children: [...children].sort((left, right) => left.name.localeCompare(right.name)),
    childrenLoaded: true,
    hasChildren: true
  }));
}

// src/components/graph-workspace/explorer/workspaceHiddenPaths.ts
function isInternalWorkspacePath(path) {
  return path.split("/").some((segment) => segment.startsWith(".elagente"));
}
function parentWorkspacePath(path) {
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}
function markHidden(node) {
  return { ...node, hiddenByDefault: true, children: node.children.map(markHidden) };
}
async function resolveHiddenChain(listHidden, targetPath, firstHiddenPath, isCurrent) {
  const chain = [...ancestorDirectoryPaths(targetPath), targetPath];
  const start = chain.indexOf(firstHiddenPath);
  if (start < 0 || isInternalWorkspacePath(targetPath)) return null;
  const nodes = [];
  try {
    for (const path of chain.slice(start)) {
      const listing = await listHidden(parentWorkspacePath(path));
      if (!isCurrent()) return null;
      const entry = (listing.children ?? []).map(workspaceTreeNodeToGraphNode).find((child) => child.path === path);
      if (!entry || path !== targetPath && entry.kind !== "directory") return null;
      nodes.push({ ...entry, children: [] });
    }
    const leaf = nodes.at(-1);
    if (leaf.kind === "directory") {
      const listing = workspaceTreeNodeToGraphNode(await listHidden(targetPath));
      if (!isCurrent()) return null;
      nodes[nodes.length - 1] = {
        ...leaf,
        children: listing.children,
        childrenLoaded: true,
        hasChildren: listing.children.length > 0
      };
    }
  } catch {
    return null;
  }
  let node = nodes.at(-1);
  for (let index = nodes.length - 2; index >= 0; index -= 1) {
    node = { ...nodes[index], children: [node], childrenLoaded: true, hasChildren: true };
  }
  return { targetPath, node: markHidden(node) };
}
function insertNode(tree, parentPath, node) {
  if (tree.path === parentPath) {
    const existing = tree.children.find((child) => child.path === node.path);
    if (!existing) {
      return { ...tree, children: [...tree.children, node].sort(compareWorkspaceNodes) };
    }
    if (existing.kind !== "directory" || node.kind !== "directory") return tree;
    let merged = existing;
    for (const child of node.children) merged = insertNode(merged, node.path, child);
    return merged === existing ? tree : { ...tree, children: tree.children.map((child) => child === existing ? merged : child) };
  }
  const next = tree.children.find(
    (child) => child.kind === "directory" && (parentPath === child.path || parentPath.startsWith(`${child.path}/`))
  );
  if (!next) return tree;
  const updated = insertNode(next, parentPath, node);
  return updated === next ? tree : { ...tree, children: tree.children.map((child) => child === next ? updated : child) };
}
function withRevealedHiddenPaths(tree, revealed) {
  let next = tree;
  for (const entry of revealed) {
    next = insertNode(next, parentWorkspacePath(entry.node.path), entry.node);
  }
  return next;
}
function hasRevealedHiddenPath(revealed, path) {
  if (path === null) return false;
  const visit = (node) => node.path === path || node.children.some(visit);
  return revealed.some((entry) => visit(entry.node));
}

// src/components/graph-workspace/explorer/useWorkspaceExplorerController.ts
function selectedPathForId(selectedId, nodeMap) {
  if (!selectedId) {
    return null;
  }
  const mappedPath = nodeMap.get(selectedId)?.path;
  if (mappedPath !== void 0) {
    return mappedPath;
  }
  return selectedId.startsWith("workspace:") ? selectedId.slice("workspace:".length) : null;
}
function useWorkspaceExplorerController({
  activeView,
  detail,
  artifacts,
  status,
  focusPathRequest = null,
  workspaceAdapter
}) {
  const { locale } = useI18n();
  const workspaceIdentity = useMemo2(
    () => ({
      threadId: detail.thread.id,
      workspaceId: detail.workspace.id ?? detail.thread.workspaceId ?? null
    }),
    [detail.thread.id, detail.thread.workspaceId, detail.workspace.id]
  );
  const hiddenFilesAvailable = workspaceAdapter?.hiddenFiles === true;
  const [showHiddenPreference, setShowHiddenPreference] = useState(() => {
    try {
      return localStorage.getItem(SHOW_HIDDEN_KEY) === "true";
    } catch {
      return false;
    }
  });
  const showHidden = hiddenFilesAvailable && showHiddenPreference;
  const [showThreadEvents, setShowThreadEventsPreference] = useState(() => {
    try {
      return localStorage.getItem(SHOW_THREAD_EVENTS_KEY) === "true";
    } catch {
      return false;
    }
  });
  const listIdentity = useMemo2(
    () => showHidden ? { ...workspaceIdentity, showHidden: true } : workspaceIdentity,
    [showHidden, workspaceIdentity]
  );
  const capabilityAdapter = workspaceAdapter;
  const [capabilityState, setCapabilityState] = useState(null);
  const discoveredCapabilities = capabilityState?.adapter === capabilityAdapter && capabilityState?.threadId === workspaceIdentity.threadId ? capabilityState.capabilities : capabilityAdapter?.getCapabilities ? null : capabilityAdapter?.capabilities ?? null;
  const capabilities = useMemo2(() => {
    if (!discoveredCapabilities) return null;
    try {
      return validateWorkspaceOperationCapabilities(discoveredCapabilities);
    } catch {
      return null;
    }
  }, [discoveredCapabilities]);
  const [capabilityEpoch, setCapabilityEpoch] = useState(0);
  const [capabilityError, setCapabilityError] = useState(null);
  useEffect2(() => {
    let cancelled = false;
    setCapabilityState(null);
    setCapabilityError(null);
    if (!capabilityAdapter?.getCapabilities && capabilityAdapter?.capabilities) {
      try {
        validateWorkspaceOperationCapabilities(capabilityAdapter.capabilities);
      } catch (error) {
        setCapabilityError(error instanceof Error ? error.message : "Unsupported workspace capabilities.");
      }
    }
    if (capabilityAdapter?.getCapabilities) {
      void (async () => {
        try {
          const result = await capabilityAdapter.getCapabilities(
            workspaceIdentity.threadId
          );
          validateWorkspaceOperationCapabilities(result);
          if (!cancelled)
            setCapabilityState({
              adapter: capabilityAdapter,
              threadId: workspaceIdentity.threadId,
              capabilities: result
            });
        } catch (error) {
          if (!cancelled)
            setCapabilityError(
              error instanceof Error ? error.message : "Failed to discover file operations. Refresh the workspace to retry."
            );
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [capabilityAdapter, workspaceIdentity.threadId, capabilityEpoch]);
  const persistence = useWorkspaceExplorerPersistence(workspaceIdentity);
  const fallbackTree = useMemo2(
    () => collectWorkspaceItems(detail, artifacts, status, activeView, { includeThreadEvents: showThreadEvents }),
    [activeView, artifacts, detail, status, locale, showThreadEvents]
  );
  const fallbackFirstSelectableNode = findFirstPreviewNode({
    ...fallbackTree,
    children: fallbackTree.children.filter((node) => node.id !== "artifacts")
  });
  const initialPersistedState = useRef(persistence.read());
  const [adapterModel, setAdapterModel] = useState(null);
  const adapterTree = useMemo2(
    () => adapterModel ? workspaceExplorerModelToTree(adapterModel) : null,
    [adapterModel]
  );
  const [linkedFiles, setLinkedFiles] = useState([]);
  const [revealedHidden, setRevealedHidden] = useState([]);
  const revealedHiddenRef = useRef(revealedHidden);
  revealedHiddenRef.current = revealedHidden;
  const tree = useMemo2(() => {
    const listed = adapterTree && revealedHidden.length ? withRevealedHiddenPaths(adapterTree, revealedHidden) : adapterTree;
    const root = listed ? { ...listed, children: [...listed.children, ...fallbackTree.children] } : fallbackTree;
    return linkedFiles.length ? { ...root, children: [...root.children, ...linkedDirectoryNodes(linkedFiles)] } : root;
  }, [adapterTree, fallbackTree, linkedFiles, revealedHidden, locale]);
  const nodeMap = useMemo2(() => flattenWorkspaceNodes(tree), [tree]);
  const [selectedNodeId, setSelectedNodeId] = useState(() => {
    const selectedPath = focusPathRequest ? workspaceRelativeFocusPath(
      focusPathRequest.path,
      detail.workspace.absPath
    ) : initialPersistedState.current.selectedPath;
    const virtualNode = [...flattenWorkspaceNodes(fallbackTree).values()].find(
      (node) => focusPathRequest?.artifactId !== void 0 ? node.artifact?.id === focusPathRequest.artifactId : node.path === selectedPath
    );
    return focusPathRequest?.artifactId !== void 0 ? virtualNode?.id ?? null : virtualNode?.id ?? (selectedPath ? `workspace:${selectedPath}` : fallbackFirstSelectableNode?.id ?? null);
  });
  const [expandedPaths, setExpandedPaths] = useState(
    () => /* @__PURE__ */ new Set([
      "",
      "artifacts:",
      "thread-events:",
      "live:",
      ...initialPersistedState.current.expandedPaths,
      ...collectAncestorPaths(fallbackFirstSelectableNode?.path ?? "")
    ])
  );
  const [filterQuery, setFilterQuery] = useState("");
  const [filterMode, setFilterMode] = useState(
    () => initialPersistedState.current.filterMode ?? "filter"
  );
  const [loadingTree, setLoadingTree] = useState(false);
  const [loadingDirectoryPaths, setLoadingDirectoryPaths] = useState(() => /* @__PURE__ */ new Set());
  const [directoryErrors, setDirectoryErrors] = useState(
    () => /* @__PURE__ */ new Map()
  );
  const [workspaceError, setWorkspaceError] = useState(null);
  const [missingPath, setMissingPath] = useState(null);
  const activeNode = selectedNodeId === null ? null : nodeMap.get(selectedNodeId) ?? null;
  const liveNodes = useMemo2(
    () => tree.children.find((node) => node.id === "live")?.children ?? [],
    [tree]
  );
  const adapterModelRef = useRef(adapterModel);
  const nodeMapRef = useRef(nodeMap);
  const treeRef = useRef(tree);
  const activeNodeRef = useRef(activeNode);
  const expandedPathsRef = useRef(expandedPaths);
  const loadingDirectoryPathsRef = useRef(loadingDirectoryPaths);
  const fallbackFirstSelectableNodeRef = useRef(fallbackFirstSelectableNode);
  const fallbackTreeRef = useRef(fallbackTree);
  const artifactFocusRef = useRef(null);
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
  const handledFocusRequestRef = useRef(null);
  const workspaceGenerationRef = useRef(0);
  const directoryRequestGenerationsRef = useRef(/* @__PURE__ */ new Map());
  const skipPersistenceWriteRef = useRef(true);
  const refreshWorkspaceTree = useCallback2(
    async (preferredPath) => {
      if (!workspaceAdapter) {
        return;
      }
      const workspaceGeneration = workspaceGenerationRef.current;
      const refreshGeneration = refreshGenerationRef.current + 1;
      refreshGenerationRef.current = refreshGeneration;
      const currentSelectedPath = preferredPath ?? activeNodeRef.current?.path ?? null;
      setLoadingTree(true);
      setWorkspaceError(null);
      try {
        const refreshedTree = workspaceTreeNodeToGraphNode(
          await workspaceAdapter.listTree({ ...listIdentity, path: "" })
        );
        if (workspaceGenerationRef.current !== workspaceGeneration || refreshGenerationRef.current !== refreshGeneration) {
          return;
        }
        const currentModel = adapterModelRef.current;
        let nextModel = createWorkspaceExplorerModel(
          refreshedTree,
          currentModel
        );
        if (currentModel) {
          const expandedDirectories = [...expandedPathsRef.current].filter((path) => path).sort(
            (left, right) => left.split("/").length - right.split("/").length
          );
          for (const path of expandedDirectories) {
            const previousNode = findWorkspaceExplorerNodeByPath(
              currentModel,
              path
            );
            if (previousNode?.kind !== "directory" || previousNode.childrenState !== "resolved") {
              continue;
            }
            const refreshedNode = workspaceTreeNodeToGraphNode(
              await workspaceAdapter.listTree({ ...listIdentity, path })
            );
            if (workspaceGenerationRef.current !== workspaceGeneration || refreshGenerationRef.current !== refreshGeneration) {
              return;
            }
            nextModel = mergeWorkspaceExplorerSubtree(nextModel, refreshedNode);
          }
        }
        let revealed = revealedHiddenRef.current;
        if (revealed.length && !showHidden) {
          const kept = [];
          for (const entry of revealed) {
            try {
              const listing = await workspaceAdapter.listTree({
                ...workspaceIdentity,
                path: parentWorkspacePath(entry.targetPath),
                showHidden: true
              });
              if (workspaceGenerationRef.current !== workspaceGeneration || refreshGenerationRef.current !== refreshGeneration) {
                return;
              }
              if ((listing.children ?? []).some(
                (child) => workspaceTreeNodeToGraphNode(child).path === entry.targetPath
              )) {
                kept.push(entry);
              }
            } catch {
            }
          }
          if (kept.length !== revealed.length) {
            revealed = kept;
            revealedHiddenRef.current = kept;
            setRevealedHidden(kept);
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
          const fallbackPath = currentSelectedPath ?? selectedPathForId(current, nodeMapRef.current);
          const virtualNode = [...virtualNodes.values()].find(
            (node) => node.path === fallbackPath
          );
          if (virtualNode) return virtualNode.id;
          if (fallbackPath !== null && (hasWorkspaceExplorerPath(nextModel, fallbackPath) || hasRevealedHiddenPath(revealed, fallbackPath))) {
            return `workspace:${fallbackPath}`;
          }
          return firstFile?.id ?? null;
        });
      } catch (error) {
        if (workspaceGenerationRef.current !== workspaceGeneration || refreshGenerationRef.current !== refreshGeneration) {
          return;
        }
        setWorkspaceError(
          error instanceof Error ? error.message : translate("files.failedToLoadWorkspace")
        );
        setAdapterModel(null);
      } finally {
        if (workspaceGenerationRef.current === workspaceGeneration && refreshGenerationRef.current === refreshGeneration) {
          setLoadingTree(false);
        }
      }
    },
    [listIdentity, showHidden, workspaceAdapter, workspaceIdentity]
  );
  const loadDirectoryChildren = useCallback2(
    async (path) => {
      if (!workspaceAdapter || !adapterModelRef.current) {
        return;
      }
      const workspaceGeneration = workspaceGenerationRef.current;
      const generation = (directoryRequestGenerationsRef.current.get(path) ?? 0) + 1;
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
        const loadedNode = workspaceTreeNodeToGraphNode(
          await workspaceAdapter.listTree({ ...listIdentity, path })
        );
        if (workspaceGenerationRef.current !== workspaceGeneration || directoryRequestGenerationsRef.current.get(path) !== generation) {
          return;
        }
        setAdapterModel(
          (current) => current ? mergeWorkspaceExplorerSubtree(current, loadedNode) : current
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
        if (workspaceGenerationRef.current !== workspaceGeneration || directoryRequestGenerationsRef.current.get(path) !== generation) {
          return;
        }
        const message = error instanceof Error ? error.message : translate("files.failedToLoadDirectory");
        setWorkspaceError(message);
        setDirectoryErrors((current) => new Map(current).set(path, message));
      } finally {
        if (workspaceGenerationRef.current === workspaceGeneration && directoryRequestGenerationsRef.current.get(path) === generation) {
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
    [listIdentity, workspaceAdapter, workspaceIdentity]
  );
  const focusWorkspacePath = useCallback2(
    async (path) => {
      artifactFocusRef.current = null;
      const virtualNode = [
        ...flattenWorkspaceNodes(fallbackTreeRef.current).values()
      ].find((node) => node.path === path && node.kind !== "directory");
      if (virtualNode) {
        ++focusGenerationRef.current;
        focusPendingRef.current = false;
        setSelectedNodeId(virtualNode.id);
        setFilterQuery("");
        setWorkspaceError(null);
        setExpandedPaths(
          (current) => /* @__PURE__ */ new Set([...current, ...collectAncestorPaths(virtualNode.path)])
        );
        return;
      }
      const targetPath = workspaceRelativeFocusPath(
        path,
        detail.workspace.absPath
      );
      if (!targetPath) {
        return;
      }
      const workspaceGeneration = workspaceGenerationRef.current;
      const generation = ++focusGenerationRef.current;
      ++refreshGenerationRef.current;
      focusPendingRef.current = true;
      const isCurrent = () => workspaceGenerationRef.current === workspaceGeneration && focusGenerationRef.current === generation;
      setSelectedNodeId(`workspace:${targetPath}`);
      setFilterQuery("");
      setMissingPath(null);
      const external = relativeWorkspacePath(path, detail.workspace.absPath) === null;
      const ancestors = external ? [linkedParentDirectory(targetPath)] : ancestorDirectoryPaths(targetPath);
      setExpandedPaths((current) => {
        const next = new Set(current);
        next.add("");
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
        let nextModel = adapterModelRef.current ?? createWorkspaceExplorerModel(
          workspaceTreeNodeToGraphNode(
            await workspaceAdapter.listTree({
              ...listIdentity,
              path: ""
            })
          )
        );
        if (!isCurrent()) {
          return;
        }
        if (external) {
          if (!workspaceAdapter.statLinkedFile) throw new Error(translate("files.onlyTheDeviceOwnerCanPreviewFiles"));
          const node = await workspaceAdapter.statLinkedFile({ ...workspaceIdentity, path: targetPath });
          if (!isCurrent()) return;
          const linked = workspaceTreeNodeToGraphNode({
            ...node,
            path: targetPath
          });
          setLinkedFiles((current) => [
            ...current.filter((item) => item.path !== targetPath),
            linked
          ]);
          adapterModelRef.current = nextModel;
          setAdapterModel(nextModel);
          return;
        }
        for (const ancestor of ancestors) {
          const existing = findWorkspaceExplorerNodeByPath(nextModel, ancestor);
          if (!existing) break;
          if (existing.kind === "directory" && existing.childrenState === "resolved") {
            continue;
          }
          const loadedNode = workspaceTreeNodeToGraphNode(
            await workspaceAdapter.listTree({
              ...listIdentity,
              path: ancestor
            })
          );
          if (!isCurrent()) {
            return;
          }
          nextModel = mergeWorkspaceExplorerSubtree(nextModel, loadedNode);
        }
        const target = findWorkspaceExplorerNodeByPath(nextModel, targetPath);
        let revealed = null;
        if (!target && hiddenFilesAvailable && !showHidden && !isInternalWorkspacePath(targetPath)) {
          const firstHiddenPath = [...ancestors, targetPath].find(
            (candidate) => !hasWorkspaceExplorerPath(nextModel, candidate)
          );
          revealed = await resolveHiddenChain(
            (directory) => workspaceAdapter.listTree({ ...workspaceIdentity, path: directory, showHidden: true }),
            targetPath,
            firstHiddenPath,
            isCurrent
          );
          if (!isCurrent()) return;
        }
        if (target?.kind === "directory") {
          const loadedNode = workspaceTreeNodeToGraphNode(await workspaceAdapter.listTree({ ...listIdentity, path: targetPath }));
          if (!isCurrent()) return;
          nextModel = mergeWorkspaceExplorerSubtree(nextModel, loadedNode);
          setExpandedPaths((current) => new Set(current).add(targetPath));
        }
        adapterModelRef.current = nextModel;
        setAdapterModel(nextModel);
        if (revealed) {
          const entry = revealed;
          setRevealedHidden((current) => [
            ...current.filter((item) => item.targetPath !== targetPath),
            entry
          ]);
          if (flattenWorkspaceNodes(entry.node).get(`workspace:${targetPath}`)?.kind === "directory") {
            setExpandedPaths((current) => new Set(current).add(targetPath));
          }
        } else if (!hasWorkspaceExplorerPath(nextModel, targetPath)) {
          throw new MissingTargetError(translate("files.fileNotFound", { value1: targetPath }));
        }
        setSelectedNodeId(`workspace:${targetPath}`);
      } catch (error) {
        if (!isCurrent()) {
          return;
        }
        if (isMissingTarget(error)) {
          setMissingPath(external ? path : targetPath);
          return;
        }
        setWorkspaceError(
          error instanceof Error ? error.message : translate("files.failedToOpen", { value1: targetPath })
        );
      } finally {
        if (isCurrent()) {
          focusPendingRef.current = false;
          setLoadingTree(false);
        }
      }
    },
    [detail.workspace.absPath, hiddenFilesAvailable, listIdentity, showHidden, workspaceAdapter, workspaceIdentity]
  );
  const focusArtifact = useCallback2((artifactId) => {
    artifactFocusRef.current = artifactId;
    ++focusGenerationRef.current;
    focusPendingRef.current = false;
    const node = [
      ...flattenWorkspaceNodes(fallbackTreeRef.current).values()
    ].find((value) => value.artifact?.id === artifactId);
    setSelectedNodeId(node?.id ?? null);
    setLoadingTree(false);
    setFilterQuery("");
    setWorkspaceError(node ? null : `Artifact unavailable: ${artifactId}`);
    if (node)
      setExpandedPaths(
        (current) => /* @__PURE__ */ new Set([...current, ...collectAncestorPaths(node.path)])
      );
  }, []);
  const toggleDirectory = useCallback2(
    (path) => {
      if (!path) {
        return;
      }
      const node = nodeMapRef.current.get(`workspace:${path}`);
      const isExpanded = expandedPathsRef.current.has(path);
      const shouldLoad = node?.kind === "directory" && node.hasChildren && !node.childrenLoaded && !loadingDirectoryPathsRef.current.has(path);
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
    [loadDirectoryChildren]
  );
  const collapseAll = useCallback2(() => {
    setExpandedPaths(/* @__PURE__ */ new Set([""]));
  }, []);
  useEffect2(() => {
    setLinkedFiles([]);
    setRevealedHidden([]);
    artifactFocusRef.current = null;
    skipPersistenceWriteRef.current = true;
    const persisted = persistence.read();
    const fallbackNode = fallbackFirstSelectableNodeRef.current;
    const selectedPath = focusPathRequest ? workspaceRelativeFocusPath(
      focusPathRequest.path,
      detail.workspace.absPath
    ) : persisted.selectedPath;
    const virtualNode = [
      ...flattenWorkspaceNodes(fallbackTreeRef.current).values()
    ].find(
      (node) => focusPathRequest?.artifactId !== void 0 ? node.artifact?.id === focusPathRequest.artifactId : node.path === selectedPath
    );
    const nextSelectedId = focusPathRequest?.artifactId !== void 0 ? virtualNode?.id ?? null : virtualNode?.id ?? (selectedPath ? `workspace:${selectedPath}` : fallbackNode?.id ?? null);
    setExpandedPaths(
      /* @__PURE__ */ new Set([
        "",
        "artifacts:",
        "thread-events:",
        "live:",
        ...persisted.expandedPaths,
        ...collectAncestorPaths(fallbackNode?.path ?? "")
      ])
    );
    setSelectedNodeId(nextSelectedId);
    setFilterQuery("");
    setFilterMode(persisted.filterMode ?? "filter");
  }, [persistence]);
  useEffect2(() => {
    if (skipPersistenceWriteRef.current) {
      skipPersistenceWriteRef.current = false;
      return;
    }
    persistence.write({
      expandedPaths: [...expandedPaths],
      ...selectedPathForId(selectedNodeId, nodeMap) ? { selectedPath: selectedPathForId(selectedNodeId, nodeMap) } : {},
      filterMode
    });
  }, [expandedPaths, filterMode, nodeMap, persistence, selectedNodeId]);
  useEffect2(() => {
    if (!workspaceAdapter || !adapterModel || focusPendingRef.current) {
      return;
    }
    for (const node of nodeMap.values()) {
      if (node.path && node.kind === "directory" && expandedPaths.has(node.path) && node.hasChildren && !node.childrenLoaded && !loadingDirectoryPaths.has(node.path) && !directoryErrors.has(node.path)) {
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
    workspaceAdapter
  ]);
  useEffect2(() => {
    workspaceGenerationRef.current += 1;
    refreshGenerationRef.current += 1;
    directoryRequestGenerationsRef.current.clear();
    adapterModelRef.current = null;
    setAdapterModel(null);
    setLoadingDirectoryPaths(/* @__PURE__ */ new Set());
    setDirectoryErrors(/* @__PURE__ */ new Map());
    setWorkspaceError(null);
    handledFocusRequestRef.current = null;
    if (!focusPathRequest || focusPathRequest.artifactId !== void 0) {
      const persistedPath = persistence.read().selectedPath;
      if (persistedPath && !focusPathRequest) {
        const virtual = [
          ...flattenWorkspaceNodes(fallbackTreeRef.current).values()
        ].some((node) => node.path === persistedPath);
        void focusWorkspacePath(persistedPath);
        if (virtual) void refreshWorkspaceTree();
      } else void refreshWorkspaceTree();
    }
  }, [refreshWorkspaceTree]);
  useEffect2(() => {
    if (focusPathRequest) {
      const key = `${workspaceIdentity.threadId}:${focusPathRequest.requestId}`;
      if (handledFocusRequestRef.current === key) return;
      handledFocusRequestRef.current = key;
      if (focusPathRequest.artifactId !== void 0)
        focusArtifact(focusPathRequest.artifactId);
      else void focusWorkspacePath(focusPathRequest.path);
    }
  }, [focusPathRequest, focusWorkspacePath, focusArtifact]);
  useEffect2(() => {
    if (!workspaceAdapter?.subscribeWorkspaceChanged) {
      return;
    }
    let refreshTimer = null;
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
      }
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
    setSelectedNodeId: (id) => {
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
    showHidden: hiddenFilesAvailable ? showHidden : void 0,
    setShowHidden: hiddenFilesAvailable ? (value) => {
      setShowHiddenPreference(value);
      try {
        localStorage.setItem(SHOW_HIDDEN_KEY, String(value));
      } catch {
      }
    } : void 0,
    showThreadEvents,
    setShowThreadEvents: (value) => {
      setShowThreadEventsPreference(value);
      if (!value && selectedNodeId?.startsWith("event:")) setSelectedNodeId(firstNonEventNode(tree)?.id ?? null);
      try {
        localStorage.setItem(SHOW_THREAD_EVENTS_KEY, String(value));
      } catch {
      }
    }
  };
}
var SHOW_HIDDEN_KEY = "workbench.explorer.showHidden";
var SHOW_THREAD_EVENTS_KEY = "workbench.explorer.showThreadEvents";
function firstNonEventNode(node) {
  if (node.kind === "file" || node.kind === "artifact" || node.kind === "live-artifact") return node;
  if (node.kind === "event" || node.id === "thread-events" || node.id === "artifacts") return null;
  for (const child of node.children) {
    const found = firstNonEventNode(child);
    if (found) return found;
  }
  return null;
}
var MissingTargetError = class extends Error {
};
function isMissingTarget(error) {
  if (error instanceof MissingTargetError) return true;
  const code = error?.payload?.code ?? error?.code;
  return code === "file_unavailable" || error instanceof Error && /no such file|not found|cannot find/i.test(error.message);
}

// src/components/graph-workspace/explorer/useWorkspaceExplorerActions.ts
import { useEffect as useEffect3, useRef as useRef2, useState as useState2 } from "react";
function useWorkspaceExplorerActions({
  activeNode,
  adapter,
  capabilities,
  identity,
  onError,
  onLoadingChange,
  refreshTree,
  focusFile,
  workspaceRootPath
}) {
  useI18n();
  const fileInputRef = useRef2(null);
  const archiveInputRef = useRef2(null);
  const [notice, setNotice] = useState2(null);
  const [pending, setPending] = useState2(false);
  const [showGarbageDialog, setShowGarbageDialog] = useState2(false);
  const [garbageFiles, setGarbageFiles] = useState2([]);
  const [trashList, setTrashList] = useState2(
    null
  );
  const [showTrash, setShowTrash] = useState2(false);
  const [confirmTrashEmpty, setConfirmTrashEmpty] = useState2(false);
  const trashOperations = useRef2(/* @__PURE__ */ new Map());
  const trashInFlight = useRef2(false);
  const generation = useRef2(0);
  useEffect3(() => {
    ++generation.current;
    setPending(false);
    setNotice(null);
    setShowGarbageDialog(false);
    setGarbageFiles([]);
    setTrashList(null);
    setShowTrash(false);
    setConfirmTrashEmpty(false);
    trashOperations.current.clear();
    trashInFlight.current = false;
    return () => {
      ++generation.current;
    };
  }, [adapter, identity.threadId, identity.workspaceId]);
  const importFormats = workspaceArchiveFormats(capabilities, "import");
  const downloadFormats = workspaceArchiveFormats(capabilities, "download");
  const trashCapabilities = workspaceTrashCapabilities(capabilities);
  async function run(operation, success) {
    const request = generation.current;
    setPending(true);
    setNotice(null);
    onError(null);
    try {
      await operation();
      if (request === generation.current && success) setNotice(success);
    } catch (error) {
      if (request === generation.current) {
        const message = error instanceof Error ? error.message : "File operation failed. Please try again.";
        onError(message);
      }
    } finally {
      if (request === generation.current) setPending(false);
    }
  }
  function canDownload(node, format) {
    if (!adapter?.downloadNode || !["file", "directory"].includes(node.kind))
      return false;
    if (node.kind === "directory") {
      if (!node.id.startsWith("workspace:")) return false;
      return format ? downloadFormats.includes(format) : downloadFormats.length > 0;
    }
    return capabilities ? capabilities.download.file : !adapter.getCapabilities && !adapter.capabilities;
  }
  async function uploadFile(file) {
    if (!adapter?.uploadFile) return;
    await run(async () => {
      if (capabilities?.maxFileBytes && file.size > capabilities.maxFileBytes) {
        throw new Error(
          `File exceeds the ${capabilities.maxFileBytes.toLocaleString()} byte upload limit.`
        );
      }
      const request = generation.current;
      onLoadingChange(true);
      try {
        const result = await adapter.uploadFile({
          ...identity,
          path: file.name,
          file
        });
        if (request !== generation.current) return;
        await refreshTree(
          result.kind === "archive" ? result.paths[0] ?? null : result.file.path
        );
      } finally {
        if (request === generation.current) onLoadingChange(false);
      }
    }, `Uploaded ${file.name}.`);
  }
  async function handleUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await uploadFile(file);
  }
  async function handleArchiveImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await run(async () => {
      if (!importFormats.length || !adapter?.importArchive)
        throw new Error(
          "Archive extraction is unavailable for this connection."
        );
      const format = /\.zip$/i.test(file.name) ? "zip" : /\.tar$/i.test(file.name) ? "tar" : null;
      if (!format || !importFormats.includes(format))
        throw new Error(
          `Import requires ${importFormats.includes("zip") ? "an uncompressed .tar or .zip archive" : "an uncompressed .tar archive"}. This archive format is unsupported. Use Upload file to store an archive without extracting it.`
        );
      if (capabilities?.maxArchiveBytes !== void 0 && capabilities?.maxArchiveEntries !== void 0 && file.size > capabilities.maxArchiveBytes + capabilities.maxArchiveEntries * 1024 + 1024)
        throw new Error(
          `Archive exceeds the ${capabilities.maxArchiveBytes.toLocaleString()} byte import limit plus bounded archive headers.`
        );
      const request = generation.current;
      const result = await adapter.importArchive({
        ...identity,
        path: "",
        file,
        ...format === "zip" ? { format } : {}
      });
      if (request !== generation.current) return;
      const firstFile = result.firstFile === void 0 ? result.paths[0] : result.firstFile;
      await refreshTree(firstFile ?? null);
      if (request !== generation.current) return;
      if (firstFile) await focusFile(firstFile);
      if (request === generation.current)
        setNotice(
          `Imported ${file.name}. Committed ${result.paths.length} paths: ${result.paths.join(", ") || "(empty archive)"}.`
        );
    }, "");
  }
  async function pickUploadFile() {
    if (!adapter?.uploadFile) return;
    if (adapter.pickUploadFile) {
      await run(
        () => adapter.pickUploadFile({
          ...identity,
          defaultPick: () => fileInputRef.current?.click(),
          upload: uploadFile
        }),
        ""
      );
    } else fileInputRef.current?.click();
  }
  async function downloadNode(node, requestedFormat) {
    const format = requestedFormat ?? (downloadFormats.includes("tar") ? "tar" : downloadFormats[0]);
    await run(
      async () => {
        if (!canDownload(node, node.kind === "directory" ? format : void 0))
          throw new Error(
            node.kind === "directory" ? "Folder downloads are unavailable for this connection." : "File downloads are unavailable for this connection."
          );
        await adapter.downloadNode({
          ...identity,
          path: node.path,
          kind: node.kind === "directory" ? "directory" : "file",
          ...node.kind === "directory" && format === "zip" ? { format } : {}
        });
      },
      `Downloaded ${node.name}${node.kind === "directory" ? ` as a ${format?.toUpperCase()} archive` : ""}.`
    );
  }
  async function copyPath(node, kind = "relative") {
    onError(null);
    if (node.kind === "artifact" || node.kind === "live-artifact") {
      if (!node.artifact?.id) {
        onError("Artifact ID is unavailable.");
        return false;
      }
      return copyText(node.artifact.id);
    }
    if (!node.path) return false;
    const relative = relativeWorkspacePath(node.path, workspaceRootPath);
    if (kind === "relative" && relative === null) {
      onError(translate("files.thisFileIsOutsideTheWorkspaceCopy"));
      return false;
    }
    const path = kind === "relative" ? relative : relative === null ? normalizeFileSystemPath(node.path) : `${normalizeFileSystemPath(workspaceRootPath).replace(/\/+$/, "")}/${relative}`;
    return copyText(path);
  }
  const mutableFile = activeNode?.kind === "file" && relativeWorkspacePath(activeNode.path, workspaceRootPath) !== null;
  const canDelete = Boolean(
    mutableFile && capabilities?.delete === "file" && adapter?.deleteFile
  );
  const canMove = Boolean(
    mutableFile && capabilities?.move === "file-new-destination" && adapter?.moveFile
  );
  const canTrash = Boolean(
    mutableFile && trashCapabilities?.files && adapter?.trashFile
  );
  const canListTrash = Boolean(trashCapabilities && adapter?.listTrash);
  const canRestoreTrash = Boolean(
    trashCapabilities?.restore && adapter?.restoreTrash
  );
  const canEmptyTrash = Boolean(
    trashCapabilities?.empty && adapter?.emptyTrash
  );
  async function runTrash(key, operation, success) {
    if (trashInFlight.current) return;
    const request = generation.current;
    trashInFlight.current = true;
    let operationId = trashOperations.current.get(key);
    if (!operationId) {
      operationId = crypto.randomUUID();
      trashOperations.current.set(key, operationId);
    }
    await run(async () => {
      try {
        await operation(operationId, request);
        if (request === generation.current) trashOperations.current.delete(key);
      } finally {
        if (request === generation.current) trashInFlight.current = false;
      }
    }, success);
  }
  async function loadTrash(request) {
    const list = await adapter.listTrash(identity);
    if (request === generation.current) setTrashList(structuredClone(list));
  }
  async function openTrash() {
    await run(async () => {
      if (!canListTrash)
        throw new Error("Trash is unavailable for this connection.");
      const request = generation.current;
      await loadTrash(request);
      if (request === generation.current) {
        setShowTrash(true);
        setConfirmTrashEmpty(false);
      }
    }, "");
  }
  async function trashFile() {
    const node = activeNode;
    if (!canTrash || !node) return;
    await runTrash(
      JSON.stringify(["trash", node.path]),
      async (operationId, request) => {
        await adapter.trashFile({
          ...identity,
          path: node.path,
          operationId
        });
        if (request === generation.current) await refreshTree();
      },
      `Moved ${node.name} to trash. Restore it from Trash.`
    );
  }
  async function restoreTrash(entry) {
    if (!canRestoreTrash) return;
    await runTrash(
      JSON.stringify(["restore", entry.trashId, entry.revision]),
      async (operationId, request) => {
        await adapter.restoreTrash({
          ...identity,
          trashId: entry.trashId,
          expectedRevision: entry.revision,
          expectedDestinationRevision: null,
          operationId
        });
        if (request !== generation.current) return;
        await loadTrash(request);
        if (request !== generation.current) return;
        await refreshTree(entry.path);
        if (request === generation.current) await focusFile(entry.path);
      },
      `Restored ${entry.path}.`
    );
  }
  async function emptyTrash() {
    const list = trashList;
    if (!canEmptyTrash || !list) return;
    await runTrash(
      JSON.stringify(["empty", list.revision]),
      async (operationId, request) => {
        await adapter.emptyTrash({
          ...identity,
          expectedRevision: list.revision,
          operationId
        });
        if (request !== generation.current) return;
        setConfirmTrashEmpty(false);
        await loadTrash(request);
      },
      "Trash emptied permanently. Immutable artifacts and history are retained."
    );
  }
  async function deleteFile() {
    const node = activeNode;
    await run(
      async () => {
        if (!canDelete || !node)
          throw new Error("File deletion is unavailable for this connection.");
        const request = generation.current;
        await adapter.deleteFile({ ...identity, path: node.path });
        if (request === generation.current) await refreshTree();
      },
      `Deleted ${node?.name ?? "file"}.`
    );
  }
  async function moveFile(destination) {
    const node = activeNode;
    await run(
      async () => {
        if (!canMove || !node)
          throw new Error("File moves are unavailable for this connection.");
        const path = relativeWorkspacePath(
          destination.trim(),
          workspaceRootPath
        );
        if (!path || path === node.path)
          throw new Error(
            "Enter a new destination inside the workspace. Existing destinations cannot be replaced."
          );
        const request = generation.current;
        await adapter.moveFile({
          ...identity,
          path: node.path,
          destination: path
        });
        if (request === generation.current) await refreshTree(path);
      },
      `Moved ${node?.name ?? "file"}.`
    );
  }
  async function openGarbage() {
    if (!adapter?.emptyGarbage) return;
    await run(async () => {
      if (!adapter.listGarbage)
        throw new Error(
          "Cannot safely empty garbage without listing its contents."
        );
      const request = generation.current;
      const files = await adapter.listGarbage(identity);
      if (request !== generation.current) return;
      setGarbageFiles(files.map((file) => `garbage/${file}`));
      setShowGarbageDialog(true);
    }, "");
  }
  async function confirmEmptyGarbage() {
    if (!adapter?.emptyGarbage) return;
    setShowGarbageDialog(false);
    await run(async () => {
      const request = generation.current;
      await adapter.emptyGarbage(identity);
      if (request === generation.current)
        await refreshTree(activeNode?.path ?? null);
    }, "Garbage emptied.");
  }
  return {
    canDownload,
    canDelete,
    canMove,
    canTrash,
    canListTrash,
    canRestoreTrash,
    canEmptyTrash,
    trashFile,
    openTrash,
    restoreTrash,
    emptyTrash,
    showTrash,
    setShowTrash,
    trashList,
    confirmTrashEmpty,
    setConfirmTrashEmpty,
    importFormats,
    downloadFormats,
    resetTrashRetry: () => trashOperations.current.clear(),
    deleteFile,
    moveFile,
    pending,
    notice,
    archiveInputRef,
    handleArchiveImport,
    confirmEmptyGarbage,
    copyPath,
    downloadNode,
    fileInputRef,
    garbageFiles,
    handleUpload,
    openGarbage,
    pickUploadFile,
    setShowGarbageDialog,
    showGarbageDialog
  };
}

// src/components/graph-workspace/explorer/WorkspaceTrashDialog.tsx
import * as Dialog2 from "@radix-ui/react-dialog";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
function WorkspaceTrashDialog({
  open,
  list,
  pending,
  error,
  notice,
  canRestore,
  canEmpty,
  confirming,
  onClose,
  onRefresh,
  onRestore,
  onConfirmingChange,
  onEmpty
}) {
  return /* @__PURE__ */ jsx(
    Dialog2.Root,
    {
      open,
      onOpenChange: (value) => {
        if (!value && !pending) onClose();
      },
      children: /* @__PURE__ */ jsxs(Dialog2.Portal, { children: [
        /* @__PURE__ */ jsx(Dialog2.Overlay, { className: "fixed inset-0 z-50 bg-black/40" }),
        /* @__PURE__ */ jsxs(
          Dialog2.Content,
          {
            className: "thread-graph-dialog fixed left-1/2 top-1/2 z-50 max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-[var(--theme-panel)] p-5 shadow-xl",
            onOpenAutoFocus: (event) => {
              event.preventDefault();
              document.querySelector('[aria-label="Close trash"]')?.focus();
            },
            children: [
              /* @__PURE__ */ jsx(Dialog2.Title, { className: "text-base font-semibold", children: confirming ? "Empty trash" : "Trash" }),
              /* @__PURE__ */ jsxs(Dialog2.Description, { className: "mt-2 text-sm", children: [
                confirming ? "Permanently delete these recoverable workspace copies? This cannot be undone. " : "Trashed files can be restored to their original paths while those paths are empty. ",
                "Immutable artifacts, artifact downloads and thread history are retained. Workspace file links can stop working when a file is in trash or permanently deleted."
              ] }),
              error ? /* @__PURE__ */ jsx(
                "p",
                {
                  role: "alert",
                  className: "my-2 text-sm text-rose-700 dark:text-rose-200",
                  children: error
                }
              ) : null,
              notice ? /* @__PURE__ */ jsx("p", { role: "status", className: "my-2 text-sm", children: notice }) : null,
              /* @__PURE__ */ jsx("ul", { className: "my-3 max-h-48 overflow-y-auto text-sm", children: list?.entries.map((entry) => /* @__PURE__ */ jsxs(
                "li",
                {
                  className: "flex flex-wrap items-center justify-between gap-2 border-b py-2",
                  children: [
                    /* @__PURE__ */ jsxs("span", { className: "min-w-0 break-all", children: [
                      entry.path,
                      " (",
                      entry.size.toLocaleString(),
                      " bytes)"
                    ] }),
                    !confirming ? /* @__PURE__ */ jsx(
                      "button",
                      {
                        type: "button",
                        "aria-label": `Restore ${entry.path}`,
                        disabled: pending || !canRestore,
                        onClick: () => onRestore(entry),
                        className: "rounded border px-3 py-2 disabled:opacity-50",
                        children: "Restore"
                      }
                    ) : null
                  ]
                },
                entry.trashId
              )) }),
              !list?.entries.length ? /* @__PURE__ */ jsx("p", { className: "my-2 text-sm", children: "Trash is empty." }) : null,
              /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap justify-end gap-2", children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    "aria-label": "Close trash",
                    disabled: pending,
                    onClick: () => confirming ? onConfirmingChange(false) : onClose(),
                    className: "rounded border px-3 py-2",
                    children: confirming ? "Cancel" : "Close"
                  }
                ),
                confirming ? /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    disabled: pending || !canEmpty || !list?.entries.length,
                    onClick: onEmpty,
                    className: "rounded border px-3 py-2 text-rose-700 disabled:opacity-50",
                    children: "Empty trash permanently"
                  }
                ) : /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      disabled: pending,
                      onClick: onRefresh,
                      className: "rounded border px-3 py-2",
                      children: "Refresh trash"
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      disabled: pending || !canEmpty || !list?.entries.length,
                      onClick: () => onConfirmingChange(true),
                      className: "rounded border px-3 py-2 text-rose-700 disabled:opacity-50",
                      children: "Empty trash\u2026"
                    }
                  )
                ] })
              ] })
            ]
          }
        )
      ] })
    }
  );
}

// src/components/graph-workspace/explorer/useWorkspaceFilePreview.ts
import { useLayoutEffect, useRef as useRef3, useState as useState3 } from "react";
var PREVIEW_CHUNK_BYTES = 24e3;
var MAX_MOLECULAR_PREVIEW_BYTES = 10 * 1024 * 1024;
function useWorkspaceFilePreview({
  activeNode,
  adapter,
  identity,
  onError,
  documents
}) {
  const generation = useRef3(0);
  const loadingMoreRef = useRef3(false);
  useI18n();
  const [previewFile, setPreviewFile] = useState3(null);
  const [downloadOnly, setDownloadOnly] = useState3(false);
  const [downloadReason, setDownloadReason] = useState3(null);
  const [imageUrl, setImageUrl] = useState3(null);
  const [pdfUrl, setPdfUrl] = useState3(null);
  const [previewLoading, setPreviewLoading] = useState3(false);
  const [loadingMore, setLoadingMore] = useState3(false);
  useLayoutEffect(() => {
    ++generation.current;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    const selectedPath = activeNode?.kind === "file" ? activeNode.path : null;
    if (!adapter || !selectedPath) {
      setDownloadOnly(false);
      setPreviewFile(null);
      setImageUrl(null);
      setPdfUrl(null);
      setPreviewLoading(false);
      return;
    }
    const currentAdapter = adapter;
    const currentPath = selectedPath;
    let cancelled = false;
    let objectUrl = null;
    const abort = new AbortController();
    async function loadPreview() {
      setPreviewLoading(true);
      onError(null);
      setDownloadOnly(false);
      setDownloadReason(null);
      setPreviewFile(null);
      setImageUrl(null);
      setPdfUrl(null);
      try {
        if (isDownloadOnlyPath(currentPath)) {
          setDownloadOnly(true);
          setDownloadReason(downloadOnlyReason(currentPath));
          return;
        }
        const extension = extensionOf(currentPath);
        if (isDrawioPath(currentPath) && (activeNode?.size ?? 0) > DRAWIO_MAX_BYTES) {
          throw new Error(translate("files.diagramPreviewSupportsFilesUpTo8"));
        }
        const rawUrl = currentAdapter.getRawFileUrl?.({
          ...identity,
          path: currentPath
        });
        if (rawUrl && IMAGE_EXTENSIONS.has(extension)) {
          if (!cancelled) {
            setImageUrl(rawUrl);
          }
          return;
        }
        if (PDF_EXTENSIONS.has(extension) && currentAdapter.readRawFile) {
          const blob = await currentAdapter.readRawFile({ ...identity, path: currentPath, signal: abort.signal });
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" }));
          setPdfUrl(objectUrl);
          return;
        }
        if (rawUrl && PDF_EXTENSIONS.has(extension)) {
          if (!cancelled) {
            setPdfUrl(rawUrl);
          }
          return;
        }
        const safe = !currentPath.startsWith("/") && !/^[a-z]:[\\/]/i.test(currentPath) && !isDrawioPath(currentPath) ? await documents.load(currentPath, abort.signal) : null;
        if (safe && safe.content == null && !["fileTooLarge", "safeUnavailable"].includes(safe.readOnlyReason ?? "")) {
          if (!cancelled) setDownloadOnly(true);
          return;
        }
        let file = safe?.content != null ? { ...safe, content: safe.content, nextOffset: safe.size } : await currentAdapter.readFile({
          ...identity,
          path: currentPath,
          limit: isDrawioPath(currentPath) ? DRAWIO_MAX_BYTES : PREVIEW_CHUNK_BYTES
        });
        if (MOLECULAR_EXTENSIONS.has(extension)) {
          while (!cancelled) {
            if (file.size > MAX_MOLECULAR_PREVIEW_BYTES || file.truncated && file.nextOffset >= MAX_MOLECULAR_PREVIEW_BYTES) {
              if (!cancelled) setDownloadOnly(true);
              return;
            }
            if (!file.truncated) break;
            const chunk = await currentAdapter.readFile({
              ...identity,
              path: currentPath,
              offset: file.nextOffset,
              limit: Math.min(
                256 * 1024,
                MAX_MOLECULAR_PREVIEW_BYTES - file.nextOffset
              )
            });
            if (chunk.nextOffset <= file.nextOffset) {
              throw new Error(
                "Unable to load the complete molecular file: the read made no progress."
              );
            }
            file = { ...chunk, content: file.content + chunk.content };
          }
        }
        if (!cancelled) {
          if (isBinaryPreview(file.content)) {
            setDownloadOnly(true);
            setDownloadReason("unsupportedEncodingOrBinaryFile");
          } else setPreviewFile(file);
        }
      } catch (error) {
        if (!cancelled) {
          if (error instanceof Error && /unsupportedEncodingOrBinaryFile/.test(error.message)) {
            setDownloadOnly(true);
            setDownloadReason("unsupportedEncodingOrBinaryFile");
          } else onError(
            error instanceof Error ? error.message : translate("files.failedToReadFile")
          );
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    }
    void loadPreview();
    return () => {
      cancelled = true;
      abort.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      ++generation.current;
    };
  }, [
    activeNode?.id,
    activeNode?.kind,
    activeNode?.path,
    adapter,
    identity,
    onError,
    documents.load
  ]);
  async function loadMore() {
    if (!adapter?.textRangeRead || !previewFile?.truncated || loadingMoreRef.current) return;
    const request = generation.current;
    const file = previewFile;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    onError(null);
    try {
      const chunk = await adapter.readFile({
        ...identity,
        path: file.path,
        offset: file.nextOffset,
        limit: PREVIEW_CHUNK_BYTES
      });
      if (request !== generation.current) return;
      if (chunk.nextOffset <= file.nextOffset && chunk.truncated)
        throw new Error(
          "Unable to load more: the read made no progress. Download the file or reopen it."
        );
      setPreviewFile(
        (current) => current?.path === file.path && current.nextOffset === file.nextOffset ? { ...chunk, content: current.content + chunk.content } : current
      );
    } catch (error) {
      if (request === generation.current)
        onError(
          error instanceof Error ? error.message : "Failed to load more. Reopen or download the file."
        );
    } finally {
      if (request === generation.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }
  return {
    downloadOnly,
    downloadReason,
    imageUrl,
    loadingMore,
    loadMore,
    pdfUrl,
    previewFile,
    previewLoading
  };
}

// src/components/graph-workspace/explorer/WorkspaceExplorerPanel.tsx
import {
  ArchiveRestore,
  Download as Download2,
  FileArchive as FileArchive3,
  FileCode2 as FileCode22,
  FolderInput,
  PackageOpen,
  FilePlus2,
  ListCollapse,
  Maximize2,
  Minus,
  MoreHorizontal as MoreHorizontal2,
  RefreshCw,
  Search,
  PanelLeftClose,
  PanelRightOpen,
  Trash2 as Trash22,
  Upload,
  X as X2,
  Check as Check2,
  Eye,
  ListTree
} from "lucide-react";
import {
  useCallback as useCallback4,
  useEffect as useEffect6,
  useMemo as useMemo4,
  useRef as useRef6,
  useState as useState6
} from "react";

// src/components/graph-workspace/explorer/WorkspaceExplorerTree.tsx
import { measureElement, useVirtualizer } from "@tanstack/react-virtual";
import {
  useCallback as useCallback3,
  useEffect as useEffect5,
  useMemo as useMemo3,
  useRef as useRef5,
  useState as useState5
} from "react";

// src/components/graph-workspace/explorer/workspaceExplorerFilter.ts
function mergeMatchIndexes(indexes) {
  const ranges = [];
  for (const index of indexes) {
    const previous = ranges.at(-1);
    if (previous && previous.end === index) {
      previous.end = index + 1;
    } else {
      ranges.push({ start: index, end: index + 1 });
    }
  }
  return ranges;
}
function matchWorkspaceExplorerNode(node, rawQuery) {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) {
    return { score: 0, ranges: [] };
  }
  const candidate = (query.includes("/") ? node.path : node.name).toLocaleLowerCase();
  const indexes = [];
  let cursor = 0;
  let consecutive = 0;
  let segmentStarts = 0;
  for (const character of query) {
    const index = candidate.indexOf(character, cursor);
    if (index < 0) {
      return null;
    }
    indexes.push(index);
    if (indexes.length > 1 && index === indexes[indexes.length - 2] + 1) {
      consecutive += 1;
    }
    if (index === 0 || candidate[index - 1] === "/" || candidate[index - 1] === "-") {
      segmentStarts += 1;
    }
    cursor = index + 1;
  }
  const first = indexes[0] ?? 0;
  const prefixBonus = first === 0 ? 200 : 0;
  const exactBonus = candidate === query ? 500 : 0;
  return {
    score: exactBonus + prefixBonus + consecutive * 20 + segmentStarts * 30 - first - candidate.length,
    ranges: mergeMatchIndexes(indexes)
  };
}

// src/components/graph-workspace/explorer/workspaceExplorerProjection.ts
function sortedChildIds(model, childIds) {
  return [...childIds].sort((leftId, rightId) => {
    const left = model.nodes.get(leftId);
    const right = model.nodes.get(rightId);
    if (!left || !right) {
      return left ? -1 : right ? 1 : 0;
    }
    if (left.kind === "directory" && right.kind !== "directory") {
      return -1;
    }
    if (left.kind !== "directory" && right.kind === "directory") {
      return 1;
    }
    return left.name.localeCompare(right.name);
  });
}
function projectWorkspaceExplorerRows(model, expandedPaths, options = {}) {
  const rows = [];
  const indexById = /* @__PURE__ */ new Map();
  const matches = /* @__PURE__ */ new Map();
  const includedIds = /* @__PURE__ */ new Set();
  const query = options.filterQuery?.trim() ?? "";
  const includeExpandedChildren = (nodeId) => {
    const node = model.nodes.get(nodeId);
    if (!node || !expandedPaths.has(node.path)) return;
    for (const childId of node.childIds) {
      includedIds.add(childId);
      includeExpandedChildren(childId);
    }
  };
  if (query) {
    for (const node of model.nodes.values()) {
      const match = matchWorkspaceExplorerNode(node, query);
      if (!match) {
        continue;
      }
      matches.set(node.id, match);
      if (node.kind === "directory") includeExpandedChildren(node.id);
      let current = node;
      while (current) {
        includedIds.add(current.id);
        current = current.parentId ? model.nodes.get(current.parentId) : void 0;
      }
    }
  }
  const filtering = Boolean(query && options.filterMode === "filter");
  const hasUnresolvedDirectories = [...model.nodes.values()].some(
    (node) => node.kind === "directory" && node.childrenState !== "resolved"
  );
  const visit = (nodeId, depth, posInSet, setSize) => {
    const node = model.nodes.get(nodeId);
    if (!node || filtering && !includedIds.has(node.id)) {
      return;
    }
    let projectedNode = node;
    const compactPathSegments = [node.name];
    if (options.compactFolders && !query && depth > 0 && node.kind === "directory") {
      while (projectedNode.kind === "directory" && projectedNode.childrenState === "resolved" && !projectedNode.truncated && projectedNode.childIds.length === 1) {
        const child = model.nodes.get(projectedNode.childIds[0]);
        if (!child || child.kind !== "directory") {
          break;
        }
        compactPathSegments.push(child.name);
        projectedNode = child;
      }
    }
    const expanded = projectedNode.kind === "directory" ? projectedNode.path === "" || expandedPaths.has(projectedNode.path) || filtering && projectedNode.childIds.some((id) => includedIds.has(id)) : void 0;
    indexById.set(projectedNode.id, rows.length);
    const match = matches.get(projectedNode.id);
    rows.push({
      id: projectedNode.id,
      parentId: node.parentId,
      depth,
      posInSet,
      setSize,
      expanded,
      ...compactPathSegments.length > 1 ? { compactPathSegments } : {},
      ...match?.ranges.length && !query.includes("/") ? { matchRanges: match.ranges } : {},
      node: projectedNode
    });
    if (!expanded) {
      return;
    }
    const childIds = sortedChildIds(model, projectedNode.childIds).filter(
      (childId) => !filtering || includedIds.has(childId)
    );
    childIds.forEach((childId, index) => {
      visit(childId, depth + 1, index + 1, childIds.length);
    });
  };
  visit(model.rootId, 0, 1, 1);
  return {
    rows,
    indexById,
    matchCount: matches.size,
    hasUnresolvedDirectories
  };
}

// src/components/graph-workspace/explorer/workspaceExplorerCommands.ts
function workspaceExplorerCommandForKey(input) {
  const currentIndex = input.focusedId ? input.rows.findIndex((row) => row.id === input.focusedId) : -1;
  const current = currentIndex >= 0 ? input.rows[currentIndex] : null;
  const focusAt = (index) => {
    const row = input.rows[index];
    return row ? { type: "focus", id: row.id } : null;
  };
  if ((input.metaKey || input.ctrlKey) && input.key.toLowerCase() === "f") {
    return { type: "open-filter" };
  }
  switch (input.key) {
    case "ArrowDown":
      return focusAt(Math.min(input.rows.length - 1, currentIndex + 1));
    case "ArrowUp":
      return focusAt(Math.max(0, currentIndex < 0 ? 0 : currentIndex - 1));
    case "Home":
      return focusAt(0);
    case "End":
      return focusAt(input.rows.length - 1);
    case "ArrowRight": {
      if (!current) {
        return focusAt(0);
      }
      if (current.node.kind === "directory" && current.expanded === false) {
        return { type: "expand", path: current.node.path };
      }
      const next = input.rows[currentIndex + 1];
      return next?.parentId === current.id ? { type: "focus", id: next.id } : null;
    }
    case "ArrowLeft":
      if (!current) {
        return null;
      }
      if (current.node.kind === "directory" && current.expanded) {
        return { type: "collapse", path: current.node.path };
      }
      return current.parentId ? { type: "focus", id: current.parentId } : null;
    case "Enter":
      return current ? { type: "activate", id: current.id } : null;
    case " ":
      return current ? { type: "select", id: current.id } : null;
    default:
      return null;
  }
}

// src/components/graph-workspace/explorer/WorkspaceExplorerRow.tsx
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  File as File2,
  FileArchive as FileArchive2,
  FileCode2,
  FileImage,
  Folder as Folder2,
  FolderOpen,
  FolderSymlink,
  LoaderCircle
} from "lucide-react";

// src/components/graph-workspace/explorer/WorkspaceNodeActions.tsx
import {
  Copy,
  Check,
  Download,
  FileArchive,
  Info,
  MoreHorizontal,
  Pencil,
  Trash2,
  TriangleAlert
} from "lucide-react";
import { useEffect as useEffect4, useRef as useRef4, useState as useState4 } from "react";
import { createPortal } from "react-dom";

// src/components/graph-workspace/explorer/WorkspaceNodeProperties.tsx
import { File, Folder, X } from "lucide-react";
import { Fragment as Fragment2, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var bytes = (size) => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size, unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const short = `${value.toLocaleString(getLocale(), { maximumFractionDigits: unit ? 1 : 0 })} ${units[unit]}`;
  return unit ? translate("files.propertiesBytes", { size: short, bytes: size.toLocaleString(getLocale()) }) : short;
};
var when = (at) => {
  const date = at ? new Date(at) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString(getLocale(), { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : null;
};
function WorkspaceNodeProperties({ node, open, onOpenChange }) {
  useI18n();
  const info = node.workspaceNode;
  const directory = node.kind === "directory";
  const extension = !directory && node.name.includes(".") && !node.name.startsWith(".") ? node.name.split(".").pop().toUpperCase() : null;
  const folder = node.path.includes("/") ? node.path.slice(0, node.path.lastIndexOf("/")) : translate("files.propertiesRoot");
  const size = node.size ?? info?.size;
  const loaded = directory && node.childrenLoaded ? node.children.length : null;
  const rows = [
    [translate("files.propertiesKind"), directory ? translate("files.propertiesFolder") : extension ? translate("files.propertiesFileOf", { kind: extension }) : translate("files.propertiesFile")],
    [translate("files.propertiesLocation"), node.path.includes("/") ? /* @__PURE__ */ jsx2(PathChip, { path: folder }) : folder],
    ...size !== void 0 ? [[translate("files.propertiesSize"), bytes(size)]] : [],
    ...loaded !== null ? [[translate("files.propertiesContains"), translate("files.propertiesItems", { count: loaded })]] : [],
    ...[["files.propertiesCreated", info?.createdAt], ["files.propertiesModified", info?.modifiedAt], ["files.propertiesAccessed", info?.accessedAt]].flatMap(([label, at]) => when(at) ? [[translate(label), when(at)]] : []),
    ...info?.mode || info?.readonly !== void 0 ? [[translate("files.propertiesPermissions"), /* @__PURE__ */ jsxs2(Fragment2, { children: [
      info?.mode ? /* @__PURE__ */ jsx2("code", { children: info.mode }) : null,
      info?.readonly ? /* @__PURE__ */ jsx2("span", { className: "workspace-properties-tag", children: translate("files.propertiesReadonly") }) : null
    ] })]] : [],
    ...info?.symlink ? [[translate("files.propertiesLink"), translate("files.propertiesLinkYes")]] : []
  ];
  return /* @__PURE__ */ jsx2(Dialog, { open, onOpenChange, children: /* @__PURE__ */ jsxs2(DialogContent, { showCloseButton: false, "aria-describedby": void 0, className: "workspace-properties", overlayClassName: "workspace-properties-overlay", children: [
    /* @__PURE__ */ jsxs2("header", { children: [
      directory ? /* @__PURE__ */ jsx2(Folder, { "aria-hidden": "true" }) : /* @__PURE__ */ jsx2(File, { "aria-hidden": "true" }),
      /* @__PURE__ */ jsx2(DialogTitle, { className: "workspace-properties-title", title: node.name, children: node.name }),
      /* @__PURE__ */ jsx2(DialogClose, { className: "workspace-properties-close", "aria-label": translate("files.propertiesClose"), children: /* @__PURE__ */ jsx2(X, { "aria-hidden": "true" }) })
    ] }),
    /* @__PURE__ */ jsx2("dl", { children: rows.map(([label, value]) => /* @__PURE__ */ jsxs2("div", { children: [
      /* @__PURE__ */ jsx2("dt", { children: label }),
      /* @__PURE__ */ jsx2("dd", { children: value })
    ] }, label)) }),
    !info?.modifiedAt ? /* @__PURE__ */ jsx2("p", { className: "workspace-properties-note", children: translate("files.propertiesOlderDevice") }) : null
  ] }) });
}

// src/components/graph-workspace/explorer/WorkspaceNodeActions.tsx
import { Fragment as Fragment3, jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function WorkspaceNodeActions({
  node,
  onCopyPath,
  onDownload,
  onDownloadZip,
  onRename,
  onDelete
}) {
  useI18n();
  const [menu, setMenu] = useState4(null);
  const [copied, setCopied] = useState4(null);
  useEffect4(() => {
    if (!menu) setCopied(null);
  }, [menu]);
  const [dialog, setDialog] = useState4(null);
  const [name, setName] = useState4(node.name);
  const [error, setError] = useState4(null);
  const [busy, setBusy] = useState4(false);
  const trigger = useRef4(null);
  const popup = useRef4(null);
  const close = () => {
    setMenu(null);
    trigger.current?.focus();
  };
  useMenuKeyboard(popup, Boolean(menu), (restore) => restore ? close() : setMenu(null));
  useEffect4(() => {
    if (!menu) return;
    const outside = (event) => {
      if (!popup.current?.contains(event.target) && !trigger.current?.contains(event.target))
        setMenu(null);
    };
    const escape = (event) => {
      if (event.key === "Escape") close();
    };
    const resize = () => setMenu(null);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    window.addEventListener("resize", resize);
    popup.current?.querySelector("button")?.focus();
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("resize", resize);
    };
  }, [menu]);
  const actionClass = "thread-graph-tree-action flex shrink-0 items-center justify-center rounded transition";
  const mutate = async () => {
    setBusy(true);
    setError(null);
    try {
      if (dialog === "rename") await onRename?.(node, name);
      else await onDelete?.(node);
      setDialog(null);
      trigger.current?.focus();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : translate("files.fileOperationFailed")
      );
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ jsxs3(
    "div",
    {
      className: "thread-graph-tree-actions flex shrink-0 items-center gap-0.5",
      onDoubleClick: (event) => event.stopPropagation(),
      onKeyDown: (event) => event.stopPropagation(),
      children: [
        onCopyPath && /* @__PURE__ */ jsxs3(Fragment3, { children: [
          /* @__PURE__ */ jsx3(
            "button",
            {
              type: "button",
              onClick: () => onCopyPath(node, "relative"),
              className: `${actionClass} workspace-node-quick-action`,
              title: translate("files.copyRelativePathFor", { value1: node.name }),
              "aria-label": translate("files.copyRelativePathFor", { value1: node.name }),
              children: /* @__PURE__ */ jsx3(Copy, { "data-icon": "copy-path", size: 14 })
            }
          ),
          /* @__PURE__ */ jsx3(
            "button",
            {
              type: "button",
              onClick: () => onCopyPath(node, "absolute"),
              className: `${actionClass} workspace-node-quick-action`,
              title: translate("files.copyAbsolutePathFor", { value1: node.name }),
              "aria-label": translate("files.copyAbsolutePathFor", { value1: node.name }),
              children: /* @__PURE__ */ jsx3(Copy, { "data-icon": "copy-absolute-path", size: 14 })
            }
          )
        ] }),
        (onRename || onDelete || onCopyPath || onDownload || onDownloadZip) && /* @__PURE__ */ jsx3(
          "button",
          {
            ref: trigger,
            type: "button",
            "aria-label": translate("files.moreActionsFor", { value1: node.name }),
            "aria-haspopup": "menu",
            "aria-expanded": !!menu,
            className: actionClass,
            onClick: () => {
              const box = trigger.current.getBoundingClientRect();
              setMenu(
                menu ? null : {
                  left: Math.max(
                    8,
                    Math.min(box.right - 208, window.innerWidth - 216)
                  ),
                  top: Math.max(
                    8,
                    Math.min(box.bottom + 4, window.innerHeight - 260)
                  )
                }
              );
            },
            children: /* @__PURE__ */ jsx3(MoreHorizontal, { "data-icon": "more", size: 14 })
          }
        ),
        menu && createPortal(
          /* @__PURE__ */ jsxs3(
            "div",
            {
              ref: popup,
              role: "menu",
              "aria-label": translate("files.actionsFor", { value1: node.name }),
              className: `thread-ui-shell workspace-node-menu ${shellThemeProps(trigger.current).themeClass}`,
              "data-theme-effective": shellThemeProps(trigger.current)["data-theme-effective"],
              "data-theme-mode": shellThemeProps(trigger.current)["data-theme-mode"],
              style: {
                position: "fixed",
                left: menu.left,
                top: menu.top,
                zIndex: 1e3,
                minWidth: 176,
                maxWidth: 260,
                maxHeight: "calc(100dvh - 16px)",
                overflowX: "hidden",
                overflowY: "auto",
                background: "var(--theme-panel)",
                color: "var(--theme-fg)",
                border: "1px solid var(--theme-border)",
                borderRadius: 8,
                padding: 4,
                boxShadow: "0 8px 24px #0004"
              },
              children: [
                onDownload && /* @__PURE__ */ jsxs3("button", { role: "menuitem", type: "button", onClick: () => {
                  onDownload(node);
                  close();
                }, children: [
                  /* @__PURE__ */ jsx3(Download, { "data-icon": "download", size: 14 }),
                  translate("files.downloadFile")
                ] }),
                onDownloadZip && /* @__PURE__ */ jsxs3("button", { role: "menuitem", type: "button", onClick: () => {
                  onDownloadZip(node);
                  close();
                }, children: [
                  /* @__PURE__ */ jsx3(FileArchive, { "data-icon": "download-zip", size: 14 }),
                  translate("files.downloadZip")
                ] }),
                onCopyPath && /* @__PURE__ */ jsx3(Fragment3, { children: ["relative", "absolute"].map((kind) => /* @__PURE__ */ jsxs3(
                  "button",
                  {
                    role: "menuitem",
                    type: "button",
                    "data-copy-state": copied?.kind === kind ? copied.state : void 0,
                    "aria-label": translate(kind === "relative" ? "files.copyRelativePathFor" : "files.copyAbsolutePathFor", { value1: node.name }),
                    onClick: async () => {
                      const ok = await onCopyPath(node, kind) !== false;
                      setCopied({ kind, state: ok ? "copied" : "failed" });
                      if (ok) window.setTimeout(() => {
                        setCopied(null);
                        close();
                      }, 700);
                    },
                    children: [
                      copied?.kind === kind ? copied.state === "copied" ? /* @__PURE__ */ jsx3(Check, { size: 14 }) : /* @__PURE__ */ jsx3(TriangleAlert, { size: 14 }) : /* @__PURE__ */ jsx3(Copy, { "data-icon": kind === "relative" ? "copy-path" : "copy-absolute-path", size: 14 }),
                      copied?.kind === kind ? translate(copied.state === "copied" ? "common.copied" : "common.copyFailed") : translate(kind === "relative" ? "files.copyRelativePath" : "files.copyAbsolutePath")
                    ]
                  },
                  kind
                )) }),
                onRename && /* @__PURE__ */ jsxs3(
                  "button",
                  {
                    role: "menuitem",
                    type: "button",
                    onClick: () => {
                      setName(node.name);
                      setError(null);
                      setDialog("rename");
                      setMenu(null);
                    },
                    children: [
                      /* @__PURE__ */ jsx3(Pencil, { "data-icon": "rename", size: 14 }),
                      " ",
                      translate("files.rename_d3f4cb")
                    ]
                  }
                ),
                onDelete && /* @__PURE__ */ jsxs3(
                  "button",
                  {
                    role: "menuitem",
                    type: "button",
                    onClick: () => {
                      setError(null);
                      setDialog("delete");
                      setMenu(null);
                    },
                    children: [
                      /* @__PURE__ */ jsx3(Trash2, { "data-icon": "delete", size: 14 }),
                      " ",
                      translate("files.delete")
                    ]
                  }
                ),
                /* @__PURE__ */ jsx3("div", { role: "separator", className: "workspace-node-menu-separator" }),
                /* @__PURE__ */ jsxs3("button", { role: "menuitem", type: "button", onClick: () => {
                  setDialog("properties");
                  setMenu(null);
                }, children: [
                  /* @__PURE__ */ jsx3(Info, { "data-icon": "properties", size: 14 }),
                  translate("files.propertiesMenu")
                ] })
              ]
            }
          ),
          document.body
        ),
        /* @__PURE__ */ jsx3(WorkspaceNodeProperties, { node, open: dialog === "properties", onOpenChange: (next) => {
          if (!next) {
            setDialog(null);
            trigger.current?.focus();
          }
        } }),
        /* @__PURE__ */ jsx3(
          RenameDialog,
          {
            open: dialog === "rename",
            title: translate("files.rename", { value1: translate(node.kind === "directory" ? "files.kindFolder" : "files.kindFile") }),
            label: translate("files.name"),
            value: name,
            onChange: setName,
            onCancel: () => setDialog(null),
            onSubmit: mutate,
            busy,
            error
          }
        ),
        /* @__PURE__ */ jsx3(
          ConfirmDialog,
          {
            open: dialog === "delete",
            title: translate("files.delete_c93ae0", { value1: translate(node.kind === "directory" ? "files.kindFolder" : "files.kindFile") }),
            description: translate("files.permanentlyDelete", { value1: node.path, value2: node.kind === "directory" ? translate("files.andItsContents") : "" }),
            onCancel: () => setDialog(null),
            onConfirm: mutate,
            busy,
            error
          }
        )
      ]
    }
  );
}

// src/components/copy/MiddleName.tsx
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
function MiddleName({ name, className }) {
  const keep = Math.min(name.length, Math.max(8, name.length - name.lastIndexOf(".") + 5));
  if (name.length <= keep + 2) return /* @__PURE__ */ jsx4("span", { className: `middle-name${className ? ` ${className}` : ""}`, children: /* @__PURE__ */ jsx4("span", { className: "middle-name-head", children: name }) });
  return /* @__PURE__ */ jsxs4("span", { className: `middle-name${className ? ` ${className}` : ""}`, children: [
    /* @__PURE__ */ jsx4("span", { className: "middle-name-head", children: name.slice(0, -keep) }),
    /* @__PURE__ */ jsx4("span", { className: "middle-name-tail", children: name.slice(-keep) })
  ] });
}

// src/components/graph-workspace/explorer/WorkspaceExplorerRow.tsx
import { Fragment as Fragment4, jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
function iconForNode(node, expanded) {
  if (node.kind === "directory") {
    return expanded ? /* @__PURE__ */ jsx5(FolderOpen, { "data-icon": "folder-open", className: "workspace-node-icon is-folder h-4 w-4 text-slate-500 dark:text-slate-400" }) : /* @__PURE__ */ jsx5(Folder2, { "data-icon": "folder", className: "workspace-node-icon is-folder h-4 w-4 text-slate-500 dark:text-slate-400" });
  }
  const extension = extensionOf(node.name);
  if (extension === "zip") {
    return /* @__PURE__ */ jsx5(FileArchive2, { "data-icon": "archive", className: "workspace-node-icon is-archive h-4 w-4 text-amber-600" });
  }
  if (node.kind === "file" && ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) {
    return /* @__PURE__ */ jsx5(FileImage, { "data-icon": "image", className: "workspace-node-icon is-image h-4 w-4 text-sky-500" });
  }
  if (node.kind === "artifact" || [
    "xyz",
    "extxyz",
    "cif",
    "pdf",
    "json",
    "ts",
    "tsx",
    "js",
    "jsx",
    "md",
    "yaml",
    "yml",
    "py"
  ].includes(extension)) {
    return /* @__PURE__ */ jsx5(FileCode2, { "data-icon": "code", className: "workspace-node-icon is-code h-4 w-4 text-sky-700 dark:text-sky-300" });
  }
  return /* @__PURE__ */ jsx5(File2, { "data-icon": "file", className: "workspace-node-icon is-file h-4 w-4 text-slate-400 dark:text-slate-500" });
}
function openRowMenu(row) {
  const trigger = row.querySelector('button[aria-haspopup="menu"]');
  if (!trigger) return false;
  trigger.click();
  return true;
}
function WorkspaceExplorerRow({
  row,
  selected,
  focused,
  loading,
  error,
  rowRef,
  onFocus,
  onKeyDown,
  onSelect,
  onToggle,
  onPreview,
  onPin,
  onRetry,
  onDownload,
  onDownloadZip,
  canDownload,
  onCopyPath,
  onRename,
  onDelete
}) {
  useI18n();
  const rowPress = useLongPress(({ x, y }) => {
    const row2 = document.elementFromPoint(x, y)?.closest('[role="treeitem"]');
    if (row2) openRowMenu(row2);
  });
  const node = {
    ...row.node.source,
    children: []
  };
  const isDirectory = node.kind === "directory";
  const linkedDirectory = node.id.startsWith(LINKED_DIRECTORY_ID_PREFIX);
  const canToggleDirectory = isDirectory && Boolean(node.path);
  const expanded = Boolean(row.expanded);
  const paddingLeft = `${row.depth * 0.5 + 0.5}rem`;
  const showDownload = Boolean(onDownload && (!canDownload || canDownload(node)));
  const showDownloadZip = Boolean(onDownloadZip && (!canDownload || canDownload(node)));
  const isArtifact = node.kind === "artifact" || node.kind === "live-artifact";
  const canCopyReference = !isArtifact && Boolean(node.workspaceNode);
  const displayName = row.compactPathSegments?.join("/") ?? node.name;
  const hiddenByDefault = node.hiddenByDefault === true;
  const label = row.matchRanges?.length ? /* @__PURE__ */ jsx5(Fragment4, { children: row.matchRanges.reduce((parts, range, index) => {
    const previousEnd = row.matchRanges?.[index - 1]?.end ?? 0;
    if (range.start > previousEnd) {
      parts.push(displayName.slice(previousEnd, range.start));
    }
    parts.push(
      /* @__PURE__ */ jsx5(
        "span",
        {
          className: "font-semibold text-[var(--theme-fg)]",
          children: displayName.slice(range.start, range.end)
        },
        `${range.start}:${range.end}`
      )
    );
    if (index === row.matchRanges.length - 1 && range.end < displayName.length) {
      parts.push(displayName.slice(range.end));
    }
    return parts;
  }, []) }) : displayName;
  return /* @__PURE__ */ jsxs5(
    "div",
    {
      ref: rowRef,
      role: "treeitem",
      "aria-label": displayName,
      "aria-level": row.depth + 1,
      "aria-posinset": row.posInSet,
      "aria-setsize": row.setSize,
      "aria-selected": selected,
      ...isDirectory ? { "aria-expanded": expanded } : {},
      tabIndex: focused ? 0 : -1,
      "data-explorer-node-id": node.id,
      "data-explorer-path": node.path,
      ...hiddenByDefault ? { "data-hidden-by-default": "true" } : {},
      className: `thread-graph-tree-row group relative flex min-w-0 items-center text-sm transition ${selected ? "is-selected" : ""} ${focused ? "is-focused" : ""}${hiddenByDefault ? " is-hidden-by-default" : ""}`,
      style: { paddingLeft },
      onFocus,
      onKeyDown: (event) => {
        if ((event.key === "ContextMenu" || event.key === "F10" && event.shiftKey) && openRowMenu(event.currentTarget)) {
          event.preventDefault();
          return;
        }
        onKeyDown(event);
      },
      onContextMenu: (event) => {
        if (openRowMenu(event.currentTarget)) event.preventDefault();
      },
      ...rowPress,
      onDoubleClick: () => {
        if (isDirectory && node.path) {
          onToggle(node.path);
        } else if (!isDirectory) {
          onPin?.(node);
        }
      },
      children: [
        row.depth > 0 ? /* @__PURE__ */ jsx5(
          "span",
          {
            className: "thread-graph-tree-indent-guides pointer-events-none absolute inset-y-0 left-0",
            "aria-hidden": "true",
            children: Array.from({ length: row.depth }, (_, index) => /* @__PURE__ */ jsx5(
              "span",
              {
                className: "absolute inset-y-0 border-l",
                style: { left: `${index * 0.5 + 0.75}rem` }
              },
              index
            ))
          }
        ) : null,
        canToggleDirectory ? /* @__PURE__ */ jsx5(
          "button",
          {
            type: "button",
            tabIndex: -1,
            "aria-label": `${expanded ? translate("files.collapse") : translate("files.expand")} ${node.name}`,
            className: "inline-flex h-7 w-7 shrink-0 items-center justify-center sm:h-6 sm:w-6",
            onClick: () => {
              if (node.path) {
                onToggle(node.path);
              }
            },
            children: loading ? /* @__PURE__ */ jsx5(LoaderCircle, { className: "h-3.5 w-3.5 animate-spin text-slate-400 motion-reduce:animate-none" }) : expanded ? /* @__PURE__ */ jsx5(ChevronDown, { className: "h-3.5 w-3.5 text-slate-400" }) : /* @__PURE__ */ jsx5(ChevronRight, { className: "h-3.5 w-3.5 text-slate-400" })
          }
        ) : /* @__PURE__ */ jsx5("span", { className: "h-7 w-7 shrink-0 sm:h-6 sm:w-6", "aria-hidden": "true" }),
        /* @__PURE__ */ jsxs5(
          "button",
          {
            type: "button",
            tabIndex: -1,
            className: "flex min-h-11 min-w-0 flex-1 items-center gap-2 py-2 pr-2 text-left sm:min-h-7 sm:py-1",
            onClick: () => {
              onSelect(node);
              if (canToggleDirectory && window.matchMedia?.("(max-width: 639px)").matches) onToggle(node.path);
            },
            children: [
              linkedDirectory ? /* @__PURE__ */ jsx5(FolderSymlink, { "data-icon": "folder-link", className: "workspace-node-icon is-folder h-4 w-4 text-slate-500 dark:text-slate-400", "aria-hidden": "true" }) : iconForNode(node, expanded),
              linkedDirectory ? (
                // Long host paths keep their meaningful tail visible.
                /* @__PURE__ */ jsx5("span", { className: "workspace-linked-directory-label min-w-0 flex-1", title: `${displayName}
${translate("files.linkedFilesAreReadOnlyPreviews")}`, children: /* @__PURE__ */ jsx5("bdi", { children: displayName }) })
              ) : /* @__PURE__ */ jsxs5("span", { className: "workspace-node-label flex min-w-0 flex-1", title: hiddenByDefault ? `${displayName}
${translate("files.hiddenByDefaultTitle", { name: displayName })}` : displayName, children: [
                row.matchRanges?.length ? /* @__PURE__ */ jsx5("span", { className: "min-w-0 truncate", children: label }) : /* @__PURE__ */ jsx5(MiddleName, { name: displayName }),
                hiddenByDefault ? /* @__PURE__ */ jsx5("span", { className: "workspace-hidden-hint", children: translate("files.hiddenByDefault") }) : null
              ] })
            ]
          }
        ),
        isDirectory && error && onRetry ? /* @__PURE__ */ jsxs5(
          "button",
          {
            type: "button",
            tabIndex: -1,
            onClick: () => onRetry(node.path),
            className: "mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-rose-600 hover:bg-rose-500/10 dark:text-rose-300",
            title: translate("files.retry_f4914f", { value1: error, value2: node.name }),
            "aria-label": translate("files.retryLoading", { value1: node.name }),
            children: [
              /* @__PURE__ */ jsx5(CircleAlert, { className: "h-3.5 w-3.5" }),
              /* @__PURE__ */ jsx5("span", { className: "sr-only", role: "alert", children: translate("files.retry_f4914f", { value1: error, value2: node.name }) })
            ]
          }
        ) : null,
        !linkedDirectory && node.path ? /* @__PURE__ */ jsx5(
          WorkspaceNodeActions,
          {
            node,
            ...onDownload && showDownload ? { onDownload } : {},
            ...onDownloadZip && showDownloadZip && isDirectory && row.depth > 0 ? { onDownloadZip } : {},
            ...onCopyPath && canCopyReference ? { onCopyPath } : {},
            ...onRename && !node.path.startsWith("/") && !/^[a-z]:/i.test(node.path) ? { onRename } : {},
            ...onDelete && !node.path.startsWith("/") && !/^[a-z]:/i.test(node.path) ? { onDelete } : {}
          }
        ) : null
      ]
    }
  );
}

// src/components/graph-workspace/explorer/WorkspaceExplorerTree.tsx
import { jsx as jsx6 } from "react/jsx-runtime";
function WorkspaceExplorerTree({
  tree,
  expandedPaths,
  filterMode = "filter",
  filterQuery = "",
  compactFolders = false,
  directoryErrors,
  loadingPaths,
  selectedNodeId,
  revealRequestKey,
  scrollerRef,
  scrollTopRef,
  onCopyPath,
  onDownload,
  onDownloadZip,
  canDownload,
  onRename,
  onDelete,
  onOpenFilter,
  onFilterResultsChange,
  onPreview,
  onPin,
  onRetryDirectory,
  onSelect,
  onToggle,
  virtualize = true
}) {
  useI18n();
  const model = useMemo3(() => createWorkspaceExplorerModel(tree), [tree]);
  const projection = useMemo3(
    () => projectWorkspaceExplorerRows(model, expandedPaths, {
      filterMode,
      filterQuery,
      compactFolders
    }),
    [compactFolders, expandedPaths, filterMode, filterQuery, model]
  );
  const { rows } = projection;
  const [focusedId, setFocusedId] = useState5(
    () => selectedNodeId ?? rows[0]?.id ?? null
  );
  const rowElementsRef = useRef5(/* @__PURE__ */ new Map());
  const canVirtualize = virtualize && typeof window !== "undefined" && "ResizeObserver" in window;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollerRef.current,
    getItemKey: (index) => rows[index]?.id ?? index,
    estimateSize: () => typeof window !== "undefined" && window.matchMedia?.("(max-width: 639px)").matches ? 44 : 28,
    overscan: 6,
    enabled: canVirtualize,
    useFlushSync: false,
    // A hidden drawer (`display: none`) reports 0px rows. Caching those sizes
    // collapses rows and shifts everything after them once it is shown again.
    measureElement: (element, entry, instance) => {
      const size = measureElement(element, entry, instance);
      if (size > 0) return size;
      const index = instance.indexFromElement(element);
      return instance.measurementsCache[index]?.size ?? instance.options.estimateSize(index);
    }
  });
  const lastVisibleScrollTopRef = useRef5(0);
  useEffect5(() => {
    const scroller = scrollerRef.current;
    if (!canVirtualize || !scroller) return;
    let hidden = scroller.clientHeight === 0;
    const observer = new ResizeObserver(() => {
      const nowHidden = scroller.clientHeight === 0;
      if (hidden && !nowHidden) {
        const target = lastVisibleScrollTopRef.current;
        if (Math.abs(scroller.scrollTop - target) > 1) scroller.scrollTop = target;
        scroller.dispatchEvent(new Event("scroll"));
      }
      hidden = nowHidden;
    });
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [canVirtualize, scrollerRef]);
  useEffect5(() => {
    onFilterResultsChange?.({
      matchCount: projection.matchCount,
      hasUnresolvedDirectories: projection.hasUnresolvedDirectories
    });
  }, [
    onFilterResultsChange,
    projection.hasUnresolvedDirectories,
    projection.matchCount
  ]);
  useEffect5(() => {
    if (focusedId && projection.indexById.has(focusedId)) {
      return;
    }
    setFocusedId(
      selectedNodeId && projection.indexById.has(selectedNodeId) ? selectedNodeId : rows[0]?.id ?? null
    );
  }, [focusedId, projection.indexById, rows, selectedNodeId]);
  const focusRow = useCallback3(
    (id) => {
      setFocusedId(id);
      const index = projection.indexById.get(id);
      if (canVirtualize && index !== void 0) {
        virtualizer.scrollToIndex(index, { align: "auto" });
      }
      window.requestAnimationFrame(
        () => rowElementsRef.current.get(id)?.focus()
      );
    },
    [canVirtualize, projection.indexById, virtualizer]
  );
  const revealedSelectionRef = useRef5(null);
  const revealUntilRef = useRef5(0);
  const revealTarget = useCallback3((id, toTop) => {
    const index = projection.indexById.get(id);
    if (index === void 0) return false;
    if (!toTop) {
      if (canVirtualize) virtualizer.scrollToIndex(index, { align: "auto" });
      else rowElementsRef.current.get(id)?.scrollIntoView?.({ block: "nearest" });
    } else if (canVirtualize) {
      virtualizer.scrollToIndex(Math.max(0, index - 1), { align: "start" });
    } else {
      const row = rowElementsRef.current.get(id);
      const scroller = scrollerRef.current;
      if (row && scroller) {
        const offset = row.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
        scroller.scrollTop += offset - row.offsetHeight;
      }
    }
    return true;
  }, [projection.indexById, canVirtualize, virtualizer, scrollerRef]);
  const revealedRequestRef = useRef5(void 0);
  useEffect5(() => {
    const key = `${selectedNodeId}:${revealRequestKey ?? 0}`;
    if (!selectedNodeId || revealedSelectionRef.current === key) return;
    const requested = revealRequestKey !== void 0 && revealRequestKey !== revealedRequestRef.current;
    if (!revealTarget(selectedNodeId, requested)) return;
    revealedSelectionRef.current = key;
    revealedRequestRef.current = revealRequestKey;
    setFocusedId(selectedNodeId);
    revealUntilRef.current = requested ? performance.now() + 1500 : 0;
  }, [selectedNodeId, revealRequestKey, revealTarget]);
  useEffect5(() => {
    if (!selectedNodeId || performance.now() > revealUntilRef.current) return;
    const frame = window.requestAnimationFrame(() => revealTarget(selectedNodeId, true));
    return () => window.cancelAnimationFrame(frame);
  }, [projection, selectedNodeId, revealTarget]);
  useEffect5(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const stop = () => {
      revealUntilRef.current = 0;
    };
    scroller.addEventListener("wheel", stop, { passive: true });
    scroller.addEventListener("touchstart", stop, { passive: true });
    scroller.addEventListener("keydown", stop);
    return () => {
      scroller.removeEventListener("wheel", stop);
      scroller.removeEventListener("touchstart", stop);
      scroller.removeEventListener("keydown", stop);
    };
  }, [scrollerRef]);
  const handleKeyDown = useCallback3(
    (event) => {
      const command = workspaceExplorerCommandForKey({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        focusedId,
        rows
      });
      if (!command) {
        return;
      }
      event.preventDefault();
      switch (command.type) {
        case "focus":
          focusRow(command.id);
          break;
        case "expand":
        case "collapse":
          onToggle(command.path);
          break;
        case "activate": {
          const row = model.nodes.get(command.id);
          if (!row) {
            break;
          }
          if (row.kind === "directory" && row.path) {
            onToggle(row.path);
          } else {
            onSelect({ ...row.source, children: [] });
          }
          break;
        }
        case "select": {
          const row = model.nodes.get(command.id);
          if (row) {
            onSelect({ ...row.source, children: [] });
          }
          break;
        }
        case "open-filter":
          onOpenFilter?.();
          break;
      }
    },
    [focusRow, focusedId, model.nodes, onOpenFilter, onSelect, onToggle, rows]
  );
  const virtualItems = canVirtualize ? virtualizer.getVirtualItems() : [];
  const renderedRows = canVirtualize ? virtualItems.map((item) => ({
    index: item.index,
    key: item.key,
    start: item.start
  })) : rows.map((row, index) => ({ index, key: row.id, start: 0 }));
  return /* @__PURE__ */ jsx6(
    "div",
    {
      ref: scrollerRef,
      role: "tree",
      "aria-label": translate("files.workspaceFiles"),
      className: "thread-graph-workspace-tree-scroll min-h-0 flex-1 overflow-y-auto py-1 outline-none",
      onScroll: (event) => {
        if (event.currentTarget.clientHeight > 0) {
          lastVisibleScrollTopRef.current = event.currentTarget.scrollTop;
        }
        if (scrollTopRef) {
          scrollTopRef.current = event.currentTarget.scrollTop;
        }
      },
      children: /* @__PURE__ */ jsx6(
        "div",
        {
          style: canVirtualize ? {
            height: `${virtualizer.getTotalSize()}px`,
            position: "relative",
            width: "100%"
          } : void 0,
          children: renderedRows.map((rendered) => {
            const row = rows[rendered.index];
            if (!row) {
              return null;
            }
            return /* @__PURE__ */ jsx6(
              "div",
              {
                role: "none",
                "data-index": rendered.index,
                ref: canVirtualize ? virtualizer.measureElement : void 0,
                style: canVirtualize ? {
                  left: 0,
                  position: "absolute",
                  top: 0,
                  transform: `translateY(${rendered.start}px)`,
                  width: "100%"
                } : void 0,
                children: /* @__PURE__ */ jsx6(
                  WorkspaceExplorerRow,
                  {
                    row,
                    selected: selectedNodeId === row.id,
                    focused: focusedId === row.id,
                    loading: loadingPaths.has(row.node.path),
                    ...directoryErrors?.get(row.node.path) ? { error: directoryErrors.get(row.node.path) } : {},
                    rowRef: (element) => {
                      if (element) {
                        rowElementsRef.current.set(row.id, element);
                      } else {
                        rowElementsRef.current.delete(row.id);
                      }
                    },
                    onFocus: () => setFocusedId(row.id),
                    onKeyDown: handleKeyDown,
                    onSelect,
                    onToggle,
                    ...onPreview ? { onPreview } : {},
                    ...onPin ? { onPin } : {},
                    ...onRetryDirectory ? { onRetry: onRetryDirectory } : {},
                    ...onDownload ? { onDownload } : {},
                    ...onDownloadZip ? { onDownloadZip } : {},
                    ...canDownload ? { canDownload } : {},
                    ...onCopyPath ? { onCopyPath } : {},
                    ...onRename ? { onRename } : {},
                    ...onDelete ? { onDelete } : {}
                  }
                )
              },
              rendered.key
            );
          })
        }
      )
    }
  );
}

// src/components/graph-workspace/explorer/WorkspaceExplorerPanel.tsx
import { Fragment as Fragment5, jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
var iconButtonClassName = "thread-graph-explorer-icon-button flex h-6 w-6 items-center justify-center rounded transition disabled:cursor-not-allowed disabled:opacity-40";
var collapseButtonClassName = "thread-graph-explorer-collapse-button flex h-6 w-6 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#222733] dark:hover:text-slate-100";
function WorkspaceExplorerPanel({
  canEmptyGarbage,
  canUpload,
  pending,
  canImportArchive,
  archiveLimits,
  onImportArchive,
  onDownloadWorkspace,
  onDownloadWorkspaceZip,
  importFormats = ["tar"],
  downloadFormats = ["tar"],
  canTrash,
  onTrashFile,
  onOpenTrash,
  canDelete,
  canMove,
  onDeleteFile,
  onMoveFile,
  compactFolders,
  directoryErrors,
  expandedPaths,
  filterMode,
  filterQuery,
  initialLoading,
  loadingPaths,
  loading,
  liveNodes = [],
  onCollapse,
  onCollapseAll,
  onCopyPath,
  onDownload,
  onDownloadZip,
  canDownload,
  onRename,
  onDelete,
  onEmptyGarbage,
  onExpandViewer,
  expandViewerAvailable = true,
  onFilterModeChange,
  onFilterQueryChange,
  onPreview,
  onPin,
  onRefresh,
  onRetryDirectory,
  onSelect,
  onSelectNode,
  onToggle,
  onUpload,
  onCreateFile,
  showHidden,
  onShowHiddenChange,
  showThreadEvents,
  onShowThreadEventsChange,
  explorerScrollTopRef,
  explorerScrollerRef,
  selectedNodeId,
  revealRequestKey,
  tree,
  rootError
}) {
  useI18n();
  const filePanel = useFilePanel();
  const visibleTree = useMemo4(
    () => ({
      ...tree,
      // Live artifacts have their own list; published artifacts (ELA-260) open
      // from Inspect and links only, never as a second copy of the files.
      children: tree.children.filter((node) => node.id !== "live" && node.id !== "artifacts")
    }),
    [tree]
  );
  const [filterOpen, setFilterOpen] = useState6(Boolean(filterQuery));
  const [filterResult, setFilterResult] = useState6({
    matchCount: 0,
    hasUnresolvedDirectories: false
  });
  const filterInputRef = useRef6(null);
  const openFilter = useCallback4(() => setFilterOpen(true), []);
  const handleFilterResultsChange = useCallback4(
    (result) => setFilterResult(result),
    []
  );
  useEffect6(() => {
    if (filterOpen) {
      window.requestAnimationFrame(() => filterInputRef.current?.focus());
    }
  }, [filterOpen]);
  function closeFilter() {
    onFilterQueryChange("");
    setFilterOpen(false);
  }
  return /* @__PURE__ */ jsxs6("aside", { className: "thread-graph-explorer flex h-full min-h-0 flex-col overflow-hidden rounded-md", children: [
    /* @__PURE__ */ jsxs6("div", { title: filePanel?.label, className: "thread-graph-explorer-header flex h-9 shrink-0 items-center justify-between border-b px-2", children: [
      /* @__PURE__ */ jsx7("h2", { className: "text-[11px] font-semibold uppercase text-slate-600 dark:text-slate-300", children: translate("files.explorer") }),
      /* @__PURE__ */ jsxs6("div", { className: "thread-graph-explorer-toolbar flex items-center gap-1", children: [
        filePanel?.setMinimized ? /* @__PURE__ */ jsxs6("span", { className: "thread-graph-window-controls", children: [
          /* @__PURE__ */ jsx7(
            "button",
            {
              type: "button",
              "data-testid": "workbench-close-files",
              className: "is-close",
              onClick: filePanel.close,
              "aria-label": translate("workbench.closeFiles"),
              title: translate("workbench.closeFiles"),
              children: /* @__PURE__ */ jsx7(X2, { "aria-hidden": "true" })
            }
          ),
          /* @__PURE__ */ jsx7(
            "button",
            {
              type: "button",
              className: "is-minimize",
              "aria-pressed": Boolean(filePanel.minimized),
              onClick: () => filePanel.setMinimized?.(!filePanel.minimized),
              "aria-label": translate(filePanel.minimized ? "workbench.restoreFiles" : "workbench.minimizeFiles"),
              title: translate(filePanel.minimized ? "workbench.restoreFiles" : "workbench.minimizeFiles"),
              children: filePanel.minimized ? /* @__PURE__ */ jsx7(Maximize2, { "aria-hidden": "true" }) : /* @__PURE__ */ jsx7(Minus, { "aria-hidden": "true" })
            }
          )
        ] }) : filePanel && onExpandViewer && /* @__PURE__ */ jsx7("button", { type: "button", "data-testid": "workbench-close-files", className: iconButtonClassName, onClick: filePanel.close, "aria-label": translate("workbench.closeFiles"), title: translate("workbench.closeFiles"), children: /* @__PURE__ */ jsx7(X2, { "data-icon": "close", size: 16 }) }),
        onCreateFile && /* @__PURE__ */ jsx7(
          "button",
          {
            type: "button",
            onClick: onCreateFile,
            className: iconButtonClassName,
            title: translate("files.newFile"),
            "aria-label": translate("files.newFile"),
            children: /* @__PURE__ */ jsx7(FilePlus2, { "data-icon": "new-file", className: "h-4 w-4" })
          }
        ),
        /* @__PURE__ */ jsx7(
          "button",
          {
            type: "button",
            onClick: openFilter,
            className: iconButtonClassName,
            title: translate("files.filterWorkspace"),
            "aria-label": translate("files.filterWorkspace"),
            "aria-pressed": filterOpen,
            children: /* @__PURE__ */ jsx7(Search, { "data-icon": "filter", className: "h-4 w-4" })
          }
        ),
        /* @__PURE__ */ jsx7(
          "button",
          {
            type: "button",
            onClick: onCollapseAll,
            className: iconButtonClassName,
            title: translate("files.collapseFolders"),
            "aria-label": translate("files.collapseFolders"),
            children: /* @__PURE__ */ jsx7(ListCollapse, { "data-icon": "collapse-folders", className: "h-4 w-4" })
          }
        ),
        /* @__PURE__ */ jsx7(
          "button",
          {
            type: "button",
            onClick: onRefresh,
            disabled: !onRefresh || pending,
            className: iconButtonClassName,
            title: translate("files.refreshWorkspace"),
            "aria-label": translate("files.refreshWorkspace"),
            children: /* @__PURE__ */ jsx7(
              RefreshCw,
              {
                "data-icon": "refresh",
                className: `h-4 w-4 motion-reduce:animate-none ${loading ? "animate-spin" : ""}`
              }
            )
          }
        ),
        canUpload || onDownloadWorkspace || onDownloadWorkspaceZip || onImportArchive && canImportArchive || onTrashFile || onOpenTrash || onMoveFile || onDeleteFile || onEmptyGarbage || onShowHiddenChange || onShowThreadEventsChange ? /* @__PURE__ */ jsx7(ExplorerMoreMenu, { triggerClassName: iconButtonClassName, children: (close) => /* @__PURE__ */ jsxs6(Fragment5, { children: [
          onShowHiddenChange ? /* @__PURE__ */ jsxs6(
            "button",
            {
              type: "button",
              role: "menuitemcheckbox",
              "aria-checked": Boolean(showHidden),
              onClick: () => {
                close();
                onShowHiddenChange(!showHidden);
              },
              className: "flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-[var(--theme-hover)] focus-visible:bg-[var(--theme-hover)] focus-visible:outline-none",
              children: [
                /* @__PURE__ */ jsx7(Eye, { "data-icon": "show-hidden", className: "h-4 w-4" }),
                /* @__PURE__ */ jsx7("span", { className: "flex-1", children: translate("files.showHiddenFiles") }),
                showHidden ? /* @__PURE__ */ jsx7(Check2, { "aria-hidden": "true", className: "h-4 w-4" }) : null
              ]
            }
          ) : null,
          onShowThreadEventsChange ? /* @__PURE__ */ jsxs6(
            "button",
            {
              type: "button",
              role: "menuitemcheckbox",
              "aria-checked": Boolean(showThreadEvents),
              onClick: () => {
                close();
                onShowThreadEventsChange(!showThreadEvents);
              },
              className: "flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-[var(--theme-hover)] focus-visible:bg-[var(--theme-hover)] focus-visible:outline-none",
              children: [
                /* @__PURE__ */ jsx7(ListTree, { "data-icon": "show-thread-events", className: "h-4 w-4" }),
                /* @__PURE__ */ jsx7("span", { className: "flex-1", children: translate("files.showThreadEvents") }),
                showThreadEvents ? /* @__PURE__ */ jsx7(Check2, { "aria-hidden": "true", className: "h-4 w-4" }) : null
              ]
            }
          ) : null,
          canUpload ? /* @__PURE__ */ jsxs6(
            "button",
            {
              type: "button",
              role: "menuitem",
              onClick: () => {
                close();
                onUpload?.();
              },
              disabled: pending,
              className: "flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-[var(--theme-hover)] focus-visible:bg-[var(--theme-hover)] focus-visible:outline-none",
              children: [
                /* @__PURE__ */ jsx7(Upload, { "data-icon": "upload", className: "h-4 w-4" }),
                translate("files.uploadFile")
              ]
            }
          ) : null,
          onDownloadWorkspace && downloadFormats.includes("tar") ? /* @__PURE__ */ jsxs6(
            "button",
            {
              type: "button",
              role: "menuitem",
              onClick: () => {
                close();
                onDownloadWorkspace();
              },
              disabled: pending || (canDownload ? !canDownload(tree) : false),
              className: "flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-[var(--theme-hover)] focus-visible:bg-[var(--theme-hover)] focus-visible:outline-none disabled:opacity-50",
              children: [
                /* @__PURE__ */ jsx7(Download2, { "data-icon": "download", className: "h-4 w-4" }),
                "Download workspace (TAR)"
              ]
            }
          ) : null,
          onDownloadWorkspaceZip && downloadFormats.includes("zip") ? /* @__PURE__ */ jsxs6(
            "button",
            {
              type: "button",
              role: "menuitem",
              onClick: () => {
                close();
                onDownloadWorkspaceZip();
              },
              disabled: pending || (canDownload ? !canDownload(tree) : false),
              className: "flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-[var(--theme-hover)] focus-visible:bg-[var(--theme-hover)] focus-visible:outline-none disabled:opacity-50",
              children: [
                /* @__PURE__ */ jsx7(FileArchive3, { "data-icon": "download-zip", className: "h-4 w-4" }),
                "Download workspace (ZIP)"
              ]
            }
          ) : null,
          onImportArchive && canImportArchive && importFormats.length > 0 ? /* @__PURE__ */ jsxs6(
            "button",
            {
              type: "button",
              role: "menuitem",
              onClick: () => {
                close();
                onImportArchive();
              },
              disabled: pending,
              title: `${importFormats.map((format) => format.toUpperCase()).join(" / ")}. ${archiveLimits ?? "Extraction limits are enforced by the server."} Regular uploads store archive bytes without extraction.`,
              className: "flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-[var(--theme-hover)] focus-visible:bg-[var(--theme-hover)] focus-visible:outline-none disabled:opacity-50",
              children: [
                /* @__PURE__ */ jsx7(PackageOpen, { "data-icon": "import-archive", className: "h-4 w-4" }),
                importFormats.includes("zip") ? "Import archive" : "Import TAR archive"
              ]
            }
          ) : null,
          onMoveFile ? /* @__PURE__ */ jsxs6(
            "button",
            {
              type: "button",
              role: "menuitem",
              onClick: () => {
                close();
                onMoveFile();
              },
              disabled: pending || !canMove,
              title: canMove ? "Move selected file to a new path" : "Select a workspace file first.",
              className: "flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-[var(--theme-hover)] focus-visible:bg-[var(--theme-hover)] focus-visible:outline-none disabled:opacity-50",
              children: [
                /* @__PURE__ */ jsx7(FolderInput, { "data-icon": "move", className: "h-4 w-4" }),
                "Move selected file"
              ]
            }
          ) : null,
          onTrashFile ? /* @__PURE__ */ jsxs6(
            "button",
            {
              type: "button",
              role: "menuitem",
              onClick: () => {
                close();
                onTrashFile();
              },
              disabled: pending || !canTrash,
              title: canTrash ? "Move the selected file to Trash" : "Select a workspace file first.",
              className: "flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-[var(--theme-hover)] focus-visible:bg-[var(--theme-hover)] focus-visible:outline-none disabled:opacity-50",
              children: [
                /* @__PURE__ */ jsx7(Trash22, { "data-icon": "trash", className: "h-4 w-4" }),
                "Move selected file to Trash"
              ]
            }
          ) : null,
          onOpenTrash ? /* @__PURE__ */ jsxs6(
            "button",
            {
              type: "button",
              role: "menuitem",
              onClick: () => {
                close();
                onOpenTrash();
              },
              disabled: pending,
              className: "flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-[var(--theme-hover)] focus-visible:bg-[var(--theme-hover)] focus-visible:outline-none disabled:opacity-50",
              children: [
                /* @__PURE__ */ jsx7(ArchiveRestore, { "data-icon": "open-trash", className: "h-4 w-4" }),
                "Trash"
              ]
            }
          ) : null,
          onDeleteFile ? /* @__PURE__ */ jsxs6(
            "button",
            {
              type: "button",
              role: "menuitem",
              onClick: () => {
                close();
                onDeleteFile();
              },
              disabled: pending || !canDelete,
              title: canDelete ? "Confirm permanent deletion of selected file" : "Select a workspace file first.",
              className: "flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm text-rose-600 hover:bg-rose-500/10 focus-visible:bg-rose-500/10 focus-visible:outline-none disabled:opacity-50 dark:text-rose-300",
              children: [
                /* @__PURE__ */ jsx7(Trash22, { "data-icon": "delete", className: "h-4 w-4" }),
                "Delete selected file\u2026"
              ]
            }
          ) : null,
          onEmptyGarbage ? /* @__PURE__ */ jsxs6(
            "button",
            {
              type: "button",
              role: "menuitem",
              onClick: () => {
                close();
                onEmptyGarbage();
              },
              disabled: pending || !canEmptyGarbage,
              className: "flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm text-rose-600 hover:bg-rose-500/10 focus-visible:bg-rose-500/10 focus-visible:outline-none disabled:opacity-50 dark:text-rose-300",
              children: [
                /* @__PURE__ */ jsx7(Trash22, { "data-icon": "delete", className: "h-4 w-4" }),
                translate("files.emptyGarbage_b701de")
              ]
            }
          ) : null
        ] }) }) : null,
        onExpandViewer ? expandViewerAvailable ? /* @__PURE__ */ jsx7(
          "button",
          {
            type: "button",
            "data-testid": "expand-viewer",
            onClick: onExpandViewer,
            className: collapseButtonClassName,
            title: translate("files.showEditor"),
            "aria-label": translate("files.showEditor"),
            children: /* @__PURE__ */ jsx7(PanelRightOpen, { "data-icon": "expand-viewer", className: "h-4 w-4" })
          }
        ) : null : onCollapse ? /* @__PURE__ */ jsx7(
          "button",
          {
            type: "button",
            "data-testid": "collapse-explorer",
            onClick: onCollapse,
            className: collapseButtonClassName,
            title: translate("files.hideExplorer"),
            "aria-label": translate("files.hideExplorer"),
            children: /* @__PURE__ */ jsx7(PanelLeftClose, { "data-icon": "collapse-explorer", className: "h-4 w-4" })
          }
        ) : null
      ] })
    ] }),
    filterOpen ? /* @__PURE__ */ jsxs6("div", { className: "thread-graph-explorer-filter shrink-0 border-b border-[var(--theme-border)] px-3 py-2", children: [
      /* @__PURE__ */ jsxs6("div", { className: "flex flex-col gap-1.5", children: [
        /* @__PURE__ */ jsxs6("div", { className: "flex w-full min-w-0 items-center gap-2 rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface-strong)] px-2", children: [
          /* @__PURE__ */ jsx7(Search, { className: "h-3.5 w-3.5 shrink-0 text-[var(--theme-fg-muted)]" }),
          /* @__PURE__ */ jsx7(
            "input",
            {
              ref: filterInputRef,
              value: filterQuery,
              onChange: (event) => onFilterQueryChange(event.currentTarget.value),
              onKeyDown: (event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  if (filterQuery) {
                    onFilterQueryChange("");
                  } else {
                    closeFilter();
                  }
                }
              },
              className: "h-8 min-w-0 flex-1 bg-transparent text-sm text-[var(--theme-fg)] outline-none",
              placeholder: translate("files.filterLoadedFiles"),
              "aria-label": translate("files.filterWorkspaceFiles")
            }
          ),
          /* @__PURE__ */ jsx7(
            "button",
            {
              type: "button",
              onClick: closeFilter,
              className: "inline-flex h-7 w-7 items-center justify-center rounded text-[var(--theme-fg-muted)] hover:bg-[var(--theme-hover)] hover:text-[var(--theme-fg)]",
              title: translate("files.closeFilter"),
              "aria-label": translate("files.closeFilter"),
              children: /* @__PURE__ */ jsx7(X2, { className: "h-3.5 w-3.5" })
            }
          )
        ] }),
        /* @__PURE__ */ jsx7(
          "div",
          {
            className: "thread-graph-explorer-filter-mode inline-flex shrink-0 self-end rounded-md border border-[var(--theme-border)] p-0.5",
            role: "group",
            "aria-label": translate("files.explorerFilterMode"),
            children: ["filter", "highlight"].map((mode) => /* @__PURE__ */ jsx7(
              "button",
              {
                type: "button",
                onClick: () => onFilterModeChange(mode),
                className: `h-7 rounded px-2 text-xs ${filterMode === mode ? "is-active" : ""}`,
                "aria-pressed": filterMode === mode,
                title: mode === "filter" ? translate("files.showMatchesOnly") : translate("files.highlightMatches"),
                children: mode === "filter" ? translate("files.filter") : translate("files.highlight")
              },
              mode
            ))
          }
        )
      ] }),
      filterQuery ? /* @__PURE__ */ jsxs6(
        "div",
        {
          className: "mt-1.5 text-xs text-[var(--theme-fg-muted)]",
          "aria-live": "polite",
          children: [
            filterResult.matchCount,
            " ",
            filterResult.matchCount === 1 ? translate("files.match") : translate("files.matches"),
            filterResult.hasUnresolvedDirectories ? translate("files.inLoadedFolders") : ""
          ]
        }
      ) : null
    ] }) : null,
    liveNodes.length > 0 ? /* @__PURE__ */ jsxs6("div", { className: "shrink-0 border-b border-slate-200 py-2 dark:border-[#2a2f3a]", children: [
      /* @__PURE__ */ jsx7("div", { className: "thread-graph-workspace-label px-3 pb-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400", children: translate("files.live") }),
      liveNodes.map((node) => /* @__PURE__ */ jsxs6(
        "button",
        {
          type: "button",
          "data-testid": "live-molecule-item",
          "data-molecule-id": node.artifact?.id ?? node.id,
          onClick: () => onSelect(node.id),
          className: `thread-graph-tree-row flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm transition sm:min-h-7 sm:py-1 ${selectedNodeId === node.id ? "is-selected" : ""}`,
          children: [
            /* @__PURE__ */ jsx7(FileCode22, { className: "h-4 w-4 shrink-0 text-sky-700 dark:text-sky-300" }),
            /* @__PURE__ */ jsx7("span", { className: "min-w-0 flex-1 truncate", children: node.name })
          ]
        },
        node.id
      ))
    ] }) : null,
    initialLoading ? /* @__PURE__ */ jsx7(
      "div",
      {
        className: "workspace-loading-skeleton flex-1 space-y-1 px-3 py-2",
        role: "status",
        "aria-label": translate("files.loadingWorkspaceFiles"),
        children: [0, 1, 2, 3, 4].map((index) => /* @__PURE__ */ jsx7(
          "div",
          {
            className: "h-7 animate-pulse rounded bg-[var(--theme-surface-strong)] motion-reduce:animate-none",
            style: { width: `${72 - index * 6}%` }
          },
          index
        ))
      }
    ) : rootError ? /* @__PURE__ */ jsxs6("div", { role: "alert", className: "mx-3 mt-2 rounded-md border border-rose-500/25 bg-rose-500/10 px-3 py-3 text-sm text-rose-700 dark:text-rose-200", children: [
      /* @__PURE__ */ jsx7("p", { children: rootError }),
      /* @__PURE__ */ jsx7(
        "button",
        {
          type: "button",
          onClick: onRefresh,
          className: "mt-2 h-8 rounded px-2 font-medium hover:bg-rose-500/10",
          children: translate("files.retry")
        }
      )
    ] }) : /* @__PURE__ */ jsx7(
      WorkspaceExplorerTree,
      {
        tree: visibleTree,
        expandedPaths,
        filterMode,
        filterQuery,
        compactFolders,
        directoryErrors,
        loadingPaths,
        selectedNodeId,
        revealRequestKey,
        scrollerRef: explorerScrollerRef,
        scrollTopRef: explorerScrollTopRef,
        ...onCopyPath ? { onCopyPath } : {},
        ...onRename ? { onRename } : {},
        ...onDelete ? { onDelete } : {},
        ...onDownload ? { onDownload } : {},
        ...onDownloadZip ? { onDownloadZip } : {},
        ...canDownload ? { canDownload } : {},
        onOpenFilter: openFilter,
        onFilterResultsChange: handleFilterResultsChange,
        ...onPreview ? { onPreview } : {},
        ...onPin ? { onPin } : {},
        ...onRetryDirectory ? { onRetryDirectory } : {},
        onSelect: (node) => {
          onSelect(node.id);
          onSelectNode?.(node);
        },
        onToggle
      }
    ),
    !initialLoading && !rootError && filterQuery && filterMode === "filter" && filterResult.matchCount === 0 ? /* @__PURE__ */ jsx7("p", { className: "thread-graph-workspace-empty mx-4 mb-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-[#303642] dark:bg-[#1b1f29] dark:text-slate-400", children: translate("files.noMatchesInLoadedFolders") }) : visibleTree.children.length === 0 ? /* @__PURE__ */ jsx7("p", { className: "thread-graph-workspace-empty mx-4 mb-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-[#303642] dark:bg-[#1b1f29] dark:text-slate-400", children: translate("files.thisWorkspaceIsEmptyAgentToolRuns") }) : null
  ] });
}
function ExplorerMoreMenu({ triggerClassName, children }) {
  const [open, setOpen] = useState6(false);
  const trigger = useRef6(null);
  const menu = useRef6(null);
  const close = (restore = false) => {
    setOpen(false);
    if (restore) trigger.current?.focus();
  };
  useMenuKeyboard(menu, open, close);
  useEffect6(() => {
    if (!open) return;
    const outside = (event) => {
      if (!menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return /* @__PURE__ */ jsxs6("div", { className: "thread-graph-explorer-more relative", children: [
    /* @__PURE__ */ jsx7(
      "button",
      {
        ref: trigger,
        type: "button",
        className: triggerClassName,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        title: translate("files.moreExplorerActions"),
        "aria-label": translate("files.moreExplorerActions"),
        onClick: () => setOpen((value) => !value),
        children: /* @__PURE__ */ jsx7(MoreHorizontal2, { "data-icon": "more", className: "h-4 w-4" })
      }
    ),
    open ? /* @__PURE__ */ jsx7(
      "div",
      {
        ref: menu,
        role: "menu",
        "aria-label": translate("files.moreExplorerActions"),
        className: "absolute right-0 top-7 z-40 min-w-44 rounded-md border border-[var(--theme-border)] bg-[var(--theme-panel)] p-1 shadow-lg",
        children: children(() => close(true))
      }
    ) : null
  ] });
}

// src/components/graph-workspace/GraphWorkspacePreviewPane.tsx
import {
  createContext,
  useContext,
  lazy,
  memo,
  Suspense,
  useEffect as useEffect9,
  useLayoutEffect as useLayoutEffect2,
  useMemo as useMemo6,
  useRef as useRef9,
  useState as useState9
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Code2,
  Download as Download4,
  ExternalLink,
  FileQuestion,
  FileText,
  Pencil as Pencil2,
  PanelLeftOpen,
  MoreHorizontal as MoreHorizontal3,
  PanelRightClose,
  Save,
  X as X4
} from "lucide-react";

// src/components/graph-workspace/WorkspaceFileMenu.tsx
import { Download as Download3, RefreshCw as RefreshCw2 } from "lucide-react";
import { useEffect as useEffect7, useRef as useRef7, useState as useState7 } from "react";
import { jsx as jsx8, jsxs as jsxs7 } from "react/jsx-runtime";
function WorkspaceFileActions({ children, metadata, path, relativePath, onDownload, onRefresh }) {
  useI18n();
  const [busy, setBusy] = useState7(false);
  const [feedback, setFeedback] = useState7(null);
  const [error, setError] = useState7(null);
  const generation = useRef7(0);
  useEffect7(() => () => {
    generation.current++;
  }, []);
  return /* @__PURE__ */ jsxs7("div", { className: "workspace-file-actions", role: "toolbar", "aria-label": translate("files.fileActions"), title: metadata, children: [
    children,
    onRefresh && /* @__PURE__ */ jsx8("button", { type: "button", className: "thread-graph-editor-toolbar-button", disabled: busy, title: translate("files.reloadFile"), "aria-label": translate("files.reloadFile"), onClick: async () => {
      const current = generation.current;
      setBusy(true);
      setFeedback(null);
      setError(null);
      try {
        const result = await onRefresh();
        if (current === generation.current) setFeedback(result);
      } catch (cause) {
        if (current === generation.current) setError(cause instanceof Error ? cause.message : translate("files.fileOperationFailed"));
      } finally {
        if (current === generation.current) setBusy(false);
      }
    }, children: /* @__PURE__ */ jsx8(RefreshCw2, { size: 15, className: busy ? "animate-spin motion-reduce:animate-none" : "" }) }),
    onDownload && /* @__PURE__ */ jsx8("button", { type: "button", className: "thread-graph-editor-toolbar-button", title: translate("files.downloadFile"), "aria-label": translate("files.downloadFile"), onClick: onDownload, children: /* @__PURE__ */ jsx8(Download3, { size: 15 }) }),
    /* @__PURE__ */ jsx8(CopyButton, { value: relativePath || path, label: translate("common.copyPath") }),
    feedback && /* @__PURE__ */ jsx8("span", { role: "status", className: "workspace-file-action-feedback", title: feedback, children: feedback }),
    error && /* @__PURE__ */ jsx8("span", { role: "alert", className: "workspace-file-action-feedback is-error", title: error, children: error })
  ] });
}

// src/components/graph-workspace/GraphWorkspacePreviewPane.tsx
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

// src/components/graph-workspace/GraphWorkspaceCards.tsx
import { jsx as jsx9, jsxs as jsxs8 } from "react/jsx-runtime";
function WorkspaceInfoCard({
  label,
  children
}) {
  return /* @__PURE__ */ jsxs8("section", { className: "thread-workspace-card rounded-lg border p-3", children: [
    /* @__PURE__ */ jsx9("p", { className: "text-xs font-medium uppercase tracking-[0.14em] text-[var(--theme-fg-muted)]", children: label }),
    /* @__PURE__ */ jsx9("div", { className: "mt-2 text-sm text-[var(--theme-fg)]", children })
  ] });
}

// src/components/graph-workspace/GraphDrawioPreview.tsx
import { useMemo as useMemo5 } from "react";
import { jsx as jsx10 } from "react/jsx-runtime";
var DRAWIO_VIEWER_PATH = "/vendor/drawio/viewer-static.v32.3.0.min.js";
var DRAWIO_BOOTSTRAP_PATH = "/vendor/drawio/bootstrap.v1.js";
function drawioPreviewDocument(xml, origin) {
  const viewerUrl = new URL(DRAWIO_VIEWER_PATH, origin).href;
  const bootstrapUrl = new URL(DRAWIO_BOOTSTRAP_PATH, origin).href;
  const data = JSON.stringify(xml).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  return `<!doctype html><html lang="${getLocale()}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${viewerUrl} ${bootstrapUrl}; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; base-uri 'none'; form-action 'none'">
<style>html,body{height:100%;margin:0;background:#fff;color:#222;font:14px system-ui;overflow:hidden}#diagram{position:absolute;inset:0;overflow:auto}#error{padding:20px;white-space:pre-wrap}button,select{font:inherit}</style>
</head><body><div id="diagram"></div><p id="loading" role="status">${translate("files.loadingDiagram")}</p><div id="error" role="alert" hidden></div>
<script id="diagram-data" type="application/json">${data}</script>
<script src="${bootstrapUrl}"></script></body></html>`;
}
function GraphDrawioPreview({ content, name, truncated }) {
  const { locale } = useI18n();
  const srcDoc = useMemo5(() => drawioPreviewDocument(content, typeof window === "undefined" ? "http://localhost" : window.location.origin), [content, locale]);
  if (truncated) return /* @__PURE__ */ jsx10("p", { role: "status", className: "p-5 text-sm", children: translate("files.diagramPreviewRequiresTheCompleteFileLoad") });
  return /* @__PURE__ */ jsx10(
    "iframe",
    {
      title: translate("files.drawIoPreview", { value1: name }),
      sandbox: "allow-scripts",
      referrerPolicy: "no-referrer",
      srcDoc,
      className: "min-h-0 w-full flex-1 border-0",
      style: { minHeight: 260, background: "#fff" }
    }
  );
}

// src/components/graph-workspace/WorkspaceFileTabs.tsx
import { Circle, FileCode2 as FileCode23, X as X3 } from "lucide-react";
import { useEffect as useEffect8, useRef as useRef8, useState as useState8 } from "react";
import { jsx as jsx11, jsxs as jsxs9 } from "react/jsx-runtime";
function WorkspaceFileTabs({
  activePath,
  dirtyPaths,
  onClose,
  onSelect,
  tabs,
  trailingAction,
  leadingAction,
  onSaveAndClose,
  blockedClosePaths = /* @__PURE__ */ new Set()
}) {
  useI18n();
  const tabsRef = useRef8(null);
  const scrollEdges = useTabScrollEdges(tabsRef);
  useEffect8(() => {
    tabsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activePath, tabs.length]);
  const [pendingClosePath, setPendingClosePath] = useState8(null);
  const [savingClose, setSavingClose] = useState8(false);
  const pendingTab = tabs.find((tab) => tab.path === pendingClosePath) ?? null;
  if (tabs.length === 0) {
    return null;
  }
  function requestClose(path) {
    if (dirtyPaths.has(path)) {
      setPendingClosePath(path);
      return;
    }
    onClose(path);
  }
  return /* @__PURE__ */ jsxs9("div", { className: "thread-graph-editor-tabs-shell shrink-0", children: [
    /* @__PURE__ */ jsxs9("div", { className: "workspace-file-toolbar flex min-w-0 border-b border-[var(--theme-border)]", children: [
      leadingAction && /* @__PURE__ */ jsx11("div", { className: "workspace-file-navigation flex shrink-0 items-center", children: leadingAction }),
      /* @__PURE__ */ jsxs9("div", { className: "tab-scroll-surface workspace-tab-scroll", ...scrollEdges, children: [
        /* @__PURE__ */ jsx11(
          "div",
          {
            ref: tabsRef,
            className: "thread-graph-editor-tabs flex min-w-0 flex-1 overflow-x-auto",
            role: "tablist",
            "aria-label": translate("files.openWorkspaceFiles"),
            children: tabs.map((tab) => {
              const active = tab.path === activePath;
              const dirty = dirtyPaths.has(tab.path);
              return /* @__PURE__ */ jsxs9(
                "div",
                {
                  className: `thread-graph-editor-tab group/tab flex h-8 min-w-0 max-w-52 shrink-0 items-center border-r ${active ? "is-active" : ""} ${tab.pinned ? "is-pinned" : "is-preview"}`,
                  role: "presentation",
                  children: [
                    /* @__PURE__ */ jsxs9(
                      "button",
                      {
                        type: "button",
                        role: "tab",
                        "aria-selected": active,
                        title: tab.path,
                        onClick: () => onSelect(tab.path),
                        className: `flex h-full min-w-0 flex-1 items-center gap-1.5 px-2.5 text-left text-xs ${tab.pinned ? "" : "italic"}`,
                        children: [
                          /* @__PURE__ */ jsx11(FileCode23, { "data-icon": "code", className: "h-3.5 w-3.5 shrink-0 text-sky-700 dark:text-sky-300" }),
                          /* @__PURE__ */ jsx11(MiddleName, { name: tab.name, className: "workspace-file-tab-name" })
                        ]
                      }
                    ),
                    /* @__PURE__ */ jsx11(
                      "button",
                      {
                        type: "button",
                        onClick: () => requestClose(tab.path),
                        className: "thread-graph-editor-tab-close mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded",
                        title: translate("files.close_069e97", { value1: tab.name }),
                        "aria-label": translate("files.close_069e97", { value1: tab.name }),
                        children: dirty ? /* @__PURE__ */ jsx11(Circle, { "data-icon": "unsaved", className: "h-2.5 w-2.5 fill-current" }) : /* @__PURE__ */ jsx11(X3, { "data-icon": "close", className: "h-3.5 w-3.5" })
                      }
                    )
                  ]
                },
                tab.path
              );
            })
          }
        ),
        /* @__PURE__ */ jsx11(TabScrollButtons, { targetRef: tabsRef, edges: scrollEdges })
      ] }),
      trailingAction ? /* @__PURE__ */ jsx11("div", { className: "thread-graph-editor-tabs-action flex h-8 shrink-0 items-center px-1", children: trailingAction }) : null
    ] }),
    /* @__PURE__ */ jsx11(
      ConfirmDialog,
      {
        open: Boolean(pendingTab),
        title: pendingTab ? `${translate("files.discardUnsavedChangesIn")} ${pendingTab.name}?` : "",
        description: translate("files.safeDiscard"),
        cancelLabel: translate("files.keepEditing"),
        confirmLabel: translate("files.discard"),
        busy: savingClose,
        ...onSaveAndClose && pendingTab && !blockedClosePaths.has(pendingTab.path) ? {
          secondaryLabel: translate("files.safeSaveClose"),
          onSecondary: async () => {
            setSavingClose(true);
            try {
              await onSaveAndClose(pendingTab.path);
            } finally {
              setSavingClose(false);
              setPendingClosePath(null);
            }
          }
        } : {},
        onCancel: () => setPendingClosePath(null),
        onConfirm: () => {
          if (!pendingTab || blockedClosePaths.has(pendingTab.path)) return;
          setPendingClosePath(null);
          onClose(pendingTab.path);
        }
      }
    )
  ] });
}

// src/components/graph-workspace/GraphWorkspacePreviewPane.tsx
import { Fragment as Fragment6, jsx as jsx12, jsxs as jsxs10 } from "react/jsx-runtime";
var GraphWorkspaceMonacoEditor = lazy(
  () => import("./GraphWorkspaceMonacoEditor-UNLIUZZI.js")
);
var isHostFilePath = (path) => path.startsWith("/") || /^[a-z]:[\\/]/i.test(path);
function fileSizeLabel(size) {
  return size === void 0 ? null : size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
function canShowInlinePdf(nav = typeof navigator === "undefined" ? void 0 : navigator) {
  return nav?.pdfViewerEnabled !== false;
}
function WorkspacePdfPreview({ src, node }) {
  useI18n();
  const name = node.name || node.path.split("/").pop() || node.path;
  if (canShowInlinePdf()) {
    return /* @__PURE__ */ jsx12("div", { className: "thread-graph-file-preview-frame min-h-0 flex-1 overflow-hidden", children: /* @__PURE__ */ jsx12("iframe", { src, title: translate("files.pDFPreview", { value1: node.path || node.name }), className: "h-full w-full border-0" }) });
  }
  const sizeLabel = fileSizeLabel(node.size);
  return /* @__PURE__ */ jsxs10("div", { className: "thread-graph-download-preview", "data-testid": "workspace-pdf-actions", children: [
    /* @__PURE__ */ jsx12(FileText, { "aria-hidden": "true", className: "thread-graph-download-preview-icon" }),
    /* @__PURE__ */ jsx12("strong", { children: name }),
    sizeLabel ? /* @__PURE__ */ jsx12("span", { children: sizeLabel }) : null,
    /* @__PURE__ */ jsx12("p", { children: translate("files.pdfOpenOrDownload") }),
    /* @__PURE__ */ jsxs10("div", { className: "thread-graph-download-preview-actions", children: [
      /* @__PURE__ */ jsxs10("a", { href: src, target: "_blank", rel: "noopener", "aria-label": translate("files.openPdfInNewTab", { value1: name }), children: [
        /* @__PURE__ */ jsx12(ExternalLink, { "aria-hidden": "true", size: 16 }),
        translate("files.openPdf")
      ] }),
      /* @__PURE__ */ jsxs10("a", { href: src, download: name, "aria-label": translate("files.download", { value1: name }), children: [
        /* @__PURE__ */ jsx12(Download4, { "aria-hidden": "true", size: 16 }),
        translate("files.downloadFile")
      ] })
    ] })
  ] });
}
function DownloadFilePreview({ node, onDownload, readOnlyReason }) {
  const { locale: i18nLocale } = useI18n();
  const [pending, setPending] = useState9(false);
  const [error, setError] = useState9(null);
  const sizeLabel = fileSizeLabel(node.size);
  return /* @__PURE__ */ jsxs10("div", { className: "thread-graph-download-preview", children: [
    /* @__PURE__ */ jsx12(Download4, { "aria-hidden": "true", className: "thread-graph-download-preview-icon" }),
    /* @__PURE__ */ jsx12("strong", { children: node.name }),
    sizeLabel ? /* @__PURE__ */ jsx12("span", { children: sizeLabel }) : null,
    /* @__PURE__ */ jsx12("p", { children: translate("files.thisFileIsAvailableToDownload") }),
    readOnlyReason ? /* @__PURE__ */ jsx12("p", { children: translateReadOnly(readOnlyReason) }) : null,
    onDownload ? /* @__PURE__ */ jsxs10(
      "button",
      {
        type: "button",
        disabled: pending,
        "aria-label": translate("files.download", { value1: node.name }),
        onClick: async () => {
          setPending(true);
          setError(null);
          try {
            await onDownload();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : translate("files.downloadFailedPleaseTryAgain"));
          } finally {
            setPending(false);
          }
        },
        children: [
          /* @__PURE__ */ jsx12(Download4, { "aria-hidden": "true", size: 16 }),
          pending ? translate("files.downloading") : translate("files.downloadFile")
        ]
      }
    ) : /* @__PURE__ */ jsx12("span", { children: translate("files.downloadsAreUnavailableForThisConnection") }),
    error ? /* @__PURE__ */ jsx12("p", { role: "alert", children: error }) : null
  ] });
}
function AlertDownloadButton({ name, onDownload }) {
  const [pending, setPending] = useState9(false);
  return /* @__PURE__ */ jsxs10(
    "button",
    {
      type: "button",
      className: "workspace-file-alert-download",
      disabled: pending,
      "aria-label": translate("files.download", { value1: name }),
      onClick: async () => {
        setPending(true);
        try {
          await onDownload();
        } catch {
        } finally {
          setPending(false);
        }
      },
      children: [
        /* @__PURE__ */ jsx12(Download4, { "aria-hidden": "true", size: 14 }),
        pending ? translate("files.downloading") : translate("files.downloadShort")
      ]
    }
  );
}
function translateReadOnly(reason) {
  const key = `files.safeReason.${reason}`;
  return Object.hasOwn(en, key) ? translate(key) : reason;
}
var WorkspaceDocumentDiff = lazy(() => import("./GraphWorkspaceMonacoDiff-LBMIVAET.js"));
var SMALL_TEXT_FILE_MAX_BYTES = 50 * 1024;
var SMALL_TEXT_FILE_MAX_LINES = 1e3;
var MARKDOWN_EXTENSIONS = /* @__PURE__ */ new Set(["md", "markdown"]);
var CODE_LANGUAGE_ALIASES = {
  cs: "csharp",
  jsonl: "json",
  md: "markdown",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  yml: "yaml"
};
function transparentHighlightBackground(html) {
  return html.replace(/background-color:[^;"]+;?/g, "background-color: transparent;").replace(/background:[^;"]+;?/g, "background: transparent;");
}
function resolveWorkspaceMarkdownPath({ markdownPath, resourceUrl, workspaceRootPath = "" }) {
  const raw = localFileHref(resourceUrl, typeof window === "undefined" ? void 0 : window.location.origin);
  if (!raw) return null;
  const path = raw.split("#")[0] ?? "";
  if (path.startsWith("/") || /^[a-z]:\//i.test(path)) {
    return workspaceRootPath ? relativeWorkspacePath(path, workspaceRootPath) : path.replace(/^\/+/, "");
  }
  const base = workspaceRootPath ? relativeWorkspacePath(markdownPath, workspaceRootPath) : normalizeFileSystemPath(markdownPath);
  if (base === null) return null;
  const directory = base.slice(0, Math.max(0, base.lastIndexOf("/")));
  return relativeWorkspacePath(directory ? `${directory}/${path}` : path, workspaceRootPath);
}
function resolveLinkedMarkdownPath({ markdownPath, resourceUrl, workspaceRootPath = "" }) {
  const markdown = normalizeFileSystemPath(markdownPath);
  const prefix = /^[a-z]:\//i.exec(markdown)?.[0] ?? (markdown.startsWith("/") && !markdown.startsWith("//") ? "/" : null);
  if (!prefix || workspaceRootPath && relativeWorkspacePath(markdown, workspaceRootPath) !== null) return null;
  const raw = localFileHref(resourceUrl, typeof window === "undefined" ? void 0 : window.location.origin);
  const path = raw?.split("#")[0] ?? "";
  if (!path || path.startsWith("/") || /^[a-z]:\//i.test(path)) return null;
  const segments = [];
  const parts = markdown.slice(prefix.length).split("/");
  for (const part of [...parts.slice(0, -1), ...path.split("/")]) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!segments.length) return null;
      segments.pop();
    } else segments.push(part);
  }
  return segments.length ? prefix + segments.join("/") : null;
}
function isSmallEditableTextFile(file) {
  return !file.truncated && file.size <= SMALL_TEXT_FILE_MAX_BYTES && file.content.split("\n").length <= SMALL_TEXT_FILE_MAX_LINES;
}
function previewTargetTitle(target) {
  if (!target) {
    return null;
  }
  const artifact = target.kind === "artifact" ? target.node.artifact : void 0;
  if (artifact) {
    const name = artifact.workspacePath || artifact.title || artifact.id;
    const time = Date.parse(artifact.createdAt);
    return Number.isFinite(time) && time > 0 ? translate("files.publishedVersionAt", { name, time: new Date(time).toLocaleString(getLocale()) }) : translate("files.publishedVersionOf", { name });
  }
  return target.node.path || target.node.name || null;
}
function graphWorkspacePreviewTargetFromNode(node) {
  if (!node) {
    return null;
  }
  switch (node.kind) {
    case "live-artifact":
      return { kind: "live-molecule", node };
    case "file":
      return { kind: "workspace-file", node };
    case "artifact":
      return { kind: "artifact", node };
    case "event":
      return { kind: "event", node };
    case "meta":
      return { kind: "meta", node };
    case "directory":
      return null;
  }
}
var GraphWorkspaceCodePreview = memo(function GraphWorkspaceCodePreview2({
  content,
  focusLine,
  language = "text"
}) {
  const { locale: i18nLocale } = useI18n();
  const rootRef = useRef9(null);
  const [highlighter, setHighlighter] = useState9(null);
  const [dark, setDark] = useState9(false);
  useEffect9(() => {
    let alive = true;
    getGraphChatHighlighter().then((loadedHighlighter) => {
      if (alive) {
        setHighlighter(loadedHighlighter);
      }
    }).catch(() => void 0);
    return () => {
      alive = false;
    };
  }, []);
  useEffect9(() => {
    const shell = rootRef.current?.closest(".thread-ui-shell");
    const readDark = () => shell ? shell.getAttribute("data-theme-effective") === "dark" || shell.classList.contains("dark") || shell.classList.contains("thread-ui-theme-dark") : document.documentElement.classList.contains("dark");
    setDark(readDark());
    if (!shell) {
      return;
    }
    const observer = new MutationObserver(() => setDark(readDark()));
    observer.observe(shell, {
      attributes: true,
      attributeFilter: ["class", "data-theme-effective"]
    });
    return () => observer.disconnect();
  }, []);
  const syntaxTheme = syntaxThemeFor(dark, useThemeFeature("code.cssSyntaxPalette"));
  const highlightedHtml = useMemo6(() => {
    if (!highlighter) {
      return "";
    }
    const loadedLanguages = highlighter.getLoadedLanguages?.() ?? [];
    const normalizedLanguage = CODE_LANGUAGE_ALIASES[language] ?? language;
    const resolvedLanguage = loadedLanguages.includes(normalizedLanguage) ? normalizedLanguage : "text";
    try {
      return transparentHighlightBackground(
        highlighter.codeToHtml(content, {
          lang: resolvedLanguage,
          theme: syntaxTheme
        })
      );
    } catch {
      return transparentHighlightBackground(
        highlighter.codeToHtml(content, {
          lang: "text",
          theme: syntaxTheme
        })
      );
    }
  }, [content, highlighter, language, syntaxTheme]);
  useEffect9(() => {
    const root = rootRef.current;
    root?.querySelectorAll(".is-focused-line").forEach((element) => element.classList.remove("is-focused-line"));
    if (!root || !focusLine || focusLine < 1) {
      return;
    }
    const target = root.querySelector(`[data-line="${focusLine}"]`) ?? root.querySelector(`.line:nth-child(${focusLine})`);
    target?.classList.add("is-focused-line");
    target?.scrollIntoView?.({ block: "center" });
  }, [focusLine, highlightedHtml]);
  const lines = content.split("\n");
  return /* @__PURE__ */ jsx12(
    "div",
    {
      ref: rootRef,
      className: "thread-graph-code-preview min-h-0 flex-1 overflow-auto",
      role: "region",
      "aria-label": translate("files.sourceCode"),
      children: highlightedHtml ? /* @__PURE__ */ jsx12(
        "div",
        {
          className: "thread-graph-highlighted-code-preview",
          dangerouslySetInnerHTML: { __html: highlightedHtml }
        }
      ) : /* @__PURE__ */ jsx12("pre", { className: "thread-graph-plain-code-preview", children: /* @__PURE__ */ jsx12("code", { children: lines.map((line, index) => /* @__PURE__ */ jsxs10(
        "span",
        {
          className: `thread-graph-code-line ${focusLine === index + 1 ? "is-focused-line" : ""}`,
          "data-line": index + 1,
          children: [
            /* @__PURE__ */ jsx12(
              "span",
              {
                className: "thread-graph-code-line-number",
                "aria-hidden": "true",
                children: index + 1
              }
            ),
            /* @__PURE__ */ jsx12("span", { children: line || " " })
          ]
        },
        index
      )) }) })
    }
  );
});
var MarkdownResourceContext = createContext({ markdownPath: "" });
function markdownResourcePath(markdownPath, resourceUrl, workspaceRootPath = "") {
  return resolveWorkspaceMarkdownPath({ markdownPath, resourceUrl, workspaceRootPath }) ?? resolveLinkedMarkdownPath({ markdownPath, resourceUrl, workspaceRootPath });
}
var workspaceMarkdownComponents = {
  a({ href, children: originalChildren, node: _node, ...props }) {
    const { markdownPath, workspaceRootPath, onOpenWorkspaceFile } = useContext(MarkdownResourceContext);
    const children = /* @__PURE__ */ jsx12(MarkdownImageLinkContext.Provider, { value: true, children: originalChildren });
    const workspacePath = href ? markdownResourcePath(markdownPath, href, workspaceRootPath) : null;
    if (workspacePath && onOpenWorkspaceFile) {
      return /* @__PURE__ */ jsx12(WorkspaceFileLink, { path: workspacePath, onOpen: ({ path }) => onOpenWorkspaceFile(path), children });
    }
    return /* @__PURE__ */ jsx12("a", { ...props, ...externalLinkProps(href), href, children });
  },
  img({ src, alt, ...props }) {
    const { markdownPath, workspaceRootPath, resolveWorkspaceFileUrl } = useContext(MarkdownResourceContext);
    const workspacePath = src ? markdownResourcePath(markdownPath, src, workspaceRootPath) : null;
    const resolvedSrc = workspacePath ? resolveWorkspaceFileUrl?.(workspacePath) ?? src : src;
    return resolvedSrc ? /* @__PURE__ */ jsx12(
      ZoomableImage,
      {
        src: resolvedSrc,
        alt: alt ?? "",
        loading: "lazy",
        className: props.className,
        width: props.width,
        height: props.height
      }
    ) : null;
  }
};
var GraphWorkspaceMarkdownPreview = memo(
  function GraphWorkspaceMarkdownPreview2({
    content,
    markdownPath,
    readingPositions,
    onOpenWorkspaceFile,
    resolveWorkspaceFileUrl,
    workspaceRootPath
  }) {
    const { locale: i18nLocale } = useI18n();
    const scrollRef = useRef9(null);
    const lastScrollTop = useRef9(0);
    useLayoutEffect2(() => {
      const element = scrollRef.current;
      if (!element) return;
      const target = readingPositions?.get(markdownPath) ?? 0;
      lastScrollTop.current = target;
      let restoring = true;
      const restore = () => {
        if (restoring) element.scrollTop = target;
      };
      restore();
      const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(restore);
      if (element.firstElementChild) observer?.observe(element.firstElementChild);
      const stop = () => {
        restoring = false;
        observer?.disconnect();
      };
      for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) element.addEventListener(type, stop, { passive: true });
      element.addEventListener("load", restore, true);
      return () => {
        readingPositions?.set(markdownPath, lastScrollTop.current);
        observer?.disconnect();
        for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) element.removeEventListener(type, stop);
        element.removeEventListener("load", restore, true);
      };
    }, [markdownPath, readingPositions]);
    return /* @__PURE__ */ jsx12("div", { ref: scrollRef, onScroll: (event) => {
      lastScrollTop.current = event.currentTarget.scrollTop;
      readingPositions?.set(markdownPath, lastScrollTop.current);
    }, className: "thread-graph-markdown thread-graph-markdown-preview min-h-0 flex-1 overflow-auto px-5 py-4 sm:px-7 sm:py-6", children: /* @__PURE__ */ jsx12("div", { className: "thread-graph-markdown-document", children: /* @__PURE__ */ jsx12(MarkdownResourceContext.Provider, { value: { markdownPath, workspaceRootPath, onOpenWorkspaceFile, resolveWorkspaceFileUrl }, children: /* @__PURE__ */ jsx12(
      ReactMarkdown,
      {
        urlTransform: (url) => localFileHref(url, typeof window === "undefined" ? void 0 : window.location.origin) ? url : defaultUrlTransform(url),
        remarkPlugins: [remarkGfm],
        rehypePlugins: [...markdownHtmlPlugins],
        components: workspaceMarkdownComponents,
        children: content
      }
    ) }) }) });
  }
);
function MissingLinkedFile({ path }) {
  const [copied, setCopied] = useState9(false);
  const name = path.replace(/[\\/]+$/, "").split(/[\\/]/).at(-1) || path;
  return /* @__PURE__ */ jsxs10("div", { className: "workspace-missing-file", role: "status", children: [
    /* @__PURE__ */ jsx12(FileQuestion, { className: "workspace-missing-file-icon", "aria-hidden": "true" }),
    /* @__PURE__ */ jsx12("p", { className: "workspace-missing-file-title", children: translate("files.linkMissingTitle", { name }) }),
    /* @__PURE__ */ jsx12("p", { className: "workspace-missing-file-hint", children: translate("files.linkMissingHint") }),
    /* @__PURE__ */ jsx12("code", { className: "workspace-missing-file-path", children: path }),
    /* @__PURE__ */ jsx12("button", { type: "button", className: "workspace-missing-file-copy", onClick: () => {
      void navigator.clipboard?.writeText(path).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }, () => void 0);
    }, children: copied ? translate("files.copied") : translate("files.copyPathShort") })
  ] });
}
function GraphWorkspacePreviewPane({
  activeFilePath,
  dirtyFilePaths = /* @__PURE__ */ new Set(),
  error,
  missingPath = null,
  fileTabs = [],
  focusLine,
  downloadOnly,
  downloadReason = null,
  onDownloadFile,
  imageUrl,
  loadingMore,
  documents,
  resourceScopeKey,
  canSaveDocument,
  onSaveAndClose,
  onReturnToFiles,
  onCloseFileTab,
  onDirtyChange,
  mobileNavigation = false,
  readingPositions,
  onNavigateBack,
  previousFilePath,
  onNavigateForward,
  onExpandExplorer,
  onOpenWorkspaceFile,
  onLoadMore,
  onSelectFileTab,
  onCollapse,
  pdfUrl,
  previewFile,
  previewLoading,
  plugins,
  resolveWorkspaceFileUrl,
  selectedTarget,
  workspaceRootPath
}) {
  const { locale: i18nLocale } = useI18n();
  const filePanel = useFilePanel();
  const surfaceRef = useRef9(null);
  const document2 = previewFile ? documents?.documents.get(previewFile.path) : void 0;
  const editing = document2?.editing ?? false;
  const draftContent = document2?.content ?? previewFile?.content ?? "";
  const saving = document2?.phase === "saving";
  const saveError = document2?.error;
  const setDraftContent = (content) => {
    if (previewFile) documents?.change(previewFile.path, content);
  };
  const setEditing = (value) => {
    if (previewFile) documents?.setEditing(previewFile.path, value);
  };
  const actionTrigger = useRef9(null);
  const [actionsOpen, setActionsOpen] = useState9(false);
  const [showConflict, setShowConflict] = useState9(true);
  const [diffMode, setDiffMode] = useState9("draftDisk");
  const [markdownView, setMarkdownView] = useState9(
    "preview"
  );
  const [compactViewer, setCompactViewer] = useState9(
    () => typeof window === "undefined" || typeof window.matchMedia !== "function" || window.matchMedia("(max-width: 639px)").matches
  );
  const [dark, setDark] = useState9(false);
  const activeNode = selectedTarget?.node ?? null;
  const renderedArtifact = activeNode?.artifact ? plugins.renderArtifact({
    artifact: activeNode.artifact,
    expanded: true,
    // ElAgente: scientific renderers lay out for the workspace pane.
    presentation: "workspace",
    onToggleExpanded: () => void 0
  }) : null;
  const moleculeSnapshot = buildMoleculePreviewSnapshot(previewFile ?? null);
  const fileLanguage = previewFile?.language || languageForPath(previewFile?.path ?? "");
  const extension = previewFile ? extensionOf(previewFile.path) : "";
  const isMarkdownFile = MARKDOWN_EXTENSIONS.has(extension);
  const isDrawioFile = isDrawioPath(previewFile?.path ?? "");
  const renderedViewLabel = isDrawioFile ? translate("files.diagram") : "Markdown";
  const title = previewTargetTitle(selectedTarget);
  const canEditFile = Boolean(previewFile && canSaveDocument && document2 && !document2.snapshot.readOnlyReason && document2.snapshot.contentHash) && !(previewFile && MOLECULAR_EXTENSIONS.has(extension)) && isSmallEditableTextFile(previewFile);
  const isLiveArtifactPreview = selectedTarget?.kind === "live-molecule";
  const isArtifactPreview = Boolean(activeNode?.artifact && renderedArtifact);
  const isMoleculePreview = Boolean(moleculeSnapshot) || isArtifactPreview;
  useEffect9(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const update = () => setCompactViewer(mediaQuery.matches);
    update();
    mediaQuery.addEventListener?.("change", update);
    return () => mediaQuery.removeEventListener?.("change", update);
  }, []);
  useEffect9(() => {
    const shell = surfaceRef.current?.closest(".thread-ui-shell");
    const update = () => setDark(
      shell?.getAttribute("data-theme-effective") === "dark" || shell?.classList.contains("dark") || shell?.classList.contains("thread-ui-theme-dark") || false
    );
    update();
    if (!shell) {
      return;
    }
    const observer = new MutationObserver(update);
    observer.observe(shell, {
      attributes: true,
      attributeFilter: ["class", "data-theme-effective"]
    });
    return () => observer.disconnect();
  }, []);
  useEffect9(() => {
    setMarkdownView("preview");
    setShowConflict(true);
    setDiffMode("draftDisk");
    setActionsOpen(false);
  }, [activeNode?.path]);
  useEffect9(() => {
    if (!actionsOpen) return;
    const escape = (event) => {
      if (event.key !== "Escape" || event.target instanceof HTMLElement && event.target.closest(".monaco-editor")) return;
      event.preventDefault();
      event.stopPropagation();
      setActionsOpen(false);
      actionTrigger.current?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", escape, true);
    return () => window.removeEventListener("keydown", escape, true);
  }, [actionsOpen]);
  async function handleSaveFile() {
    if (previewFile) await documents?.save(previewFile.path);
  }
  const fileToolbar = previewFile && (isMarkdownFile || isDrawioFile || canEditFile) ? /* @__PURE__ */ jsxs10("div", { className: "flex shrink-0 items-center gap-1", children: [
    (isMarkdownFile || isDrawioFile) && !editing ? /* @__PURE__ */ jsx12("button", { type: "button", className: "thread-graph-editor-toolbar-button workspace-mobile-view-toggle", "aria-label": translate(markdownView === "preview" ? "files.source" : "files.preview", { value1: renderedViewLabel }), title: translate(markdownView === "preview" ? "files.source" : "files.preview", { value1: renderedViewLabel }), onClick: () => setMarkdownView((view) => view === "preview" ? "source" : "preview"), children: markdownView === "preview" ? /* @__PURE__ */ jsx12(Code2, { "data-icon": "source", size: 16 }) : /* @__PURE__ */ jsx12(BookOpen, { "data-icon": "preview", size: 16 }) }) : null,
    canEditFile ? /* @__PURE__ */ jsx12("div", { className: "flex shrink-0 items-center gap-0.5", children: editing ? /* @__PURE__ */ jsxs10(Fragment6, { children: [
      /* @__PURE__ */ jsx12(
        "button",
        {
          type: "button",
          onClick: async () => {
            if (document2 && isProtected(document2) && !await confirmAsync({ title: translate("files.safeDiscardTitle"), description: translate("files.safeDiscard"), confirmLabel: translate("files.safeDiscardAction") })) return;
            setDraftContent(document2?.baseContent ?? previewFile.content);
            setEditing(false);
          },
          disabled: saving || document2?.phase === "unknown",
          className: "thread-graph-editor-toolbar-button flex h-6 w-6 items-center justify-center rounded transition disabled:cursor-not-allowed disabled:opacity-40",
          title: translate("files.cancelEdits"),
          "aria-label": translate("files.cancelEdits"),
          children: /* @__PURE__ */ jsx12(X4, { "data-icon": "close", className: "h-3.5 w-3.5" })
        }
      ),
      /* @__PURE__ */ jsx12(
        "button",
        {
          type: "button",
          onClick: () => void handleSaveFile(),
          disabled: saving || document2?.phase === "unknown" || draftContent === document2?.baseContent,
          className: "thread-graph-editor-toolbar-button flex h-6 w-6 items-center justify-center rounded transition disabled:cursor-not-allowed disabled:opacity-40",
          title: translate("files.saveFile"),
          "aria-label": translate("files.saveFile"),
          children: /* @__PURE__ */ jsx12(Save, { "data-icon": "save", className: "h-3.5 w-3.5" })
        }
      )
    ] }) : /* @__PURE__ */ jsx12(
      "button",
      {
        type: "button",
        onClick: () => {
          setMarkdownView("source");
          setEditing(true);
        },
        className: "thread-graph-editor-toolbar-button flex h-6 w-6 items-center justify-center rounded transition",
        title: translate("files.editFile"),
        "aria-label": translate("files.editFile"),
        children: /* @__PURE__ */ jsx12(Pencil2, { "data-icon": "edit", className: "h-3.5 w-3.5" })
      }
    ) }) : null
  ] }) : null;
  const documentState = document2 ? translate(document2.snapshot.readOnlyReason ? "files.safeReadOnly" : document2.needsVerification && document2.phase === "clean" ? "files.safeAdoptedSnapshot" : `files.safePhase.${document2.phase}`, { reason: document2.snapshot.readOnlyReason ? translateReadOnly(document2.snapshot.readOnlyReason) : "" }) : null;
  const documentMetadata = document2 ? `${documentState} \xB7 ${document2.snapshot.encoding === "utf-8" ? "UTF-8" : translate("files.safeUnknownEncoding")}${document2.snapshot.bom ? " BOM" : ""} \xB7 ${document2.snapshot.eol.toUpperCase()}` : void 0;
  const inlineStatus = document2 && /* @__PURE__ */ jsx12("span", { role: "status", "data-testid": "workspace-document-status", className: "sr-only", "data-phase": document2.phase, children: documentState });
  const backLabel = previousFilePath ? translate("files.backToDocument", { name: previousFilePath.split("/").pop() ?? previousFilePath }) : translate("workbench.goBack");
  const navigationControls = /* @__PURE__ */ jsx12(Fragment6, { children: onNavigateForward && /* @__PURE__ */ jsx12("button", { type: "button", onClick: onNavigateForward, "aria-label": translate("files.goForward"), title: translate("files.goForward"), className: "thread-graph-editor-toolbar-button flex h-6 w-6 shrink-0 items-center justify-center rounded", children: /* @__PURE__ */ jsx12(ArrowRight, { "data-icon": "forward", size: 14 }) }) });
  const copyPath = activeNode?.path && !/^(?:\/|[a-z]:[\\/])/i.test(activeNode.path) && workspaceRootPath ? `${workspaceRootPath.replace(/[\\/]+$/, "")}/${activeNode.path}` : activeNode?.path ?? "";
  const fileActions = activeNode && /* @__PURE__ */ jsxs10(
    WorkspaceFileActions,
    {
      path: copyPath,
      relativePath: workspaceRootPath ? relativeWorkspacePath(copyPath, workspaceRootPath) : null,
      ...documentMetadata || filePanel?.label ? { metadata: [filePanel?.label, documentMetadata].filter(Boolean).join(" \xB7 ") } : {},
      ...document2 ? { onDownload: () => {
        if (!isProtected(document2) && onDownloadFile) void onDownloadFile();
        else downloadDraft(document2);
      }, onRefresh: async () => {
        const previous = document2.snapshot.contentHash;
        await documents?.checkDisk(document2.snapshot.path);
        const current = documents?.documents.get(document2.snapshot.path);
        if (current?.error) throw new Error(current.error);
        return translate(current?.phase === "conflict" ? "files.safePhase.conflict" : current?.snapshot.contentHash === previous ? "files.fileAlreadyCurrent" : "files.fileReloaded");
      } } : onDownloadFile ? { onDownload: () => void onDownloadFile() } : {},
      children: [
        fileToolbar,
        inlineStatus,
        navigationControls
      ]
    },
    activeNode.path
  );
  const viewerPaneToggle = onExpandExplorer ? /* @__PURE__ */ jsx12(
    "button",
    {
      type: "button",
      onClick: onExpandExplorer,
      "data-testid": "expand-explorer",
      className: "flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--theme-fg-muted)] transition hover:bg-[var(--theme-hover)] hover:text-[var(--theme-fg)]",
      title: translate("files.showExplorer"),
      "aria-label": translate("files.showExplorer"),
      children: /* @__PURE__ */ jsx12(PanelLeftOpen, { "data-icon": "expand-explorer", className: "h-3.5 w-3.5" })
    }
  ) : onCollapse ? /* @__PURE__ */ jsx12(
    "button",
    {
      type: "button",
      onClick: onCollapse,
      "data-testid": "collapse-viewer",
      className: "flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--theme-fg-muted)] transition hover:bg-[var(--theme-hover)] hover:text-[var(--theme-fg)]",
      title: translate("files.hideEditor"),
      "aria-label": translate("files.hideEditor"),
      children: /* @__PURE__ */ jsx12(PanelRightClose, { "data-icon": "collapse-viewer", className: "h-3.5 w-3.5" })
    }
  ) : null;
  const previewNavigation = (onNavigateBack || onReturnToFiles || onExpandExplorer) && /* @__PURE__ */ jsx12("button", { type: "button", className: "workspace-preview-back", onClick: onNavigateBack ?? onReturnToFiles ?? onExpandExplorer, "aria-label": onNavigateBack ? backLabel : translate("files.backToFiles"), title: onNavigateBack ? backLabel : translate("files.backToFiles"), "data-testid": "expand-explorer", children: /* @__PURE__ */ jsx12(ArrowLeft, { "data-icon": "back", size: 18 }) });
  const previewActions = /* @__PURE__ */ jsx12("button", { ref: actionTrigger, type: "button", className: "thread-graph-editor-toolbar-button workspace-file-more", "aria-label": translate("files.fileActions"), title: translate("files.fileActions"), "aria-expanded": actionsOpen, onClick: () => setActionsOpen((open) => !open), children: /* @__PURE__ */ jsx12(MoreHorizontal3, { "data-icon": "more", size: 18 }) });
  return /* @__PURE__ */ jsxs10(
    "section",
    {
      ref: surfaceRef,
      className: "thread-graph-viewer flex h-full min-h-0 flex-col overflow-hidden rounded-md",
      "data-preview-target-kind": selectedTarget?.kind ?? "none",
      children: [
        !mobileNavigation && selectedTarget?.kind !== "workspace-file" ? /* @__PURE__ */ jsxs10("div", { className: "thread-graph-viewer-header flex h-9 shrink-0 items-center justify-between gap-2 border-b px-2.5", children: [
          /* @__PURE__ */ jsx12("span", { className: "min-w-0 truncate text-xs font-medium text-[var(--theme-fg)]", children: title ?? translate("files.preview_f1fbb2") }),
          viewerPaneToggle
        ] }) : null,
        fileTabs.length === 0 && /* @__PURE__ */ jsxs10("div", { className: "workspace-file-toolbar flex min-h-9 shrink-0 items-center justify-between border-b px-1", children: [
          /* @__PURE__ */ jsx12("div", { className: "workspace-file-navigation flex items-center", children: previewNavigation }),
          /* @__PURE__ */ jsx12("span", { className: "min-w-0 flex-1 truncate text-xs", title: filePanel?.label, children: title }),
          /* @__PURE__ */ jsx12("div", { className: "flex shrink-0 items-center", children: previewActions })
        ] }),
        fileTabs.length > 0 && onCloseFileTab && onSelectFileTab ? /* @__PURE__ */ jsx12(
          WorkspaceFileTabs,
          {
            activePath: activeFilePath ?? null,
            dirtyPaths: dirtyFilePaths,
            onClose: onCloseFileTab,
            onSelect: onSelectFileTab,
            tabs: fileTabs,
            ...onSaveAndClose ? { onSaveAndClose } : {},
            blockedClosePaths: new Set([...documents?.documents ?? []].filter(([, doc]) => ["saving", "unknown"].includes(doc.phase)).map(([path]) => path)),
            leadingAction: previewNavigation,
            trailingAction: previewActions
          }
        ) : null,
        actionsOpen && fileActions,
        /* @__PURE__ */ jsxs10("div", { className: "flex min-h-0 flex-1 flex-col overflow-hidden", children: [
          error ? /* @__PURE__ */ jsxs10("div", { role: "alert", className: "workspace-file-alert flex items-center gap-3 border-b border-[color-mix(in_srgb,#e11d48_30%,var(--theme-border))] bg-[color-mix(in_srgb,#e11d48_8%,var(--theme-panel))] text-sm text-[color-mix(in_srgb,#e11d48_58%,var(--theme-fg))] px-5 py-3", children: [
            /* @__PURE__ */ jsx12("span", { className: "min-w-0 flex-1", children: translateReadOnly(error) }),
            onDownloadFile && selectedTarget?.kind === "workspace-file" ? /* @__PURE__ */ jsx12(AlertDownloadButton, { name: selectedTarget.node.name, onDownload: onDownloadFile }) : null
          ] }) : null,
          !selectedTarget && missingPath ? /* @__PURE__ */ jsx12(MissingLinkedFile, { path: missingPath }) : !selectedTarget ? /* @__PURE__ */ jsx12("div", { className: "flex min-h-0 flex-1 items-center justify-center px-5 text-center text-sm text-slate-400 dark:text-slate-500", children: translate("files.pickALiveMoleculeWorkspaceFileArtifact") }) : selectedTarget.kind === "workspace-file" && previewLoading ? /* @__PURE__ */ jsx12("div", { className: "flex min-h-0 flex-1 items-center justify-center px-5 text-center text-sm text-slate-400 dark:text-slate-500", children: translate("files.loadingFilePreview") }) : selectedTarget.kind === "workspace-file" && downloadOnly ? /* @__PURE__ */ jsx12(DownloadFilePreview, { node: selectedTarget.node, onDownload: onDownloadFile, ...downloadReason ? { readOnlyReason: downloadReason } : activeFilePath && documents?.documents.get(activeFilePath)?.snapshot.readOnlyReason ? { readOnlyReason: documents.documents.get(activeFilePath).snapshot.readOnlyReason } : {} }, selectedTarget.node.path) : selectedTarget.kind === "workspace-file" && moleculeSnapshot ? /* @__PURE__ */ jsx12("div", { className: "thread-graph-molecule-preview min-h-0 flex-1 overflow-hidden", children: /* @__PURE__ */ jsx12(
            GraphMoleculeViewer,
            {
              source: moleculeSnapshot,
              moleculeId: moleculeSnapshot.uuid ?? selectedTarget.node.path,
              title: selectedTarget.node.name
            }
          ) }) : selectedTarget.kind === "workspace-file" && imageUrl ? /* @__PURE__ */ jsx12(WorkspaceImagePreview, { src: imageUrl, alt: selectedTarget.node.path || selectedTarget.node.name }, imageUrl) : selectedTarget.kind === "workspace-file" && pdfUrl ? /* @__PURE__ */ jsx12(WorkspacePdfPreview, { src: pdfUrl, node: selectedTarget.node }, pdfUrl) : selectedTarget.kind === "workspace-file" && previewFile ? /* @__PURE__ */ jsxs10("div", { className: "flex min-h-0 flex-1 flex-col", children: [
            document2 && (document2.snapshot.readOnlyReason || ["conflict", "unknown", "error"].includes(document2.phase)) ? /* @__PURE__ */ jsxs10("div", { className: "workspace-document-status", role: "status", children: [
              /* @__PURE__ */ jsxs10("span", { children: [
                document2.snapshot.readOnlyReason ? translate("files.safeReadOnly", { reason: translateReadOnly(document2.snapshot.readOnlyReason) }) : translate(document2.needsVerification && document2.phase === "clean" ? "files.safeAdoptedSnapshot" : `files.safePhase.${document2.phase}`),
                " \xB7 ",
                document2.snapshot.encoding === "utf-8" ? "UTF-8" : translate("files.safeUnknownEncoding"),
                document2.snapshot.bom ? " BOM" : "",
                " \xB7 ",
                document2.snapshot.eol.toUpperCase(),
                " \xB7 r",
                document2.revision
              ] }),
              /* @__PURE__ */ jsxs10("div", { className: "workspace-document-actions", children: [
                document2.phase === "unknown" ? /* @__PURE__ */ jsx12("button", { type: "button", onClick: () => void documents?.reconcile(document2.snapshot.path), children: translate("files.safeVerifySave") }) : null,
                document2.phase === "unknown" && document2.conflict ? /* @__PURE__ */ jsx12("button", { type: "button", disabled: document2.operationPending, onClick: async () => {
                  if (await confirmAsync({ title: translate("files.safeUseCheckedBase"), description: translate("files.safeManualRebase"), confirmLabel: translate("files.safeUseCheckedBase") })) documents?.acceptVerifiedDisk(document2.snapshot.path);
                }, children: translate("files.safeUseCheckedBase") }) : null,
                document2.phase === "conflict" && !showConflict ? /* @__PURE__ */ jsx12("button", { type: "button", onClick: () => setShowConflict(true), children: translate("files.safeViewConflict") }) : null
              ] })
            ] }) : !document2 && canSaveDocument ? /* @__PURE__ */ jsx12("div", { className: "workspace-document-status", children: translate(isHostFilePath(previewFile.path) ? "files.linkedFileReadOnly" : "files.safeUnavailable") }) : null,
            document2 && (document2.phase === "conflict" || document2.phase === "unknown" && document2.conflict) && showConflict ? /* @__PURE__ */ jsxs10("div", { className: "workspace-document-conflict", "data-testid": "workspace-document-conflict", children: [
              /* @__PURE__ */ jsx12("strong", { children: translate(document2.phase === "unknown" ? "files.safePhase.unknown" : "files.safeConflictTitle") }),
              /* @__PURE__ */ jsx12("p", { children: translate(document2.phase === "unknown" ? "files.safeUnknown" : document2.conflictFrom === "check" ? "files.safeChangedBody" : "files.safeConflictBody") }),
              /* @__PURE__ */ jsxs10("div", { className: "workspace-document-actions", children: [
                /* @__PURE__ */ jsx12("button", { type: "button", onClick: () => setShowConflict(false), children: translate("files.safeKeepDraft") }),
                /* @__PURE__ */ jsx12("button", { type: "button", disabled: document2.phase === "unknown" || document2.conflict?.content == null, onClick: async () => {
                  const revision = document2.revision;
                  if (await confirmAsync({ title: translate("files.safeAdoptDisk"), description: translate("files.safeDiscard"), confirmLabel: translate("files.safeAdoptDisk") })) documents?.adoptDisk(document2.snapshot.path, revision);
                }, children: translate("files.safeAdoptDisk") }),
                /* @__PURE__ */ jsx12("button", { type: "button", disabled: document2.phase === "unknown" || !document2.conflict?.contentHash || Boolean(document2.conflict.readOnlyReason), onClick: async () => {
                  if (await confirmAsync({ title: translate("files.safeOverwriteShown"), description: translate("files.safeOverwriteConfirm"), confirmLabel: translate("files.safeOverwriteShown") })) void documents?.save(document2.snapshot.path, true);
                }, children: translate("files.safeOverwriteShown") }),
                /* @__PURE__ */ jsx12("button", { type: "button", disabled: document2.conflict?.content == null, onClick: () => downloadDraft(document2, true), children: translate("files.safeDownloadDisk") })
              ] }),
              document2.conflict?.content != null ? /* @__PURE__ */ jsxs10(Fragment6, { children: [
                /* @__PURE__ */ jsxs10("label", { children: [
                  translate("files.safeCompare"),
                  " ",
                  /* @__PURE__ */ jsxs10("select", { value: diffMode, onChange: (e) => setDiffMode(e.target.value), children: [
                    /* @__PURE__ */ jsx12("option", { value: "draftDisk", children: translate("files.safeDraftDisk") }),
                    /* @__PURE__ */ jsx12("option", { value: "baseDraft", children: translate("files.safeBaseDraft") }),
                    /* @__PURE__ */ jsx12("option", { value: "baseDisk", children: translate("files.safeBaseDisk") })
                  ] })
                ] }),
                /* @__PURE__ */ jsx12("div", { className: "workspace-document-diff", children: /* @__PURE__ */ jsx12(Suspense, { fallback: /* @__PURE__ */ jsx12("span", { children: translate("files.loadingEditor") }), children: /* @__PURE__ */ jsx12(
                  WorkspaceDocumentDiff,
                  {
                    original: diffMode === "draftDisk" ? document2.content : document2.baseContent,
                    modified: diffMode === "baseDraft" ? document2.content : document2.conflict.content,
                    language: fileLanguage,
                    dark,
                    compact: compactViewer
                  }
                ) }) }),
                /* @__PURE__ */ jsxs10("p", { className: "workspace-document-snapshot", children: [
                  translate("files.safeFixedSnapshot"),
                  " \xB7 ",
                  document2.conflict.contentHash?.slice(0, 23)
                ] })
              ] }) : /* @__PURE__ */ jsx12("p", { children: translate("files.safeMissing") })
            ] }) : null,
            saveError ? /* @__PURE__ */ jsx12("div", { role: "alert", className: "workspace-file-alert border-b border-[color-mix(in_srgb,#e11d48_30%,var(--theme-border))] bg-[color-mix(in_srgb,#e11d48_8%,var(--theme-panel))] text-sm text-[color-mix(in_srgb,#e11d48_58%,var(--theme-fg))] px-4 py-2", children: saveError }) : null,
            editing && compactViewer ? /* @__PURE__ */ jsx12(
              "textarea",
              {
                value: draftContent,
                onChange: (event) => setDraftContent(event.currentTarget.value),
                spellCheck: false,
                "aria-label": translate("files.workspaceFileEditor"),
                className: "thread-graph-file-editor min-h-0 flex-1 resize-none border-0 bg-transparent p-4 font-mono text-[12px] leading-5 text-slate-900 outline-none dark:text-slate-100"
              }
            ) : isDrawioFile && markdownView === "preview" && !editing ? /* @__PURE__ */ jsx12(GraphDrawioPreview, { content: previewFile.content, name: previewFile.name, truncated: previewFile.truncated }) : isMarkdownFile && markdownView === "preview" && !editing ? /* @__PURE__ */ jsx12(
              GraphWorkspaceMarkdownPreview,
              {
                content: previewFile.content,
                markdownPath: previewFile.path,
                ...readingPositions ? { readingPositions } : {},
                ...onOpenWorkspaceFile ? { onOpenWorkspaceFile } : {},
                ...resolveWorkspaceFileUrl ? { resolveWorkspaceFileUrl } : {},
                ...workspaceRootPath ? { workspaceRootPath } : {}
              },
              previewFile.path
            ) : compactViewer ? /* @__PURE__ */ jsx12(
              GraphWorkspaceCodePreview,
              {
                content: previewFile.content,
                focusLine,
                language: fileLanguage
              }
            ) : /* @__PURE__ */ jsx12(
              Suspense,
              {
                fallback: /* @__PURE__ */ jsx12("div", { className: "flex min-h-0 flex-1 items-center justify-center text-sm text-[var(--theme-fg-muted)]", children: translate("files.loadingEditor") }),
                children: /* @__PURE__ */ jsx12(
                  GraphWorkspaceMonacoEditor,
                  {
                    resourceKey: document2?.key ?? `${resourceScopeKey}:${previewFile.path}`,
                    retainModel: Boolean(document2),
                    content: editing ? draftContent : previewFile.content,
                    dark,
                    focusLine,
                    language: fileLanguage,
                    onChange: setDraftContent,
                    onSave: () => void handleSaveFile(),
                    path: previewFile.path,
                    readOnly: !editing
                  },
                  document2?.key ?? `${resourceScopeKey}:${previewFile.path}`
                )
              }
            ),
            previewFile.truncated && !onLoadMore ? /* @__PURE__ */ jsx12("div", { className: "workspace-document-status", children: translate("files.safeFirstPreview") }) : null,
            previewFile.truncated && onLoadMore ? /* @__PURE__ */ jsx12("div", { className: "thread-graph-file-preview-footer flex justify-center border-t px-4 py-3", children: /* @__PURE__ */ jsx12(
              "button",
              {
                type: "button",
                onClick: onLoadMore,
                disabled: loadingMore,
                title: translate("files.loadMoreWorkspacePreview"),
                "aria-label": translate("files.loadMoreWorkspacePreview"),
                className: "thread-graph-load-more-button rounded-md px-4 py-1.5 text-xs disabled:opacity-50",
                children: loadingMore ? translate("files.loading") : translate("files.loadMoreBytesRemaining", { value1: (previewFile.size - previewFile.nextOffset).toLocaleString(getLocale()) })
              }
            ) }) : null
          ] }) : (selectedTarget.kind === "live-molecule" || selectedTarget.kind === "artifact") && selectedTarget.node.artifact ? /* @__PURE__ */ jsx12(
            "div",
            {
              className: isMoleculePreview || isLiveArtifactPreview ? "min-h-0 flex-1 overflow-hidden" : "min-h-0 flex-1 overflow-auto p-3",
              children: renderedArtifact
            }
          ) : selectedTarget.kind === "meta" ? /* @__PURE__ */ jsx12("div", { className: "min-h-0 flex-1 overflow-auto p-3", children: /* @__PURE__ */ jsx12("div", { className: "grid gap-3", children: /* @__PURE__ */ jsx12(WorkspaceInfoCard, { label: translate("files.workspaceData"), children: /* @__PURE__ */ jsx12(
            GraphWorkspaceCodePreview,
            {
              content: selectedTarget.node.detail ?? ""
            }
          ) }) }) }) : /* @__PURE__ */ jsxs10("div", { className: "flex min-h-0 flex-1 flex-col", children: [
            /* @__PURE__ */ jsx12("div", { className: "thread-graph-file-preview-header border-b px-4 py-3 text-xs uppercase tracking-[0.12em]", children: selectedTarget.node.kind }),
            /* @__PURE__ */ jsx12(
              GraphWorkspaceCodePreview,
              {
                content: selectedTarget.node.detail ?? selectedTarget.node.preview ?? selectedTarget.node.name
              }
            )
          ] })
        ] })
      ]
    }
  );
}

// src/components/graph-workspace/GraphEmptyGarbageDialog.tsx
import { jsx as jsx13, jsxs as jsxs11 } from "react/jsx-runtime";
function GraphEmptyGarbageDialog({
  files,
  onCancel,
  onConfirm
}) {
  useI18n();
  return /* @__PURE__ */ jsx13("div", { className: "thread-graph-dialog-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4", children: /* @__PURE__ */ jsxs11("div", { className: "thread-graph-dialog w-full max-w-sm rounded-xl border bg-[var(--theme-panel)] p-6 shadow-xl", children: [
    /* @__PURE__ */ jsx13("h3", { className: "text-base font-semibold text-[var(--theme-fg)]", children: translate("files.emptyGarbage") }),
    /* @__PURE__ */ jsxs11("p", { className: "mt-1 text-sm leading-5 text-[var(--theme-fg-muted)]", children: [
      translate("files.permanentlyDeleteAllFilesInThe"),
      " ",
      /* @__PURE__ */ jsx13("code", { className: "rounded bg-[var(--theme-muted)] px-1 text-xs text-[var(--theme-fg-soft)]", children: "garbage/" }),
      " ",
      translate("files.folder")
    ] }),
    files.length === 0 ? /* @__PURE__ */ jsx13("p", { className: "mt-3 text-sm text-[var(--theme-fg-muted)]", children: translate("files.garbageIsEmpty") }) : /* @__PURE__ */ jsx13("ul", { className: "mt-3 max-h-40 overflow-y-auto rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] p-2 text-xs text-[var(--theme-fg-soft)]", children: files.map((file) => /* @__PURE__ */ jsx13("li", { className: "truncate py-0.5", title: file, children: file }, file)) }),
    /* @__PURE__ */ jsxs11("div", { className: "mt-4 flex justify-end gap-2", children: [
      /* @__PURE__ */ jsx13(
        "button",
        {
          type: "button",
          onClick: onCancel,
          className: "thread-secondary-action rounded-md px-3 py-1.5 text-sm",
          children: translate("files.cancel")
        }
      ),
      files.length > 0 ? /* @__PURE__ */ jsx13(
        "button",
        {
          type: "button",
          onClick: onConfirm,
          className: "ui-action-danger rounded-md px-3 py-1.5 text-sm font-medium",
          children: translate("files.yesEmptyGarbage")
        }
      ) : null
    ] })
  ] }) });
}

// src/components/graph-workspace/GraphWorkspaceExplorer.tsx
import { Fragment as Fragment7, jsx as jsx14, jsxs as jsxs12 } from "react/jsx-runtime";
var TREE_MIN_PX = 220;
function GraphWorkspaceExplorer({
  activeView,
  detail,
  artifacts,
  plugins,
  status,
  focusPathRequest,
  workspaceAdapter,
  onActiveFileChange
}) {
  useI18n();
  const {
    activeNode,
    capabilities,
    capabilityError,
    refreshCapabilities,
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
    refreshWorkspaceTree,
    retryDirectory,
    setLoadingTree,
    setFilterMode,
    setFilterQuery,
    setSelectedNodeId,
    setWorkspaceError,
    toggleDirectory,
    tree,
    workspaceError,
    workspaceIdentity,
    showHidden,
    setShowHidden,
    showThreadEvents,
    setShowThreadEvents
  } = useWorkspaceExplorerController({
    activeView,
    detail,
    artifacts,
    status,
    focusPathRequest,
    workspaceAdapter
  });
  const [collapsedPanel, setCollapsedPanel] = useState10(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 639px)").matches ? "viewer" : null
  );
  const [focusedLine, setFocusedLine] = useState10(null);
  const [fileTabs, setFileTabs] = useState10([]);
  const documents = useWorkspaceDocuments(workspaceAdapter, workspaceIdentity);
  const readingPositions = useMemo7(() => /* @__PURE__ */ new Map(), [documents.source]);
  const [navigation, setNavigation] = useState10({ scope: documents.source, paths: [], index: -1 });
  const selectedFilePath = activeNode?.kind === "file" ? activeNode.path : null;
  const workspacePanelRef = useRef10(null);
  const treePanelRef = useRef10(null);
  useLayoutEffect3(() => {
    const width = workspacePanelRef.current?.clientWidth ?? 0;
    const tree2 = treePanelRef.current;
    if (!tree2 || width <= 0 || tree2.getSize() / 100 * width >= TREE_MIN_PX) return;
    tree2.resize(Math.min(50, TREE_MIN_PX / width * 100));
  }, []);
  const activeFileChange = useRef10(onActiveFileChange);
  activeFileChange.current = onActiveFileChange;
  useEffect10(() => {
    activeFileChange.current?.(selectedFilePath ? relativeWorkspacePath(selectedFilePath, detail.workspace.absPath) : null);
  }, [selectedFilePath, detail.workspace.absPath]);
  useEffect10(() => () => activeFileChange.current?.(null), []);
  useLayoutEffect3(() => {
    setNavigation((current) => {
      if (current.scope !== documents.source) return { scope: documents.source, paths: selectedFilePath ? [selectedFilePath] : [], index: selectedFilePath ? 0 : -1 };
      if (!selectedFilePath || current.paths[current.index] === selectedFilePath) return current;
      const paths = [...current.paths.slice(0, current.index + 1), selectedFilePath].slice(-100);
      return { ...current, paths, index: paths.length - 1 };
    });
  }, [documents.source, selectedFilePath]);
  function navigatePreview(direction) {
    const index = navigation.index + direction;
    const path = navigation.paths[index];
    if (!path) return;
    setNavigation((current) => ({ ...current, index }));
    setFocusedLine(null);
    setCollapsedPanel(isMobileViewport ? "explorer" : null);
    void focusWorkspacePath(path);
  }
  const [newFilePath, setNewFilePath] = useState10(null);
  const [createError, setCreateError] = useState10(null);
  const [creatingFile, setCreatingFile] = useState10(false);
  const createSource = JSON.stringify([workspaceAdapter?.resourceScopeKey, workspaceIdentity.workspaceId, workspaceIdentity.threadId]);
  const createOwnerRef = useRef10({ source: createSource, busy: false });
  if (createOwnerRef.current.source !== createSource) createOwnerRef.current = { source: createSource, busy: false };
  useEffect10(() => {
    setNewFilePath(null);
    setCreateError(null);
    setCreatingFile(false);
  }, [createSource]);
  function openCreateFile() {
    const relative = activeNode ? relativeWorkspacePath(activeNode.path, detail.workspace.absPath) : null;
    const directory = relative ? activeNode?.kind === "directory" ? relative : relative.slice(0, Math.max(0, relative.lastIndexOf("/"))) : "";
    setNewFilePath(directory ? `${directory}/` : "");
    setCreateError(null);
  }
  async function handleCreateFile() {
    if (!workspaceAdapter?.createFile || newFilePath === null) return;
    const owner = createOwnerRef.current;
    if (owner.busy) return;
    const path = newFilePath.trim();
    if (!path || path.length > 4096 || /[\\\x00-\x1f\x7f]/.test(path) || /^[a-z]:/i.test(path) || path.split("/").some((part) => !part || part === "." || part === "..")) {
      setCreateError(translate("files.invalidNewFilePath"));
      return;
    }
    if (dirtyFilePaths.has(path)) {
      setCreateError(translate("files.createHasDraft"));
      return;
    }
    owner.busy = true;
    setCreatingFile(true);
    setCreateError(null);
    let created = false;
    try {
      await workspaceAdapter.createFile({ ...workspaceIdentity, path });
      created = true;
      if (createOwnerRef.current !== owner) return;
      const currentDraft = documents.documents.get(path);
      if (currentDraft && isProtected(currentDraft) || !documents.discard(path)) {
        throw new Error(translate("files.createHasDraft"));
      }
      setNewFilePath(null);
      setFilterQuery("");
      await refreshWorkspaceTree(path);
      if (createOwnerRef.current !== owner) return;
      await focusWorkspacePath(path);
      if (createOwnerRef.current !== owner) return;
      const snapshot = await documents.load(path);
      if (createOwnerRef.current !== owner) return;
      if (snapshot && !snapshot.readOnlyReason && workspaceAdapter.saveDocument) documents.setEditing(path, true);
      setFileTabs((tabs) => [...tabs.filter((tab) => tab.path !== path), { path, name: path.split("/").pop(), pinned: true }]);
      setCollapsedPanel(isMobileViewport ? "explorer" : null);
    } catch (error) {
      if (createOwnerRef.current !== owner) return;
      const message = error instanceof Error ? error.message : translate("files.fileOperationFailed");
      if (created) setWorkspaceError(translate("files.createdButOpenFailed", { path, error: message }));
      else setCreateError(message);
    } finally {
      owner.busy = false;
      if (createOwnerRef.current === owner) setCreatingFile(false);
    }
  }
  const createDialog = /* @__PURE__ */ jsx14(
    RenameDialog,
    {
      open: newFilePath !== null,
      title: translate("files.newFile"),
      label: translate("files.newFilePath"),
      description: translate("files.newFileDescription"),
      submitLabel: translate("files.createFile"),
      value: newFilePath ?? "",
      onChange: setNewFilePath,
      onCancel: () => {
        if (!creatingFile) setNewFilePath(null);
      },
      onSubmit: handleCreateFile,
      busy: creatingFile,
      error: createError
    }
  );
  const dirtyFilePaths = new Set([...documents.documents].filter(([, doc]) => isProtected(doc)).map(([path]) => path));
  const dirtyKey = [...dirtyFilePaths].join("\0");
  useEffect10(() => {
    setFileTabs((tabs) => tabs.map((tab) => dirtyFilePaths.has(tab.path) ? { ...tab, pinned: true } : tab));
  }, [dirtyKey]);
  const [isMobileViewport, setIsMobileViewport] = useState10(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 639px)").matches);
  const explorerScrollerRef = useRef10(null);
  const explorerScrollTopRef = useRef10(0);
  const restoredRevealRef = useRef10(null);
  const scrollRestoreGenerationRef = useRef10(0);
  useLayoutEffect3(() => {
    ++scrollRestoreGenerationRef.current;
    return () => {
      ++scrollRestoreGenerationRef.current;
    };
  }, [focusPathRequest]);
  const pendingExplorerScrollRestoreRef = useRef10(null);
  const {
    downloadOnly,
    downloadReason,
    imageUrl,
    loadingMore,
    loadMore: handleLoadMore,
    pdfUrl,
    previewFile,
    previewLoading
  } = useWorkspaceFilePreview({
    activeNode,
    adapter: workspaceAdapter,
    identity: workspaceIdentity,
    onError: setWorkspaceError,
    documents
  });
  const [fileOperation, setFileOperation] = useState10(
    null
  );
  const [destination, setDestination] = useState10("");
  const activeDocument = previewFile ? documents.documents.get(previewFile.path) : void 0;
  const currentPreviewFile = previewFile && activeDocument?.snapshot.content != null ? { ...previewFile, ...activeDocument.snapshot, content: activeDocument.snapshot.content } : previewFile;
  const {
    canDownload,
    canDelete,
    canMove,
    canTrash,
    canListTrash,
    canRestoreTrash,
    canEmptyTrash,
    trashFile,
    openTrash,
    restoreTrash,
    emptyTrash,
    showTrash,
    setShowTrash,
    trashList,
    confirmTrashEmpty,
    setConfirmTrashEmpty,
    importFormats,
    downloadFormats,
    resetTrashRetry,
    deleteFile,
    moveFile,
    notice,
    pending,
    archiveInputRef,
    handleArchiveImport,
    confirmEmptyGarbage: handleConfirmEmptyGarbage,
    copyPath: handleCopyPath,
    downloadNode: handleDownload,
    fileInputRef,
    garbageFiles,
    handleUpload,
    openGarbage: handleOpenGarbage,
    pickUploadFile,
    setShowGarbageDialog,
    showGarbageDialog
  } = useWorkspaceExplorerActions({
    activeNode,
    adapter: workspaceAdapter,
    capabilities,
    identity: workspaceIdentity,
    onError: setWorkspaceError,
    onLoadingChange: setLoadingTree,
    refreshTree: refreshWorkspaceTree,
    focusFile: (path) => {
      setCollapsedPanel(null);
      return focusWorkspacePath(path);
    },
    workspaceRootPath: detail.workspace.absPath
  });
  const canUploadFiles = Boolean(workspaceAdapter?.uploadFile && capabilities?.create === true);
  const canImportArchives = importFormats.length > 0 && Boolean(workspaceAdapter?.importArchive);
  const canDownloadTar = downloadFormats.includes("tar");
  const canDownloadZip = downloadFormats.includes("zip");
  const canTrashFiles = Boolean(capabilities?.trash?.files && workspaceAdapter?.trashFile);
  const canDeleteFiles = Boolean(capabilities?.delete === "file" && !capabilities.trash && workspaceAdapter?.deleteFile);
  const canMoveFiles = Boolean(capabilities?.move === "file-new-destination" && workspaceAdapter?.moveFile);
  useEffect10(() => {
    setFileOperation(null);
  }, [activeNode?.path]);
  useEffect10(() => {
    explorerScrollTopRef.current = 0;
    pendingExplorerScrollRestoreRef.current = null;
    setFileOperation(null);
    setDestination("");
    setFocusedLine(null);
    ++scrollRestoreGenerationRef.current;
    setFileTabs([]);
  }, [workspaceIdentity.threadId, workspaceIdentity.workspaceId]);
  useEffect10(() => {
    if (activeNode?.kind !== "file" || !activeNode.path) {
      return;
    }
    setFileTabs((current) => {
      if (current.some((tab) => tab.path === activeNode.path)) {
        return current;
      }
      return [...current, { name: activeNode.name, path: activeNode.path, pinned: true }];
    });
  }, [activeNode]);
  const filePanel = useFilePanel();
  const minimized = Boolean(filePanel?.minimized);
  const pathWhenMinimized = useRef10(null);
  useEffect10(() => {
    if (minimized) pathWhenMinimized.current = activeNode?.path ?? null;
  }, [minimized]);
  useEffect10(() => {
    if (minimized && activeNode?.kind === "file" && activeNode.path !== pathWhenMinimized.current) filePanel?.setMinimized?.(false);
  }, [activeNode?.path]);
  useEffect10(() => {
    if (focusPathRequest) {
      setFocusedLine(focusPathRequest.line ?? null);
      setCollapsedPanel(isMobileViewport && activeNode?.kind !== "directory" ? "explorer" : null);
    }
  }, [focusPathRequest, isMobileViewport, activeNode?.kind]);
  function rememberExplorerScroll() {
    const currentScrollTop = explorerScrollerRef.current?.scrollTop ?? explorerScrollTopRef.current;
    explorerScrollTopRef.current = currentScrollTop;
    pendingExplorerScrollRestoreRef.current = currentScrollTop;
  }
  function restoreExplorerScroll() {
    const generation = ++scrollRestoreGenerationRef.current;
    const target = pendingExplorerScrollRestoreRef.current ?? explorerScrollTopRef.current;
    const scroller = explorerScrollerRef.current;
    if (!scroller) {
      return;
    }
    let frame = 0;
    const cancel = () => {
      ++scrollRestoreGenerationRef.current;
      pendingExplorerScrollRestoreRef.current = null;
      removeListeners();
    };
    const removeListeners = () => {
      scroller.removeEventListener("wheel", cancel);
      scroller.removeEventListener("touchstart", cancel);
      scroller.removeEventListener("pointerdown", cancel);
    };
    scroller.addEventListener("wheel", cancel, { passive: true });
    scroller.addEventListener("touchstart", cancel, { passive: true });
    scroller.addEventListener("pointerdown", cancel, { passive: true });
    const restore = () => {
      const current = explorerScrollerRef.current;
      if (!current || generation !== scrollRestoreGenerationRef.current) {
        removeListeners();
        return;
      }
      current.scrollTop = Math.min(
        target,
        Math.max(0, current.scrollHeight - current.clientHeight)
      );
      explorerScrollTopRef.current = current.scrollTop;
      frame += 1;
      if (frame < 8) {
        window.requestAnimationFrame(restore);
      } else {
        pendingExplorerScrollRestoreRef.current = null;
        removeListeners();
      }
    };
    window.requestAnimationFrame(restore);
  }
  const treeShownForRevealRef = useRef10(null);
  useLayoutEffect3(() => {
    if (collapsedPanel === "explorer" || focusPathRequest && restoredRevealRef.current !== focusPathRequest.requestId) {
      return;
    }
    if (focusPathRequest && treeShownForRevealRef.current !== focusPathRequest.requestId) {
      treeShownForRevealRef.current = focusPathRequest.requestId;
      return;
    }
    restoreExplorerScroll();
  }, [collapsedPanel]);
  useLayoutEffect3(() => {
    if (focusPathRequest && !loadingTree && activeNode) {
      restoredRevealRef.current = focusPathRequest.requestId;
    }
  }, [focusPathRequest, loadingTree, activeNode]);
  useEffect10(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobileViewport(mediaQuery.matches);
    update();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }
    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);
  function handlePreview(node) {
    if (node.kind !== "file") {
      return;
    }
    rememberExplorerScroll();
    setFocusedLine(null);
    setSelectedNodeId(node.id);
    setCollapsedPanel("explorer");
  }
  function handlePin(node) {
    if (node.kind !== "file" || !node.path) {
      return;
    }
    setSelectedNodeId(node.id);
    setFileTabs((current) => {
      const existing = current.find((tab) => tab.path === node.path);
      if (existing) {
        return current.map(
          (tab) => tab.path === node.path ? { ...tab, pinned: true } : tab
        );
      }
      return [...current, { name: node.name, path: node.path, pinned: true }];
    });
  }
  function handleCloseTab(path) {
    const closingIndex = fileTabs.findIndex((tab) => tab.path === path);
    const nextTabs = fileTabs.filter((tab) => tab.path !== path);
    if (!documents.discard(path)) return;
    setFileTabs(nextTabs);
    if (activeNode?.path !== path) {
      return;
    }
    const replacement = nextTabs[Math.min(closingIndex, nextTabs.length - 1)] ?? null;
    if (replacement) {
      void focusWorkspacePath(replacement.path);
    } else {
      setSelectedNodeId(null);
      if (isMobileViewport) setCollapsedPanel("viewer");
    }
  }
  const explorerActions = {
    onCopyPath: handleCopyPath,
    ...workspaceAdapter?.renameNode ? { onRename: async (node, name) => {
      const relative = relativeWorkspacePath(node.path, detail.workspace.absPath);
      if (!relative || !name.trim() || name === "." || name === ".." || /[\\/\x00-\x1f]/.test(name)) throw new Error(translate("files.enterAValidFilenameWithoutPathSeparators"));
      if ([...dirtyFilePaths].some((path) => path === node.path || path.startsWith(`${node.path}/`))) throw new Error(translate("files.saveOrDiscardUnsavedChangesBeforeRenaming"));
      const prefix = relative.includes("/") ? relative.slice(0, relative.lastIndexOf("/") + 1) : "";
      const toPath = prefix + name.trim();
      await workspaceAdapter.renameNode({ ...workspaceIdentity, fromPath: relative, toPath });
      for (const path of documents.documents.keys()) if (path === node.path || path.startsWith(`${node.path}/`)) documents.discard(path);
      setFileTabs((tabs) => tabs.map((tab) => tab.path === node.path || tab.path.startsWith(`${node.path}/`) ? { ...tab, path: toPath + tab.path.slice(node.path.length), name: tab.path === node.path ? name.trim() : tab.name } : tab));
      await refreshWorkspaceTree(toPath);
    } } : {},
    ...workspaceAdapter?.deleteNode ? { onDelete: async (node) => {
      const relative = relativeWorkspacePath(node.path, detail.workspace.absPath);
      if (!relative) throw new Error(translate("files.theWorkspaceRootCannotBeDeleted"));
      if ([...dirtyFilePaths].some((path) => path === node.path || path.startsWith(`${node.path}/`))) throw new Error(translate("files.saveOrDiscardUnsavedChangesBeforeDeleting"));
      await workspaceAdapter.deleteNode({ ...workspaceIdentity, path: relative });
      for (const path of documents.documents.keys()) if (path === node.path || path.startsWith(`${node.path}/`)) documents.discard(path);
      setFileTabs((tabs) => tabs.filter((tab) => tab.path !== node.path && !tab.path.startsWith(`${node.path}/`)));
      if (activeNode?.path === node.path || activeNode?.path.startsWith(`${node.path}/`)) setSelectedNodeId(null);
      await refreshWorkspaceTree();
    } } : {},
    // ElAgente: downloads are gated by the advertised capabilities; folders may also download as ZIP.
    ...workspaceAdapter?.downloadNode ? { onDownload: (node) => void handleDownload(node) } : {},
    canDownload: (node) => !pending && canDownload(node),
    ...workspaceAdapter?.downloadNode && downloadFormats.includes("zip") ? { onDownloadZip: (node) => void handleDownload(node, "zip") } : {},
    ...workspaceAdapter?.emptyGarbage ? { onEmptyGarbage: handleOpenGarbage } : {},
    ...workspaceAdapter ? {
      onRefresh: () => {
        if (pending) return;
        resetTrashRetry();
        refreshCapabilities();
        void refreshWorkspaceTree(activeNode?.path ?? null);
      }
    } : {},
    ...canUploadFiles ? { onUpload: pickUploadFile } : {},
    ...workspaceAdapter?.createFile ? { onCreateFile: openCreateFile } : {}
  };
  const explorerPanel = /* @__PURE__ */ jsx14(
    WorkspaceExplorerPanel,
    {
      ...setShowHidden ? { showHidden, onShowHiddenChange: setShowHidden } : {},
      showThreadEvents,
      onShowThreadEventsChange: setShowThreadEvents,
      canEmptyGarbage: Boolean(workspaceAdapter?.emptyGarbage),
      canUpload: canUploadFiles,
      pending,
      canImportArchive: canImportArchives,
      importFormats,
      downloadFormats,
      archiveLimits: capabilities ? `${capabilities.maxArchiveBytes?.toLocaleString() ?? "bounded"} bytes expanded, ${capabilities.maxArchiveEntries?.toLocaleString() ?? "bounded"} entries; no symlinks or paths outside the workspace.` : void 0,
      ...canImportArchives ? { onImportArchive: () => archiveInputRef.current?.click() } : {},
      ...canDownloadTar ? { onDownloadWorkspace: () => void handleDownload(tree) } : {},
      ...canDownloadZip ? { onDownloadWorkspaceZip: () => void handleDownload(tree, "zip") } : {},
      canTrash,
      onTrashFile: canTrashFiles ? () => void trashFile() : void 0,
      onOpenTrash: canListTrash ? () => void openTrash() : void 0,
      canDelete,
      canMove,
      onDeleteFile: canDeleteFiles ? () => setFileOperation("delete") : void 0,
      onMoveFile: canMoveFiles ? () => {
        setDestination(activeNode?.path ?? "");
        setFileOperation("move");
      } : void 0,
      compactFolders: !isMobileViewport,
      directoryErrors,
      filterMode,
      filterQuery,
      initialLoading: Boolean(workspaceAdapter && !adapterModel && loadingTree),
      rootError: workspaceAdapter && !adapterModel ? workspaceError : null,
      ...minimized ? {} : collapsedPanel === "viewer" ? {
        onExpandViewer: () => {
          if (!isMobileViewport || activeNode?.kind === "file") setCollapsedPanel(isMobileViewport ? "explorer" : null);
        },
        // On phones the editor can only be shown for an open file.
        expandViewerAvailable: !isMobileViewport || activeNode?.kind === "file"
      } : {
        onCollapse: () => {
          rememberExplorerScroll();
          setCollapsedPanel("explorer");
        }
      },
      expandedPaths,
      loadingPaths: loadingDirectoryPaths,
      loading: loadingTree,
      explorerScrollTopRef,
      explorerScrollerRef,
      ...explorerActions,
      onCollapseAll: collapseAll,
      onFilterModeChange: setFilterMode,
      onFilterQueryChange: setFilterQuery,
      onRetryDirectory: (path) => void retryDirectory(path),
      onPreview: handlePreview,
      onPin: handlePin,
      onSelect: (nodeId) => {
        setSelectedNodeId(nodeId);
      },
      onSelectNode: (node) => {
        setNavigation((current) => ({ ...current, paths: [], index: -1 }));
        setFocusedLine(null);
        if ((isMobileViewport || collapsedPanel === "viewer") && node.kind !== "directory") {
          rememberExplorerScroll();
          setCollapsedPanel("explorer");
        }
      },
      onToggle: (path) => {
        toggleDirectory(path);
        setFocusedLine(null);
      },
      selectedNodeId: activeNode?.id ?? null,
      revealRequestKey: focusPathRequest?.requestId,
      tree,
      liveNodes
    }
  );
  const viewerPanel = /* @__PURE__ */ jsx14(
    GraphWorkspacePreviewPane,
    {
      mobileNavigation: isMobileViewport,
      readingPositions,
      ...navigation.index > 0 ? { onNavigateBack: () => navigatePreview(-1), previousFilePath: navigation.paths[navigation.index - 1] } : {},
      ...navigation.index < navigation.paths.length - 1 ? { onNavigateForward: () => navigatePreview(1) } : {},
      activeFilePath: activeNode?.kind === "file" ? activeNode.path : null,
      dirtyFilePaths,
      error: workspaceError ?? capabilityError,
      missingPath,
      fileTabs,
      downloadOnly,
      downloadReason,
      ...activeNode?.kind === "file" && canDownload(activeNode) ? { onDownloadFile: () => handleDownload(activeNode) } : {},
      imageUrl,
      loadingMore,
      focusLine: focusedLine,
      onOpenWorkspaceFile: (path) => {
        if (selectedFilePath) setNavigation((current) => current.index < 0 ? { ...current, paths: [selectedFilePath], index: 0 } : current);
        setFocusedLine(null);
        setCollapsedPanel(isMobileViewport ? "explorer" : null);
        void focusWorkspacePath(path);
      },
      ...workspaceAdapter?.textRangeRead ? { onLoadMore: handleLoadMore } : {},
      onReturnToFiles: () => {
        setNavigation((current) => ({ ...current, paths: [], index: -1 }));
        setCollapsedPanel("viewer");
      },
      onCloseFileTab: handleCloseTab,
      onSelectFileTab: (path) => {
        setNavigation((current) => ({ ...current, paths: [], index: -1 }));
        void focusWorkspacePath(path);
      },
      documents,
      resourceScopeKey: documents.source,
      canSaveDocument: Boolean(workspaceAdapter?.saveDocument),
      onSaveAndClose: async (path) => {
        if (await documents.save(path)) handleCloseTab(path);
      },
      ...collapsedPanel === "explorer" || isMobileViewport ? { onExpandExplorer: () => {
        setNavigation((current) => ({ ...current, paths: [], index: -1 }));
        setCollapsedPanel(isMobileViewport ? "viewer" : null);
      } } : {
        onCollapse: () => {
          rememberExplorerScroll();
          setCollapsedPanel("viewer");
        }
      },
      pdfUrl,
      previewFile: currentPreviewFile,
      previewLoading,
      plugins,
      ...workspaceAdapter?.getRawFileUrl ? {
        resolveWorkspaceFileUrl: (path) => workspaceAdapter.getRawFileUrl?.({
          ...workspaceIdentity,
          path
        }) ?? null
      } : {},
      selectedTarget: graphWorkspacePreviewTargetFromNode(activeNode),
      workspaceRootPath: detail.workspace.absPath
    },
    `${workspaceIdentity.threadId}:${workspaceIdentity.workspaceId}`
  );
  const overlays = /* @__PURE__ */ jsxs12(Fragment7, { children: [
    /* @__PURE__ */ jsx14("input", { ref: fileInputRef, type: "file", "aria-label": translate("files.workspaceUploadFileInput"), "data-testid": "workspace-upload-file-input", className: "hidden", onChange: (event) => void handleUpload(event) }),
    /* @__PURE__ */ jsx14("input", { ref: archiveInputRef, type: "file", accept: importFormats.map((format) => `.${format}`).join(","), "aria-label": "Workspace archive import input", "data-testid": "workspace-archive-import-input", className: "hidden", onChange: (event) => void handleArchiveImport(event) }),
    showGarbageDialog && /* @__PURE__ */ jsx14(GraphEmptyGarbageDialog, { files: garbageFiles, onCancel: () => setShowGarbageDialog(false), onConfirm: () => void handleConfirmEmptyGarbage() }),
    createDialog,
    capabilityError || notice && !showTrash ? /* @__PURE__ */ jsx14("div", { role: capabilityError ? "alert" : "status", className: "workspace-operation-notice", children: capabilityError ?? notice }) : null,
    /* @__PURE__ */ jsx14(
      WorkspaceTrashDialog,
      {
        open: showTrash,
        list: trashList,
        pending,
        error: workspaceError,
        notice,
        canRestore: canRestoreTrash,
        canEmpty: canEmptyTrash,
        confirming: confirmTrashEmpty,
        onClose: () => {
          setShowTrash(false);
          setConfirmTrashEmpty(false);
        },
        onRefresh: () => void openTrash(),
        onRestore: (entry) => void restoreTrash(entry),
        onConfirmingChange: setConfirmTrashEmpty,
        onEmpty: () => void emptyTrash()
      }
    ),
    /* @__PURE__ */ jsx14(
      ConfirmDialog,
      {
        open: fileOperation === "delete",
        title: "Permanently delete file",
        description: `Permanently delete ${activeNode?.name ?? "this file"}? This connection has no reversible trash. Immutable artifacts are retained, but workspace file links can stop working.`,
        confirmLabel: "Delete permanently",
        busy: pending,
        onCancel: () => setFileOperation(null),
        onConfirm: () => {
          setFileOperation(null);
          if (canDelete) void deleteFile();
        }
      }
    ),
    /* @__PURE__ */ jsx14(
      RenameDialog,
      {
        open: fileOperation === "move",
        title: "Move file",
        label: "New file path",
        description: "Move the selected file to a new workspace path. Existing files cannot be replaced.",
        submitLabel: "Move file",
        value: destination,
        busy: pending,
        onChange: setDestination,
        onCancel: () => setFileOperation(null),
        onSubmit: () => {
          setFileOperation(null);
          if (canMove) void moveFile(destination);
        }
      }
    )
  ] });
  if (minimized) {
    return /* @__PURE__ */ jsxs12("div", { "data-testid": "workspace-panel", "data-minimized": "true", className: "relative h-full min-h-0 w-full overflow-hidden p-1", children: [
      explorerPanel,
      overlays
    ] });
  }
  if (collapsedPanel === "explorer" || isMobileViewport && collapsedPanel === null && activeNode?.kind === "file") {
    return /* @__PURE__ */ jsxs12(
      "div",
      {
        "data-testid": "workspace-panel",
        className: "relative h-full min-h-0 w-full overflow-hidden p-1",
        children: [
          viewerPanel,
          overlays
        ]
      }
    );
  }
  if (collapsedPanel === "viewer" || isMobileViewport) {
    return /* @__PURE__ */ jsxs12(
      "div",
      {
        "data-testid": "workspace-panel",
        className: "relative h-full min-h-0 w-full overflow-hidden p-1",
        children: [
          explorerPanel,
          overlays
        ]
      }
    );
  }
  return /* @__PURE__ */ jsxs12(
    "div",
    {
      ref: workspacePanelRef,
      "data-testid": "workspace-panel",
      className: "flex h-full min-h-0 w-full overflow-hidden bg-transparent p-1",
      children: [
        /* @__PURE__ */ jsxs12(
          ResizablePanelGroup,
          {
            direction: "horizontal",
            className: "thread-graph-workspace-resizable",
            children: [
              /* @__PURE__ */ jsx14(ResizablePanel, { ref: treePanelRef, defaultSize: 28, minSize: 18, children: /* @__PURE__ */ jsx14("div", { className: "thread-graph-workspace-explorer-pane h-full min-h-0 overflow-hidden", children: explorerPanel }) }),
              /* @__PURE__ */ jsx14(ResizableHandle, { className: "thread-graph-workspace-resize-handle w-1 bg-transparent after:w-px after:bg-slate-200/80 after:transition-colors hover:after:bg-slate-300 dark:after:bg-[#303642] dark:hover:after:bg-[#475063]" }),
              /* @__PURE__ */ jsx14(ResizablePanel, { defaultSize: 72, minSize: 40, children: /* @__PURE__ */ jsx14("div", { className: "thread-graph-workspace-viewer-pane h-full min-h-0 overflow-hidden", children: viewerPanel }) })
            ]
          }
        ),
        overlays
      ]
    }
  );
}

// src/components/graph-chat/GraphVisualization.tsx
import { useCallback as useCallback5, useEffect as useEffect11, useMemo as useMemo8 } from "react";
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MarkerType as MarkerType2,
  Position as Position4,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// src/components/graph-chat/FloatingConnectionLine.tsx
import { getBezierPath } from "@xyflow/react";

// src/components/graph-chat/FloatingHelper.tsx
import { MarkerType, Position } from "@xyflow/react";
import { jsx as jsx15, jsxs as jsxs13 } from "react/jsx-runtime";
function getNodeIntersection(intersectionNode, targetNode) {
  const intersectionNodeWidth = Math.max(intersectionNode.measured.width ?? 1, 1);
  const intersectionNodeHeight = Math.max(
    intersectionNode.measured.height ?? 1,
    1
  );
  const intersectionNodePosition = intersectionNode.internals.positionAbsolute;
  const targetPosition = targetNode.internals.positionAbsolute;
  const targetNodeWidth = Math.max(targetNode.measured.width ?? 1, 1);
  const targetNodeHeight = Math.max(targetNode.measured.height ?? 1, 1);
  const w = intersectionNodeWidth / 2;
  const h = intersectionNodeHeight / 2;
  const x2 = intersectionNodePosition.x + w;
  const y2 = intersectionNodePosition.y + h;
  const x1 = targetPosition.x + targetNodeWidth / 2;
  const y1 = targetPosition.y + targetNodeHeight / 2;
  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1));
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  const x = w * (xx3 + yy3) + x2;
  const y = h * (-xx3 + yy3) + y2;
  return { x, y };
}
function getEdgePosition(node, intersectionPoint) {
  const n = { ...node.internals.positionAbsolute, ...node };
  const nx = Math.round(n.x);
  const ny = Math.round(n.y);
  const px = Math.round(intersectionPoint.x);
  const py = Math.round(intersectionPoint.y);
  if (px <= nx + 1) {
    return Position.Left;
  }
  if (px >= nx + (node.measured.width ?? 1) - 1) {
    return Position.Right;
  }
  if (py <= ny + 1) {
    return Position.Top;
  }
  if (py >= n.y + (node.measured.height ?? 1) - 1) {
    return Position.Bottom;
  }
  return Position.Top;
}
function getEdgeParams(source, target) {
  const sourceIntersectionPoint = getNodeIntersection(source, target);
  const targetIntersectionPoint = getNodeIntersection(target, source);
  const sourcePos = getEdgePosition(source, sourceIntersectionPoint);
  const targetPos = getEdgePosition(target, targetIntersectionPoint);
  return {
    sx: sourceIntersectionPoint.x,
    sy: sourceIntersectionPoint.y,
    tx: targetIntersectionPoint.x,
    ty: targetIntersectionPoint.y,
    sourcePos,
    targetPos
  };
}
function buildGraph(inputNodes, width = 900, height = 620) {
  if (!inputNodes || !Array.isArray(inputNodes)) {
    return { nodes: [], edges: [] };
  }
  const forceLayout = (nodes2, edges2, layoutWidth, layoutHeight) => {
    const nodePositions = /* @__PURE__ */ new Map();
    const nodeCount = nodes2.length;
    nodes2.forEach((node, index) => {
      const hash = node.id.split("").reduce((value, character) => {
        const nextValue = (value << 5) - value + character.charCodeAt(0);
        return nextValue & nextValue;
      }, 0);
      nodePositions.set(node.id, {
        x: Math.abs(hash) % layoutWidth + index * 100 % layoutWidth,
        y: Math.abs(hash >> 16) % layoutHeight + index * 150 % layoutHeight,
        vx: 0,
        vy: 0
      });
    });
    for (let iteration = 0; iteration < 200; iteration += 1) {
      for (let i = 0; i < nodeCount; i += 1) {
        for (let j = i + 1; j < nodeCount; j += 1) {
          const firstNode = nodes2[i];
          const secondNode = nodes2[j];
          if (!firstNode || !secondNode) {
            continue;
          }
          const pos1 = nodePositions.get(firstNode.id);
          const pos2 = nodePositions.get(secondNode.id);
          if (!pos1 || !pos2) {
            continue;
          }
          const dx = pos1.x - pos2.x;
          const dy = pos1.y - pos2.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const optimalDistance = 200;
          const force = (optimalDistance - distance) * 0.5;
          const fx = dx / distance * force;
          const fy = dy / distance * force;
          pos1.vx += fx;
          pos1.vy += fy;
          pos2.vx -= fx;
          pos2.vy -= fy;
        }
      }
      edges2.forEach((edge) => {
        const pos1 = nodePositions.get(edge.source);
        const pos2 = nodePositions.get(edge.target);
        if (!pos1 || !pos2) {
          return;
        }
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetLength = 120;
        const springForce = (distance - targetLength) * 0.3;
        const fx = dx / distance * springForce;
        const fy = dy / distance * springForce;
        pos1.vx += fx;
        pos1.vy += fy;
        pos2.vx -= fx;
        pos2.vy -= fy;
      });
      nodePositions.forEach((position) => {
        position.x += position.vx * 0.1;
        position.y += position.vy * 0.1;
        position.vx *= 0.9;
        position.vy *= 0.9;
        position.x = Math.max(80, Math.min(layoutWidth - 80, position.x));
        position.y = Math.max(80, Math.min(layoutHeight - 80, position.y));
      });
    }
    return nodePositions;
  };
  const inputIds = new Set(inputNodes.map((node) => node.id));
  const edges = [];
  inputNodes.forEach((node) => {
    if (!node.out_node_id) {
      return;
    }
    const outNodes = Array.isArray(node.out_node_id) ? node.out_node_id : [node.out_node_id];
    outNodes.forEach((outNodeId) => {
      if (!inputIds.has(outNodeId)) {
        return;
      }
      edges.push({
        id: `${node.id}-${outNodeId}`,
        source: node.id,
        target: outNodeId,
        type: "floating",
        sourceHandle: null,
        targetHandle: null,
        markerEnd: { type: MarkerType.Arrow }
      });
    });
  });
  const positions = forceLayout(inputNodes, edges, width, height);
  const nodes = inputNodes.map((node) => ({
    id: node.id,
    type: "styledNode",
    position: positions.get(node.id) ?? { x: 100, y: 100 },
    data: {
      label: /* @__PURE__ */ jsxs13("div", { className: "text-center", children: [
        /* @__PURE__ */ jsx15("div", { className: "text-sm font-semibold", children: node.name }),
        node.description ? /* @__PURE__ */ jsx15("div", { className: "mt-1 max-w-32 overflow-hidden text-ellipsis text-xs text-slate-500 dark:text-slate-400", children: node.description }) : null
      ] })
    }
  }));
  return { nodes, edges };
}

// src/components/graph-chat/FloatingConnectionLine.tsx
import { jsx as jsx16, jsxs as jsxs14 } from "react/jsx-runtime";
function FloatingConnectionLine({
  toX,
  toY,
  fromPosition,
  toPosition,
  fromNode
}) {
  useI18n();
  if (!fromNode) {
    return null;
  }
  const targetNode = {
    id: "connection-target",
    measured: {
      width: 1,
      height: 1
    },
    internals: {
      positionAbsolute: { x: toX, y: toY }
    }
  };
  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(
    fromNode,
    targetNode
  );
  const [edgePath] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos || fromPosition,
    targetPosition: targetPos || toPosition,
    targetX: tx || toX,
    targetY: ty || toY
  });
  return /* @__PURE__ */ jsxs14("g", { children: [
    /* @__PURE__ */ jsx16(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.5,
        className: "animated",
        d: edgePath
      }
    ),
    /* @__PURE__ */ jsx16(
      "circle",
      {
        cx: tx || toX,
        cy: ty || toY,
        fill: "var(--theme-panel)",
        r: 3,
        stroke: "currentColor",
        strokeWidth: 1.5
      }
    )
  ] });
}

// src/components/graph-chat/FloatingEdge.tsx
import { getBezierPath as getBezierPath2, useInternalNode } from "@xyflow/react";
import { jsx as jsx17 } from "react/jsx-runtime";
function FloatingEdge({
  id,
  source,
  target,
  markerEnd,
  style
}) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) {
    return null;
  }
  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(
    sourceNode,
    targetNode
  );
  const [edgePath] = getBezierPath2({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos,
    targetPosition: targetPos,
    targetX: tx,
    targetY: ty
  });
  return /* @__PURE__ */ jsx17(
    "path",
    {
      id,
      className: "react-flow__edge-path",
      d: edgePath,
      markerEnd,
      style
    }
  );
}

// src/components/graph-chat/GraphVisualization.tsx
import { jsx as jsx18, jsxs as jsxs15 } from "react/jsx-runtime";
function GraphVisualization({ nodes: inputNodes }) {
  useI18n();
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);
  const graph = useMemo8(() => buildGraph(inputNodes), [inputNodes]);
  const edgeTypes = useMemo8(() => ({ floating: FloatingEdge }), []);
  const nodeTypes = useMemo8(
    () => ({
      styledNode: ({ data, isConnectable }) => /* @__PURE__ */ jsxs15("div", { className: "thread-graph-flow-node", children: [
        data.label,
        /* @__PURE__ */ jsx18(
          Handle,
          {
            type: "target",
            position: Position4.Top,
            isConnectable,
            style: { opacity: 0, pointerEvents: "none" }
          }
        ),
        /* @__PURE__ */ jsx18(
          Handle,
          {
            type: "source",
            position: Position4.Bottom,
            isConnectable,
            style: { opacity: 0, pointerEvents: "none" }
          }
        )
      ] })
    }),
    []
  );
  useEffect11(() => {
    setFlowNodes(graph.nodes);
    setFlowEdges(graph.edges);
  }, [graph.edges, graph.nodes, setFlowEdges, setFlowNodes]);
  const onConnect = useCallback5(
    (params) => setFlowEdges(
      (edges) => addEdge(
        {
          ...params,
          type: "floating",
          sourceHandle: null,
          targetHandle: null,
          markerEnd: { type: MarkerType2.Arrow }
        },
        edges
      )
    ),
    [setFlowEdges]
  );
  return /* @__PURE__ */ jsx18("div", { className: "thread-graph-flow h-full min-h-0", children: /* @__PURE__ */ jsx18(ReactFlowProvider, { children: /* @__PURE__ */ jsxs15(
    ReactFlow,
    {
      nodes: flowNodes,
      edges: flowEdges,
      onNodesChange,
      onEdgesChange,
      onConnect,
      fitView: true,
      nodeTypes,
      edgeTypes,
      connectionLineComponent: FloatingConnectionLine,
      children: [
        /* @__PURE__ */ jsx18(Controls, {}),
        /* @__PURE__ */ jsx18(Background, { gap: 16 })
      ]
    }
  ) }) });
}

// src/components/ThreadGraphWorkspacePanel.tsx
import { jsx as jsx19, jsxs as jsxs16 } from "react/jsx-runtime";
var DEFAULT_WORKSPACE_FEATURES = {
  workspace: true,
  toolUsage: false,
  guide: false,
  threadGraph: true,
  extensions: true
};
function resolveWorkspaceFeatures(features) {
  return {
    ...DEFAULT_WORKSPACE_FEATURES,
    ...features
  };
}
function firstEnabledWorkspaceTab(features, preferred) {
  const isEnabled = (tab) => {
    switch (tab) {
      case "workspace":
        return features.workspace;
      case "tools":
        return false;
      case "guide":
        return false;
      case "graph":
        return features.threadGraph;
      case "extensions":
        return features.extensions;
    }
  };
  if (preferred && isEnabled(preferred)) {
    return preferred;
  }
  return [
    "workspace",
    "graph",
    "extensions"
  ].find(isEnabled) ?? null;
}
function isWorkspaceTabEnabled(features, tab) {
  switch (tab) {
    case "workspace":
      return features.workspace;
    case "tools":
      return false;
    case "guide":
      return false;
    case "graph":
      return features.threadGraph;
    case "extensions":
      return features.extensions;
  }
}
function collectToolEvents(detail) {
  const events = [];
  const toolKinds = /* @__PURE__ */ new Set([
    "toolCall",
    "commandExecution",
    "webSearch",
    "fileRead",
    "fileChange",
    "agentToolCall",
    "skillToolCall",
    "hook"
  ]);
  let sequence = 0;
  for (const turn of detail.turns) {
    for (const item of turn.items) {
      if (!toolKinds.has(item.kind)) {
        continue;
      }
      events.push({
        id: item.id,
        kind: item.kind,
        label: formatToolKind(item.kind),
        preview: item.previewText ?? item.text ?? item.kind,
        detail: item.detailText ?? item.text ?? item.previewText ?? item.kind,
        turnId: item.sourceTurnId ?? turn.id,
        status: item.status ?? null,
        sequence
      });
      sequence += 1;
    }
  }
  for (const item of detail.liveItems?.items ?? []) {
    if (!toolKinds.has(item.kind)) {
      continue;
    }
    events.push({
      id: item.id,
      kind: item.kind,
      label: formatToolKind(item.kind),
      preview: item.previewText ?? item.text ?? item.kind,
      detail: item.detailText ?? item.text ?? item.previewText ?? item.kind,
      turnId: item.sourceTurnId ?? null,
      status: item.status ?? null,
      sequence
    });
    sequence += 1;
  }
  return events;
}
function formatToolKind(value) {
  switch (value) {
    case "toolCall":
      return translate("files.toolCall");
    case "agentToolCall":
      return translate("files.agentTool");
    case "skillToolCall":
      return translate("files.skillTool");
    case "commandExecution":
      return translate("files.command");
    case "webSearch":
      return translate("files.search");
    case "fileRead":
      return translate("files.fileRead");
    case "fileChange":
      return translate("files.fileChange");
    case "hook":
      return translate("files.hook");
    default:
      return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
  }
}
function itemGraphLabel(item) {
  switch (item.kind) {
    case "userMessage":
      return translate("files.user");
    case "agentMessage":
      return translate("files.agent");
    default:
      return formatToolKind(item.kind);
  }
}
function itemGraphDescription(item) {
  const source = item.previewText ?? item.text ?? item.detailText ?? item.kind;
  return source.replace(/\s+/g, " ").slice(0, 96);
}
function collectGraphNodes(detail, toolEvents) {
  const nodes = [
    {
      id: `thread:${detail.thread.id}`,
      name: detail.thread.title || translate("files.thread"),
      description: detail.thread.model ?? detail.thread.status
    },
    {
      id: `workspace:${detail.workspace.id}`,
      name: detail.workspace.label ?? translate("files.workspace"),
      description: detail.workspace.absPath,
      out_node_id: `thread:${detail.thread.id}`
    }
  ];
  let previousTurnId = null;
  for (const turn of detail.turns) {
    const turnId = `turn:${turn.id}`;
    nodes.push({
      id: turnId,
      name: `Turn ${nodes.filter((node) => node.id.startsWith("turn:")).length + 1}`,
      description: turn.status,
      out_node_id: previousTurnId ? [`thread:${detail.thread.id}`, previousTurnId] : `thread:${detail.thread.id}`
    });
    previousTurnId = turnId;
    let previousItemId = null;
    for (const item of turn.items) {
      const itemId = `item:${item.id}`;
      const outNodeIds = [turnId];
      if (previousItemId) {
        outNodeIds.push(previousItemId);
      }
      nodes.push({
        id: itemId,
        name: itemGraphLabel(item),
        description: itemGraphDescription(item),
        out_node_id: outNodeIds
      });
      previousItemId = itemId;
      if (item.kind === "artifact" && item.artifact) {
        nodes.push({
          id: `artifact:${item.artifact.id}`,
          name: item.artifact.title || item.artifact.type,
          description: item.artifact.summaryText ?? item.artifact.type,
          out_node_id: itemId
        });
      }
    }
  }
  const toolNodeIds = new Set(nodes.map((node) => node.id));
  for (const event of toolEvents) {
    const eventId = `tool:${event.id}`;
    if (toolNodeIds.has(eventId) || toolNodeIds.has(`item:${event.id}`)) {
      continue;
    }
    nodes.push({
      id: eventId,
      name: event.label,
      description: event.preview,
      out_node_id: event.turnId ? `turn:${event.turnId}` : `thread:${detail.thread.id}`
    });
  }
  return nodes.slice(0, 120);
}
function ThreadGraphWorkspacePanel({
  detail,
  status,
  plugins,
  workspaceAdapter,
  metaContent,
  settingsContent,
  activeView = "chat",
  features: featureConfig,
  focusPathRequest = null,
  onActiveFileChange,
  hostPanels = [],
  hostPanelRequest = null
}) {
  const { locale: i18nLocale } = useI18n();
  const features = useMemo9(
    () => resolveWorkspaceFeatures(featureConfig),
    [featureConfig]
  );
  const initialTab = firstEnabledWorkspaceTab(features, featureConfig?.defaultTab);
  const [activeTab, setActiveTab] = useState11(initialTab);
  const [activeHostPanel, setActiveHostPanel] = useState11(null);
  const artifacts = useMemo9(() => collectArtifacts(detail), [detail]);
  const toolEvents = useMemo9(() => collectToolEvents(detail), [detail, i18nLocale]);
  const threadPanels = plugins.getThreadPanels();
  const graphNodes = useMemo9(
    () => collectGraphNodes(detail, toolEvents),
    [detail, toolEvents, i18nLocale]
  );
  const primaryTabs = useMemo9(() => {
    const tabs = [];
    if (features.workspace) {
      tabs.push({ id: "workspace", label: translate("files.workspace"), icon: null });
    }
    return tabs;
  }, [features.workspace, i18nLocale]);
  const secondaryTabs = useMemo9(() => {
    const tabs = [];
    if (features.threadGraph) {
      tabs.push({ id: "graph", label: translate("files.threadGraph"), icon: GitBranch });
    }
    if (features.extensions) {
      tabs.push({ id: "extensions", label: translate("files.pockymoeExtensions"), icon: Wrench });
    }
    return tabs;
  }, [features.extensions, features.threadGraph, i18nLocale]);
  useEffect12(() => {
    if (!activeTab || !isWorkspaceTabEnabled(features, activeTab)) {
      setActiveTab(firstEnabledWorkspaceTab(features, featureConfig?.defaultTab));
    }
  }, [activeTab, featureConfig?.defaultTab, features]);
  useEffect12(() => {
    if (focusPathRequest && features.workspace) {
      setActiveTab("workspace");
      setActiveHostPanel(null);
    }
  }, [features.workspace, focusPathRequest?.requestId]);
  const requestedPanel = hostPanelRequest?.id ?? null;
  const panelRequestId = hostPanelRequest?.requestId ?? null;
  useEffect12(() => {
    if (requestedPanel !== null) setActiveHostPanel(requestedPanel);
  }, [requestedPanel, panelRequestId]);
  const shownHostPanel = hostPanels.some((panel) => panel.id === activeHostPanel) ? activeHostPanel : null;
  const selectTab = (tab) => {
    setActiveTab(tab);
    setActiveHostPanel(null);
  };
  if (!activeTab && hostPanels.length === 0) {
    return null;
  }
  return /* @__PURE__ */ jsxs16("div", { className: "thread-graph-right-panel flex h-full min-h-0 flex-col overflow-hidden", children: [
    primaryTabs.length + secondaryTabs.length + hostPanels.length > 1 && /* @__PURE__ */ jsxs16("div", { className: "thread-graph-right-tabs flex h-9 shrink-0 items-center gap-0 overflow-hidden border-b px-1", children: [
      primaryTabs.map((tab) => {
        const Icon = tab.icon;
        return /* @__PURE__ */ jsxs16(
          "button",
          {
            type: "button",
            onClick: () => selectTab(tab.id),
            className: `thread-graph-right-tab inline-flex h-9 shrink-0 items-center gap-1.5 px-2.5 text-xs font-medium transition ${!shownHostPanel && activeTab === tab.id ? "is-active" : ""}`,
            children: [
              Icon ? /* @__PURE__ */ jsx19(Icon, { className: "h-3.5 w-3.5" }) : null,
              tab.label
            ]
          },
          tab.id
        );
      }),
      hostPanels.map((panel) => /* @__PURE__ */ jsxs16("span", { className: `thread-graph-right-host-tab inline-flex h-9 min-w-0 shrink items-center ${shownHostPanel === panel.id ? "is-active" : ""}`, children: [
        /* @__PURE__ */ jsx19(
          "button",
          {
            type: "button",
            onClick: () => setActiveHostPanel(panel.id),
            title: panel.title ?? panel.label,
            className: `thread-graph-right-tab inline-flex h-9 min-w-0 shrink items-center px-2.5 text-xs font-medium transition ${shownHostPanel === panel.id ? "is-active" : ""}`,
            children: /* @__PURE__ */ jsx19("span", { className: "truncate", children: panel.label })
          }
        ),
        panel.onClose ? /* @__PURE__ */ jsx19(
          "button",
          {
            type: "button",
            className: "thread-graph-right-host-tab-close inline-flex h-6 w-6 shrink-0 items-center justify-center",
            "aria-label": translate("files.closeHostPanel", { name: panel.label }),
            onClick: panel.onClose,
            children: /* @__PURE__ */ jsx19(X5, { className: "h-3 w-3", "aria-hidden": "true" })
          }
        ) : null
      ] }, panel.id)),
      secondaryTabs.length ? /* @__PURE__ */ jsx19(
        "div",
        {
          className: "thread-graph-right-tab-secondary ml-auto flex h-6 min-w-0 shrink items-center gap-0.5 border-l pl-1",
          "aria-label": translate("files.pockymoeWorkspaceExtensions"),
          children: secondaryTabs.map((tab) => {
            const Icon = tab.icon;
            return /* @__PURE__ */ jsx19(
              "button",
              {
                type: "button",
                onClick: () => selectTab(tab.id),
                className: `thread-graph-right-tab inline-flex h-8 w-8 shrink-0 items-center justify-center text-xs font-medium transition ${!shownHostPanel && activeTab === tab.id ? "is-active" : ""}`,
                title: tab.label,
                "aria-label": tab.label,
                children: /* @__PURE__ */ jsx19(Icon, { className: "h-3.5 w-3.5" })
              },
              tab.id
            );
          })
        }
      ) : null
    ] }),
    hostPanels.map((panel) => /* @__PURE__ */ jsx19("div", { className: "thread-graph-host-panel min-h-0 flex-1 overflow-auto", hidden: shownHostPanel !== panel.id, children: panel.content }, panel.id)),
    /* @__PURE__ */ jsxs16("div", { className: "min-h-0 flex-1 overflow-hidden", hidden: Boolean(shownHostPanel), children: [
      activeTab === "workspace" ? /* @__PURE__ */ jsx19(
        GraphWorkspaceExplorer,
        {
          activeView,
          detail,
          artifacts,
          plugins,
          status,
          focusPathRequest,
          workspaceAdapter: workspaceAdapter ?? null,
          ...onActiveFileChange ? { onActiveFileChange } : {}
        }
      ) : null,
      activeTab === "graph" ? /* @__PURE__ */ jsx19("div", { className: "thread-graph-visualization-panel h-full min-h-0 p-3", children: /* @__PURE__ */ jsx19(GraphVisualization, { nodes: graphNodes }) }) : null,
      activeTab === "extensions" ? /* @__PURE__ */ jsx19("div", { className: "h-full min-h-0 overflow-y-auto p-3", children: /* @__PURE__ */ jsxs16("div", { className: "grid gap-3", children: [
        /* @__PURE__ */ jsx19(WorkspaceInfoCard, { label: translate("files.pluginPanels"), children: threadPanels.length ? /* @__PURE__ */ jsx19("div", { className: "flex flex-wrap gap-2", children: threadPanels.map((panel) => /* @__PURE__ */ jsx19(
          "span",
          {
            className: "rounded-full border border-[var(--theme-border)] px-2 py-1 text-xs text-[var(--theme-fg-soft)]",
            children: panel.label
          },
          panel.id
        )) }) : /* @__PURE__ */ jsx19("p", { className: "text-[var(--theme-fg-muted)]", children: translate("files.noThreadPanelsAreEnabled") }) }),
        /* @__PURE__ */ jsx19(WorkspaceInfoCard, { label: translate("files.enabledRenderers"), children: /* @__PURE__ */ jsx19("div", { className: "flex flex-wrap gap-2", children: plugins.plugins.filter((plugin) => plugin.enabled).map((plugin) => /* @__PURE__ */ jsx19(
          "span",
          {
            className: "rounded-full border border-[var(--theme-border)] px-2 py-1 text-xs text-[var(--theme-fg-soft)]",
            children: plugin.name
          },
          plugin.id
        )) }) }),
        /* @__PURE__ */ jsx19(WorkspaceInfoCard, { label: translate("files.pockymoeTools"), children: /* @__PURE__ */ jsxs16("div", { className: "grid gap-2 text-[var(--theme-fg-muted)]", children: [
          /* @__PURE__ */ jsxs16("div", { className: "flex items-start gap-2", children: [
            /* @__PURE__ */ jsx19(Terminal, { className: "mt-0.5 h-4 w-4 shrink-0" }),
            /* @__PURE__ */ jsx19("p", { children: translate("files.terminalStaysAvailableWhenTheTerminalPlugin") })
          ] }),
          /* @__PURE__ */ jsxs16("div", { className: "flex items-start gap-2", children: [
            /* @__PURE__ */ jsx19(Paperclip, { className: "mt-0.5 h-4 w-4 shrink-0" }),
            /* @__PURE__ */ jsx19("p", { children: translate("files.composerAttachmentsSlashPanelsHooksMCPGoals") })
          ] }),
          /* @__PURE__ */ jsxs16("div", { className: "flex items-start gap-2", children: [
            /* @__PURE__ */ jsx19(Trash23, { className: "mt-0.5 h-4 w-4 shrink-0" }),
            /* @__PURE__ */ jsx19("p", { children: translate("files.destructiveActionsStayExplicitDeleteThreadInterrupt") })
          ] })
        ] }) }),
        metaContent ? /* @__PURE__ */ jsx19(WorkspaceInfoCard, { label: translate("files.threadMeta"), children: metaContent }) : null,
        settingsContent ? /* @__PURE__ */ jsx19(WorkspaceInfoCard, { label: translate("files.settings"), children: settingsContent }) : null
      ] }) }) : null
    ] })
  ] });
}
var MemoizedThreadGraphWorkspacePanel = memo2(
  ThreadGraphWorkspacePanel
);
export {
  MemoizedThreadGraphWorkspacePanel,
  ThreadGraphWorkspacePanel
};
