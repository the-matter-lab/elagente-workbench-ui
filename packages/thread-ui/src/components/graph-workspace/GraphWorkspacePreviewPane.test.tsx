// @vitest-environment jsdom

import { act, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDefaultPluginContextValue } from '../../plugins/plugin-context';
import {
  GraphWorkspacePreviewPane,
  canShowInlinePdf,
  resolveLinkedMarkdownPath,
  resolveWorkspaceMarkdownPath,
} from './GraphWorkspacePreviewPane';
import type { WorkspaceTreeNode } from './workspaceTree';
import type { WorkspaceDocuments } from './explorer/useWorkspaceDocuments';
import { editDraft, newDraft } from './explorer/workspaceDocuments';
import { MAX_JSON_PREVIEW_CHARS } from './explorer/jsonPreview';

vi.mock('../graph-chat/graphChatShiki', () => ({
  getGraphChatHighlighter: () => new Promise(() => undefined),
  syntaxThemeFor: () => 'github-light-default',
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');

function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(node);
  });
  return container;
}

function openFileActions(element: HTMLElement) {
  act(() => element.querySelector<HTMLButtonElement>('button[aria-label="File actions"]')!.click());
}

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  root = null;
  container?.remove();
  container = null;
  document.body.style.overflow = '';
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else Reflect.deleteProperty(navigator, 'clipboard');
  if (originalExecCommand) Object.defineProperty(document, 'execCommand', originalExecCommand);
  else Reflect.deleteProperty(document, 'execCommand');
});

describe('resolveWorkspaceMarkdownPath', () => {
  it('resolves relative, parent, and workspace-absolute resources', () => {
    expect(
      resolveWorkspaceMarkdownPath({
        markdownPath: 'docs/guides/setup.md',
        resourceUrl: './images/flow chart.png?raw=1',
      }),
    ).toBe('docs/guides/images/flow chart.png');
    expect(
      resolveWorkspaceMarkdownPath({
        markdownPath: '/home/u/treer/docs/guides/setup.md',
        resourceUrl: '../assets/diagram.png',
        workspaceRootPath: '/home/u/treer',
      }),
    ).toBe('docs/assets/diagram.png');
    expect(
      resolveWorkspaceMarkdownPath({
        markdownPath: 'docs/guides/setup.md',
        resourceUrl: '/home/u/treer/screenshots/result.png',
        workspaceRootPath: '/home/u/treer',
      }),
    ).toBe('screenshots/result.png');
  });

  it('keeps external URLs outside the workspace adapter', () => {
    expect(
      resolveWorkspaceMarkdownPath({
        markdownPath: 'docs/setup.md',
        resourceUrl: 'https://example.com/image.png',
      }),
    ).toBeNull();
    expect(
      resolveWorkspaceMarkdownPath({
        markdownPath: 'README.md',
        resourceUrl: '../outside.png',
      }),
    ).toBeNull();
    expect(
      resolveWorkspaceMarkdownPath({
        markdownPath: '/home/u/treer/docs/setup.md',
        resourceUrl: '/etc/passwd',
        workspaceRootPath: '/home/u/treer',
      }),
    ).toBeNull();
    expect(
      resolveWorkspaceMarkdownPath({
        markdownPath: '/tmp/outside.md',
        resourceUrl: './image.png',
        workspaceRootPath: '/home/u/treer',
      }),
    ).toBeNull();
  });

  it('resolves complete same-origin workspace URLs', () => {
    expect(
      resolveWorkspaceMarkdownPath({
        markdownPath: 'docs/setup.md',
        resourceUrl: `${window.location.origin}/home/u/treer/assets/relay.png`,
        workspaceRootPath: '/home/u/treer',
      }),
    ).toBe('assets/relay.png');
  });
});

describe('resolveLinkedMarkdownPath', () => {
  it('resolves relative resources beside a linked host Markdown file', () => {
    const linked = { markdownPath: '/tmp/report/REPORT.md', workspaceRootPath: '/home/u/treer' };
    expect(resolveLinkedMarkdownPath({ ...linked, resourceUrl: 'shot.png' })).toBe('/tmp/report/shot.png');
    expect(resolveLinkedMarkdownPath({ ...linked, resourceUrl: './images/a%20b.png#x' })).toBe('/tmp/report/images/a b.png');
    expect(resolveLinkedMarkdownPath({ ...linked, resourceUrl: '../shared/logo.svg' })).toBe('/tmp/shared/logo.svg');
    expect(resolveLinkedMarkdownPath({ markdownPath: 'C:\\notes\\r.md', resourceUrl: 'img/p.png' })).toBe('C:/notes/img/p.png');
  });

  it('leaves workspace documents, absolute, external and escaping resources alone', () => {
    expect(resolveLinkedMarkdownPath({ markdownPath: '/home/u/treer/docs/a.md', resourceUrl: 'x.png', workspaceRootPath: '/home/u/treer' })).toBeNull();
    expect(resolveLinkedMarkdownPath({ markdownPath: 'docs/a.md', resourceUrl: 'x.png' })).toBeNull();
    expect(resolveLinkedMarkdownPath({ markdownPath: '/tmp/r.md', resourceUrl: '/etc/passwd' })).toBeNull();
    expect(resolveLinkedMarkdownPath({ markdownPath: '/tmp/r.md', resourceUrl: 'https://example.com/x.png' })).toBeNull();
    expect(resolveLinkedMarkdownPath({ markdownPath: '/tmp/r.md', resourceUrl: '../../x.png' })).toBeNull();
  });
});

describe('PDF preview', () => {
  const pdfNode: WorkspaceTreeNode = { id: 'pdf', path: 'docs/report.pdf', name: 'report.pdf', kind: 'file', size: 2048, children: [] };
  afterEach(() => { Reflect.deleteProperty(navigator, 'pdfViewerEnabled'); });

  it('detects browsers without an inline PDF viewer', () => {
    expect(canShowInlinePdf({ pdfViewerEnabled: true })).toBe(true);
    expect(canShowInlinePdf({})).toBe(true);
    expect(canShowInlinePdf({ pdfViewerEnabled: false })).toBe(false);
  });

  it('frames the PDF where the browser has a viewer', () => {
    Object.defineProperty(navigator, 'pdfViewerEnabled', { configurable: true, value: true });
    const element = render(<GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()}
      selectedTarget={{ kind: 'workspace-file', node: pdfNode }} pdfUrl="blob:http://localhost/pdf" />);
    expect(element.querySelector('iframe')?.getAttribute('src')).toBe('blob:http://localhost/pdf');
    expect(element.querySelector('[data-testid="workspace-pdf-actions"]')).toBeNull();
  });

  it('offers Open and Download instead of a blank frame on phones', () => {
    Object.defineProperty(navigator, 'pdfViewerEnabled', { configurable: true, value: false });
    const element = render(<GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()}
      selectedTarget={{ kind: 'workspace-file', node: pdfNode }} pdfUrl="blob:http://localhost/pdf" />);
    expect(element.querySelector('iframe')).toBeNull();
    const open = element.querySelector<HTMLAnchorElement>('a[aria-label="Open report.pdf in a new tab"]')!;
    expect(open.getAttribute('href')).toBe('blob:http://localhost/pdf');
    expect(open.target).toBe('_blank');
    const download = element.querySelector<HTMLAnchorElement>('a[aria-label="Download report.pdf"]')!;
    expect(download.getAttribute('download')).toBe('report.pdf');
    expect(element.textContent).toContain('2.0 KB');
  });
});

