# Scientific file previews (ORCA, PySCF)

Status: format routing implemented (ELA-219, B28); cube renderer
implemented in v0.1.19 (ELA-293); ESD spectrum renderer designed, not
implemented.

Source of the format list: the ORCA/PySCF format table Juan Bernardo Perez
shared on 2026-10-22 (ElAgente dev2 triage). It is the requirements input. It
does not show which of these files failed on dev2.

## Current routing (`explorer/filePreviewPolicy.ts`)

| Files | Explorer behaviour |
| --- | --- |
| `.gbw`, `.densities`, `.mp2nat`, `.uno`, `.qro`, `.uco` (ORCA), `.chk` (PySCF HDF5), `.bson`, `.ubjson`, `.msgpack` | Download only. Not read as text. The pane says why (`files.safeReason.scientificBinaryFile`). |
| `.carthess`, `.opt`, `.plt`, files with no extension (PySCF temporary checkpoints) | Encoding not confirmed, so the extension does not decide. The first chunk is checked for NUL bytes, control characters and the HDF5 signature. Binary data gets the generic "not text" download state. |
| `.md`, `.markdown` | Markdown preview, with a source view. |
| `.py` and other source files | Code view. App-servers report the bare extension as `language` (`py`, `sh`, `md`). `codeLanguage()` maps it to the Monaco/Shiki id (`python`, `shell`, `markdown`). Unknown ids fall back to plain text. |
| `.inp`, `.out`, `.log`, `.hess`, `.mkl`, `.molden(.input)`, `.property.txt/.json`, `FCIDUMP`, `.spectrum(.rootN)` | Plain-text preview in chunks, with "load more". |
| `.xyz`, `*_trj.xyz` and the other molecular formats | Molecule viewer (unchanged). |
| `.cube`, `.cub` | Molecule viewer with +/- isosurfaces, up to 20 MiB and 200³ points (see below). |

## Cube renderer

`.cube/.cub` files are text volumetric grids (orbitals, densities,
potentials). 3Dmol 2.x can parse them: `addModel(data, 'cube')` reads the atoms,
and `new $3Dmol.VolumeData(data, 'cube')` plus `viewer.addIsosurface(volume,
{ isoval, color, opacity })` draws an isosurface. `addVolumetricData()` would
parse the whole grid again for every surface, so the viewer parses it once
per file and keeps the `VolumeData`.

### Size limit

The UI reads a workspace file through `ThreadWorkspaceAdapter.readFile`. For
molecular formats `useWorkspaceFilePreview` reads 256 KiB chunks until the
file is complete, and shows the download state above
`MAX_MOLECULAR_PREVIEW_BYTES` (10 MiB). Real ORCA `orca_plot` HOMO/LUMO cubes
for water on a 100³ grid are about 14 MB, so the 10 MiB cap would turn the
most common orbital cube into a download.

What the ElAgente host allows (cloud infrastructure `dev` at `3c8f34ea`, read
only):

- The app-server's `file/read` RPC caps every workspace file at
  `MAX_FILE_BYTES = 20 MiB` (`apps/app-server/src/workspace/files.mjs`). Above
  that `read`, `stat`, the raw `GET /files` download and artifact publication
  all fail with `FILE_TOO_LARGE`. The same value is advertised as
  `workspace/roots.maxFileBytes`.
- One `file/read` call may ask for up to 20 MiB (`1 ≤ limit ≤ MAX_FILE_BYTES`);
  the default is 256 KiB. Every call reads and hashes the whole file, then
  slices it, so the number of chunks matters more than their size.
- `apps/web/lib/app-server-client.ts` passes `limit` through unclamped, with a
  30 s deadline per call. The gateway streams responses and the sandbox router
  buffers each response without a size cap; its 600 requests/min rate limit
  counts each chunk.
- `readRawFile` is not implemented by the host, and the raw URL is only used
  for images and PDFs.

Decision: cubes get their own cap equal to the host's real limit, 20 MiB
(`MAX_CUBE_PREVIEW_BYTES`), read in 2 MiB chunks (at most 10 `file/read`
calls). Other molecular formats keep 10 MiB and 256 KiB chunks. Above the cap
the pane shows the download state with a reason. A host with a lower cap
reports `FILE_TOO_LARGE` on the first read, which the pane already shows as an
error with a download button. A streamed or downsampled parse is not needed
for grids up to 20 MiB: 20 MiB of cube text is about 1.6 M values (≈117³),
which 3Dmol parses and meshes on the main thread in well under a second. A
grid above 20 MiB cannot be read through this host at all, so supporting
it needs a host change first (a raw ranged read or a server-side
downsampled grid), not a client parser.

