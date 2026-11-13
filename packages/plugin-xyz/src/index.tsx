import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  usePlugins,
  type ExtensionHostAdapter,
  type FrontendPluginModule,
} from '@remote-codex/thread-ui';
import {
  GraphMoleculeViewer,
  isViewerInputQueued,
  readGraphMoleculeViewerData,
} from '@remote-codex/thread-ui/scientific-viewer';
import {
  validateArtifactMetadata,
  validateScientificTarget,
  validateViewerInput,
  validateViewerAcknowledgement,
  type ArtifactMetadata,
  type ScientificTarget,
  type ViewerInput,
  type JsonValue,
} from '@remote-codex/shared';

type ViewerProps = React.ComponentProps<typeof GraphMoleculeViewer>;
export const INLINE_STRUCTURE_CAPABILITY = 'elagente.structure.inline-source';
export const INLINE_STRUCTURE_MAX_BYTES = 65536;
export interface InlineStructureSource {
  version: 1;
  encoding: 'utf8';
  content: string;
}
export interface StructureAsset {
  url: string;
  checksum: string;
  format: 'xyz' | 'extxyz' | 'cif' | 'pdb' | 'sdf' | 'mol' | 'cube' | 'cub';
  name: string;
  artifactId?: string;
  metadata?: ArtifactMetadata & { inlineSource?: InlineStructureSource };
  target?: ScientificTarget;
  frameTargets?: ScientificTarget[];
  /** Optional canonical file when url points to a distinct render representation. */
  source?: {
    url: string;
    checksum: string;
    format: StructureAsset['format'];
    name: string;
  };
  streamId?: string;
  frameCount?: number;
  streaming?: boolean;
}

async function verifiedBytes(
  asset: { url: string; checksum: string },
  signal: AbortSignal,
  inline?: InlineStructureSource,
): Promise<ArrayBuffer> {
  const url = new URL(asset.url, window.location.href);
  if (url.origin !== window.location.origin)
    throw new Error('Structure assets must come from this app-server');
  if (!/^[a-f0-9]{64}$/.test(asset.checksum))
    throw new Error('Invalid structure checksum');
  let bytes: ArrayBuffer;
  if (inline !== undefined) {
    if (
      !inline ||
      Object.keys(inline).some(
        (key) => !['version', 'encoding', 'content'].includes(key),
      ) ||
      inline.version !== 1 ||
      inline.encoding !== 'utf8' ||
      typeof inline.content !== 'string' ||
      !inline.content.length ||
      inline.content.length > INLINE_STRUCTURE_MAX_BYTES
    )
      throw new Error('Invalid inline immutable structure source');
    const encoded = new TextEncoder().encode(inline.content);
    if (
      encoded.byteLength > INLINE_STRUCTURE_MAX_BYTES ||
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
        encoded,
      ) !== inline.content
    )
      throw new Error(
        'Inline immutable structure exceeds its UTF-8 byte limit',
      );
    bytes = encoded.buffer;
  } else {
    const response = await fetch(url, { signal, redirect: 'error' });
    if (!response.ok)
      throw new Error(`Structure download failed (${response.status})`);
    bytes = await response.arrayBuffer();
  }
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    (value) => value.toString(16).padStart(2, '0'),
  ).join('');
  if (digest !== asset.checksum)
    throw new Error('Structure checksum differs from the published artifact');
  return bytes;
}

// The viewer shows the message; the developer detail goes to the console only.
function userError(message: string, detail: unknown): Error {
  console.warn(`[plugin-xyz] ${message}`, detail);
  return new Error(message);
}