describe('GraphWorkspacePreviewPane', () => {
  it('resolves a linked Markdown file\'s relative images as linked files', () => {
    const resolveWorkspaceFileUrl = vi.fn((path: string) => `/raw?path=${encodeURIComponent(path)}`);
    const element = render(<GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()}
      selectedTarget={{ kind: 'workspace-file', node: { id: 'linked', path: '/tmp/report/REPORT.md', name: 'REPORT.md', kind: 'file', children: [] } }}
      previewFile={{ path: '/tmp/report/REPORT.md', name: 'REPORT.md', language: 'markdown', size: 40, truncated: false, nextOffset: 40,
        content: '# Report\n\n![Shot](shot.png)\n\n![Secret](/etc/passwd)' }}
      canSaveDocument workspaceRootPath="/home/u/treer" resolveWorkspaceFileUrl={resolveWorkspaceFileUrl} />);
    expect(element.querySelector('img[alt="Shot"]')?.getAttribute('src')).toBe('/raw?path=%2Ftmp%2Freport%2Fshot.png');
    expect(element.querySelector('img[alt="Secret"]')?.getAttribute('src')).toBe('/etc/passwd');
    expect(resolveWorkspaceFileUrl).toHaveBeenCalledTimes(1);
    expect(element.textContent).toContain('Linked file outside the workspace: read-only preview.');
    expect(element.textContent).not.toContain('Safe editing is unavailable');
  });

  it('renders README HTML images and routes linked badges to relative workspace documents', () => {
    const onOpenWorkspaceFile = vi.fn();
    const element = render(<GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()}
      selectedTarget={{ kind: 'workspace-file', node: { id: 'readme', path: '/home/u/treer/README.md', name: 'README.md', kind: 'file', children: [] } }}
      previewFile={{ path: '/home/u/treer/README.md', name: 'README.md', language: 'markdown', size: 200, truncated: false, nextOffset: 200,
        content: '<p align="center"><a href="README.zh-CN.md"><img src="https://example.com/badge.svg" alt="中文" width="80"></a></p>\n\n<p align="center"><img src="docs/hero.png" alt="Hero" width="100%"></p>' }}
      workspaceRootPath="/home/u/treer" onOpenWorkspaceFile={onOpenWorkspaceFile}
      resolveWorkspaceFileUrl={path => `/raw?path=${encodeURIComponent(path)}`} />);
    expect(element.querySelector('p[align="center"]')).not.toBeNull();
    expect(element.querySelector('a img')?.getAttribute('src')).toBe('https://example.com/badge.svg');
    expect(element.querySelector('a button')).toBeNull();
    const hero = element.querySelector<HTMLImageElement>('img[alt="Hero"]')!;
    expect(hero.getAttribute('src')).toBe('/raw?path=docs%2Fhero.png');
    expect(hero.style.width).toBe('100%');
    act(() => element.querySelector('a')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));
    expect(onOpenWorkspaceFile).toHaveBeenCalledWith('README.zh-CN.md');
  });
  it('explains a refused symbolic link instead of showing the error code', () => {
    const element = render(<GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()}
      selectedTarget={{ kind: 'workspace-file', node: { id: 'link', path: 'link', name: 'link', kind: 'file', children: [] } }}
      error="symbolicLink" />);
    expect(element.textContent).toContain('This is a symbolic link. Open the file it points to instead.');
    expect(element.textContent).not.toContain('symbolicLink');
  });
  const markdownNode: WorkspaceTreeNode = {
    id: 'workspace:docs/architecture.md',
    name: 'architecture.md',
    path: '/home/u/treer/docs/architecture.md',
    kind: 'file',
    children: [],
  };

  it('renders Markdown by default and resolves workspace images through the adapter', () => {
    const resolveWorkspaceFileUrl = vi.fn(
      (path: string) => `/relay/files/raw?path=${encodeURIComponent(path)}`,
    );
    const onOpenWorkspaceFile = vi.fn();
    const element = render(
      <GraphWorkspacePreviewPane
        plugins={createDefaultPluginContextValue()}
        selectedTarget={{ kind: 'workspace-file', node: markdownNode }}
        previewFile={{
          path: markdownNode.path,
          name: markdownNode.name,
          content:
            '# Architecture\n\n![Diagram](../assets/system.png)\n\n[Details](./details.md)',
          language: 'markdown',
          size: 96,
          truncated: false,
          nextOffset: 96,
        }}
        resolveWorkspaceFileUrl={resolveWorkspaceFileUrl}
        onOpenWorkspaceFile={onOpenWorkspaceFile}
        workspaceRootPath="/home/u/treer"
      />,
    );

    expect(element.querySelector('h1')?.textContent).toBe('Architecture');
    expect(element.querySelector('img')?.getAttribute('src')).toBe(
      '/relay/files/raw?path=assets%2Fsystem.png',
    );
    expect(resolveWorkspaceFileUrl).toHaveBeenCalledWith('assets/system.png');
    expect(element.querySelector('[aria-label="Source code"]')).toBeNull();

    act(() => {
      element
        .querySelector<HTMLButtonElement>(
          '[aria-label="Open image preview: Diagram"]',
        )
        ?.click();
    });
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog?.getAttribute('aria-label')).toBe('Image preview: Diagram');
    expect(dialog?.querySelector('img')?.getAttribute('src')).toBe(
      '/relay/files/raw?path=assets%2Fsystem.png',
    );

    act(() => {
      dialog
        ?.querySelector<HTMLElement>('.thread-graph-image-lightbox-viewport')
        ?.dispatchEvent(
          new WheelEvent('wheel', {
            bubbles: true,
            cancelable: true,
            clientX: 320,
            clientY: 240,
            deltaY: -100,
          }),
        );
    });
    expect(document.body.textContent).toContain('125%');
    expect(dialog?.querySelector('img')?.style.transform).toContain(
      'translate3d(-80px, -60px, 0) scale(1.25)',
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    act(() => {
      element
        .querySelector<HTMLAnchorElement>('a')
        ?.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true }),
        );
    });
    expect(onOpenWorkspaceFile).toHaveBeenCalledWith('docs/details.md');
  });

  it('keeps an open README image and its zoom across parent callback refreshes', () => {
    const view = () => <GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()}
      selectedTarget={{ kind: 'workspace-file', node: markdownNode }}
      previewFile={{ path: markdownNode.path, name: markdownNode.name, content: '![Diagram](../assets/system.png)', language: 'markdown', size: 40, truncated: false, nextOffset: 40 }}
      workspaceRootPath="/home/u/treer"
      onOpenWorkspaceFile={() => undefined}
      resolveWorkspaceFileUrl={path => `/raw?path=${encodeURIComponent(path)}`} />;
    const element = render(view());
    act(() => element.querySelector<HTMLButtonElement>('[aria-label="Open image preview: Diagram"]')!.click());
    const dialog = document.body.querySelector('[role="dialog"]')!;
    act(() => dialog.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!.click());
    expect(dialog.textContent).toContain('125%');
    // Explorer refreshes recreate callbacks, even while the file stays the same.
    act(() => root!.render(view()));
    expect(document.body.querySelector('[role="dialog"]')).toBe(dialog);
    expect(dialog.textContent).toContain('125%');
    act(() => dialog.querySelector<HTMLButtonElement>('[aria-label="Close image preview"]')!.click());
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it('opens direct image files in the same lightbox and closes from the toolbar', () => {
    const imageNode: WorkspaceTreeNode = {
      id: 'workspace:images/diagram.png',
      name: 'diagram.png',
      path: '/home/u/treer/images/diagram.png',
      kind: 'file',
      children: [],
    };
    const element = render(
      <GraphWorkspacePreviewPane
        plugins={createDefaultPluginContextValue()}
        selectedTarget={{ kind: 'workspace-file', node: imageNode }}
        imageUrl="/relay/files/raw?path=images%2Fdiagram.png"
      />,
    );

    act(() => {
      element
        .querySelector<HTMLButtonElement>(
          '[aria-label="Open image preview"]',
        )
        ?.click();
    });
    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy();

    act(() => {
      document.body
        .querySelector<HTMLButtonElement>('[aria-label="Close image preview"]')
        ?.click();
    });
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it('switches Markdown to highlighted source with line numbers', () => {
    const element = render(
      <GraphWorkspacePreviewPane
        plugins={createDefaultPluginContextValue()}
        selectedTarget={{ kind: 'workspace-file', node: markdownNode }}
        focusLine={3}
        previewFile={{
          path: markdownNode.path,
          name: markdownNode.name,
          content: '# Architecture\n\nText',
          language: 'markdown',
          size: 20,
          truncated: false,
          nextOffset: 20,
        }}
      />,
    );

    act(() => element.querySelector<HTMLButtonElement>('[aria-label="File actions"]')!.click());
    expect(element.querySelector('[role="menu"]')).toBeNull();
    const sourceButton = element.querySelector<HTMLButtonElement>(
      '[aria-label="Markdown source"]',
    );
    act(() => {
      sourceButton?.click();
    });

    expect(element.querySelector('[aria-label="Source code"]')).toBeTruthy();
    expect(
      [...element.querySelectorAll('.thread-graph-code-line-number')].map(
        (line) => line.textContent,
      ),
    ).toEqual(['1', '2', '3']);
    expect(
      element
        .querySelector('[data-line="3"]')
        ?.classList.contains('is-focused-line'),
    ).toBe(true);
  });
});

it('resolves Windows Markdown resources with case-insensitive roots and browser drive prefixes', () => {
  for (const resourceUrl of ['C:/WORK/demo/assets/a.png', '/C:/Work/demo/assets/a.png', 'file:///C:/work/demo/assets/a.png', `${window.location.origin}/C%3A/Work/demo/assets/a.png`, '../assets/a.png']) {
    expect(resolveWorkspaceMarkdownPath({markdownPath:'C:\\Work\\demo\\docs\\readme.md', resourceUrl, workspaceRootPath:'c:\\work\\demo'})).toBe('assets/a.png');
  }
});

it('renders draw.io in a sandbox by default and preserves source/preview switching', () => {
  const node: WorkspaceTreeNode = {id:'diagram',name:'architecture.drawio',path:'docs/architecture.drawio',kind:'file',children:[]};
  const element = render(<GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()}
    selectedTarget={{kind:'workspace-file',node}}
    previewFile={{path:node.path,name:node.name,content:'<mxfile><diagram/></mxfile>',size:35,language:'xml',truncated:false,nextOffset:35}} />);
  const frame = element.querySelector('iframe');
  expect(frame?.getAttribute('title')).toBe('Draw.io preview: architecture.drawio');
  expect(frame?.getAttribute('sandbox')).toBe('allow-scripts');
  expect(frame?.getAttribute('srcdoc')).toContain('/vendor/drawio/bootstrap.v1.js');
  act(() => element.querySelector<HTMLButtonElement>('[aria-label="File actions"]')!.click());
  act(() => element.querySelector<HTMLButtonElement>('[aria-label="Diagram source"]')!.click());
  expect(element.querySelector('iframe')).toBeNull();
  expect(element.querySelector('[aria-label="Source code"]')).toBeTruthy();
  act(() => element.querySelector<HTMLButtonElement>('[aria-label="Diagram preview"]')!.click());
  expect(element.querySelector('iframe')).toBeTruthy();
});

