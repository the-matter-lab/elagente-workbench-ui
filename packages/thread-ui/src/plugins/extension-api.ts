import {
  hasCapability,
  validateDiscovery,
  validateExtension,
  validateViewerInput,
  validateViewerAcknowledgement,
  type ViewerInput,
  type ViewerRequest,
  type ViewerAcknowledgement,
} from '@remote-codex/shared';
import type {ExtensionHostAdapter, ExtensionRenderContext, FrontendPluginModule} from './plugin-types';

/** Only reviewed, imported modules participate. Wire contribution IDs are data. */
export function extensionModuleAvailable(module: FrontendPluginModule, host?: ExtensionHostAdapter) {
  const contribution = module.manifest.contribution;
  if (!contribution) return true; // Preserve existing upstream plugins.
  if (!host) return false;
  return host.discovery.contributions.some(c =>
    c.id === contribution.id && c.type === contribution.type &&
    c.version === contribution.version && c.minContractVersion <= host.discovery.contractVersion);
}

function declared(module: FrontendPluginModule, key: 'panelIds' | 'actionIds', id: string, host?: ExtensionHostAdapter) {
  const local = module.manifest.contribution;
  if (!local) return true;
  const remote = host?.discovery.contributions.find(c => c.id === local.id && c.type === local.type && c.version === local.version);
  return local[key].includes(id) && Boolean(remote?.[key].includes(id));
}

export function createExtensionPluginApi(modules: FrontendPluginModule[], adapter?: ExtensionHostAdapter) {
  if (adapter) validateDiscovery(adapter.discovery);
  const host: ExtensionHostAdapter | undefined = adapter && {
    discovery: adapter.discovery,
    submitInput: adapter.submitInput && (async (input: ViewerInput) => {
      validateViewerInput(input, adapter.discovery);
      const ack = await adapter.submitInput!(input);
      return validateViewerAcknowledgement(ack, input, adapter.discovery);
    }),
    adoptStructure: adapter.adoptStructure,
    acknowledgeAction: adapter.acknowledgeAction && (async (request: ViewerRequest, ack: ViewerAcknowledgement) => {
      validateViewerAcknowledgement(ack, request, adapter.discovery);
      await adapter.acknowledgeAction!(request, ack);
    }),
  };
  const available = modules.filter(m => extensionModuleAvailable(m, host));
  return {
    extensionHost: host,
    hasCapability: (id: string) => hasCapability(host?.discovery, id),
    getViewerToolbar: () => available.flatMap(m => (m.viewerToolbar ?? []).filter(t =>
      hasCapability(host?.discovery, t.capabilityId) &&
      Boolean(host?.discovery.actions.find(a => a.id === t.capabilityId)?.execution === 'browser'
        ? host?.acknowledgeAction : host?.submitInput) &&
      declared(m, 'actionIds', t.capabilityId, host))),
    getExtensionPanels: () => available.flatMap(m => (m.threadPanels ?? []).filter(p =>
      (!p.capabilityId || hasCapability(host?.discovery, p.capabilityId)) &&
      declared(m, 'panelIds', p.id, host))),
    renderExtension: (context: ExtensionRenderContext) => {
      validateExtension(context.extension, host?.discovery);
      const module = available.find(m => m.manifest.contribution?.type === context.extension.type && m.renderExtension);
      return module?.renderExtension?.({...context, host}) ?? null;
    },
  };
}

export type ExtensionPluginApi = ReturnType<typeof createExtensionPluginApi>;
