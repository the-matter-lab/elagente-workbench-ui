# Shared workbench layout checks

This deterministic fork dev harness exercises G01, G17, G18 and G19 using the
real ThreadDetailSurface composer and Explorer. It has no backend, account
session or scientific runtime dependency. Connected and unavailable variants use
the same host navigation and appearance settings.

From the workspace root:

```sh
pnpm install --frozen-lockfile
pnpm exec vite --config packages/thread-ui/tests/layout/vite.config.ts
```

In another terminal, with Playwright and Chromium already installed:

```sh
node packages/thread-ui/tests/layout/check.mjs
node packages/thread-ui/tests/layout/check-code-copy.mjs
node packages/thread-ui/tests/layout/check-molecule-representation.mjs
node packages/thread-ui/tests/layout/check-json-preview.mjs
pnpm exec tsc -p packages/thread-ui/tests/layout/tsconfig.json
pnpm --filter @remote-codex/thread-ui exec vitest run src/components/MatterWorkbench.test.tsx src/components/ThreadWorkspaceLayout.test.tsx
```

If Playwright is supplied by a separate checkout, set `PLAYWRIGHT_MODULE` to that
checkout's absolute `node_modules/@playwright/test` path. `LAYOUT_OUTPUT` chooses
the screenshot/results directory; `LAYOUT_URL` overrides the localhost URL.
`COPY_OUTPUT` chooses the code-copy screenshot/results directory.

The JSON preview check opens `json-preview.html` with the real Monaco editor in
Classical/Terminal and light/dark appearances. It checks default formatting,
fold/unfold, exact Raw text, keyboard switching, original edit/download content,
and that previewing does not dirty or save the document. Invalid and partial JSON
stay raw. A two-pane case guards against one preview disposing the other's model.
`JSON_PREVIEW_OUTPUT` chooses its screenshots and `BROWSER_RESULTS.json` directory.

The code-copy check uses a reply ending in a one-line fenced code block. It
checks direct mouse clicks at both widths, hover hit-testing against the
overlapping reply-copy control, mobile block-tap reveal followed by button tap,
and keyboard activation. Each activation must copy the exact code to clipboard.

The molecule representation check uses
`?molecule&appearance=classical|terminal&theme=light|dark` to exercise the real
viewer in all four appearances, each in workspace and expanded views, with the
opposite OS color preference. `fixture-molecule-appearances.css` snapshots the
host's Classic dark palette and Terminal token/typography/control-corner rules
from deployed `el-agente-cloud-infrastructure` source
`1617dda8c59ebf586e1a68d6e8a04ba984ce284d` under `apps/web` (source paths and
SHA256 hashes are recorded in the file). These rules are scoped to the molecule fixture;
menu styling comes entirely from the production Thread UI styles. The checker
rejects identical font/palette results for Classical and Terminal.

It compares the actual open View and Representation DOM popup surfaces, normal,
selected, hovered and keyboard-focused rows, including focus rings. It exercises
all supported representations, synchronization in both directions with the Style
toolbar, Arrow/Home/End navigation, Enter/Space activation, Escape/focus restoration,
and outside-click dismissal. Tab closes the portal popup and advances from the
trigger to Inspect coordinates; Shift+Tab closes it and returns to the preceding
Structure tools & selection summary. Geometry and hit testing verify that the lower popup
opens above its trigger, stays inside the viewer, and exposes clickable rows.
Menu interactions must preserve the expanded/workspace state.
`MOLECULE_OUTPUT` chooses its screenshots/results directory. Each of the eight
cases captures View and Representation separately with selected/hovered and
selected/keyboard-focused rows visible (32 PNGs total), plus computed style and
geometry evidence in `results.json`. These are deterministic local Chromium
checks; they do not establish hosted integration or Safari/Firefox behavior.

For a dedicated port and evidence directory:

```sh
pnpm exec vite --config packages/thread-ui/tests/layout/vite.config.ts --port 5189
# In another terminal:
LAYOUT_URL=http://127.0.0.1:5189 MOLECULE_OUTPUT=/tmp/molecule-menus node packages/thread-ui/tests/layout/check-molecule-representation.mjs
```

The checks cover 1440×900, 390×844, 900×700 and 1100×900 in light/dark themes; horizontal
and page overflow, transcript/composer visibility, workspace tree scrolling and
file preview, retained workspace state, pointer/keyboard resizing and preference
persistence, drawer focus cycling/restoration, theme and agent selection parity,
and send/stop visibility during simulated keyboard changes. The simulated
visualViewport inset and shortened Chromium viewport are local regression
checks. Physical mobile IME, hosted session/reconnect and genuine scientific
viewer acceptance belong to W11's dev2 validation.

Workspace remains lazily mounted on mobile until first opened, then stays
mounted while hidden. Desktop starts with Explorer visible and stores an explicit
collapse preference in `remote-codex.explorer-open`; hosts can set
`defaultExplorerOpen: false` for first-use behavior. Width preference remains in
`remote-codex.explorer-width`, clamped to the current space without overwriting it
when the viewport narrows. Arrow keys resize by 24px; Home/End select the limits.