describe('JSON file previews', () => {
  const node: WorkspaceTreeNode = { id: 'json', name: 'node-progress.json', path: 'runs/node-progress.json', kind: 'file', children: [] };
  const source = '{"version":1,"events":[{"progress":true}]}';
  const preview = { path: node.path, name: node.name, language: 'json', content: source, size: source.length, truncated: false, nextOffset: source.length };
  const props = (extra: Partial<ComponentProps<typeof GraphWorkspacePreviewPane>> = {}): ComponentProps<typeof GraphWorkspacePreviewPane> => ({
    plugins: createDefaultPluginContextValue(), selectedTarget: { kind: 'workspace-file', node }, previewFile: preview, ...extra,
  });
  const lines = (element: HTMLElement) => [...element.querySelectorAll('.thread-graph-code-line > span:last-child')].map(line => line.textContent).join('\n');

  it('opens formatted, toggles exact raw text, and leaves copy/download and the document unchanged', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const draft = newDraft('json-key', { ...preview, workspaceRevision: '1', fileIdentity: 'file-1', contentHash: 'hash', encoding: 'utf-8', bom: false, eol: 'lf', readOnlyReason: null });
    const documents: WorkspaceDocuments = { documents: new Map([[node.path, draft]]), source: 'json-test', load: vi.fn(), change: vi.fn(), setEditing: vi.fn(), discard: vi.fn(), save: vi.fn(), reconcile: vi.fn(), adoptDisk: vi.fn(), checkDisk: vi.fn(), acceptVerifiedDisk: vi.fn() };
    const onDownloadFile = vi.fn();
    const element = render(<GraphWorkspacePreviewPane {...props({ documents, canSaveDocument: true, onDownloadFile })} />);
    expect(element.querySelector('[aria-label="JSON view"] button[aria-pressed="true"]')?.textContent).toBe('Formatted');
    expect(lines(element)).toContain('\n  "version": 1,\n');
    act(() => [...element.querySelectorAll<HTMLButtonElement>('[aria-label="JSON view"] button')].find(button => button.textContent === 'Raw')!.click());
    expect(lines(element)).toBe(source);
    act(() => [...element.querySelectorAll<HTMLButtonElement>('[aria-label="JSON view"] button')].find(button => button.textContent === 'Formatted')!.click());
    openFileActions(element);
    await act(async () => element.querySelector<HTMLButtonElement>('[aria-label="Copy contents"]')!.click());
    expect(writeText).toHaveBeenCalledExactlyOnceWith(source);
    act(() => element.querySelector<HTMLButtonElement>('[aria-label="Download file"]')!.click());
    expect(onDownloadFile).toHaveBeenCalledOnce();
    expect(documents.change).not.toHaveBeenCalled();
    expect(documents.save).not.toHaveBeenCalled();
    expect(draft.content).toBe(source);
    expect(draft.phase).toBe('clean');
    // Entering edit mode must use the original source, not the formatted preview.
    act(() => root!.render(<GraphWorkspacePreviewPane {...props({ documents: { ...documents, documents: new Map([[node.path, { ...draft, editing: true }]]) }, canSaveDocument: true })} />));
    expect(element.querySelector('[aria-label="JSON view"]')).toBeNull();
    expect(element.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe(source);
  });

  it.each([
    { content: '{"broken":', truncated: false },
    { content: source, truncated: true },
    { content: '"' + 'a'.repeat(MAX_JSON_PREVIEW_CHARS) + '"', truncated: false },
  ])('keeps invalid, partial and oversized previews raw ($truncated)', extra => {
    const element = render(<GraphWorkspacePreviewPane {...props({ previewFile: { ...preview, ...extra, size: extra.content.length, nextOffset: extra.content.length } })} />);
    expect(element.querySelector('[aria-label="JSON view"]')).toBeNull();
    expect(lines(element)).toBe(extra.content);
  });

  it('explains when source JSON is already formatted while copying preserves its final newline', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const content = '{\n  "version": 1\n}\n';
    const element = render(<GraphWorkspacePreviewPane {...props({ previewFile: { ...preview, content } })} />);
    const group = element.querySelector('[aria-label="JSON view"]')!;
    const raw = [...group.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Raw')!;
    const note = element.querySelector('.workspace-json-formatted-status')!;
    expect(note.textContent).toBe('Already formatted');
    expect(group.contains(note)).toBe(false);
    expect(note.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(raw.getAttribute('aria-disabled')).toBe('true');
    expect(raw.getAttribute('aria-describedby')).toBe(note.id);
    act(() => raw.click());
    expect(group.querySelector('button[aria-pressed="true"]')?.textContent).toBe('Formatted');
    expect(lines(element).trimEnd()).toBe(content.trimEnd());
    openFileActions(element);
    await act(async () => element.querySelector<HTMLButtonElement>('[aria-label="Copy contents"]')!.click());
    expect(writeText).toHaveBeenCalledExactlyOnceWith(content);
  });

  it('keeps Raw enabled for multiline JSON with different indentation and inline arrays', () => {
    const content = '{\n    "values": [1, 2]\n}';
    const element = render(<GraphWorkspacePreviewPane {...props({ previewFile: { ...preview, content } })} />);
    const raw = [...element.querySelectorAll<HTMLButtonElement>('[aria-label="JSON view"] button')].find(button => button.textContent === 'Raw')!;
    expect(raw.getAttribute('aria-disabled')).toBeNull();
    expect(element.querySelector('.workspace-json-formatted-status')).toBeNull();
    expect(lines(element)).toContain('\n  "values": [\n');
    act(() => raw.click());
    expect(lines(element)).toBe(content);
  });

  it('shows Formatted when a refreshed file becomes equivalent while Raw was selected', () => {
    const element = render(<GraphWorkspacePreviewPane {...props()} />);
    act(() => [...element.querySelectorAll<HTMLButtonElement>('[aria-label="JSON view"] button')].find(button => button.textContent === 'Raw')!.click());
    const content = '{\n  "version": 1\n}\n';
    act(() => root!.render(<GraphWorkspacePreviewPane {...props({ previewFile: { ...preview, content } })} />));
    expect(element.querySelector('[aria-label="JSON view"] button[aria-pressed="true"]')?.textContent).toBe('Formatted');
    expect(element.querySelector('[aria-label="JSON view"] button[aria-disabled="true"]')?.getAttribute('aria-pressed')).toBe('false');
    expect(lines(element).trimEnd()).toBe(content.trimEnd());
  });

  it('formats debug event JSON without a mode toggle or editing and copies its original text', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const detail = '{"id":"debug-call","progress":{"status":"complete"}}';
    const eventNode: WorkspaceTreeNode = { ...node, id: 'event', kind: 'event', path: 'thread-events:/turn-a/001-tool-call.json', detail };
    const element = render(<GraphWorkspacePreviewPane {...props({ previewFile: null, selectedTarget: { kind: 'event', node: eventNode } })} />);
    expect(lines(element)).toBe('{\n  "id": "debug-call",\n  "progress": {\n    "status": "complete"\n  }\n}');
    expect(element.querySelector('[aria-label="JSON view"]')).toBeNull();
    expect(element.querySelector('textarea')).toBeNull();
    openFileActions(element);
    expect(element.querySelector('[aria-label="Edit file"]')).toBeNull();
    await act(async () => element.querySelector<HTMLButtonElement>('[aria-label="Copy contents"]')!.click());
    expect(writeText).toHaveBeenCalledExactlyOnceWith(detail);
  });

  it('keeps debug events read-only when a previous file snapshot is still present', () => {
    const draft = newDraft('json-key', { ...preview, workspaceRevision: '1', fileIdentity: 'file-1', contentHash: 'hash', encoding: 'utf-8', bom: false, eol: 'lf', readOnlyReason: null });
    const documents: WorkspaceDocuments = { documents: new Map([[node.path, draft]]), source: 'json-test', load: vi.fn(), change: vi.fn(), setEditing: vi.fn(), discard: vi.fn(), save: vi.fn(), reconcile: vi.fn(), adoptDisk: vi.fn(), checkDisk: vi.fn(), acceptVerifiedDisk: vi.fn() };
    const eventNode: WorkspaceTreeNode = { ...node, id: 'event', kind: 'event', path: 'thread-events:/turn-a/001-tool-call.json', detail: '{"event":true}' };
    const element = render(<GraphWorkspacePreviewPane {...props({ selectedTarget: { kind: 'event', node: eventNode }, documents, canSaveDocument: true })} />);
    openFileActions(element);
    expect(element.querySelector('[aria-label="Edit file"]')).toBeNull();
    expect(element.querySelector('[aria-label="JSON view"]')).toBeNull();
    expect(documents.setEditing).not.toHaveBeenCalled();
    expect(documents.save).not.toHaveBeenCalled();
  });

  it('preserves linked source line numbers and resets Raw when switching files', () => {
    const element = render(<GraphWorkspacePreviewPane {...props({ focusLine: 1 })} />);
    expect(element.querySelector('[aria-label="JSON view"]')).toBeNull();
    expect(lines(element)).toBe(source);
    act(() => root!.render(<GraphWorkspacePreviewPane {...props()} />));
    act(() => [...element.querySelectorAll<HTMLButtonElement>('[aria-label="JSON view"] button')].find(button => button.textContent === 'Raw')!.click());
    const other = { ...node, id: 'other', path: 'other.json', name: 'other.json' };
    act(() => root!.render(<GraphWorkspacePreviewPane {...props({ selectedTarget: { kind: 'workspace-file', node: other }, previewFile: { ...preview, path: other.path, name: other.name } })} />));
    expect(element.querySelector('[aria-label="JSON view"] button[aria-pressed="true"]')?.textContent).toBe('Formatted');
  });
});

