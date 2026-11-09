/**
 * @vitest-environment jsdom
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from 'node:crypto';
import { PluginProvider } from '../../plugins/PluginProvider';
import { contentQualityPlugin } from '../../plugins/content-quality-plugin';
import type { PolishedReplyDto, ThreadHistoryItemDto } from '@remote-codex/shared';

import { GraphChatCompactMessageItem } from "./GraphChatCompactMessageItem";
import { GraphChatContextCompactionItem } from './GraphChatHistoryItems';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let cleanup: (() => void) | null = null;

afterEach(() => {
  act(() => cleanup?.());
  cleanup = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("GraphChatCompactMessageItem", () => {
  const source = '原始 answer 🦀\nKeep the exact source.';
  const polishedReply = (text = 'Polished answer'): PolishedReplyDto => ({
    text, preset: 'clear', language: 'en', model: 'test-model',
    sourceHash: createHash('sha256').update(source).digest('hex'), createdAt: '2026-10-15T00:00:00Z',
  });
  function mockDigest() {
    const digest = vi.fn(async (_algorithm: string, bytes: Uint8Array) => Uint8Array.from(createHash('sha256').update(bytes).digest()).buffer);
    vi.stubGlobal('crypto', { subtle: { digest } });
    return digest;
  }
  function mount() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    cleanup = () => { root.unmount(); container.remove(); };
    return { container, root };
  }

  it('shows one polished body by default, toggles original text, and copies the selected full reply while keeping expansion', async () => {
    const digest = mockDigest();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const { container, root } = mount();
    const reply = polishedReply('Polished line.\n\n'.repeat(250));
    const onBeforeMessageResize = vi.fn();
    const adapter = { fetchPlugins: () => [{ ...contentQualityPlugin.manifest, enabled: true, available: true }] };
    await act(async () => root.render(<PluginProvider adapter={adapter} builtinPlugins={[contentQualityPlugin]}>
      <GraphChatCompactMessageItem item={{ id: 'quality', kind: 'agentMessage', text: source, polishedReply: reply }} scrollRootRef={{ current: null }} onBeforeMessageResize={onBeforeMessageResize} />
    </PluginProvider>));
    expect(digest).toHaveBeenCalled();
    expect(new TextDecoder().decode(digest.mock.calls[0]![1])).toBe(source);
    expect(container.querySelectorAll('[data-testid="chat-message"]')).toHaveLength(1);
    expect(container.textContent).toContain('Polished line.');
    expect(container.textContent).not.toContain(source);
    const button = (name: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(element => element.textContent === name || element.getAttribute('aria-label') === name)!;
    expect(button('Polished').getAttribute('aria-pressed')).toBe('true');
    expect(button('Show more')).toBeTruthy();
    await act(async () => button('Show more').click());
    expect(button('Show less')).toBeTruthy();
    await act(async () => button('Copy agent reply').click());
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(reply.text);
    await act(async () => button('Original').click());
    expect(container.textContent).toContain(source);
    expect(container.textContent).not.toContain('Polished line.');
    expect(button('Original').getAttribute('aria-pressed')).toBe('true');
    await act(async () => button('Copy agent reply').click());
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(source);
    await act(async () => button('Polished').click());
    expect(container.textContent).toContain('Polished line.');
    expect(onBeforeMessageResize).toHaveBeenCalled();
  });

  // A stored polished reply is history: turning the plugin off (here or globally)
  // stops new polishing but keeps what was already produced readable.
  it.each(['disabled', 'unavailable', 'unregistered'])(
    'keeps an existing polished reply readable when the plugin is %s', async condition => {
      mockDigest();
      const { container, root } = mount();
      const adapter = { fetchPlugins: () => condition === 'unregistered' ? [] : [{ ...contentQualityPlugin.manifest, enabled: condition !== 'disabled', available: condition !== 'unavailable' }] };
      await act(async () => root.render(<PluginProvider adapter={adapter} builtinPlugins={[contentQualityPlugin]}>
        <GraphChatCompactMessageItem item={{ id: 'quality', kind: 'agentMessage', text: source, polishedReply: polishedReply() }} scrollRootRef={{ current: null }} />
      </PluginProvider>));
      expect(container.textContent).toContain('Polished answer');
      const original = [...container.querySelectorAll<HTMLButtonElement>('button')].find(element => element.textContent === 'Original')!;
      await act(async () => original.click());
      expect(container.textContent).toContain(source);
    },
  );

  it.each(['missing', 'empty', 'malformed', 'stale', 'validation failed', 'streaming', 'user message'])(
    'falls back to the original reply when %s', async condition => {
      mockDigest();
      if (condition === 'validation failed') vi.stubGlobal('crypto', { subtle: { digest: vi.fn().mockRejectedValue(new Error('unavailable')) } });
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
      const { container, root } = mount();
      const item: ThreadHistoryItemDto & { kind: 'userMessage' | 'agentMessage' } = {
        id: 'quality', kind: condition === 'user message' ? 'userMessage' : 'agentMessage', text: source,
        polishedReply: condition === 'missing' ? undefined : polishedReply(condition === 'empty' ? '' : undefined),
      };
      if (condition === 'malformed') item.polishedReply!.sourceHash = 'invalid';
      if (condition === 'stale') item.text = 'Updated original';
      const adapter = { fetchPlugins: () => condition === 'unregistered' ? [] : [{ ...contentQualityPlugin.manifest, enabled: condition !== 'disabled', available: condition !== 'unavailable' }] };
      await act(async () => root.render(<PluginProvider adapter={adapter} builtinPlugins={[contentQualityPlugin]}>
        <GraphChatCompactMessageItem item={item} scrollRootRef={{ current: null }} streaming={condition === 'streaming'} />
      </PluginProvider>));
      expect(container.textContent).toContain(item.text);
      expect(container.textContent).not.toContain('Polished answer');
      expect(container.querySelector('[role="group"][aria-label="Reply version"]')).toBeNull();
      await act(async () => container.querySelector<HTMLButtonElement>(condition === 'user message' ? '[aria-label="Copy prompt"]' : '[aria-label="Copy agent reply"]')!.click());
      expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(item.text);
    },
  );

  it('rejects a stale asynchronous validation result after the message source changes', async () => {
    let resolveDigest: ((value: ArrayBuffer) => void) | undefined;
    vi.stubGlobal('crypto', { subtle: { digest: vi.fn(() => new Promise<ArrayBuffer>(resolve => { resolveDigest = resolve; })) } });
    const { container, root } = mount();
    const adapter = { fetchPlugins: () => [{ ...contentQualityPlugin.manifest, enabled: true }] };
    const item = { id: 'quality', kind: 'agentMessage' as const, text: source, polishedReply: polishedReply() };
    const render = (current: ThreadHistoryItemDto & { kind: 'agentMessage' }) => <PluginProvider adapter={adapter} builtinPlugins={[contentQualityPlugin]}><GraphChatCompactMessageItem item={current} scrollRootRef={{ current: null }} /></PluginProvider>;
    await act(async () => root.render(render(item)));
    const oldResolve = resolveDigest;
    await act(async () => root.render(render({ ...item, text: 'New source', polishedReply: null })));
    await act(async () => oldResolve!(Uint8Array.from(createHash('sha256').update(source).digest()).buffer));
    expect(container.textContent).toContain('New source');
    expect(container.textContent).not.toContain('Polished answer');
  });

  it.each(['running', 'in_progress', 'interrupted', 'cancelled', 'failed', 'completed'])("does not repeat %s turn status on emitted agent messages", async (status) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    cleanup = () => { root.unmount(); container.remove(); };
    await act(async () => root.render(<GraphChatCompactMessageItem item={{id:'old',kind:'agentMessage',text:'Previous checkpoint',status}} scrollRootRef={{current:null}} />));
    expect(container.textContent).toContain('Previous checkpoint');
    expect(container.querySelector('.thread-graph-message-status')).toBeNull();
  });

  it('preserves the explicit delivery status of a pending user message', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    cleanup = () => { root.unmount(); container.remove(); };
    await act(async () => root.render(<GraphChatCompactMessageItem item={{id:'queued',kind:'userMessage',text:'Follow up',status:'Awaiting response'}} scrollRootRef={{current:null}} />));
    expect(container.querySelector('.thread-graph-message-status')?.textContent).toBe('Awaiting response');
  });

  it('keeps compaction content without an empty neutral status chip, while retaining errors', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    cleanup = () => { root.unmount(); container.remove(); };
    const item = {id:'compact',kind:'contextCompaction' as const,text:'Context compaction',status:'interrupted'};
    await act(async () => root.render(<GraphChatContextCompactionItem item={item} />));
    expect(container.textContent).toContain('Context compacted');
    expect(container.querySelector('.thread-graph-tool-badge')).toBeNull();
    await act(async () => root.render(<GraphChatContextCompactionItem item={{...item,status:'failed'}} />));
    expect(container.querySelector('.thread-graph-tool-badge')?.textContent).toBe('Failed');
  });

  it("does not mount chain-of-thought content until its toggle is opened", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    cleanup = () => {
      root.unmount();
      container.remove();
    };

    await act(async () => {
      root.render(
        <GraphChatCompactMessageItem
          item={{
            id: "agent-1",
            kind: "agentMessage",
            text: "Done",
            reasoningItems: [
              {
                id: "reasoning-1",
                kind: "reasoning",
                text: "Inspect the failing command first.",
              },
            ],
          }}
          scrollRootRef={{ current: null }}
        />,
      );
    });

    expect(container.textContent).not.toContain(
      "Inspect the failing command first.",
    );
    const toggle = container.querySelector<HTMLButtonElement>(
      '[aria-label="Show chain of thought"]',
    );
    expect(toggle).toBeTruthy();

    await act(async () => {
      toggle?.click();
    });

    expect(container.textContent).toContain(
      "Inspect the failing command first.",
    );
  });

  it("replaces the copy icon with a check after copying an agent reply", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    cleanup = () => {
      root.unmount();
      container.remove();
    };

    await act(async () => {
      root.render(
        <GraphChatCompactMessageItem
          threadId="thread-1"
          item={{
            id: "agent-1",
            kind: "agentMessage",
            text: "Done",
            createdAt: null,
          }}
          scrollRootRef={{ current: null }}
        />,
      );
    });

    const copyButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Copy agent reply"]',
    );
    expect(copyButton?.querySelector(".lucide-copy")).toBeTruthy();
    await act(async () => {
      copyButton?.click();
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Done");
    expect(copyButton?.querySelector(".lucide-check")).toBeTruthy();
  });

  it("shares one floating copy control across desktop and mobile", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    cleanup = () => {
      root.unmount();
      container.remove();
    };

    await act(async () => {
      root.render(
        <GraphChatCompactMessageItem
          item={{
            id: "user-1",
            kind: "userMessage",
            text: "line one\nline two",
          }}
          scrollRootRef={{ current: null }}
          timeLabel="11:28 AM"
          timeTitle="September 2, 2026 at 11:28:00 AM"
        />,
      );
    });

    const copyButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        '[aria-label="Copy prompt"]',
      ),
    );
    expect(copyButtons).toHaveLength(1);
    expect(
      copyButtons[0]?.closest(".thread-graph-message-copy-desktop"),
    ).not.toBeNull();
    expect(
      container.querySelector(".thread-graph-message-bubble.is-user")
        ?.textContent,
    ).toBe("line one\nline two");

    await act(async () => {
      copyButtons[0]?.click();
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "line one\nline two",
    );
  });

  it("keeps timestamp visible and reveals actions after touch", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    cleanup = () => {
      root.unmount();
      container.remove();
    };

    await act(async () => {
      root.render(
        <GraphChatCompactMessageItem
          item={{ id: "agent-1", kind: "agentMessage", text: "Done" }}
          scrollRootRef={{ current: null }}
          timeLabel="11:28:07 AM"
          timeTitle="September 2, 2026 at 11:28:07 AM"
        />,
      );
    });

    const bubble = container.querySelector<HTMLElement>(
      ".thread-graph-message-bubble.is-assistant",
    );
    const timestamp = container.querySelector<HTMLElement>(
      ".thread-graph-message-time-row",
    );
    // A touch reveals the actions when it lifts; a mouse click never does.
    const touchEvent = new MouseEvent("pointerup", { bubbles: true });
    Object.defineProperty(touchEvent, "pointerType", { value: "touch" });

    await act(async () => {
      bubble?.dispatchEvent(touchEvent);
    });

    expect(timestamp?.textContent).toBe("11:28:07 AM");
    expect(bubble?.dataset.touchActions).toBe("true");
  });
});
