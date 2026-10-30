import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn
} from "./chunk-R24MQJGW.js";
import {
  translate
} from "./chunk-S2ZDXRUN.js";

// src/components/graph-workspace/GraphMoleculeViewer.tsx
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  PanelRightOpen,
  Ruler,
  Waypoints,
  RotateCcw as RotateCcw2,
  HelpCircle,
  Download as Download2,
  Pin,
  X as X2,
  Undo2,
  Redo2
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect as useLayoutEffect2,
  useMemo,
  useRef as useRef2,
  useState as useState2
} from "react";

// src/components/graph-workspace/GraphMoleculeViewerCommands.ts
import {
  validateViewerRequest,
  validateViewerAcknowledgement
} from "@remote-codex/shared";
var VIEWER_COMMAND_BATCH_ACTION = {
  id: "elagente.viewer.command-batch",
  label: "Apply viewer commands",
  execution: "browser",
  completion: "applied",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["version", "commands"],
    properties: {
      version: { type: "integer", minimum: 1, maximum: 1 },
      commands: {
        type: "array",
        maxItems: 128,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type"],
          properties: {
            type: {
              type: "string",
              enum: [
                "selection",
                "camera",
                "annotations",
                "style",
                "unit-cell"
              ]
            },
            selectedIds: {
              type: "array",
              maxItems: 1e4,
              items: { type: "string", maxLength: 160 }
            },
            color: { type: "string", maxLength: 32 },
            radius: { type: "number", minimum: 0, maximum: 1e3 },
            view: {
              type: "array",
              maxItems: 8,
              items: { type: "number", minimum: -1e9, maximum: 1e9 }
            },
            style: {
              type: "string",
              enum: ["ball-stick", "stick", "spacefill", "surface", "cartoon"]
            },
            visible: { type: "boolean" },
            annotations: {
              type: "array",
              maxItems: 256,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "text", "atomId"],
                properties: {
                  id: { type: "string", maxLength: 160 },
                  text: { type: "string", maxLength: 1024 },
                  atomId: { type: "string", maxLength: 160 },
                  color: { type: "string", maxLength: 32 }
                }
              }
            }
          }
        }
      }
    }
  },
  resultSchema: {
    type: "object",
    additionalProperties: false,
    required: ["commandCount", "durationMs"],
    properties: {
      commandCount: { type: "integer", minimum: 0, maximum: 128 },
      durationMs: { type: "integer", minimum: 0 }
    }
  }
};
function sameScientificTarget(a, b) {
  return Boolean(
    a && b && [
      "artifactId",
      "objectId",
      "sourceRevision",
      "checksum",
      "streamId",
      "frameId",
      "frameIndex"
    ].every(
      (key) => a[key] === b[key]
    )
  );
}
function validateViewerCommands(value, atomIds, styles) {
  if (!Array.isArray(value) || value.length > 128)
    throw new Error("Command batch must contain at most 128 commands");
  const ids = new Set(atomIds);
  const validColor = (value2) => typeof value2 === "string" && (/^#[0-9a-fA-F]{6}$/.test(value2) || [
    "black",
    "white",
    "red",
    "green",
    "blue",
    "yellow",
    "orange",
    "purple",
    "cyan",
    "magenta",
    "gray",
    "grey"
  ].includes(value2));
  return value.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new Error("Invalid viewer command");
    const cmd = raw;
    const keys = {
      selection: ["type", "selectedIds", "color", "radius"],
      style: ["type", "style"],
      camera: ["type", "view"],
      annotations: ["type", "annotations"],
      "unit-cell": ["type", "visible"]
    };
    if (typeof cmd.type !== "string" || !keys[cmd.type] || Object.keys(cmd).some((key) => !keys[cmd.type].includes(key)))
      throw new Error("Unsupported viewer command");
    switch (cmd.type) {
      case "selection":
        if (!Array.isArray(cmd.selectedIds) || cmd.selectedIds.length > 1e4 || cmd.selectedIds.some(
          (id) => typeof id !== "string" || !ids.has(id)
        ) || new Set(cmd.selectedIds).size !== cmd.selectedIds.length)
          throw new Error("Selection refers to invalid atoms");
        if (cmd.color !== void 0 && !validColor(cmd.color) || cmd.radius !== void 0 && (typeof cmd.radius !== "number" || !Number.isFinite(cmd.radius) || cmd.radius <= 0 || cmd.radius > 1e3))
          throw new Error("Invalid selection color or radius");
        break;
      case "style":
        if (!styles.includes(cmd.style))
          throw new Error("Unsupported representation");
        break;
      case "camera":
        if (!Array.isArray(cmd.view) || cmd.view.length !== 8 || cmd.view.some(
          (v) => typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 1e9
        ) || cmd.view.slice(4).every((value2) => value2 === 0))
          throw new Error("Invalid camera");
        break;
      case "unit-cell":
        if (typeof cmd.visible !== "boolean")
          throw new Error("Invalid cell visibility");
        break;
      case "annotations":
        if (!Array.isArray(cmd.annotations) || cmd.annotations.length > 256 || cmd.annotations.some(
          (a) => !a || typeof a !== "object" || Object.keys(a).some(
            (k) => !["id", "text", "atomId", "color"].includes(k)
          ) || typeof a.id !== "string" || !a.id || a.id.length > 160 || typeof a.text !== "string" || a.text.length > 1024 || a.color !== void 0 && !validColor(a.color) || !ids.has(a.atomId)
        ) || new Set(cmd.annotations.map((a) => a.id)).size !== cmd.annotations.length)
          throw new Error("Invalid annotations");
        break;
    }
    return structuredClone(cmd);
  });
}
function createViewerCommandExecutor(getState, apply) {
  const history = /* @__PURE__ */ new Map();
  let applying = false;
  return async (request) => {
    request = structuredClone(request);
    const state = getState();
    const reject = (code, message) => ({
      version: 1,
      requestId: request.requestId,
      operationId: request.operationId,
      actionId: request.actionId,
      target: request.target,
      status: "rejected",
      error: { code, message }
    });
    if (!sameScientificTarget(state.target, request.target))
      return reject(
        "STALE_TARGET",
        "The source revision or inspected frame has changed."
      );
    if (!state.ready)
      return reject("VIEWER_UNAVAILABLE", "The target is not rendered.");
    if (!state.discovery)
      return reject(
        "UNSUPPORTED_CAPABILITY",
        "Viewer actions are not advertised."
      );
    const identity = JSON.stringify(request);
    const previous = history.get(request.operationId);
    if (previous)
      return previous.request === identity ? structuredClone(await previous.acknowledgement) : reject(
        "OPERATION_CONFLICT",
        "Operation identity was reused with different input."
      );
    let commands, acknowledgement;
    try {
      validateViewerRequest(request, state.discovery);
      if (state.discovery.actions.find((action) => action.id === request.actionId)?.execution !== "browser")
        return reject(
          "UNSUPPORTED_CAPABILITY",
          "Native actions must be submitted to the host."
        );
      const payload = request.payload;
      if (request.actionId === VIEWER_COMMAND_BATCH_ACTION.id && payload.version !== 1)
        throw new Error("Unsupported viewer command batch version");
      commands = validateViewerCommands(
        request.actionId === "elagente.viewer.style" ? [{ type: "style", style: payload.style }] : payload.commands,
        state.atomIds,
        state.styles
      );
      if (commands.some(
        (command) => command.type === "unit-cell" && command.visible
      ) && state.cellAvailable === false)
        return reject(
          "UNSUPPORTED_CAPABILITY",
          "This structure has no unit cell."
        );
      acknowledgement = {
        version: 1,
        requestId: request.requestId,
        operationId: request.operationId,
        actionId: request.actionId,
        target: structuredClone(request.target),
        status: "applied",
        result: request.actionId === VIEWER_COMMAND_BATCH_ACTION.id ? { commandCount: commands.length, durationMs: 0 } : {}
      };
      validateViewerAcknowledgement(acknowledgement, request, state.discovery);
    } catch (error) {
      return reject(
        "INVALID_VIEWER_ACTION",
        error instanceof Error ? error.message : String(error)
      );
    }
    if (applying)
      return reject(
        "VIEWER_BUSY",
        "Another viewer command is still rendering."
      );
    if (history.size >= 128)
      return reject(
        "VIEWER_QUOTA_EXCEEDED",
        "This viewer has reached its command operation quota."
      );
    applying = true;
    const completion = Promise.resolve().then(async () => {
      const startedAt = performance.now();
      try {
        if (!sameScientificTarget(getState().target, request.target) || !getState().ready)
          return reject(
            "STALE_TARGET",
            "The inspected target changed before rendering."
          );
        await apply(commands);
        if (!sameScientificTarget(getState().target, request.target) || !getState().ready)
          return reject(
            "STALE_TARGET",
            "The inspected target changed during rendering."
          );
        if (request.actionId === VIEWER_COMMAND_BATCH_ACTION.id)
          acknowledgement.result = {
            commandCount: commands.length,
            durationMs: Math.max(0, Math.round(performance.now() - startedAt))
          };
        validateViewerAcknowledgement(
          acknowledgement,
          request,
          state.discovery
        );
        return acknowledgement;
      } catch (error) {
        return reject(
          "VIEWER_RENDER_FAILED",
          error instanceof Error ? error.message : String(error)
        );
      } finally {
        applying = false;
      }
    });
    history.set(request.operationId, {
      request: identity,
      acknowledgement: completion
    });
    return structuredClone(await completion);
  };
}

// src/components/graph-workspace/GraphMoleculeViewerLowerButtonGroup.tsx
import {
  ArrowUpRight,
  Box,
  Boxes,
  Eraser,
  Send,
  Trash2
} from "lucide-react";

// src/components/graph-ui/ButtonGroup.tsx
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

// src/components/graph-ui/Separator.tsx
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { jsx } from "react/jsx-runtime";
function Separator({
  className,
  decorative = true,
  orientation = "horizontal",
  ...props
}) {
  return /* @__PURE__ */ jsx(
    SeparatorPrimitive.Root,
    {
      "data-slot": "separator",
      decorative,
      orientation,
      className: cn(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className
      ),
      ...props
    }
  );
}

// src/components/graph-ui/ButtonGroup.tsx
import { jsx as jsx2 } from "react/jsx-runtime";
var buttonGroupVariants = cva(
  "flex w-fit items-stretch has-[>[data-slot=button-group]]:gap-2 [&>*]:focus-visible:relative [&>*]:focus-visible:z-10 [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md",
  {
    variants: {
      orientation: {
        horizontal: "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none",
        vertical: "flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none"
      }
    },
    defaultVariants: {
      orientation: "horizontal"
    }
  }
);
function ButtonGroup({
  className,
  orientation,
  ...props
}) {
  return /* @__PURE__ */ jsx2(
    "div",
    {
      role: "group",
      "data-slot": "button-group",
      "data-orientation": orientation,
      className: cn(buttonGroupVariants({ orientation }), className),
      ...props
    }
  );
}
function ButtonGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}) {
  return /* @__PURE__ */ jsx2(
    Separator,
    {
      "data-slot": "button-group-separator",
      orientation,
      className: cn(
        "relative !m-0 self-stretch bg-input data-[orientation=vertical]:h-auto",
        className
      ),
      ...props
    }
  );
}

// src/components/graph-workspace/GraphMoleculeViewerControls.tsx
import { jsx as jsx3, jsxs } from "react/jsx-runtime";
function moleculeSlug(value) {
  const normalized = value?.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "molecule";
}
function downloadTextFile(content, filename) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
function GraphMoleculeIconButton({
  children,
  disabled,
  label,
  onClick
}) {
  return /* @__PURE__ */ jsxs(Tooltip, { children: [
    /* @__PURE__ */ jsx3(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx3(
      Button,
      {
        type: "button",
        variant: "outline",
        size: "icon",
        className: "thread-graph-molecule-button size-8",
        disabled,
        onClick,
        title: label,
        "aria-label": label,
        children
      }
    ) }),
    /* @__PURE__ */ jsx3(TooltipContent, { children: /* @__PURE__ */ jsx3("p", { children: label }) })
  ] });
}
function GraphMoleculeButtonGroup({
  children,
  className = ""
}) {
  return /* @__PURE__ */ jsx3(ButtonGroup, { className: `thread-graph-molecule-button-group ${className}`, children });
}

