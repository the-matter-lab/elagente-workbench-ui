/**
 * @vitest-environment jsdom
 */
import { setLocale } from '../i18n';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ThreadTurnDto } from '@remote-codex/shared';

import { ThreadTimeline } from './ThreadTimeline';
import { WorkbenchContext } from './WorkbenchContext';
const shellSettings = vi.hoisted(() => ({ showReasoningSummaries: true, autoCollapseCompletedTurns: undefined as boolean | undefined }));
vi.mock('../app-shell/AppShellNavContext', () => ({ useAppShellNav: () => shellSettings }));
import {
  formatLongTimestamp,
  formatShortTimestamp,
} from './threadPresentation';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  flushSync(() => {
    root?.render(node);
  });
  return container;
}

afterEach(() => {
  shellSettings.showReasoningSummaries = true;
  shellSettings.autoCollapseCompletedTurns = undefined;
  if (root) {
    flushSync(() => {
      root?.unmount();
    });
  }
  root = null;
  container?.remove();
  container = null;
  setLocale('en', false);
  vi.useRealTimers();
});

function completedTurn(items: ThreadTurnDto['items']): ThreadTurnDto {
  return {
    id: 'turn-1',
    startedAt: new Date(Date.UTC(2026, 6, 3, 20, 10, 59)).toISOString(),
    status: 'completed',
    error: null,
    items,
  };
}

