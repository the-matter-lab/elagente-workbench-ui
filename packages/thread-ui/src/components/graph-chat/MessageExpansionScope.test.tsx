/** @vitest-environment jsdom */
import { createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { afterEach, expect, it } from 'vitest';
import { GraphChatAgentMessageBody } from './GraphChatMessageBody';
import { MessageExpansionScope } from './MessageExpansionScope';

let root: Root | undefined;
let container: HTMLDivElement | undefined;
afterEach(() => { flushSync(() => root?.unmount()); container?.remove(); });
const text = 'A detailed explanation.\n\n'.repeat(200);
function fixture() {
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
  const scrollRootRef = createRef<HTMLDivElement>();
  return (phase: string, messageId = 'answer', streaming = false, content = text) => {
    flushSync(() => root!.render(<MessageExpansionScope><GraphChatAgentMessageBody key={phase} messageId={messageId} text={content} scrollRootRef={scrollRootRef} streaming={streaming}/></MessageExpansionScope>));
    return container!;
  };
}
it('retains explicit expand/collapse through finalization and history regrouping', () => {
  const render = fixture();
  let element = render('running');
  flushSync(() => element.querySelector('button')!.click());
  expect(element.textContent).toContain('Show less');
  element = render('final'); // Force the same reparent/remount as the timeline.
  expect(element.textContent).toContain('Show less');
  expect(element.textContent).toContain(text);
  flushSync(() => element.querySelector('button')!.click());
  element = render('history-expanded');
  expect(element.textContent).toContain('Show more');
  element = render('other-message', 'another-answer');
  expect(element.textContent).toContain('Show more');
});
it('keeps unstructured streaming text visible after acquiring its durable ID', () => {
  const render = fixture();
  render('streaming', 'live-agent-message', true);
  const element = render('final', 'persisted-id', false, text + 'The final sentence.');
  expect(element.textContent).toContain('Show less');
  expect(element.textContent).toContain('The final sentence.');
});
