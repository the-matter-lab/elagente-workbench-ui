import type { GLModel, GLViewer } from './load3Dmol';
export type RenderAtom = {
  atom?: string;
  elem?: string;
  index?: number;
  serial?: number;
  x: number;
  y: number;
  z: number;
  bonds?: number[];
  bondOrder?: number[];
};
export type RenderModel = GLModel & {
  selectedAtoms(selection: Record<string, unknown>): RenderAtom[];
};
export type RenderViewer = Omit<
  GLViewer,
  'addModel' | 'getView' | 'addLabel'
> & {
  addModel(
    content: string,
    format: string,
    options?: Record<string, unknown>,
  ): RenderModel;
  getView(): number[];
  setView(view: number[]): void;
  spin?(axis: string | false, speed?: number): void;
  stopAnimate?(): unknown;
  clear?(): unknown;
  addLine(spec: Record<string, unknown>): object;
  removeShape(shape: object): void;
  removeAllSurfaces(): void;
  /** 3Dmol 2.x: draws one isosurface of a parsed VolumeData as a shape. */
  addIsosurface?(data: unknown, spec: Record<string, unknown>): object;
  addSurface(
    type: string,
    style: Record<string, unknown>,
    selection: Record<string, unknown>,
  ): unknown;
  addLabel(
    text: string,
    options: Record<string, unknown>,
    selection?: Record<string, unknown>,
    noshow?: boolean,
  ): unknown;
};