// src/components/graph-workspace/GraphMoleculeViewerLowerButtonGroup.tsx
import { Fragment, jsx as jsx4, jsxs as jsxs2 } from "react/jsx-runtime";
function GraphMoleculeViewerLowerButtonGroup({
  cameraInfo,
  canSubmit = false,
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
  unitCellVisible
}) {
  const hasSelection = selectedSerials.length > 0;
  const hasStaged = stagedAtoms > 0;
  return /* @__PURE__ */ jsxs2(Fragment, { children: [
    /* @__PURE__ */ jsx4("div", { className: "thread-graph-molecule-lower-toolbar flex w-full shrink-0 flex-wrap justify-between gap-2", children: /* @__PURE__ */ jsxs2(GraphMoleculeButtonGroup, { children: [
      /* @__PURE__ */ jsx4(
        GraphMoleculeIconButton,
        {
          label: unitCellVisible ? "Hide unit cell" : "Show unit cell",
          disabled: !unitCellAvailable,
          onClick: onToggleUnitCell,
          children: /* @__PURE__ */ jsx4(Boxes, { className: "size-4" })
        }
      ),
      /* @__PURE__ */ jsx4(
        GraphMoleculeIconButton,
        {
          label: "Clear selection",
          disabled: !hasSelection,
          onClick: onClearSelection,
          children: /* @__PURE__ */ jsx4(Trash2, { className: "size-4" })
        }
      ),
      /* @__PURE__ */ jsx4(
        GraphMoleculeIconButton,
        {
          label: "Send selection",
          disabled: !hasSelection || !canSubmit,
          onClick: onSendSelection,
          children: /* @__PURE__ */ jsx4(Send, { className: "size-4" })
        }
      ),
      /* @__PURE__ */ jsx4(
        GraphMoleculeIconButton,
        {
          label: "Stage current selection",
          disabled: !hasSelection,
          onClick: onStageSelection,
          children: /* @__PURE__ */ jsx4(Box, { className: "size-4" })
        }
      ),
      /* @__PURE__ */ jsx4(
        GraphMoleculeIconButton,
        {
          label: "Clear staged selections",
          disabled: !hasStaged,
          onClick: onClearStaged,
          children: /* @__PURE__ */ jsx4(Eraser, { className: "size-4" })
        }
      ),
      /* @__PURE__ */ jsx4(
        GraphMoleculeIconButton,
        {
          label: "Send staged selections",
          disabled: !hasStaged || !canSubmit,
          onClick: onSendStaged,
          children: /* @__PURE__ */ jsx4(ArrowUpRight, { className: "size-4" })
        }
      )
    ] }) }),
    cameraInfo ? /* @__PURE__ */ jsxs2("div", { className: "thread-graph-molecule-camera", children: [
      /* @__PURE__ */ jsxs2("div", { children: [
        /* @__PURE__ */ jsx4("strong", { children: "XYZ: " }),
        "x=",
        cameraInfo.position.x.toFixed(1),
        " y=",
        cameraInfo.position.y.toFixed(1),
        " z=",
        cameraInfo.position.z.toFixed(1),
        /* @__PURE__ */ jsx4("br", {}),
        /* @__PURE__ */ jsx4("strong", { children: "Quat: " }),
        "qx=",
        cameraInfo.position.qx.toFixed(2),
        " qy=",
        cameraInfo.position.qy.toFixed(2),
        " qz=",
        cameraInfo.position.qz.toFixed(2),
        " qw=",
        cameraInfo.position.qw.toFixed(2)
      ] }),
      /* @__PURE__ */ jsx4("div", { className: "thread-graph-molecule-camera-divider" }),
      /* @__PURE__ */ jsxs2("div", { className: "flex flex-col gap-1 text-[10px]", children: [
        /* @__PURE__ */ jsxs2("div", { children: [
          "Selected atoms:",
          " ",
          selectedSerials.length > 0 ? selectedSerials.map(
            (serial) => `${selectedAtomLabels[serial] ?? "Atom"}(${serial})`
          ).join(", ") : "None"
        ] }),
        /* @__PURE__ */ jsxs2("div", { children: [
          "Staged: ",
          stagedMolecules,
          " molecule(s), ",
          stagedAtoms,
          " atom(s)"
        ] })
      ] })
    ] }) : null
  ] });
}

// src/components/graph-workspace/GraphMoleculeViewerUpperButtonGroup.tsx
import {
  Box as Box2,
  Camera,
  Copy,
  Download,
  RotateCcw,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { useState } from "react";
import { Fragment as Fragment2, jsx as jsx5, jsxs as jsxs3 } from "react/jsx-runtime";
function GraphMoleculeViewerUpperButtonGroup({
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
  xyzFormat
}) {
  const [inspect, setInspect] = useState(false);
  const slug = moleculeSlug(moleculeId);
  async function handleCopyXYZ() {
    if (!xyzContent) {
      return;
    }
    try {
      await navigator.clipboard.writeText(xyzContent);
      onFeedback?.("Coordinates copied.");
    } catch (error) {
      onFeedback?.(String(error));
    }
  }
  function handleDownloadXYZ() {
    if (!xyzContent) {
      return;
    }
    downloadTextFile(
      xyzContent,
      `${slug}_step_${currentIndex + 1}.${xyzFormat || "xyz"}`
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
    downloadTextFile(exportContent, `${slug}_trajectory.${xyzFormat || "xyz"}`);
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
      (hasUnitCell ? 0.5 : 0.85) * (host?.clientHeight ? Math.min(1, host.clientWidth / host.clientHeight) : 1)
    );
    viewerRef.current.setCameraParameters({});
    viewerRef.current.render();
  }
  return /* @__PURE__ */ jsxs3(Fragment2, { children: [
    inspect && /* @__PURE__ */ jsxs3("div", { role: "dialog", "aria-label": "Structure coordinates", children: [
      /* @__PURE__ */ jsxs3("p", { children: [
        xyzFormat,
        ", frame ",
        currentIndex + 1
      ] }),
      /* @__PURE__ */ jsx5(
        "textarea",
        {
          readOnly: true,
          "aria-label": "Immutable coordinates",
          value: xyzContent ?? ""
        }
      ),
      /* @__PURE__ */ jsx5("button", { onClick: () => setInspect(false), children: "Close coordinates" })
    ] }),
    /* @__PURE__ */ jsxs3(GraphMoleculeButtonGroup, { className: "ml-auto justify-end", children: [
      /* @__PURE__ */ jsx5(
        GraphMoleculeIconButton,
        {
          label: "Inspect coordinates",
          onClick: () => setInspect(true),
          children: /* @__PURE__ */ jsx5(Copy, { className: "size-3.5" })
        }
      ),
      /* @__PURE__ */ jsx5(
        GraphMoleculeIconButton,
        {
          label: "Copy current structure",
          onClick: () => void handleCopyXYZ(),
          disabled: !xyzContent,
          children: /* @__PURE__ */ jsx5(Copy, { className: "size-3.5" })
        }
      ),
      /* @__PURE__ */ jsx5(
        GraphMoleculeIconButton,
        {
          label: "Download current structure",
          onClick: handleDownloadXYZ,
          disabled: !xyzContent,
          children: /* @__PURE__ */ jsx5(Download, { className: "size-3.5" })
        }
      ),
      /* @__PURE__ */ jsx5(
        GraphMoleculeIconButton,
        {
          label: "Download full trajectory",
          onClick: handleDownloadAllXYZ,
          disabled: !exportContent,
          children: /* @__PURE__ */ jsx5(Box2, { className: "size-3.5" })
        }
      ),
      /* @__PURE__ */ jsx5(
        GraphMoleculeIconButton,
        {
          label: "Copy screenshot",
          onClick: onScreenshot,
          disabled: !viewerRef.current || !xyzContent,
          children: /* @__PURE__ */ jsx5(Camera, { className: "size-3.5" })
        }
      ),
      /* @__PURE__ */ jsx5(ButtonGroupSeparator, { className: "thread-graph-molecule-button-divider" }),
      /* @__PURE__ */ jsx5(
        GraphMoleculeIconButton,
        {
          label: "Zoom in",
          onClick: handleZoomIn,
          disabled: !viewerRef.current || !xyzContent,
          children: /* @__PURE__ */ jsx5(ZoomIn, { className: "size-3.5" })
        }
      ),
      /* @__PURE__ */ jsx5(
        GraphMoleculeIconButton,
        {
          label: "Zoom out",
          onClick: handleZoomOut,
          disabled: !viewerRef.current || !xyzContent,
          children: /* @__PURE__ */ jsx5(ZoomOut, { className: "size-3.5" })
        }
      ),
      /* @__PURE__ */ jsx5(
        GraphMoleculeIconButton,
        {
          label: "Reset camera",
          onClick: handleReset,
          disabled: !viewerRef.current || !xyzContent,
          children: /* @__PURE__ */ jsx5(RotateCcw, { className: "size-3.5" })
        }
      )
    ] })
  ] });
}

// src/components/graph-workspace/GraphMoleculeFigureFrame.tsx
import { Maximize2, X } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { jsx as jsx6, jsxs as jsxs4 } from "react/jsx-runtime";
function GraphMoleculeFigureFrame({
  expanded,
  onExpandedChange,
  onEscape,
  title,
  children,
  presentation,
  className = ""
}) {
  const dialog = useRef(null);
  const opener = useRef(null);
  const placeholder = useRef(null);
  const returnFocus = useRef(null);
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (expanded && !element.open) {
      const bounds = element.getBoundingClientRect();
      returnFocus.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : opener.current;
      if (placeholder.current)
        placeholder.current.style.height = `${bounds.height}px`;
      element.showModal();
      element.querySelector(".thread-graph-molecule-viewer")?.focus({ preventScroll: true });
      const fullBounds = element.getBoundingClientRect();
      if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        const transform = `translate(${bounds.left + bounds.width / 2 - fullBounds.left - fullBounds.width / 2}px, ${bounds.top + bounds.height / 2 - fullBounds.top - fullBounds.height / 2}px) scale(${bounds.width / fullBounds.width || 0.97},${bounds.height / fullBounds.height || 0.97})`;
        element.animate?.(
          [
            { opacity: 0, transform },
            { opacity: 1, transform: "none" }
          ],
          { duration: 300, easing: "cubic-bezier(.22,1,.36,1)" }
        );
      }
    } else if (!expanded && element.open) {
      element.close();
      (returnFocus.current?.isConnected ? returnFocus.current : opener.current)?.focus({ preventScroll: true });
      if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
        element.animate?.(
          [
            { opacity: 0.4, transform: "scale(.99)" },
            { opacity: 1, transform: "none" }
          ],
          { duration: 240, easing: "cubic-bezier(.4,0,.2,1)" }
        );
    }
  }, [expanded]);
  return /* @__PURE__ */ jsxs4(
    "div",
    {
      className: `molecule-figure-frame is-${presentation} ${expanded ? "is-expanded" : ""}`,
      children: [
        /* @__PURE__ */ jsx6(
          "div",
          {
            ref: placeholder,
            className: "molecule-figure-placeholder",
            "aria-hidden": "true"
          }
        ),
        /* @__PURE__ */ jsxs4(
          "dialog",
          {
            ref: dialog,
            className: `molecule-figure ${className}`,
            role: expanded ? "dialog" : "region",
            "aria-modal": expanded || void 0,
            "aria-label": `${title}${expanded ? ", full view" : ", structure preview"}`,
            onCancel: (event) => {
              event.preventDefault();
              onEscape();
            },
            onClick: (event) => {
              if (event.target === event.currentTarget && expanded) {
                const b = event.currentTarget.getBoundingClientRect();
                if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom)
                  onExpandedChange(false);
              }
            },
            children: [
              /* @__PURE__ */ jsx6(
                "button",
                {
                  ref: opener,
                  type: "button",
                  className: "molecule-expand",
                  "aria-label": expanded ? "Close full view" : "Open full view",
                  title: expanded ? "Close full view (Esc)" : "Open full view",
                  onClick: () => onExpandedChange(!expanded),
                  children: expanded ? /* @__PURE__ */ jsx6(X, { size: 16 }) : /* @__PURE__ */ jsx6(Maximize2, { size: 16 })
                }
              ),
              children
            ]
          }
        )
      ]
    }
  );
}