function sourceTarget(asset: StructureAsset): ScientificTarget | undefined {
  if (asset.metadata) validateArtifactMetadata(asset.metadata);
  const canonicalChecksum = asset.source?.checksum ?? asset.checksum;
  if (asset.metadata && asset.metadata.checksum !== canonicalChecksum)
    throw new Error(
      'Canonical metadata checksum differs from its immutable source',
    );
  const target =
    asset.target ??
    (asset.metadata && asset.artifactId
      ? {
          artifactId: asset.artifactId,
          objectId: asset.metadata.objectId,
          sourceRevision: asset.metadata.sourceRevision,
          checksum: canonicalChecksum,
          ...(asset.metadata.stream
            ? {
                streamId: asset.metadata.stream.id,
                frameId: asset.metadata.stream.frameId,
                frameIndex: asset.metadata.stream.frameIndex,
              }
            : {}),
        }
      : undefined);
  if (target) {
    validateScientificTarget(target);
    if (
      target.checksum !== canonicalChecksum ||
      (asset.metadata &&
        (target.objectId !== asset.metadata.objectId ||
          target.sourceRevision !== asset.metadata.sourceRevision))
    )
      throw new Error('Viewer target differs from verified source identity');
  }
  asset.frameTargets?.forEach((frame) => {
    validateScientificTarget(frame);
    if (!target || frame.objectId !== target.objectId)
      throw new Error(
        'Trajectory target differs from verified source identity',
      );
  });
  return target;
}

