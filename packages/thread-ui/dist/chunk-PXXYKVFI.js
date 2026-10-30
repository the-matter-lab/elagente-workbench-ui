import {
  codeLanguage
} from "./chunk-4LB7J3FW.js";
import {
  cssHexVariable,
  useDocumentThemeRevision
} from "./chunk-LPTBJWOL.js";
import {
  translate,
  useI18n
} from "./chunk-S2ZDXRUN.js";

// src/components/graph-workspace/GraphWorkspaceMonacoEditor.tsx
import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor/editor/editor.api.js";
import "monaco-editor/languages/definitions/cpp/register.js";
import "monaco-editor/languages/definitions/css/register.js";
import "monaco-editor/languages/definitions/html/register.js";
import "monaco-editor/languages/definitions/java/register.js";
import "monaco-editor/languages/definitions/javascript/register.js";
import "monaco-editor/languages/definitions/markdown/register.js";
import "monaco-editor/languages/definitions/python/register.js";
import "monaco-editor/languages/definitions/rust/register.js";
import "monaco-editor/languages/definitions/shell/register.js";
import "monaco-editor/languages/definitions/sql/register.js";
import "monaco-editor/languages/definitions/typescript/register.js";
import "monaco-editor/languages/definitions/yaml/register.js";
import { jsx } from "react/jsx-runtime";
window.MonacoEnvironment ??= {
  getWorker: () => {
    return new Worker(new URL("./workspace-editor.worker.js", import.meta.url), {
      type: "module"
    });
  }
};
if (!monaco.languages.getLanguages().some(({ id }) => id === "json")) {
  monaco.languages.register({
    id: "json",
    extensions: [".json", ".jsonl"],
    aliases: ["JSON", "json"]
  });
  monaco.languages.setMonarchTokensProvider("json", {
    tokenizer: {
      root: [
        [/[{}[\]]/, "delimiter.bracket"],
        [/[,:]/, "delimiter"],
        [/"(?:[^"\\]|\\.)*"(?=\s*:)/, "key"],
        [/"(?:[^"\\]|\\.)*"/, "string.value"],
        [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, "number"],
        [/\b(?:true|false|null)\b/, "keyword"]
      ]
    }
  });
}
monaco.editor.defineTheme("pockymoe-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#111318",
    "editor.foreground": "#d8dde7",
    "editorLineNumber.foreground": "#6f7787",
    "editorLineNumber.activeForeground": "#d8dde7",
    "editor.lineHighlightBackground": "#1b2029",
    "editor.selectionBackground": "#39475d",
    "editor.inactiveSelectionBackground": "#2a3444",
    "editorCursor.foreground": "#e8edf5",
    "editorIndentGuide.background1": "#282e38",
    "editorIndentGuide.activeBackground1": "#505969"
  }
});
monaco.editor.defineTheme("pockymoe-light", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#f8f9fb",
    "editor.foreground": "#20242c",
    "editorLineNumber.foreground": "#9299a6",
    "editorLineNumber.activeForeground": "#3a404b",
    "editor.lineHighlightBackground": "#eef1f5",
    "editor.selectionBackground": "#c9d8eb",
    "editor.inactiveSelectionBackground": "#dde5ef",
    "editorCursor.foreground": "#242933",
    "editorIndentGuide.background1": "#e1e5eb",
    "editorIndentGuide.activeBackground1": "#aeb6c3"
  }
});
var editorColorVariables = {
  "editor.background": "--editor-bg",
  "editorGutter.background": "--editor-bg",
  "editor.foreground": "--editor-fg",
  "editorLineNumber.foreground": "--editor-line-number",
  "editorLineNumber.activeForeground": "--editor-fg",
  "editor.lineHighlightBackground": "--editor-line-highlight",
  "editor.selectionBackground": "--editor-selection",
  "editor.inactiveSelectionBackground": "--editor-selection-inactive",
  "editorCursor.foreground": "--editor-cursor",
  "editorIndentGuide.background1": "--editor-indent",
  "editorIndentGuide.activeBackground1": "--editor-indent-active",
  "diffEditor.insertedTextBackground": "--editor-diff-inserted",
  "diffEditor.removedTextBackground": "--editor-diff-removed",
  "diffEditor.insertedLineBackground": "--editor-diff-inserted-line",
  "diffEditor.removedLineBackground": "--editor-diff-removed-line",
  "editorBracketHighlight.foreground1": "--editor-bracket-1",
  "editorBracketHighlight.foreground2": "--editor-bracket-2",
  "editorBracketHighlight.foreground3": "--editor-bracket-3"
};
var editorTokenVariables = {
  "--editor-token-keyword": ["keyword", "keyword.json", "storage"],
  "--editor-token-string": ["string", "string.value", "attribute.value", "regexp", "string.escape"],
  "--editor-token-constant": ["number", "constant", "predefined"],
  "--editor-token-comment": ["comment", "comment.doc"],
  "--editor-token-type": ["type", "type.identifier", "tag", "key", "attribute.name", "metatag"],
  "--editor-token-punctuation": ["delimiter", "delimiter.bracket", "delimiter.parenthesis", "operator"]
};
function editorThemeFor(dark, container) {
  const base = dark ? "pockymoe-dark" : "pockymoe-light";
  const colors = Object.fromEntries(Object.entries(editorColorVariables).map(([key, variable]) => [key, cssHexVariable(container, variable)]).filter((entry) => Boolean(entry[1])));
  if (!colors["editor.background"]) return base;
  const rules = Object.entries(editorTokenVariables).flatMap(([variable, tokens]) => {
    const color = cssHexVariable(container, variable);
    const fontStyle = variable === "--editor-token-comment" ? "italic" : void 0;
    return color ? tokens.map((token) => ({ token, foreground: color.slice(1), ...fontStyle ? { fontStyle } : {} })) : [];
  });
  const name = `${base}-preset`;
  monaco.editor.defineTheme(name, { base: dark ? "vs-dark" : "vs", inherit: true, rules, colors });
  return name;
}
var releasedKeys = /* @__PURE__ */ new Set();
var retainedModels = /* @__PURE__ */ new Map();
window.addEventListener("workspace-model-release", (event) => {
  const key = event.detail;
  releasedKeys.add(key);
  retainedModels.get(key)?.model.dispose();
  retainedModels.delete(key);
});
function monacoLanguage(language) {
  const id = codeLanguage(language);
  return monaco.languages.getLanguages().some((entry) => entry.id === id) ? id : "plaintext";
}
function GraphWorkspaceMonacoEditor({
  content,
  resourceKey,
  retainModel = false,
  dark,
  focusLine,
  language,
  onChange,
  onSave,
  path,
  readOnly
}) {
  const modelKey = resourceKey ?? path;
  const { locale } = useI18n();
  const themeRevision = useDocumentThemeRevision();
  const hostRef = useRef(null);
  const editorRef = useRef(null);
  const modelRef = useRef(null);
  const applyingContentRef = useRef(false);
  const initialContentRef = useRef(content);
  const initialDarkRef = useRef(dark);
  const initialLanguageRef = useRef(language);
  const initialReadOnlyRef = useRef(readOnly);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;
  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const uri = monaco.Uri.from({
      scheme: "remote-codex-workspace",
      path: `/${encodeURIComponent(modelKey)}`
    });
    releasedKeys.delete(modelKey);
    const retained = retainedModels.get(modelKey);
    retainedModels.delete(modelKey);
    const existingModel = retained?.model ?? monaco.editor.getModel(uri);
    const model = existingModel ?? monaco.editor.createModel(
      initialContentRef.current,
      monacoLanguage(initialLanguageRef.current),
      uri
    );
    modelRef.current = model;
    const editor2 = monaco.editor.create(host, {
      model,
      readOnly: initialReadOnlyRef.current,
      automaticLayout: true,
      theme: editorThemeFor(initialDarkRef.current, host),
      ariaLabel: translate("files.workspaceEditor", { value1: path }),
      fontFamily: '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      lineHeight: 21,
      lineNumbersMinChars: 3,
      minimap: { enabled: false },
      folding: true,
      foldingHighlight: true,
      glyphMargin: false,
      guides: { indentation: true, bracketPairs: true },
      bracketPairColorization: { enabled: true },
      renderLineHighlight: "all",
      renderWhitespace: "selection",
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      wordWrap: "off",
      padding: { top: 10, bottom: 18 },
      overviewRulerBorder: false,
      stickyScroll: { enabled: true }
    });
    if (retained?.view) editor2.restoreViewState(retained.view);
    editorRef.current = editor2;
    const changeSubscription = model.onDidChangeContent(() => {
      if (!applyingContentRef.current) {
        onChangeRef.current?.(model.getValue(monaco.editor.EndOfLinePreference.LF));
      }
    });
    editor2.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSaveRef.current?.();
    });
    return () => {
      changeSubscription.dispose();
      if (retainModel && !releasedKeys.has(modelKey)) retainedModels.set(modelKey, { model, view: editor2.saveViewState() });
      editor2.dispose();
      editorRef.current = null;
      modelRef.current = null;
      if (!retainModel || releasedKeys.has(modelKey)) {
        model.dispose();
      }
    };
  }, [path, modelKey, retainModel]);
  useEffect(() => {
    const model = modelRef.current;
    if (!model || model.getValue(monaco.editor.EndOfLinePreference.LF) === content) {
      return;
    }
    applyingContentRef.current = true;
    model.setValue(content);
    applyingContentRef.current = false;
  }, [content]);
  useEffect(() => {
    monaco.editor.setTheme(editorThemeFor(dark, editorRef.current?.getContainerDomNode()));
    editorRef.current?.updateOptions({ readOnly });
  }, [dark, readOnly, themeRevision]);
  useEffect(() => {
    editorRef.current?.updateOptions({ ariaLabel: translate("files.workspaceEditor", { value1: path }) });
  }, [locale, path]);
  useEffect(() => {
    const editor2 = editorRef.current;
    if (!editor2 || !focusLine || focusLine < 1) {
      return;
    }
    const lineNumber = Math.min(focusLine, modelRef.current?.getLineCount() ?? focusLine);
    editor2.setPosition({ lineNumber, column: 1 });
    editor2.revealLineInCenter(lineNumber);
  }, [focusLine, path]);
  return /* @__PURE__ */ jsx(
    "div",
    {
      ref: hostRef,
      className: "thread-graph-monaco-editor h-full min-h-0 w-full",
      "data-testid": "workspace-monaco-editor"
    }
  );
}

export {
  editorThemeFor,
  monacoLanguage,
  GraphWorkspaceMonacoEditor
};
