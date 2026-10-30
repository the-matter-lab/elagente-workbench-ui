import {
  editorThemeFor,
  monacoLanguage
} from "./chunk-PXXYKVFI.js";
import "./chunk-4LB7J3FW.js";
import {
  useDocumentThemeRevision
} from "./chunk-LPTBJWOL.js";
import {
  translate
} from "./chunk-S2ZDXRUN.js";

// src/components/graph-workspace/GraphWorkspaceMonacoDiff.tsx
import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor/editor/editor.api.js";
import { jsx } from "react/jsx-runtime";
function WorkspaceDocumentDiff({
  original,
  modified,
  language,
  dark,
  compact
}) {
  const host = useRef(null);
  const themeRevision = useDocumentThemeRevision();
  useEffect(() => {
    if (!host.current) return;
    const left = monaco.editor.createModel(original, monacoLanguage(language));
    const right = monaco.editor.createModel(modified, monacoLanguage(language));
    const editor2 = monaco.editor.createDiffEditor(host.current, {
      readOnly: true,
      automaticLayout: true,
      renderSideBySide: !compact,
      originalEditable: false,
      theme: editorThemeFor(dark, host.current),
      minimap: { enabled: false },
      fontSize: 12,
      scrollBeyondLastLine: false,
      ariaLabel: translate("files.safeCompare")
    });
    editor2.setModel({ original: left, modified: right });
    return () => {
      editor2.dispose();
      left.dispose();
      right.dispose();
    };
  }, [original, modified, language, dark, compact, themeRevision]);
  return /* @__PURE__ */ jsx(
    "div",
    {
      ref: host,
      className: "h-full w-full",
      "data-testid": "workspace-conflict-diff"
    }
  );
}
export {
  WorkspaceDocumentDiff as default
};
