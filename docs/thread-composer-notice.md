# Optional host status and composer content

`MatterWorkbenchOptions.threadHeader.statusDescription?: string` explains the
existing lifecycle pill on hover or keyboard focus using the shared tooltip. The
pill retains the supplied status and tone. It enters the tab order only when the
description is nonempty. Escape dismisses the tooltip.

`ThreadDetailSurfaceProps.composerNotice?: ReactNode` renders host content directly
before the chat composer in both the normal and floating mobile composer hosts.
The shared UI wraps it in `.thread-composer-notice` without visual styling or an
ARIA live region; the host controls presentation and announcement frequency.
While content is present, the measured composer host has
`data-composer-notice="true"`, which hosts can select to style the combined border.
The slot is outside the timeline and participates in the existing composer size
and keyboard-overlap measurements. Updating it preserves the mounted composer.

Both additions are optional. The package contains no idle policy, countdown, or
keepalive implementation. Hosts supply descriptions, notices, and actions.

The review package is `@remote-codex/thread-ui@0.1.26-idle.1`, built from the
actual production 0.1.26 release base (`511481e5a0ba4748e1dc75a3a789e9f789049017`). Consumers only need to replace their thread-ui tarball URL;
shared, plugin-runtime, plugin-terminal, and plugin-xyz pins can remain unchanged.

## Production 0.1.26 scoped prerelease

This branch adds only the PR25 source behavior and its focused tests to the actual
production source. It does not copy the PR25 generated dist from the 0.1.28 base.
Build with `pnpm install --frozen-lockfile`,
`pnpm --filter @remote-codex/thread-ui build`, then
`pnpm --filter @remote-codex/thread-ui pack --pack-destination <output>`.
As with the production 0.1.26 release, consumers must use the freshly built release
archive, not the older checked-in dist snapshot.

The packed prerelease contains the same 53 file names as published 0.1.26. Exactly
three payloads differ: `dist/index.js`, `dist/index.d.ts`, and `package.json`
(version only). All 50 other payloads, including every stylesheet and runtime
chunk, are byte-identical. The runtime diff contains only the tooltip and notice
slot changes; the timeline and failure-card runtime is preserved.

Focused validation: the tooltip, notice, chat navigation, and ThreadTimeline suites
pass (64 tests across four files), alongside thread-ui typecheck and build. Full CI
and browser QA are not run for this authorized preview. The GitHub prerelease
carries the archive, SHA256SUMS, provenance JSON, and payload/runtime diff proof.
