/** @vitest-environment jsdom */
import { beforeAll, describe, expect, it } from 'vitest';
import type { RenderModel } from './GraphMoleculeViewerRenderTypes';
import {
  applyStructureMetadata,
  carrySelection,
  frameCell,
  frameTarget,
  readExtXyzCell,
  readGraphMoleculeViewerData,
  structureRenderFrame,
} from './GraphMoleculeViewerData';
import type { ArtifactMetadata, ScientificTarget } from '@remote-codex/shared';

beforeAll(() => {
  Object.defineProperty(window.URL, 'createObjectURL', {
    value: () => 'blob:worker',
    configurable: true,
  });
});

const xyz = '2\nwater\nO 0 0 0\nH 0.95 0 0\n';
const extxyz =
  '2\nLattice="4 0 0 1 5 0 0 0 6" Properties=species:S:1:pos:R:3 pbc="T T F"\nO 0 0 0\nH 0.95 0 0\n';
const mol =
  'water\n  W4\n\n  2  1  0  0  0  0            999 V2000\n    0.0000    0.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0\n    0.9500    0.0000    0.0000 H   0  0  0  0  0  0  0  0  0  0  0  0\n  1  2  1  0  0  0  0\nM  END\n';
const pdb =
  'HETATM    7  O   HOH A   1       0.000   0.000   0.000  1.00  0.00           O  \nHETATM   42  H1  HOH A   1       0.950   0.000   0.000  1.00  0.00           H  \nCONECT    7   42\nEND\n';
const cif =
  'data_water\n_cell_length_a 4\n_cell_length_b 5\n_cell_length_c 6\n_cell_angle_alpha 90\n_cell_angle_beta 90\n_cell_angle_gamma 90\nloop_\n_atom_site_label\n_atom_site_type_symbol\n_atom_site_fract_x\n_atom_site_fract_y\n_atom_site_fract_z\nO1 O 0 0 0\nH1 H 0.2375 0 0\n';
export const STRUCTURE_FIXTURES = {
  xyz,
  extxyz,
  mol,
  sdf: mol + '$$$$\n',
  pdb,
  cif,
};
const target: ScientificTarget = {
  artifactId: 'a',
  objectId: 'o',
  sourceRevision: 'r',
  checksum: 'a'.repeat(64),
};