// src/components/graph-workspace/GraphMoleculeViewerLifetime.ts
function createMoleculeRenderViewer(api, host) {
  const registrations = [];
  const restores = [window, document.body].map((target) => {
    const original = target.addEventListener;
    target.addEventListener = function(type, listener, options) {
      if (listener)
        registrations.push({ target: this, type, listener, options });
      original.call(this, type, listener, options);
    };
    return () => {
      target.addEventListener = original;
    };
  });
  const releaseListeners = () => registrations.forEach(
    ({ target, type, listener, options }) => target.removeEventListener(type, listener, options)
  );
  let viewer;
  try {
    viewer = api.createViewer(host, {});
  } catch (error) {
    releaseListeners();
    throw error;
  } finally {
    restores.forEach((restore) => restore());
  }
  return {
    viewer,
    release() {
      releaseListeners();
      viewer.spin?.(false);
      viewer.stopAnimate?.();
      const observed = viewer;
      observed.divwatcher?.disconnect();
      observed.intwatcher?.disconnect();
      viewer.clear?.();
      host.querySelectorAll("canvas").forEach((canvas) => {
        canvas.addEventListener(
          "webglcontextlost",
          (event) => event.stopImmediatePropagation(),
          { capture: true, once: true }
        );
        const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
        context?.getExtension?.("WEBGL_lose_context")?.loseContext();
        canvas.remove();
      });
    }
  };
}

// src/components/graph-workspace/moleculePinchZoom.ts
var PINCH_ZOOM_RATE = 0.01;
var PINCH_MAX_STEP = 1.1;
var LINE_PIXELS = 16;
var PAGE_PIXELS = 400;
var clampStep = (factor) => Math.min(PINCH_MAX_STEP, Math.max(1 / PINCH_MAX_STEP, factor));
function pinchZoomFactor(event) {
  const unit = event.deltaMode === 1 ? LINE_PIXELS : event.deltaMode === 2 ? PAGE_PIXELS : 1;
  const pixels = event.deltaY * unit;
  if (!Number.isFinite(pixels) || pixels === 0) return 1;
  return clampStep(Math.exp(-pixels * PINCH_ZOOM_RATE));
}
function bindPinchZoom(host, zoom) {
  let gestureScale = null;
  let touches = 0;
  const track = (event) => {
    touches = event.touches?.length ?? 0;
  };
  const reset = () => {
    touches = 0;
  };
  const resetWhenHidden = () => {
    if (document.visibilityState === "hidden") reset();
  };
  const apply = (factor) => {
    if (factor !== 1) zoom(factor);
  };
  const wheel = (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    event.stopPropagation();
    if (gestureScale === null) apply(pinchZoomFactor(event));
  };
  const gestureStart = (event) => {
    event.preventDefault();
    gestureScale = 1;
  };
  const gestureChange = (event) => {
    event.preventDefault();
    const scale = event.scale;
    if (gestureScale === null || typeof scale !== "number" || !(scale > 0)) return;
    if (!touches) apply(clampStep(scale / gestureScale));
    gestureScale = scale;
  };
  const gestureEnd = (event) => {
    event.preventDefault();
    gestureScale = null;
  };
  const options = { capture: true, passive: false };
  host.addEventListener("wheel", wheel, options);
  host.addEventListener("gesturestart", gestureStart, options);
  host.addEventListener("gesturechange", gestureChange, options);
  host.addEventListener("gestureend", gestureEnd, options);
  for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"])
    host.addEventListener(type, track, { capture: true, passive: true });
  host.addEventListener("pointercancel", reset, { capture: true });
  window.addEventListener("blur", reset);
  document.addEventListener("visibilitychange", resetWhenHidden);
  return () => {
    for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"])
      host.removeEventListener(type, track, { capture: true });
    host.removeEventListener("pointercancel", reset, { capture: true });
    window.removeEventListener("blur", reset);
    document.removeEventListener("visibilitychange", resetWhenHidden);
    host.removeEventListener("wheel", wheel, options);
    host.removeEventListener("gesturestart", gestureStart, options);
    host.removeEventListener("gesturechange", gestureChange, options);
    host.removeEventListener("gestureend", gestureEnd, options);
  };
}

// src/components/graph-workspace/GraphMoleculeMeasurements.ts
function measureAtoms(atoms) {
  if (atoms.length === 2)
    return `${Math.hypot(atoms[0].x - atoms[1].x, atoms[0].y - atoms[1].y, atoms[0].z - atoms[1].z).toFixed(3)} \xC5`;
  if (atoms.length !== 3) return null;
  const [a, b, c] = atoms;
  const u = [a.x - b.x, a.y - b.y, a.z - b.z], v = [c.x - b.x, c.y - b.y, c.z - b.z];
  const norm = Math.hypot(...u) * Math.hypot(...v);
  if (!norm) return null;
  return `${(Math.acos(Math.max(-1, Math.min(1, u.reduce((n, x, i) => n + x * v[i], 0) / norm))) * 180 / Math.PI).toFixed(1)}\xB0`;
}
function moleculeFormula(atoms) {
  const counts = /* @__PURE__ */ new Map();
  for (const atom of atoms)
    if (atom.elem) counts.set(atom.elem, (counts.get(atom.elem) ?? 0) + 1);
  const order = [...counts.keys()].sort();
  if (counts.has("C")) {
    order.splice(order.indexOf("C"), 1);
    if (counts.has("H")) order.splice(order.indexOf("H"), 1);
    order.unshift(...counts.has("H") ? ["C", "H"] : ["C"]);
  }
  return order.map((element) => ({ element, count: counts.get(element) }));
}

// src/components/graph-workspace/load3Dmol.ts
var threeDmolPromise = null;
async function load3Dmol() {
  if (typeof window === "undefined") {
    throw new Error(translate("files.3DmolIsOnlyAvailableInABrowser"));
  }
  if (window["3Dmol"]) {
    return window["3Dmol"];
  }
  if (!threeDmolPromise) {
    threeDmolPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(
        'script[data-pockymoe-3dmol="true"]'
      );
      const handleLoad = () => {
        if (window["3Dmol"]) {
          resolve(window["3Dmol"]);
          return;
        }
        reject(new Error(translate("files.3DmolLoadedWithoutExposingTheExpectedGlobal")));
      };
      if (existingScript) {
        existingScript.addEventListener("load", handleLoad, { once: true });
        existingScript.addEventListener(
          "error",
          () => reject(new Error(translate("files.unableToLoad3DmolViewerRuntime"))),
          { once: true }
        );
        return;
      }
      const script = document.createElement("script");
      script.src = "/vendor/3Dmol-min.js";
      script.async = true;
      script.dataset.pockymoe3dmol = "true";
      script.addEventListener("load", handleLoad, { once: true });
      script.addEventListener(
        "error",
        () => reject(new Error(translate("files.unableToLoad3DmolViewerRuntime"))),
        { once: true }
      );
      document.head.appendChild(script);
    });
  }
  return threeDmolPromise;
}

// src/components/graph-workspace/GraphMoleculeViewerData.ts
function splitXyzTrajectory(content) {
  const lines = content.match(/[^\r\n]*(?:\r\n|\r|\n|$)/g)?.filter(Boolean) ?? [];
  const frames = [];
  let cursor = 0;
  while (cursor < lines.length) {
    while (cursor < lines.length && !lines[cursor]?.trim()) cursor++;
    if (cursor === lines.length) break;
    if (!/^\d+$/.test(lines[cursor]?.trim() ?? ""))
      throw new Error("Invalid XYZ atom count");
    const count = Number(lines[cursor]?.trim());
    if (cursor + count + 2 > lines.length)
      throw new Error("Incomplete XYZ frame");
    frames.push(lines.slice(cursor, cursor + count + 2).join(""));
    cursor += count + 2;
  }
  return frames;
}
function readGraphMoleculeViewerData(source) {
  if (!source) return { format: "xyz", frames: [], exportContent: "" };
  const format = typeof source === "string" ? "xyz" : source.format?.trim().toLowerCase() || "xyz";
  if (!["xyz", "extxyz", "cif", "pdb", "sdf", "mol"].includes(format))
    throw new Error(`Unsupported structure format: ${format}`);
  const content = typeof source === "string" ? [source] : source.content;
  const xyz = format === "xyz" || format === "extxyz";
  if (xyz && typeof source !== "string" && source.framesSplit)
    return { frames: content, format, exportContent: content.join("") };
  const frames = xyz ? content.flatMap(splitXyzTrajectory) : format === "sdf" ? content.flatMap(
    (text) => text.match(/[\s\S]*?\$\$\$\$(?:\r\n|\n|\r|$)|[\s\S]+$/g)?.filter((text2) => text2.trim()) ?? []
  ) : content.filter((text) => text.trim());
  return { frames, format, exportContent: content.join("") };
}
function frameTarget(snapshot, index, frameCount) {
  if (snapshot?.frameTargets) return snapshot.frameTargets[index];
  const target = snapshot?.target;
  if (!target) return void 0;
  if (frameCount <= 1) return target;
  if (target.frameIndex === index && target.frameId) return target;
  return void 0;
}
function frameCell(metadata, index) {
  if (!metadata?.frameCells) return metadata?.cell;
  const cell = metadata.frameCells[index];
  if (cell === void 0)
    throw new Error(`Frame cell metadata has no entry for frame ${index}`);
  return cell;
}
function readExtXyzCell(content) {
  const comment = content.split(/\r\n|\r|\n/)[1] ?? "";
  const lattice = /\bLattice="([^"]+)"/i.exec(comment)?.[1]?.trim().split(/\s+/).map(Number);
  if (!lattice) return void 0;
  if (lattice.length !== 9 || lattice.some((value) => !Number.isFinite(value)))
    throw new Error("Invalid extXYZ Lattice");
  const pbc = /\bpbc="([^"]+)"/i.exec(comment)?.[1]?.trim().split(/\s+/);
  if (pbc && (pbc.length !== 3 || pbc.some((value) => !/^(T|F|true|false|1|0)$/i.test(value))))
    throw new Error("Invalid extXYZ pbc");
  return {
    vectors: [
      lattice.slice(0, 3),
      lattice.slice(3, 6),
      lattice.slice(6, 9)
    ],
    periodic: pbc?.map((value) => /^(T|true|1)$/i.test(value)) ?? [
      true,
      true,
      true
    ],
    unit: "angstrom"
  };
}
function applyStructureMetadata(model, metadata) {
  const atoms = model.selectedAtoms({});
  if (!atoms.length || atoms.some((atom) => ![atom.x, atom.y, atom.z].every(Number.isFinite)))
    throw new Error("Structure has no valid atomic coordinates");
  if (metadata?.atoms?.some((atom, index) => atom.element !== atoms[index]?.elem))
    throw new Error("Atom metadata elements differ from the rendered model");
  if (metadata?.atoms && metadata.atoms.length !== atoms.length)
    throw new Error("Atom metadata count differs from the rendered model");
  const ids = atoms.map(
    (_atom, index) => metadata?.atoms?.[index]?.id ?? String(index)
  );
  if (new Set(ids).size !== ids.length)
    throw new Error("Duplicate atom identity");
  atoms.forEach((atom, index) => {
    atom.index = index;
  });
  const bonding = metadata?.render?.bonding;
  if (bonding === "provided" && !metadata?.bonds)
    throw new Error("Provided bonding requires bond metadata");
  const indexById = new Map(ids.map((id, index) => [id, index]));
  if (metadata?.bonds || bonding === "none") {
    atoms.forEach((atom) => {
      atom.bonds = [];
      atom.bondOrder = [];
    });
    if (bonding !== "none")
      metadata?.bonds?.forEach((bond) => {
        const a = indexById.get(bond.atomIds[0]), b = indexById.get(bond.atomIds[1]);
        if (a === void 0 || b === void 0 || a === b)
          throw new Error("Bond metadata refers to unknown atoms");
        atoms[a].bonds.push(b);
        atoms[a].bondOrder.push(bond.order);
        atoms[b].bonds.push(a);
        atoms[b].bondOrder.push(bond.order);
      });
  }
  if (metadata?.render?.coordinateUnit === "bohr")
    atoms.forEach((atom) => {
      atom.x *= 0.529177210903;
      atom.y *= 0.529177210903;
      atom.z *= 0.529177210903;
    });
  return ids;
}
function structureRenderFrame(content, format) {
  if (format !== "extxyz")
    return { content, format: format === "mol" ? "sdf" : format };
  const lines = content.split(/\r\n|\r|\n/);
  const properties = /\bProperties=(?:"([^"]+)"|([^\s]+))/.exec(lines[1] ?? "");
  if (!properties) return { content, format: "xyz" };
  const fields = (properties[1] ?? properties[2]).split(":");
  if (fields.length % 3) throw new Error("Invalid extXYZ Properties");
  let offset = 0, species = -1, position = -1;
  for (let index = 0; index < fields.length; index += 3) {
    const count2 = Number(fields[index + 2]);
    if (!Number.isInteger(count2) || count2 <= 0 || count2 > 1e4)
      throw new Error("Invalid extXYZ property width");
    if (fields[index] === "species" && fields[index + 1] === "S" && count2 === 1)
      species = offset;
    if (fields[index] === "pos" && fields[index + 1] === "R" && count2 === 3)
      position = offset;
    offset += count2;
  }
  if (species < 0 || position < 0)
    throw new Error("extXYZ requires species and pos properties");
  const count = Number(lines[0]?.trim());
  const atoms = lines.slice(2, count + 2).map((line) => {
    const values = line.trim().split(/\s+/);
    if (values.length < offset || !/^[A-Z][a-z]?$/.test(values[species]))
      throw new Error("Invalid extXYZ atom properties");
    const coords = values.slice(position, position + 3).map(Number);
    if (coords.some((value) => !Number.isFinite(value)))
      throw new Error("Invalid extXYZ coordinates");
    return `${values[species]} ${coords.join(" ")}`;
  });
  return {
    content: `${count}
${lines[1]}
${atoms.join("\n")}
`,
    format: "xyz"
  };
}