describe('copy preview contents', () => {
  const node: WorkspaceTreeNode = { id: 'copy-file', name: 'notes.md', path: 'notes.md', kind: 'file', children: [] };
  const source = '# Raw contents\r\n\r\n**Bold** and [link](./other.md) 🧪\r\n' + 'complete source text\n'.repeat(100);
  const preview = { path: node.path, name: node.name, language: 'markdown', content: source, size: source.length, truncated: false, nextOffset: source.length };
  const props = (extra: Partial<ComponentProps<typeof GraphWorkspacePreviewPane>> = {}): ComponentProps<typeof GraphWorkspacePreviewPane> => ({
    plugins: createDefaultPluginContextValue(), selectedTarget: { kind: 'workspace-file', node }, previewFile: preview, ...extra,
  });
  const copyButton = (element: HTMLElement) => element.querySelector<HTMLButtonElement>('button[aria-label="Copy contents"]')!;
  function clipboard(writeText: ReturnType<typeof vi.fn> | undefined) {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: writeText ? { writeText } : undefined });
  }
  function fallback(result: boolean | Error) {
    const execCommand = vi.fn(() => {
      if (result instanceof Error) throw result;
      return result;
    });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
    return execCommand;
  }

  it('copies the entire raw Markdown source from file actions and visibly confirms it', async () => {
    const writeText = vi.fn(async () => undefined);
    clipboard(writeText);
    const element = render(<GraphWorkspacePreviewPane {...props()} />);
    expect(copyButton(element)).toBeNull();
    expect(element.querySelector('.workspace-file-actions')).toBeNull();
    openFileActions(element);
    expect(element.querySelector('.workspace-file-actions')?.contains(copyButton(element))).toBe(true);
    expect(element.querySelector('.workspace-file-toolbar')?.contains(copyButton(element))).toBe(false);
    expect(element.querySelectorAll('button[aria-label="Copy contents"]')).toHaveLength(1);
    expect(element.querySelector('[aria-label="Copy path"]')).toBeNull();
    await act(async () => copyButton(element).click());
    expect(writeText).toHaveBeenCalledExactlyOnceWith(source);
    expect(element.querySelector('[role="status"]')?.textContent).toBe('Contents copied');
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('keeps content copy available with file tabs', async () => {
    const writeText = vi.fn(async () => undefined);
    clipboard(writeText);
    const element = render(<GraphWorkspacePreviewPane {...props({ activeFilePath: node.path, fileTabs: [{ path: node.path, name: node.name, pinned: true }], onCloseFileTab: vi.fn(), onSelectFileTab: vi.fn() })} />);
    expect(element.querySelector('[role="tablist"]')).not.toBeNull();
    expect(copyButton(element)).toBeNull();
    openFileActions(element);
    expect(element.querySelector('.workspace-file-actions')?.contains(copyButton(element))).toBe(true);
    expect(element.querySelector('.thread-graph-editor-tabs-action')?.contains(copyButton(element))).toBe(false);
    await act(async () => copyButton(element).click());
    expect(writeText).toHaveBeenCalledWith(source);
    expect(element.textContent).toContain('Contents copied');
  });

  it('copies full event JSON instead of the short tree preview or a stale workspace file', async () => {
    const writeText = vi.fn(async () => undefined);
    clipboard(writeText);
    const detail = JSON.stringify({ id: 'event-1', kind: 'message', text: 'Full event content '.repeat(100), extra: { nested: true } }, null, 2);
    const event: WorkspaceTreeNode = { id: 'event-1', name: '001-message.json', path: 'thread-events:/turn/001-message.json', kind: 'event', children: [], detail, preview: 'Full event content' };
    const element = render(<GraphWorkspacePreviewPane {...props({ selectedTarget: { kind: 'event', node: event } })} />);
    expect(element.querySelector('.thread-graph-file-preview-header')).toBeNull();
    openFileActions(element);
    await act(async () => copyButton(element).click());
    expect(writeText).toHaveBeenCalledExactlyOnceWith(detail);
    expect(element.textContent).toContain('Contents copied');
  });

  it('copies all currently loaded text of a truncated preview', async () => {
    const writeText = vi.fn(async () => undefined);
    clipboard(writeText);
    const element = render(<GraphWorkspacePreviewPane {...props({ previewFile: { ...preview, truncated: true, size: source.length * 2 } })} />);
    openFileActions(element);
    await act(async () => copyButton(element).click());
    expect(writeText).toHaveBeenCalledExactlyOnceWith(source);
  });

  it('copies the current unsaved draft rather than its disk snapshot', async () => {
    const writeText = vi.fn(async () => undefined);
    clipboard(writeText);
    const draft = editDraft(newDraft('draft-key', { ...preview, workspaceRevision: '1', fileIdentity: 'file-1', contentHash: 'hash', encoding: 'utf-8', bom: false, eol: 'lf', readOnlyReason: null }), 'Unsaved draft\n');
    const documents: WorkspaceDocuments = { documents: new Map([[node.path, draft]]), source: 'copy-test', load: vi.fn(), change: vi.fn(), setEditing: vi.fn(), discard: vi.fn(), save: vi.fn(), reconcile: vi.fn(), adoptDisk: vi.fn(), checkDisk: vi.fn(), acceptVerifiedDisk: vi.fn() };
    const element = render(<GraphWorkspacePreviewPane {...props({ documents })} />);
    openFileActions(element);
    await act(async () => copyButton(element).click());
    expect(writeText).toHaveBeenCalledExactlyOnceWith('Unsaved draft\n');
  });

  it('keeps copy, refresh and download attached to the preview file during directory navigation', async () => {
    const writeText = vi.fn(async () => undefined);
    clipboard(writeText);
    const draft = newDraft('draft-key', { ...preview, workspaceRevision: '1', fileIdentity: 'file-1', contentHash: 'hash', encoding: 'utf-8', bom: false, eol: 'lf', readOnlyReason: null });
    const documents: WorkspaceDocuments = { documents: new Map([[node.path, draft]]), source: 'copy-test', load: vi.fn(), change: vi.fn(), setEditing: vi.fn(), discard: vi.fn(), save: vi.fn(), reconcile: vi.fn(), adoptDisk: vi.fn(), checkDisk: vi.fn(), acceptVerifiedDisk: vi.fn() };
    const directory: WorkspaceTreeNode = { id: 'directory', path: 'docs/guides', name: 'guides', kind: 'directory', children: [] };
    const onDownloadFile = vi.fn();
    const element = render(<GraphWorkspacePreviewPane {...props({ documents, breadcrumbNode: directory, onShowTree: vi.fn(), onDownloadFile })} />);
    expect(element.querySelector('[aria-current="page"]')?.textContent).toBe('guides');
    expect(element.querySelector('h1')?.textContent).toBe('Raw contents');
    openFileActions(element);
    const shelf = element.querySelector('.workspace-file-actions')!;
    expect(shelf.querySelectorAll('[aria-label="Copy contents"]')).toHaveLength(1);
    expect(shelf.querySelector('[aria-label="Copy path"]')).toBeNull();
    await act(async () => copyButton(element).click());
    expect(writeText).toHaveBeenCalledExactlyOnceWith(source);
    await act(async () => shelf.querySelector<HTMLButtonElement>('button[aria-label="Reload from disk"]')!.click());
    expect(documents.checkDisk).toHaveBeenCalledExactlyOnceWith(node.path);
    act(() => shelf.querySelector<HTMLButtonElement>('button[aria-label="Download file"]')!.click());
    expect(onDownloadFile).toHaveBeenCalledTimes(1);
  });

  it('copies an empty file successfully', async () => {
    const writeText = vi.fn(async () => undefined);
    clipboard(writeText);
    const element = render(<GraphWorkspacePreviewPane {...props({ previewFile: { ...preview, content: '', size: 0, nextOffset: 0 } })} />);
    openFileActions(element);
    await act(async () => copyButton(element).click());
    expect(writeText).toHaveBeenCalledExactlyOnceWith('');
    expect(element.textContent).toContain('Contents copied');
  });

  it.each(['unavailable', 'rejected'] as const)('uses a textarea fallback when the clipboard API is %s and restores focus and selection', async (availability) => {
    clipboard(availability === 'rejected' ? vi.fn(async () => { throw new Error('Permission denied'); }) : undefined);
    const execCommand = fallback(true);
    const element = render(<GraphWorkspacePreviewPane {...props()} />);
    openFileActions(element);
    copyButton(element).focus();
    const text = element.querySelector('h1')!.firstChild!;
    const range = document.createRange();
    range.selectNodeContents(text);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    execCommand.mockImplementation(() => {
      const field = document.activeElement as HTMLTextAreaElement;
      expect(field.tagName).toBe('TEXTAREA');
      const textareaSource = source.replace(/\r\n/g, '\n');
      expect(field.value).toBe(textareaSource);
      expect(field.selectionEnd).toBe(textareaSource.length);
      return true;
    });
    await act(async () => copyButton(element).click());
    expect(execCommand).toHaveBeenCalledExactlyOnceWith('copy');
    expect(element.textContent).toContain('Contents copied');
    expect(document.activeElement).toBe(copyButton(element));
    expect(window.getSelection()!.toString()).toBe('Raw contents');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it.each([false, new Error('Copy denied')])('shows a visible failure when fallback fails (%s), and allows retry', async (failure) => {
    clipboard(vi.fn(async () => { throw new Error('Permission denied'); }));
    fallback(failure);
    const element = render(<GraphWorkspacePreviewPane {...props()} />);
    openFileActions(element);
    await act(async () => copyButton(element).click());
    expect(element.querySelector('[role="alert"]')?.textContent).toBe('Could not copy contents. Try again or select and copy the text.');
    expect(element.textContent).not.toContain('Contents copied');
    expect(copyButton(element).disabled).toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
    const writeText = vi.fn(async () => undefined);
    clipboard(writeText);
    await act(async () => copyButton(element).click());
    expect(writeText).toHaveBeenCalledWith(source);
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.textContent).toContain('Contents copied');
  });

  it('reports failure when neither clipboard API nor legacy copy is available', async () => {
    clipboard(undefined);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: undefined });
    const element = render(<GraphWorkspacePreviewPane {...props()} />);
    openFileActions(element);
    await act(async () => copyButton(element).click());
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Could not copy contents.');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('ignores a delayed result after selecting another file', async () => {
    let finish!: () => void;
    const writeText = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    clipboard(writeText);
    const element = render(<GraphWorkspacePreviewPane {...props()} />);
    openFileActions(element);
    act(() => copyButton(element).click());
    expect(copyButton(element).getAttribute('aria-disabled')).toBe('true');
    expect(element.textContent).toContain('Copying contents…');
    act(() => copyButton(element).click());
    expect(writeText).toHaveBeenCalledTimes(1);
    const next = { ...node, id: 'next', path: 'next.md', name: 'next.md' };
    act(() => root!.render(<GraphWorkspacePreviewPane {...props({ selectedTarget: { kind: 'workspace-file', node: next }, previewFile: { ...preview, path: next.path, name: next.name } })} />));
    await act(async () => finish());
    expect(element.textContent).not.toContain('Contents copied');
    expect(copyButton(element)).toBeNull();
    openFileActions(element);
    expect(copyButton(element).getAttribute('aria-disabled')).toBe('false');
  });

  it.each([{ previewLoading: true }, { downloadOnly: true }, { imageUrl: '/image.png' }, { pdfUrl: '/report.pdf' }, { previewFile: null }])('omits content copy when text is unavailable: %j', (extra) => {
    const element = render(<GraphWorkspacePreviewPane {...props(extra)} />);
    openFileActions(element);
    expect(copyButton(element)).toBeNull();
  });
});

