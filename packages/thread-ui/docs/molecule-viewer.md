# Matter molecule viewer

`GraphMoleculeViewer` implements the figure card and full viewer from Matter's
`gallery/molecule-viewer/index.html` (design revision
`54987ee4ff9268ce0c681f1b59be6b8ee13f065f`). It is shared by the XYZ artifact
plugin, chat timeline and workspace preview. Include the package's `styles.css`;
the host supplies its theme tokens, fonts and `/vendor/3Dmol-min.js`.

Timeline figures show a transparent 300px stage and a filename, Hill formula and
atom count derived from the rendered, verified model. Hover/focus exposes expand
and download; touch devices expose them continuously. Double-click opens full
view. A native modal dialog promotes the existing viewer to the top layer, traps
focus and returns focus on close. The same canvas, personal camera, selection,
ready handle and command executor remain mounted. Actual unmount releases the
3Dmol observers, constructor global listeners, animation and WebGL context.

Full view and the workspace expose ball-and-stick, sticks and space-fill,
hydrogen visibility, atom labels, slow/fast/off spin and reset. The original
surface/cartoon, coordinates, clipboard, source/frame downloads, unit cell,
trajectory, LIVE, scientific selection/staging/submission, screenshot and
reviewed extension slots remain under the structure/scientific controls. There
is no new backend dependency or executable viewer program.

The lower Representation picker uses the same themed menu surface, rows,
checkmark and hover/focus colors as View. It stays inside the figure's theme and
expanded dialog, outside the scrolling controls panel. Arrow keys, Home/End,
Enter/Space, Escape and Tab navigate or dismiss it; choosing a style keeps the
upper representation toolbar synchronized.

Distance uses two atoms in Å. Angle uses three atoms with the middle atom as
vertex, in degrees. Measurement picks are separate from scientific selections;
clicking a pick again cancels it. Records use canonical atom IDs and are isolated
by object, source revision, frame and model data. The session list supports pin,
remove, clear, row hover/focus emphasis and 50 changes of undo/redo. Each frame
allows 128 measurements. The change notice expires after eight seconds; keyboard
undo remains available. Nothing persists or submits measurements automatically.

Keyboard shortcuts apply while inspecting this viewer: 1/2/3 style, L labels,
H hydrogens, D distance, A angle, M measurement tool, S spin, R reset, ? help,
Ctrl/⌘ Z undo and Shift Ctrl/⌘ Z redo. Inputs, selects, textareas, contenteditable
and textbox descendants keep their native keys. Menu navigation does not invoke
viewer shortcuts. Escape closes the focused Representation menu or View popover
or help, clears picks, exits the tool, then closes full view. Reduced motion
disables spin and transition animations. Theme changes repaint the existing
model without refitting its camera or dropping agent annotations.

The immutable bytes/checksum verification, stable atom/object/frame/revision
identity, live append and pinned historical camera, W0 command-batch fencing and
render-before-ACK, capture PNG dimensions and live provenance are unchanged.
See the [XYZ plugin contract](../../plugin-xyz/README.md). Source download uses
the plugin's immutable-byte callback. There are no fabricated source versions,
jobs, audit events, charge, spin multiplicity or computational provenance.

## Demo and validation

After building shared, plugin-runtime, plugin-terminal and thread-ui, run:

```sh
pnpm --filter @remote-codex/thread-ui-playground dev --port 5174 --strictPort
```

Open `http://127.0.0.1:5174/molecule-viewer.html`. The page explicitly labels its
local water/methane fixtures and uses the production exported viewer with the
real local 3Dmol runtime. Its append and capture controls demonstrate retained
personal inspection. It does not simulate an authenticated scientific host.

This environment uses `/workspace/ElAgente/.local/bin/node`, with corepack's
`/usr/local/lib/node_modules/corepack/dist/pnpm.js` as the pnpm entry. Prefix Node
commands with `PATH=/workspace/ElAgente/.local/bin:$PATH UV_THREADPOOL_SIZE=1
NODE_OPTIONS=--max-old-space-size=4096 taskset -c 0,1`; run builds serially and
Vitest with `--maxWorkers=1`.

