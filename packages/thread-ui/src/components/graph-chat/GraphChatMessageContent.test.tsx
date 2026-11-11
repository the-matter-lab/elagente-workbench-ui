// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { GraphChatMessageContent } from './GraphChatMessageContent';
import { createWorkspacePathResolver } from '../workspacePathLinks';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(node);
  });
  return container;
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
});

describe('GraphChatMessageContent', () => {
  it('reveals code actions only for touch/pen taps and clears them when switching to a mouse', () => {
    const element = render(<GraphChatMessageContent content={'```js\nconst value = 1;\n```'} />);
    const block = element.querySelector('.thread-graph-code-block')!;
    const code = block.querySelector('code')!;
    const button = block.querySelector('button')!;
    const pointer = (target: Element, type: string, pointerType: string) => {
      const event = new MouseEvent(type, { bubbles: true });
      Object.defineProperty(event, 'pointerType', { value: pointerType });
      act(() => { target.dispatchEvent(event); });
    };
    pointer(code, 'pointerup', 'mouse');
    expect(block.getAttribute('data-touch-actions')).toBe('false');
    pointer(code, 'pointerup', 'touch');
    expect(block.getAttribute('data-touch-actions')).toBe('true');
    pointer(button, 'pointerup', 'touch');
    expect(block.getAttribute('data-touch-actions')).toBe('true');
    pointer(code, 'pointerup', 'touch');
    expect(block.getAttribute('data-touch-actions')).toBe('false');
    pointer(code, 'pointerup', 'pen');
    expect(block.getAttribute('data-touch-actions')).toBe('true');
    pointer(block, 'pointerover', 'mouse');
    expect(block.getAttribute('data-touch-actions')).toBe('false');
  });

  it('renders README HTML, linked image dimensions and collapsible Markdown without executing embedded content', () => {
    const element = render(<GraphChatMessageContent content={[
      '<p align="center"><a href="https://example.com/docs"><img alt="English" src="https://example.com/badge.svg" width="88" onerror="alert(1)"></a></p>',
      '<h1 align="center"><img src="https://example.com/logo.png" alt="Logo" width="44"> Project</h1>',
      '<details><summary>Install</summary>\n\n**Run** `setup`<br>Next step\n\n</details>',
      '<script>alert(1)</script><style>body { display:none }</style><iframe src="https://example.com"></iframe><a href="javascript:alert(1)">Unsafe link</a>',
      '```html\n<p align="center">Literal example</p>\n```',
      '$E=mc^2$',
    ].join('\n\n')} />);
    expect(element.querySelector('p[align="center"] a img')?.getAttribute('src')).toBe('https://example.com/badge.svg');
    expect(element.querySelector('a button')).toBeNull();
    expect((element.querySelector('a img') as HTMLImageElement).style.width).toBe('88px');
    expect(element.querySelector('h1')?.textContent).toBe(' Project');
    expect(element.querySelector('details summary')?.textContent).toBe('Install');
    expect(element.querySelector('details strong')?.textContent).toBe('Run');
    expect(element.querySelector('details br')).not.toBeNull();
    expect(element.querySelector('script, style, iframe, [onerror], a[href^="javascript:"]')).toBeNull();
    expect(element.querySelector('pre code')?.textContent).toContain('<p align="center">Literal example</p>');
    expect(element.querySelector('.katex')).not.toBeNull();
  });
  it('parses CJK emphasis while preserving literal stars in code and escapes', () => {
    const element = render(<GraphChatMessageContent content={'对，**原生 Mac 使用 `proxy-env`。**如果继续。\n\n核心是：**两种模式。**文件共享。\n\n`**literal**` 和 \\*\\*escaped\\*\\*'} />);
    expect(Array.from(element.querySelectorAll('strong')).map(node => node.textContent)).toEqual(['原生 Mac 使用 proxy-env。', '两种模式。']);
    expect(element.textContent).toContain('**literal**');
    expect(element.textContent).toContain('**escaped**');
  });

  it('renders inline and display LaTeX through KaTeX', () => {
    const element = render(
      <GraphChatMessageContent
        content={'Inline $E = mc^2$\n\n$$\n\\int_0^1 x^2 dx\n$$'}
      />,
    );

    expect(element.querySelector('.katex')).not.toBeNull();
    expect(element.querySelector('.katex-display')).not.toBeNull();
  });

  it('renders backslash-delimited Chinese formulas without changing code or escaped delimiters', () => {
    const formula = String.raw`(x,y)\longmapsto\text{这个位置的像素颜色}`;
    const element = render(<GraphChatMessageContent content={[
      `\\[\n${formula}\n\\]`,
      String.raw`行内 \(x_i^2\) 和 $E=mc^2$。`,
      String.raw`\[\begin{matrix}a\\b\end{matrix}\]`,
      '`\\(literal\\)`',
      '```tex\n\\[literal\\]\n```',
      String.raw`\\(escaped\\)`,
      String.raw`不完整 \(x`,
    ].join('\n\n')} />);
    expect(element.querySelectorAll('.katex')).toHaveLength(4);
    expect(element.querySelectorAll('.katex-display')).toHaveLength(2);
    expect(element.querySelector('.katex-error')).toBeNull();
    expect(Array.from(element.querySelectorAll('annotation')).map(node => node.textContent)).toContain(formula);
    expect(element.textContent).toContain('\\(literal\\)');
    expect(element.textContent).toContain('\\[literal\\]');
    expect(element.textContent).toContain('\\(escaped\\)');
    expect(element.textContent).toContain('不完整 (x');
  });

  it('renders completed streamed math inside Markdown containers', () => {
    const element = render(<GraphChatMessageContent content={'引用：\n\n> \\[\n> x_1'} />);
    expect(element.querySelector('.katex')).toBeNull();
    act(() => root!.render(<GraphChatMessageContent content={'引用：\n\n> \\[\n> x_1 + x_2\n> \\]\n\n- 行内 \\(y\\)'} />));
    expect(element.querySelectorAll('.katex')).toHaveLength(2);
    expect(element.querySelector('blockquote .katex-display annotation')?.textContent).toBe('x_1 + x_2');
    expect(element.querySelector('li .katex annotation')?.textContent).toBe('y');
  });

  it('keeps standalone equals and blank lines inside display math while streaming', () => {
    const formula = String.raw`A\sin(\omega x+\phi)
=
A\cos\phi\,\sin(\omega x) + A\sin\phi\,\cos(\omega x)`;
    const content = `说明：\n\\[\n${formula}\n\\]\n\n后续段落。`;
    const element = render(<GraphChatMessageContent content={content} />);
    expect(element.querySelector('.katex-display annotation')?.textContent).toBe(formula);
    expect(element.querySelector('h2')).toBeNull();
    expect(element.textContent).toContain('后续段落。');
    act(() => root!.render(<GraphChatMessageContent content={'引用：\n\n> \\[\n> x\n> =\n>\n> y'} />));
    expect(element.querySelector('.katex')).toBeNull();
    act(() => root!.render(<GraphChatMessageContent content={'引用：\n\n> \\[\n> x\n> =\n>\n> y\n> \\]\n\n- 完成'} />));
    expect(element.querySelector('blockquote .katex-display annotation')?.textContent).toBe('x\n=\n\ny');
    expect(element.querySelector('li')?.textContent).toBe('完成');
  });

  it('keeps out-of-workspace local and same-origin image links inside Explorer', () => {
    const open = vi.fn();
    const path = '/Users/mac/.codex/generated_images/test image.png';
    const element = render(<GraphChatMessageContent workspaceRootPath="/Users/mac/dev/treer" onOpenWorkspaceFile={open}
      content={`[Local](<${path}>) [Origin](${window.location.origin}${path.replace(' ', '%20')}) [Remote](https://example.com/image.png)`} />);
    const links = element.querySelectorAll('a');
    for (const link of [links[0], links[1]]) act(() => {link!.dispatchEvent(new MouseEvent('click', {bubbles:true,cancelable:true}));});
    expect(open.mock.calls).toEqual([[{path}], [{path}]]);
    expect(links[2]!.getAttribute('href')).toBe('https://example.com/image.png');
  });

  it('opens root-relative file links through the workspace callback', () => {
    const onOpenWorkspaceFile = vi.fn();
    const element = render(
      <GraphChatMessageContent
        content="[tool-calling.js](/home/u/dev/gemma4/third_party/SillyTavern/public/scripts/tool-calling.js:400)"
        onOpenWorkspaceFile={onOpenWorkspaceFile}
      />,
    );

    const link = element.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('target')).toBeNull();

    act(() => {
      link?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
    });

    expect(onOpenWorkspaceFile).toHaveBeenCalledWith({
      path: '/home/u/dev/gemma4/third_party/SillyTavern/public/scripts/tool-calling.js',
      line: 400,
    });
  });

  it('opens complete same-origin file URLs through the workspace callback', () => {
    const onOpenWorkspaceFile = vi.fn();
    const href = `${window.location.origin}/home/u/treer/docs/architecture.md:44`;
    const element = render(
      <GraphChatMessageContent
        content={`[${href}](${href})`}
        onOpenWorkspaceFile={onOpenWorkspaceFile}
      />,
    );

    const link = element.querySelector('a');
    act(() => {
      link?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
    });

    expect(onOpenWorkspaceFile).toHaveBeenCalledWith({
      path: '/home/u/treer/docs/architecture.md',
      line: 44,
    });
  });

  it('leaves normal external links as browser links', () => {
    const onOpenWorkspaceFile = vi.fn();
    const element = render(
      <GraphChatMessageContent
        content="[docs](https://example.com/docs)"
        onOpenWorkspaceFile={onOpenWorkspaceFile}
      />,
    );

    const link = element.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com/docs');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');

    act(() => {
      link?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
    });

    expect(onOpenWorkspaceFile).not.toHaveBeenCalled();
  });

  it('lets embedded hosts resolve links against their proxy base', () => {
    const resolveHref = vi.fn(
      (href: string) => `https://treer.test/proxy${href}`,
    );
    const element = render(
      <GraphChatMessageContent
        content="[agent docs](/docs)"
        resolveHref={resolveHref}
      />,
    );

    expect(resolveHref).toHaveBeenCalledWith('/docs');
    expect(element.querySelector('a')?.getAttribute('href')).toBe(
      'https://treer.test/proxy/docs',
    );
  });
});

