/**
 * @vitest-environment jsdom
 */
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PhoneDockContext } from '../workbench/phoneDockContext';
import { ComposerFrame, type ComposerFrameProps } from './ComposerFrame';

let cleanup: (() => void) | null = null;

function baseProps(): ComposerFrameProps {
  return {
    activeView: 'chat',
    layerClassName: 'layer',
    formClassName: 'form',
    shellClassName: 'shell',
    inputGroupClassName: 'group',
    error: null,
    followTail: false,
    photoInputRef: { current: null },
    fileInputRef: { current: null },
    onAppendAttachments: vi.fn(),
    onToggleFollow: vi.fn(),
    onSubmit: vi.fn((event) => event.preventDefault()),
    formRef: { current: null },
    promptSlot: <div data-slot="prompt">Prompt</div>,
    toolbarSlot: <div data-slot="toolbar">Toolbar</div>,
    goalSlot: null,
    shellPromptSlot: null,
  };
}

function renderFrame(props: ComposerFrameProps, dock = false) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(<PhoneDockContext.Provider value={dock}><ComposerFrame {...props} /></PhoneDockContext.Provider>);
  });
  cleanup = () => {
    flushSync(() => {
      root.unmount();
    });
    container.remove();
  };
  return container;
}

describe('ComposerFrame', () => {
  beforeEach(() => {
    cleanup = null;
  });

  afterEach(() => {
    delete document.documentElement.dataset.themePreset;
    cleanup?.();
    cleanup = null;
    vi.restoreAllMocks();
  });

  it('renders chat form slots and the jump-to-latest control', () => {
    const props = baseProps();
    const container = renderFrame(props);

    expect(container.querySelector('[data-testid="chat-composer"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="prompt"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="toolbar"]')).toBeTruthy();

    const jumpButton = Array.from(container.querySelectorAll('button')).find(
      (entry) => entry.getAttribute('aria-label') === 'Jump to latest',
    );
    expect(jumpButton).toBeTruthy();
    jumpButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(props.onToggleFollow).toHaveBeenCalledTimes(1);
  });

  it('renders error, goal, and shell prompt slots', () => {
    const container = renderFrame({
      ...baseProps(),
      activeView: 'shell',
      error: 'failed',
      goalSlot: <div data-slot="goal">Goal</div>,
      shellPromptSlot: <div data-slot="shell-prompt">Shell</div>,
    });

    expect(container.querySelector('[data-testid="chat-composer"]')).toBeNull();
    expect(container.textContent).toContain('failed');
    expect(container.querySelector('[data-slot="goal"]')).toBeTruthy();
    expect(container.querySelector('[data-slot="shell-prompt"]')).toBeTruthy();
  });

  it.each([
    [11, 10, '11 files attached, max 10. Remove 1 to send.'],
    [30, 10, '30 files attached, max 10. Remove 20 to send.'],
    [1, 0, '1 file attached, max 0. Remove 1 to send.'],
  ])('shows the structured %i/%i warning between prompt and toolbar', (count, max, message) => {
    const container = renderFrame({ ...baseProps(), attachmentLimit: { count, max } });
    const alert = container.querySelector('[role="alert"]')!;
    expect(alert.textContent).toBe(message);
    expect([...alert.querySelectorAll('strong')].map(node => node.textContent)).toEqual([String(count), String(max)]);
    expect(alert.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
    expect(alert.querySelector('button')).toBeNull();
    expect(alert.parentElement?.getAttribute('data-slot')).toBe('input-group');
    expect(alert.previousElementSibling?.getAttribute('data-slot')).toBe('prompt');
    expect(alert.nextElementSibling?.getAttribute('data-slot')).toBe('toolbar');
  });

  it.each([undefined, { count: 0, max: 10 }, { count: 10, max: 10 }])('omits the warning for %j', attachmentLimit => {
    const container = renderFrame({ ...baseProps(), attachmentLimit });
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('[data-attachment-limit-exceeded]')).toBeNull();
  });

  it('does not show the attachment limit in shell view', () => {
    const container = renderFrame({ ...baseProps(), activeView: 'shell', attachmentLimit: { count: 30, max: 10 } });
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('preserves a separate generic error and dismiss action while the limit remains invalid', () => {
    const onDismissError = vi.fn();
    const container = renderFrame({
      ...baseProps(), attachmentLimit: { count: 11, max: 10 }, error: 'Upload failed', onDismissError,
    });
    const alerts = container.querySelectorAll('[role="alert"]');
    expect(alerts).toHaveLength(2);
    expect(alerts[1].textContent).toBe('Upload failed');
    expect(alerts[1].closest('[data-slot="input-group"]')).toBeNull();
    alerts[1].querySelector('button')?.click();
    expect(onDismissError).toHaveBeenCalledOnce();
    expect(alerts[0].textContent).toBe('11 files attached, max 10. Remove 1 to send.');
  });

  const subscriptionUsage = {
    provider: 'claude' as const,
    authKind: 'subscription' as const,
    observedAt: new Date().toISOString(),
    stale: false,
    windows: [{ id: '5h', durationMinutes: 300, label: '5h', usedPercent: 10, resetsAt: null }],
  };

  it.each(['classic', 'plum-pocket'])('anchors usage to the shell in %s without a footer row', (preset) => {
    document.documentElement.dataset.themePreset = preset;
    const container = renderFrame({ ...baseProps(), subscriptionUsage });
    expect(container.querySelector('.shell .thread-composer-usage-tag .thread-subscription-usage')).toBeTruthy();
    expect(container.querySelector('.thread-composer-usage-footer')).toBeNull();
  });

  it('leaves usage to the status bar under the phone dock', () => {
    const container = renderFrame({ ...baseProps(), subscriptionUsage }, true);
    expect(container.querySelector('.thread-subscription-usage')).toBeNull();
  });
});
