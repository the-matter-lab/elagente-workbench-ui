/**
 * Gaussian cube (`.cube`/`.cub`) volumetric grids: header parsing and the
 * limits checked before 3Dmol draws anything.
 *
 * Layout: two comment lines; atom count and origin; three axis lines (point
 * count and step vector); one line per atom (atomic number, charge, x, y, z).
 * A negative atom count marks a molecular-orbital cube, which has one extra
 * line (orbital count, then the orbital indices) before the values. A
 * positive axis point count means bohr, a negative one angstrom; 3Dmol uses
 * the sign of the first axis, and so do we.
 */

/** Grids above about 200³ points are not drawn in the browser. */
export const MAX_CUBE_GRID_POINTS = 200 ** 3;
/** Starting isovalue for orbitals. */
export const DEFAULT_CUBE_ISOVALUE = 0.02;
export const DEFAULT_CUBE_OPACITY = 0.85;
/** The isovalue slider is logarithmic between these bounds. */
export const CUBE_ISOVALUE_MIN = 1e-4;
export const CUBE_ISOVALUE_MAX = 1;
export const CUBE_POSITIVE_COLOR = '#2f6fd6';
export const CUBE_NEGATIVE_COLOR = '#d6453d';

export type CubeVector = [number, number, number];
export type CubeAxis = { points: number; step: CubeVector };
export type CubeHeader = {
  comments: [string, string];
  /** Number of atom lines (the absolute value of the header count). */
  atomCount: number;
  /** A negative atom count: the cube holds molecular-orbital values. */
  orbital: boolean;
  /** Orbital indices from the extra MO line, empty for other cubes. */
  orbitalIndices: number[];
  origin: CubeVector;
  axes: [CubeAxis, CubeAxis, CubeAxis];
  unit: 'bohr' | 'angstrom';
  /** nx · ny · nz. Values per point equal the orbital count (1 otherwise). */
  pointCount: number;
  /** Number of lines before the first grid value. */
  headerLineCount: number;
  /** Length of the text before the first grid value. */
  headerLength: number;
};

export class CubeFormatError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'invalid'
      | 'incomplete'
      | 'gridTooLarge'
      | 'multipleOrbitals'
      | 'valueCount' = 'invalid',
  ) {
    super(message);
    this.name = 'CubeFormatError';
  }
}

const INTEGER = /^[+-]?\d+$/;

function numbers(line: string, count: number, what: string) {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length < count)
    throw new CubeFormatError(`Invalid cube ${what} line`);
  const values = tokens.slice(0, count).map(Number);
  if (values.some((value) => !Number.isFinite(value)))
    throw new CubeFormatError(`Invalid cube ${what} line`);
  return { tokens, values };
}

function integer(token: string | undefined, what: string) {
  if (!token || !INTEGER.test(token))
    throw new CubeFormatError(`Invalid cube ${what}`);
  return Number(token);
}

/**
 * Reads the header from the start of a cube file. Returns null if `text`
 * ends before the header does (a partial first read); throws
 * `CubeFormatError` when the header is malformed.
 */
