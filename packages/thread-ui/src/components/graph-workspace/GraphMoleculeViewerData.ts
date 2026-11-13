import type { ArtifactMetadata, ScientificTarget } from '@remote-codex/shared';
import type { RenderModel } from './GraphMoleculeViewerRenderTypes';

export type GraphMoleculeViewerSnapshot = {
  content: string[];
  format?: string | null;
  uuid?: string | null;
  name?: string | null;
  metadata?: ArtifactMetadata;
  target?: ScientificTarget;
  /** Immutable targets supplied by the producer, in trajectory order. */
  frameTargets?: ScientificTarget[];
  /**
   * Each XYZ `content` entry is exactly one frame, already validated: the
   * viewer uses the entries as its frames instead of re-splitting a growing
   * trajectory on every update.
   */
  framesSplit?: boolean;
};
export type GraphMoleculeViewerSource =
  | GraphMoleculeViewerSnapshot
  | string
  | null
  | undefined;
export type GraphMoleculeViewerData = {
  format: string;
  frames: string[];
  exportContent: string;
};

function splitXyzTrajectory(content: string): string[] {
  // Keep original line endings and whitespace for coordinate inspection/export.
  const lines =
    content.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g)?.filter(Boolean) ?? [];
  const frames: string[] = [];
  let cursor = 0;
  while (cursor < lines.length) {
    while (cursor < lines.length && !lines[cursor]?.trim()) cursor++;
    if (cursor === lines.length) break;
    if (!/^\d+$/.test(lines[cursor]?.trim() ?? ''))
      throw new Error('Invalid XYZ atom count');
    const count = Number(lines[cursor]?.trim());
    if (cursor + count + 2 > lines.length)
      throw new Error('Incomplete XYZ frame');
    frames.push(lines.slice(cursor, cursor + count + 2).join(''));
    cursor += count + 2;
  }
  return frames;
}

export function readGraphMoleculeViewerData(
  source: GraphMoleculeViewerSource,
): GraphMoleculeViewerData {
  if (!source) return { format: 'xyz', frames: [], exportContent: '' };
  const declared =
    typeof source === 'string'
      ? 'xyz'
      : source.format?.trim().toLowerCase() || 'xyz';
  // `.cub` is the same Gaussian cube format as `.cube`.
  const format = declared === 'cub' ? 'cube' : declared;
  if (!['xyz', 'extxyz', 'cif', 'pdb', 'sdf', 'mol', 'cube'].includes(format))
    throw new Error(`Unsupported structure format: ${format}`);
  const content = typeof source === 'string' ? [source] : source.content;
  const xyz = format === 'xyz' || format === 'extxyz';
  if (xyz && typeof source !== 'string' && source.framesSplit)
    return { frames: content, format, exportContent: content.join('') };
  const frames =
    xyz
      ? content.flatMap(splitXyzTrajectory)
      : format === 'sdf'
        ? content.flatMap(
            (text) =>
              text
                .match(/[\s\S]*?\$\$\$\$(?:\r\n|\n|\r|$)|[\s\S]+$/g)
                ?.filter((text) => text.trim()) ?? [],
          )
        : format === 'cube'
          ? // One grid per file: the whole text is the single frame.
            [content.join('')].filter((text) => text.trim())
          : content.filter((text) => text.trim());
  return { frames, format, exportContent: content.join('') };
}

export function frameTarget(
  snapshot: GraphMoleculeViewerSnapshot | undefined,
  index: number,
  frameCount: number,
): ScientificTarget | undefined {
  if (snapshot?.frameTargets) return snapshot.frameTargets[index];
  const target = snapshot?.target;
  if (!target) return undefined;
  // A single stream frame retains its producer index; a trajectory must supply
  // exact frame IDs, rather than inventing IDs for historical frames.
  if (frameCount <= 1) return target;
  if (target.frameIndex === index && target.frameId) return target;
  return undefined;
}

/** Stable atom identity of a rendered revision, in source atom order. */
export type AtomIdentity = { ids: readonly string[]; elements: readonly string[] };

/**
 * Carry a selection over to a new revision of the same object (design §4.3).
 * Every selected atom must keep its stable ID with the same element; if any is
 * missing or changed, the whole selection is dropped so the user reselects.
 * Returns the selection as indices into the new revision, or null.
 */
export function carrySelection(
  selected: readonly number[],
  from: AtomIdentity,
  to: AtomIdentity,
): number[] | null {
  const carried: number[] = [];
  for (const index of selected) {
    const id = from.ids[index];
    const next = id === undefined ? -1 : to.ids.indexOf(id);
    if (next < 0 || to.elements[next] !== from.elements[index]) return null;
    carried.push(next);
  }
  return carried;
}

/**
 * The producer's unit cell for trajectory frame `index`: `frameCells[index]`
 * (null = that frame has no cell) when present, otherwise the single `cell`.
 */
export function frameCell(
  metadata: ArtifactMetadata | undefined,
  index: number,
): ArtifactMetadata['cell'] | null | undefined {
  if (!metadata?.frameCells) return metadata?.cell;
  const cell = metadata.frameCells[index];
  if (cell === undefined)
    throw new Error(`Frame cell metadata has no entry for frame ${index}`);
  return cell;
}

