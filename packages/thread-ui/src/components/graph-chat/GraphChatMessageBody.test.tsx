// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { GraphChatMarkdownAwareBody, GraphChatUserMessageBody } from './GraphChatMessageBody';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// A tile opens its card; the card's View opens the photo full size.
const view = (container: HTMLElement, name: string) => {
  act(() => container.querySelector<HTMLButtonElement>(`[aria-label="${name}, show details"]`)!.click());
  const button = [...document.querySelectorAll<HTMLButtonElement>('.attachment-float button')].find(item => item.textContent === 'View full size')!;
  act(() => button.click());
};

it('opens a photo from its card and closes it only outside the image or with Escape', () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    act(() => root.render(<GraphChatUserMessageBody text="See [PHOTO screenshot.png]" attachmentPreviewUrls={{ 'screenshot.png': '/test.png' }} />));
    const tile = container.querySelector<HTMLButtonElement>('.attachment-tile')!;
    expect(tile.getAttribute('data-family')).toBe('image');
    // A long name keeps its start, end and extension; the whole name is in the title.
    expect(tile.querySelector('.attachment-tile-name')!.textContent).toBe('scre…ot.png');
    expect(tile.title).toBe('screenshot.png');
    view(container, 'screenshot.png');
    const dialog = document.querySelector('[role="dialog"][aria-label="Image preview: screenshot.png"]')!;
    expect(dialog).not.toBeNull();
    act(() => dialog.querySelector<HTMLImageElement>('img')!.click());
    expect(document.querySelector('[aria-label="Image preview: screenshot.png"]')).not.toBeNull();
    act(() => dialog.querySelector<HTMLElement>('.thread-graph-image-lightbox-viewport')!.click());
    expect(document.querySelector('[aria-label="Image preview: screenshot.png"]')).toBeNull();
    view(container, 'screenshot.png');
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'})));
    expect(document.querySelector('[aria-label="Image preview: screenshot.png"]')).toBeNull();
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

const imageUrl = ({ path, variant }: { threadId: string; path: string; variant?: 'thumbnail' }) =>
  `/image?path=${path}${variant ? `&variant=${variant}` : ''}`;

it('shows photo tiles as thumbnails and loads the original only in the lightbox', () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    act(() => root.render(<GraphChatUserMessageBody threadId="t1" text="See [PHOTO ./shot.jpg]" getImageAssetUrl={imageUrl} />));
    expect(container.querySelector('.attachment-tile img')!.getAttribute('src')).toBe('/image?path=./shot.jpg&variant=thumbnail');
    expect(document.querySelector('img[src="/image?path=./shot.jpg"]')).toBeNull();
    view(container, 'shot.jpg');
    expect(document.querySelector('[aria-label="Image preview: shot.jpg"] img')!.getAttribute('src')).toBe('/image?path=./shot.jpg');
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

it('keeps a local preview for both the tile and the lightbox', () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    act(() => root.render(<GraphChatUserMessageBody threadId="t1" text="[PHOTO a.png]" attachmentPreviewUrls={{ 'a.png': 'blob:local' }} getImageAssetUrl={imageUrl} />));
    expect(container.querySelector('img')!.getAttribute('src')).toBe('blob:local');
    view(container, 'a.png');
    expect(document.querySelector('[aria-label="Image preview: a.png"] img')!.getAttribute('src')).toBe('blob:local');
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

it('shows a file as its glyph and extension, and its card opens it in files', () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onOpen = vi.fn();
  try {
    act(() => root.render(<GraphChatUserMessageBody threadId="t1" text="Read [FILE ./.temp/threads/t1/osfi_cgg_node357_report.pdf]" onOpenWorkspaceFile={onOpen} />));
    const tile = container.querySelector<HTMLButtonElement>('.attachment-tile')!;
    expect(tile.getAttribute('data-family')).toBe('pdf');
    expect(tile.querySelector('.attachment-tile-icon b')!.textContent).toBe('PDF');
    expect(tile.querySelector('.attachment-tile-name')!.textContent).toBe('osfi…rt.pdf');
    act(() => tile.click());
    const card = document.querySelector('.attachment-float')!;
    expect(card.querySelector('strong')!.textContent).toBe('osfi_cgg_node357_report.pdf');
    expect(card.textContent).toContain('PDF file');
    expect(card.querySelector('.attachment-card-path')!.getAttribute('title')).toBe('./.temp/threads/t1/osfi_cgg_node357_report.pdf');
    act(() => [...card.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent === 'Open in files')!.click());
    expect(onOpen).toHaveBeenCalledWith({ path: './.temp/threads/t1/osfi_cgg_node357_report.pdf' });
    expect(document.querySelector('.attachment-float')).toBeNull();
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

it('folds long prompts, keeps late attachments accessible, and resets disclosure for another message', () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const text = `${'详细要求：请核对配对流程。'.repeat(100)}FULL PROMPT TAIL [PHOTO evidence.png] [FILE requirements.md]`;
  try {
    const message = (id: string) => <GraphChatUserMessageBody messageId={id} text={text} attachmentPreviewUrls={{'evidence.png':'/evidence.png'}} />;
    act(() => root.render(message('first')));
    const button = container.querySelector<HTMLButtonElement>('.thread-graph-show-more')!;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('FULL PROMPT TAIL');
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/evidence.png');
    expect(container.querySelector('[aria-label="requirements.md, show details"]')).not.toBeNull();
    act(() => button.click());
    expect(container.textContent).toContain('FULL PROMPT TAIL');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    act(() => root.render(message('first')));
    expect(button.getAttribute('aria-expanded')).toBe('true');
    act(() => root.render(message('second')));
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('FULL PROMPT TAIL');
    act(() => root.render(<GraphChatUserMessageBody messageId="short" text="A short prompt" />));
    expect(container.textContent).toBe('A short prompt');
    expect(container.querySelector('.thread-graph-show-more')).toBeNull();
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

it.each(['user', 'markdown'])('anchors the %s message top on expansion and its toggle on collapse', (kind) => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onBeforeResize = vi.fn();
  const text = 'A long readable paragraph for checking message disclosure anchors.\n\n'.repeat(100);
  try {
    act(() => root.render(kind === 'user'
      ? <GraphChatUserMessageBody messageId="anchor-user" text={text} onBeforeResize={onBeforeResize} />
      : <GraphChatMarkdownAwareBody messageId="anchor-markdown" text={text} onBeforeResize={onBeforeResize} scrollRootRef={{ current: null }} />));
    const toggle = container.querySelector<HTMLButtonElement>('.thread-graph-show-more')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    act(() => toggle.click());
    expect(onBeforeResize).toHaveBeenLastCalledWith(toggle.parentElement);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    act(() => toggle.click());
    expect(onBeforeResize).toHaveBeenLastCalledWith(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  } finally { act(() => root.unmount()); container.remove(); }
});


it('keeps a report path whole before Show more and reveals the remaining files on expansion', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const prefix = `${'Summary. '.repeat(262)}\n\nFiles:\n\n`;
  const report = 'runs/hf-def2svp-smiles-fresh-20261109-b1/reports/acetylsalicylic_acid/report.md';
  const geometry = 'runs/hf-def2svp-smiles-fresh-20261109-b1/reports/acetylsalicylic_acid/final_geometry.xyz';
  const text = `${prefix}\`${report}\`\n\n\`${geometry}\``;
  try {
    await act(async () => root.render(<GraphChatMarkdownAwareBody text={text} scrollRootRef={{current: null}} />));
    expect(container.querySelector('code')?.textContent).toBe(report);
    expect(container.textContent).not.toContain(geometry);
    const toggle = container.querySelector<HTMLButtonElement>('.thread-graph-show-more')!;
    expect(toggle.textContent).toBe('Show more');
    await act(async () => toggle.click());
    expect([...container.querySelectorAll('code')].map(node => node.textContent)).toEqual([report, geometry]);
    expect(toggle.textContent).toBe('Show less');
  } finally { act(() => root.unmount()); container.remove(); }
});