export function readCubeHeader(text: string): CubeHeader | null {
  // Lines with their terminators, so the header length is exact.
  const pattern = /([^\r\n]*)(\r\n|\n|\r)/g;
  const lines: string[] = [];
  let offset = 0;
  const next = () => {
    const match = pattern.exec(text);
    if (!match) return null;
    offset = pattern.lastIndex;
    lines.push(match[1]!);
    return match[1]!;
  };
  for (let index = 0; index < 6; index++) if (next() === null) return null;
  const [count, ...originTokens] = lines[2]!.trim().split(/\s+/);
  const signedAtoms = integer(count, 'atom count');
  if (signedAtoms === 0) throw new CubeFormatError('Cube has no atoms');
  const atomCount = Math.abs(signedAtoms);
  const origin = numbers(originTokens.join(' '), 3, 'origin').values;
  const axes = [3, 4, 5].map((line) => {
    const { tokens, values } = numbers(lines[line]!, 4, 'axis');
    const points = integer(tokens[0], 'axis point count');
    if (points === 0) throw new CubeFormatError('Cube axis has no points');
    return { points, step: values.slice(1, 4) as CubeVector };
  });
  for (let index = 0; index < atomCount; index++) {
    const line = next();
    if (line === null) return null;
    numbers(line, 5, 'atom');
  }
  let orbitalIndices: number[] = [];
  if (signedAtoms < 0) {
    const line = next();
    if (line === null) return null;
    const tokens = line.trim().split(/\s+/);
    const orbitals = integer(tokens[0], 'orbital count');
    if (orbitals < 1) throw new CubeFormatError('Invalid cube orbital count');
    orbitalIndices = tokens
      .slice(1, orbitals + 1)
      .map((token) => integer(token, 'orbital index'));
    if (orbitalIndices.length !== orbitals)
      throw new CubeFormatError(
        orbitals > 1
          ? 'Cubes with more than one orbital are not supported'
          : 'Invalid cube orbital line',
        orbitals > 1 ? 'multipleOrbitals' : 'invalid',
      );
  }
  const pointCount = axes.reduce((total, axis) => total * Math.abs(axis.points), 1);
  return {
    comments: [lines[0]!, lines[1]!],
    atomCount,
    orbital: signedAtoms < 0,
    orbitalIndices,
    origin: origin as CubeVector,
    axes: axes.map((axis) => ({
      points: Math.abs(axis.points),
      step: axis.step,
    })) as CubeHeader['axes'],
    unit: axes[0]!.points > 0 ? 'bohr' : 'angstrom',
    pointCount,
    headerLineCount: lines.length,
    headerLength: offset,
  };
}

/** Complete-file header: an incomplete header is an error. */
export function parseCubeHeader(text: string): CubeHeader {
  const header = readCubeHeader(text.endsWith('\n') || text.endsWith('\r') ? text : `${text}\n`);
  if (!header) throw new CubeFormatError('Incomplete cube header', 'incomplete');
  return header;
}

/** Rejects grids the browser should not draw. */
export function assertCubeDrawable(header: CubeHeader) {
  if (header.pointCount > MAX_CUBE_GRID_POINTS)
    throw new CubeFormatError(
      `Cube grid has ${header.axes.map((axis) => axis.points).join(' × ')} points, more than the 200³ preview limit`,
      'gridTooLarge',
    );
  if (header.orbitalIndices.length > 1)
    throw new CubeFormatError(
      'Cubes with more than one orbital are not supported',
      'multipleOrbitals',
    );
}

/**
 * Counts the grid values after the header without allocating them, so a
 * truncated or padded file is reported before 3Dmol misreads it.
 */
export function cubeValueCount(text: string, header: CubeHeader) {
  let count = 0;
  let inToken = false;
  for (let index = header.headerLength; index < text.length; index++) {
    const code = text.charCodeAt(index);
    const space = code === 32 || code === 9 || code === 10 || code === 13;
    if (!space && !inToken) count++;
    inToken = !space;
  }
  return count;
}

export function assertCubeValues(text: string, header: CubeHeader) {
  const expected = header.pointCount * Math.max(1, header.orbitalIndices.length);
  const found = cubeValueCount(text, header);
  if (found !== expected)
    throw new CubeFormatError(
      `Cube has ${found} grid values; its header declares ${expected}`,
      'valueCount',
    );
}

/** The header and atom lines only, for 3Dmol's atom parser. */
export function cubeAtomSection(text: string, header: CubeHeader) {
  return text.slice(0, header.headerLength);
}

/** Slider position 0..1000 ⇄ isovalue on a log scale. */
export const CUBE_ISOVALUE_STEPS = 1000;
export function isovalueFromSlider(position: number) {
  const ratio = Math.min(1, Math.max(0, position / CUBE_ISOVALUE_STEPS));
  const value =
    CUBE_ISOVALUE_MIN * (CUBE_ISOVALUE_MAX / CUBE_ISOVALUE_MIN) ** ratio;
  return Number(value.toPrecision(3));
}
export function sliderFromIsovalue(value: number) {
  const clamped = Math.min(CUBE_ISOVALUE_MAX, Math.max(CUBE_ISOVALUE_MIN, value));
  return Math.round(
    (Math.log(clamped / CUBE_ISOVALUE_MIN) /
      Math.log(CUBE_ISOVALUE_MAX / CUBE_ISOVALUE_MIN)) *
      CUBE_ISOVALUE_STEPS,
  );
}