export function readExtXyzCell(
  content: string,
): ArtifactMetadata['cell'] | undefined {
  const comment = content.split(/\r\n|\r|\n/)[1] ?? '';
  const lattice = /\bLattice="([^"]+)"/i
    .exec(comment)?.[1]
    ?.trim()
    .split(/\s+/)
    .map(Number);
  if (!lattice) return undefined;
  if (lattice.length !== 9 || lattice.some((value) => !Number.isFinite(value)))
    throw new Error('Invalid extXYZ Lattice');
  const pbc = /\bpbc="([^"]+)"/i.exec(comment)?.[1]?.trim().split(/\s+/);
  if (
    pbc &&
    (pbc.length !== 3 ||
      pbc.some((value) => !/^(T|F|true|false|1|0)$/i.test(value)))
  )
    throw new Error('Invalid extXYZ pbc');
  return {
    vectors: [
      lattice.slice(0, 3),
      lattice.slice(3, 6),
      lattice.slice(6, 9),
    ] as [
      [number, number, number],
      [number, number, number],
      [number, number, number],
    ],
    periodic: (pbc?.map((value) => /^(T|true|1)$/i.test(value)) ?? [
      true,
      true,
      true,
    ]) as [boolean, boolean, boolean],
    unit: 'angstrom',
  };
}

/** Work on the parser's render model only. The immutable source is never edited. */
export function applyStructureMetadata(
  model: RenderModel,
  metadata?: ArtifactMetadata,
): string[] {
  const atoms = model.selectedAtoms({});
  if (
    !atoms.length ||
    atoms.some((atom) => ![atom.x, atom.y, atom.z].every(Number.isFinite))
  )
    throw new Error('Structure has no valid atomic coordinates');
  if (
    metadata?.atoms?.some((atom, index) => atom.element !== atoms[index]?.elem)
  )
    throw new Error('Atom metadata elements differ from the rendered model');
  if (metadata?.atoms && metadata.atoms.length !== atoms.length)
    throw new Error('Atom metadata count differs from the rendered model');
  const ids = atoms.map(
    (_atom, index) => metadata?.atoms?.[index]?.id ?? String(index),
  );
  if (new Set(ids).size !== ids.length)
    throw new Error('Duplicate atom identity');
  // XYZ's parser initializes index only during inferred bonding. Provided/none
  // bonding skips that path, so normalize the temporary render model ourselves.
  // Selection, style selectors and canonical IDs all use source atom order;
  // parser serials (including non-contiguous PDB serials) remain untouched.
  atoms.forEach((atom, index) => {
    atom.index = index;
  });
  const bonding = metadata?.render?.bonding;
  if (bonding === 'provided' && !metadata?.bonds)
    throw new Error('Provided bonding requires bond metadata');
  const indexById = new Map(ids.map((id, index) => [id, index]));
  if (metadata?.bonds || bonding === 'none') {
    atoms.forEach((atom) => {
      atom.bonds = [];
      atom.bondOrder = [];
    });
    if (bonding !== 'none')
      metadata?.bonds?.forEach((bond) => {
        const a = indexById.get(bond.atomIds[0]),
          b = indexById.get(bond.atomIds[1]);
        if (a === undefined || b === undefined || a === b)
          throw new Error('Bond metadata refers to unknown atoms');
        atoms[a]!.bonds!.push(b);
        atoms[a]!.bondOrder!.push(bond.order);
        atoms[b]!.bonds!.push(a);
        atoms[b]!.bondOrder!.push(bond.order);
      });
  }
  if (metadata?.render?.coordinateUnit === 'bohr')
    atoms.forEach((atom) => {
      atom.x *= 0.529177210903;
      atom.y *= 0.529177210903;
      atom.z *= 0.529177210903;
    });
  return ids;
}

/** Map extXYZ Properties columns for rendering, retaining the original frame. */
export function structureRenderFrame(
  content: string,
  format: string,
): { content: string; format: string } {
  if (format !== 'extxyz')
    return { content, format: format === 'mol' ? 'sdf' : format };
  const lines = content.split(/\r\n|\r|\n/);
  const properties = /\bProperties=(?:"([^"]+)"|([^\s]+))/.exec(lines[1] ?? '');
  if (!properties) return { content, format: 'xyz' };
  const fields = (properties[1] ?? properties[2]!).split(':');
  if (fields.length % 3) throw new Error('Invalid extXYZ Properties');
  let offset = 0,
    species = -1,
    position = -1;
  for (let index = 0; index < fields.length; index += 3) {
    const count = Number(fields[index + 2]);
    if (!Number.isInteger(count) || count <= 0 || count > 10000)
      throw new Error('Invalid extXYZ property width');
    if (fields[index] === 'species' && fields[index + 1] === 'S' && count === 1)
      species = offset;
    if (fields[index] === 'pos' && fields[index + 1] === 'R' && count === 3)
      position = offset;
    offset += count;
  }
  if (species < 0 || position < 0)
    throw new Error('extXYZ requires species and pos properties');
  const count = Number(lines[0]?.trim());
  const atoms = lines.slice(2, count + 2).map((line) => {
    const values = line.trim().split(/\s+/);
    if (values.length < offset || !/^[A-Z][a-z]?$/.test(values[species]!))
      throw new Error('Invalid extXYZ atom properties');
    const coords = values.slice(position, position + 3).map(Number);
    if (coords.some((value) => !Number.isFinite(value)))
      throw new Error('Invalid extXYZ coordinates');
    return `${values[species]} ${coords.join(' ')}`;
  });
  return {
    content: `${count}\n${lines[1]}\n${atoms.join('\n')}\n`,
    format: 'xyz',
  };
}
