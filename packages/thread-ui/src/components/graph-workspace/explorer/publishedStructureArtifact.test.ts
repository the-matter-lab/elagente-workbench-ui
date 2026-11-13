import { describe, expect, it } from 'vitest';
import type { ThreadArtifactDto } from '@remote-codex/shared';

import { followedArtifactForFile, latestArtifactForObject } from './publishedStructureArtifact';

const artifact = (id: string, path: string, checksum: string, objectId = 'urn:object', sourceRevision = checksum): ThreadArtifactDto => ({
  id, pluginId: 'elagente.xyz', type: 'chem.structure', title: path, workspacePath: path, payload: {}, createdAt: '2026-11-12T00:00:00Z',
  metadata: { version: 1, objectId, sourceRevision, checksum, format: 'xyz' } as ThreadArtifactDto['metadata'],
});

describe('followedArtifactForFile', () => {
  it('binds only the artifact for the exact path and checksum', () => {
    const old = artifact('art_old', 'out/water.xyz', 'a'.repeat(64), 'urn:old');
    const current = artifact('art_new', 'out/water.xyz', 'b'.repeat(64), 'urn:new');
    const other = artifact('art_other', 'out/ethanol.xyz', 'b'.repeat(64), 'urn:other');
    expect(followedArtifactForFile([old, current, other], 'out/water.xyz', 'b'.repeat(64))).toBe(current);
    expect(followedArtifactForFile([old, current], 'out/water.xyz', 'a'.repeat(64))).toBe(old);
    // A file whose bytes were never published keeps the plain preview.
    expect(followedArtifactForFile([old, current], 'out/water.xyz', 'c'.repeat(64))).toBeNull();
    expect(followedArtifactForFile([old], 'out/water.xyz', null)).toBeNull();
  });

  it('follows a superseded file revision to its object’s latest revision', () => {
    const scanned = artifact('art_scan', 'out/water.xyz', 'a'.repeat(64));
    const edited = artifact('art_edit', 'scientific-edits/e1.extxyz', 'd'.repeat(64), 'urn:object', 'edit-1');
    expect(followedArtifactForFile([scanned, edited], 'out/water.xyz', 'a'.repeat(64))).toBe(edited);
    // A republished ID keeps its first position, as on the coordinator.
    expect(followedArtifactForFile([scanned, edited, scanned], 'out/water.xyz', 'a'.repeat(64))).toBe(edited);
    // The edit's own file follows too, once the Agent republishes the source.
    const agent = artifact('art_agent', 'out/water.xyz', 'e'.repeat(64));
    expect(followedArtifactForFile([scanned, edited, agent], 'scientific-edits/e1.extxyz', 'd'.repeat(64))).toBe(agent);
  });

  it('ignores artifacts without scientific metadata', () => {
    const plain = { ...artifact('art_plain', 'out/water.xyz', 'a'.repeat(64)), metadata: undefined };
    expect(followedArtifactForFile([plain], 'out/water.xyz', 'a'.repeat(64))).toBeNull();
  });
});

describe('latestArtifactForObject', () => {
  it('returns the newest revision of the same object, or the artifact itself', () => {
    const first = artifact('art_1', 'water.xyz', 'a'.repeat(64));
    const other = artifact('art_x', 'ethanol.xyz', 'b'.repeat(64), 'urn:other');
    const second = artifact('art_2', 'scientific-edits/e1.extxyz', 'c'.repeat(64), 'urn:object', 'edit-1');
    expect(latestArtifactForObject([first, other, second], first)).toBe(second);
    expect(latestArtifactForObject([first, other, second], other)).toBe(other);
    const plain = { ...first, metadata: undefined };
    expect(latestArtifactForObject([first, second], plain)).toBe(plain);
  });
});