describe('immutable structure parsing', () => {
  it.each(Object.entries(STRUCTURE_FIXTURES))(
    'renders %s with the actual 3Dmol parser and keeps source text',
    async (format, text) => {
      const runtime = (await import('3dmol')) as unknown as {
        GLModel: new (id: number) => RenderModel & {
          addMolData(text: string, format: string, options: object): void;
        };
      };
      const data = readGraphMoleculeViewerData({ content: [text], format });
      const model = new runtime.GLModel(0);
      const renderFrame = structureRenderFrame(data.frames[0]!, format);
      model.addMolData(renderFrame.content, renderFrame.format, {
        keepH: true,
        doAssembly: false,
      });
      expect(model.selectedAtoms({}).map((atom) => atom.elem)).toEqual([
        'O',
        'H',
      ]);
      expect(model.selectedAtoms({})[1]!.x).toBeCloseTo(0.95);
      const serials = model.selectedAtoms({}).map((atom) => atom.serial);
      if (format === 'pdb') expect(serials).toEqual([7, 42]);
      expect(
        applyStructureMetadata(model, {
          version: 1,
          objectId: 'o',
          sourceRevision: 'r',
          checksum: target.checksum,
          format,
          atoms: [
            { id: 'canonical-O', element: 'O' },
            { id: 'canonical-H', element: 'H' },
          ],
        }),
      ).toEqual(['canonical-O', 'canonical-H']);
      expect(model.selectedAtoms({}).map((atom) => atom.index)).toEqual([0, 1]);
      expect(
        model.selectedAtoms({ index: [1] }).map((atom) => atom.elem),
      ).toEqual(['H']);
      expect(model.selectedAtoms({}).map((atom) => atom.serial)).toEqual(
        serials,
      );
      expect(data.exportContent).toBe(text);
    },
  );
  it.each(['provided', 'none'] as const)(
    'maps canonical IDs and render selectors when %s bonds skip parser indices',
    async (bonding) => {
      const runtime = (await import('3dmol')) as unknown as {
        GLModel: new (id: number) => RenderModel & {
          addMolData(text: string, format: string, options: object): void;
        };
      };
      const model = new runtime.GLModel(0);
      const frame = structureRenderFrame(extxyz, 'extxyz');
      model.addMolData(frame.content, frame.format, { assignBonds: false });
      expect(model.selectedAtoms({}).map((atom) => atom.index)).toEqual([
        undefined,
        undefined,
      ]);
      const metadata: ArtifactMetadata = {
        version: 1,
        objectId: 'o',
        sourceRevision: 'edited',
        checksum: target.checksum,
        format: 'extxyz',
        atoms: [
          { id: 'canonical-O', element: 'O' },
          { id: 'canonical-H', element: 'H' },
        ],
        bonds: [{ atomIds: ['canonical-O', 'canonical-H'], order: 1 }],
        render: { coordinateUnit: 'angstrom', bonding },
      };
      const before = JSON.stringify(metadata),
        coordinates = model
          .selectedAtoms({})
          .map((atom) => [atom.x, atom.y, atom.z]);
      expect(applyStructureMetadata(model, metadata)).toEqual([
        'canonical-O',
        'canonical-H',
      ]);
      expect(model.selectedAtoms({}).map((atom) => atom.index)).toEqual([0, 1]);
      expect(
        model.selectedAtoms({ index: [1] }).map((atom) => atom.elem),
      ).toEqual(['H']);
      expect(model.selectedAtoms({}).map((atom) => atom.serial)).toEqual([
        0, 1,
      ]);
      expect(
        model.selectedAtoms({}).map((atom) => [atom.x, atom.y, atom.z]),
      ).toEqual(coordinates);
      expect(JSON.stringify(metadata)).toBe(before);
    },
  );
  it('retains source bytes including CRLF and trailing blanks, while splitting trajectories', () => {
    const source = (xyz + xyz).replace(/\n/g, '\r\n') + '\r\n   ';
    const data = readGraphMoleculeViewerData(source);
    expect(data.frames).toHaveLength(2);
    expect(data.frames[0]).toBe(xyz.replace(/\n/g, '\r\n'));
    expect(data.exportContent).toBe(source);
  });
  it('parses skew extXYZ cells and partial periodicity', () => {
    expect(readExtXyzCell(extxyz)).toEqual({
      vectors: [
        [4, 0, 0],
        [1, 5, 0],
        [0, 0, 6],
      ],
      periodic: [true, true, false],
      unit: 'angstrom',
    });
    expect(() => readExtXyzCell('1\nLattice="1 NaN"\nHe 0 0 0')).toThrow(
      'Invalid',
    );
  });
  it('preserves explicit bonds/units only in the render model', async () => {
    const runtime = (await import('3dmol')) as unknown as {
      GLModel: new (id: number) => RenderModel & {
        addMolData(text: string, format: string, options: object): void;
      };
    };
    const model = new runtime.GLModel(0);
    model.addMolData(xyz, 'xyz', {});
    const metadata: ArtifactMetadata = {
      version: 1,
      objectId: 'o',
      sourceRevision: 'r',
      checksum: target.checksum,
      format: 'xyz',
      atoms: [
        { id: 'oxygen', element: 'O' },
        { id: 'hydrogen', element: 'H' },
      ],
      bonds: [{ atomIds: ['oxygen', 'hydrogen'], order: 2 }],
      render: { coordinateUnit: 'bohr', bonding: 'provided' },
    };
    const before = JSON.stringify(metadata);
    expect(applyStructureMetadata(model, metadata)).toEqual([
      'oxygen',
      'hydrogen',
    ]);
    expect(model.selectedAtoms({})[0]!.bondOrder).toEqual([2]);
    expect(model.selectedAtoms({})[1]!.x).toBeCloseTo(0.95 * 0.529177210903);
    expect(JSON.stringify(metadata)).toBe(before);
    expect(xyz).toContain('H 0.95 0 0');
    applyStructureMetadata(model, {
      ...metadata,
      render: { coordinateUnit: 'angstrom', bonding: 'none' },
    });
    expect(model.selectedAtoms({})[0]!.bonds).toEqual([]);
  });
  it('requires producer identities for trajectory submissions', () => {
    expect(frameTarget({ content: [xyz], target }, 0, 1)).toEqual(target);
    expect(frameTarget({ content: [xyz + xyz], target }, 0, 2)).toBeUndefined();
    const historic = {
      ...target,
      streamId: 's',
      frameId: 'frame0',
      frameIndex: 0,
    };
    expect(
      frameTarget({ content: [xyz + xyz], frameTargets: [historic] }, 0, 2),
    ).toEqual(historic);
  });
  it('renders extXYZ reordered property columns without changing canonical text', async () => {
    const text = '1\nProperties=charge:R:1:pos:R:3:species:S:1\n-0.2 1 2 3 O\n';
    expect(structureRenderFrame(text, 'extxyz').content).toContain('O 1 2 3');
    expect(
      readGraphMoleculeViewerData({ content: [text], format: 'extxyz' })
        .exportContent,
    ).toBe(text);
  });
  it('rejects malformed atom counts and unknown formats', () => {
    expect(() => readGraphMoleculeViewerData('2junk\ncomment\n')).toThrow();
    expect(() =>
      readGraphMoleculeViewerData({ content: [xyz], format: 'javascript' }),
    ).toThrow();
  });
});

