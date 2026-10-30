import {
  translate
} from "./chunk-S2ZDXRUN.js";

// src/components/themeHooks.ts
import { useSyncExternalStore } from "react";
var THEME_FEATURES = [
  /** Phones: Home and Chat move from the top bar into the thread drawer. */
  "workbench.phoneDrawerTools",
  /** The model chip shows the agent's avatar and a menu chevron. */
  "composer.modelAvatar",
  /** Icon rows in the slash toolbox and attach menu, a "/" glyph and a paperclip trigger. */
  "composer.richMenus",
  /** A paper plane for Send; the send intents themselves show in every theme. */
  "composer.intentIcons",
  /** Each reply opens with the agent's avatar and name, ahead of the work summary. */
  "transcript.agentByline",
  /** Short Explorer row-menu labels; the node name stays in the accessible name. */
  "explorer.shortMenuLabels",
  /** Code blocks use the CSS-variable Shiki theme (`--shiki-*`). */
  "code.cssSyntaxPalette"
];
function isThemeFeature(value) {
  return typeof value === "string" && THEME_FEATURES.includes(value);
}
var THEME_ATTRIBUTES = ["data-theme-preset", "data-theme-features"];
function subscribe(onChange) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: THEME_ATTRIBUTES });
  return () => observer.disconnect();
}
var readPreset = () => document.documentElement.dataset.themePreset ?? "";
var readFeatures = () => document.documentElement.dataset.themeFeatures ?? "";
var readRevision = () => `${readPreset()}|${readFeatures()}`;
function documentThemeFeatures() {
  return readFeatures().split(/\s+/).filter(isThemeFeature);
}
function hasThemeFeature(flag) {
  return readFeatures().split(/\s+/).includes(flag);
}
function useThemeFeature(flag) {
  return useSyncExternalStore(subscribe, () => hasThemeFeature(flag), () => false);
}
function useDocumentThemeRevision() {
  return useSyncExternalStore(subscribe, readRevision, () => "");
}
function shellThemeProps(element) {
  const shell = element?.closest(".thread-ui-shell");
  const effective = shell?.dataset.themeEffective;
  return {
    themeClass: effective === "dark" ? "thread-ui-theme-dark dark" : "",
    "data-theme-effective": effective,
    "data-theme-mode": shell?.dataset.themeMode
  };
}
function cssHexVariable(element, name) {
  if (!element) return void 0;
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  return /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? value : void 0;
}

// src/components/workspacePaths.ts
function normalizeFileSystemPath(value) {
  return value.trim().replace(/\\/g, "/").replace(/^\/([a-z]:\/)/i, "$1");
}
var APP_LOCAL_PATH_PREFIXES = [
  "/api/",
  "/assets/",
  "/control-plane",
  "/devices/",
  "/relay/",
  "/relay-account",
  "/relay-admin",
  "/relay-devices",
  "/relay-portal",
  "/threads",
  "/workspaces"
];
function localFileHref(value, origin) {
  let candidate = value.trim();
  if (!candidate || candidate.startsWith("#") || candidate.startsWith("//")) return null;
  if (/^(https?:|file:)/i.test(candidate)) {
    try {
      const url = new URL(candidate);
      if (url.protocol !== "file:" && url.origin !== origin) return null;
      candidate = (url.protocol === "file:" && url.hostname ? `//${url.hostname}` : "") + url.pathname + url.hash;
    } catch {
      return null;
    }
  } else {
    candidate = candidate.split("?")[0] ?? "";
  }
  try {
    candidate = decodeURIComponent(candidate);
  } catch {
  }
  candidate = normalizeFileSystemPath(candidate);
  if (/^[a-z][a-z+.-]*:/i.test(candidate) && !/^[a-z]:\//i.test(candidate)) return null;
  if (APP_LOCAL_PATH_PREFIXES.some((prefix) => candidate === prefix || candidate.startsWith(prefix))) return null;
  return candidate || null;
}
function relativeWorkspacePath(value, workspaceRoot) {
  let path = normalizeFileSystemPath(value);
  const root = normalizeFileSystemPath(workspaceRoot).replace(/\/+$/, "");
  const absolute = path.startsWith("/") || /^[a-z]:\//i.test(path);
  if (absolute) {
    const windows = /^[a-z]:\//i.test(root) || root.startsWith("//");
    const comparePath = windows ? path.toLowerCase() : path;
    const compareRoot = windows ? root.toLowerCase() : root;
    if (comparePath === compareRoot) return "";
    if (!comparePath.startsWith(`${compareRoot}/`)) return null;
    path = path.slice(root.length + 1);
  }
  const segments = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!segments.length) return null;
      segments.pop();
    } else segments.push(part);
  }
  return segments.join("/");
}

