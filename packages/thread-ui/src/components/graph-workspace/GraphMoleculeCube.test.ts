import { describe, expect, it } from 'vitest';
import {
  CubeFormatError,
  DEFAULT_CUBE_ISOVALUE,
  MAX_CUBE_GRID_POINTS,
  assertCubeDrawable,
  assertCubeValues,
  cubeAtomSection,
  cubeValueCount,
  isovalueFromSlider,
  parseCubeHeader,
  readCubeHeader,
  sliderFromIsovalue,
} from './GraphMoleculeCube';
import { syntheticCube } from './GraphMoleculeCubeFixtures';
import { readGraphMoleculeViewerData } from './GraphMoleculeViewerData';

function codeOf(run: () => unknown) {
  try {
    run();
  } catch (error) {
    if (error instanceof CubeFormatError) return error.code;
    throw error;
  }
  return null;
}

describe('cube header', () => {
  it('reads a molecular-orbital cube: negative atom count and an orbital line', () => {
    const text = syntheticCube({ points: 20, orbitals: [5] });
    const header = parseCubeHeader(text);
    expect(header).toMatchObject({
      atomCount: 3,
      orbital: true,
      orbitalIndices: [5],
      origin: [-4, -4, -4],
      unit: 'bohr',
      pointCount: 8000,
      // 2 comments, count/origin, 3 axes, 3 atoms, 1 orbital line.
      headerLineCount: 10,
    });
    expect(header.axes.map((axis) => axis.points)).toEqual([20, 20, 20]);
    expect(header.axes[0]!.step[0]).toBeCloseTo(8 / 19, 5);
    expect(header.comments[0]).toContain('Synthetic water cube');
    // The values start right after the orbital line.
    expect(text.slice(header.headerLength).trimStart()).toMatch(/^-?\d\.\d{5}E[+-]\d{2}/);
    assertCubeValues(text, header);
    expect(cubeValueCount(text, header)).toBe(8000);
  });

  it('reads a density cube: positive atom count, no orbital line, angstrom axes', () => {
    const text = syntheticCube({ points: [4, 5, 6], orbital: false, unit: 'angstrom' });
    const header = parseCubeHeader(text);
    expect(header).toMatchObject({
      atomCount: 3,
      orbital: false,
      orbitalIndices: [],
      unit: 'angstrom',
      pointCount: 120,
      headerLineCount: 9,
    });
    expect(header.axes.map((axis) => axis.points)).toEqual([4, 5, 6]);
    assertCubeValues(text, header);
  });

  it('handles CRLF line endings', () => {
    const text = syntheticCube({ points: 6, newline: '\r\n' });
    const header = parseCubeHeader(text);
    expect(header.headerLineCount).toBe(10);
    assertCubeValues(text, header);
    expect(cubeAtomSection(text, header).split('\r\n')).toHaveLength(11);
  });

  it('returns null while a partial first chunk ends inside the header', () => {
    const text = syntheticCube({ points: 6 });
    const header = parseCubeHeader(text);
    expect(readCubeHeader(text.slice(0, header.headerLength - 3))).toBeNull();
    expect(readCubeHeader(text.slice(0, 40))).toBeNull();
    expect(readCubeHeader(text.slice(0, header.headerLength))).toEqual(header);
    expect(codeOf(() => parseCubeHeader(text.slice(0, 40)))).toBe('incomplete');
  });

  it('rejects malformed headers', () => {
    const lines = syntheticCube({ points: 4 }).split('\n');
    const broken = (index: number, line: string) =>
      lines.map((entry, i) => (i === index ? line : entry)).join('\n');
    expect(codeOf(() => parseCubeHeader(broken(2, '  x 0 0 0')))).toBe('invalid');
    expect(codeOf(() => parseCubeHeader(broken(2, '  0 0 0 0')))).toBe('invalid');
    expect(codeOf(() => parseCubeHeader(broken(3, '  4 0.5 0')))).toBe('invalid');
    expect(codeOf(() => parseCubeHeader(broken(4, '  0 0 0.5 0')))).toBe('invalid');
    expect(codeOf(() => parseCubeHeader(broken(6, '  8 8.0 0 0')))).toBe('invalid');
    expect(codeOf(() => parseCubeHeader(broken(9, '  2 5')))).toBe('multipleOrbitals');
    expect(codeOf(() => parseCubeHeader(broken(9, '  x')))).toBe('invalid');
  });

  it('reports a value count that differs from the header', () => {
    const text = syntheticCube({ points: 4 });
    const header = parseCubeHeader(text);
    expect(codeOf(() => assertCubeValues(`${text} 1.0E-01\n`, header))).toBe('valueCount');
    expect(codeOf(() => assertCubeValues(text.slice(0, -20), header))).toBe('valueCount');
  });
});

describe('cube limits', () => {
  it('rejects grids above 200³ points and multi-orbital cubes', () => {
    const header = parseCubeHeader(syntheticCube({ points: 4 }));
    expect(MAX_CUBE_GRID_POINTS).toBe(8_000_000);
    assertCubeDrawable({ ...header, pointCount: MAX_CUBE_GRID_POINTS });
    expect(
      codeOf(() =>
        assertCubeDrawable({ ...header, pointCount: MAX_CUBE_GRID_POINTS + 1 }),
      ),
    ).toBe('gridTooLarge');
    const big = readCubeHeader(
      syntheticCube({ points: 2 }).replace(/^( {4})2/gm, '  201'),
    );
    expect(big?.pointCount).toBe(201 ** 3);
    expect(codeOf(() => assertCubeDrawable(big!))).toBe('gridTooLarge');
    expect(
      codeOf(() => assertCubeDrawable({ ...header, orbitalIndices: [5, 6] })),
    ).toBe('multipleOrbitals');
  });

  it('maps the logarithmic isovalue slider both ways', () => {
    expect(isovalueFromSlider(0)).toBe(1e-4);
    expect(isovalueFromSlider(1000)).toBe(1);
    expect(isovalueFromSlider(sliderFromIsovalue(DEFAULT_CUBE_ISOVALUE))).toBeCloseTo(
      DEFAULT_CUBE_ISOVALUE,
      3,
    );
    expect(sliderFromIsovalue(10)).toBe(1000);
    expect(sliderFromIsovalue(0)).toBe(0);
  });
});

describe('cube viewer data', () => {
  it('treats .cube and .cub as one single-frame format', () => {
    const text = syntheticCube({ points: 4 });
    for (const format of ['cube', 'CUB', 'cub'])
      expect(readGraphMoleculeViewerData({ content: [text], format })).toEqual({
        format: 'cube',
        frames: [text],
        exportContent: text,
      });
  });
});
