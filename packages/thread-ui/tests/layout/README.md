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
pnpm exec tsc -p packages/thread-ui/tests/layout/tsconfig.json
pnpm --filter @remote-codex/thread-ui exec vitest run src/components/MatterWorkbench.test.tsx src/components/ThreadWorkspaceLayout.test.tsx
```

If Playwright is supplied by a separate checkout, set `PLAYWRIGHT_MODULE` to that
checkout's absolute `node_modules/@playwright/test` path. `LAYOUT_OUTPUT` chooses
the screenshot/results directory; `LAYOUT_URL` overrides the localhost URL.
`COPY_OUTPUT` chooses the code-copy screenshot/results directory.

The code-copy check uses a reply ending in a one-line fenced code block. It
checks direct mouse clicks at both widths, hover hit-testing against the
overlapping reply-copy control, mobile block-tap reveal followed by button tap,
and keyboard activation. Each activation must copy the exact code to clipboard.

The molecule representation check uses `?molecule&theme=light|dark` to exercise
the real viewer. It checks select/option foreground and opaque background colors
with the opposite OS color preference, in workspace and expanded views, plus
selection synchronization with the representation toolbar and keyboard focus.
`MOLECULE_OUTPUT` chooses its screenshots/results directory. The native popup's
OS chrome is browser-owned; the checks inspect the option styles directly.

The checks cover 1440×900, 390×844 and 900×700 in light/dark themes; horizontal
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
