/** @vitest-environment jsdom */
import {useEffect, act} from 'react';
import {createRoot} from 'react-dom/client';
import {test,expect,vi} from 'vitest';
import {webcrypto,createHash} from 'node:crypto';
import {StructureView} from '../../../plugin-xyz/src/index';
const mounted=vi.hoisted(()=>({count:0}));
vi.mock('@remote-codex/thread-ui/scientific-viewer',()=>({GraphMoleculeViewer:({source}:any)=>{
  useEffect(()=>{mounted.count++;},[]);
  return <div data-testid="viewer">{source.content[0]}</div>;
}}));
test('new acknowledged frames update the existing viewer without unmounting it',async()=>{
 Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,configurable:true});
 Object.defineProperty(window.crypto,'subtle',{value:webcrypto.subtle,configurable:true});
 const first='1\nfirst\nHe 0 0 0\n',second=first+'1\nsecond\nHe 1 0 0\n';
 let complete:(value:any)=>void=()=>{};
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,arrayBuffer:async()=>new TextEncoder().encode(first).buffer}).mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;})));
 const node=document.createElement('div'),root=createRoot(node);document.body.append(node);
 const asset=(text:string)=>({url:'/artifact/'+text.length,checksum:createHash('sha256').update(text).digest('hex'),name:'trajectory.xyz',format:'xyz' as const,streamId:'stable'});
 try {
  await act(async()=>{root.render(<StructureView asset={asset(first)}/>);});
  await vi.waitFor(()=>expect(node.textContent).toContain('first'));
  const viewer=node.querySelector('[data-testid="viewer"]');
  await act(async()=>{root.render(<StructureView asset={asset(second)}/>);});
  expect(node.querySelector('[data-testid="viewer"]')).toBe(viewer);
  await act(async()=>{complete({ok:true,arrayBuffer:async()=>new TextEncoder().encode(second).buffer});});
  await vi.waitFor(()=>expect(node.textContent).toContain('second'));
  expect(node.querySelector('[data-testid="viewer"]')).toBe(viewer);
  expect(mounted.count).toBe(1);
 } finally {await act(async()=>root.unmount());node.remove();vi.unstubAllGlobals();}
});

test('finalizing an in-flight immutable stream keeps one GET and still rejects changed target metadata',async()=>{
 Object.defineProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT',{value:true,configurable:true});
 Object.defineProperty(window.crypto,'subtle',{value:webcrypto.subtle,configurable:true});
 const text='1\nfinal frame\nHe 1 0 0\n';
 const checksum=createHash('sha256').update(text).digest('hex');
 const metadata={version:1 as const,objectId:'trajectory',sourceRevision:'final',checksum,format:'xyz' as const,atoms:[{id:'helium',element:'He'}]};
 const asset={url:'/artifact/final',checksum,name:'trajectory.xyz',format:'xyz' as const,metadata,streamId:'stable',frameCount:1,streaming:true};
 let complete:(value:any)=>void=()=>{};
 let signal:AbortSignal|undefined;
 const fetch=vi.fn((_url:any,options:any)=>{signal=options.signal;return new Promise(resolve=>{complete=resolve;});});
 vi.stubGlobal('fetch',fetch);
 const node=document.createElement('div'),root=createRoot(node);document.body.append(node);
 try {
  await act(async()=>{root.render(<StructureView asset={asset}/>);});
  expect(fetch.mock.calls.length,node.textContent??'').toBe(1);
  const firstSignal=signal;
  await act(async()=>{root.render(<StructureView asset={{...asset,streaming:false}}/>);});
  expect(firstSignal?.aborted).toBe(false);
  expect(fetch).toHaveBeenCalledTimes(1);
  await act(async()=>{complete({ok:true,arrayBuffer:async()=>new TextEncoder().encode(text).buffer});});
  await vi.waitFor(()=>expect(node.textContent).toContain('final frame'));
  const viewer=node.querySelector('[data-testid="viewer"]');
  await act(async()=>{root.render(<StructureView asset={asset}/>);});
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(node.querySelector('[data-testid="viewer"]')).toBe(viewer);
  // A metadata mutation remains part of verified identity even with the same
  // URL and artifact checksum. Finalization never bypasses target validation.
  const error=vi.spyOn(console,'error').mockImplementation(()=>{});
  await act(async()=>{root.render(<StructureView asset={{...asset,streaming:false,metadata:{...metadata,checksum:'0'.repeat(64)}}}/>);});
  await vi.waitFor(()=>expect(node.querySelector('[role="alert"]')?.textContent).toBe('Unable to load this structure. Reopen it to try again.'));
  expect(String(error.mock.calls[0]?.[1])).toContain('Canonical metadata checksum differs');
  error.mockRestore();
  expect(fetch).toHaveBeenCalledTimes(1);
 } finally {await act(async()=>root.unmount());node.remove();vi.unstubAllGlobals();}
});
