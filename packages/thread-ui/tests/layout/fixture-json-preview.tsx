import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as monaco from 'monaco-editor/editor/editor.api.js';
import { GraphWorkspacePreviewPane } from '../../src/components/graph-workspace/GraphWorkspacePreviewPane';
import { formatJsonPreview } from '../../src/components/graph-workspace/explorer/jsonPreview';
import { createDefaultPluginContextValue } from '../../src/plugins/plugin-context';
import {
  newDraft,
  editDraft,
} from '../../src/components/graph-workspace/explorer/workspaceDocuments';
import type { WorkspaceDocuments } from '../../src/components/graph-workspace/explorer/useWorkspaceDocuments';
import './fixture.css';
import './fixture-molecule-appearances.css';
const params = new URLSearchParams(location.search);
const theme = params.get('theme') || 'light';
document.documentElement.classList.add('fixture-molecule-host');
document.documentElement.dataset.themeEffective = theme;
if (params.get('appearance') === 'terminal')
  document.documentElement.dataset.themePreset = 'terminal';
const minifiedSource =
  '{"version":1,"events":[{"progress":{"callId":"pyscf:3c566151","energy":-1.234567890123456789e-100,"step":2,"status":"complete"}}],"id":9007199254740993,"empty":[]}';
const source = params.has('preformatted') ? formatJsonPreview(minifiedSource)! + '\n' : minifiedSource;
const node = {
  id: 'json',
  path: 'runs/molecules/node-progress.json',
  name: 'node-progress.json',
  kind: 'file' as const,
  children: [],
};
const preview = {
  path: node.path,
  name: node.name,
  language: 'json',
  content: params.has('invalid') ? '{"broken":' : source,
  size: source.length,
  truncated: params.has('partial'),
  nextOffset: source.length,
};
function Fixture() {
  const [draft, setDraft] = useState(() =>
    newDraft('fixture-json', {
      ...preview,
      workspaceRevision: '1',
      fileIdentity: 'json',
      contentHash: 'hash',
      encoding: 'utf-8',
      bom: false,
      eol: 'lf',
      readOnlyReason: null,
    }),
  );
  const [changes, setChanges] = useState(0);
  const [saves, setSaves] = useState(0);
  const documents: WorkspaceDocuments = {
    documents: new Map([[node.path, draft]]),
    source: 'fixture',
    load: async () => null,
    change: (_path: string, content: string) => {
      setChanges((n) => n + 1);
      setDraft((d) => editDraft(d, content));
    },
    setEditing: (_path: string, editing: boolean) =>
      setDraft((d) => ({ ...d, editing })),
    save: async () => {
      setSaves((n) => n + 1);
      return true;
    },
    discard() { return true; },
    reconcile: async () => true,
    adoptDisk() {
      return true;
    },
    checkDisk: async () => {},
    acceptVerifiedDisk() {},
  };
  Object.assign(window, {
    __jsonFixture: { monaco, source, changes, saves, draft },
  });
  const pane = (
    <GraphWorkspacePreviewPane
      plugins={createDefaultPluginContextValue()}
      selectedTarget={params.has('event') ? { kind: 'event', node: { ...node, kind: 'event', path: 'thread-events:/turn-a/001-tool-call.json', detail: source } } : { kind: 'workspace-file', node }}
      previewFile={params.has('event') ? null : preview}
      {...(params.has('event') ? {} : { documents })}
      canSaveDocument
      onDownloadFile={() => {
        Object.assign(window, { __download: source });
      }}
    />
  );
  return (
    <main
      className="thread-ui-shell"
      data-theme-effective={theme}
      data-appearance={params.get('appearance') || 'classical'}
      style={{
        height: '100%',
        padding: 16,
        background: 'var(--theme-bg)',
        display: 'flex',
        flexDirection: 'row',
      }}
    >
      {params.has('duplicate') ? (
        <>
          <div style={{ width: '50%', height: '100%', minWidth: 0 }}>{pane}</div>
          <div style={{ width: '50%', height: '100%', minWidth: 0 }}>{pane}</div>
        </>
      ) : (
        <div style={{ width: '100%', height: '100%', minWidth: 0 }}>{pane}</div>
      )}
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
