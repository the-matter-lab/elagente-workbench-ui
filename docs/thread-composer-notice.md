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

The review package is `@remote-codex/thread-ui@0.1.29-idle.2`, built from the
0.1.28 release base. Consumers only need to replace their thread-ui tarball URL;
shared, plugin-runtime, plugin-terminal, and plugin-xyz pins can remain unchanged.

`MatterWorkbenchOptions.threadHeader.singleRow?: boolean` replaces the desktop
conversation tabs and secondary toolbar with one 44px header. It retains the full
selected title, host lifecycle pill, Files and more actions. The existing search
component stays mounted in the header summary and overlays the title while open;
the search button and Ctrl/Cmd+F continue to work. A collapsed sidebar's reopen,
Back and Forward controls move into this row. Connection/notification indicators
stay available. Conversations remain in the sidebar and phone sheet. Empty
workspaces omit desktop tabs and header chrome in this mode. Omitted/false keeps
the original two desktop rows; phone layout and navigation remain unchanged.
The host opts in with `threadHeader: { singleRow: true, status: 'Idle',
tone: 'running', statusDescription: '…' }`; idle policy remains host-owned.

The production backport is `0.1.26-idle.2`, built from the actual 0.1.26 baseline.
Only thread-ui changes; preserve every production sibling package pin. Both
artifacts preserve all unrelated tarball payloads, including existing styles.
