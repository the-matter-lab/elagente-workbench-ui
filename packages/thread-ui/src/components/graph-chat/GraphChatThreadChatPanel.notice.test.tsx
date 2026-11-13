/** @vitest-environment jsdom */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ThreadDetailDto } from '@remote-codex/shared';
import type { ThreadDetailUiAdapter } from '../../adapters';
import type { ThreadComposerProps } from '../ThreadComposer';
import { GraphChatThreadChatPanel } from './GraphChatThreadChatPanel';

// Keep a browser-owned draft in the child so a remount loses both text and focus.
vi.mock('../ThreadComposer', () => ({ ThreadComposer: () => <textarea data-testid="composer" defaultValue="" /> }));
const detail = { thread: { id: 't1', status: 'idle', activeTurnId: null }, turns: [], pendingRequests: [] } as unknown as ThreadDetailDto;
const adapter = { sendPrompt: vi.fn() } as unknown as ThreadDetailUiAdapter;
const composerProps = {} as Omit<ThreadComposerProps, 'activeView' | 'onSubmit'>;
const Timeline = () => <div data-testid="timeline" />;
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

test.each([false, true])('notice updates preserve the draft and focus (floating mobile: %s)', async floating => {
  const composerHostRef = { current: null as HTMLDivElement | null };
  const render = async (composerNotice?: ReactNode) => act(async () => root.render(
    <GraphChatThreadChatPanel detail={detail} adapter={adapter} timelineAdapter={{}}
      TimelineComponent={Timeline} transcriptItemCount={0} composerProps={composerProps}
      composerHostRef={composerHostRef} useFloatingMobileComposer={floating} composerNotice={composerNotice} />,
  ));
  await render();
  const composer = host.querySelector<HTMLTextAreaElement>('textarea')!;
  composer.value = 'A draft in progress';
  await act(async () => composer.focus());
  for (const notice of [<span>Stopping in 3:00</span>, <span>Stopping in 2:59</span>, null]) {
    await render(notice);
    expect(host.querySelector('textarea')).toBe(composer);
    expect(composer.value).toBe('A draft in progress');
    expect(document.activeElement).toBe(composer);
    const wrapper = host.querySelector('.thread-composer-notice');
    expect(Boolean(wrapper)).toBe(Boolean(notice));
    expect(composerHostRef.current?.hasAttribute('data-composer-notice')).toBe(Boolean(notice));
    if (wrapper) {
      expect(wrapper.parentElement).toBe(composerHostRef.current);
      expect(wrapper.nextElementSibling).toBe(composer);
      expect(wrapper.closest('.thread-timeline-frame')).toBeNull();
    }
  }
});