describe('preview directory breadcrumbs', () => {
  const node: WorkspaceTreeNode = { id: 'docs-file', path: '/workspace/demo/docs/guides/setup.md', name: 'setup.md', kind: 'file', children: [] };

  it.each([
    { path: 'docs/guides', name: 'guides', ancestors: ['demo', 'docs'], current: 'guides', targets: [undefined, 'docs'] },
    { path: '/workspace/demo/docs/guides', name: 'guides', ancestors: ['demo', 'docs'], current: 'guides', targets: [undefined, 'docs'] },
    { path: 'thread-events:/turn-123', name: 'turn-123', ancestors: ['demo', 'thread-events'], current: 'turn-123', targets: [undefined, 'thread-events:'] },
    { path: 'thread-events:', name: 'thread-events', ancestors: ['demo'], current: 'thread-events', targets: [undefined] },
    { path: 'artifacts:', name: 'artifacts', ancestors: ['demo'], current: 'artifacts', targets: [undefined] },
    { path: 'live:/turn-123', name: 'turn-123', ancestors: ['demo', 'live'], current: 'turn-123', targets: [undefined, 'live:'] },
    { path: '', name: 'demo', ancestors: [], current: 'demo', targets: [] },
    { path: '/workspace/demo', name: 'demo', ancestors: [], current: 'demo', targets: [] },
  ])('shows the navigated directory as the current breadcrumb: $path', ({ path, name, ancestors, current, targets }) => {
    const onShowTree = vi.fn();
    const breadcrumbNode: WorkspaceTreeNode = { id: 'directory', kind: 'directory', path, name, children: [] };
    const element = render(<GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()}
      selectedTarget={{ kind: 'workspace-file', node }} breadcrumbNode={breadcrumbNode} workspaceRootPath="/workspace/demo" onShowTree={onShowTree} />);
    const breadcrumbs = element.querySelector('.workspace-file-breadcrumbs')!;
    const buttons = [...breadcrumbs.querySelectorAll('button')];
    expect(buttons.map(button => button.textContent)).toEqual(ancestors);
    expect(breadcrumbs.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(breadcrumbs.querySelector('[aria-current="page"]')?.textContent).toBe(current);
    expect(breadcrumbs.textContent).not.toContain('setup.md');
    buttons.forEach((button, index) => {
      act(() => button.click());
      if (targets[index] === undefined) expect(onShowTree).toHaveBeenLastCalledWith();
      else expect(onShowTree).toHaveBeenLastCalledWith(targets[index]);
    });
  });

  it('shows directory breadcrumbs when no preview file is selected', () => {
    const breadcrumbNode: WorkspaceTreeNode = { id: 'directory', kind: 'directory', path: 'docs/guides', name: 'guides', children: [] };
    const element = render(<GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()}
      selectedTarget={null} breadcrumbNode={breadcrumbNode} workspaceRootPath="/workspace/demo" onShowTree={vi.fn()} />);
    expect(element.querySelector('[aria-current="page"]')?.textContent).toBe('guides');
    openFileActions(element);
    expect(element.querySelector('.workspace-file-actions')).toBeNull();
    expect(element.querySelector('[aria-label="Copy contents"]')).toBeNull();
  });

  it.each([false, true])('reveals root and parent directories without opening them as files (tabs: %s)', (withTabs) => {
    const onShowTree = vi.fn();
    const onOpenWorkspaceFile = vi.fn();
    const element = render(<GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()}
      selectedTarget={{ kind: 'workspace-file', node }} workspaceRootPath="/workspace/demo" onShowTree={onShowTree} onOpenWorkspaceFile={onOpenWorkspaceFile}
      {...(withTabs ? { activeFilePath: node.path, fileTabs: [{ path: node.path, name: node.name, pinned: true }], onCloseFileTab: vi.fn(), onSelectFileTab: vi.fn() } : {})} />);
    const breadcrumbs = element.querySelector('.workspace-file-breadcrumbs')!;
    const buttons = [...breadcrumbs.querySelectorAll('button')];
    expect(buttons.map(button => button.textContent)).toEqual(['demo', 'docs', 'guides']);
    expect(breadcrumbs.querySelector('[aria-current="page"]')?.textContent).toBe('setup.md');
    if (withTabs) expect(breadcrumbs.compareDocumentPosition(element.querySelector('[role="tablist"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    act(() => buttons[0].click());
    expect(onShowTree).toHaveBeenLastCalledWith();
    act(() => buttons[1].click());
    expect(onShowTree).toHaveBeenLastCalledWith('docs');
    act(() => buttons[2].click());
    expect(onShowTree).toHaveBeenLastCalledWith('docs/guides');
    expect(onOpenWorkspaceFile).not.toHaveBeenCalled();
  });

  it('keeps external linked paths as text rather than workspace directory links', () => {
    const onShowTree = vi.fn();
    const element = render(<GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()}
      selectedTarget={{ kind: 'workspace-file', node: { ...node, path: '/tmp/external/setup.md' } }}
      workspaceRootPath="/workspace/demo" onShowTree={onShowTree} />);
    expect(element.querySelectorAll('.workspace-file-breadcrumbs button')).toHaveLength(1);
    expect(element.querySelector('.workspace-file-breadcrumb-current')?.textContent).toBe('/tmp/external/setup.md');
  });

  it('renders clickable thread event virtual directories and the full current filename', () => {
    const onShowTree = vi.fn();
    const event: WorkspaceTreeNode = { id: 'event', path: 'thread-events:/turn-123/001-reasoning.json', name: '001-reasoning.json', kind: 'event', children: [], detail: '{"kind":"reasoning"}' };
    const element = render(<GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()}
      selectedTarget={{ kind: 'event', node: event }} onShowTree={onShowTree} workspaceRootPath="/workspace/demo" />);
    const breadcrumbs = element.querySelector('.workspace-file-breadcrumbs')!;
    const buttons = [...breadcrumbs.querySelectorAll('button')];
    expect(buttons.map(button => button.textContent)).toEqual(['demo', 'thread-events', 'turn-123']);
    expect(breadcrumbs.querySelector('[aria-current="page"]')?.textContent).toBe('001-reasoning.json');
    expect(element.querySelector('.thread-graph-viewer-header')).toBeNull();
    act(() => buttons[1].click());
    expect(onShowTree).toHaveBeenLastCalledWith('thread-events:');
    act(() => buttons[2].click());
    expect(onShowTree).toHaveBeenLastCalledWith('thread-events:/turn-123');
    expect(element.querySelector('[aria-label="Copy contents"]')).toBeNull();
    openFileActions(element);
    expect(element.querySelector('.workspace-file-actions [aria-label="Copy contents"]')).not.toBeNull();
  });

  it('supports directory breadcrumbs through the existing file-open callback when no tree callback exists', () => {
    const onOpenWorkspaceFile = vi.fn();
    const element = render(<GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()}
      selectedTarget={{ kind: 'workspace-file', node }} workspaceRootPath="/workspace/demo" onOpenWorkspaceFile={onOpenWorkspaceFile} />);
    const buttons = [...element.querySelectorAll<HTMLButtonElement>('.workspace-file-breadcrumbs button')];
    expect(buttons.map(button => button.textContent)).toEqual(['docs', 'guides']);
    act(() => buttons[1].click());
    expect(onOpenWorkspaceFile).toHaveBeenCalledExactlyOnceWith('docs/guides');
  });
});

