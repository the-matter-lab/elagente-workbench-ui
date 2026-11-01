import { translate, useI18n } from '../../../i18n';
import { useLayoutEffect, useRef, useState } from 'react';

import type {
  ThreadWorkspaceAdapter,
  ThreadWorkspaceFilePreview,
} from '../../../adapters';
import {
  IMAGE_EXTENSIONS,
  MOLECULAR_EXTENSIONS,
  PDF_EXTENSIONS,
  extensionOf,
} from '../workspaceTree';
import type { WorkspaceTreeNode } from '../workspaceTree';
import type { WorkspaceExplorerIdentity } from './useWorkspaceExplorerPersistence';

import type { WorkspaceDocuments } from "./useWorkspaceDocuments";
import { DRAWIO_MAX_BYTES, downloadOnlyReason, isBinaryPreview, isDownloadOnlyPath, isDrawioPath } from './filePreviewPolicy';
import { CubeFormatError, MAX_CUBE_GRID_POINTS, readCubeHeader } from '../GraphMoleculeCube';

const PREVIEW_CHUNK_BYTES = 24_000;
// Molecular files are read whole into the page.
export const MAX_MOLECULAR_PREVIEW_BYTES = 10 * 1024 * 1024;
const MOLECULAR_CHUNK_BYTES = 256 * 1024;
// Cube grids are larger: a 100³ orbital is about 14 MB. 20 MiB is the
// ElAgente app-server's own limit for any workspace file (MAX_FILE_BYTES), so
// a larger cap would only trade the download state for a read error. Each
// `file/read` re-reads the whole file on the server, so cubes use fewer,
// larger chunks. See docs/scientific-file-previews.md.
export const MAX_CUBE_PREVIEW_BYTES = 20 * 1024 * 1024;
const CUBE_CHUNK_BYTES = 2 * 1024 * 1024;

/**
 * A cube grid too large to draw, from the header in the first chunk. Null
 * when the grid is drawable or the header is not complete yet; the viewer
 * checks the full file again.
 */
function cubeDownloadReason(content: string) {
  try {
    const header = readCubeHeader(content);
    if (!header) return null;
    if (header.pointCount > MAX_CUBE_GRID_POINTS) return 'volumetricGridTooLarge';
    if (header.orbitalIndices.length > 1) return 'volumetricMultipleOrbitals';
    return null;
  } catch (error) {
    if (error instanceof CubeFormatError && error.code === 'multipleOrbitals')
      return 'volumetricMultipleOrbitals';
    // A malformed header is reported by the viewer, with the file loaded.
    return null;
  }
}

