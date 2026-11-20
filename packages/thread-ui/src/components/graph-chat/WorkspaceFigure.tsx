import { translate, useI18n } from '../../i18n';
import { useContext, useEffect, useState } from 'react';
import { Download, FolderOpen } from 'lucide-react';
import { ZoomableImage, MarkdownImageLinkContext } from '../ZoomableImage';
import type { WorkspacePathResolver } from '../workspacePathLinks';

/** `x.png` -> `x.dark.png`, the dark-theme variant an Agent may save beside a figure. */
export function darkVariantPath(path: string): string | null {
  return /\.png$/i.test(path) && !/\.dark\.png$/i.test(path) ? path.replace(/\.png$/i, '.dark.png') : null;
}

/** The same file URL with `download` set, so the server answers with an attachment. */
export function downloadHref(href: string): string {
  const base = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  const url = new URL(href, base);
  url.searchParams.set('download', '1');
  return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : url.toString();
}

// Uses the resolver's cached parent listing, so siblings of one figure cost one request.
function useWorkspaceFileExists(path: string | null, resolve: WorkspacePathResolver | undefined) {
  const [known, setKnown] = useState<{ path: string; exists: boolean } | null>(null);
  useEffect(() => {
    if (!path || !resolve) return;
    let alive = true;
    resolve(path).then(
      exists => { if (alive) setKnown({ path, exists }); },
      () => { if (alive) setKnown({ path, exists: false }); },
    );
    return () => { alive = false; };
  }, [path, resolve]);
  return path !== null && known?.path === path && known.exists;
}

/**
 * A workspace figure in a reply: framed, zoomable, with Download and Show-in-Files.
 * In the dark theme it shows `name.dark.png` when that sibling exists; Download
 * always fetches the original file the reply named.
 */
export function WorkspaceFigure({
  alt,
  dark,
  height,
  onOpenWorkspaceFile,
  path,
  resolveHref,
  resolveWorkspacePath,
  src,
  width,
}: {
  alt: string;
  dark: boolean;
  height?: string | number | undefined;
  onOpenWorkspaceFile?: ((input: { path: string }) => void) | undefined;
  path: string;
  resolveHref?: ((href: string) => string) | undefined;
  resolveWorkspacePath?: WorkspacePathResolver | undefined;
  src: string;
  width?: string | number | undefined;
}) {
  useI18n();
  const insideLink = useContext(MarkdownImageLinkContext);
  const darkPath = dark ? darkVariantPath(path) : null;
  const hasDark = useWorkspaceFileExists(darkPath, resolveWorkspacePath);
  const shown = hasDark && darkPath ? (resolveHref?.(darkPath) || src) : src;
  const image = <ZoomableImage src={shown} alt={alt} {...(width !== undefined ? { width } : {})} {...(height !== undefined ? { height } : {})} />;
  // A link already owns the click; nested controls would be invalid inside it.
  if (insideLink) return image;
  const name = path.split('/').pop() || path;
  return (
    <span className={`thread-graph-figure${dark && !hasDark ? ' is-light-on-dark' : ''}`} data-figure-variant={hasDark ? 'dark' : 'original'}>
      {image}
      <span className="thread-graph-figure-actions">
        <a
          className="thread-graph-figure-action"
          href={downloadHref(src)}
          download={name}
          title={translate('chat.figureDownload', { value1: name })}
          aria-label={translate('chat.figureDownload', { value1: name })}
        >
          <Download aria-hidden="true" />
          <span>{translate('chat.figureDownloadShort')}</span>
        </a>
        {onOpenWorkspaceFile ? (
          <button
            type="button"
            className="thread-graph-figure-action"
            onClick={() => onOpenWorkspaceFile({ path })}
            title={translate('chat.figureShowInFiles', { value1: name })}
            aria-label={translate('chat.figureShowInFiles', { value1: name })}
          >
            <FolderOpen aria-hidden="true" />
            <span>{translate('chat.figureShowInFilesShort')}</span>
          </button>
        ) : null}
      </span>
    </span>
  );
}
