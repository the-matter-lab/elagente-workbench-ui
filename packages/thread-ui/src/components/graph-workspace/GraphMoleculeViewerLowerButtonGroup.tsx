import {
  ArrowUpRight,
  Box,
  Boxes,
  Eraser,
  Send,
  Trash2,
} from 'lucide-react';

import { useI18n } from '../../i18n';
import {
  CUBE_ISOVALUE_STEPS,
  CUBE_NEGATIVE_COLOR,
  CUBE_POSITIVE_COLOR,
  isovalueFromSlider,
  sliderFromIsovalue,
} from './GraphMoleculeCube';
import {
  GraphMoleculeButtonGroup,
  type GraphMoleculeCameraInfo,
  GraphMoleculeIconButton,
} from './GraphMoleculeViewerControls';

export type GraphMoleculeIsosurfaceControls = {
  isovalue: number;
  opacity: number;
  disabled?: boolean;
  onIsovalueChange: (value: number) => void;
  onOpacityChange: (value: number) => void;
};

function formatIsovalue(value: number) {
  return value >= 0.001 ? String(Number(value.toPrecision(3))) : value.toExponential(1);
}

/** Progress fill of a scrubber track, as for the trajectory scrubber. */
function fill(fraction: number) {
  return { backgroundSize: `${Math.min(1, Math.max(0, fraction)) * 100}% 6px` };
}

/** Isovalue (log scale) and opacity for a cube's +/- isosurfaces. */
function IsosurfaceControls({
  isovalue,
  opacity,
  disabled = false,
  onIsovalueChange,
  onOpacityChange,
}: GraphMoleculeIsosurfaceControls) {
  const { t } = useI18n();
  const value = formatIsovalue(isovalue);
  return (
    <div
      className="thread-graph-molecule-isosurface"
      role="group"
      aria-label={t('files.isosurface')}
    >
      <label>
        <span>{t('files.isovalue')}</span>
        <input
          type="range"
          className="thread-graph-molecule-scrubber"
          aria-label={t('files.isovalue')}
          aria-valuetext={`±${value}`}
          min={0}
          max={CUBE_ISOVALUE_STEPS}
          step={1}
          value={sliderFromIsovalue(isovalue)}
          style={fill(sliderFromIsovalue(isovalue) / CUBE_ISOVALUE_STEPS)}
          disabled={disabled}
          onChange={(event) =>
            onIsovalueChange(isovalueFromSlider(Number(event.target.value)))
          }
        />
        <output>±{value}</output>
      </label>
      <label>
        <span>{t('files.isosurfaceOpacity')}</span>
        <input
          type="range"
          className="thread-graph-molecule-scrubber"
          aria-label={t('files.isosurfaceOpacity')}
          aria-valuetext={`${Math.round(opacity * 100)}%`}
          min={10}
          max={100}
          step={5}
          value={Math.round(opacity * 100)}
          style={fill((opacity * 100 - 10) / 90)}
          disabled={disabled}
          onChange={(event) => onOpacityChange(Number(event.target.value) / 100)}
        />
        <output>{Math.round(opacity * 100)}%</output>
      </label>
      <div className="thread-graph-molecule-isosurface-legend" aria-hidden="true">
        <span>
          <i style={{ background: CUBE_POSITIVE_COLOR }} />
          {t('files.isosurfacePositive', { value })}
        </span>
        <span>
          <i style={{ background: CUBE_NEGATIVE_COLOR }} />
          {t('files.isosurfaceNegative', { value })}
        </span>
      </div>
    </div>
  );
}

