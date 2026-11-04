import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PluginProvider, ThreadDetailSurface, type PromptAttachmentUpload, type ThreadDetailUiAdapter } from '@remote-codex/thread-ui';
import { StructureView, xyzPlugin } from '@elagente/plugin-xyz';
import { artifactUrl, fileUrl, rpc, subscribe, upload, workspace } from './api';
import { capabilities, project, projectThread, type Agent, type Interaction, type NativeThread, type Snapshot } from './projection';
import { useTheme } from './theme';
import { defaultThreadTitle } from './thread-title';

const plugins = [xyzPlugin];
type Draft = {prompt: string; attachments: PromptAttachmentUpload[]};
const emptyDraft = (): Draft => ({prompt: '', attachments: []});
const agentDescriptions: Record<string, string> = {seguro: 'Lab safety', grafico: 'Molecular modeling', quntur: 'Molecular workflows'};

async function readThread(threadId: string): Promise<Snapshot | null> {
  try { return await rpc<Snapshot>('thread/read', {threadId}); }
  catch (reason) {
    if (reason && typeof reason === 'object' && 'code' in reason && reason.code === 'THREAD_NOT_FOUND') return null;
    throw reason;
  }
}

function PendingInteraction({ interaction, threadId, refreshed }: {interaction: Interaction; threadId: string; refreshed: () => void}) {
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const operation = useRef(crypto.randomUUID());
  const captured = useRef(false);
  const respond = useCallback(async (value: unknown) => {
    setSending(true); setError(null);
    try {
      await rpc('interaction/respond', {threadId, interactionId: interaction.id, operationId: operation.current, value});
      refreshed();
    } catch (reason) { setError(String(reason)); setSending(false); }
  }, [threadId, interaction.id, refreshed]);
  const capture = useCallback((view: {captureScreenshot: () => string; trajectoryIndex: number}) => {
    if (captured.current) return;
    captured.current = true;
    try { void respond({image: view.captureScreenshot(), trajectoryIndex: view.trajectoryIndex}); }
    catch (reason) { setError(String(reason)); }
  }, [respond]);
  const request = interaction.request;
  return <section className="interaction" aria-label={interaction.title}>
    <strong>{interaction.title}</strong>
    {interaction.kind === 'clientAction' && request.action === 'xyz.capture' && request.artifactId && request.revision ? <>
      <p>The agent is capturing this published structure.</p>
      <StructureView asset={{url: artifactUrl(threadId, request.artifactId), checksum: request.revision, name: request.path ?? 'structure.xyz', format: 'xyz'}} onReady={capture} />
      <button disabled={sending} onClick={() => void respond({error: 'Viewer unavailable'})}>Report unavailable</button>
    </> : interaction.kind === 'approval' ? <div className="row">
      <button disabled={sending} onClick={() => void respond({approved: true})}>Allow</button>
      <button disabled={sending} onClick={() => void respond({approved: false})}>Decline</button>
    </div> : <form onSubmit={event => {event.preventDefault(); void respond({text: answer});}}>
      {typeof request.question === 'string' ? <p>{request.question}</p> : <pre>{JSON.stringify(request, null, 2)}</pre>}
      <label>Response <input value={answer} onChange={event => setAnswer(event.target.value)} /></label>
      <button disabled={sending || !answer}>Send response</button>
    </form>}
    {error && <p role="alert">{error}</p>}
  </section>;
}