it('keeps Windows drive and file URLs through Markdown sanitization and opens their exact workspace path', () => {
  const open = vi.fn();
  const element = render(<GraphChatMessageContent workspaceRootPath="c:/Users/Admin/美股" onOpenWorkspaceFile={open}
    content={`[Drive](C:/Users/Admin/美股/a.png) [File](file:///C:/Users/Admin/美股/a.png) [Browser](${window.location.origin}/C%3A/Users/Admin/%E7%BE%8E%E8%82%A1/a.png) [Unsafe](javascript:alert)`} />);
  const links = element.querySelectorAll('a');
  for (const link of Array.from(links).slice(0,3)) act(() => {link.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));});
  expect(open.mock.calls).toEqual([[{path:'a.png'}],[{path:'a.png'}],[{path:'a.png'}]]);
  expect(links[3]!.getAttribute('href') ?? '').not.toContain('javascript:');
});

it('makes verified inline and plain paths clickable while leaving missing paths, URLs and fences intact', async () => {
  const open = vi.fn();
  const resolve = vi.fn(async (path: string) => ['docs/assets', 'docs/readme.md'].includes(path));
  let element!: HTMLDivElement;
  await act(async () => {
    element = render(<GraphChatMessageContent workspaceRootPath="/code" resolveWorkspacePath={resolve} onOpenWorkspaceFile={open}
      content={'Files: `docs/assets/`, docs/readme.md. Missing `docs/no.txt`. [Web](https://example.com/docs/readme.md) [`docs/readme.md`](docs/readme.md)\n\n```sh\ncat docs/readme.md\n```'} />);
  });
  const links = Array.from(element.querySelectorAll('a'));
  expect(links.map(link => link.textContent)).toEqual(['docs/assets/', 'docs/readme.md', 'Web', 'docs/readme.md']);
  expect(element.querySelector('a a')).toBeNull();
  expect(element.querySelector('pre a')).toBeNull();
  expect(resolve).not.toHaveBeenCalledWith('https://example.com/docs/readme.md');
  act(() => links[0]!.click());
  expect(open).toHaveBeenCalledWith({ path: 'docs/assets' });
  act(() => links[1]!.click());
  expect(open).toHaveBeenCalledWith({ path: 'docs/readme.md' });
});