describe('frameCell', () => {
  const cell = (a: number): NonNullable<ArtifactMetadata['cell']> => ({
    vectors: [
      [a, 0, 0],
      [0, a, 0],
      [0, 0, a],
    ],
    periodic: [true, true, true],
    unit: 'angstrom',
  });
  const metadata = {
    version: 1,
    objectId: 'o',
    sourceRevision: 'r',
    checksum: 'a'.repeat(64),
    format: 'extxyz',
  } as const;

  it('uses the per-frame entry, with null meaning no cell', () => {
    const value = { ...metadata, frameCells: [cell(2), null] };
    expect(frameCell(value, 0)).toEqual(cell(2));
    expect(frameCell(value, 1)).toBeNull();
    expect(() => frameCell(value, 2)).toThrow('no entry for frame 2');
  });

  it('keeps the single cell for every frame', () => {
    expect(frameCell({ ...metadata, cell: cell(3) }, 5)).toEqual(cell(3));
    expect(frameCell(metadata, 0)).toBeUndefined();
    expect(frameCell(undefined, 0)).toBeUndefined();
  });
});

describe('pre-split trajectories', () => {
  it('uses each content entry as one frame without re-splitting', () => {
    const frames = ['1\na\nHe 0 0 0\n', '1\nb\nHe 0 0 1\n'];
    const data = readGraphMoleculeViewerData({ content: frames, format: 'xyz', framesSplit: true });
    expect(data.frames).toBe(frames);
    expect(data.exportContent).toBe(frames.join(''));
  });
  it('still splits multi-frame entries when the source is not pre-split', () => {
    const data = readGraphMoleculeViewerData({ content: [`${xyz}${xyz}`], format: 'xyz' });
    expect(data.frames).toHaveLength(2);
  });
});

describe('carrySelection (§4.3)', () => {
  const from = { ids: ['a', 'b', 'c'], elements: ['O', 'C', 'H'] };
  it('keeps every selected atom whose stable ID survives with the same element', () => {
    const to = { ids: ['x', 'c', 'a', 'b'], elements: ['N', 'H', 'O', 'C'] };
    expect(carrySelection([0, 1], from, to)).toEqual([2, 3]);
    expect(carrySelection([], from, to)).toEqual([]);
  });
  it('drops the whole selection when any atom is gone or changed element', () => {
    expect(carrySelection([0, 2], from, { ids: ['a', 'b'], elements: ['O', 'C'] })).toBeNull();
    expect(carrySelection([0], from, { ids: ['a', 'b', 'c'], elements: ['S', 'C', 'H'] })).toBeNull();
  });
});