export function App() {
  const { themeMode, effectiveTheme, changeThemeMode } = useTheme();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState('seguro');
  const [threads, setThreads] = useState<NativeThread[]>([]);
  const [threadId, setThreadId] = useState(localStorage.getItem('elagente.thread') ?? '');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const drafts = useRef(new Map<string, Draft>());
  const lastAgentThread = useRef(new Map<string, string>());
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusFile, setFocusFile] = useState<{path: string; requestId: number} | null>(null);
  const activeRef = useRef(threadId);
  activeRef.current = threadId;
  const openThread = useCallback((nextId: string, nextAgentId?: string) => {
    if (activeRef.current === nextId) return;
    if (activeRef.current) drafts.current.set(activeRef.current, draft);
    activeRef.current = nextId;
    setSnapshot(null); setError(null); setThreadId(nextId);
    const owner = nextAgentId ?? threads.find(value => value.id === nextId)?.agentId;
    if (owner) {
      setAgentId(owner);
      if (nextId) lastAgentThread.current.set(owner, nextId);
    }
  }, [draft, threads]);
  const selectAgent = (id: string) => {
    if (id === agentId) return;
    const candidates = threads.filter(value => value.agentId === id);
    const previous = candidates.find(value => value.id === lastAgentThread.current.get(id));
    const latest = [...candidates].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    setAgentId(id);
    openThread(previous?.id ?? latest?.id ?? '', id);
  };
  const refresh = useCallback(async () => {
    const current = activeRef.current;
    const [listing, next] = await Promise.all([
      rpc<{threads: NativeThread[]}>('thread/list'),
      current ? readThread(current) : Promise.resolve(null),
    ]);
    setThreads(listing.threads);
    if (current === activeRef.current) {
      setSnapshot(next);
      if (current && !next) { activeRef.current = ''; setThreadId(''); setError(null); }
    }
  }, []);
  const refreshSafely = useCallback(() => { void refresh().catch(reason => setError(String(reason))); }, [refresh]);
  useEffect(() => {
    void (async () => {
      const protocol = await rpc<{protocol: string}>('initialize');
      if (protocol.protocol !== 'elagente.app-server/v1') throw new Error('Unsupported app-server protocol');
      const catalog = await rpc<{agents: Agent[]}>('agent/list');
      setAgents(catalog.agents);
      if (catalog.agents.length && !activeRef.current) setAgentId(catalog.agents[0].id);
      await refresh();
    })().catch(reason => setError(String(reason)));
  }, [refresh]);
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setSnapshot(null); setConnected(false); setFocusFile(null); setDraft(drafts.current.get(threadId) ?? emptyDraft());
    localStorage.setItem('elagente.thread', threadId);
    if (threadId) void readThread(threadId).then(value => {
      if (disposed) return;
      if (!value) { activeRef.current = ''; setThreadId(''); setError(null); refreshSafely(); return; }
      setSnapshot(value);
      setThreads(previous => previous.map(thread => thread.id === value.thread.id ? value.thread : thread));
      setAgentId(value.thread.agentId);
      lastAgentThread.current.set(value.thread.agentId, threadId);
      unsubscribe = subscribe(threadId, value.seq, () => {
        if (timer) return;
        timer = setTimeout(() => {timer = undefined; if (!disposed) refreshSafely();}, 60);
      }, setConnected);
    }).catch(reason => { if (!disposed) setError(String(reason)); });
    return () => {disposed = true; unsubscribe?.(); clearTimeout(timer);};
  }, [threadId, refreshSafely]);
  const createThread = useCallback(async (title = '') => {
    setBusy(true); setError(null);
    try {
      const agent = agents.find(value => value.id === agentId);
      const value = await rpc<NativeThread>('thread/start', {agentId, operationId: crypto.randomUUID(), title: title.trim() || defaultThreadTitle(agent?.name ?? agentId)});
      setThreads(previous => [value, ...previous]); openThread(value.id, agentId);
    } catch (reason) { setError(String(reason)); } finally { setBusy(false); }
  }, [agentId, agents, openThread]);
  const interrupt = useCallback(async () => {
    if (!snapshot?.thread.activeTurnId) return;
    try {await rpc('turn/interrupt', {threadId, turnId: snapshot.thread.activeTurnId}); await refresh();}
    catch (reason) {setError(String(reason));}
  }, [snapshot, threadId, refresh]);
  const adapter = useMemo<ThreadDetailUiAdapter>(() => ({
    openThread, workspace, interrupt,
    openWorkspaceFile: ({path}) => setFocusFile({path, requestId: Date.now()}),
    getImageAssetUrl: path => fileUrl(threadId, path),
    async sendPrompt(input) {
      if (!threadId) return false;
      const agent = agents.find(value => value.id === snapshot?.thread.agentId);
      const outboxKey = `elagente.pending.${threadId}`;
      setBusy(true); setError(null);
      try {
        const prior = localStorage.getItem(outboxKey);
        let command: Record<string, unknown>;
        if (prior) {
          const pending = JSON.parse(prior);
          if (pending.prompt !== input.prompt) throw new Error('Retry the pending message before sending a different message');
          command = pending.command;
        } else {
          const parts: Record<string, unknown>[] = [];
          if (input.prompt.trim()) parts.push({type: 'text', text: input.prompt});
          for (const attachment of input.attachments ?? []) {
            const isImage = attachment.file.type.startsWith('image/');
            if (isImage ? !agent?.capabilities.images : !agent?.capabilities.files) throw new Error(`${agent?.name} does not accept this attachment type`);
            const safeName = attachment.file.name.replace(/[^\p{L}\p{N}._-]/gu, '_');
            const file = await upload(threadId, `uploads/${crypto.randomUUID()}_${safeName}`, attachment.file);
            parts.push({type: 'file', path: file.path, revision: file.revision});
          }
          command = {threadId, operationId: crypto.randomUUID(), input: parts};
          localStorage.setItem(outboxKey, JSON.stringify({prompt: input.prompt, command}));
        }
        await rpc('turn/start', command);
        localStorage.removeItem(outboxKey);
        drafts.current.delete(threadId);
        if (activeRef.current === threadId) setDraft(emptyDraft());
        await refresh(); return true;
      } catch (reason) {
        if (reason && typeof reason === 'object' && 'code' in reason && reason.code !== 'INTERNAL_ERROR') localStorage.removeItem(outboxKey);
        setError(String(reason)); return false;
      } finally {setBusy(false);}
    },
  }), [threadId, agents, snapshot?.thread.agentId, interrupt, refresh, openThread]);
  const selectedAgent = agents.find(value => value.id === agentId);
  const detail = snapshot ? project(snapshot, selectedAgent) : null;
  return <PluginProvider builtinPlugins={plugins}>
    <main className="elagente-app">
      {snapshot?.thread.status === 'recoveryRequired' && <p className="recovery" role="alert">Native execution needs review after an interrupted connection. Inspect the run and compute jobs, then create a new conversation. The server will not automatically repeat tool calls.</p>}
      <div className="elagente-surface">
        <ThreadDetailSurface presentation="workspace" threads={threads.filter(value => value.agentId === agentId).map(projectThread)} detail={detail} loading={Boolean(threadId && !snapshot)} error={error}
          adapter={adapter} capabilities={capabilities} currentThreadId={threadId || undefined} currentWorkspaceId={null}
          currentWorkspaceLabel="ElAgente" workspaceFocusPathRequest={focusFile}
          shellEffectiveTheme={effectiveTheme} shellThemeMode={themeMode} onShellThemeModeChange={changeThemeMode} timelineProps={{autoCollapseCompletedTurns: true}}
          onNewThreadTitle={createThread}
          renderNavigationHeader={({collapsed, closeNavigation}) => <nav className={`agent-navigation${collapsed ? ' is-collapsed' : ''}`} aria-label="Agents">
            {!collapsed && <p className="agent-navigation-label">Agents</p>}
            {agents.map(agent => <button key={agent.id} type="button" className="agent-navigation-item" title={agent.name} aria-label={`Switch to ${agent.name}`} aria-pressed={agentId === agent.id}
              disabled={busy} onClick={() => {selectAgent(agent.id); closeNavigation();}}>
              <span className="agent-monogram" aria-hidden="true">{agent.name.slice(0, 1)}</span>
              {!collapsed && <span className="agent-navigation-copy"><strong>{agent.name}</strong><span>{agentDescriptions[agent.id] ?? 'Scientific agent'}</span></span>}
            </button>)}
            {!collapsed && <p className="connection" role="status">{threadId ? connected ? 'Connected' : 'Connecting…' : 'Ready'}{selectedAgent?.mode !== 'native' && ' · Offline preview'}</p>}
          </nav>}
          metaContent={selectedAgent && <dl className="agent-details"><dt>Agent</dt><dd>{selectedAgent.name}</dd><dt>Runtime</dt><dd>{selectedAgent.mode === 'native' ? 'Native runtime' : selectedAgent.mode === 'native-offline-validation' ? 'Native agent with an offline validation model' : 'Adapter contract fixture'}</dd><dt>Release</dt><dd><code>{selectedAgent.release.slice(0, 12)}</code></dd></dl>}
          workspaceFeatures={{workspace: true, toolUsage: true, guide: false, threadGraph: false, extensions: false}}
          beforeTimelineContent={snapshot && <>
            {snapshot.interactions.filter(value => value.status === 'pending').map(value => <PendingInteraction key={value.id} interaction={value} threadId={threadId} refreshed={refreshSafely} />)}
            {snapshot.executions.length > 0 && <section className="executions"><strong>Compute jobs</strong>{snapshot.executions.map(execution => <div className="row" key={execution.id}><code>{execution.id}</code><span>{execution.status}</span>{!['succeeded', 'failed', 'cancelled', 'timed_out'].includes(execution.status) && <button disabled={execution.cancelRequested} onClick={() => {void rpc('execution/cancel', {threadId, executionId: execution.id, operationId: crypto.randomUUID()}).then(refresh).catch(reason => setError(String(reason)));}}>{execution.cancelRequested ? 'Cancellation requested' : 'Cancel job'}</button>}</div>)}</section>}
          </>}
          emptyContent={<div className="welcome"><h1>Start a conversation with {selectedAgent?.name ?? 'an agent'}</h1><p>Your conversations, files and molecular structures stay together here.</p><button disabled={busy || !agents.length} onClick={() => void createThread()}>New conversation</button></div>}
          composerProps={{disabled: busy || !detail || Boolean(snapshot?.thread.activeTurnId) || snapshot?.thread.status === 'recoveryRequired',
            agentLabel: selectedAgent?.name, draftPrompt: draft.prompt, draftAttachments: draft.attachments, onDraftChange: setDraft,
            capabilities, modelOptions: [], collaborationMode: 'default', canInterrupt: Boolean(snapshot?.thread.activeTurnId), onInterrupt: interrupt,
            model: selectedAgent?.mode === 'native' ? snapshot?.thread.options.model ?? 'Agent default' : 'Offline validation',
            followTail: true, hideSandboxModeControl: true, threadConnected: connected, shellAvailable: false}}
        />
      </div>
    </main>
  </PluginProvider>;
}