The 200³ point limit (`MAX_CUBE_GRID_POINTS`) is still checked: in the
Explorer from the header in the first chunk, before the rest is read, and in
the viewer for every source, including `chem.structure` artifacts.

### Implementation

1. `components/graph-workspace/GraphMoleculeCube.ts` (new): `readCubeHeader`
   (null while the first chunk ends inside the header), `parseCubeHeader`,
   `assertCubeDrawable` (200³ points, single orbital), `assertCubeValues`
   (value count matches the header), `cubeAtomSection`, and the log-scale
   isovalue slider mapping. Constants: default isovalue 0.02, opacity 0.85,
   positive `#2f6fd6`, negative `#d6453d`.
2. `workspaceTree.ts`: add `cube` and `cub` to `MOLECULAR_EXTENSIONS`;
   `buildMoleculePreviewSnapshot` reports `.cub` as `cube`.
   `filePreviewPolicy.ts` needs no change: molecular routing is decided by
   `MOLECULAR_EXTENSIONS`, and cubes stay out of the download-only lists.
3. `explorer/useWorkspaceFilePreview.ts`: for cubes, check the header in the
   first chunk (`volumetricGridTooLarge`, `volumetricMultipleOrbitals`), then
   read 2 MiB chunks up to `MAX_CUBE_PREVIEW_BYTES`. Files above the cap get
   the `moleculePreviewTooLarge` / `volumetricPreviewTooLarge` reason in the
   download state.
4. `GraphMoleculeViewerData.ts`: accept `cube` (and `cub`, normalised to
   `cube`); a cube is a single frame.
5. `load3Dmol.ts` / `GraphMoleculeViewerRenderTypes.ts`: type
   `$3Dmol.VolumeData` and `viewer.addIsosurface`.
6. `GraphMoleculeViewer.tsx`: for cubes, validate the header and value count,
   add the atoms from the header section only, draw the +/- isosurfaces
   before the initial zoom, and redraw them (coalesced to one per animation
   frame) when the isovalue or opacity changes. Rebuilding the model clears
   them with the other shapes, so a new frame or file never keeps the old
   surfaces. Cubes have no unit cell (3Dmol reports the grid as crystal
   data). The caption shows the grid size and orbital index. Errors name the
   cube problem.
7. `GraphMoleculeViewerLowerButtonGroup.tsx`: an Isosurface group with a
   log-scale isovalue slider (10⁻⁴ to 1) and an opacity slider, plus the
   two lobe colours. Scientific actions opens by default for cubes so the
   controls are visible.
8. `plugin-xyz`: add `cube`/`cub` to `StructureAsset.format` and
   `fileExtensions`.
9. i18n: new `files.*` keys in `files.en.ts` and `files.zh-CN.ts`.
10. Tests: header parsing (positive and negative atom count, MO line, units,
    partial chunk, malformed lines, value count), the 200³ limit, the cube
    size cap and chunking in `useWorkspaceFilePreview`, routing of
    `.cube/.cub` to the viewer, and that isosurfaces are drawn, redrawn and
    cleared when the file changes. Tests synthesise small cubes; no sample
    files are committed.

The host needs no change for Explorer previews. Publishing a cube as a
`chem.structure` artifact needs the app-server to label it (its
`chem.structure` extension list and inline-source formats do not include
`cube`), and the `/files` media type for `.cube` is `application/octet-stream`.

## Proposed: ESD spectrum renderer

ORCA ESD writes `.spectrum` (all states) and `.spectrum.rootN` (one state) as
whitespace tables. The header names the columns (energy, total and component
intensities).

- The host already has a bounded spectrum plot for reviewed
  `frequency,intensity` CSV artifacts (cloud infra
  `apps/web/components/agent-workspace/SpectrumViewer.tsx`). Reuse it: add a
  parser from the ESD table to the same `SpectrumSample[]` and register a file
  renderer for `spectrum` and `root\d+` suffixes.
- Choose the x unit and intensity column from the header. Keep the existing
  sample cap (2048) by binning, not truncating.
- This needs real ESD sample files from the Quntur owners before anything is
  built. Column layouts differ between ORCA versions and spectrum types.
