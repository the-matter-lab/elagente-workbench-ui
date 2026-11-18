import { describe, expect, it } from 'vitest';
import { composerFileBadge, composerFileDetail, filenameMiddleParts, sharedFilenameSuffix } from './composerFileChips';

describe('composer filename presentation', () => {
  it.each(['xyz', 'pdb', 'cif', 'mol2', 'sdf', 'mol', 'log', 'out', 'fchk', 'cube', 'csv', 'json', 'yaml', 'pdf', 'md', 'txt', 'zip'])('labels .%s from its extension', ext => {
    expect(composerFileBadge(`Exact uploaded Name.${ext.toUpperCase()}`)).toBe(ext.toUpperCase());
  });
  it('uses FILE for unknown/absent extensions and GZ for tar.gz', () => {
    expect(composerFileBadge('unknown.unrecognized')).toBe('FILE');
    expect(composerFileBadge('README')).toBe('FILE');
    expect(composerFileBadge('.hidden')).toBe('FILE');
    expect(composerFileBadge('files.tar.gz')).toBe('GZ');
  });
  it('dims only the exact shared ending at a meaningful boundary', () => {
    expect(sharedFilenameSuffix(['caffeine_openbabel.xyz', 'theobromine_openbabel.xyz'])).toBe('_openbabel.xyz');
    expect(sharedFilenameSuffix(['caffeine.xyz', 'theobromine.xyz'])).toBe('.xyz');
    expect(sharedFilenameSuffix(['caffeine_openbabel.xyz'])).toBe('');
    expect(sharedFilenameSuffix(['same.xyz', 'same.xyz'])).toBe('');
    expect(sharedFilenameSuffix(['caffeine_openbabel.xyz', 'theobromine_openbabel.xyz', 'results.json'])).toBe('');
    expect(sharedFilenameSuffix(['abc', 'xbc'])).toBe('');
    expect(sharedFilenameSuffix(['different.XYZ', 'different.xyz'])).toBe('');
  });
  it.each(['a.XYZ', 'CO₂—优化.xyz', 'a very long exact uploaded name.tar.gz', 'unknown.extension', 'README'])('keeps the full original name and extension in CSS parts: %s', name => {
    const parts = filenameMiddleParts(name);
    expect(parts.head + parts.tail).toBe(name);
    expect(parts.tail).toMatch(name.includes('.') ? /\.[^.]+$/ : /README$/);
  });
  it('shows only real type-specific metadata, including zero files', () => {
    expect(composerFileDetail('large.OUT', 1048576)).toBe('1 MB');
    expect(composerFileDetail('molecule.xyz', 500)).toBe('');
    expect(composerFileDetail('report.pdf', 500, { pageCount: 2 })).toBe('2 pages');
    expect(composerFileDetail('report.pdf', 500)).toBe('');
    expect(composerFileDetail('inputs.tar.gz', 500, { entryCount: 20 })).toBe('tar.gz · 20 files');
    expect(composerFileDetail('empty.zip', 22, { entryCount: 0 })).toBe('zip · 0 files');
    expect(composerFileDetail('unknown.zip', 500)).toBe('');
  });
  it('gives an unknown very long extension a shrinkable middle', () => {
    const name = `a.${'x'.repeat(100)}`;
    const parts = filenameMiddleParts(name);
    expect(parts.head + parts.tail).toBe(name);
    expect(parts.head.length).toBeGreaterThan(0);
    expect(parts.tail).toHaveLength(8);
  });
});
