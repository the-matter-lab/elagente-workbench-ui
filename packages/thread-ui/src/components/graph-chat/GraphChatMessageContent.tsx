import { translate, useI18n } from '../../i18n';
import { externalLinkProps } from '../externalLinkProps';
import {
  memo,
  createContext,
  useContext,
  useEffect,
  isValidElement,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';
import { CopyButton } from '../copy/CopyButton';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkCjkFriendly from 'remark-cjk-friendly';
import remarkMath from 'remark-math';
import { remarkLatex } from './remarkLatex';
import 'katex/dist/katex.min.css';

import { localFileHref, relativeWorkspacePath } from '../workspacePaths';
import { ZoomableImage, MarkdownImageLinkContext } from '../ZoomableImage';
import { markdownHtmlPlugins } from '../markdownHtml';
import { WorkspaceFileLink } from '../WorkspaceFileLink';
import { VerifiedWorkspacePath } from '../VerifiedWorkspacePath';
import { parseWorkspacePathText, remarkWorkspacePaths, type WorkspacePathResolver } from '../workspacePathLinks';
import { usePlugins } from '../../plugins/usePlugins';
import { GraphChatToolCall } from './GraphChatToolCall';
import { getGraphChatHighlighter, syntaxThemeFor } from './graphChatShiki';
import { useThemeFeature } from '../themeHooks';
import { GraphChatMermaidDiagram } from './GraphChatMermaidDiagram';
import { hasClosedMarkdownFence, isMermaidCode } from './graphChatMermaid';
import {
  createEmptyGraphChatToolResultState,
  getGraphChatToolUiStatus,
  mergeGraphChatToolResultState,
  preprocessGraphChatToolBlocks,
  reconstructGraphChatToolArgs,
  type GraphChatToolMergedPayload,
} from './graphChatToolBlocks';

type CodeRendererProps = ComponentProps<'code'> & {
  inline?: boolean | undefined;
  node?: unknown;
  insideMarkdownLink?: boolean;
};

// Keep ReactMarkdown's component identity stable as streamed text, highlighting,
// copy state and theme change, so interactive diagrams retain their state.
const CodeRendererContext = createContext<((props: CodeRendererProps) => ReactElement | null) | null>(null);
const MarkdownLinkContext = createContext(false);
function StableCodeRenderer(props: CodeRendererProps) {
  const render = useContext(CodeRendererContext);
  const insideMarkdownLink = useContext(MarkdownLinkContext);
  return render?.({ ...props, insideMarkdownLink }) ?? null;
}

// A new `a` component on each render remounts VerifiedWorkspacePath, temporarily
// replacing verified links with text. Context updates behavior without remounting.
type LinkRendererProps = ComponentProps<'a'> & { node?: unknown };
const LinkRendererContext = createContext<((props: LinkRendererProps) => ReactElement | null) | null>(null);
function StableLinkRenderer(props: LinkRendererProps) {
  return useContext(LinkRendererContext)?.(props) ?? null;
}
// Image state (including the open lightbox) must survive host callback refreshes.
// Context keeps resolution and read-only policy current without changing the type.
const ImageRendererContext = createContext<{
  resolveHref?: ((href: string) => string) | undefined;
  readOnly: boolean;
}>({ readOnly: false });
function StableImageRenderer({ src, alt, width, height }: ComponentProps<'img'>) {
  useI18n();
  const { resolveHref, readOnly } = useContext(ImageRendererContext);
  const resolved = typeof src === 'string' ? (resolveHref?.(src) ?? src) : undefined;
  if (readOnly && !resolved?.startsWith('data:image/') && !/^https?:\/\//i.test(resolved ?? '')) return <span>{alt || translate("chat.imageUnavailable")}</span>;
  return resolved ? <ZoomableImage src={resolved} alt={alt ?? ''} width={width} height={height} /> : <span>{alt || translate("chat.imageUnavailable")}</span>;
}

function TableRenderer({ children }: ComponentProps<'table'>) {
  useI18n();
  return <div className="thread-markdown-table-scroll" tabIndex={0} role="region" aria-label={translate("chat.table")}><table>{children}</table></div>;
}

type OpenWorkspaceFileHandler = (input: {
  path: string;
  line?: number;
}) => void;

function ensureTransparentShikiBg(html: string) {
  return html
    .replace(/background-color:[^;"]+;?/g, 'background-color: transparent;')
    .replace(/background:[^;"]+;?/g, 'background: transparent;');
}

function textFromReactNode(children: ReactNode) {
  if (Array.isArray(children)) {
    return children.map((child) => String(child)).join('');
  }
  return String(children ?? '');
}

function readMarkdownNodeLineRange(node: unknown) {
  if (!node || typeof node !== 'object' || !('position' in node)) {
    return { startLine: undefined, endLine: undefined };
  }

  const position = (node as { position?: unknown }).position;
  if (!position || typeof position !== 'object') {
    return { startLine: undefined, endLine: undefined };
  }

  const start = (position as { start?: unknown }).start;
  const end = (position as { end?: unknown }).end;
  const startLine =
    start && typeof start === 'object'
      ? (start as { line?: unknown }).line
      : undefined;
  const endLine =
    end && typeof end === 'object'
      ? (end as { line?: unknown }).line
      : undefined;

  return {
    startLine: typeof startLine === 'number' ? startLine : undefined,
    endLine: typeof endLine === 'number' ? endLine : undefined,
  };
}

function parseWorkspaceFileHref(href: string | undefined, workspaceRootPath?: string) {
  if (!href) {
    return null;
  }

  const candidate = localFileHref(href, typeof window === 'undefined' ? undefined : window.location.origin);
  if (!candidate) return null;

  const lineMatch = candidate.match(/(?:#L|:)(\d+)(?::\d+)?$/);
  const line = lineMatch ? Number.parseInt(lineMatch[1] ?? '', 10) : undefined;
  const rawPath = lineMatch ? candidate.slice(0, -lineMatch[0].length) : candidate;
  const path = workspaceRootPath ? (relativeWorkspacePath(rawPath, workspaceRootPath) ?? rawPath) : rawPath;
  if (!path || path === '/') {
    return null;
  }

  return {
    path,
    ...(Number.isFinite(line) ? { line } : {}),
  };
}

function PreRenderer({ children, ...props }: ComponentProps<'pre'>) {
  const { locale: i18nLocale } = useI18n();
  const code = isValidElement<{ className?: string; children?: ReactNode }>(children) ? children.props : undefined;
  const language = /language-([\w-]+)/.exec(code?.className ?? '')?.[1] ?? '';
  if (isToolCodeElement(children) || (code && isMermaidCode(language, textFromReactNode(code.children)))) {
    return <>{children}</>;
  }

  return <pre {...props}>{children}</pre>;
}

function isToolCodeElement(value: ReactNode) {
  if (!value || typeof value !== 'object' || !('props' in value)) {
    return false;
  }

  const className = (value as { props?: { className?: unknown } }).props
    ?.className;
  if (typeof className !== 'string') {
    return false;
  }

  return (
    className.includes('language-tool-call') ||
    className.includes('language-tool-merged') ||
    className.includes('language-tool-result')
  );
}

export const GraphChatMessageContent = memo(function GraphChatMessageContent({
  className = 'thread-graph-markdown',
  content,
  readOnly = false,
  streaming = false,
  onOpenWorkspaceFile,
  resolveWorkspacePath,
  workspaceRootPath,
  resolveHref,
}: {
  className?: string;
  content: string;
  readOnly?: boolean;
  streaming?: boolean;
  onOpenWorkspaceFile?: OpenWorkspaceFileHandler | undefined;
  resolveWorkspacePath?: WorkspacePathResolver | undefined;
  workspaceRootPath?: string | undefined;
  resolveHref?: ((href: string) => string) | undefined;
}) {
  const { locale: i18nLocale } = useI18n();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const plugins = usePlugins();
  const [highlighter, setHighlighter] = useState<Awaited<
    ReturnType<typeof getGraphChatHighlighter>
  > | null>(null);
  const [touchCode, setTouchCode] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  const cssSyntaxPalette = useThemeFeature('code.cssSyntaxPalette');
  const { processedContent, resultMap } = useMemo(
    () => readOnly ? { processedContent: content, resultMap: new Map() } : preprocessGraphChatToolBlocks(content),
    [content, readOnly],
  );

  useEffect(() => {
    let alive = true;
    getGraphChatHighlighter()
      .then((loadedHighlighter) => {
        if (alive) {
          setHighlighter(loadedHighlighter);
        }
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const shell = root?.closest<HTMLElement>('.thread-ui-shell');

    const readDark = () => {
      if (!shell) {
        return document.documentElement.classList.contains('dark');
      }
      return (
        shell.getAttribute('data-theme-effective') === 'dark' ||
        shell.classList.contains('dark') ||
        shell.classList.contains('thread-ui-theme-dark')
      );
    };

    setDark(readDark());
    if (!shell) {
      return;
    }

    const observer = new MutationObserver(() => setDark(readDark()));
    observer.observe(shell, {
      attributes: true,
      attributeFilter: ['class', 'data-theme-effective'],
    });
    return () => observer.disconnect();
  }, []);

  const CodeBlockRenderer = ({
    children,
    className: codeClassName,
    inline,
    node,
    insideMarkdownLink,
    ...props
  }: CodeRendererProps): ReactElement | null => {
  const { locale: i18nLocale } = useI18n();
    const match = /language-(\w+(?:-\w+)*)/.exec(codeClassName || '');
    const language = match ? (match[1] ?? '') : '';
    const textContent = textFromReactNode(children).replace(/\n$/, '');
    const { startLine, endLine } = readMarkdownNodeLineRange(node);
    const isFencedOrBlockCode =
      inline === false ||
      Boolean(codeClassName) ||
      textContent.includes('\n') ||
      startLine !== endLine;

    if (isFencedOrBlockCode && isMermaidCode(language, textContent)) {
      return <GraphChatMermaidDiagram source={textContent} dark={dark}
        pending={streaming && !hasClosedMarkdownFence(processedContent, startLine, endLine)} />;
    }

    if (!readOnly && language === 'tool-merged') {
      let data: GraphChatToolMergedPayload = {
        call: { tool: 'Unknown', args: {}, call_id: undefined },
        result: null,
      };
      try {
        data = JSON.parse(textContent) as GraphChatToolMergedPayload;
      } catch {
        data = {
          call: { tool: 'Error', args: { raw: textContent } },
          result: { status: 'failed' },
        };
      }

      const toolName =
        typeof data.call.tool === 'string' ? data.call.tool : translate("chat.unknown");
      const callId =
        typeof data.call.call_id === 'string' ? data.call.call_id : undefined;
      return (
        <GraphChatToolCall
          callId={callId}
          toolName={toolName}
          status={getGraphChatToolUiStatus(data.result)}
          parameters={reconstructGraphChatToolArgs(data.call.args)}
          result={data.result}
        />
      );
    }

    if (!readOnly && language === 'tool-call') {
      let data: { tool?: unknown; args?: unknown; call_id?: unknown } = {
        tool: 'Unknown',
        args: {},
        call_id: undefined,
      };
      try {
        data = JSON.parse(textContent) as typeof data;
      } catch {
        data = { tool: 'Error', args: { raw: textContent } };
      }

      const callId =
        typeof data.call_id === 'string' ? data.call_id : undefined;
      const liveResult =
        callId && resultMap.has(callId)
          ? mergeGraphChatToolResultState(
              resultMap.get(callId) ?? createEmptyGraphChatToolResultState(),
            )
          : undefined;

      return (
        <GraphChatToolCall
          callId={callId}
          toolName={typeof data.tool === 'string' ? data.tool : translate("chat.unknown")}
          status={liveResult ? getGraphChatToolUiStatus(liveResult) : 'pending'}
          parameters={reconstructGraphChatToolArgs(data.args)}
          result={liveResult}
        />
      );
    }

    if (!readOnly && language === 'tool-result') {
      return null;
    }

    if (!readOnly && ['xyz', 'extxyz', 'cif', 'pdb'].includes(language)) {
      const rendered = plugins.renderInlineCode({
        code: textContent,
        isIncomplete: false,
        language,
      });
      if (isValidElement(rendered)) {
        return rendered;
      }
    }

    if (isFencedOrBlockCode) {
      const loadedLanguages = highlighter?.getLoadedLanguages?.() ?? [];
      const lang = loadedLanguages.includes(language) ? language : 'text';
      const theme = syntaxThemeFor(dark, cssSyntaxPalette);
      const id = `${language || 'text'}:${textContent.length}:${textContent.slice(0, 32)}`;
      let html = '';

      if (highlighter) {
        try {
          html = ensureTransparentShikiBg(
            highlighter.codeToHtml(textContent, { lang, theme }),
          );
        } catch {
          html = ensureTransparentShikiBg(
            highlighter.codeToHtml(textContent, { lang: 'text', theme }),
          );
        }
      }

      return (
        // The frame holds the copy key floating over the code's corner; the code
        // scrolls inside it, so the key never scrolls away or takes a line.
        <div className="thread-graph-code-block not-prose"
          data-touch-actions={touchCode === id ? 'true' : 'false'}
          onPointerEnter={(event) => { if (event.pointerType === 'mouse') setTouchCode(null); }}
          onPointerUp={(event) => {
            if ((event.pointerType === 'touch' || event.pointerType === 'pen') && !(event.target instanceof Element && event.target.closest('button'))) {
              event.stopPropagation();
              setTouchCode((current) => current === id ? null : id);
            }
          }}
        >
          {!readOnly && <CopyButton value={textContent} label={translate("chat.copyCode")} className="thread-graph-code-copy" />}
          <div className="thread-graph-code-scroll">
            {html ? (
              <div dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <pre>
                <code className="whitespace-pre">{textContent}</code>
              </pre>
            )}
          </div>
        </div>
      );
    }

    const inlineDisplayText = textFromReactNode(children).replace(/`+/g, '');
    const inlineCode = (
      <code
        className={`thread-graph-inline-code rounded px-1 py-0.5 font-mono font-normal text-[0.9em] ${
          codeClassName || ''
        }`}
        {...props}
      >
        {inlineDisplayText}
      </code>
    );
    const target = parseWorkspacePathText(inlineDisplayText, workspaceRootPath);
    return !readOnly && !insideMarkdownLink && target && resolveWorkspacePath && onOpenWorkspaceFile
      ? <VerifiedWorkspacePath target={target} resolve={resolveWorkspacePath} onOpen={onOpenWorkspaceFile}>{inlineCode}</VerifiedWorkspacePath>
      : inlineCode;
  };

  const LinkRenderer = ({ href, children: originalChildren, node: _node, ...props }: LinkRendererProps) => {
    const children = <MarkdownLinkContext.Provider value={true}><MarkdownImageLinkContext.Provider value={true}>{originalChildren}</MarkdownImageLinkContext.Provider></MarkdownLinkContext.Provider>;
    if (href?.startsWith('workspace-auto:')) {
      let value = '';
      try { value = decodeURIComponent(href.slice('workspace-auto:'.length)); } catch { /* Invalid path remains plain text. */ }
      const target = parseWorkspacePathText(value, workspaceRootPath);
      return !readOnly && target && resolveWorkspacePath && onOpenWorkspaceFile
        ? <VerifiedWorkspacePath target={target} resolve={resolveWorkspacePath} onOpen={onOpenWorkspaceFile}>{children}</VerifiedWorkspacePath>
        : <>{children}</>;
    }
    if (readOnly && (!href || !/^https?:\/\//i.test(href))) return <span>{children}</span>;
    const workspaceTarget = parseWorkspaceFileHref(href, workspaceRootPath);
    if (workspaceTarget && onOpenWorkspaceFile) {
      return (
        <WorkspaceFileLink {...workspaceTarget} onOpen={onOpenWorkspaceFile}>{children}</WorkspaceFileLink>
      );
    }
    const resolvedHref = href ? (resolveHref?.(href) ?? href) : href;
    return (
      <a
        {...props}
        {...externalLinkProps(resolvedHref)}
        href={resolvedHref}
        className="thread-inline-link"
      >
        {children}
      </a>
    );
  };

  return (
    <div ref={rootRef} data-markdown-ready={highlighter ? 'true' : 'false'} className={`thread-graph-message-markdown ${className}`}>
      <CodeRendererContext.Provider value={CodeBlockRenderer}>
      <LinkRendererContext.Provider value={LinkRenderer}>
      <ImageRendererContext.Provider value={{ resolveHref, readOnly }}>
      <ReactMarkdown
        urlTransform={url => !readOnly && url.startsWith('workspace-auto:') ? url : !readOnly && localFileHref(url, typeof window === 'undefined' ? undefined : window.location.origin) ? url : defaultUrlTransform(url)}
        remarkPlugins={[remarkGfm, remarkMath, remarkLatex, remarkCjkFriendly, ...(!readOnly && resolveWorkspacePath ? [remarkWorkspacePaths] : [])]}
        rehypePlugins={[...markdownHtmlPlugins, rehypeKatex]}
        components={{
          a: StableLinkRenderer,
          img: StableImageRenderer,
          code: StableCodeRenderer,
          table: TableRenderer,
          pre: PreRenderer,
        }}
      >
        {processedContent}
      </ReactMarkdown>
      </ImageRendererContext.Provider>
      </LinkRendererContext.Provider>
      </CodeRendererContext.Provider>
    </div>
  );
});
