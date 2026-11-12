import type { ThreadArtifactDto } from '@remote-codex/shared';

/**
 * The artifact an Agent already published for exactly this file revision
 * (structure edits step 0, ELA-385). Binding it gives the file preview a
 * verified target, so Send selection and structure actions work there.
 *
 * Only an exact `(path, checksum)` match qualifies, and only while it is still
 * its object's latest revision: an older checksum or a superseded revision
 * would be rejected as a stale target. Order follows first publication, as the
 * coordinator's artifact list does; a republished ID keeps its position.
 */
export function publishedArtifactForFile(
  artifacts: readonly ThreadArtifactDto[],
  path: string,
  checksum: string | null | undefined,
): ThreadArtifactDto | null {
  if (!path || !checksum) return null;
  const unique = new Map<string, ThreadArtifactDto>();
  for (const artifact of artifacts) if (!unique.has(artifact.id)) unique.set(artifact.id, artifact);
  const published = [...unique.values()];
  const match = published.findLast(artifact => artifact.workspacePath === path &&
    artifact.metadata?.checksum === checksum && artifact.metadata.objectId);
  if (!match) return null;
  const latest = published.findLast(artifact => artifact.metadata?.objectId === match.metadata!.objectId);
  return latest?.metadata?.sourceRevision === match.metadata!.sourceRevision ? match : null;
}
