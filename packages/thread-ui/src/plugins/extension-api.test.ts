import {describe, it, expect} from 'vitest';
import {EXTENSION_FIXTURES, ExtensionValidationError} from '@remote-codex/shared';
import {createExtensionPluginApi} from './extension-api';
import type {FrontendPluginModule, ExtensionHostAdapter} from './plugin-types';

const f = EXTENSION_FIXTURES.grafico;
const module: FrontendPluginModule = {
  manifest: {id: 'reviewed-science', name: 'Reviewed science', version: '1.0.0', description: '', remoteCodex: '*',
    capabilities: {artifactTypes: [], timelineRenderers: [], threadPanels: []}, contribution: f.discovery.contributions[0]!},
  viewerToolbar: [{id: 'submit', label: 'Submit selection', capabilityId: 'elagente.viewer.select', render: () => 'selection'}],
  threadPanels: [{id: 'grafico.workflow', kind: 'science', label: 'Workflow'}],
  renderExtension: () => 'reviewed renderer',
};
describe('reviewed extension plugin API', () => {
  it('hides contributed controls without discovery or a transport callback', () => {
    expect(createExtensionPluginApi([module]).getViewerToolbar()).toEqual([]);
    expect(createExtensionPluginApi([module]).getExtensionPanels()).toEqual([]);
    const api = createExtensionPluginApi([module], {discovery: f.discovery});
    expect(api.getViewerToolbar()).toEqual([]);
    expect(api.getExtensionPanels()).toHaveLength(1);
  });
  it('passes the optional adoptStructure callback through unchanged, and omits it when absent', () => {
    const adoptStructure = async () => undefined;
    expect(createExtensionPluginApi([module], {discovery: f.discovery, adoptStructure}).extensionHost!.adoptStructure).toBe(adoptStructure);
    expect(createExtensionPluginApi([module], {discovery: f.discovery}).extensionHost!.adoptStructure).toBeUndefined();
  });
  it('preserves legacy panels with optional APIs absent', () => {
    const legacy = {...module, manifest: {...module.manifest, contribution: undefined}};
    expect(createExtensionPluginApi([legacy]).getExtensionPanels()).toHaveLength(1);
  });
  it('uses capabilities/contribution identity independently of agent name', () => {
    const host: ExtensionHostAdapter = {discovery: f.discovery, submitInput: async () => f.acknowledgements[0]!};
    expect(createExtensionPluginApi([module], host).getViewerToolbar()).toHaveLength(1);
    const absent = structuredClone(host.discovery); delete absent.capabilities['elagente.viewer.select'];
    expect(createExtensionPluginApi([module], {...host, discovery: absent}).getViewerToolbar()).toEqual([]);
    const subset = structuredClone(host.discovery);
    subset.contributions[0]!.actionIds = [];
    subset.contributions[0]!.panelIds = [];
    const filtered = createExtensionPluginApi([module], {...host, discovery: subset});
    expect(filtered.getViewerToolbar()).toEqual([]);
    expect(filtered.getExtensionPanels()).toEqual([]);
    const other = createExtensionPluginApi([module], {...host, discovery: EXTENSION_FIXTURES.cuantico.discovery});
    expect(other.getExtensionPanels()).toEqual([]);
  });
  it('rejects wrong operation/frame acknowledgements before native delivery', async () => {
    let calls = 0;
    const host: ExtensionHostAdapter = {discovery: f.discovery, acknowledgeAction: async () => {calls++;}};
    const api = createExtensionPluginApi([module], host);
    const wrong = structuredClone(f.acknowledgements[1]!); wrong.target.frameIndex = 1;
    await expect(api.extensionHost!.acknowledgeAction!(f.input, wrong)).rejects.toBeInstanceOf(ExtensionValidationError);
    expect(calls).toBe(0);
    await api.extensionHost!.acknowledgeAction!(f.input, f.acknowledgements[1]!);
    expect(calls).toBe(1);
  });
  it('validates explicit input and returned acceptance, without synthesizing completion', async () => {
    let calls = 0;
    const api = createExtensionPluginApi([module], {discovery: f.discovery, submitInput: async () => {calls++; return f.acknowledgements[0]!;}});
    const wrong = {...f.input, submission: 'background'};
    await expect(api.extensionHost!.submitInput!(wrong as typeof f.input)).rejects.toBeInstanceOf(ExtensionValidationError);
    expect(calls).toBe(0);
    expect((await api.extensionHost!.submitInput!(f.input)).status).toBe('accepted');
    expect(calls).toBe(1);
  });
  it('never loads executable UI from unknown runtime contribution data', () => {
    const api = createExtensionPluginApi([module], {discovery: f.discovery});
    expect(api.renderExtension({extension: f.unknownItem.extension})).toBeNull();
    expect(api.renderExtension({extension: {version: 1, type: 'grafico.science', data: {entry: 'https://malicious.example/code.js'}}})).toBe('reviewed renderer');
    expect(() => api.renderExtension({extension: {version: 2, type: 'grafico.science', data: {}} as never})).toThrow(ExtensionValidationError);
  });
});