export function useWorkspaceFilePreview({
  activeNode,
  adapter,
  identity,
  onError,
  documents,
}: {
  activeNode: WorkspaceTreeNode | null;
  adapter?: ThreadWorkspaceAdapter | null;
  identity: WorkspaceExplorerIdentity;
  onError: (error: string | null) => void;
  documents: WorkspaceDocuments;
}) {
  const generation = useRef(0);
  const loadingMoreRef = useRef(false);
  useI18n();
  const [previewFile, setPreviewFile] =
    useState<ThreadWorkspaceFilePreview | null>(null);
  const [downloadOnly, setDownloadOnly] = useState(false);
  // Why a file is offered as a download rather than shown, when that is known.
  const [downloadReason, setDownloadReason] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useLayoutEffect(() => {
    ++generation.current;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    const selectedPath = activeNode?.kind === 'file' ? activeNode.path : null;
    if (!adapter || !selectedPath) {
      setDownloadOnly(false);
      setPreviewFile(null);
      setImageUrl(null);
      setPdfUrl(null);
      setPreviewLoading(false);
      return;
    }
    const currentAdapter = adapter;
    const currentPath = selectedPath;

    let cancelled = false;
    let objectUrl: string | null = null;
    const abort = new AbortController();
    async function loadPreview() {
      setPreviewLoading(true);
      onError(null);
      setDownloadOnly(false);
      setDownloadReason(null);
      setPreviewFile(null);
      setImageUrl(null);
      setPdfUrl(null);
      try {
        if (isDownloadOnlyPath(currentPath)) {
          setDownloadOnly(true);
          setDownloadReason(downloadOnlyReason(currentPath));
          return;
        }
        const extension = extensionOf(currentPath);
        if (isDrawioPath(currentPath) && (activeNode?.size ?? 0) > DRAWIO_MAX_BYTES) {
          throw new Error(translate("files.diagramPreviewSupportsFilesUpTo8"));
        }
        const rawUrl = currentAdapter.getRawFileUrl?.({
          ...identity,
          path: currentPath,
        });
        if (rawUrl && IMAGE_EXTENSIONS.has(extension)) {
          if (!cancelled) {
            setImageUrl(rawUrl);
          }
          return;
        }
        if (PDF_EXTENSIONS.has(extension) && currentAdapter.readRawFile) {
          const blob = await currentAdapter.readRawFile({ ...identity, path: currentPath, signal: abort.signal });
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' }));
          setPdfUrl(objectUrl);
          return;
        }
        if (rawUrl && PDF_EXTENSIONS.has(extension)) {
          if (!cancelled) {
            setPdfUrl(rawUrl);
          }
          return;
        }
        const safe = !currentPath.startsWith('/') && !/^[a-z]:[\\/]/i.test(currentPath) && !isDrawioPath(currentPath)
          ? await documents.load(currentPath, abort.signal) : null;
        if (safe && safe.content == null && !['fileTooLarge','safeUnavailable'].includes(safe.readOnlyReason??'')) {
          if (!cancelled) setDownloadOnly(true); return;
        }
        let file = safe?.content != null ? { ...safe, content: safe.content, nextOffset: safe.size } : await currentAdapter.readFile({
          ...identity,
          path: currentPath,
          limit: isDrawioPath(currentPath) ? DRAWIO_MAX_BYTES : PREVIEW_CHUNK_BYTES,
        });
        // Molecular parsers need complete frames, not a partial text preview.
        if (MOLECULAR_EXTENSIONS.has(extension)) {
          const cube = extension === 'cube' || extension === 'cub';
          const maxBytes = cube ? MAX_CUBE_PREVIEW_BYTES : MAX_MOLECULAR_PREVIEW_BYTES;
          const chunkBytes = cube ? CUBE_CHUNK_BYTES : MOLECULAR_CHUNK_BYTES;
          const cubeReason = cube ? cubeDownloadReason(file.content) : null;
          if (cubeReason) {
            if (!cancelled) {
              setDownloadOnly(true);
              setDownloadReason(cubeReason);
            }
            return;
          }
          while (!cancelled) {
            if (
              file.size > maxBytes ||
              (file.truncated && file.nextOffset >= maxBytes)
            ) {
              if (!cancelled) {
                setDownloadOnly(true);
                setDownloadReason(cube ? 'volumetricPreviewTooLarge' : 'moleculePreviewTooLarge');
              }
              return;
            }
            if (!file.truncated) break;
            const chunk = await currentAdapter.readFile({
              ...identity,
              path: currentPath,
              offset: file.nextOffset,
              limit: Math.min(chunkBytes, maxBytes - file.nextOffset),
            });
            if (chunk.nextOffset <= file.nextOffset) {
              throw new Error(
                'Unable to load the complete molecular file: the read made no progress.',
              );
            }
            file = { ...chunk, content: file.content + chunk.content };
          }
        }
        if (!cancelled) {
          if (isBinaryPreview(file.content)) { setDownloadOnly(true); setDownloadReason('unsupportedEncodingOrBinaryFile'); }
          else setPreviewFile(file);
        }
      } catch (error) {
        if (!cancelled) {
          // A file that is not text cannot be previewed: offer the download
          // instead of an error.
          if (error instanceof Error && /unsupportedEncodingOrBinaryFile/.test(error.message)) {
            setDownloadOnly(true);
            setDownloadReason('unsupportedEncodingOrBinaryFile');
          } else onError(
            error instanceof Error ? error.message : translate("files.failedToReadFile"),
          );
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    }
    void loadPreview();
    return () => {
      cancelled = true;
      abort.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      ++generation.current;
    };
  }, [
    activeNode?.id,
    activeNode?.kind,
    activeNode?.path,
    adapter,
    identity,
    onError,
    documents.load,
  ]);

  async function loadMore() {
    if (!adapter?.textRangeRead || !previewFile?.truncated || loadingMoreRef.current) return;
    const request = generation.current;
    const file = previewFile;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    onError(null);
    try {
      const chunk = await adapter.readFile({
        ...identity,
        path: file.path,
        offset: file.nextOffset,
        limit: PREVIEW_CHUNK_BYTES,
      });
      if (request !== generation.current) return;
      if (chunk.nextOffset <= file.nextOffset && chunk.truncated)
        throw new Error(
          'Unable to load more: the read made no progress. Download the file or reopen it.',
        );
      setPreviewFile((current) =>
        current?.path === file.path && current.nextOffset === file.nextOffset
          ? { ...chunk, content: current.content + chunk.content }
          : current,
      );
    } catch (error) {
      if (request === generation.current)
        onError(
          error instanceof Error
            ? error.message
            : 'Failed to load more. Reopen or download the file.',
        );
    } finally {
      if (request === generation.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }

  return {
    downloadOnly,
    downloadReason,
    imageUrl,
    loadingMore,
    loadMore,
    pdfUrl,
    previewFile,
    previewLoading,
  };
}
