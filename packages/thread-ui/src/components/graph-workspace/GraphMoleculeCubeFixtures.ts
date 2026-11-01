/**
 * Synthetic Gaussian cube files for tests and the playground. Not exported
 * from the package entry points.
 */
export function syntheticCube({
  points = 20,
  orbital = true,
  orbitals = [5],
  extent = 4,
  unit = 'bohr',
  newline = '\n',
}: {
  points?: number | [number, number, number];
  orbital?: boolean;
  orbitals?: number[];
  extent?: number;
  unit?: 'bohr' | 'angstrom';
  newline?: string;
} = {}) {
  const [nx, ny, nz] = typeof points === 'number' ? [points, points, points] : points;
  const sign = unit === 'bohr' ? 1 : -1;
  const step = (n: number) => (2 * extent) / Math.max(1, n - 1);
  const f = (value: number) => value.toFixed(6).padStart(12);
  const atoms = [
    [8, 0, 0, 0],
    [1, 1.43, 1.11, 0],
    [1, -1.43, 1.11, 0],
  ];
  const lines = [
    ' Synthetic water cube',
    orbital ? ' MO coefficients' : ' Electron density',
    `${String((orbital ? -1 : 1) * atoms.length).padStart(5)}${f(-extent)}${f(-extent)}${f(-extent)}`,
    `${String(sign * nx).padStart(5)}${f(step(nx))}${f(0)}${f(0)}`,
    `${String(sign * ny).padStart(5)}${f(0)}${f(step(ny))}${f(0)}`,
    `${String(sign * nz).padStart(5)}${f(0)}${f(0)}${f(step(nz))}`,
    ...atoms.map(
      ([z, x, y, w]) =>
        `${String(z).padStart(5)}${f(z!)}${f(x!)}${f(y!)}${f(w!)}`,
    ),
  ];
  if (orbital)
    lines.push(`${String(orbitals.length).padStart(5)}${orbitals.map((index) => String(index).padStart(5)).join('')}`);
  // A p-like orbital along x: a positive and a negative lobe.
  const values: string[] = [];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++) {
      let row: string[] = [];
      for (let k = 0; k < nz; k++) {
        const x = -extent + i * step(nx),
          y = -extent + j * step(ny),
          z = -extent + k * step(nz);
        const r2 = x * x + y * y + z * z;
        const value = orbital
          ? 0.4 * x * Math.exp(-0.5 * r2)
          : 0.5 * Math.exp(-0.7 * r2);
        row.push(value.toExponential(5).toUpperCase().padStart(13));
        if (row.length === 6) {
          values.push(row.join(''));
          row = [];
        }
      }
      if (row.length) values.push(row.join(''));
    }
  return [...lines, ...values].join(newline) + newline;
}
