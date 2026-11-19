# @remote-codex/thread-ui

Shared Pockymoe thread UI components and plugin rendering helpers.

This package is intentionally adapter-driven. It does not import supervisor-web
API helpers, router libraries, local REST endpoints, websocket endpoint strings,
or app-local thread routes. Hosts provide navigation, asset URL,
history-detail loading, prompt submission, and shell transport through props and
adapters.

## Styling

The first extraction keeps thread-specific CSS in
`apps/supervisor-web/src/index.css` to preserve the current visual output. Host
apps that consume this package must provide the same theme tokens and classes
until thread-specific styles are moved into a package stylesheet.

Required style coverage includes the thread workspace layout, timeline,
composer, sidebar cards, empty/error/status surfaces, shell panel, and XYZ
viewer styles imported by the package plugin renderer.

The production molecule figure and full-view interaction contract, local demo,
validation commands and deliberate differences from the Matter prototype are
documented in [Molecule viewer](docs/molecule-viewer.md).

## Live structures

`LiveStructuresPanel` shows many concurrently streamed structures: totals and
producers, a paged summary table (ID, label, stage, step, energy with its unit,
other summary keys, status) and inline viewers of the latest frame of the
selected streams (at most four by default). It is data-only. The host supplies
`totals`, `producers`, `rows`, `frames` and the controlled `selected` keys, and
turns `onSelectionChange` into its own watch request. With `onPageChange` (and
optionally `onStatusFilterChange`) the host pages from its server; otherwise the
panel pages through `rows` itself. Each frame is single-frame XYZ/extXYZ text
rendered by the shared molecule viewer; the viewer is keyed by stream, so new
frames keep the camera. `ThreadTimeline`'s `renderTurnContent(turnId)` places
host content such as this panel below a turn, open or folded.

## Host-rendered sent files

`ThreadTimelineAdapter.renderUserMessageContent` can reuse the shared prompt body
while replacing FILE tiles with a host-owned list of actual persisted attachments:

```tsx
renderUserMessageContent: input => (
  <>
    {input.renderDefaultContent(undefined, { fileAttachments: false })}
    <PersistedFilesTable item={input.item} />
  </>
)
```

Omitting the first argument retains the parsed default prompt body, including peer
envelopes. The option suppresses only FILE tiles; PHOTO thumbnails and full-size
previews, text expansion, metadata and copying the complete original prompt retain
their shared behavior. Omitting options keeps the existing tiles. This is a
presentation option, not upload or workspace-file validation. Hosts remain
responsible for deriving their table from actual persisted attachment metadata.