export function StructureView({
  asset,
  onReady,
  onActive,
  onRevisionChange,
  onOpenFile,
  presentation = 'timeline',
  extensionHost,
  onSelectionSubmit,
  onSelectionChange,
  onScreenshot,
  toolbar,
  rendererSlot,
  submissionActions,
  displayName,
  displayPath,
}: {
  asset: StructureAsset;
  /** The object's name for the user, e.g. "ethanol.xyz (edit 2)"; defaults to the file name. */
  displayName?: string;
  /** The revision's file path, shown as the title's tooltip. */
  displayPath?: string;
  presentation?: 'timeline' | 'workspace';
  onOpenFile?: () => void;
  onReady?: ViewerProps['onReady'];
  onActive?: ViewerProps['onActive'];
  onRevisionChange?: ViewerProps['onRevisionChange'];
  extensionHost?: ExtensionHostAdapter;
  onSelectionSubmit?: ViewerProps['onSelectionSubmit'];
  onSelectionChange?: ViewerProps['onSelectionChange'];
  onScreenshot?: ViewerProps['onScreenshot'];
  toolbar?: ViewerProps['toolbar'];
  rendererSlot?: ViewerProps['rendererSlot'];
  submissionActions?: { selection?: string; screenshot?: string };
}) {
  const plugins = usePlugins();
  const host = extensionHost ?? plugins.extensions?.extensionHost;
  const inlineEnabled =
    host?.discovery.capabilities[INLINE_STRUCTURE_CAPABILITY] === true;
  const [loaded, setLoaded] = useState<{
    asset: StructureAsset;
    content: string;
    bytes: ArrayBuffer;
    key: string;
    target?: ScientificTarget;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Finalizing a stream changes its delivery status, not the immutable bytes
  // or target. Keep an in-flight verification rather than aborting/refetching
  // the same file. Every source, metadata and frame identity field stays keyed.
  const assetKey = JSON.stringify({ ...asset, streaming: undefined });
  const latestAsset = useRef(assetKey);
  latestAsset.current = assetKey;
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    void (async () => {
      const target = sourceTarget(asset);
      const inline = inlineEnabled ? asset.metadata?.inlineSource : undefined;
      if (inline !== undefined && asset.metadata?.checksum !== asset.checksum)
        throw new Error(
          'Inline structure checksum must match the published artifact and canonical metadata',
        );
      const renderBytes = await verifiedBytes(asset, controller.signal, inline);
      const bytes = asset.source
        ? await verifiedBytes(asset.source, controller.signal, inline)
        : renderBytes;
      const content = new TextDecoder('utf-8', { fatal: true }).decode(
        renderBytes,
      );
      if (asset.frameTargets) {
        const frames = readGraphMoleculeViewerData({
          content: [
            new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
              bytes,
            ),
          ],
          format: asset.source?.format ?? asset.format,
        }).frames;
        if (asset.frameTargets.length !== frames.length)
          throw new Error(
            'Frame identity count differs from the source trajectory',
          );
        for (let index = 0; index < frames.length; index++) {
          const frame = asset.frameTargets[index]!;
          if (frame.frameIndex !== index || !frame.frameId || !frame.streamId)
            throw new Error(
              'Frame identity does not match its trajectory position',
            );
          if (frame.checksum !== (asset.source?.checksum ?? asset.checksum)) {
            const hash = Array.from(
              new Uint8Array(
                await crypto.subtle.digest(
                  'SHA-256',
                  new TextEncoder().encode(frames[index]),
                ),
              ),
              (value) => value.toString(16).padStart(2, '0'),
            ).join('');
            if (hash !== frame.checksum)
              throw new Error(
                'Frame checksum differs from verified immutable bytes',
              );
          }
        }
      }
      if (!controller.signal.aborted)
        setLoaded({ asset, target, bytes, key: assetKey, content });
    })().catch((reason) => {
      if (controller.signal.aborted) return;
      console.error('[plugin-xyz] Structure verification failed:', reason);
      setError(String(reason));
    });
    return () => controller.abort();
  }, [assetKey, inlineEnabled]);
  const source = useMemo(
    () =>
      loaded
        ? {
            content: [loaded.content],
            format: loaded.asset.format,
            uuid:
              loaded.target?.objectId ??
              loaded.asset.streamId ??
              loaded.asset.checksum,
            metadata: loaded.asset.metadata,
            target: loaded.target,
            frameTargets: loaded.asset.frameTargets,
          }
        : null,
    [loaded],
  );
  const loading = loaded?.key !== assetKey || Boolean(error);
  const selectionAction =
    submissionActions?.selection ?? 'elagente.viewer.select';
  const screenshotAction =
    submissionActions?.screenshot ?? 'elagente.viewer.screenshot';
  const available = (id: string) =>
    Boolean(
      host?.submitInput &&
      host.discovery.capabilities[id] &&
      host.discovery.actions.some(
        (action) => action.id === id && action.execution === 'native',
      ),
    );
  const pendingInputs = useRef(new Map<string, ViewerInput>());
  const pendingGroups = useRef(new Map<string, Set<number>>());
  async function submit(
    kind: ViewerInput['kind'],
    actionId: string,
    target: ScientificTarget | undefined,
    payload: JsonValue,
  ) {
    if (
      !host?.submitInput ||
      !target ||
      loading ||
      latestAsset.current !== loaded?.key
    )
      throw userError(
        'Wait for the structure to finish loading, then try again.',
        'An immutable current target and host submission callback are required.',
      );
    const key = JSON.stringify({ kind, actionId, target, payload });
    let input = pendingInputs.current.get(key);
    if (!input) {
      if (pendingInputs.current.size >= 128)
        throw userError(
          'Too many unsent requests. Reload the page, then try again.',
          'Viewer submission retry quota reached.',
        );
      const id = crypto.randomUUID();
      input = {
        version: 1,
        requestId: id,
        operationId: id,
        actionId,
        kind,
        submission: 'explicit',
        target,
        payload,
      };
      pendingInputs.current.set(key, input);
    }
    try {
      validateViewerInput(input, host.discovery);
    } catch (error) {
      throw userError('This can’t be sent to the Agent.', error);
    }
    let acknowledgement;
    try {
      acknowledgement = await host.submitInput(input);
    } catch (error) {
      // Queued behind a running turn is durable acceptance, as `accepted` is.
      if (isViewerInputQueued(error)) pendingInputs.current.delete(key);
      throw error;
    }
    try {
      validateViewerAcknowledgement(acknowledgement, input, host.discovery);
    } catch (error) {
      throw userError(
        'The Agent’s reply doesn’t match this structure. Reopen it, then try again.',
        error,
      );
    }
    if (acknowledgement.status === 'rejected') {
      pendingInputs.current.delete(key);
      throw new Error(
        acknowledgement.error?.message ?? 'The Agent didn’t accept this.',
      );
    }
    // `accepted` means the coordinator durably took the input and the Agent
    // applies it in its own turn; a later failure is the host's to report.
    pendingInputs.current.delete(key);
  }
  const selectionCallback: ViewerProps['onSelectionSubmit'] =
    onSelectionSubmit ??
    (available(selectionAction) && loaded?.target
      ? async ({ selections }) => {
          // Validate the entire group before the first network operation; each object
          // carries its own immutable target. Native submission is per object.
          selections.forEach((selection) => {
            if (!selection.target)
              throw userError(
                'Select the atoms again, then send.',
                'Selection has no immutable target',
              );
            const input: ViewerInput = {
              version: 1,
              requestId: 'validation',
              operationId: 'validation',
              actionId: selectionAction,
              kind: 'selection',
              submission: 'explicit',
              target: selection.target,
              payload: { selectedIds: selection.selectedIds },
            };
            try {
              validateViewerInput(input, host!.discovery);
            } catch (error) {
              throw userError('This selection can’t be sent to the Agent.', error);
            }
          });
          const groupKey = JSON.stringify(selections);
          let completed = pendingGroups.current.get(groupKey);
          if (!completed) {
            if (pendingGroups.current.size >= 128)
              throw userError(
                'Too many unsent selections. Reload the page, then try again.',
                'Staged selection retry quota reached.',
              );
            completed = new Set<number>();
            pendingGroups.current.set(groupKey, completed);
          }
          // A queued entry counts as sent: continue with the next one, then
          // report the queued status once every entry has been taken.
          let queued: unknown = null;
          for (let index = 0; index < selections.length; index++) {
            if (completed.has(index)) continue;
            const selection = selections[index]!;
            try {
              await submit('selection', selectionAction, selection.target, {
                selectedIds: selection.selectedIds,
              });
            } catch (error) {
              if (!isViewerInputQueued(error)) throw error;
              queued ??= error;
            }
            completed.add(index);
          }
          pendingGroups.current.delete(groupKey);
          if (queued) throw queued;
        }
      : undefined);
  const screenshotCallback: ViewerProps['onScreenshot'] =
    onScreenshot ??
    // Artifact-backed PNG inputs require the host upload callback. Keep the
    // older reviewed inline-PNG adapter only for schemas which actually accept it.
    (available(screenshotAction) &&
    loaded?.target &&
    host?.discovery.actions.some(
      (action) =>
        action.id === screenshotAction &&
        action.inputSchema.type === 'object' &&
        action.inputSchema.properties.image?.type === 'string',
    )
      ? (screenshot) =>
          submit('screenshot', screenshotAction, screenshot.target, {
            image: screenshot.image,
            mediaType: 'image/png',
            trajectoryIndex: screenshot.trajectoryIndex,
            camera: screenshot.camera,
          })
      : undefined);
  function downloadSource() {
    if (!loaded) return;
    const url = URL.createObjectURL(
      new Blob([loaded.bytes], { type: 'application/octet-stream' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = loaded.asset.source?.name ?? loaded.asset.name;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  // A missing action is a normal Agent configuration and shows nothing. A
  // hint appears only when the Agent offers the action but this structure has
  // no published target, which the user can fix by opening an Agent's structure.
  const unsentActions = [
    !selectionCallback && available(selectionAction) && !loaded?.target
      ? 'a selection'
      : null,
    !screenshotCallback && available(screenshotAction) && !loaded?.target
      ? 'a screenshot'
      : null,
  ].filter(Boolean);
  const hasSelectionCallback = Boolean(selectionCallback);
  const hasScreenshotCallback = Boolean(screenshotCallback);
  useEffect(() => {
    if (!loaded) return;
    if (!hasSelectionCallback)
      console.debug(
        '[plugin-xyz] Selection submission is unavailable: the host must advertise an action and provide an immutable target.',
      );
    if (!hasScreenshotCallback)
      console.debug(
        '[plugin-xyz] PNG submission is unavailable: the host must provide an upload callback or advertise a PNG input action.',
      );
  }, [loaded, hasSelectionCallback, hasScreenshotCallback]);
  const loadFailure = 'Unable to load this structure. Reopen it to try again.';
  if (!loaded)
    return error ? (
      <p role="alert">{loadFailure}</p>
    ) : (
      <p>Loading molecular structure…</p>
    );
  return (
    <div
      className="xyz-plugin"
      data-testid="xyz-plugin"
      style={{
        position: 'relative',
        display: presentation === 'workspace' ? 'flex' : undefined,
        flexDirection: presentation === 'workspace' ? 'column' : undefined,
        flex: presentation === 'workspace' ? 1 : undefined,
        height: presentation === 'workspace' ? '100%' : undefined,
        minHeight: 0,
      }}
    >
      {error && <p role="alert">{loadFailure}</p>}
      {loading && !error && (
        <p
          role="status"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1,
            pointerEvents: 'none',
            background: 'var(--theme-surface, white)',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 12,
          }}
        >
          Verifying updated structure…
        </p>
      )}
      <GraphMoleculeViewer
        source={source}
        moleculeId={loaded.target?.objectId ?? loaded.asset.name}
        title={displayName || loaded.asset.name}
        titleDetail={
          displayName && displayName !== loaded.asset.name
            ? (displayPath ?? loaded.asset.name)
            : undefined
        }
        presentation={presentation}
        onOpenFile={onOpenFile}
        onReady={onReady}
        onActive={onActive}
        onRevisionChange={onRevisionChange}
        extensionHost={host}
        loading={loading}
        onSelectionChange={onSelectionChange}
        onSelectionSubmit={selectionCallback}
        onScreenshot={screenshotCallback}
        onDownloadSource={downloadSource}
        toolbar={(context) => (
          <>
            {context.target &&
              (plugins.extensions?.getViewerToolbar() ?? []).map(
                (contribution) => (
                  <React.Fragment key={contribution.id}>
                    {contribution.render({
                      target: context.target!,
                      selectedIds: context.selectedIds,
                      host,
                    })}
                  </React.Fragment>
                ),
              )}
            {toolbar?.(context)}
          </>
        )}
        rendererSlot={rendererSlot}
      />
      {unsentActions.length > 0 && (
        <p role="note">
          Open a structure the Agent has produced to send{' '}
          {unsentActions.join(' or ')}.
        </p>
      )}
    </div>
  );
}

export const xyzPlugin: FrontendPluginModule = {
  manifest: {
    id: 'elagente.xyz',
    name: 'Molecular structures',
    version: '0.1.1',
    description:
      'Molecular and crystal structures, trajectories, atom selection and screenshots.',
    remoteCodex: '*',
    capabilities: {
      artifactTypes: [
        {
          type: 'chem.structure',
          title: 'Molecular structure',
          fileExtensions: ['xyz', 'extxyz', 'cif', 'pdb', 'sdf', 'mol', 'cube', 'cub'],
        },
      ],
      timelineRenderers: ['chem.structure'],
      threadPanels: [],
    },
  },
  renderArtifact: ({
    artifact,
    presentation,
    onOpenFile,
    extensionHost,
    displayName,
  }) => (
    <StructureView
      asset={{
        ...(artifact.payload as StructureAsset),
        artifactId: artifact.id,
        metadata:
          artifact.metadata ?? (artifact.payload as StructureAsset).metadata,
      }}
      presentation={presentation}
      onOpenFile={onOpenFile}
      extensionHost={extensionHost}
      displayName={displayName}
      displayPath={artifact.workspacePath}
    />
  ),
};
