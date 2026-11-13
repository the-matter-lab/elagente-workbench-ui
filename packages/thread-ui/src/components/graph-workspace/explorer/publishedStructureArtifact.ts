import type { ThreadArtifactDto } from '@remote-codex/shared';

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
