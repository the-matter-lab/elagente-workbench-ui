import { translate, useI18n } from '../../i18n';
import type { GLModel, GLViewer } from '3dmol';

export type ThreeDmolApi = {
  createViewer(element: HTMLElement, options?: Record<string, unknown>): GLViewer;
  /** Parses volumetric text (here Gaussian cube) once for several isosurfaces. */
  VolumeData?: new (data: string, format: string) => unknown;
};

declare global {
  interface Window {
    '3Dmol'?: ThreeDmolApi;
  }
}

let threeDmolPromise: Promise<ThreeDmolApi> | null = null;

export async function load3Dmol(): Promise<ThreeDmolApi> {
  if (typeof window === 'undefined') {
    throw new Error(translate("files.3DmolIsOnlyAvailableInABrowser"));
  }

  if (window['3Dmol']) {
    return window['3Dmol'];
  }

  if (!threeDmolPromise) {
    threeDmolPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-pockymoe-3dmol="true"]',
      );

      const handleLoad = () => {
        if (window['3Dmol']) {
          resolve(window['3Dmol']);
          return;
        }
        reject(new Error(translate("files.3DmolLoadedWithoutExposingTheExpectedGlobal")));
      };

      if (existingScript) {
        existingScript.addEventListener('load', handleLoad, { once: true });
        existingScript.addEventListener(
          'error',
          () => reject(new Error(translate("files.unableToLoad3DmolViewerRuntime"))),
          { once: true },
        );
        return;
      }

      const script = document.createElement('script');
      script.src = '/vendor/3Dmol-min.js';
      script.async = true;
      script.dataset.pockymoe3dmol = 'true';
      script.addEventListener('load', handleLoad, { once: true });
      script.addEventListener(
        'error',
        () => reject(new Error(translate("files.unableToLoad3DmolViewerRuntime"))),
        { once: true },
      );
      document.head.appendChild(script);
    });
  }

  return threeDmolPromise;
}

export type { GLModel, GLViewer };
