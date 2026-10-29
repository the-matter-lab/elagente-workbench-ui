/** @vitest-environment jsdom */
import { act } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type { ThreadTurnDto } from '@remote-codex/shared';
import { ThreadTimeline } from '../ThreadTimeline';
import { TurnStatusBar } from './turnStatus';
import { TurnUsageInline } from './TurnUsageInline';
import { shortModelName } from './TurnHead';
import { TurnModels } from './TurnModels';

const total = {
  totalTokens: 3500,
  inputTokens: 1500,
  outputTokens: 2000,
  cachedInputTokens: 500,
  reasoningOutputTokens: 800,
};
const turn: ThreadTurnDto = {
  id: 'turn-usage',
  startedAt: '2026-09-05T10:00:00.000Z',
  completedAt: '2026-09-05T10:01:12.000Z',
  status: 'completed',
  error: null,
  model: 'gpt-6-astra',
  reasoningEffort: 'high',
  tokenUsage: { total, last: total, modelContextWindow: 1050000, generationSpeed: {
    outputTokens: 2000, llmTimeMs: 20000, averageTokensPerSecond: 100,
    recentTokensPerSecond: 80, windowSeconds: 60, active: false, state: 'llm',
    measurement: 'usageIntervals', updatedAt: '2026-09-05T10:01:12.000Z',
  } },
  priceEstimate: {
    pricingModelKey: 'gpt-6-astra',
    pricingTierKey: 'standard',
    currency: 'USD',
    inputUsd: 0.01,
    cachedInputUsd: 0.0005,
    outputUsd: 0.1,
    totalUsd: 0.1105,
  },
  items: [
    { id: 'user-1', kind: 'userMessage', text: 'Check the fix.' },
    {
      id: 'command-1',
      kind: 'commandExecution',
      text: 'cargo test',
      status: 'completed',
    },
    { id: 'agent-1', kind: 'agentMessage', text: 'Fixed.' },
  ],
};

describe('TurnModels', () => {
  const render = (models?: { model: string; calls: number }[]) => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    flushSync(() => root.render(<TurnModels turn={{ ...turn, model: 'claude-sonnet-4-6', reasoningEffort: 'max', tokenUsage: { ...turn.tokenUsage!, ...(models ? { models } : {}) } } as never} />));
    return { host, done: () => { act(() => root.unmount()); host.remove(); } };
  };

  it('names the one model a turn ran with and its effort', () => {
    const view = render([{ model: 'claude-sonnet-4-6', calls: 4 }]);
    expect(view.host.textContent).toBe('sonnet 4.6 · max');
    expect(view.host.querySelector('button')).toBeNull();
    view.done();
  });

  it('shows a switch mid-turn as the models in the order they ran', () => {
    const view = render([{ model: 'claude-opus-4-7', calls: 12 }, { model: 'claude-sonnet-4-6', calls: 5 }]);
    const button = view.host.querySelector('button.thread-turn-head-models')!;
    expect(button.textContent).toBe('opus 4.7 → sonnet 4.6 · max');
    expect(button.getAttribute('aria-label')).toBe('Models this turn called: opus 4.7 → sonnet 4.6');
    view.done();
  });

  it('falls back to the turn model for turns recorded before the runs', () => {
    const view = render();
    expect(view.host.textContent).toBe('sonnet 4.6 · max');
    view.done();
  });
});

describe('shortModelName', () => {
  it('drops the vendor and a date stamp, and joins numbered parts into a version', () => {
    expect(shortModelName('claude-opus-5-5')).toBe('opus 5.5');
    expect(shortModelName('gpt-6-astra')).toBe('6 astra');
    expect(shortModelName('claude-sonnet-4-5-20250929')).toBe('sonnet 4.5');
    expect(shortModelName('gpt-6.1-sol')).toBe('6.1 sol');
    expect(shortModelName('opus[1m]')).toBe('opus[1m]');
  });
});

