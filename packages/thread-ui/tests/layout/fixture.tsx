import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThreadDetailSurface } from '../../src/ThreadDetailSurface';
import { ThreadWorkspaceLayout } from '../../src/components/ThreadWorkspaceLayout';
import { PluginProvider } from '../../src/plugins/PluginProvider';
import { GraphMoleculeViewer } from '../../src/components/graph-workspace/GraphMoleculeViewer';
import type { MatterWorkbenchOptions } from '../../src/components/MatterWorkbench';
import type { ThreadDetailUiAdapter } from '../../src';
import { mockCapabilities, mockDetail, mockStatus, mockThreads } from '../../../../apps/playground/src/mockData';
import './fixture.css';
import './fixture-molecule-appearances.css';

const fixtureParams = new URLSearchParams(location.search);
if (fixtureParams.has('molecule')) {
  document.documentElement.classList.add('fixture-molecule-host');
  document.documentElement.dataset.themeEffective = fixtureParams.get('theme') === 'dark' ? 'dark' : 'light';
  if (fixtureParams.get('appearance') === 'terminal') document.documentElement.dataset.themePreset = 'terminal';
  else delete document.documentElement.dataset.themePreset;
}

const adapter: ThreadDetailUiAdapter = {
  openThread() {}, sendPrompt() {}, interrupt() {}, compact() {}, updateSettings() {},
  workspace: {
    async listTree({path}) {
      // ?folders: a long folder inside a workspace of folders (ELA-257 048e).
      if (new URLSearchParams(location.search).has('folders')) {
        if (path === 'phosphine_mobo') return {name:'phosphine_mobo', path, kind:'directory', childrenLoaded:true, children:Array.from({length:80}, (_, index) => ({name:`result-${index}.json`, path:`phosphine_mobo/result-${index}.json`, kind:'file', size:24}))};
        return {name:'Workspace', path:'', kind:'directory', childrenLoaded:true, children:['benchmark_campaign','phosphine_mobo','runs','structures'].map(name => ({name, path:name, kind:'directory', hasChildren:true, childrenLoaded:false, children:[]}))};
      }
      return {name:'Workspace', path:'', kind:'directory', childrenLoaded:true, children:Array.from({length:80}, (_, index) => ({name:`inspection-result-${index}.txt`, path:`inspection-result-${index}.txt`, kind:'file', size:24}))};
    },
    // Downloads leave an operation notice over the file panes (ELA-257 048e).
    async downloadNode() {},
    async readFile({path}) { return {path, name:path, content:'Persistent inspection fixture\n', language:'text', size:30, truncated:false, nextOffset:30}; },
  },
};
function Fixture() {
  const params = new URLSearchParams(location.search);
  const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
  const unavailable = params.has('unavailable');
  // A reply ending in one short code block exposes overlapping copy controls.
  const detail = params.has('copyCode') ? {
    ...mockDetail,
    turns: mockDetail.turns.map((turn, index) => index === 0 ? {
      ...turn,
      items: turn.items.map(item => item.kind === 'agentMessage' ? {
        ...item, text: '**Copy fixture**\n\n```javascript\nconst water = "H2O";\n```',
      } : item),
    } : turn),
  } : mockDetail;
  const [agent, setAgent] = useState('Agent Alpha');
  const options: MatterWorkbenchOptions = {
    brandName:'ElAgente', hideRail:true, showShortcuts:false, showNotifications:false, showSearch:false,
    threads:mockThreads.map(t => ({key:t.id, title:t.title, subtitle:agent, href:`#${t.id}`, status:t.status, favorite:false})),
    currentKey:mockDetail.thread.id, workspacePath:agent, favorite:false, activeView:'chat', terminalEnabled:false,
    notifications:[], unreadCount:0, onViewChange() {}, onToggleFavorite() {}, onNavigate() {}, onSearch() {}, onReadNotifications() {},
    renderNavigationHeader: ({closeNavigation}) => <nav aria-label="Agents">{['Agent Alpha','Agent Beta'].map(name => <button key={name} aria-pressed={agent===name} onClick={() => {setAgent(name); closeNavigation();}}>{name}</button>)}</nav>,
  };
  return <PluginProvider builtinPlugins={[]}>
    {unavailable ? <ThreadWorkspaceLayout threads={[]} workbench={{...options, emptyWorkspace:true}} effectiveTheme={theme} themeMode={theme} viewportConstrained currentWorkspaceLabel={agent} globalSettingsContent={<p>Appearance</p>}><div className="fixture-unavailable">Agent paused</div></ThreadWorkspaceLayout> :
      <ThreadDetailSurface threads={mockThreads} detail={detail} loading={false} error={null} status={mockStatus} capabilities={mockCapabilities} adapter={adapter} currentThreadId={mockDetail.thread.id} currentWorkspaceId={mockDetail.workspace.id} currentWorkspaceLabel={agent} activeView="chat" workbench={options} shellEffectiveTheme={theme} shellThemeMode={theme} onShellThemeModeChange={() => {}} globalSettingsContent={<p>Appearance</p>} composerProps={{disabled:false, draftPrompt:'', model:mockDetail.thread.model, reasoningEffort:mockDetail.thread.reasoningEffort, collaborationMode:mockDetail.thread.collaborationMode, canInterrupt:true, onInterrupt() {}}}/>
    }
  </PluginProvider>;
}
function MoleculeFixture() {
  const theme = fixtureParams.get('theme') === 'dark' ? 'dark' : 'light';
  return <div className="thread-ui-shell fixture-molecule" data-theme-effective={theme} data-appearance={fixtureParams.get('appearance') === 'terminal' ? 'terminal' : 'classical'}>
    <GraphMoleculeViewer title="Water" source={{content:['3\nWater\nO 0 0 0\nH 0.96 0 0\nH -0.24 0.93 0\n']}} />
  </div>;
}
createRoot(document.getElementById('root')!).render(
  new URLSearchParams(location.search).has('molecule') ? <MoleculeFixture /> : <Fixture />,
);
