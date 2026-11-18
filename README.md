# Remote Codex Thread UI

Standalone workspace for the Remote Codex thread surface, app shell, built-in UI plugins, and Treer ACP Agent UI recipe.

The shared packages remain UI-only. Runtime integrations translate provider events into the shared thread DTOs consumed by `@remote-codex/thread-ui`. The Treer recipe is a separate app boundary that hosts an ACP runtime and exposes the same surface through `treer.agent-interface/v1`.

## ElAgente validation fork

The `app-server/elagente-validation` branch in
[`the-matter-lab/remote-codex-thread-ui-rust`](https://github.com/the-matter-lab/remote-codex-thread-ui-rust/tree/app-server/elagente-validation)
contains the ElAgente app-server host, shared sidebar extensions and inline
scientific artifacts. Upstream remains
[`dufangshi/remote-codex-thread-ui-rust`](https://github.com/dufangshi/remote-codex-thread-ui-rust).
Despite the repository name, this workspace uses React and TypeScript.

See the [ElAgente host runbook](apps/elagente-web/README.md) and
[XYZ plugin contract](packages/plugin-xyz/README.md). Agent scientific runtimes
and the app-server backend remain in their respective repositories. This branch
validates local integration; it is not a hosted production release.

## Packages

- `@remote-codex/thread-ui`: React thread/chat/artifact/settings surface.
- `@remote-codex/shared`: Current DTO contract source copied from Remote Codex. This should be narrowed
  into a dedicated `@remote-codex/thread-ui-contracts` package before publishing externally.
- `@remote-codex/plugin-runtime`: Shared plugin/artifact helpers.
- `@remote-codex/plugin-terminal`: Built-in terminal plugin manifest.

## Apps

- `apps/playground`: Vite playground with mock thread data for visual iteration.
- `apps/agent-ui-web`: Embedded single-thread surface used through Treer's AIS iframe tunnel.
- `apps/agent-ui-server`: ACP client, authentication flow, normalized thread projection, and AIS HTTP/WebSocket server.

## Treer Recipe

Install the repository URL from Treer's **Install recipe** flow:

```text
https://github.com/dufangshi/remote-codex-thread-ui.git
```

The installer lists the supported ACP harnesses, asks which ones to install, then creates one Treer command Agent and launch profile per selection. Each Agent owns one ACP session and registers an embedded UI with prompt, transcript, state, and abort capabilities.

For direct inspection inside a Treer-managed installer Agent:

```bash
./scripts/apply.sh --list
./scripts/apply.sh --agent codex
```

## Development

```bash
pnpm install
pnpm build
pnpm dev
```

The playground is the default place to redesign the UI toward a GraphChat-like product surface without
pulling in the full Remote Codex control-plane runtime.

## Composer attachments (ELA-407)

Draft attachments show the exact uploaded filename, an uppercase extension badge
(unknown types use `FILE`), and a direct remove control. Image files use local
thumbnails. Names shorten in the middle only when space requires it, preserving
the end and extension; the full name remains available in the tooltip and
accessible label. A shared ending is muted only when every filename in the draft
shares it at a token boundary. Single files and mixed sets remain unmuted.

Calculation outputs (`.log`, `.out`, `.fchk`, `.cube`, `.cub`) show their size.
PDF pages and ZIP/TAR/TAR.GZ file counts are read locally, lazily, and without
extracting archive entries or delaying submission. Unknown counts are omitted.
Metadata inspection has conservative size/time limits: PDFs up to 2 MiB with
classic object tables, ZIP/TAR up to 512 MiB with bounded directory reads, and
TAR.GZ up to 16 MiB compressed/32 MiB expanded. Encrypted, compressed-object PDF,
ZIP64, unsupported, or malformed inputs retain their filename without a count.
These are metadata limits, not upload limits. The display never renames or
changes a submitted `File`, its placeholder, or its bytes.

## Boundary

Keep the shared packages UI-only:

- Do not add Treer Proxy auth, sandbox routing, database, or deployment logic to the shared packages.
- Keep backend-specific behavior in adapters outside the core thread UI.
- Prefer typed DTO/event inputs over direct runtime coupling.
- Keep the ACP/AIS process in `apps/agent-ui-server`; do not move provider lifecycle into React components.