describe('preview navigation controls', () => {
  const node: WorkspaceTreeNode = { id: 'file', path: 'current.txt', name: 'current.txt', kind: 'file', children: [] };
  it.each([false, true])('keeps file history back and forward in the file bar (tabs: %s)', (withTabs) => {
    const onNavigateBack = vi.fn();
    const onNavigateForward = vi.fn();
    const element = render(<GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()} selectedTarget={{ kind: 'workspace-file', node }}
      previousFilePath="docs/previous.md" onNavigateBack={onNavigateBack} onNavigateForward={onNavigateForward}
      {...(withTabs ? { activeFilePath: node.path, fileTabs: [{ path: node.path, name: node.name, pinned: true }], onCloseFileTab: vi.fn(), onSelectFileTab: vi.fn() } : {})} />);
    const bar = element.querySelector('.workspace-file-toolbar')!;
    const back = bar.querySelector<HTMLButtonElement>('button:has([data-icon="back"])')!;
    const forward = bar.querySelector<HTMLButtonElement>('button:has([data-icon="forward"])')!;
    expect(back.title).toContain('previous.md');
    act(() => back.click());
    act(() => forward.click());
    expect(onNavigateBack).toHaveBeenCalledTimes(1);
    expect(onNavigateForward).toHaveBeenCalledTimes(1);
    expect(element.querySelector('[aria-label="File actions"]')).not.toBeNull();
  });

  it('shows no tree-only back arrow or viewer toggle without file history', () => {
    const element = render(<GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()}
      selectedTarget={{ kind: 'event', node: { ...node, kind: 'event', detail: '{}' } }} onShowTree={vi.fn()} />);
    expect(element.querySelector('[data-icon="back"]')).toBeNull();
    expect(element.querySelector('[aria-label="Show Explorer"]')).toBeNull();
    expect(element.querySelector('[aria-label="Hide Editor"]')).toBeNull();
    expect(element.querySelector('[aria-label="Copy contents"]')).toBeNull();
    openFileActions(element);
    expect(element.querySelector('.workspace-file-actions [aria-label="Copy contents"]')).not.toBeNull();
    expect(element.querySelector('[aria-label="File actions"]')).not.toBeNull();
  });
});

