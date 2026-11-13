import type { ThreadArtifactDto } from '@remote-codex/shared';
import { translate } from '../../../i18n';

// Order follows first publication, as the coordinator's artifact list does; a
// republished ID keeps its position.
function firstPublished(artifacts: readonly ThreadArtifactDto[]) {
  const unique = new Map<string, ThreadArtifactDto>();
  for (const artifact of artifacts) if (!unique.has(artifact.id)) unique.set(artifact.id, artifact);
  return [...unique.values()];
}

/**
 * The newest published revision of the artifact's scientific object (structure
 * edits step 3, ELA-385): a viewer follows its object to every new revision,
 * whatever file that revision lives in. An artifact without an object is its
 * own latest.
 */
export function latestArtifactForObject(
  artifacts: readonly ThreadArtifactDto[],
  artifact: ThreadArtifactDto,
): ThreadArtifactDto {
  const objectId = artifact.metadata?.objectId;
  if (!objectId) return artifact;
  return firstPublished(artifacts).findLast(value => value.metadata?.objectId === objectId) ?? artifact;
}

/**
 * The artifact a file preview binds (step 0), followed to its object's latest
 * revision (step 3). Binding gives the preview a verified, current target, so
 * Send selection and structure actions work there.
 *
 * The file must match an exact `(path, checksum)` publication: a file whose
 * bytes were never published keeps the plain preview.
 */
export function followedArtifactForFile(
  artifacts: readonly ThreadArtifactDto[],
  path: string,
  checksum: string | null | undefined,
): ThreadArtifactDto | null {
  if (!path || !checksum) return null;
  const match = firstPublished(artifacts).findLast(artifact => artifact.workspacePath === path &&
    artifact.metadata?.checksum === checksum && artifact.metadata.objectId);
  return match ? latestArtifactForObject(artifacts, match) : null;
}

export interface StructureDisplayName {
  /** What to show: the origin name, with "(edit N)" for a revision in another file. */
  label: string;
  /** Basename of the path of the object's earliest published artifact. */
  originName: string;
  /** N in "(edit N)", or null when no hint is shown. */
  edit: number | null;
  /** The shown artifact's own workspace path, for a tooltip or details. */
  path: string | null;
}

const basename = (path: string) => path.replace(/\/+$/, '').split('/').at(-1) || path;

/**
 * How a structure revision is named to the user (structure edits, UX a): by
 * its object's origin file, e.g. "ethanol.xyz (edit 2)", never by a revision's
 * hash-named file. N counts the object's artifacts after the first, in
 * publication order; a revision written back to the origin path needs no hint.
 */
export function structureDisplayName(
  artifacts: readonly ThreadArtifactDto[],
  artifact: ThreadArtifactDto,
): StructureDisplayName {
  const path = artifact.workspacePath || null;
  const own = path ? basename(path) : artifact.title || artifact.id;
  const objectId = artifact.metadata?.objectId;
  const list = firstPublished(artifacts.some(value => value.id === artifact.id) ? artifacts : [...artifacts, artifact]);
  const revisions = objectId ? list.filter(value => value.metadata?.objectId === objectId) : [];
  const origin = revisions[0];
  if (!origin) return { label: own, originName: own, edit: null, path };
  const originName = origin.workspacePath ? basename(origin.workspacePath) : origin.title || own;
  const index = revisions.findIndex(value => value.id === artifact.id);
  const edit = index > 0 && path !== origin.workspacePath ? index : null;
  return {
    label: edit === null ? originName : translate('files.structureEditName', { name: originName, edit }),
    originName,
    edit,
    path,
  };
}