// src/components/graph-workspace/workspaceTree.ts
import { validateArtifactMetadata } from "@remote-codex/shared";
var MOLECULAR_EXTENSIONS = /* @__PURE__ */ new Set([
  "xyz",
  "extxyz",
  "cif",
  "pdb",
  "sdf",
  "mol"
]);
var IMAGE_EXTENSIONS = /* @__PURE__ */ new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg"
]);
var PDF_EXTENSIONS = /* @__PURE__ */ new Set(["pdf"]);
function collectArtifacts(detail) {
  const artifacts = [];
  for (const turn of detail.turns) {
    for (const item of turn.items) {
      if (item.kind === "artifact" && item.artifact) {
        artifacts.push(item.artifact);
      }
    }
  }
  for (const item of detail.liveItems?.items ?? []) {
    if (item.kind === "artifact" && item.artifact) {
      artifacts.push(item.artifact);
    }
  }
  return artifacts;
}
function sanitizePathSegment(value) {
  return value.trim().replace(/^\/+|\/+$/g, "").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
}
function extensionOf(path) {
  return path.split(".").pop()?.toLowerCase() || "";
}
function fileNameFromPath(path) {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}
function workspaceTreeNodeToGraphNode(node) {
  const kind = node.kind === "directory" ? "directory" : "file";
  const normalized = normalizeFileSystemPath(node.path);
  const path = normalized.startsWith("/") || /^[a-z]:\//i.test(normalized) ? normalized : relativeWorkspacePath(normalized, "") ?? normalized;
  const children = (node.children ?? []).map(workspaceTreeNodeToGraphNode);
  return {
    id: `workspace:${path}`,
    name: node.name,
    path,
    kind,
    ...node.size !== void 0 ? { size: node.size } : {},
    ...node.hasChildren !== void 0 ? { hasChildren: node.hasChildren } : kind === "directory" ? { hasChildren: children.length > 0 } : {},
    ...node.childrenLoaded !== void 0 ? { childrenLoaded: node.childrenLoaded } : kind === "directory" ? { childrenLoaded: node.children !== void 0 } : {},
    ...node.truncated !== void 0 ? { truncated: node.truncated } : {},
    workspaceNode: { ...node, path },
    children
  };
}
function findFirstWorkspaceFile(node) {
  if (node.kind === "file") {
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
function normalizeWorkspacePath(path) {
  return path.trim().replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/^\/+/, "");
}
function workspaceRelativeFocusPath(path, workspaceRootPath) {
  return relativeWorkspacePath(path, workspaceRootPath) ?? normalizeFileSystemPath(path);
}
function ancestorDirectoryPaths(path) {
  const normalized = normalizeWorkspacePath(path);
  const segments = normalized.split("/").filter(Boolean);
  segments.pop();
  const paths = [];
  let current = "";
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    paths.push(current);
  }
  return paths;
}
function hasWorkspacePath(node, targetPath) {
  if (!node || !targetPath) {
    return false;
  }
  if (node.path === targetPath) {
    return true;
  }
  return node.children.some((child) => hasWorkspacePath(child, targetPath));
}
function buildMoleculePreviewSnapshot(file) {
  if (!file) {
    return null;
  }
  const extension = extensionOf(file.path);
  if (!MOLECULAR_EXTENSIONS.has(extension)) {
    return null;
  }
  return {
    content: [file.content.endsWith("\n") ? file.content : `${file.content}
`],
    format: extension === "extxyz" ? "xyz" : extension,
    name: file.name,
    uuid: file.path
  };
}
function languageForPath(path) {
  const extension = extensionOf(path);
  if (extension === "tsx" || extension === "jsx") {
    return "tsx";
  }
  if (extension === "yml") {
    return "yaml";
  }
  return extension || "text";
}
function ensureDirectory(root, segments) {
  let current = root;
  let path = root.path;
  for (const segment of segments) {
    path = path ? `${path}/${segment}` : segment;
    let child = current.children.find(
      (node) => node.kind === "directory" && node.name === segment
    );
    if (!child) {
      child = {
        id: `dir:${path}`,
        name: segment,
        path,
        kind: "directory",
        children: []
      };
      current.children.push(child);
    }
    current = child;
  }
  return current;
}
function addPathNode(root, path, node) {
  const segments = path.split("/").filter(Boolean);
  const fileName = segments.pop() ?? node.name;
  const parent = ensureDirectory(root, segments);
  parent.children.push({
    ...node,
    name: node.name || fileName,
    path: root.path ? `${root.path}/${path}` : path
  });
}
function compareWorkspaceNodes(left, right) {
  if (left.kind === "directory" && right.kind !== "directory") {
    return -1;
  }
  if (left.kind !== "directory" && right.kind === "directory") {
    return 1;
  }
  return left.name.localeCompare(right.name);
}
function sortWorkspaceTree(node) {
  node.children.sort(compareWorkspaceNodes);
  for (const child of node.children) {
    sortWorkspaceTree(child);
  }
  return node;
}
function artifactNodeIdentity(artifact) {
  try {
    const metadata = validateArtifactMetadata(artifact.metadata);
    if (metadata.stream && !artifact.extensionError)
      return JSON.stringify(["stream", artifact.type, metadata.objectId, metadata.stream.id]);
  } catch {
  }
  return JSON.stringify(["artifact", artifact.id]);
}
function collectWorkspaceItems(detail, artifacts, status, activeView, { includeThreadEvents = false } = {}) {
  const root = {
    id: "root",
    name: detail.workspace.label ?? translate("files.workspace"),
    path: "",
    kind: "directory",
    children: []
  };
  const artifactRoot = {
    id: "artifacts",
    name: "artifacts",
    path: "artifacts:",
    kind: "directory",
    children: []
  };
  for (const artifact of artifacts) {
    const title = artifact.title || artifact.id;
    const safeName = sanitizePathSegment(title) || artifact.id;
    const identity = artifactNodeIdentity(artifact);
    const existing = artifactRoot.children.findIndex(
      (node2) => node2.id === `artifact:${identity}`
    );
    const node = {
      id: `artifact:${identity}`,
      name: `${safeName}.artifact`,
      path: `artifacts:/${encodeURIComponent(identity)}.artifact`,
      kind: "artifact",
      artifact,
      preview: artifact.summaryText ?? artifact.type,
      detail: JSON.stringify(artifact.payload, null, 2),
      children: []
    };
    if (existing < 0) artifactRoot.children.push(node);
    else artifactRoot.children[existing] = node;
  }
  const eventRoot = {
    id: "thread-events",
    name: "thread-events",
    path: "thread-events:",
    kind: "directory",
    children: []
  };
  const liveRoot = {
    id: "live",
    name: "live",
    path: "live:",
    kind: "directory",
    children: []
  };
  let sequence = 0;
  const addEventNode = (turnId, item, live = false) => {
    const liveArtifact = live && item.kind === "artifact" && Boolean(item.artifact);
    if (!includeThreadEvents && !liveArtifact) return;
    sequence += 1;
    const label = item.kind.replace(/([A-Z])/g, "-$1").toLowerCase();
    const eventPath = `${live ? "live:" : `thread-events:/${turnId}`}/${String(
      sequence
    ).padStart(3, "0")}-${label}.json`;
    const preview = "text" in item && typeof item.text === "string" ? item.text.slice(0, 160) : item.kind;
    const artifact = item.kind === "artifact" && item.artifact ? item.artifact : null;
    const node = artifact && live ? {
      id: `live-artifact:${artifactNodeIdentity(artifact)}`,
      name: artifact.title || artifact.id,
      path: `live:/${encodeURIComponent(artifactNodeIdentity(artifact))}.artifact`,
      kind: "live-artifact",
      artifact,
      item,
      preview: artifact.summaryText ?? artifact.type,
      detail: JSON.stringify(artifact.payload, null, 2),
      children: []
    } : {
      id: `event:${item.id}`,
      name: fileNameFromPath(eventPath),
      path: eventPath,
      kind: "event",
      item,
      preview,
      detail: JSON.stringify(item, null, 2),
      children: []
    };
    if (live) {
      const existing = liveRoot.children.findIndex(
        (value) => value.id === node.id
      );
      if (existing < 0) liveRoot.children.push(node);
      else liveRoot.children[existing] = node;
      return;
    }
    addPathNode(eventRoot, eventPath.replace(/^thread-events:\//, ""), node);
  };
  for (const turn of detail.turns) {
    for (const item of turn.items) {
      if (item.kind === "commandExecution" || item.kind === "webSearch" || item.kind === "fileRead" || item.kind === "fileChange" || item.kind === "agentToolCall" || item.kind === "skillToolCall" || item.kind === "toolCall" || item.kind === "hook" || item.kind === "plan" || item.kind === "reasoning") {
        addEventNode(turn.id, item);
      }
    }
  }
  for (const item of detail.liveItems?.items ?? []) {
    addEventNode(detail.thread.activeTurnId ?? "live", item, true);
  }
  void status;
  void activeView;
  root.children.push(artifactRoot);
  if (includeThreadEvents) root.children.push(eventRoot, liveRoot);
  else if (liveRoot.children.length) root.children.push(liveRoot);
  return sortWorkspaceTree(root);
}
function flattenWorkspaceNodes(root) {
  const map = /* @__PURE__ */ new Map();
  const visit = (node) => {
    map.set(node.id, node);
    for (const child of node.children) {
      visit(child);
    }
  };
  visit(root);
  return map;
}
function findFirstPreviewNode(node) {
  if (node.kind === "artifact" || node.kind === "live-artifact" || node.kind === "event" || node.kind === "file") {
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
function collectAncestorPaths(path) {
  const segments = path.split("/").filter(Boolean);
  const paths = [];
  for (let index = 1; index <= segments.length; index += 1) {
    paths.push(segments.slice(0, index).join("/"));
  }
  return paths;
}

export {
  THEME_FEATURES,
  isThemeFeature,
  documentThemeFeatures,
  useThemeFeature,
  useDocumentThemeRevision,
  shellThemeProps,
  cssHexVariable,
  normalizeFileSystemPath,
  localFileHref,
  relativeWorkspacePath,
  MOLECULAR_EXTENSIONS,
  IMAGE_EXTENSIONS,
  PDF_EXTENSIONS,
  collectArtifacts,
  extensionOf,
  workspaceTreeNodeToGraphNode,
  findFirstWorkspaceFile,
  workspaceRelativeFocusPath,
  ancestorDirectoryPaths,
  hasWorkspacePath,
  buildMoleculePreviewSnapshot,
  languageForPath,
  compareWorkspaceNodes,
  collectWorkspaceItems,
  flattenWorkspaceNodes,
  findFirstPreviewNode,
  collectAncestorPaths
};