export default function GraphMoleculeViewerLowerButtonGroup({
  cameraInfo,
  canSubmit = false,
  selectionSubmission = true,
  onClearSelection,
  onClearStaged,
  onSendSelection,
  onSendStaged,
  onStageSelection,
  onToggleUnitCell,
  selectedAtomLabels,
  selectedSerials,
  stagedAtoms,
  stagedMolecules,
  unitCellAvailable,
  unitCellVisible,
  isosurface,
}: {
  /** Present for volumetric (cube) sources. */
  isosurface?: GraphMoleculeIsosurfaceControls;
  canSubmit?: boolean;
  /** False when the host has no selection handler: the send and staging buttons are hidden, not disabled. */
  selectionSubmission?: boolean;
  cameraInfo: GraphMoleculeCameraInfo | null;
  onClearSelection: () => void;
  onClearStaged: () => void;
  onSendSelection: () => void;
  onSendStaged: () => void;
  onStageSelection: () => void;
  onToggleUnitCell: () => void;
  selectedAtomLabels: Record<number, string>;
  selectedSerials: number[];
  stagedAtoms: number;
  stagedMolecules: number;
  unitCellAvailable: boolean;
  unitCellVisible: boolean;
}) {
  const hasSelection = selectedSerials.length > 0;
  const hasStaged = stagedAtoms > 0;

  return (
    <>
      {isosurface ? <IsosurfaceControls {...isosurface} /> : null}
      <div className="thread-graph-molecule-lower-toolbar flex w-full shrink-0 flex-wrap justify-between gap-2">
        <GraphMoleculeButtonGroup>
          <GraphMoleculeIconButton
            label={unitCellVisible ? 'Hide unit cell' : 'Show unit cell'}
            disabled={!unitCellAvailable}
            onClick={onToggleUnitCell}
          >
            <Boxes className="size-4" />
          </GraphMoleculeIconButton>
          <GraphMoleculeIconButton
            label="Clear selection"
            disabled={!hasSelection}
            onClick={onClearSelection}
          >
            <Trash2 className="size-4" />
          </GraphMoleculeIconButton>
          {selectionSubmission ? (
            <>
              <GraphMoleculeIconButton
                label="Send selection"
                disabled={!hasSelection || !canSubmit}
                onClick={onSendSelection}
              >
                <Send className="size-4" />
              </GraphMoleculeIconButton>
              <GraphMoleculeIconButton
                label="Stage current selection"
                disabled={!hasSelection}
                onClick={onStageSelection}
              >
                <Box className="size-4" />
              </GraphMoleculeIconButton>
              <GraphMoleculeIconButton
                label="Clear staged selections"
                disabled={!hasStaged}
                onClick={onClearStaged}
              >
                <Eraser className="size-4" />
              </GraphMoleculeIconButton>
              <GraphMoleculeIconButton
                label="Send staged selections"
                disabled={!hasStaged || !canSubmit}
                onClick={onSendStaged}
              >
                <ArrowUpRight className="size-4" />
              </GraphMoleculeIconButton>
            </>
          ) : null}
        </GraphMoleculeButtonGroup>
      </div>

      {cameraInfo ? (
        <div className="thread-graph-molecule-camera">
          <div>
            <strong>XYZ: </strong>x={cameraInfo.position.x.toFixed(1)} y=
            {cameraInfo.position.y.toFixed(1)} z=
            {cameraInfo.position.z.toFixed(1)}
            <br />
            <strong>Quat: </strong>qx=
            {cameraInfo.position.qx.toFixed(2)} qy=
            {cameraInfo.position.qy.toFixed(2)} qz=
            {cameraInfo.position.qz.toFixed(2)} qw=
            {cameraInfo.position.qw.toFixed(2)}
          </div>
          <div className="thread-graph-molecule-camera-divider" />
          <div className="flex flex-col gap-1 text-[10px]">
            <div>
              Selected atoms:{' '}
              {selectedSerials.length > 0
                ? selectedSerials
                    .map(
                      (serial) =>
                        `${selectedAtomLabels[serial] ?? 'Atom'}(${serial})`,
                    )
                    .join(', ')
                : 'None'}
            </div>
            {selectionSubmission ? (
              <div>
                Staged: {stagedMolecules} molecule(s), {stagedAtoms} atom(s)
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