describe('missing linked file', () => {
  it('names a linked file that is not on this device and copies its path, without an error banner', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const path = '/home/me/other-worktree/.scratch/review/REPORT.md';
    const element = render(<GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()} selectedTarget={null} missingPath={path} />);
    expect(element.querySelector('[role=alert]')).toBeNull();
    expect(element.querySelector('.workspace-missing-file-title')?.textContent).toBe('REPORT.md is not on this device');
    expect(element.querySelector('.workspace-missing-file-path')?.textContent).toBe(path);
    await act(async () => { element.querySelector<HTMLButtonElement>('.workspace-missing-file-copy')!.click(); });
    expect(writeText).toHaveBeenCalledWith(path);
    expect(element.querySelector('.workspace-missing-file-copy')?.textContent).toBe('Copied');
  });

  it('shows the plain empty state when nothing is selected or missing', () => {
    const element = render(<GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()} selectedTarget={null} />);
    expect(element.textContent).toContain('Choose a file to view.');
    expect(element.querySelector('.workspace-missing-file')).toBeNull();
  });
});

describe('files that cannot be previewed', () => {
  const themeNode: WorkspaceTreeNode = { id: 'theme', path: '.scratch/elysia.pockytheme', name: 'elysia.pockytheme', kind: 'file', size: 241855, children: [] };

  it('offers the download of a file that is not text, with that reason', () => {
    const element = render(<GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()}
      selectedTarget={{ kind: 'workspace-file', node: themeNode }} downloadOnly downloadReason="unsupportedEncodingOrBinaryFile" onDownloadFile={() => undefined} />);
    expect(element.querySelector('[role=alert]')).toBeNull();
    expect(element.textContent).toContain('This file is not text, so it cannot be previewed.');
    expect(element.querySelector('button[aria-label="Download elysia.pockytheme"]')).not.toBeNull();
  });

  it('puts the download beside a file error', async () => {
    const onDownloadFile = vi.fn(async () => undefined);
    const element = render(<GraphWorkspacePreviewPane plugins={createDefaultPluginContextValue()}
      selectedTarget={{ kind: 'workspace-file', node: themeNode }} error="unsupportedEncodingOrBinaryFile" onDownloadFile={onDownloadFile} />);
    const alert = element.querySelector('[role=alert]')!;
    expect(alert.textContent).toContain('This file is not text, so it cannot be previewed.');
    await act(async () => { alert.querySelector<HTMLButtonElement>('.workspace-file-alert-download')!.click(); });
    expect(onDownloadFile).toHaveBeenCalledTimes(1);
  });
});
