import type { GLViewer } from '3dmol';
import {
  Box,
  Camera,
  Copy,
  Download,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useState, type RefObject } from 'react';

import { ButtonGroupSeparator } from '../graph-ui/ButtonGroup';
import {
  downloadTextFile,
  GraphMoleculeButtonGroup,
  GraphMoleculeIconButton,
  moleculeSlug,
} from './GraphMoleculeViewerControls';

export default function GraphMoleculeViewerUpperButtonGroup({
  currentIndex,
  onDownloadSource,
  onFeedback,
  exportContent,
  moleculeId,
  onScreenshot,
  viewerRef,
  viewerHostRef,
  hasUnitCell,
  xyzContent,
  xyzFormat,
}: {
  onDownloadSource?: () => void;
  onFeedback?: (message: string) => void;
  currentIndex: number;
  exportContent: string;
  moleculeId?: string | null;
  onScreenshot: () => void;
  viewerRef: RefObject<GLViewer | null>;
  viewerHostRef: RefObject<HTMLDivElement | null>;
  hasUnitCell: boolean;
  xyzContent: string | null;
  xyzFormat: string;
}) {
  const [inspect, setInspect] = useState(false);
  const slug = moleculeSlug(moleculeId);

  async function handleCopyXYZ() {
    if (!xyzContent) {
      return;
    }
    try {
      await navigator.clipboard.writeText(xyzContent);
      onFeedback?.('Coordinates copied.');
    } catch (error) {
      console.warn('Copying coordinates failed:', error);
      onFeedback?.('Couldn’t copy the coordinates. Allow clipboard access, then try again.');
    }
  }

  function handleDownloadXYZ() {
    if (!xyzContent) {
      return;
    }
    downloadTextFile(
      xyzContent,
      `${slug}_step_${currentIndex + 1}.${xyzFormat || 'xyz'}`,
    );
  }

  function handleDownloadAllXYZ() {
    if (!exportContent) {
      return;
    }
    if (onDownloadSource) {
      onDownloadSource();
      return;
    }
    downloadTextFile(exportContent, `${slug}_trajectory.${xyzFormat || 'xyz'}`);
  }

  function handleZoomIn() {
    if (!viewerRef.current) {
      return;
    }
    viewerRef.current.zoom(1.2);
    viewerRef.current.render();
  }

  function handleZoomOut() {
    if (!viewerRef.current) {
      return;
    }
    viewerRef.current.zoom(0.8);
    viewerRef.current.render();
  }

  function handleReset() {
    if (!viewerRef.current) {
      return;
    }
    viewerRef.current.zoomTo();
    const host = viewerHostRef.current;
    viewerRef.current.zoom(
      (hasUnitCell ? 0.5 : 0.85) *
        (host?.clientHeight
          ? Math.min(1, host.clientWidth / host.clientHeight)
          : 1),
    );
    viewerRef.current.setCameraParameters({});
    viewerRef.current.render();
  }

  return (
    <>
      {inspect && (
        <div role="dialog" aria-label="Structure coordinates">
          <p>
            {xyzFormat}, frame {currentIndex + 1}
          </p>
          <textarea
            readOnly
            aria-label="Immutable coordinates"
            value={xyzContent ?? ''}
          />
          <button onClick={() => setInspect(false)}>Close coordinates</button>
        </div>
      )}
      <GraphMoleculeButtonGroup className="ml-auto justify-end">
        <GraphMoleculeIconButton
          label="Inspect coordinates"
          onClick={() => setInspect(true)}
        >
          <Copy className="size-3.5" />
        </GraphMoleculeIconButton>
        <GraphMoleculeIconButton
          label="Copy current structure"
          onClick={() => void handleCopyXYZ()}
          disabled={!xyzContent}
        >
          <Copy className="size-3.5" />
        </GraphMoleculeIconButton>
        <GraphMoleculeIconButton
          label="Download current structure"
          onClick={handleDownloadXYZ}
          disabled={!xyzContent}
        >
          <Download className="size-3.5" />
        </GraphMoleculeIconButton>
        <GraphMoleculeIconButton
          label="Download full trajectory"
          onClick={handleDownloadAllXYZ}
          disabled={!exportContent}
        >
          <Box className="size-3.5" />
        </GraphMoleculeIconButton>
        <GraphMoleculeIconButton
          label="Copy screenshot"
          onClick={onScreenshot}
          disabled={!viewerRef.current || !xyzContent}
        >
          <Camera className="size-3.5" />
        </GraphMoleculeIconButton>
        <ButtonGroupSeparator className="thread-graph-molecule-button-divider" />
        <GraphMoleculeIconButton
          label="Zoom in"
          onClick={handleZoomIn}
          disabled={!viewerRef.current || !xyzContent}
        >
          <ZoomIn className="size-3.5" />
        </GraphMoleculeIconButton>
        <GraphMoleculeIconButton
          label="Zoom out"
          onClick={handleZoomOut}
          disabled={!viewerRef.current || !xyzContent}
        >
          <ZoomOut className="size-3.5" />
        </GraphMoleculeIconButton>
        <GraphMoleculeIconButton
          label="Reset camera"
          onClick={handleReset}
          disabled={!viewerRef.current || !xyzContent}
        >
          <RotateCcw className="size-3.5" />
        </GraphMoleculeIconButton>
      </GraphMoleculeButtonGroup>
    </>
  );
}