it('links an auto-detected path under a folder hidden by default (ELA-260)', async () => {
  const open = vi.fn();
  // runs/ is in .workbenchignore: only a listing with hidden entries contains it.
  const listTree = vi.fn(async ({ path, showHidden }: { path?: string | null; showHidden?: boolean }) => ({
    name: 'abc', path: path ?? '', kind: 'directory' as const,
    children: !showHidden ? [] : path === 'runs/abc' ? [{ name: 'x.out', path: 'runs/abc/x.out', kind: 'file' as const }]
      : path === '' ? [{ name: 'runs', path: 'runs', kind: 'directory' as const }] : [],
  }));
  const resolve = createWorkspacePathResolver({ listTree, hiddenFiles: true }, { threadId: 't' }, '/code');
  let element!: HTMLDivElement;
  await act(async () => {
    element = render(<GraphChatMessageContent workspaceRootPath="/code" resolveWorkspacePath={resolve} onOpenWorkspaceFile={open}
      content={'The output is runs/abc/x.out; runs/abc/none.out was not written.'} />);
  });
  await vi.waitFor(() => expect(Array.from(element.querySelectorAll('a')).map(link => link.textContent)).toEqual(['runs/abc/x.out']));
  act(() => element.querySelector('a')!.click());
  expect(open).toHaveBeenCalledWith({ path: 'runs/abc/x.out' });
});