describe('collapsed answer sections', () => {
  const prompt = { id: 'prompt', kind: 'userMessage' as const, text: 'Explain and implement' };
  const first = { id: 'answer-1', kind: 'agentMessage' as const, text: '## First answer\n\n' + 'Explanation of the implementation. '.repeat(30) };
  const final = { id: 'answer-2', kind: 'agentMessage' as const, text: 'Implementation verified.', responsePhase: 'final' as const };
  const command = (id: string) => ({ id, kind: 'commandExecution' as const, text: `hidden-${id}`, status: 'completed' });
  const summary = { ...completedTurn([prompt, first, { id: 'narration', kind: 'agentMessage', text: 'Running checks.' }, final]), hasDeferredItems: true, deferredItemCount: 5,
    activity: { commands: 5, reads: 2, segments: [
      { before: first.id, commands: 2 },
      { before: 'narration', commands: 1, reads: 1 },
      { before: final.id, commands: 2, reads: 1 },
    ] },
  };
  const detail = { ...summary, hasDeferredItems: false, activity: null, items: [
    prompt, command('leading-1'), command('leading-2'), first,
    { id: 'narration', kind: 'agentMessage' as const, text: 'Running checks.' }, command('gap-1'), command('gap-2'), command('gap-3'), final,
  ] };

  it.each((['completed', 'failed', 'interrupted'] as const).flatMap(status =>
    (['loaded', 'deferred'] as const).map(mode => [status, mode] as const)))('keeps an early final reply below the work when a %s turn expands from %s history', async (status, mode) => {
    // Native runtimes update their first assistant message in place, before
    // the tool records appended later. The final reply need not be last.
    const reply = {id: 'early-final', kind: 'agentMessage' as const, text: 'Final report. '.repeat(50)};
    const operations = Array.from({length: 25}, (_, index) => ({
      id: `tool-${index}`, kind: 'toolCall' as const, text: `Operation ${index}`, status: 'completed',
      progress: {version: 1 as const, callId: `tool-${index}`, label: `Operation ${index}`, status: 'completed' as const,
        startedAt: '2026-10-29T17:11:28Z', completedAt: '2026-10-29T17:18:40Z'},
    }));
    const turn = {...completedTurn([prompt, reply, ...operations, {id: 'trailing', kind: 'other' as const, text: 'Saved artifact'}]), status};
    const displayed = mode === 'deferred' ? {...turn, items: [prompt, reply], hasDeferredItems: true, deferredItemCount: 25} : turn;
    const load = vi.fn(async () => ({...turn, hasDeferredItems: false, deferredItemCount: 0}));
    const props = {threadId: `early-final-${status}-${mode}`, liveOutput: '', autoCollapseCompletedTurns: true, onLoadTurnDetail: load};
    const el = render(<ThreadTimeline {...props} turns={[displayed]} />);
    const toggle = () => el.querySelector<HTMLButtonElement>('.thread-worked-toggle')!;
    const finalReply = el.querySelector('[data-message-id="early-final"]');
    expect(finalReply).not.toBeNull();
    flushSync(() => toggle().click());
    await vi.waitFor(() => expect(el.querySelectorAll('.thread-graph-tool-call')).toHaveLength(25));
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelectorAll('.thread-graph-tool-call')).toHaveLength(25);
    expect(el.querySelector('[data-message-id="early-final"]')).toBe(finalReply);
    expect(finalReply?.closest('.tlog-collapse')).toBeNull();
    const lastOperation = el.querySelectorAll('.thread-graph-tool-call')[24]!;
    expect(lastOperation.compareDocumentPosition(finalReply!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // An ordinary refreshed snapshot must retain both the open work and reply.
    flushSync(() => root?.render(<ThreadTimeline {...props} turns={[structuredClone(displayed)]} />));
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelectorAll('.thread-graph-tool-call')).toHaveLength(25);
    flushSync(() => toggle().click());
    expect(el.querySelector('[data-message-id="early-final"]')).toBe(finalReply);
    expect(el.querySelectorAll('.thread-graph-tool-call')).toHaveLength(0);
  });

  it('hides leading work and merges the gap into one counted placeholder without loading', () => {
    const load = vi.fn();
    const el = render(<ThreadTimeline turns={[summary]} liveOutput="" autoCollapseCompletedTurns onLoadTurnDetail={load} />);
    expect(el.querySelectorAll('.thread-answer-section')).toHaveLength(1);
    expect(el.querySelector('.thread-answer-sequence')?.nextElementSibling?.textContent).toContain('Implementation verified.');
    expect(el.querySelectorAll('.tlog-run[data-placeholder]')).toHaveLength(1);
    const gap = el.querySelector('.thread-answer-sequence .tlog-run-head')!;
    expect(gap.querySelector('[data-kind=commands]')?.getAttribute('aria-label')).toBe('3 commands');
    expect(gap.querySelector('[data-kind=reads]')?.getAttribute('aria-label')).toBe('Read 2 files');
    expect(el.querySelector('.tlog-row')).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('opens a stretch of work in place, leaving the rest of the turn folded, and folds it back', async () => {
    const load = vi.fn(async () => detail);
    const el = render(<ThreadTimeline turns={[summary]} liveOutput="" autoCollapseCompletedTurns onLoadTurnDetail={load} />);
    const stretch = () => el.querySelector<HTMLButtonElement>('.thread-answer-sequence .tlog-run[data-placeholder] .tlog-run-head')!;
    flushSync(() => stretch().click());
    // Its operations load and open under its line; the turn itself stays folded.
    await vi.waitFor(() => expect(el.querySelector('.thread-stretch-work .tlog-run[data-open] .tlog-title')?.textContent).toBe('hidden-gap-1'));
    expect(load).toHaveBeenCalledTimes(1);
    expect(stretch().getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('.thread-worked-toggle')?.getAttribute('aria-expanded')).toBe('false');
    expect(el.textContent).not.toContain('hidden-leading-1');
    flushSync(() => stretch().click());
    expect(stretch().getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('.tlog-row, .tlog-single, .tlog-run[data-open]')).toBeNull();
    expect(el.textContent).not.toContain('hidden-gap-1');
    expect(el.querySelectorAll('.thread-answer-section')).toHaveLength(1);
    expect(el.querySelector('.thread-answer-sequence')?.nextElementSibling?.textContent).toContain('Implementation verified.');
    expect(el.querySelectorAll('.tlog-run[data-placeholder]')).toHaveLength(1);
  });

  it('keeps the final answer mounted in its place while the turn opens and closes', async () => {
    const load = vi.fn(async () => detail);
    const el = render(<ThreadTimeline turns={[summary]} liveOutput="" autoCollapseCompletedTurns onLoadTurnDetail={load} />);
    const answer = () => [...el.querySelectorAll('[data-message-id]')].find(node => node.getAttribute('data-message-id') === final.id);
    const before = answer();
    expect(before).toBeTruthy();
    flushSync(() => el.querySelector<HTMLButtonElement>('.thread-worked-toggle')!.click());
    expect(answer()).toBe(before);
    // Opened and loaded: the narration is in, runs are folded.
    await vi.waitFor(() => expect(el.querySelector('.thread-worked-toggle')?.getAttribute('aria-busy')).toBe('false'));
    await vi.waitFor(() => expect(el.textContent).toContain('Running checks.'));
    expect(answer()).toBe(before);
    flushSync(() => el.querySelector<HTMLButtonElement>('.thread-worked-toggle')!.click());
    expect(answer()).toBe(before);
  });

  it.each(['deferred', 'loaded'])('keeps a gap made only of operations between answers in a %s turn', (mode) => {
    const turn = mode === 'deferred' ? { ...summary, items: [prompt, first, final], activity: {
      commands: 5, segments: [{ before: first.id, commands: 2 }, { before: final.id, commands: 3 }],
    } }
      : { ...detail, items: detail.items.filter(item => item.id !== 'narration') };
    const el = render(<ThreadTimeline turns={[turn]} liveOutput="" autoCollapseCompletedTurns onLoadTurnDetail={vi.fn()} />);
    expect(el.querySelectorAll('.thread-answer-section')).toHaveLength(1);
    expect(el.querySelector('.thread-answer-sequence')?.nextElementSibling?.textContent).toContain('Implementation verified.');
    const gap = el.querySelector('.thread-answer-sequence .tlog-run[data-placeholder]');
    expect(gap, 'operation-only gap must remain available between the two answers').not.toBeNull();
    expect(gap!.querySelector('[data-kind=commands]')?.getAttribute('aria-label')).toBe('3 commands');
    expect(el.querySelector('.tlog-row')).toBeNull();
  });
});

describe('ThreadTimeline', () => {
  it('uses Supervisor activity on deferred turns and formats the work line in order', () => {
    const onLoadTurnDetail = vi.fn();
    const turn: ThreadTurnDto = {
      ...completedTurn([
        { id: 'prompt', kind: 'userMessage', text: 'Inspect' },
        { id: 'answer', kind: 'agentMessage', text: 'Done', responsePhase: 'final' },
      ]),
      startedAt: '2026-10-10T10:00:00Z', completedAt: '2026-10-10T10:00:51Z',
      hasDeferredItems: true, deferredItemCount: 8,
      activity: { commands: 6, fileChanges: 2, changedFiles: 2, addedLines: 64, removedLines: 3, failed: 1 },
    };
    const el = render(<ThreadTimeline turns={[turn]} liveOutput="" onLoadTurnDetail={onLoadTurnDetail} />);
    const line = el.querySelector('.thread-graph-worked-summary')!;
    expect(line.querySelector('.thread-graph-worked-label')?.textContent).toBe('Worked for 51s');
    expect([...line.querySelectorAll('.tlog-count[role=img]')].map(node => [node.getAttribute('data-kind'), node.getAttribute('aria-label')])).toEqual([['commands', '6 commands'], ['failed', '1 failed']]);
    expect(line.textContent).toContain('edited 2 files +64 −3');
    expect(line.querySelector('.thread-execution-step-count')).toBeNull();
    expect(line.querySelector('.thread-turn-usage')).toBeNull();
    expect(onLoadTurnDetail).not.toHaveBeenCalled();
  });

  it('omits time labels on interleaved user messages and expanded narration', () => {
    const el = render(<ThreadTimeline turns={[completedTurn([
      { id: 'prompt', kind: 'userMessage', text: 'Initial prompt', createdAt: '2026-10-10T10:00:00Z' },
      { id: 'narration', kind: 'agentMessage', text: 'Checking first', responsePhase: 'commentary', createdAt: '2026-10-10T10:00:01Z' },
      { id: 'command', kind: 'commandExecution', text: 'pwd' },
      { id: 'followup', kind: 'userMessage', text: 'Follow-up prompt', createdAt: '2026-10-10T10:00:02Z' },
      { id: 'answer', kind: 'agentMessage', text: 'Final answer', responsePhase: 'final', createdAt: '2026-10-10T10:00:03Z' },
    ])]} liveOutput="" autoCollapseCompletedTurns={false} />);
    for (const message of el.querySelectorAll('[data-role]')) {
      expect(message.querySelector('.thread-graph-message-time-row'), message.textContent ?? '').toBeNull();
    }
  });

  it('opens changed files independently of folded work and loads large diffs only on demand', async () => {
    const files = ['a', 'b', 'c', 'large'].map((name, index) => ({
      path: `src/${name}.ts`, itemId: `edit-${index}`, addedLines: index === 3 ? 41 : 1, removedLines: 1,
    }));
    const turn: ThreadTurnDto = {
      ...completedTurn([
        { id: 'prompt', kind: 'userMessage', text: 'Edit the files' },
        { id: 'final', kind: 'agentMessage', text: 'Edits complete', responsePhase: 'final' },
      ]),
      hasDeferredItems: true, deferredItemCount: 8,
      activity: { commands: 2, fileChanges: 4, fileCount: 7, addedLines: 44, removedLines: 4, files },
    };
    const onLoadTurnDetail = vi.fn();
    const loadDetail = vi.fn(async (id: string) => ({ id, kind: 'fileChange' as const, title: id, text: '@@ -1 +1 @@\n-old\n+new' }));
    const element = render(<ThreadTimeline turns={[turn]} liveOutput="" autoCollapseCompletedTurns onLoadTurnDetail={onLoadTurnDetail}
      adapter={{ onLoadHistoryItemDetail: loadDetail }} />);
    const work = () => element.querySelector('.thread-worked-toggle')!;
    const fileToggle = () => element.querySelector<HTMLButtonElement>('.tlog-files-toggle')!;
    expect(work().getAttribute('aria-expanded')).toBe('false');
    expect(work().querySelector('.tlog-count[data-kind=commands]')?.getAttribute('aria-label')).toBe('2 commands');
    expect(work().textContent).not.toContain('edited');
    expect(fileToggle().textContent).toContain('edited 7 files');
    expect(element.querySelector('.tlog-files')).toBeNull();
    expect(loadDetail).not.toHaveBeenCalled();
    flushSync(() => fileToggle().click());
    await vi.waitFor(() => expect(loadDetail).toHaveBeenCalledTimes(3));
    expect(loadDetail.mock.calls.map(([id]) => id)).toEqual(['edit-0', 'edit-1', 'edit-2']);
    expect(work().getAttribute('aria-expanded')).toBe('false');
    expect(fileToggle().getAttribute('aria-expanded')).toBe('true');
    expect(element.querySelectorAll('.tlog-files .tlog-row')).toHaveLength(4);
    expect(element.querySelector('.tlog-files-more')?.textContent).toContain('3 more files');
    expect(onLoadTurnDetail).not.toHaveBeenCalled();
    const large = () => element.querySelector<HTMLButtonElement>('.tlog-files > .tlog-row:nth-child(4) .tlog-row-head')!;
    expect(large().getAttribute('aria-expanded')).toBe('false');
    flushSync(() => large().click());
    await vi.waitFor(() => expect(loadDetail).toHaveBeenCalledWith('edit-3'));
    expect(element.querySelector('.tlog-files > .tlog-row:nth-child(4) .thread-diff')?.textContent).toContain('new');
    expect(onLoadTurnDetail).not.toHaveBeenCalled();
    flushSync(() => fileToggle().click());
    expect(element.querySelector('.tlog-files')).toBeNull();
    flushSync(() => fileToggle().click());
    await vi.waitFor(() => expect(element.querySelectorAll('.tlog-files .thread-diff')).toHaveLength(3));
    expect(loadDetail).toHaveBeenCalledTimes(4);
    expect(work().getAttribute('aria-expanded')).toBe('false');
  });

  it.each([
    ['cleared', true], ['empty', true], ['cleared', false], ['empty', false],
  ] as const)('keeps completed live work foldable when live items are %s and deferred=%s', async (mode, deferred) => {
    const turn: ThreadTurnDto = {
      ...completedTurn([{ id: 'prompt', kind: 'userMessage', text: 'Check the work' }]), status: 'inProgress',
    };
    const items: ThreadTurnDto['items'] = [
      { id: 'live-1', kind: 'commandExecution', text: 'first-command', status: 'completed' },
      { id: 'live-2', kind: 'commandExecution', text: 'second-command', status: 'running' },
    ];
    let resolveDetail!: (detail: ThreadTurnDto) => void;
    const load = vi.fn(() => new Promise<ThreadTurnDto>(resolve => { resolveDetail = resolve; }));
    const props = { liveOutput: '', autoCollapseCompletedTurns: true, onLoadTurnDetail: load };
    const element = render(<ThreadTimeline {...props} threadRunning activeTurnId={turn.id} turns={[turn]} liveItems={{ turnId: turn.id, items }} />);
    expect(element.querySelector('.thread-worked-toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect(element.querySelector('.tlog-run-head')?.getAttribute('aria-expanded')).toBe('true');
    const finished: ThreadTurnDto = { ...turn, status: 'completed', hasDeferredItems: deferred, deferredItemCount: deferred ? 2 : 0,
      items: [...turn.items, { id: 'final', kind: 'agentMessage', text: 'Finished', responsePhase: 'final' }] };
    flushSync(() => root?.render(<ThreadTimeline {...props} threadRunning={false} activeTurnId={null} turns={[finished]}
      liveItems={mode === 'empty' ? { turnId: turn.id, items: [] } : null} />));
    const toggle = () => element.querySelector<HTMLButtonElement>('.thread-worked-toggle')!;
    expect(toggle()).not.toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(toggle().querySelector('.tlog-count[data-kind=commands]')?.getAttribute('aria-label')).toBe('2 commands');
    expect(element.querySelector('.tlog-single, .tlog-run, .tlog-current')).toBeNull();
    expect(element.querySelector('.thread-turn-head')).not.toBeNull();
    expect(element.querySelector('.thread-graph-turn-footer')).toBeNull();
    expect(load).not.toHaveBeenCalled();
    flushSync(() => toggle().click());
    if (!deferred) {
      expect(load).not.toHaveBeenCalled();
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      expect(element.querySelector('.tlog-single')).toBeNull();
      // Once the final reply is kept outside the work, this is one run, so
      // opening the work line opens its operations without an extra click.
      expect(element.querySelector('.tlog-run-head')?.getAttribute('aria-expanded')).toBe('true');
      expect(element.querySelectorAll('.tlog-run .tlog-row')).toHaveLength(2);
      expect(element.textContent).toContain('first-command');
      expect(element.textContent).toContain('second-command');
      return;
    }
    expect(load).toHaveBeenCalledExactlyOnceWith(turn.id);
    resolveDetail({ ...finished, hasDeferredItems: false, deferredItemCount: 0,
      items: [turn.items[0]!, { id: 'authoritative', kind: 'commandExecution', text: 'final-command', status: 'completed' }, finished.items[1]!] });
    await vi.waitFor(() => expect(element.textContent).toContain('final-command'));
    expect(element.textContent).not.toContain('first-command');
    expect(element.textContent).not.toContain('second-command');
    expect(toggle().querySelector('.tlog-count[data-kind=commands]')?.getAttribute('aria-label')).toBe('1 command');
  });

  it('keeps summary deferred items after completing a turn with stale inProgress detail', async () => {
    const summary: ThreadTurnDto = { ...completedTurn([
      { id: 'prompt', kind: 'userMessage', text: 'Check status' },
      { id: 'checkpoint', kind: 'agentMessage', text: 'Checking' },
    ]), status: 'inProgress', hasDeferredItems: true, deferredItemCount: 1 };
    const stale: ThreadTurnDto = { ...summary, hasDeferredItems: false, deferredItemCount: 0,
      items: [summary.items[0]!, { id: 'old-command', kind: 'commandExecution', text: 'old-command', status: 'completed' }, summary.items[1]!] };
    const terminal: ThreadTurnDto = { ...summary, status: 'completed', hasDeferredItems: true, deferredItemCount: 7,
      items: [summary.items[0]!, { id: 'final', kind: 'agentMessage', text: 'Final answer', responsePhase: 'final' }] };
    const load = vi.fn().mockResolvedValueOnce(stale).mockResolvedValueOnce({ ...terminal, hasDeferredItems: false, deferredItemCount: 0,
      items: [terminal.items[0]!, { id: 'new-command', kind: 'commandExecution', text: 'new-command', status: 'completed' }, terminal.items[1]!] });
    const props = { liveOutput: '', onLoadTurnDetail: load, autoCollapseCompletedTurns: true };
    const element = render(<ThreadTimeline {...props} turns={[summary]} threadRunning activeTurnId={summary.id} />);
    await vi.waitFor(() => expect(element.textContent).toContain('old-command'));
    flushSync(() => element.querySelector<HTMLButtonElement>('.thread-worked-toggle')!.click());
    flushSync(() => root?.render(<ThreadTimeline {...props} turns={[terminal]} threadRunning={false} activeTurnId={null} />));
    expect(element.querySelector('.thread-worked-toggle')?.getAttribute('aria-expanded')).toBe('false');
    expect(load).toHaveBeenCalledTimes(1);
    flushSync(() => element.querySelector<HTMLButtonElement>('.thread-worked-toggle')!.click());
    await vi.waitFor(() => expect(element.textContent).toContain('new-command'));
    expect(load).toHaveBeenCalledTimes(2);
    expect(element.textContent).not.toContain('old-command');
  });

  it('renders host turn content for each turn, open or folded (ELA-264)', () => {
    const first = { ...completedTurn([{ id: 'p1', kind: 'userMessage', text: 'First' }, { id: 'a1', kind: 'agentMessage', text: 'Done.' }]), id: 'turn-a' };
    const second: ThreadTurnDto = { ...completedTurn([{ id: 'p2', kind: 'userMessage', text: 'Second' }]), id: 'turn-b', status: 'inProgress' };
    const content = vi.fn((turnId: string) => turnId === 'turn-b' ? null : <p data-live-turn={turnId}>panel</p>);
    const element = render(<ThreadTimeline turns={[first, second]} liveOutput="" threadRunning activeTurnId="turn-b" renderTurnContent={content} />);
    expect([...element.querySelectorAll('[data-live-turn]')].map(node => node.getAttribute('data-live-turn'))).toEqual(['turn-a']);
    expect(content).toHaveBeenCalledWith('turn-b');
  });

  it('opens the live run while earlier runs fold after narration or a later run follows', () => {
    const turn: ThreadTurnDto = { ...completedTurn([{ id: 'prompt', kind: 'userMessage', text: 'Inspect' }]), status: 'inProgress' };
    const command = (id: string) => ({ id, kind: 'commandExecution' as const, text: id, status: 'completed' });
    const initial = [command('first'), command('second')];
    const timeline = (items: ThreadTurnDto['items']) => <ThreadTimeline turns={[turn]} liveOutput="" threadRunning activeTurnId={turn.id}
      liveItems={{ turnId: turn.id, items }} />;
    const element = render(timeline(initial));
    const runs = () => [...element.querySelectorAll('.tlog-run-head')].map(node => node.getAttribute('aria-expanded'));
    expect(runs()).toEqual(['true']);
    expect(element.querySelectorAll('.tlog-row-head[aria-expanded="false"]')).toHaveLength(2);
    const narrated: ThreadTurnDto['items'] = [...initial, { id: 'narration', kind: 'agentMessage', text: 'Checking the next result', responsePhase: 'commentary' }];
    flushSync(() => root?.render(timeline(narrated)));
    expect(runs()).toEqual(['false']);
    expect(element.querySelector('[data-message-id="narration"]')).not.toBeNull();
    flushSync(() => root?.render(timeline([...narrated, command('third'), command('fourth')])));
    expect(runs()).toEqual(['false', 'true']);
    expect(element.querySelectorAll('.tlog-run[data-open] .tlog-title')).toHaveLength(2);
    expect(element.querySelector('.tlog-current')).toBeNull();
    flushSync(() => element.querySelector<HTMLButtonElement>('.thread-worked-toggle')!.click());
    expect(element.querySelector('.tlog-current .tlog-title')?.textContent).toBe('fourth');
  });

  it('keeps a peer round human approval accessible while the whole task remains folded', () => {
    const task = {...completedTurn([{id:'user',kind:'userMessage',text:'Task'}]),id:'task'} as ThreadTurnDto;
    const peer: ThreadTurnDto = {...completedTurn([{id:'wake:user',kind:'userMessage',text:'Wake envelope',peerWork:{taskTurnId:'task',messages:[{id:'q',kind:'question',name:'Reviewer',subject:'Scope?'}]}}]),id:'wake',status:'inProgress',hasDeferredItems:true};
    const respond=vi.fn();
    const el=render(<ThreadTimeline turns={[task,peer]} liveOutput="" onLoadTurnDetail={vi.fn()} pendingRequests={[{
      id:'approval',kind:'permissionRequest',title:'Permission',description:'Approve the peer operation',turnId:'wake',itemId:null,createdAt:'2026-10-12T00:00:00Z',
      questions:[{id:'permission',header:'Permission',question:'Allow verification?',isOther:false,isSecret:false,options:[{label:'Allow',description:'Allow verification'}]}],
    }]} onRespondToRequest={respond} />);
    expect(el.querySelector('.thread-worked-toggle')?.getAttribute('aria-expanded')).toBe('true');
    flushSync(() => el.querySelector<HTMLButtonElement>('.thread-worked-toggle')!.click());
    expect(el.querySelector('.thread-peer-work-toggle')).toBeNull();
    expect(el.textContent).toContain('Allow verification?');
    const allow=[...el.querySelectorAll('button')].find(button=>button.textContent?.trim()==='Allow')!;
    expect(allow).toBeDefined();
    flushSync(()=>allow.click());
    expect(respond).toHaveBeenCalled();
  });

  it('nests peer questions in task steps and loads only the selected question round', async () => {
    const task = {...completedTurn([
      {id:'user',kind:'userMessage',text:'Implement the original task'},
      {id:'handoff',kind:'agentMessage',text:'Delegated the work',responsePhase:'commentary'},
    ]),id:'task'} as ThreadTurnDto;
    const peer = (id: string, subject: string): ThreadTurnDto => ({...completedTurn([
      {id:`${id}:user`,kind:'userMessage',text:'[Pockymoe wake]',peerWork:{taskTurnId:'task',messages:[{id:`${id}:question`,kind:'question',name:'Reviewer',subject}]}},
      {id:`${id}:reply`,kind:'agentMessage',text:`Reply for ${id}`,responsePhase:'final'},
    ]),id,hasDeferredItems:true,deferredItemCount:1});
    const first = peer('first','Can sessions expire?'), second = peer('second','Which scope applies?');
    const load = vi.fn(async (id: string) => {
      const turn = id === 'first' ? first : second;
      return {...turn,hasDeferredItems:false,deferredItemCount:0,items:[
        {...turn.items[0]!,peerWork:{taskTurnId:'task',messages:[{id:`${id}:question`,kind:'question' as const,name:'Reviewer',subject:'Can sessions expire?',text:'Full question: does the registration remain valid tomorrow?'}]}},
        {id:`${id}:command`,kind:'commandExecution' as const,text:'verify-session',status:'completed' as const},
        turn.items[1]!,
      ]};
    });
    const el = render(<ThreadTimeline turns={[task,first,second]} liveOutput="" autoCollapseCompletedTurns onLoadTurnDetail={load} />);
    expect(el.querySelectorAll('[data-role="user"]')).toHaveLength(1);
    expect(el.querySelectorAll('.thread-graph-worked-summary')).toHaveLength(1);
    expect(el.textContent).toContain('Reply for second');
    expect(el.textContent).not.toContain('Reply for first');
    expect(load).not.toHaveBeenCalled();
    flushSync(() => (el.querySelector('.thread-graph-worked-summary button[aria-expanded]') as HTMLButtonElement).click());
    expect(el.querySelectorAll('.thread-peer-work-toggle')).toHaveLength(2);
    expect(load).not.toHaveBeenCalled();
    const toggle = el.querySelector('.thread-peer-work-toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    flushSync(() => toggle.click());
    await vi.waitFor(() => expect(el.textContent).toContain('Full question: does the registration remain valid tomorrow?'));
    expect(load).toHaveBeenCalledExactlyOnceWith('first');
    expect(el.querySelector('.thread-peer-work-operations')?.textContent).toContain('verify-session');
    expect(el.querySelector('.thread-peer-work-operations')?.textContent).toContain('Reply for first');
    expect(el.querySelectorAll('[data-role="user"]')).toHaveLength(1);
    flushSync(() => toggle.click());
    flushSync(() => toggle.click());
    expect(load).toHaveBeenCalledTimes(1);
    const updated: ThreadTurnDto = { ...first, priceEstimate: {
      currency: 'USD', pricingModelKey: 'claude-opus-5-5', pricingTierKey: 'standard',
      inputUsd: 0.25, cachedInputUsd: 0, outputUsd: 1, totalUsd: 1.25,
    } };
    flushSync(() => root?.render(<ThreadTimeline turns={[task,updated,second]} liveOutput="" autoCollapseCompletedTurns onLoadTurnDetail={load} />));
    expect(el.querySelector('.thread-peer-work .thread-turn-usage-price')?.textContent).toBe('$1.25');
    expect(el.textContent).toContain('Full question: does the registration remain valid tomorrow?');
  });

  it('identifies a registered delegate wake, shows its report and separates the ensuing work', () => {
    setLocale('zh-CN', false);
    const source = '12345678-1234-1234-1234-123456789012';
    const task = {...completedTurn([{id:'user',kind:'userMessage',text:'Original task'}]),id:'task'};
    const peer = {...completedTurn([
      {id:'wake:user',kind:'userMessage',text:`[Pockymoe wake: the delegates you registered a wake for have settled]\n- b-lab (${source}): idle\n  closing message: Full E2E report: all tests passed.\n\nVerify results before acting on them. Full transcripts: pockymoe transcript ID --limit 1`,peerWork:{taskTurnId:'task',messages:[{id:'delegate',kind:'result',name:'b-lab',fromThreadId:source,subject:'idle',text:null}]}},
      {id:'reply',kind:'agentMessage',text:'Verified the report',responsePhase:'final'},
    ]),id:'wake'} as ThreadTurnDto;
    const el = render(<ThreadTimeline turns={[task,peer]} liveOutput="" autoCollapseCompletedTurns />);
    flushSync(() => (el.querySelector('.thread-graph-worked-summary button[aria-expanded]') as HTMLButtonElement).click());
    const toggle = el.querySelector('.thread-peer-work-toggle') as HTMLButtonElement;
    expect(toggle.textContent).toContain('子线程唤醒');
    expect(toggle.textContent).toContain('b-lab');
    expect(toggle.textContent).not.toContain('idle');
    flushSync(() => toggle.click());
    expect(el.querySelector('.thread-peer-report')?.textContent).toContain('已结束执行');
    expect(el.querySelector('.thread-peer-report')?.textContent).toContain('Full E2E report: all tests passed.');
    expect(el.querySelector('.thread-peer-processing-label')?.textContent).toBe('唤醒后的处理');
  });

  it('keeps the latest peer progress and final outside the task fold without exposing old replies', () => {
    const task = {...completedTurn([{id:'user',kind:'userMessage',text:'Task'}]),id:'task'} as ThreadTurnDto;
    const peer: ThreadTurnDto = {...completedTurn([
      {id:'wake:user',kind:'userMessage',text:'Wake envelope',peerWork:{taskTurnId:'task',messages:[{id:'q',kind:'question',name:'Reviewer',subject:'Scope?'}]}},
      {id:'progress',kind:'agentMessage',text:'Latest peer progress',responsePhase:'commentary'},
    ]),id:'wake',status:'inProgress'};
    const props = {liveOutput:'',onLoadTurnDetail:vi.fn()};
    const el = render(<ThreadTimeline {...props} turns={[task,peer]} threadRunning activeTurnId="wake" />);
    expect(el.querySelector('.thread-worked-toggle')?.getAttribute('aria-expanded')).toBe('true');
    flushSync(() => el.querySelector<HTMLButtonElement>('.thread-worked-toggle')!.click());
    expect(el.textContent).toContain('Latest peer progress');
    expect(el.querySelectorAll('.thread-peer-work-toggle')).toHaveLength(0);
    const next = {...peer,items:[...peer.items,{id:'new',kind:'agentMessage' as const,text:'New progress replaces old',responsePhase:'commentary' as const}]};
    flushSync(() => root?.render(<ThreadTimeline {...props} turns={[task,next]} threadRunning activeTurnId="wake" />));
    expect(el.textContent).toContain('New progress replaces old');
    expect(el.textContent).not.toContain('Latest peer progress');
    flushSync(() => root?.render(<ThreadTimeline {...props} turns={[task,{...next,status:'completed',items:[...next.items,{id:'final',kind:'agentMessage',text:'Final peer result',responsePhase:'final'}]}]} />));
    expect(el.textContent).toContain('Final peer result');
    expect(el.textContent).not.toContain('New progress replaces old');
  });

  it.each([
    ['inProgress', 'Working', '工作中'],
    ['recovering', 'Confirming status', '正在确认状态'],
    ['completed', 'Worked for 1m 12s', '工作了 1 分钟 12 秒'],
  ] as const)('refreshes the %s worked label with identical memoized props', (status, english, chinese) => {
    setLocale('en', false);
    const turn = { ...completedTurn([
      { id: 'prompt', kind: 'userMessage' as const, text: 'Keep this user message' },
      { id: 'tool', kind: 'commandExecution' as const, text: 'pwd', status: 'completed' },
      { id: 'reply', kind: 'agentMessage' as const, text: 'Keep this model reply' },
    ]), status, completedAt: '2026-07-03T20:12:11Z' };
    const element = render(<ThreadTimeline turns={[turn]} liveOutput="" autoCollapseCompletedTurns={false} />);
    expect(element.querySelector('.thread-graph-worked-label')?.textContent).toBe(english);
    // Do not rerender or replace turn/props: the external locale subscription must update memo rows.
    flushSync(() => setLocale('zh-CN', false));
    expect(element.querySelector('.thread-graph-worked-label')?.textContent).toBe(chinese);
    expect(element.textContent).toContain('Keep this user message');
    expect(element.textContent).toContain('Keep this model reply');
    flushSync(() => setLocale('en', false));
    expect(element.querySelector('.thread-graph-worked-label')?.textContent).toBe(english);
  });

  it('lazy-loads a complete collapsed turn and keeps Worked below the user message', async () => {
    let resolveTurn!: (turn: ThreadTurnDto) => void;
    const onLoadTurnDetail = vi.fn(
      () =>
        new Promise<ThreadTurnDto>((resolve) => {
          resolveTurn = resolve;
        }),
    );
    const summaryTurn: ThreadTurnDto = {
      ...completedTurn([
        {
          id: 'user-1',
          kind: 'userMessage',
          text: 'Keep the original prompt.',
          createdAt: '2026-07-03T20:10:59.000Z',
        },
        {
          id: 'agent-final',
          kind: 'agentMessage',
          text: 'Final answer.',
          createdAt: '2026-07-03T21:19:00.000Z',
        },
      ]),
      hasDeferredItems: true,
      deferredItemCount: 3,
    };
    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns={false}
        liveOutput=""
        onLoadTurnDetail={onLoadTurnDetail}
        turns={[summaryTurn]}
      />,
    );

    expect(element.textContent).toContain('Keep the original prompt.');
    expect(element.textContent).toContain('Final answer.');
    expect(element.querySelector('.thread-execution-step-count')?.textContent).toBe('3 steps');
    expect(element.textContent).not.toContain('Intermediate checkpoint.');
    const initialText = element.textContent ?? '';
    expect(initialText.indexOf('Keep the original prompt.')).toBeLessThan(
      initialText.indexOf('Worked for'),
    );

    const expandButton = Array.from(element.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label')?.includes('Expand turn 1'),
    );
    flushSync(() => expandButton?.click());
    expect(onLoadTurnDetail).toHaveBeenCalledWith('turn-1');
    // Loading keeps the work line's text and turns its chevron into a spinner.
    expect(element.querySelector('.thread-worked-toggle')?.getAttribute('aria-busy')).toBe('true');
    expect(element.querySelector('.thread-worked-spinner')?.getAttribute('aria-label')).toBe('Loading complete history...');
    expect(element.querySelector('.thread-worked-toggle .thread-graph-worked-label')?.textContent).toMatch(/^Worked for/);

    resolveTurn({
      ...summaryTurn,
      hasDeferredItems: false,
      deferredItemCount: 0,
      items: [
        summaryTurn.items[0]!,
        {
          id: 'agent-progress',
          kind: 'agentMessage',
          text: 'Intermediate checkpoint.',
          createdAt: '2026-07-03T20:20:00.000Z',
        },
        {
          id: 'reasoning-1',
          kind: 'reasoning',
          text: 'Reasoning retained after hydration.',
          createdAt: '2026-07-03T20:21:00.000Z',
        },
        {
          id: 'command-1',
          kind: 'commandExecution',
          text: 'pnpm test',
          status: 'completed',
          createdAt: '2026-07-03T20:22:00.000Z',
        },
        summaryTurn.items[1]!,
      ],
    });

    await vi.waitFor(() => {
      expect(element.textContent).toContain('Intermediate checkpoint.');
    });
    const expandedText = element.textContent ?? '';
    expect(expandedText.indexOf('Keep the original prompt.')).toBeLessThan(
      expandedText.indexOf('Worked for'),
    );
    expect(expandedText.indexOf('Worked for')).toBeLessThan(
      expandedText.indexOf('Intermediate checkpoint.'),
    );
    expect(expandedText).toContain('Final answer.');
    expect(element.querySelector('.thread-graph-worked-summary .tlog-count[data-kind=commands]')?.getAttribute('aria-label')).toBe('1 command');

    const collapseButton = Array.from(element.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label')?.includes('Collapse turn 1'),
    );
    flushSync(() => collapseButton?.click());
    const cachedExpandButton = Array.from(element.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label')?.includes('Expand turn 1'),
    );
    flushSync(() => cachedExpandButton?.click());
    expect(onLoadTurnDetail).toHaveBeenCalledTimes(1);
    expect(element.textContent).toContain('Intermediate checkpoint.');
    expect(element.querySelector('.thread-graph-worked-summary .tlog-count[data-kind=commands]')?.getAttribute('aria-label')).toBe('1 command');
  });

  it('counts operations in the work line even when the run is folded and reasoning is hidden', () => {
    shellSettings.showReasoningSummaries = false;
    const element = render(<ThreadTimeline autoCollapseCompletedTurns liveOutput="" turns={[{
      ...completedTurn([
        {id:'prompt',kind:'userMessage',text:'Check the reports'},
        {id:'progress',kind:'agentMessage',text:'Checking reports'},
        {id:'thought',kind:'reasoning',text:'Hidden reasoning'},
        {id:'command-1',kind:'commandExecution',text:'Read A',status:'completed'},
        {id:'command-2',kind:'commandExecution',text:'Read B',status:'completed'},
        {id:'answer',kind:'agentMessage',text:'Final answer'},
      ]), hasDeferredItems:false, deferredItemCount:0,
    }]} />);
    expect(element.querySelector('.thread-graph-worked-summary .tlog-count[data-kind=commands]')?.getAttribute('aria-label')).toBe('2 commands');
    expect(element.querySelector('.thread-execution-step-count')).toBeNull();
    const expand = element.querySelector<HTMLButtonElement>('[aria-label*="Expand turn 1"]')!;
    expect(expand).not.toBeNull();
    flushSync(() => expand.click());
    expect(element.querySelector('.tlog-run .tlog-count[data-kind=commands]')?.getAttribute('aria-label')).toBe('2 commands');
    expect(element.textContent).not.toContain('Hidden reasoning');
    expect(element.querySelector('.thread-graph-worked-summary .tlog-count[data-kind=commands]')?.getAttribute('aria-label')).toBe('2 commands');
    expect(element.querySelector('.thread-execution-step-count')).toBeNull();
  });

  it('keeps overlapping live and deferred steps stable through repeated expansion and summary refreshes', async () => {
    const summary: ThreadTurnDto = {
      ...completedTurn([{ id: 'prompt', kind: 'userMessage', text: 'Check progress' }]),
      status: 'inProgress', hasDeferredItems: true, deferredItemCount: 1,
    };
    const command = { id: 'command', kind: 'commandExecution' as const, text: 'Check inbox', status: 'completed' };
    const full = { ...summary, hasDeferredItems: false, deferredItemCount: 0, items: [...summary.items, command] };
    const onLoadTurnDetail = vi.fn().mockResolvedValue(full);
    const props = { threadRunning: true, activeTurnId: summary.id, liveOutput: '', onLoadTurnDetail };
    const element = render(<ThreadTimeline {...props} turns={[summary]} liveItems={{ turnId: summary.id, items: [command] }} />);
    const count = () => element.querySelector('.thread-graph-worked-summary .tlog-count[data-kind=commands]')?.getAttribute('aria-label');
    const toggle = (label: string) => flushSync(() => element.querySelector<HTMLButtonElement>(`[aria-label*="${label} turn 1"]`)!.click());
    expect(count()).toBe('1 command');
    await vi.waitFor(() => expect(onLoadTurnDetail).toHaveBeenCalledTimes(1));
    expect(element.querySelector('.thread-worked-toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect(count()).toBe('1 command');
    toggle('Collapse');
    const nextCommand = { ...command, id: 'next-command', text: 'Read report' };
    flushSync(() => root?.render(<ThreadTimeline {...props} turns={[{ ...summary, deferredItemCount: 2 }]}
      liveItems={{ turnId: summary.id, items: [command, nextCommand] }} />));
    expect(count()).toBe('2 commands');
    onLoadTurnDetail.mockResolvedValue({ ...full, items: [...full.items, nextCommand] });
    toggle('Expand');
    expect(onLoadTurnDetail).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(element.querySelector('[aria-label*="Collapse turn 1"]')).not.toBeNull());
    expect(count()).toBe('2 commands');
    flushSync(() => root?.render(<ThreadTimeline {...props} turns={[{ ...summary, deferredItemCount: 2 }]}
      liveItems={{ turnId: summary.id, items: [{ ...nextCommand, status: 'completed' }] }} />));
    expect(count()).toBe('2 commands');
  });

  it('loads running deferred operations once and merges later summary messages', async () => {
    const summary: ThreadTurnDto = {
      ...completedTurn([{ id: 'prompt', kind: 'userMessage', text: 'Live prompt' },
        { id: 'answer', kind: 'agentMessage', text: 'First checkpoint' }]),
      status: 'inProgress', hasDeferredItems: true, deferredItemCount: 1,
    };
    const full = {...summary, hasDeferredItems:false, items:[summary.items[0]!,
      {id:'operation',kind:'commandExecution',text:'unique-hidden-command',status:'completed'}, summary.items[1]!]};
    const onLoadTurnDetail = vi.fn().mockResolvedValue(full);
    const props = {onLoadTurnDetail, liveOutput:'', threadRunning:true, activeTurnId:'turn-1'};
    const element = render(<ThreadTimeline {...props} turns={[summary]} />);
    await vi.waitFor(() => expect(onLoadTurnDetail).toHaveBeenCalledTimes(1));
    expect(element.textContent).toContain('unique-hidden-command');
    expect(element.textContent).toContain('First checkpoint');
    const toggle = () => element.querySelector<HTMLButtonElement>('.thread-worked-toggle')!;
    expect(toggle()).toBeTruthy();
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    flushSync(() => toggle().click());
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    flushSync(() => toggle().click());
    await vi.waitFor(() => expect(element.querySelector('[aria-label*="Collapse turn 1"]')).not.toBeNull());
    expect(onLoadTurnDetail).toHaveBeenCalledTimes(1);
    flushSync(() => root?.render(<ThreadTimeline {...props} turns={[{...summary, items:[summary.items[0]!, {...summary.items[1]!, text:'Later checkpoint'}]}]} />));
    expect(element.textContent).toContain('Later checkpoint');
    expect(element.textContent).not.toContain('First checkpoint');
    onLoadTurnDetail.mockResolvedValue({...full, status:'completed', items:[...full.items.slice(0,-1), {...summary.items[1]!,text:'Final checkpoint'}]});
    flushSync(() => root?.render(<ThreadTimeline {...props} threadRunning={false} activeTurnId={null} turns={[{...summary,status:'completed',items:[summary.items[0]!, {...summary.items[1]!,text:'Final checkpoint'}]}]} />));
    await vi.waitFor(() => expect(onLoadTurnDetail).toHaveBeenCalledTimes(2));
    expect(element.textContent).toContain('Final checkpoint');
  });

  it.each([false, true])('keeps the latest live narration outside folded history with background=%s', (background) => {
    const prompt = { id: 'prompt', kind: 'userMessage' as const, text: 'Check progress' };
    const first = { id: 'first', kind: 'agentMessage' as const, text: 'First checkpoint', responsePhase: 'commentary' as const };
    const command = { id: 'command', kind: 'commandExecution' as const, text: 'hidden-operation', status: 'completed' };
    const wait = { id: 'wait', kind: 'other' as const, origin: 'nativeBackgroundWait' as const, text: '', status: 'waiting' };
    const turn = { ...completedTurn([prompt, first, command, ...(background ? [wait] : [])]), status: 'inProgress' as const };
    const props = { onLoadTurnDetail: vi.fn(), liveOutput: '', threadRunning: true, activeTurnId: turn.id };
    const element = render(<ThreadTimeline {...props} turns={[turn]} />);
    const update = (items: ThreadTurnDto['items']) => flushSync(() => root?.render(<ThreadTimeline {...props} turns={[{ ...turn, items }]} />));
    expect(element.querySelector('.thread-worked-toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect(element.querySelector('.tlog-current')).toBeNull();
    flushSync(() => element.querySelector<HTMLButtonElement>('.thread-worked-toggle')!.click());
    expect(element.textContent).toContain(first.text);
    expect(element.querySelector('.tlog-current')?.textContent).toContain(command.text);
    expect(element.querySelector('[data-role="assistant"]')!.compareDocumentPosition(element.querySelector('.tlog-current')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const next = { id: 'next', kind: 'agentMessage' as const, text: '', status: 'inProgress', responsePhase: 'commentary' as const };
    update([...turn.items, next]);
    expect(element.textContent).toContain(first.text);
    const progress = { ...next, text: 'Checking the next result' };
    update([...turn.items, progress]);
    expect(element.textContent).not.toContain(first.text);
    expect(element.textContent).toContain(progress.text);
    expect(element.querySelector('.tlog-current')).toBeNull();
    update([...turn.items, { ...progress, text: 'Checking the next result now' }, { ...command, id: 'later-command', status: 'running' }]);
    expect(element.textContent).toContain('Checking the next result now');
    expect(element.querySelectorAll('.tlog-current')).toHaveLength(1);
    expect(element.querySelector('.tlog-current [data-status="running"]')).not.toBeNull();
    expect(element.querySelector('.thread-execution-timeline')).toBeNull();
    expect(props.onLoadTurnDetail).not.toHaveBeenCalled();
  });

  it('keeps substantial answers between single-operation log rows as progress continues', () => {
    const answer = { id: 'answer', kind: 'agentMessage' as const, text: '## Public-key identity\n\n' + '设备独立验证签名，私钥保存在用户手中。'.repeat(40), status: 'completed' };
    const command = (id: string) => ({ id, kind: 'commandExecution' as const, text: `hidden-${id}`, status: 'completed' });
    const initial = { ...completedTurn([
      { id: 'prompt', kind: 'userMessage' as const, text: 'Explain and implement' },
      command('before'), answer, command('after'),
    ]), status: 'inProgress' as const };
    const props = { liveOutput: '', autoCollapseCompletedTurns: false, threadRunning: true, activeTurnId: initial.id, onLoadTurnDetail: vi.fn() };
    const element = render(<ThreadTimeline {...props} turns={[initial]} />);
    expect(element.textContent).toContain('Public-key identity');
    expect(element.querySelector('.thread-worked-toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect(element.querySelector('[data-message-id="answer"]')).not.toBeNull();
    expect(element.querySelectorAll('.tlog-single')[0]?.textContent).toContain('hidden-before');
    expect(element.querySelectorAll('.tlog-single')[1]?.textContent).toContain('hidden-after');
    expect(element.querySelector('.tlog-current')).toBeNull();
    const progress = { id: 'progress', kind: 'agentMessage' as const, text: 'Running the integration checks', status: 'running' };
    const updated = { ...initial, items: [...initial.items, progress] };
    flushSync(() => root?.render(<ThreadTimeline {...props} turns={[updated]} />));
    expect(element.textContent).toContain('Public-key identity');
    expect(element.textContent).toContain(progress.text);
    expect(element.querySelectorAll('[data-message-id="answer"], [data-message-id="progress"]')).toHaveLength(2);
    // A single operation shows its title immediately, with details still closed.
    expect(element.querySelectorAll('.tlog-single .tlog-row-head[aria-expanded="false"]')).toHaveLength(2);
    expect(element.textContent).toContain('hidden-after');
    expect(element.querySelectorAll('.tlog-single')[0]?.textContent).toContain('hidden-before');
    const sections = [...element.querySelector('.thread-execution-timeline')!.children];
    expect(sections[1]!.textContent).toContain('Public-key identity');
    expect(sections[2]!.textContent).toContain('hidden-after');
    expect(props.onLoadTurnDetail).not.toHaveBeenCalled();
    flushSync(() => root?.render(<ThreadTimeline {...props} threadRunning={false} activeTurnId={null} turns={[{
      ...updated, status: 'completed', items: [...updated.items, { id: 'final', kind: 'agentMessage', text: 'Implementation complete', responsePhase: 'final' }],
    }]} />));
    expect(element.textContent).toContain('Public-key identity');
    expect(element.textContent).toContain('Implementation complete');
    // Terminal rendering returns to the expanded chronological log.
    expect(element.querySelector('.thread-turn-head')).not.toBeNull();
    expect(element.querySelectorAll('.tlog-single')).toHaveLength(2);
  });

  it('shows preserved long answers in a lazy summary without loading command histories', () => {
    const answer = { id: 'answer', kind: 'agentMessage' as const, text: 'Long answer. '.repeat(60) };
    const load = vi.fn();
    const element = render(<ThreadTimeline liveOutput="" onLoadTurnDetail={load} autoCollapseCompletedTurns turns={[{
      ...completedTurn([answer, { id: 'last', kind: 'agentMessage', text: 'Done', responsePhase: 'final' }]),
      hasDeferredItems: true, deferredItemCount: 20,
    }]} />);
    expect(element.textContent).toContain('Long answer.');
    expect(element.textContent).toContain('Done');
    // Earlier answers stay in sequence; the final one has its own place after it.
    expect(element.querySelectorAll('.thread-answer-section')).toHaveLength(1);
    expect(element.querySelector('.thread-answer-sequence')?.nextElementSibling?.textContent).toContain('Done');
    expect(load).not.toHaveBeenCalled();
  });

  it('keeps the final status when a collapsed turn has cached running details', async () => {
    const summary: ThreadTurnDto = {
      ...completedTurn([
        { id: 'prompt', kind: 'userMessage', text: 'Check status' },
        { id: 'reply', kind: 'agentMessage', text: 'Checking' },
      ]), status: 'inProgress', hasDeferredItems: true, deferredItemCount: 1,
    };
    const onLoadTurnDetail = vi.fn().mockResolvedValue({ ...summary,
      hasDeferredItems: false, deferredItemCount: 0,
      items: [summary.items[0]!, { id: 'command', kind: 'commandExecution', text: 'read report', status: 'completed' }, summary.items[1]!],
    });
    const props = { liveOutput: '', onLoadTurnDetail };
    const element = render(<ThreadTimeline {...props} threadRunning activeTurnId="turn-1" turns={[summary]} />);
    await vi.waitFor(() => expect(onLoadTurnDetail).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(element.querySelector('[aria-label*="Collapse turn 1"]')).not.toBeNull());
    flushSync(() => element.querySelector<HTMLButtonElement>('[aria-label*="Collapse turn 1"]')!.click());
    flushSync(() => root?.render(<ThreadTimeline {...props} threadRunning={false} activeTurnId={null} turns={[{
      ...summary, status: 'completed', completedAt: '2026-07-03T20:12:11Z',
      model: 'final-model', items: [summary.items[0]!, { ...summary.items[1]!, text: 'Finished' }],
    }]} />));
    expect(element.querySelector('.thread-graph-worked-label')?.textContent).toBe('Worked for 1m 12s');
    expect(element.querySelector('.thread-graph-turn-footer')).toBeNull();
    expect(element.textContent).toContain('Finished');
    expect(element.textContent).toContain('final-model');
    expect(element.querySelector('.thread-graph-worked-summary .tlog-count[data-kind=commands]')?.getAttribute('aria-label')).toBe('1 command');
    expect(onLoadTurnDetail).toHaveBeenCalledTimes(1);
  });

  it.each(['completed', 'failed', 'interrupted'] as const)('stops showing live activity after a turn is %s', (status) => {
    const operation = { id: 'command', kind: 'commandExecution' as const, text: 'read report', status: 'completed' };
    const turn = { ...completedTurn([{ id: 'prompt', kind: 'userMessage' as const, text: 'Check' }, operation,
      { id: 'reply', kind: 'agentMessage' as const, text: 'Finished' }]), status: 'inProgress' as const };
    const props = { liveOutput: '', autoCollapseCompletedTurns: false,
      liveItems: { turnId: turn.id, items: [operation] },
      livePlan: { turnId: turn.id, explanation: null, plan: [{ step: 'Read report', status: 'completed' as const }] },
    };
    const element = render(<ThreadTimeline {...props} threadRunning activeTurnId={turn.id} turns={[turn]} />);
    expect(element.querySelector('.thread-graph-worked-label')?.textContent).toBe('Working');
    expect(element.querySelector('.thread-graph-turn-footer')).not.toBeNull();
    flushSync(() => root?.render(<ThreadTimeline {...props} threadRunning={false} activeTurnId={null}
      turns={[{ ...turn, status, completedAt: '2026-07-03T20:12:11Z' }]} />));
    expect(element.querySelector('.thread-graph-worked-label')?.textContent).toBe('Worked for 1m 12s');
    expect(element.querySelector('.thread-graph-turn-footer')).toBeNull();
    expect(element.textContent).toContain('Finished');
  });

  it('uses hydrated deferred flags so an empty expansion cannot show a stale step count', async () => {
    const summary: ThreadTurnDto = {
      ...completedTurn([
        { id: 'prompt', kind: 'userMessage', text: 'Prompt' },
        { id: 'answer', kind: 'agentMessage', text: 'Answer' },
      ]),
      hasDeferredItems: true,
      deferredItemCount: 7,
    };
    const hydrated = {
      ...summary,
      hasDeferredItems: false,
      deferredItemCount: 0,
    };
    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns={false}
        liveOutput=""
        onLoadTurnDetail={vi.fn().mockResolvedValue(hydrated)}
        turns={[summary]}
      />,
    );

    const expand = Array.from(element.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label')?.includes('Expand turn 1'),
    );
    flushSync(() => expand?.click());
    await vi.waitFor(() => {
      expect(element.textContent).not.toContain('7 steps');
    });
    expect(element.textContent).toContain('Worked');
  });

  it('shows Worked when reasoning is the collapsed middle agent bubble', () => {
    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns={true}
        liveOutput=""
        turns={[
          completedTurn([
            {
              id: 'user-1',
              kind: 'userMessage',
              text: 'reply me a 3',
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 10, 59),
              ).toISOString(),
            },
            {
              id: 'reasoning-1',
              kind: 'reasoning',
              text: 'The user asked for the exact number 3.',
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 10, 59),
              ).toISOString(),
            },
            {
              id: 'agent-1',
              kind: 'agentMessage',
              text: '3',
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 10, 59),
              ).toISOString(),
            },
          ]),
        ]}
      />,
    );

    expect(element.textContent).toContain('reply me a 3');
    expect(element.textContent).toContain('3');
    expect(element.textContent).toContain('Worked');
    expect(element.textContent).not.toContain(
      'The user asked for the exact number 3.',
    );
    expect(
      Array.from(element.querySelectorAll('button')).some((button) =>
        button.getAttribute('aria-label')?.includes('Expand turn 1'),
      ),
    ).toBe(true);
  });

  it.each([true, false])("follows the host's auto-collapse setting when no prop overrides it (host %s)", (hostSetting) => {
    // No Workbench preference may override the host: the host's choice decides.
    shellSettings.autoCollapseCompletedTurns = hostSetting;
    const element = render(
      <ThreadTimeline
        liveOutput=""
        turns={[
          completedTurn([
            { id: 'user-1', kind: 'userMessage', text: 'reply me a 3', createdAt: new Date(Date.UTC(2026, 6, 3, 20, 10, 59)).toISOString() },
            { id: 'reasoning-1', kind: 'reasoning', text: 'The user asked for the exact number 3.', createdAt: new Date(Date.UTC(2026, 6, 3, 20, 10, 59)).toISOString() },
            { id: 'agent-1', kind: 'agentMessage', text: '3', createdAt: new Date(Date.UTC(2026, 6, 3, 20, 10, 59)).toISOString() },
          ]),
        ]}
      />,
    );
    const collapsed = Array.from(element.querySelectorAll('button')).some((button) =>
      button.getAttribute('aria-label')?.includes('Expand turn 1'));
    expect(collapsed).toBe(hostSetting);
    if (hostSetting) expect(element.textContent).not.toContain('The user asked for the exact number 3.');
  });

  it('shows Worked when an actual middle message bubble is collapsed', () => {
    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns={true}
        liveOutput=""
        turns={[
          completedTurn([
            {
              id: 'user-1',
              kind: 'userMessage',
              text: 'Keep prompt visible.',
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 10, 0),
              ).toISOString(),
            },
            {
              id: 'agent-intermediate-1',
              kind: 'agentMessage',
              text: 'Intermediate note should collapse.',
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 10, 20),
              ).toISOString(),
            },
            {
              id: 'agent-1',
              kind: 'agentMessage',
              text: 'Final reply stays visible.',
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 11, 21),
              ).toISOString(),
            },
          ]),
        ]}
      />,
    );

    expect(element.textContent).toContain('Keep prompt visible.');
    expect(element.textContent).toContain('Final reply stays visible.');
    expect(element.textContent).toContain('Worked');
    expect(element.textContent).not.toContain(
      'Intermediate note should collapse.',
    );
  });

  it('keeps the Worked control available after expanding so the turn can collapse again', () => {
    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns={true}
        liveOutput=""
        turns={[
          completedTurn([
            {
              id: 'user-1',
              kind: 'userMessage',
              text: 'Keep prompt visible.',
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 10, 0),
              ).toISOString(),
            },
            {
              id: 'agent-intermediate-1',
              kind: 'agentMessage',
              text: 'Intermediate note can be toggled.',
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 10, 20),
              ).toISOString(),
            },
            {
              id: 'agent-1',
              kind: 'agentMessage',
              text: 'Final reply stays visible.',
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 11, 21),
              ).toISOString(),
            },
          ]),
        ]}
      />,
    );

    const expandWorkedButton = Array.from(
      element.querySelectorAll('button'),
    ).find((button) =>
      button.getAttribute('aria-label')?.includes('Expand turn 1'),
    );
    expect(expandWorkedButton).toBeTruthy();
    flushSync(() => {
      expandWorkedButton?.click();
    });

    expect(element.textContent).toContain('Intermediate note can be toggled.');
    const collapseWorkedButton = Array.from(
      element.querySelectorAll('button'),
    ).find(
      (button) =>
        button.getAttribute('aria-label')?.includes('Collapse turn 1') &&
        button.textContent?.includes('Worked'),
    );
    expect(collapseWorkedButton?.textContent).toContain('Worked');

    flushSync(() => {
      collapseWorkedButton?.click();
    });

    expect(element.textContent).toContain('Worked');
    expect(element.textContent).not.toContain(
      'Intermediate note can be toggled.',
    );
  });

  const foldTurn = () => completedTurn([
    { id: 'user-1', kind: 'userMessage', text: 'Keep prompt visible.', createdAt: new Date(Date.UTC(2026, 6, 3, 20, 10, 0)).toISOString() },
    { id: 'agent-intermediate-1', kind: 'agentMessage', text: 'Intermediate note can be toggled.', createdAt: new Date(Date.UTC(2026, 6, 3, 20, 10, 20)).toISOString() },
    { id: 'agent-1', kind: 'agentMessage', text: 'Final reply stays visible.', createdAt: new Date(Date.UTC(2026, 6, 3, 20, 11, 21)).toISOString() },
  ]);
  const workToggle = (element: HTMLElement) => element.querySelector<HTMLButtonElement>('.thread-worked-toggle')!;

  it('keeps a reader\'s folds when the timeline mounts again, per thread', () => {
    let element = render(<ThreadTimeline threadId="fold-a" autoCollapseCompletedTurns liveOutput="" turns={[foldTurn()]} />);
    flushSync(() => workToggle(element).click());
    expect(element.textContent).toContain('Intermediate note can be toggled.');
    flushSync(() => root?.unmount());
    container?.remove();
    element = render(<ThreadTimeline threadId="fold-a" autoCollapseCompletedTurns liveOutput="" turns={[foldTurn()]} />);
    expect(workToggle(element).getAttribute('aria-expanded')).toBe('true');
    // Another thread with the same turn ids starts from its defaults.
    flushSync(() => root?.render(<ThreadTimeline threadId="fold-b" autoCollapseCompletedTurns liveOutput="" turns={[foldTurn()]} />));
    expect(workToggle(element).getAttribute('aria-expanded')).toBe('false');
  });

  it('opens a search result once, so folding it again sticks while turns refresh', async () => {
    // Revealing the result scrolls to it and flashes it.
    Object.assign(HTMLElement.prototype, {
      scrollTo: HTMLElement.prototype.scrollTo ?? (() => {}),
      animate: HTMLElement.prototype.animate ?? (() => ({})),
    });
    const target = { turnId: 'turn-1', itemId: 'agent-intermediate-1', key: 7 };
    const element = render(<ThreadTimeline threadId="fold-search" autoCollapseCompletedTurns liveOutput="" turns={[foldTurn()]} searchTarget={target} />);
    await vi.waitFor(() => expect(workToggle(element).getAttribute('aria-expanded')).toBe('true'));
    flushSync(() => workToggle(element).click());
    expect(workToggle(element).getAttribute('aria-expanded')).toBe('false');
    // A running thread refreshes its turns every few seconds.
    for (let i = 0; i < 3; i++) {
      flushSync(() => root?.render(<ThreadTimeline threadId="fold-search" autoCollapseCompletedTurns liveOutput="" turns={[foldTurn()]} searchTarget={target} />));
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect(workToggle(element).getAttribute('aria-expanded')).toBe('false');
    // A new search opens it again.
    flushSync(() => root?.render(<ThreadTimeline threadId="fold-search" autoCollapseCompletedTurns liveOutput="" turns={[foldTurn()]} searchTarget={{ ...target, key: 8 }} />));
    await vi.waitFor(() => expect(workToggle(element).getAttribute('aria-expanded')).toBe('true'));
  });

  it('keeps message timestamps in hover titles and omits visible time labels', () => {
    const startedAt = new Date(Date.UTC(2026, 6, 3, 20, 10, 0)).toISOString();
    const agentAt = new Date(Date.UTC(2026, 6, 3, 20, 11, 21)).toISOString();
    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns={false}
        liveOutput=""
        turns={[
          {
            ...completedTurn([
              {
                id: 'user-1',
                kind: 'userMessage',
                text: 'Inspect.',
                createdAt: startedAt,
              },
              {
                id: 'command-1',
                kind: 'commandExecution',
                text: 'pwd',
                createdAt: new Date(
                  Date.UTC(2026, 6, 3, 20, 10, 5),
                ).toISOString(),
                status: 'completed',
              },
              {
                id: 'agent-1',
                kind: 'agentMessage',
                text: 'Done.',
                createdAt: agentAt,
              },
            ]),
            startedAt,
          },
        ]}
      />,
    );

    expect(element.querySelector('.tlog-row')?.textContent).not.toContain('5s');
    expect(element.querySelector('.thread-graph-message-time-row')).toBeNull();
    for (const [id, timestamp] of [['agent-1', agentAt], ['user-1', startedAt]] as const) {
      const message = element.querySelector(`[data-message-id="${id}"]`)!;
      const titles = [message, ...message.querySelectorAll('[title]')].map(node => node.getAttribute('title'));
      expect(titles, id).toContain(formatLongTimestamp(timestamp));
    }

  });

  it('shows a step offset only when the step has its own time, never a made-up 0s (ELA-257 048f)', () => {
    const startedAt = new Date(Date.UTC(2026, 9, 22, 21, 0, 0)).toISOString();
    const artifact = (id: string, createdAt?: string) => ({
      id, kind: 'artifact' as const, text: `${id}.xyz`, ...(createdAt ? { createdAt } : {}),
      artifact: { id, pluginId: 'elagente', type: 'chem.structure', title: `${id}.xyz`, payload: {}, createdAt: startedAt },
    });
    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns={false}
        liveOutput=""
        turns={[{
          ...completedTurn([
            { id: 'user-1', kind: 'userMessage', text: 'Run the campaign.' },
            artifact('stamped', new Date(Date.UTC(2026, 9, 22, 21, 1, 30)).toISOString()),
            // Recorded before items were stamped (ELA-253): no time of its own.
            artifact('legacy'),
          ]),
          startedAt,
        }] as never}
      />,
    );
    const timeOf = (title: string) => [...element.querySelectorAll('.thread-graph-event-artifact')]
      .find(node => node.textContent?.includes(title))?.querySelector('.thread-graph-relative-time')?.textContent ?? null;
    expect(timeOf('stamped.xyz')).toBe('1m 30s');
    expect(timeOf('legacy.xyz')).toBeNull();
  });

  it('shows the latest activity time and a second-precision running duration', () => {
    vi.useFakeTimers();
    const startedAt = new Date(Date.UTC(2026, 6, 3, 20, 10, 0)).toISOString();
    const activityAt = new Date(Date.UTC(2026, 6, 3, 20, 10, 7)).toISOString();
    vi.setSystemTime(new Date(Date.UTC(2026, 6, 3, 20, 10, 10)));

    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns={false}
        activeTurnId="turn-1"
        threadRunning
        liveOutput=""
        liveItems={{
          turnId: 'turn-1',
          updatedAt: activityAt,
          items: [
            {
              id: 'command-1',
              kind: 'commandExecution',
              text: 'pnpm test',
              status: 'running',
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 10, 5),
              ).toISOString(),
            },
          ],
        }}
        turns={[
          {
            id: 'turn-1',
            startedAt,
            status: 'inProgress',
            error: null,
            items: [],
          },
        ]}
      />,
    );

    expect(element.querySelector('.thread-progress-indicator')?.getAttribute('aria-label')).toContain(formatLongTimestamp(activityAt));
    expect(element.textContent).toContain('10s');

    flushSync(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(element.textContent).toContain('11s');
  });

  it('uses the completion time and labels an interrupted turn', () => {
    const startedAt = new Date(Date.UTC(2026, 6, 3, 20, 10, 0)).toISOString();
    const completedAt = new Date(
      Date.UTC(2026, 6, 3, 20, 22, 30),
    ).toISOString();
    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns
        liveOutput=""
        turns={[
          {
            id: 'turn-1',
            startedAt,
            completedAt,
            status: 'interrupted',
            error: null,
            items: [
              {
                id: 'user-1',
                kind: 'userMessage',
                text: 'Run the long task.',
                createdAt: startedAt,
              },
            ],
          },
        ]}
      />,
    );

    expect(element.textContent).toContain('Worked for 12m 30s');
    expect(element.textContent).toContain('Interrupted');
  });

  it('keeps operations collapsed in the workbench while assistant prose stays visible', () => {
    const element = render(
      <WorkbenchContext.Provider value={true}><ThreadTimeline
        autoCollapseCompletedTurns={false}
        liveOutput=""
        turns={[
          completedTurn([
            ...['pwd', 'pnpm test', 'git status'].map((text, index) => ({
              id: `command-${index + 1}`,
              kind: 'commandExecution' as const,
              text,
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 10, index + 1),
              ).toISOString(),
              status: 'completed',
            })),
            {
              id: 'agent-1',
              kind: 'agentMessage',
              text: 'All commands completed.',
              createdAt: new Date(
                Date.UTC(2026, 6, 3, 20, 10, 5),
              ).toISOString(),
            },
          ]),
        ]}
      /></WorkbenchContext.Provider>,
    );

    expect(element.querySelector('.thread-graph-history-group-activity')).toBeNull();
    const commands = element.querySelector('.tlog-run')!;
    expect(commands.querySelector('.tlog-part.is-time')?.textContent?.replace(/\s*·\s*/g, ' · ').trim()).toBe('· 2s');
    expect(commands.querySelector('.tlog-count[data-kind=commands]')?.getAttribute('aria-label')).toBe('3 commands');
    expect(element.textContent).not.toContain('pnpm test');
    expect(element.textContent).not.toContain('Agent activity');
    expect(element.textContent).not.toContain('Batch');
    expect(element.textContent).toContain('All commands completed.');
  });

  it('folds imported reasoning summaries into activity and omits empty assistant rows', () => {
    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns={false}
        liveOutput=""
        turns={[
          completedTurn([
            {
              id: 'agent-before',
              kind: 'agentMessage',
              text: 'The first finding is ready.',
            },
            {
              id: 'reasoning-1',
              kind: 'reasoning',
              text: '**Planning concurrent browser inspection**',
            },
            {
              id: 'reasoning-empty',
              kind: 'reasoning',
              text: '  ',
            },
            {
              id: 'command-1',
              kind: 'commandExecution',
              text: 'pnpm test',
              status: 'completed',
            },
            {
              id: 'reasoning-2',
              kind: 'reasoning',
              text: '**Checking item timestamps, statuses, and duplicates**',
            },
            {
              id: 'agent-after',
              kind: 'agentMessage',
              text: 'The imported session now reads cleanly.',
            },
          ]),
        ]}
      />,
    );

    expect(element.textContent).toContain('The first finding is ready.');
    expect(element.textContent).not.toContain('Performed');
    expect(element.querySelector('.thread-graph-worked-summary .tlog-count[data-kind=commands]')?.getAttribute('aria-label')).toBe('1 command');
    expect(element.textContent).toContain(
      'The imported session now reads cleanly.',
    );
    expect(element.textContent).not.toContain(
      'Planning concurrent browser inspection',
    );
    expect(
      Array.from(element.querySelectorAll('[data-role="assistant"]')),
    ).toHaveLength(2);

    const expandButton = Array.from(element.querySelectorAll('button')).find(
      (button) => button.classList.contains('tlog-run-head'),
    );
    expect(expandButton).toBeTruthy();
    flushSync(() => {
      expandButton?.click();
    });
    expect(element.textContent).toContain(
      'Planning concurrent browser inspection',
    );
    expect(element.textContent).toContain(
      'Checking item timestamps, statuses, and duplicates',
    );
  });

  it('preserves run and row expansion choices as live entries arrive', () => {
    const activeTurn: ThreadTurnDto = {
      ...completedTurn([]),
      status: 'inProgress',
    };
    const initialItems: ThreadTurnDto['items'] = [
      { id: 'reason-1', kind: 'reasoning', text: 'Inspecting the first issue.' },
      { id: 'command-1', kind: 'commandExecution', text: 'pwd', status: 'completed' },
      { id: 'command-2', kind: 'commandExecution', text: 'git status', status: 'running' },
    ];
    const timeline = (items: ThreadTurnDto['items']) => (
      <ThreadTimeline
        autoCollapseCompletedTurns={false}
        activeTurnId={activeTurn.id}
        threadRunning
        liveOutput=""
        liveItems={{ turnId: activeTurn.id, items, updatedAt: activeTurn.startedAt }}
        turns={[activeTurn]}
      />
    );
    const element = render(timeline(initialItems));
    const activityToggle = () => element.querySelector<HTMLButtonElement>(
      '.tlog-run-head',
    );
    const commandToggle = () => element.querySelector<HTMLButtonElement>(
      '.tlog-row[data-kind="commandExecution"] .tlog-row-head',
    );

    // The last run with a running operation starts open.
    expect(activityToggle()?.getAttribute('aria-expanded')).toBe('true');
    flushSync(() => commandToggle()?.click());
    expect(activityToggle()?.getAttribute('aria-expanded')).toBe('true');
    expect(commandToggle()?.getAttribute('aria-expanded')).toBe('true');

    const nextItems: ThreadTurnDto['items'] = [
      ...initialItems,
      { id: 'command-3', kind: 'commandExecution', text: 'pnpm test', status: 'running' },
      { id: 'reason-2', kind: 'reasoning', text: 'Reviewing the new result.' },
    ];
    flushSync(() => root?.render(timeline(nextItems)));
    expect(activityToggle()?.getAttribute('aria-expanded')).toBe('true');
    expect(commandToggle()?.getAttribute('aria-expanded')).toBe('true');
    expect(element.textContent).toContain('Inspecting the first issue.');
    expect(element.textContent).toContain('Reviewing the new result.');
    expect(element.querySelectorAll('.tlog-row[data-kind="commandExecution"]')[2]?.textContent)
      .toContain('pnpm test');

    flushSync(() => activityToggle()?.click());
    flushSync(() => root?.render(timeline([
      ...nextItems,
      { id: 'reason-3', kind: 'reasoning', text: 'Preparing the next step.' },
    ])));
    expect(activityToggle()?.getAttribute('aria-expanded')).toBe('false');
    expect(element.textContent).not.toContain('Preparing the next step.');
    flushSync(() => activityToggle()?.click());
    expect(element.textContent).toContain('Preparing the next step.');
    expect(activityToggle()?.getAttribute('aria-expanded')).toBe('true');
    expect(element.querySelectorAll('.tlog-row[data-kind="commandExecution"]')).toHaveLength(3);
  });

  it('shows file paths directly without opening a summary or details pane', () => {
    const startedAt = new Date(Date.UTC(2026, 6, 3, 20, 10, 0)).toISOString();
    const fileReadAt = new Date(Date.UTC(2026, 6, 3, 20, 10, 5)).toISOString();
    const laterAgentAt = new Date(
      Date.UTC(2026, 6, 3, 20, 10, 8),
    ).toISOString();
    const activeTurn: ThreadTurnDto = {
      ...completedTurn([
        {
          id: 'user-1',
          kind: 'userMessage',
          text: 'Inspect the source.',
          createdAt: startedAt,
        },
        {
          id: 'file-read-1',
          kind: 'fileRead',
          text: 'Read file: src/agent-runtime.ts',
          previewText: 'Read file: src/agent-runtime.ts',
          createdAt: fileReadAt,
          status: 'running',
        },
      ]),
      startedAt,
      status: 'inProgress',
    };
    const element = render(
      <ThreadTimeline
        autoCollapseCompletedTurns={false}
        liveOutput=""
        turns={[activeTurn]}
      />,
    );

    expect(element.textContent).toContain('Read');
    expect(element.textContent).toContain('Read file: src/agent-runtime.ts');
    expect(
      element.querySelector('.tlog-row[data-kind="fileRead"] .tlog-row-head')
        ?.getAttribute('aria-expanded'),
    ).toBe('false');

    flushSync(() => {
      root?.render(
        <ThreadTimeline
          autoCollapseCompletedTurns={false}
          liveOutput=""
          turns={[
            {
              ...activeTurn,
              items: [
                ...activeTurn.items.map((item) =>
                  item.id === 'file-read-1'
                    ? { ...item, status: 'completed' }
                    : item,
                ),
                {
                  id: 'agent-1',
                  kind: 'agentMessage',
                  text: 'I found the next step.',
                  createdAt: laterAgentAt,
                },
              ],
            },
          ]}
        />,
      );
    });

    expect(element.textContent).toContain('Read');
    expect(
      element.querySelector('.tlog-row[data-kind="fileRead"] .tlog-row-head')
        ?.getAttribute('aria-expanded'),
    ).toBe('false');
    expect(element.textContent).toContain('I found the next step.');
  });

  it('advances across turns on repeated clicks while smooth scrolling is pending', () => {
    const turns = [1, 2, 3].map((index) => ({
      ...completedTurn([
        {
          id: `user-${index}`,
          kind: 'userMessage' as const,
          text: `Prompt ${index}`,
        },
      ]),
      id: `turn-${index}`,
    }));
    const element = render(
      <ThreadTimeline
        liveOutput=""
        turns={turns}
        nextTurnScrollRequestKey={0}
      />,
    );
    const scrollContainer = element.querySelector<HTMLElement>(
      '[data-testid="thread-scroll-container"]',
    )!;
    // A container that does not move: writes (the hook's own scrolls) are ignored.
    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      get: () => 0,
      set: () => {},
    });
    scrollContainer.getBoundingClientRect = () =>
      ({ top: 0, bottom: 300, height: 300 }) as DOMRect;
    const turnElements = Array.from(
      element.querySelectorAll<HTMLElement>('[data-timeline-turn]'),
    );
    turnElements.forEach((turn, index) => {
      turn.getBoundingClientRect = () =>
        ({
          top: index * 200,
          bottom: index * 200 + 100,
          height: 100,
        }) as DOMRect;
    });
    const scrollTo = vi.fn();
    scrollContainer.scrollTo = scrollTo;

    flushSync(() => {
      root?.render(
        <ThreadTimeline
          liveOutput=""
          turns={turns}
          nextTurnScrollRequestKey={1}
        />,
      );
    });
    flushSync(() => {
      root?.render(
        <ThreadTimeline
          liveOutput=""
          turns={turns}
          nextTurnScrollRequestKey={2}
        />,
      );
    });

    expect(scrollTo).toHaveBeenNthCalledWith(1, {
      top: 192,
      behavior: 'smooth',
    });
    expect(scrollTo).toHaveBeenNthCalledWith(2, {
      top: 392,
      behavior: 'smooth',
    });
  });

  it('moves backward across turns on repeated clicks while smooth scrolling is pending', () => {
    const turns = [1, 2, 3].map((index) => ({
      ...completedTurn([
        {
          id: `user-${index}`,
          kind: 'userMessage' as const,
          text: `Prompt ${index}`,
        },
      ]),
      id: `turn-${index}`,
    }));
    const element = render(
      <ThreadTimeline
        liveOutput=""
        turns={turns}
        previousTurnScrollRequestKey={0}
      />,
    );
    const scrollContainer = element.querySelector<HTMLElement>(
      '[data-testid="thread-scroll-container"]',
    )!;
    // A container that does not move: writes (the hook's own scrolls) are ignored.
    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      get: () => 600,
      set: () => {},
    });
    scrollContainer.getBoundingClientRect = () =>
      ({ top: 0, bottom: 300, height: 300 }) as DOMRect;
    const turnElements = Array.from(
      element.querySelectorAll<HTMLElement>('[data-timeline-turn]'),
    );
    turnElements.forEach((turn, index) => {
      turn.getBoundingClientRect = () =>
        ({
          top: -400 + index * 200,
          bottom: -300 + index * 200,
          height: 100,
        }) as DOMRect;
    });
    const scrollTo = vi.fn();
    scrollContainer.scrollTo = scrollTo;

    flushSync(() => {
      root?.render(
        <ThreadTimeline
          liveOutput=""
          turns={turns}
          previousTurnScrollRequestKey={1}
        />,
      );
    });
    flushSync(() => {
      root?.render(
        <ThreadTimeline
          liveOutput=""
          turns={turns}
          previousTurnScrollRequestKey={2}
        />,
      );
    });

    expect(scrollTo).toHaveBeenNthCalledWith(1, {
      top: 392,
      behavior: 'smooth',
    });
    expect(scrollTo).toHaveBeenNthCalledWith(2, {
      top: 192,
      behavior: 'smooth',
    });
  });
});

describe('an ended turn that recorded nothing', () => {
  it('opens to say nothing was recorded and why, instead of looking like closed work', () => {
    const turn: ThreadTurnDto = {
      id: 'turn-empty',
      startedAt: '2026-10-16T14:15:46.819Z',
      completedAt: '2026-10-16T17:21:46.819Z',
      status: 'interrupted',
      error: 'Backend completion was not confirmed before the Supervisor connection ended. Reconnect to verify before continuing.',
      items: [],
    };
    const element = render(<ThreadTimeline turns={[turn]} liveOutput="" />);
    const toggle = element.querySelector<HTMLButtonElement>('.thread-worked-toggle')!;
    expect(toggle.textContent).toContain('Worked for 3h 6m');
    expect(toggle.textContent).toContain('Interrupted');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    // The reason moves into the opened note rather than a faint line above.
    expect(element.querySelector('.thread-graph-turn-header + p')).toBeNull();
    flushSync(() => toggle.click());
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(element.querySelector('.thread-graph-turn-empty-note')?.textContent).toContain('Nothing was recorded in this turn.');
    expect(element.querySelector('.thread-graph-turn-empty-reason')?.textContent).toContain('Supervisor connection ended');
  });
});