describe('turn usage in the visible timeline', () => {
  it.each([true, false])('keeps live usage only in the footer with recent speed (measured=%s)', measured => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const liveTurn: ThreadTurnDto = { ...turn, status: 'inProgress', completedAt: null, tokenUsage: { ...turn.tokenUsage!, generationSpeed: {
      ...turn.tokenUsage!.generationSpeed!, active: true,
      ...(measured ? { averageOutputTokensPerSecond: 120, latestOutputTokensPerSecond: 150, latestOutputTimeMs: 10000 } : {}),
    } } };
    try {
      flushSync(() => root.render(<ThreadTimeline turns={[liveTurn]} activeTurnId={turn.id} liveOutput="Working..." />));
      const summary = container.querySelector('.thread-graph-worked-summary [data-testid="turn-token-speed"]');
      const footer = container.querySelector('.thread-graph-turn-footer [data-testid="turn-token-speed"]');
      expect(summary).toBeNull();
      // The head pulses with the time so far and shows the speed of the model
      // calls already reported; with none reported yet it shows no speed.
      expect(container.querySelector('.thread-turn-head[data-active]')).not.toBeNull();
      expect(container.querySelector('.thread-turn-head-main')?.getAttribute('aria-label')).toMatch(/^running \d.*s$/);
      flushSync(() => container.querySelector<HTMLButtonElement>('.thread-turn-head-main')!.click());
      expect(container.querySelector('.thread-turn-head-speed')?.textContent ?? null).toBe(measured ? '120.0 tok/s' : null);
      expect(footer?.textContent).toBe(`${measured ? '150.0' : '80.0'}`);
    } finally { flushSync(() => root.unmount()); }
  });

  it('uses the trailing-minute speed live, rather than the completed whole-turn speed', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      flushSync(() => root.render(<TurnUsageInline turn={{...turn,status:'inProgress'}} />));
      expect(container.querySelector('[data-testid="turn-token-speed"]')?.textContent).toBe('80.0');
    } finally { flushSync(() => root.unmount()); }
  });
  it('uses the latest confirmed response speed without diluting it with pending reply time', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      flushSync(() => root.render(<TurnUsageInline turn={{...turn,status:'inProgress', tokenUsage:{...turn.tokenUsage!,generationSpeed:{...turn.tokenUsage!.generationSpeed!,
        latestOutputTokensPerSecond:150, latestOutputTimeMs:10000, latestOutputMeasuredAt:'2026-09-05T10:01:00Z'}}}} />));
      const speed = container.querySelector('[data-testid="turn-token-speed"]');
      expect(speed?.textContent).toBe('150.0');
      expect(speed?.getAttribute('title')).toContain('Latest confirmed response, 10 seconds');
      expect(speed?.getAttribute('title')).toContain('not on each text chunk');
    } finally { flushSync(() => root.unmount()); }
  });
  it('retains the full token breakdown behind the price button', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    try {
      flushSync(() => root.render(<TurnUsageInline turn={turn} />));
      flushSync(() => container.querySelector<HTMLButtonElement>('.thread-turn-usage-price')!.click());
      expect(document.querySelector('[aria-label="Uncached input: 1,000 tokens"]')).not.toBeNull();
      expect(document.querySelector('[aria-label="Cache read: 500 tokens"]')).not.toBeNull();
      expect(document.querySelector('[aria-label="Output: 1,200 tokens"]')).not.toBeNull();
      expect(document.querySelector('[aria-label="Reasoning: 800 tokens"]')).not.toBeNull();
    } finally { flushSync(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); }
  });
  it('opens on the first touch even when focus arrives before click, then closes on the next press', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    try {
      flushSync(() => root.render(<TurnUsageInline turn={turn} />));
      const button = container.querySelector<HTMLButtonElement>('.thread-turn-usage-price')!;
      flushSync(() => button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
      document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      flushSync(() => button.focus());
      expect(button.getAttribute('aria-expanded')).toBe('true');
      flushSync(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })));
      expect(button.getAttribute('aria-expanded')).toBe('true');
      flushSync(() => button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
      document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      flushSync(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })));
      expect(button.getAttribute('aria-expanded')).toBe('false');
    } finally { flushSync(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); }
  });
  it.each([true, false])(
    'opens the turn with its time, model, cost and speed above the prompt when collapsed=%s',
    (collapsed) => {
      const container = document.createElement('div');
      document.body.append(container);
      const root = createRoot(container);
      try {
        flushSync(() =>
          root.render(
            <ThreadTimeline
              turns={[turn]}
              liveOutput=""
              autoCollapseCompletedTurns={collapsed}
            />,
          ),
        );
        const summary = container.querySelector('.thread-graph-worked-summary');
        expect(summary?.textContent).toContain('Worked for 1m 12s');
        expect(summary?.querySelector('.thread-turn-usage')).toBeNull();
        expect(container.querySelector('.thread-turn-receipt')).toBeNull();
        const head = container.querySelector('.thread-turn-head')!;
        expect(head.compareDocumentPosition(container.querySelector('[data-role="user"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        // Closed, the head holds only the time worked and the cost.
        expect(head.querySelector('.thread-turn-head-took')?.textContent).toBe('1m 12s');
        expect(head.querySelector('.thread-turn-usage-price')?.textContent).toBe('$0.11');
        expect(head.textContent).not.toContain('astra');
        expect(head.querySelector('button button')).toBeNull();
        expect(container.querySelector('.thread-turn-head-more')).toBeNull();
        // Tapping it opens one more line: start time, model, speed.
        const main = head.querySelector<HTMLButtonElement>('.thread-turn-head-main')!;
        expect(main.getAttribute('aria-expanded')).toBe('false');
        flushSync(() => main.click());
        expect(main.getAttribute('aria-expanded')).toBe('true');
        const more = container.querySelector('.thread-turn-head-more')!;
        expect(more.querySelector('time')?.getAttribute('dateTime')).toBe(turn.startedAt);
        expect(more.querySelector('.thread-turn-head-model')?.textContent).toBe('6 astra · high');
        expect(more.querySelector('.thread-turn-head-speed')?.textContent).toBe('100.0 tok/s');
        // The date is visible by default; tapping still offers a compact clock.
        const time = more.querySelector<HTMLButtonElement>('.thread-turn-head-time')!;
        const withDate = time.textContent;
        expect(time.getAttribute('aria-pressed')).toBe('true');
        flushSync(() => time.click());
        expect(time.textContent).not.toBe(withDate);
        expect(withDate).toContain(time.textContent!);
        expect(time.getAttribute('aria-pressed')).toBe('false');
      } finally {
        flushSync(() => root.unmount());
        container.remove();
      }
    },
  );

  it('shows the whole head on one line on a wide screen', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(min-width: 640px)', addEventListener() {}, removeEventListener() {} }));
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      flushSync(() => root.render(<ThreadTimeline turns={[turn]} liveOutput="" />));
      const head = container.querySelector('.thread-turn-head.is-wide')!;
      expect(head.querySelector('.thread-turn-head-took')?.textContent).toBe('1m 12s');
      expect(head.querySelector('.thread-turn-usage-price')?.textContent).toBe('$0.11');
      expect(head.querySelector('.thread-turn-head-model')?.textContent).toBe('6 astra · high');
      expect(head.querySelector('.thread-turn-head-speed')?.textContent).toBe('100.0 tok/s');
      expect(head.querySelector('[aria-expanded]:not(.thread-turn-head-speed):not(.thread-turn-usage-price)')).toBeNull();
    } finally { flushSync(() => root.unmount()); vi.unstubAllGlobals(); }
  });

  it('breaks the combined speed into first token, prefill and decode when tapped', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const split: ThreadTurnDto = { ...turn, tokenUsage: { ...turn.tokenUsage!, generationSpeed: {
      ...turn.tokenUsage!.generationSpeed!, averageOutputTokensPerSecond: 100, outputTimeMs: 20000,
      splitMethod: 'streamedRequests', llmRequests: 5, firstTokenMs: 1500, firstTokenRequests: 2, burstRequests: 3,
      prefillTokens: 5000, prefillCachedTokens: 18000, prefillTokensPerSecond: 1666.7,
      decodeTokens: 1800, decodeMs: 12000, decodeTokensPerSecond: 150,
    } } };
    try {
      flushSync(() => root.render(<ThreadTimeline turns={[split]} liveOutput="" />));
      flushSync(() => container.querySelector<HTMLButtonElement>('.thread-turn-head-main')!.click());
      const speed = container.querySelector<HTMLButtonElement>('button.thread-turn-head-speed')!;
      expect(speed.textContent).toBe('100.0 tok/s');
      await act(async () => speed.click());
      const details = document.querySelector('.thread-speed-details')!;
      expect(details.textContent).toContain('Model calls5 calls');
      expect(details.textContent).toContain('First token');
      expect(details.textContent).toContain('1.5 s average · 2 requests');
      expect(details.textContent).toContain('Prefill');
      expect(details.textContent).toContain('1,667 tok/s · 5k uncached');
      expect(details.textContent).toContain('Decode');
      expect(details.textContent).toContain('150.0 tok/s · 1.8k in 12 s');
      expect(details.textContent).toContain('3 requests that arrived in one piece are left out.');
    } finally { flushSync(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); }
  });

  it("says a running turn's speed and call count are so far", async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const live: ThreadTurnDto = { ...turn, status: 'inProgress', completedAt: null, tokenUsage: { ...turn.tokenUsage!, generationSpeed: {
      ...turn.tokenUsage!.generationSpeed!, active: true, averageOutputTokensPerSecond: 90, outputTimeMs: 10000,
      splitMethod: 'streamedRequests', llmRequests: 3,
    } } };
    try {
      flushSync(() => root.render(<ThreadTimeline turns={[live]} activeTurnId={turn.id} liveOutput="Working..." />));
      flushSync(() => container.querySelector<HTMLButtonElement>('.thread-turn-head-main')!.click());
      const speed = container.querySelector<HTMLButtonElement>('button.thread-turn-head-speed')!;
      expect(speed.textContent).toBe('90.0 tok/s');
      await act(async () => speed.click());
      const details = document.querySelector('.thread-speed-details')!;
      expect(details.textContent).toContain('Combined output speed so far');
      expect(details.textContent).toContain('Model calls3 calls');
      expect(details.textContent).toContain('the call count includes the one in progress');
    } finally { flushSync(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); }
  });

  it('does not split speeds measured before replies that arrive in one piece were told apart', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const old: ThreadTurnDto = { ...turn, tokenUsage: { ...turn.tokenUsage!, generationSpeed: {
      ...turn.tokenUsage!.generationSpeed!, averageOutputTokensPerSecond: 146.7, outputTimeMs: 161000,
      firstTokenMs: 6011, firstTokenRequests: 14, prefillTokens: 19223, prefillTokensPerSecond: 228.4,
      decodeTokens: 13018, decodeMs: 750, decodeTokensPerSecond: 17357,
    } } };
    try {
      flushSync(() => root.render(<ThreadTimeline turns={[old]} liveOutput="" />));
      flushSync(() => container.querySelector<HTMLButtonElement>('.thread-turn-head-main')!.click());
      await act(async () => container.querySelector<HTMLButtonElement>('button.thread-turn-head-speed')!.click());
      const details = document.querySelector('.thread-speed-details')!;
      expect(details.textContent).not.toContain('Decode');
      expect(details.textContent).toContain('only the combined speed is known');
    } finally { flushSync(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); }
  });

  it.each(['failed', 'interrupted'] as const)('opens %s turns with the same head', status => {
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      flushSync(() => root.render(<ThreadTimeline turns={[{ ...turn, status }]} liveOutput="" />));
      expect(container.querySelector(`.thread-turn-head[data-status="${status}"]`)).not.toBeNull();
      flushSync(() => container.querySelector<HTMLButtonElement>('.thread-turn-head-main')!.click());
      expect(container.querySelector('.thread-turn-head-model')?.textContent).toBe('6 astra · high');
      expect(container.querySelector('.thread-turn-head-speed')?.textContent).toBe('100.0 tok/s');
      expect(container.querySelector('.thread-graph-worked-summary [data-testid="turn-token-speed"]')).toBeNull();
    } finally { flushSync(() => root.unmount()); }
  });

  it('shows duration without a date in the compact footer', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      flushSync(() => root.render(<TurnStatusBar turn={turn} variant="footer" />));
      expect(container.querySelector('time')).toBeNull();
      expect(container.querySelector('.thread-graph-turn-footer-meta')?.textContent).toBe('1m 12s');
    } finally { flushSync(() => root.unmount()); }
  });

  it('shows a completed summary even with no hidden tool activities', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      flushSync(() =>
        root.render(
          <ThreadTimeline
            turns={[
              {
                ...turn,
                items: turn.items.filter(
                  (item) => item.kind !== 'commandExecution',
                ),
              },
            ]}
            liveOutput=""
          />,
        ),
      );
      expect(container.querySelector('.thread-turn-head .thread-turn-usage-price')?.textContent).toBe('$0.11');
    } finally {
      flushSync(() => root.unmount());
    }
  });
});
