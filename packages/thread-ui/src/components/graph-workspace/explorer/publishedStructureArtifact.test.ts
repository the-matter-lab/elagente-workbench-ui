import { describe, expect, it } from 'vitest';
import type { ThreadArtifactDto } from '@remote-codex/shared';

import { publishedArtifactForFile } from './publishedStructureArtifact';

const artifact = (id: string, path: string, checksum: string, objectId = 'urn:object', sourceRevision = checksum): ThreadArtifactDto => ({
  id, pluginId: 'elagente.xyz', type: 'chem.structure', title: path, workspacePath: path, payload: {}, createdAt: '2026-11-12T00:00:00Z',
  metadata: { version: 1, objectId, sourceRevision, checksum, format: 'xyz' } as ThreadArtifactDto['metadata'],
});

describe('publishedArtifactForFile', () => {
  it('binds only the artifact for the exact path and checksum', () => {
    const old = artifact('art_old', 'out/water.xyz', 'a'.repeat(64), 'urn:old');
    const current = artifact('art_new', 'out/water.xyz', 'b'.repeat(64), 'urn:new');
    const other = artifact('art_other', 'out/ethanol.xyz', 'b'.repeat(64), 'urn:other');
    expect(publishedArtifactForFile([old, current, other], 'out/water.xyz', 'b'.repeat(64))).toBe(current);
    expect(publishedArtifactForFile([old, current], 'out/water.xyz', 'a'.repeat(64))).toBe(old);
    // A file whose bytes were never published keeps the plain preview.
    expect(publishedArtifactForFile([old, current], 'out/water.xyz', 'c'.repeat(64))).toBeNull();
    expect(publishedArtifactForFile([old], 'out/water.xyz', null)).toBeNull();
  });

  it('never binds a revision its object has moved past', () => {
    const scanned = artifact('art_scan', 'out/water.xyz', 'a'.repeat(64));
    const edited = artifact('art_edit', 'scientific-edits/e1.extxyz', 'd'.repeat(64), 'urn:object', 'edit-1');
    expect(publishedArtifactForFile([scanned, edited], 'out/water.xyz', 'a'.repeat(64))).toBeNull();
    // A republished ID keeps its first position, as on the coordinator.
    expect(publishedArtifactForFile([scanned, edited, scanned], 'out/water.xyz', 'a'.repeat(64))).toBeNull();
  });

  it('ignores artifacts without scientific metadata', () => {
    const plain = { ...artifact('art_plain', 'out/water.xyz', 'a'.repeat(64)), metadata: undefined };
    expect(publishedArtifactForFile([plain], 'out/water.xyz', 'a'.repeat(64))).toBeNull();
  });
});