```sh
pnpm --filter @remote-codex/shared build
pnpm --filter @remote-codex/plugin-runtime build
pnpm --filter @remote-codex/plugin-terminal build
pnpm --filter @remote-codex/thread-ui build
pnpm --filter @remote-codex/thread-ui typecheck
pnpm --filter @remote-codex/thread-ui exec vitest run --maxWorkers=1
pnpm --filter @remote-codex/thread-ui-playground build
pnpm --filter @elagente/web typecheck
pnpm --filter @elagente/web build
node apps/playground/scripts/check-molecule-viewer.mjs
```

The browser check accepts `PLAYWRIGHT_MODULE`, `MOLECULE_URL` and
`MOLECULE_OUTPUT`. It uses one single-process/no-zygote Chromium, sequential
desktop/mobile viewports in one context, real atom raycast picks, unchanged canvas/camera across
expand/close, focus restoration, measurement clear/undo, theme, capture and
toolbar overflow checks. In this container use the cloud checkout's Playwright
module and the shared `LD_LIBRARY_PATH`/`FONTCONFIG_FILE` settings.

Validation on 2026-10-08 UTC: shared → plugin-runtime → plugin-terminal →
thread-ui builds passed serially, including regenerated tracked dist; thread-ui
and ElAgente host typechecks passed; playground and ElAgente Vite builds passed.
The complete thread-ui suite passed 92 files / 596 tests. After the final
unit-cell theme adjustment, the complete focused scientific suite passed
7 files / 82 tests (viewer, lifetime, data, commands, StructureViewer, streaming
and inline source); plugin-runtime passed 7 tests. Existing React act/Radix test
warnings and Vite large-chunk warnings remain non-fatal.

The real Chromium smoke passed desktop 1440×900 and mobile 390×844, light/dark,
with no page errors. Both measured the actual 1.057 Å fixture bond and passed
clear/undo, retained canvas/camera, focus restoration and current PNG capture.
Toolbar scroll width equalled its client width (414px desktop / 310px mobile),
and document width stayed within each viewport. Evidence is in
`/tmp/matter-molecule-viewer-evidence/results.json` and four adjacent screenshots;
the repeatable script is `apps/playground/scripts/check-molecule-viewer.mjs`.

## Remaining design differences

Release follow-up: independent audit found that deleting the focused last
measurement or disabling Clear moved focus outside the viewer and broke immediate
keyboard undo. Measurement changes now retain focus on the stable viewer. A
regression test failed before the fix; the final focused scientific suite passed
83 tests, typecheck/build passed, and a real 3Dmol browser check passed immediate
remove/clear undo and redo on desktop/mobile, light/dark. Package versions are
Thread UI 0.1.7 and XYZ plugin 0.1.2.

- The native modal is inset from the viewport, rather than the chat pane. Opening
  grows from the figure over 300ms; closing uses a 240ms fade/scale on the returned
  figure instead of the prototype's reverse morph.
- Measurement emphasis uses dashed segments and value labels; angles have no
  circular arc. The list uses a normal thin scrollbar and always-visible count,
  instead of the prototype's scroll fades and conditional count.
- The View popover uses native disclosure and normal Tab navigation. The toolbar
  wraps at narrow widths; it deliberately avoids the prototype's mobile overflow.
- Labels cover all atoms with stable IDs rather than the prototype's selected
  element subset. The soft theme palette overrides the common elements; remaining
  elements retain 3Dmol's element colors.
- The package inherits host fonts. The standalone demo declares DM Sans with
  system fallbacks; it does not download fonts. Pixel/font parity must be checked
  in the integrated host, along with physical touch/IME and authenticated native
  scientific submissions.
- Native modal top-layer rules require extension popovers to render within the
  dialog; an extension that portals interactive UI to document.body needs an
  appropriate portal container. Ordinary reviewed toolbar buttons remain mounted.
- Mock job/audit/source-version controls are omitted until authoritative host
  metadata and navigation exist. Trajectory frames are never presented as source
  versions. Checksum/runtime errors remain real, with no mock Retry action.
