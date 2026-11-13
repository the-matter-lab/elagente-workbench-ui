import {
  translate
} from "./chunk-D5VSPJC3.js";

// src/components/graph-workspace/explorer/publishedStructureArtifact.ts
function firstPublished(artifacts) {
  const unique = /* @__PURE__ */ new Map();
  for (const artifact of artifacts) if (!unique.has(artifact.id)) unique.set(artifact.id, artifact);
  return [...unique.values()];
}
function latestArtifactForObject(artifacts, artifact) {
  const objectId = artifact.metadata?.objectId;
  if (!objectId) return artifact;
  return firstPublished(artifacts).findLast((value) => value.metadata?.objectId === objectId) ?? artifact;
}
function followedArtifactForFile(artifacts, path, checksum) {
  if (!path || !checksum) return null;
  const match = firstPublished(artifacts).findLast((artifact) => artifact.workspacePath === path && artifact.metadata?.checksum === checksum && artifact.metadata.objectId);
  return match ? latestArtifactForObject(artifacts, match) : null;
}
var basename = (path) => path.replace(/\/+$/, "").split("/").at(-1) || path;
function structureDisplayName(artifacts, artifact) {
  const path = artifact.workspacePath || null;
  const own = path ? basename(path) : artifact.title || artifact.id;
  const objectId = artifact.metadata?.objectId;
  const list = firstPublished(artifacts.some((value) => value.id === artifact.id) ? artifacts : [...artifacts, artifact]);
  const revisions = objectId ? list.filter((value) => value.metadata?.objectId === objectId) : [];
  const origin = revisions[0];
  if (!origin) return { label: own, originName: own, edit: null, path };
  const originName = origin.workspacePath ? basename(origin.workspacePath) : origin.title || own;
  const index = revisions.findIndex((value) => value.id === artifact.id);
  const edit = index > 0 && path !== origin.workspacePath ? index : null;
  return {
    label: edit === null ? originName : translate("files.structureEditName", { name: originName, edit }),
    originName,
    edit,
    path
  };
}

export {
  latestArtifactForObject,
  followedArtifactForFile,
  structureDisplayName
};