// src/components/graph-workspace/GraphMoleculeViewer.tsx
import { jsx as jsx7, jsxs as jsxs5 } from "react/jsx-runtime";
function GraphMoleculeViewer({
  className = "",
  moleculeId = null,
  onScreenshot,
  onSelectionChange,
  onSelectionSubmit,
  onReady,
  onActive,
  source,
  title = "Molecular structure",
  presentation = "workspace",
  onOpenFile,
  extensionHost,
  toolbar,
  rendererSlot,
  onDownloadSource,
  loading = false,
  followControl = false
}) {
  const viewerHostRef = useRef2(null);
  const viewerRef = useRef2(null);
  const modelRef = useRef2(null);
  const [viewerReady, setViewerReady] = useState2(false);
  const loadingRef = useRef2(loading);
  loadingRef.current = loading;
  const onReadyRef = useRef2(onReady);
  onReadyRef.current = onReady;
  const readyHandleRef = useRef2(null);
  const captureRef = useRef2(() => {
    throw new Error("Screenshot is unavailable");
  });
  const zoomedRef = useRef2(false);
  const unitCellPreferenceRef = useRef2(true);
  const [cameraInfo, setCameraInfo] = useState2(
    null
  );
  const [requestedIndex, setCurrentIndex] = useState2(0);
  const [hoveredAtom, setHoveredAtom] = useState2(null);
  const [isPlaying, setIsPlaying] = useState2(false);
  const [selectedAtomLabels, setSelectedAtomLabels] = useState2({});
  const [selectedSerials, setSelectedSerials] = useState2([]);
  const selectedSerialsRef = useRef2(selectedSerials);
  selectedSerialsRef.current = selectedSerials;
  const selectionStyleRef = useRef2({
    color: "yellow"
  });
  const [stagedSelections, setStagedSelections] = useState2({});
  const [status, setStatus] = useState2(null);
  const [busy, setBusy] = useState2(false);
  const busyRef = useRef2(false);
  const [live, setLive] = useState2(true);
  const [style, setStyle] = useState2(
    typeof source === "object" && source?.metadata?.render?.style || "ball-stick"
  );
  const [cartoonAvailable, setCartoonAvailable] = useState2(false);
  const applyingCommandRef = useRef2(false);
  const [annotations, setAnnotations] = useState2([]);
  const atomIdsRef = useRef2([]);
  const cellRef = useRef2(void 0);
  const renderedTargetRef = useRef2(void 0);
  const [unitCellAvailable, setUnitCellAvailable] = useState2(false);
  const [unitCellVisible, setUnitCellVisible] = useState2(false);
  const [viewerInitError, setViewerInitError] = useState2(null);
  const [expanded, setExpanded] = useState2(false);
  const [hydrogens, setHydrogens] = useState2(true);
  const [atomLabels, setAtomLabels] = useState2(false);
  const [help, setHelp] = useState2(false);
  const [measureTool, setMeasureTool] = useState2(
    null
  );
  const measureToolRef = useRef2(measureTool);
  measureToolRef.current = measureTool;
  const [measurePicks, setMeasurePicks] = useState2([]);
  const picksRef = useRef2(measurePicks);
  picksRef.current = measurePicks;
  const measurePickKeyRef = useRef2("");
  const [measurements, setMeasurements] = useState2({});
  const [measurementHistory, setMeasurementHistory] = useState2([]);
  const [measurementFuture, setMeasurementFuture] = useState2([]);
  const [measurementNotice, setMeasurementNotice] = useState2(false);
  const [measurementsPinned, setMeasurementsPinned] = useState2(false);
  const [focusedMeasurement, setFocusedMeasurement] = useState2(
    null
  );
  const [spin, setSpin] = useState2(0);
  const [dark, setDark] = useState2(false);
  const [reducedMotion, setReducedMotion] = useState2(false);
  const pickMeasurementRef = useRef2(() => {
  });
  const nextMeasurementId = useRef2(0);
  const measurementShapes = useRef2([]);
  const [formula, setFormula] = useState2(
    []
  );
  const [atomCount, setAtomCount] = useState2(0);
  const viewerData = useMemo(
    () => readGraphMoleculeViewerData(source),
    [source]
  );
  const xyzArray = viewerData.frames;
  const xyzFormat = viewerData.format;
  const currentIndex = live ? Math.max(0, xyzArray.length - 1) : Math.min(requestedIndex, Math.max(0, xyzArray.length - 1));
  const xyzContent = xyzArray[currentIndex] ?? null;
  const snapshot = typeof source === "object" && source ? source : void 0;
  const target = frameTarget(snapshot, currentIndex, xyzArray.length);
  const currentFrameRef = useRef2("");
  currentFrameRef.current = `${currentIndex}:${xyzFormat}:${xyzContent}`;
  const renderedFrameRef = useRef2("");
  const renderedModelKeyRef = useRef2(null);
  const surfaceActiveRef = useRef2(false);
  const labelsActiveRef = useRef2(false);
  const decoratedRef = useRef2("");
  const backgroundRef = useRef2(null);
  const styledRef = useRef2("");
  const cellDrawRef = useRef2("");
  const renderedReadyRef = useRef2(false);
  const targetKey = JSON.stringify(target);
  const targetRef = useRef2(target);
  targetRef.current = target;
  const activeObject = snapshot?.target?.objectId ?? snapshot?.uuid ?? moleculeId;
  const frameCells = snapshot?.metadata?.frameCells;
  const cellKey = JSON.stringify(
    frameCells ? frameCells[currentIndex] ?? null : snapshot?.metadata?.cell
  );
  const modelDataKey = useMemo(
    () => JSON.stringify([
      activeObject,
      xyzFormat,
      xyzContent,
      snapshot?.metadata?.atoms,
      snapshot?.metadata?.bonds,
      cellKey,
      snapshot?.metadata?.render
    ]),
    [
      activeObject,
      xyzFormat,
      xyzContent,
      snapshot?.metadata?.atoms,
      snapshot?.metadata?.bonds,
      cellKey,
      snapshot?.metadata?.render
    ]
  );
  const objectRef = useRef2(activeObject);
  const measurementKey = JSON.stringify([
    activeObject,
    target?.sourceRevision ?? snapshot?.target?.sourceRevision,
    currentIndex,
    modelDataKey
  ]);
  const currentMeasurements = measurements[measurementKey] ?? [];
  const selectedIds = selectedSerials.map((index) => atomIdsRef.current[index]).filter(Boolean);
  const supportedStyles = [
    "ball-stick",
    "stick",
    "spacefill",
    "surface",
    ...cartoonAvailable ? ["cartoon"] : []
  ];
  const selection = () => ({
    moleculeId,
    atoms: [...selectedSerials],
    selectedIds: selectedSerials.map((index) => atomIdsRef.current[index]).filter(Boolean),
    ...target ? { target } : {}
  });
  const cellShapesRef = useRef2([]);
  function drawCell(visible) {
    const viewer = viewerRef.current, model = modelRef.current;
    if (!viewer || !model) return;
    const key = JSON.stringify([visible, cellRef.current, dark]);
    if (cellDrawRef.current === key) return;
    cellDrawRef.current = key;
    cellShapesRef.current.forEach((shape) => viewer.removeShape(shape));
    cellShapesRef.current = [];
    try {
      viewer.removeUnitCell(model);
    } catch {
    }
    const cell = cellRef.current;
    if (visible && cell) {
      const factor = cell.unit === "bohr" ? 0.529177210903 : 1;
      const point = (bits) => ({
        x: cell.vectors.reduce(
          (v, row, i) => v + (bits >> i & 1) * row[0] * factor,
          0
        ),
        y: cell.vectors.reduce(
          (v, row, i) => v + (bits >> i & 1) * row[1] * factor,
          0
        ),
        z: cell.vectors.reduce(
          (v, row, i) => v + (bits >> i & 1) * row[2] * factor,
          0
        )
      });
      for (let bits = 0; bits < 8; bits++)
        for (let axis = 0; axis < 3; axis++)
          if (!(bits & 1 << axis))
            cellShapesRef.current.push(
              viewer.addLine({
                start: point(bits),
                end: point(bits | 1 << axis),
                color: dark ? "#a7b0b7" : "#5b6269"
              })
            );
    } else if (visible)
      viewer.addUnitCell(model, {
        box: { color: dark ? "#a7b0b7" : "#5b6269" }
      });
  }
  function applyStyle(next, indices = selectedSerials) {
    const viewer = viewerRef.current, model = modelRef.current;
    if (!viewer || !model) return;
    const key = JSON.stringify([
      next,
      indices,
      selectionStyleRef.current,
      hydrogens,
      dark
    ]);
    if (styledRef.current === key) return;
    styledRef.current = key;
    if (surfaceActiveRef.current) {
      viewer.removeAllSurfaces();
      surfaceActiveRef.current = false;
    }
    const palette = dark ? {
      C: "#8796a4",
      H: "#c5ced5",
      O: "#e89590",
      N: "#8faee0",
      P: "#d4af79",
      S: "#d8c77d",
      F: "#8ec9af",
      Cl: "#8ec9af",
      Br: "#bb9487",
      Pd: "#98b5ca"
    } : {
      C: "#667682",
      H: "#cbd3d9",
      O: "#c96f68",
      N: "#678ec4",
      P: "#b59055",
      S: "#c4ae57",
      F: "#63a688",
      Cl: "#63a688",
      Br: "#9c7669",
      Pd: "#7297b1"
    };
    const colorscheme = { prop: "elem", map: palette };
    model.setStyle(
      {},
      next === "spacefill" ? { sphere: { scale: 1, colorscheme } } : next === "stick" ? { stick: { radius: 0.16, colorscheme } } : next === "cartoon" ? { cartoon: { color: "spectrum" } } : next === "surface" ? {} : {
        stick: { radius: 0.14, colorscheme },
        sphere: { scale: 0.22, colorscheme }
      }
    );
    const surface = next === "surface" ? viewer.addSurface(
      "VDW",
      { opacity: 0.8, colorscheme },
      hydrogens ? {} : { not: { elem: "H" } }
    ) : void 0;
    surfaceActiveRef.current = next === "surface";
    if (indices.length)
      model.setStyle(
        { index: indices },
        {
          stick: { radius: 0.3, color: selectionStyleRef.current.color },
          sphere: {
            ...selectionStyleRef.current.radius ? { radius: selectionStyleRef.current.radius } : { scale: 0.4 },
            color: selectionStyleRef.current.color
          }
        }
      );
    if (!hydrogens) model.setStyle({ elem: "H" }, {});
    return surface;
  }
  function drawAnnotations(next) {
    const viewer = viewerRef.current, model = modelRef.current;
    if (!viewer || !model) return;
    const picks = measurePickKeyRef.current === measurementKey ? measurePicks : [];
    const key = JSON.stringify([
      next,
      atomLabels,
      hydrogens,
      dark,
      currentMeasurements,
      picks,
      focusedMeasurement
    ]);
    if (decoratedRef.current === key) return false;
    decoratedRef.current = key;
    if (labelsActiveRef.current) viewer.removeAllLabels();
    labelsActiveRef.current = next.length > 0 || atomLabels || currentMeasurements.length > 0 || picks.length > 0;
    const atoms = model.selectedAtoms({});
    next.forEach((annotation) => {
      const atom = atoms[atomIdsRef.current.indexOf(annotation.atomId)];
      if (atom)
        viewer.addLabel(
          annotation.text,
          {
            position: atom,
            backgroundColor: dark ? "#1a2026" : "white",
            fontColor: annotation.color ?? (dark ? "#f4f7f6" : "#121416"),
            fontSize: 12
          },
          void 0,
          // Batch label additions into the caller's final render.
          true
        );
    });
    if (atomLabels)
      atoms.forEach((atom, index) => {
        if (!hydrogens && atom.elem === "H") return;
        viewer.addLabel(
          `${atom.elem ?? "Atom"} (${atomIdsRef.current[index]})`,
          {
            position: atom,
            fontSize: 11,
            backgroundColor: dark ? "#1a2026" : "white",
            fontColor: dark ? "#f4f7f6" : "#121416",
            backgroundOpacity: 0.85
          },
          void 0,
          true
        );
      });
    measurementShapes.current.forEach((shape) => viewer.removeShape(shape));
    measurementShapes.current = [];
    currentMeasurements.forEach((measurement) => {
      const points = measurement.atomIds.map(
        (id) => atoms[atomIdsRef.current.indexOf(id)]
      );
      if (points.some((point) => !point)) return;
      const value = measureAtoms(points);
      if (!value) return;
      for (let i = 1; i < points.length; i++)
        measurementShapes.current.push(
          viewer.addLine({
            start: points[i - 1],
            end: points[i],
            color: focusedMeasurement === measurement.id ? dark ? "#e64c7f" : "#28377a" : dark ? "#a7b0b7" : "#5b6269",
            linewidth: focusedMeasurement === measurement.id ? 3 : 1,
            dashed: true
          })
        );
      const position = points.length === 3 ? points[1] : {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
        z: (points[0].z + points[1].z) / 2
      };
      viewer.addLabel(
        value,
        {
          position,
          fontSize: 12,
          backgroundColor: dark ? "#1a2026" : "white",
          // Readable on its own background in both themes (light was white on white).
          fontColor: dark ? "#f0f1f5" : "#121416",
          inFront: true
        },
        void 0,
        true
      );
    });
    picks.forEach((id, index) => {
      const atom = atoms[atomIdsRef.current.indexOf(id)];
      if (atom)
        viewer.addLabel(
          `${index + 1}: ${id}`,
          {
            position: atom,
            fontSize: 12,
            backgroundColor: dark ? "#e64c7f" : "#28377a",
            fontColor: "white",
            inFront: true
          },
          void 0,
          true
        );
    });
    return true;
  }
  const commandState = useRef2({
    target,
    discovery: extensionHost?.discovery,
    atomIds: atomIdsRef.current,
    styles: supportedStyles,
    cellAvailable: unitCellAvailable,
    ready: false
  });
  commandState.current = {
    target,
    discovery: extensionHost?.discovery,
    atomIds: atomIdsRef.current,
    styles: supportedStyles,
    cellAvailable: unitCellAvailable,
    ready: !loading && !viewerInitError && Boolean(
      viewerRef.current && modelRef.current && renderedReadyRef.current && currentFrameRef.current === renderedFrameRef.current && sameScientificTarget(renderedTargetRef.current, target)
    )
  };
  const applyCommandsRef = useRef2(() => {
  });
  applyCommandsRef.current = async (commands) => {
    applyingCommandRef.current = true;
    try {
      let nextStyle = style, nextSelection = selectedSerialsRef.current;
      commands.forEach((command) => {
        switch (command.type) {
          case "selection":
            selectionStyleRef.current = {
              color: command.color ?? "yellow",
              ...command.radius === void 0 ? {} : { radius: command.radius }
            };
            nextSelection = command.selectedIds.map(
              (id) => atomIdsRef.current.indexOf(id)
            );
            selectedSerialsRef.current = nextSelection;
            setSelectedSerials(nextSelection);
            break;
          case "style":
            nextStyle = command.style;
            setStyle(nextStyle);
            break;
          case "camera":
            viewerRef.current.setView(command.view);
            break;
          case "annotations":
            setAnnotations(command.annotations);
            drawAnnotations(command.annotations);
            break;
          case "unit-cell":
            unitCellPreferenceRef.current = command.visible;
            setUnitCellVisible(command.visible);
            drawCell(command.visible);
            break;
        }
      });
      const viewer = viewerRef.current;
      await applyStyle(nextStyle, nextSelection);
      viewer.render();
    } finally {
      applyingCommandRef.current = false;
    }
  };
  const executorRef = useRef2(null);
  executorRef.current ??= createViewerCommandExecutor(
    () => commandState.current,
    (commands) => applyCommandsRef.current(commands)
  );
  const runOperation = async (operation, message) => {
    if (busyRef.current || loadingRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setStatus(null);
    try {
      await operation();
      setStatus(message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    if (objectRef.current !== activeObject) {
      objectRef.current = activeObject;
      zoomedRef.current = false;
      setCurrentIndex(0);
      setLive(true);
      setAnnotations([]);
      setMeasurePicks([]);
      setMeasureTool(null);
      setSelectedSerials([]);
      setStyle(snapshot?.metadata?.render?.style ?? "ball-stick");
    }
  }, [activeObject]);
  const stagedAtoms = Object.values(stagedSelections).reduce(
    (sum, entry) => sum + entry.atoms.length,
    0
  );
  const stagedMolecules = Object.keys(stagedSelections).length;
  useEffect(() => {
    if (xyzArray.length === 0) {
      setCurrentIndex(0);
      return;
    }
    setCurrentIndex(
      (previous) => live ? xyzArray.length - 1 : Math.min(previous, xyzArray.length - 1)
    );
  }, [xyzArray.length, live]);
  useEffect(() => {
    if (!isPlaying || xyzArray.length <= 1) {
      return;
    }
    const interval = window.setInterval(() => {
      setCurrentIndex((previous) => {
        if (previous >= xyzArray.length - 1) {
          window.clearInterval(interval);
          setIsPlaying(false);
          return previous;
        }
        return previous + 1;
      });
    }, 200);
    return () => window.clearInterval(interval);
  }, [isPlaying, xyzArray.length]);
  useEffect(() => {
    const host = viewerHostRef.current;
    if (!host || viewerRef.current) {
      return;
    }
    let cancelled = false;
    let release;
    try {
      const canvas = document.createElement("canvas");
      const webGl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!webGl) {
        setViewerInitError(
          "WebGL is unavailable in this browser environment. Unable to render 3D viewer."
        );
        return;
      }
      webGl.getExtension?.("WEBGL_lose_context")?.loseContext();
    } catch {
      setViewerInitError(
        "WebGL is unavailable in this browser environment. Unable to render 3D viewer."
      );
      return;
    }
    load3Dmol().then(($3Dmol) => {
      if (cancelled || viewerRef.current) {
        return;
      }
      try {
        const managed = createMoleculeRenderViewer($3Dmol, host);
        const viewer = managed.viewer;
        const unbindPinch = bindPinchZoom(host, (factor) => viewer.zoom(factor));
        release = () => {
          unbindPinch();
          managed.release();
        };
        viewerRef.current = viewer;
        setViewerReady(true);
      } catch (error) {
        console.error("Failed to initialize 3Dmol viewer:", error);
        setViewerInitError(
          "Failed to initialize 3D viewer. Please refresh or try another browser."
        );
      }
    }).catch((error) => {
      console.error("Failed to load 3Dmol viewer runtime:", error);
      setViewerInitError(
        "Failed to load 3D viewer runtime. Please refresh or try another browser."
      );
    });
    return () => {
      cancelled = true;
      release?.();
      viewerRef.current = null;
      modelRef.current = null;
      renderedReadyRef.current = false;
      commandState.current.ready = false;
      readyHandleRef.current = null;
    };
  }, []);
  useLayoutEffect2(() => {
    const viewer = viewerRef.current;
    if (!viewer || !xyzContent) {
      return;
    }
    try {
      renderedReadyRef.current = false;
      commandState.current.ready = false;
      if (renderedModelKeyRef.current !== modelDataKey) {
        viewer.removeAllModels();
        viewer.removeAllShapes();
        styledRef.current = "";
        decoratedRef.current = "";
        measurementShapes.current = [];
        cellDrawRef.current = "";
        if (labelsActiveRef.current) {
          viewer.removeAllLabels();
          labelsActiveRef.current = false;
        }
        setViewerInitError(null);
        const renderFrame = structureRenderFrame(xyzContent, xyzFormat);
        const model = viewer.addModel(renderFrame.content, renderFrame.format, {
          keepH: true,
          doAssembly: false,
          assignBonds: snapshot?.metadata?.render?.bonding !== "none" && snapshot?.metadata?.render?.bonding !== "provided"
        });
        setCartoonAvailable(
          model.selectedAtoms({}).some((atom) => atom.atom === "CA" || atom.atom === "P")
        );
        const oldIds = atomIdsRef.current;
        atomIdsRef.current = applyStructureMetadata(model, snapshot?.metadata);
        const atoms = model.selectedAtoms({});
        setFormula(moleculeFormula(atoms));
        setAtomCount(atoms.length);
        const previous = selectedSerialsRef.current;
        const remapped = previous.map((index) => atomIdsRef.current.indexOf(oldIds[index])).filter((index) => index >= 0);
        selectedSerialsRef.current = remapped;
        setSelectedSerials(
          previous.length === remapped.length && previous.every((value, index) => value === remapped[index]) ? previous : remapped
        );
        const background = snapshot?.metadata?.render?.background ?? (dark ? "#0e1215" : "#ffffff");
        if (backgroundRef.current !== background) {
          viewer.setBackgroundColor(
            background,
            snapshot?.metadata?.render?.background ? 1 : 0
          );
          backgroundRef.current = background;
        }
        const metadataCell = frameCell(snapshot?.metadata, currentIndex);
        cellRef.current = metadataCell === null ? void 0 : metadataCell ?? (xyzFormat === "extxyz" || xyzFormat === "xyz" ? readExtXyzCell(xyzContent) : void 0);
        renderedTargetRef.current = target;
        commandState.current.atomIds = atomIdsRef.current;
        cellShapesRef.current = [];
        modelRef.current = model;
        applyStyle(style, remapped);
        const crystalData = model.getCrystData();
        const hasUnitCell = Boolean(
          cellRef.current || crystalData && typeof crystalData === "object" && Object.keys(crystalData).length
        );
        commandState.current.cellAvailable = hasUnitCell;
        setUnitCellAvailable(hasUnitCell);
        setUnitCellVisible(hasUnitCell ? unitCellPreferenceRef.current : false);
        setSelectedAtomLabels(
          Object.fromEntries(
            model.selectedAtoms({}).map((atom, index) => [index, atom.elem ?? "Atom"])
          )
        );
        const frameAtomLabels = xyzContent.split("\n").slice(2).map((line) => line.trim()).filter(Boolean).map((line) => line.split(/\s+/)[0] ?? "Atom");
        if (!zoomedRef.current) {
          viewer.zoomTo();
          const host = viewerHostRef.current;
          const scale = host?.clientHeight ? Math.min(1, host.clientWidth / host.clientHeight) : 1;
          viewer.zoom((hasUnitCell ? 0.5 : 0.85) * scale);
          zoomedRef.current = true;
        }
        model.setClickable(
          {},
          true,
          (atom, _viewer, event) => {
            const serial = atom.index;
            if (serial === void 0) {
              return;
            }
            if (loadingRef.current || !renderedReadyRef.current) return;
            if (measureToolRef.current) {
              const id = atomIdsRef.current[serial];
              if (id) pickMeasurementRef.current(id);
              return;
            }
            selectionStyleRef.current = { color: "yellow" };
            const label = atom.atom || atom.elem || frameAtomLabels[serial] || "Atom";
            setSelectedSerials((previous2) => {
              const isMulti = Boolean(
                event?.shiftKey || event?.metaKey || event?.ctrlKey
              );
              const next = !isMulti ? previous2.length === 1 && previous2[0] === serial ? [] : [serial] : previous2.includes(serial) ? previous2.filter((entry) => entry !== serial) : [...previous2, serial];
              setSelectedAtomLabels((current) => {
                if (next.length === 0) {
                  return {};
                }
                const labelsBySerial = {};
                next.forEach((entry) => {
                  labelsBySerial[entry] = current[entry] || frameAtomLabels[entry] || label;
                });
                return labelsBySerial;
              });
              return next;
            });
          }
        );
        model.setHoverable(
          {},
          true,
          (atom, _viewer, event) => {
            if (!event || !atom) {
              return;
            }
            setHoveredAtom({
              x: event.clientX,
              y: event.clientY,
              label: `${atom.atom || atom.elem || "Atom"} (${atom.index ?? atom.serial ?? "?"})`,
              coords: {
                x: atom.x.toFixed(2),
                y: atom.y.toFixed(2),
                z: atom.z.toFixed(2)
              }
            });
          },
          () => setHoveredAtom(null)
        );
        drawCell(hasUnitCell && unitCellPreferenceRef.current);
        drawAnnotations(annotations);
        viewer.render();
        renderedModelKeyRef.current = modelDataKey;
      }
      renderedTargetRef.current = target;
      renderedReadyRef.current = true;
      commandState.current.ready = !loading;
      const readyFrame = currentFrameRef.current;
      renderedFrameRef.current = readyFrame;
      const readyTarget = target ? structuredClone(target) : void 0;
      const isAvailable = () => Boolean(
        viewerHostRef.current?.isConnected && viewerRef.current === viewer && renderedReadyRef.current && readyFrame === currentFrameRef.current && !loadingRef.current && (sameScientificTarget(readyTarget, targetRef.current) || !readyTarget && !targetRef.current)
      );
      const captureView = () => {
        if (!isAvailable())
          throw new Error("The inspected target changed or is unavailable.");
        return captureRef.current();
      };
      const handle = {
        captureScreenshot: () => captureView().image,
        captureView,
        isAvailable,
        trajectoryIndex: target?.frameIndex ?? currentIndex,
        target: readyTarget ? structuredClone(readyTarget) : void 0,
        execute: async (request) => {
          if (!isAvailable())
            return {
              version: 1,
              requestId: request.requestId,
              operationId: request.operationId,
              actionId: request.actionId,
              target: structuredClone(request.target),
              status: "rejected",
              error: {
                code: sameScientificTarget(request.target, targetRef.current) ? "VIEWER_UNAVAILABLE" : "STALE_TARGET",
                message: "The inspected viewer changed or is unavailable."
              }
            };
          return executorRef.current(request);
        }
      };
      readyHandleRef.current = handle;
      onReadyRef.current?.(handle);
    } catch (error) {
      renderedReadyRef.current = false;
      commandState.current.ready = false;
      console.error("Failed to render molecule:", error);
      setViewerInitError("Unable to render this molecular structure.");
    }
  }, [
    xyzContent,
    xyzFormat,
    viewerReady,
    currentIndex,
    snapshot?.metadata,
    targetKey,
    activeObject,
    loading
  ]);
  useEffect(() => {
    if (!viewerReady) return;
    const visible = unitCellVisible && unitCellAvailable;
    if (cellDrawRef.current !== JSON.stringify([visible, cellRef.current, dark])) {
      drawCell(visible);
      viewerRef.current?.render();
    }
  }, [unitCellAvailable, unitCellVisible, viewerReady, dark]);
  useEffect(() => {
    if (!viewerReady || applyingCommandRef.current) return;
    const next = JSON.stringify([
      style,
      selectedSerials,
      selectionStyleRef.current,
      hydrogens,
      dark
    ]);
    if (styledRef.current !== next) {
      applyStyle(style);
      viewerRef.current?.render();
    }
    onSelectionChange?.(selection());
  }, [
    moleculeId,
    selectedSerials,
    style,
    viewerReady,
    xyzContent,
    hydrogens,
    dark
  ]);
  useEffect(() => {
    if (!viewerReady || loading || applyingCommandRef.current) return;
    const changed = drawAnnotations(annotations);
    const background = snapshot?.metadata?.render?.background ?? (dark ? "#0e1215" : "#ffffff");
    const backgroundChanged = backgroundRef.current !== background;
    if (backgroundChanged)
      viewerRef.current?.setBackgroundColor(
        background,
        snapshot?.metadata?.render?.background ? 1 : 0
      );
    backgroundRef.current = background;
    if (changed || backgroundChanged) viewerRef.current?.render();
  }, [
    annotations,
    atomLabels,
    hydrogens,
    dark,
    measurements,
    measurementKey,
    measurePicks,
    focusedMeasurement,
    viewerReady,
    loading
  ]);
  useLayoutEffect2(() => {
    picksRef.current = [];
    setMeasurePicks((current) => current.length ? [] : current);
    setFocusedMeasurement(null);
  }, [measurementKey]);
  useEffect(() => {
    const host = viewerHostRef.current;
    if (!host) return;
    const sync = () => {
      setDark(Boolean(host.closest('[data-theme="dark"], .dark')));
    };
    sync();
    const observer = new MutationObserver(sync);
    for (let element = host; element; element = element.parentElement)
      observer.observe(element, {
        attributes: true,
        attributeFilter: ["data-theme", "class"]
      });
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(Boolean(motion?.matches));
    syncMotion();
    motion?.addEventListener?.("change", syncMotion);
    return () => {
      observer.disconnect();
      motion?.removeEventListener?.("change", syncMotion);
    };
  }, []);
  useEffect(() => {
    if (reducedMotion || loading || presentation === "timeline" && !expanded) {
      setSpin(0);
      viewerRef.current?.spin?.(false);
      return;
    }
    viewerRef.current?.spin?.(spin ? "y" : false, spin === 1 ? 0.35 : 0.9);
    return () => {
      viewerRef.current?.spin?.(false);
    };
  }, [spin, reducedMotion, loading, expanded, presentation, viewerReady]);
  useLayoutEffect2(() => {
    viewerRef.current?.resize();
  }, [expanded]);
  useEffect(() => {
    if (!measurementNotice) return;
    const timer = window.setTimeout(() => setMeasurementNotice(false), 8e3);
    return () => window.clearTimeout(timer);
  }, [measurementNotice, measurementHistory]);
  useEffect(() => {
    if (!xyzContent) {
      return;
    }
    let animationFrame = 0;
    const tick = () => {
      const view = viewerRef.current?.getView?.();
      if (Array.isArray(view) && view.length >= 8) {
        const [x, y, z, zoom, qx, qy, qz, qw] = view;
        if (typeof x === "number" && typeof y === "number" && typeof z === "number" && typeof zoom === "number" && typeof qx === "number" && typeof qy === "number" && typeof qz === "number" && typeof qw === "number") {
          const magnitude = Math.sqrt(qx * qx + qy * qy + qz * qz);
          const lookAt = magnitude > 0 ? { x: qx / magnitude, y: qy / magnitude, z: qz / magnitude } : { x: 0, y: 0, z: 0 };
          setCameraInfo({
            position: { x, y, z, qx, qy, qz, qw },
            lookAt,
            zoom
          });
        }
      }
      animationFrame = window.setTimeout(tick, 200);
    };
    animationFrame = window.setTimeout(tick, 200);
    return () => window.clearTimeout(animationFrame);
  }, [xyzContent]);
  const capture = () => {
    const viewer = viewerRef.current;
    if (!readyHandleRef.current?.isAvailable() || !viewer?.pngURI || applyingCommandRef.current)
      throw new Error("Screenshot is unavailable");
    viewer.render();
    const image = viewer.pngURI();
    if (!image.startsWith("data:image/png;base64,"))
      throw new Error("Viewer did not produce a PNG");
    const header = Uint8Array.from(
      atob(image.slice(22, 66)),
      (c) => c.charCodeAt(0)
    );
    if (header.length < 24 || ![137, 80, 78, 71, 13, 10, 26, 10].every(
      (byte, index) => header[index] === byte
    ) || String.fromCharCode(...header.slice(12, 16)) !== "IHDR")
      throw new Error("Viewer did not produce a valid PNG");
    const dimensions = new DataView(header.buffer);
    const width = dimensions.getUint32(16), height = dimensions.getUint32(20);
    if (!width || !height) throw new Error("Viewer produced an empty PNG");
    const camera = [...viewer.getView()];
    if (camera.length !== 8 || camera.some((value) => !Number.isFinite(value)))
      throw new Error("Viewer camera is unavailable");
    return {
      version: 1,
      moleculeId,
      image,
      mediaType: "image/png",
      width,
      height,
      target: target ? structuredClone(target) : void 0,
      trajectoryIndex: target?.frameIndex ?? currentIndex,
      camera,
      selectedIds: selectedSerialsRef.current.map((index) => atomIdsRef.current[index]).filter(Boolean)
    };
  };
  captureRef.current = capture;
  const handleScreenshot = async () => {
    const screenshot = capture();
    const blob = await (await fetch(screenshot.image)).blob();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  };
  function assertSubmissionTargets(entries) {
    if (loading) throw new Error("Wait for the verified structure to load.");
    entries.forEach((entry) => {
      if (entry.target?.objectId === target?.objectId && !snapshot?.frameTargets?.some(
        (frame) => sameScientificTarget(frame, entry.target)
      ) && (entry.target?.sourceRevision !== target?.sourceRevision || entry.target?.checksum !== target?.checksum))
        throw new Error(
          "A staged selection refers to an older source revision. Select its atoms again."
        );
    });
  }
  function handleToggleUnitCell() {
    if (!unitCellAvailable) {
      return;
    }
    setUnitCellVisible((previous) => {
      const next = !previous;
      unitCellPreferenceRef.current = next;
      return next;
    });
  }
  function handleStageSelection() {
    if (selectedSerials.length === 0) {
      return;
    }
    const entry = selection();
    const key = JSON.stringify(
      entry.target ?? { moleculeId, frameIndex: currentIndex }
    );
    setStagedSelections((current) => ({ ...current, [key]: entry }));
  }
  function focusMeasurementKeyboard() {
    viewerHostRef.current?.closest(".thread-graph-molecule-viewer")?.focus({ preventScroll: true });
  }
  function changeMeasurements(items) {
    focusMeasurementKeyboard();
    setMeasurementHistory((history) => [
      ...history.slice(-49),
      { key: measurementKey, before: currentMeasurements, after: items }
    ]);
    setMeasurementFuture([]);
    setMeasurements((current) => ({ ...current, [measurementKey]: items }));
    setMeasurementNotice(true);
  }
  function undoMeasurement(redo = false) {
    const stack = redo ? measurementFuture : measurementHistory;
    const entry = stack.at(-1);
    if (!entry) return;
    focusMeasurementKeyboard();
    setMeasurements((current) => ({
      ...current,
      [entry.key]: redo ? entry.after : entry.before
    }));
    if (redo) {
      setMeasurementFuture(stack.slice(0, -1));
      setMeasurementHistory((history) => [...history, entry]);
    } else {
      setMeasurementHistory(stack.slice(0, -1));
      setMeasurementFuture((future) => [...future, entry]);
    }
    setMeasurementNotice(false);
  }
  function toggleMeasureTool(tool) {
    setMeasureTool(tool === measureTool ? null : tool);
    picksRef.current = [];
    setMeasurePicks([]);
  }
  pickMeasurementRef.current = (id) => {
    measurePickKeyRef.current = measurementKey;
    const picks = picksRef.current;
    const next = picks.includes(id) ? picks.filter((value) => value !== id) : [...picks, id];
    if (next.length === (measureToolRef.current === "angle" ? 3 : 2)) {
      const atoms = next.map(
        (value) => modelRef.current.selectedAtoms({})[atomIdsRef.current.indexOf(value)]
      );
      if (measureAtoms(atoms) && currentMeasurements.length < 128)
        changeMeasurements([
          ...currentMeasurements,
          { id: ++nextMeasurementId.current, atomIds: next }
        ]);
      else
        setStatus(
          "Unable to measure these points, or the 128-measurement limit was reached."
        );
      picksRef.current = [];
      setMeasurePicks([]);
    } else {
      picksRef.current = next;
      setMeasurePicks(next);
    }
  };
  function resetView() {
    const viewer = viewerRef.current, host = viewerHostRef.current;
    if (!viewer || loading) return;
    viewer.zoomTo();
    viewer.zoom(
      (unitCellAvailable ? 0.5 : 0.85) * (host?.clientHeight ? Math.min(1, host.clientWidth / host.clientHeight) : 1)
    );
    viewer.setCameraParameters({});
    viewer.render();
  }
  function downloadSource() {
    if (onDownloadSource) onDownloadSource();
    else
      downloadTextFile(
        viewerData.exportContent,
        `${title || "structure"}.${xyzFormat}`
      );
  }
  function closeLayer() {
    const menu = viewerHostRef.current?.closest(".thread-graph-molecule-viewer")?.querySelector(".molecule-view-menu[open]");
    if (menu) {
      menu.open = false;
      menu.querySelector("summary")?.focus();
    } else if (help) setHelp(false);
    else if (measurePicks.length) {
      picksRef.current = [];
      setMeasurePicks([]);
    } else if (measureTool) setMeasureTool(null);
    else setExpanded(false);
  }
  function changeExpanded(open) {
    setExpanded(open);
    const handle = readyHandleRef.current;
    if (handle?.isAvailable()) onActive?.(handle);
    if (!open) {
      setSpin(0);
      setHelp(false);
      setMeasureTool(null);
      picksRef.current = [];
      setMeasurePicks([]);
      setHoveredAtom(null);
    }
  }
  const liveButton = /* @__PURE__ */ jsxs5(
    Button,
    {
      type: "button",
      onClick: () => {
        setLive(true);
        setIsPlaying(false);
      },
      "aria-pressed": live,
      children: [
        "LIVE",
        live ? " following" : ""
      ]
    }
  );
  return /* @__PURE__ */ jsx7(
    GraphMoleculeFigureFrame,
    {
      expanded,
      onExpandedChange: changeExpanded,
      onEscape: closeLayer,
      title: title || "Molecular structure",
      presentation,
      children: /* @__PURE__ */ jsxs5(
        "div",
        {
          className: `thread-graph-molecule-viewer is-${presentation} ${expanded ? "is-fullview" : ""} flex h-full min-h-0 flex-col ${className}`,
          tabIndex: 0,
          onKeyDown: (event) => {
            const element = event.target;
            if (element.closest(
              'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'
            ))
              return;
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              closeLayer();
              return;
            }
            if (loading || viewerInitError || presentation === "timeline" && !expanded)
              return;
            const key = event.key.toLowerCase();
            if ((event.metaKey || event.ctrlKey) && key === "z") {
              event.preventDefault();
              undoMeasurement(event.shiftKey);
              return;
            }
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            const actions = {
              "1": () => setStyle("ball-stick"),
              "2": () => setStyle("stick"),
              "3": () => setStyle("spacefill"),
              l: () => setAtomLabels(!atomLabels),
              h: () => setHydrogens(!hydrogens),
              d: () => toggleMeasureTool("distance"),
              a: () => toggleMeasureTool("angle"),
              m: () => toggleMeasureTool(measureTool ? null : "distance"),
              s: () => setSpin(reducedMotion ? 0 : (spin + 1) % 3),
              r: resetView,
              "?": () => setHelp(!help)
            };
            if (actions[key]) {
              event.preventDefault();
              actions[key]();
            }
          },
          onPointerDownCapture: () => {
            const handle = readyHandleRef.current;
            if (handle?.isAvailable()) onActive?.(handle);
          },
          onFocusCapture: () => {
            const handle = readyHandleRef.current;
            if (handle?.isAvailable()) onActive?.(handle);
          },
          children: [
            /* @__PURE__ */ jsxs5("div", { className: "thread-graph-molecule-header flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 sm:px-4 sm:py-3", children: [
              /* @__PURE__ */ jsxs5("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsx7("h2", { className: "truncate text-sm font-semibold text-slate-900", children: onOpenFile ? /* @__PURE__ */ jsxs5(
                  "button",
                  {
                    type: "button",
                    onClick: onOpenFile,
                    className: "thread-graph-molecule-file-link",
                    title: "Open in workspace",
                    children: [
                      /* @__PURE__ */ jsx7("span", { className: "truncate", children: title }),
                      /* @__PURE__ */ jsx7(PanelRightOpen, { className: "size-4 shrink-0" })
                    ]
                  }
                ) : title }),
                /* @__PURE__ */ jsx7("p", { className: "mt-1 hidden text-[11px] text-slate-400 sm:block", children: "Structure and trajectory" })
              ] }),
              /* @__PURE__ */ jsxs5(
                "div",
                {
                  className: "molecule-toolbar",
                  "aria-label": "View controls",
                  inert: loading || Boolean(viewerInitError),
                  children: [
                    /* @__PURE__ */ jsx7("div", { className: "molecule-styles", role: "group", "aria-label": "Style", children: [
                      ["ball-stick", "Ball & stick"],
                      ["stick", "Sticks"],
                      ["spacefill", "Space-fill"]
                    ].map(([value, label], index) => /* @__PURE__ */ jsx7(
                      "button",
                      {
                        type: "button",
                        "aria-pressed": style === value,
                        title: `${label} (${index + 1})`,
                        onClick: () => setStyle(value),
                        children: label
                      },
                      value
                    )) }),
                    /* @__PURE__ */ jsxs5("details", { className: "molecule-view-menu", children: [
                      /* @__PURE__ */ jsx7("summary", { children: "View" }),
                      /* @__PURE__ */ jsxs5("div", { children: [
                        /* @__PURE__ */ jsxs5(
                          "button",
                          {
                            type: "button",
                            "aria-label": "Atom labels",
                            "aria-pressed": atomLabels,
                            onClick: () => setAtomLabels(!atomLabels),
                            children: [
                              "Atom labels ",
                              /* @__PURE__ */ jsx7("kbd", { children: "L" })
                            ]
                          }
                        ),
                        /* @__PURE__ */ jsxs5(
                          "button",
                          {
                            type: "button",
                            "aria-label": "Hydrogens",
                            "aria-pressed": hydrogens,
                            onClick: () => setHydrogens(!hydrogens),
                            children: [
                              "Hydrogens ",
                              /* @__PURE__ */ jsx7("kbd", { children: "H" })
                            ]
                          }
                        ),
                        /* @__PURE__ */ jsxs5(
                          "button",
                          {
                            type: "button",
                            "aria-label": "Spin",
                            "aria-pressed": spin > 0,
                            disabled: reducedMotion,
                            onClick: () => setSpin((spin + 1) % 3),
                            children: [
                              "Spin: ",
                              spin === 1 ? "slow" : spin === 2 ? "fast" : "off",
                              " ",
                              /* @__PURE__ */ jsx7("kbd", { children: "S" })
                            ]
                          }
                        )
                      ] })
                    ] }),
                    /* @__PURE__ */ jsx7(
                      "button",
                      {
                        type: "button",
                        "aria-label": "Measure distance",
                        title: "Distance (D)",
                        "aria-pressed": measureTool === "distance",
                        disabled: !viewerReady || !xyzContent || loading,
                        onClick: () => toggleMeasureTool("distance"),
                        children: /* @__PURE__ */ jsx7(Ruler, { size: 16 })
                      }
                    ),
                    /* @__PURE__ */ jsx7(
                      "button",
                      {
                        type: "button",
                        "aria-label": "Measure angle",
                        title: "Angle (A)",
                        "aria-pressed": measureTool === "angle",
                        disabled: !viewerReady || !xyzContent || loading,
                        onClick: () => toggleMeasureTool("angle"),
                        children: /* @__PURE__ */ jsx7(Waypoints, { size: 16 })
                      }
                    ),
                    /* @__PURE__ */ jsx7(
                      "button",
                      {
                        type: "button",
                        "aria-label": "Reset view",
                        title: "Reset view (R)",
                        onClick: resetView,
                        children: /* @__PURE__ */ jsx7(RotateCcw2, { size: 16 })
                      }
                    ),
                    /* @__PURE__ */ jsx7(
                      "button",
                      {
                        type: "button",
                        "aria-label": "Download source",
                        title: "Download immutable source",
                        disabled: !viewerData.exportContent || loading,
                        onClick: downloadSource,
                        children: /* @__PURE__ */ jsx7(Download2, { size: 16 })
                      }
                    )
                  ]
                }
              )
            ] }),
            /* @__PURE__ */ jsxs5("div", { className: "thread-graph-molecule-body min-h-0 flex-1", children: [
              /* @__PURE__ */ jsxs5(
                "div",
                {
                  ref: viewerHostRef,
                  "data-testid": "molecule-viewer",
                  className: "thread-graph-molecule-stage relative min-h-0 flex-1 overflow-hidden",
                  "aria-label": "Molecular structure; drag to rotate, pinch to zoom",
                  "data-measuring": Boolean(measureTool),
                  onDoubleClick: () => presentation === "timeline" && !expanded ? setExpanded(true) : resetView(),
                  onPointerDown: () => {
                    viewerRef.current?.spin?.(false);
                  },
                  onPointerUp: () => {
                    if (spin && !reducedMotion)
                      viewerRef.current?.spin?.("y", spin === 1 ? 0.35 : 0.9);
                  },
                  onPointerCancel: () => setSpin(0),
                  children: [
                    viewerInitError ? /* @__PURE__ */ jsx7(
                      "div",
                      {
                        "data-testid": "molecule-viewer-error",
                        className: "thread-graph-molecule-error absolute inset-0 flex items-center justify-center bg-red-50 p-4 text-sm text-red-700",
                        children: viewerInitError
                      }
                    ) : null,
                    !viewerInitError && !xyzContent ? /* @__PURE__ */ jsx7("div", { className: "thread-graph-molecule-empty absolute inset-0 flex items-center justify-center p-4 text-sm text-slate-400", children: "No molecule data available." }) : null,
                    hoveredAtom ? /* @__PURE__ */ jsxs5(
                      "div",
                      {
                        className: "thread-graph-molecule-tooltip pointer-events-none fixed z-[1000] rounded-md border border-gray-300 bg-white/95 px-2 py-1.5 text-[10px] text-gray-800 shadow-md",
                        style: { left: hoveredAtom.x - 20, top: hoveredAtom.y - 50 },
                        children: [
                          /* @__PURE__ */ jsx7("div", { className: "mb-0.5 font-semibold text-gray-900", children: hoveredAtom.label }),
                          /* @__PURE__ */ jsxs5("div", { className: "space-x-2 text-gray-600", children: [
                            /* @__PURE__ */ jsxs5("span", { children: [
                              "x: ",
                              hoveredAtom.coords.x
                            ] }),
                            /* @__PURE__ */ jsxs5("span", { children: [
                              "y: ",
                              hoveredAtom.coords.y
                            ] }),
                            /* @__PURE__ */ jsxs5("span", { children: [
                              "z: ",
                              hoveredAtom.coords.z
                            ] })
                          ] })
                        ]
                      }
                    ) : null,
                    (measureTool || measurementsPinned && currentMeasurements.length > 0) && /* @__PURE__ */ jsxs5(
                      "section",
                      {
                        className: "molecule-measurements",
                        "aria-label": "Measurements",
                        onDoubleClick: (event) => event.stopPropagation(),
                        onPointerDown: (event) => event.stopPropagation(),
                        children: [
                          /* @__PURE__ */ jsxs5("header", { children: [
                            /* @__PURE__ */ jsx7(
                              "button",
                              {
                                type: "button",
                                "aria-label": "Pin measurements",
                                "aria-pressed": measurementsPinned,
                                onClick: () => setMeasurementsPinned(!measurementsPinned),
                                children: /* @__PURE__ */ jsx7(Pin, { size: 14 })
                              }
                            ),
                            /* @__PURE__ */ jsx7("strong", { children: "Measurements" }),
                            /* @__PURE__ */ jsx7("span", { children: currentMeasurements.length }),
                            /* @__PURE__ */ jsx7(
                              "button",
                              {
                                type: "button",
                                "aria-label": "Clear measurements",
                                disabled: !currentMeasurements.length,
                                onClick: () => changeMeasurements([]),
                                children: "Clear"
                              }
                            )
                          ] }),
                          /* @__PURE__ */ jsx7("ol", { children: currentMeasurements.map((measurement, index) => {
                            const atoms = measurement.atomIds.map(
                              (id) => modelRef.current?.selectedAtoms({})[atomIdsRef.current.indexOf(id)]
                            ).filter(
                              (atom) => Boolean(atom)
                            );
                            return /* @__PURE__ */ jsxs5(
                              "li",
                              {
                                onMouseEnter: () => setFocusedMeasurement(measurement.id),
                                onMouseLeave: () => setFocusedMeasurement(null),
                                onFocus: () => setFocusedMeasurement(measurement.id),
                                onBlur: () => setFocusedMeasurement(null),
                                children: [
                                  /* @__PURE__ */ jsx7("span", { children: index + 1 }),
                                  /* @__PURE__ */ jsx7("span", { title: measurement.atomIds.join(" \u2192 "), children: measurement.atomIds.join("\u2013") }),
                                  /* @__PURE__ */ jsx7("output", { children: measureAtoms(atoms) }),
                                  /* @__PURE__ */ jsx7(
                                    "button",
                                    {
                                      type: "button",
                                      "aria-label": `Remove measurement ${index + 1}`,
                                      onClick: () => changeMeasurements(
                                        currentMeasurements.filter(
                                          (entry) => entry.id !== measurement.id
                                        )
                                      ),
                                      children: /* @__PURE__ */ jsx7(X2, { size: 12 })
                                    }
                                  )
                                ]
                              },
                              measurement.id
                            );
                          }) }),
                          !currentMeasurements.length && /* @__PURE__ */ jsx7("p", { children: "Click atoms to measure" })
                        ]
                      }
                    ),
                    help && /* @__PURE__ */ jsxs5(
                      "div",
                      {
                        className: "molecule-help",
                        role: "dialog",
                        "aria-label": "Viewer help",
                        children: [
                          /* @__PURE__ */ jsx7(
                            "button",
                            {
                              type: "button",
                              "aria-label": "Close help",
                              onClick: () => setHelp(false),
                              children: /* @__PURE__ */ jsx7(X2, { size: 14 })
                            }
                          ),
                          /* @__PURE__ */ jsx7("p", { children: "Drag to rotate \xB7 scroll or pinch to zoom \xB7 double-click to reset." }),
                          /* @__PURE__ */ jsx7("p", { children: "Click an atom to select; Shift/Ctrl/\u2318 adds atoms. Measurements use separate picks." }),
                          /* @__PURE__ */ jsx7("p", { children: "1/2/3 style \xB7 L labels \xB7 H hydrogens \xB7 D distance \xB7 A angle \xB7 M measure \xB7 S spin \xB7 R reset \xB7 ? help" }),
                          /* @__PURE__ */ jsx7("p", { children: "Ctrl/\u2318 Z undo \xB7 Shift Ctrl/\u2318 Z redo. Escape closes popovers, clears picks, exits the tool, then closes full view." })
                        ]
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ jsxs5("div", { className: "molecule-caption", children: [
                /* @__PURE__ */ jsxs5("div", { children: [
                  /* @__PURE__ */ jsx7("strong", { children: title }),
                  /* @__PURE__ */ jsxs5("span", { children: [
                    formula.map(({ element, count }) => /* @__PURE__ */ jsxs5("span", { children: [
                      element,
                      count > 1 && /* @__PURE__ */ jsx7("sub", { children: count })
                    ] }, element)),
                    atomCount ? ` \xB7 ${atomCount} atoms` : "",
                    xyzArray.length > 1 ? ` \xB7 Frame ${currentIndex + 1} / ${xyzArray.length}` : ""
                  ] })
                ] }),
                /* @__PURE__ */ jsx7(
                  "button",
                  {
                    type: "button",
                    className: "molecule-card-download",
                    "aria-label": "Download figure source",
                    disabled: loading || !viewerData.exportContent,
                    onClick: downloadSource,
                    children: /* @__PURE__ */ jsx7(Download2, { size: 16 })
                  }
                ),
                /* @__PURE__ */ jsx7(
                  "button",
                  {
                    type: "button",
                    className: "molecule-help-button",
                    "aria-label": "Viewer help",
                    "aria-expanded": help,
                    onClick: () => setHelp(!help),
                    children: /* @__PURE__ */ jsx7(HelpCircle, { size: 16 })
                  }
                )
              ] }),
              measureTool && /* @__PURE__ */ jsxs5("p", { className: "molecule-measure-hint", role: "status", children: [
                measureTool === "angle" ? "Angle: pick three atoms; the middle atom is the vertex." : "Distance: pick two atoms.",
                " ",
                measurePicks.length ? `${measurePicks.join(" \u2192 ")} \u2192 pick ${(measureTool === "angle" ? 3 : 2) - measurePicks.length} more. Click a picked atom to cancel it.` : ""
              ] }),
              (measurementNotice || measurementFuture.length > 0) && /* @__PURE__ */ jsxs5("div", { className: "molecule-undo", role: "status", children: [
                /* @__PURE__ */ jsx7("span", { children: "Measurement change" }),
                /* @__PURE__ */ jsx7(
                  "button",
                  {
                    type: "button",
                    "aria-label": "Undo measurement change",
                    disabled: !measurementHistory.length,
                    onClick: () => undoMeasurement(),
                    children: /* @__PURE__ */ jsx7(Undo2, { size: 15 })
                  }
                ),
                /* @__PURE__ */ jsx7(
                  "button",
                  {
                    type: "button",
                    "aria-label": "Redo measurement change",
                    disabled: !measurementFuture.length,
                    onClick: () => undoMeasurement(true),
                    children: /* @__PURE__ */ jsx7(Redo2, { size: 15 })
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs5("div", { className: "thread-graph-molecule-controls shrink-0", children: [
                /* @__PURE__ */ jsxs5("details", { className: "molecule-scientific-tools", children: [
                  /* @__PURE__ */ jsxs5("summary", { children: [
                    "Structure tools & selection",
                    selectedSerials.length ? ` \xB7 ${selectedSerials.length} selected` : ""
                  ] }),
                  /* @__PURE__ */ jsx7("div", { children: /* @__PURE__ */ jsxs5("div", { className: "thread-graph-molecule-control-row", children: [
                    /* @__PURE__ */ jsxs5("div", { className: "min-w-0", children: [
                      /* @__PURE__ */ jsxs5("label", { children: [
                        "Representation",
                        " ",
                        /* @__PURE__ */ jsx7(
                          "select",
                          {
                            "aria-label": "Representation",
                            value: style,
                            onChange: (event) => setStyle(event.target.value),
                            children: supportedStyles.map((entry) => /* @__PURE__ */ jsx7("option", { value: entry, children: entry }, entry))
                          }
                        )
                      ] }),
                      /* @__PURE__ */ jsx7("p", { className: "thread-graph-molecule-control-subtitle", children: "XYZ / PDB / CIF preview" })
                    ] }),
                    /* @__PURE__ */ jsx7(
                      GraphMoleculeViewerUpperButtonGroup,
                      {
                        currentIndex,
                        exportContent: viewerData.exportContent,
                        moleculeId,
                        onScreenshot: () => void runOperation(
                          handleScreenshot,
                          "PNG copied to clipboard."
                        ),
                        onDownloadSource,
                        onFeedback: setStatus,
                        viewerRef,
                        viewerHostRef,
                        hasUnitCell: unitCellAvailable,
                        xyzContent,
                        xyzFormat
                      }
                    )
                  ] }) })
                ] }),
                xyzArray.length > 1 ? /* @__PURE__ */ jsxs5(
                  "div",
                  {
                    className: "thread-graph-molecule-trajectory",
                    role: "group",
                    "aria-label": "Trajectory controls",
                    children: [
                      /* @__PURE__ */ jsxs5("div", { className: "thread-graph-molecule-playback-row", children: [
                        /* @__PURE__ */ jsxs5(
                          Button,
                          {
                            type: "button",
                            variant: "ghost",
                            className: "thread-graph-molecule-play-button",
                            "aria-label": isPlaying ? "Pause trajectory" : "Play trajectory",
                            onClick: () => {
                              setLive(false);
                              if (!isPlaying && currentIndex === xyzArray.length - 1)
                                setCurrentIndex(0);
                              setIsPlaying((current) => !current);
                            },
                            children: [
                              isPlaying ? /* @__PURE__ */ jsx7(Pause, { className: "size-4" }) : /* @__PURE__ */ jsx7(Play, { className: "size-4" }),
                              isPlaying ? "Pause" : "Play"
                            ]
                          }
                        ),
                        /* @__PURE__ */ jsxs5("span", { className: "thread-graph-molecule-frame-count", children: [
                          "Frame ",
                          /* @__PURE__ */ jsx7("strong", { children: currentIndex + 1 }),
                          " /",
                          " ",
                          xyzArray.length
                        ] }),
                        followControl ? liveButton : null,
                        /* @__PURE__ */ jsx7("div", { className: "thread-graph-molecule-frame-buttons", children: [
                          {
                            label: "First frame",
                            index: 0,
                            Icon: SkipBack,
                            disabled: currentIndex === 0
                          },
                          {
                            label: "Previous frame",
                            index: currentIndex - 1,
                            Icon: ChevronLeft,
                            disabled: currentIndex === 0
                          },
                          {
                            label: "Next frame",
                            index: currentIndex + 1,
                            Icon: ChevronRight,
                            disabled: currentIndex === xyzArray.length - 1
                          },
                          {
                            label: "Last frame",
                            index: xyzArray.length - 1,
                            Icon: SkipForward,
                            disabled: currentIndex === xyzArray.length - 1
                          }
                        ].map(({ label, index, Icon, disabled }) => /* @__PURE__ */ jsx7(
                          Button,
                          {
                            type: "button",
                            variant: "ghost",
                            className: "thread-graph-molecule-button",
                            "aria-label": label,
                            title: label,
                            disabled,
                            onClick: () => {
                              setLive(false);
                              setIsPlaying(false);
                              setCurrentIndex(index);
                            },
                            children: /* @__PURE__ */ jsx7(Icon, { className: "size-4" })
                          },
                          label
                        )) })
                      ] }),
                      /* @__PURE__ */ jsx7(
                        "input",
                        {
                          type: "range",
                          className: "thread-graph-molecule-scrubber",
                          min: 1,
                          max: xyzArray.length,
                          step: 1,
                          value: currentIndex + 1,
                          "aria-label": "Trajectory frame",
                          "aria-valuetext": `Frame ${currentIndex + 1} of ${xyzArray.length}`,
                          style: {
                            backgroundSize: `${currentIndex / (xyzArray.length - 1) * 100}% 6px`
                          },
                          onChange: (event) => {
                            setLive(false);
                            setIsPlaying(false);
                            setCurrentIndex(Number(event.target.value) - 1);
                          }
                        }
                      ),
                      /* @__PURE__ */ jsxs5(
                        "div",
                        {
                          className: "thread-graph-molecule-frame-scale",
                          "aria-hidden": "true",
                          children: [
                            /* @__PURE__ */ jsx7("span", { children: "1" }),
                            /* @__PURE__ */ jsxs5("span", { children: [
                              xyzArray.length,
                              " frames"
                            ] })
                          ]
                        }
                      )
                    ]
                  }
                ) : null,
                /* @__PURE__ */ jsxs5("details", { className: "molecule-scientific-actions", children: [
                  /* @__PURE__ */ jsxs5("summary", { children: [
                    "Scientific actions",
                    selectedSerials.length ? ` \xB7 ${selectedSerials.length} selected` : ""
                  ] }),
                  /* @__PURE__ */ jsxs5("div", { children: [
                    /* @__PURE__ */ jsx7(
                      "div",
                      {
                        role: "group",
                        "aria-label": "Viewer contributions",
                        inert: loading,
                        style: { visibility: loading ? "hidden" : void 0 },
                        children: !viewerInitError && toolbar?.({ target, selectedIds })
                      }
                    ),
                    rendererSlot?.({ target, selectedIds }),
                    followControl ? null : liveButton,
                    onScreenshot && /* @__PURE__ */ jsx7(
                      Button,
                      {
                        type: "button",
                        disabled: loading || busy || !viewerReady || !target || !renderedReadyRef.current || Boolean(viewerInitError),
                        onClick: () => void runOperation(
                          () => onScreenshot(capture()),
                          "PNG submitted."
                        ),
                        children: "Send screenshot"
                      }
                    ),
                    status && /* @__PURE__ */ jsx7("p", { role: "status", children: status }),
                    /* @__PURE__ */ jsx7(
                      GraphMoleculeViewerLowerButtonGroup,
                      {
                        cameraInfo,
                        onClearSelection: () => setSelectedSerials([]),
                        onClearStaged: () => setStagedSelections({}),
                        canSubmit: Boolean(onSelectionSubmit && target) && !loading && !busy && !viewerInitError && renderedReadyRef.current,
                        onSendSelection: () => void runOperation(async () => {
                          const entries = [selection()];
                          assertSubmissionTargets(entries);
                          await onSelectionSubmit?.({ selections: entries });
                        }, "Selection submitted."),
                        onSendStaged: () => void runOperation(async () => {
                          const entries = Object.values(stagedSelections);
                          assertSubmissionTargets(entries);
                          await onSelectionSubmit?.({ selections: entries });
                          setStagedSelections({});
                        }, "Staged selections submitted."),
                        onStageSelection: handleStageSelection,
                        onToggleUnitCell: handleToggleUnitCell,
                        selectedAtomLabels,
                        selectedSerials,
                        stagedAtoms,
                        stagedMolecules,
                        unitCellAvailable,
                        unitCellVisible
                      }
                    )
                  ] })
                ] })
              ] })
            ] })
          ]
        }
      )
    }
  );
}

export {
  sameScientificTarget,
  validateViewerCommands,
  createViewerCommandExecutor,
  readGraphMoleculeViewerData,
  GraphMoleculeViewer
};
