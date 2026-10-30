import {
  cn
} from "./chunk-R24MQJGW.js";
import {
  translate,
  useI18n
} from "./chunk-S2ZDXRUN.js";

// src/components/shell/terminalClipboard.ts
async function copyText(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
  }
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  Object.assign(field.style, { position: "fixed", top: "0", left: "0", opacity: "0", pointerEvents: "none" });
  document.body.append(field);
  field.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  field.remove();
  active?.focus({ preventScroll: true });
  return copied;
}
async function readClipboardText() {
  try {
    if (!navigator.clipboard?.readText) return null;
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}
function isRiskyPaste(text, bracketed) {
  return !bracketed && /[\r\n]/.test(text.replace(/[\r\n]+$/, ""));
}
function pastedLineCount(text) {
  return text.replace(/[\r\n]+$/, "").split(/\r\n|\r|\n/).length;
}

// src/components/copy/CopyButton.tsx
import { useEffect, useRef, useState } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { jsx, jsxs } from "react/jsx-runtime";
function useCopy() {
  const [state, setState] = useState("idle");
  const timer = useRef(void 0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async (value) => {
    const ok = await copyText(value);
    setState(ok ? "copied" : "failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), ok ? 1500 : 3e3);
    return ok;
  };
  return { state, copy };
}
function CopyButton({ value, label, className, onCopied }) {
  useI18n();
  const { state, copy } = useCopy();
  const text = state === "copied" ? translate("common.copied") : state === "failed" ? translate("common.copyFailed") : label;
  return /* @__PURE__ */ jsxs(
    "button",
    {
      type: "button",
      className: `copy-button${className ? ` ${className}` : ""}`,
      "data-state": state,
      "aria-label": label,
      title: text,
      onClick: async (event) => {
        event.stopPropagation();
        if (await copy(typeof value === "function" ? value() : value)) onCopied?.();
      },
      children: [
        state === "copied" ? /* @__PURE__ */ jsx(Check, { "aria-hidden": "true" }) : state === "failed" ? /* @__PURE__ */ jsx(TriangleAlert, { "aria-hidden": "true" }) : /* @__PURE__ */ jsx(Copy, { "aria-hidden": "true" }),
        state === "failed" ? /* @__PURE__ */ jsx("span", { className: "copy-button-note", "aria-hidden": "true", children: text }) : null,
        /* @__PURE__ */ jsx("span", { className: "copy-button-status", role: "status", children: state === "idle" ? "" : text })
      ]
    }
  );
}

// src/components/copy/PathChip.tsx
import { useState as useState2 } from "react";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function splitPath(path) {
  const trimmed = path.replace(/[\\/]+$/, "");
  const cut = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return cut < 0 ? { head: "", tail: path } : { head: path.slice(0, cut + 1), tail: path.slice(cut + 1) };
}
function PathChip({ path, display, copyValue, label, className }) {
  useI18n();
  const [whole, setWhole] = useState2(false);
  const { head, tail } = splitPath(display ?? path);
  return /* @__PURE__ */ jsxs2("span", { className: `path-chip${whole ? " is-whole" : ""}${className ? ` ${className}` : ""}`, title: path, children: [
    /* @__PURE__ */ jsxs2(
      "button",
      {
        type: "button",
        className: "path-chip-text",
        "aria-expanded": whole,
        "aria-label": translate("common.pathShowWhole", { path }),
        onClick: () => setWhole((value) => !value),
        children: [
          head ? /* @__PURE__ */ jsx2("span", { className: "path-chip-head", children: head }) : null,
          /* @__PURE__ */ jsx2("span", { className: "path-chip-tail", children: tail })
        ]
      }
    ),
    /* @__PURE__ */ jsx2(CopyButton, { value: copyValue ?? path, label: label ?? translate("common.copyPath") })
  ] });
}

// src/components/menu/useMenuKeyboard.ts
import { useEffect as useEffect2, useRef as useRef2 } from "react";
function useMenuKeyboard(menuRef, open, onClose, itemSelector = '[role^="menuitem"]:not([disabled])') {
  const close = useRef2(onClose);
  close.current = onClose;
  useEffect2(() => {
    if (!open) return;
    const menu = menuRef.current;
    if (!menu) return;
    const items = () => [...menu.querySelectorAll(itemSelector)];
    items()[0]?.focus();
    const key = (event) => {
      const list = items();
      const index = list.indexOf(document.activeElement);
      const move = (to) => {
        event.preventDefault();
        list[(to + list.length) % list.length]?.focus();
      };
      if (event.key === "ArrowDown") move(index + 1);
      else if (event.key === "ArrowUp") move(index < 0 ? -1 : index - 1);
      else if (event.key === "Home") move(0);
      else if (event.key === "End") move(list.length - 1);
      else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close.current(true);
      } else if (event.key === "Tab") close.current(false);
    };
    menu.addEventListener("keydown", key);
    return () => menu.removeEventListener("keydown", key);
  }, [menuRef, open, itemSelector]);
}

// src/components/menu/useModalFocus.ts
import { useEffect as useEffect3, useRef as useRef3 } from "react";
var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
function useModalFocus(windowRef, open, onClose, initial) {
  const close = useRef3(onClose);
  close.current = onClose;
  useEffect3(() => {
    if (!open) return;
    const root = windowRef.current;
    if (!root) return;
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const visible = (element) => element.offsetParent !== null || element.getClientRects().length > 0;
    const focusables = () => [...root.querySelectorAll(FOCUSABLE)].filter(visible);
    const frame = requestAnimationFrame(() => {
      if (root.contains(document.activeElement)) return;
      (initial ? root.querySelector(initial) : null)?.focus() ?? focusables()[0]?.focus() ?? root.focus();
    });
    const key = (event) => {
      const active = document.activeElement;
      if (active && !root.contains(active) && active.closest('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
      if (event.key === "Escape" && close.current) {
        event.preventDefault();
        event.stopPropagation();
        close.current();
        return;
      }
      if (event.key !== "Tab") return;
      const list = focusables();
      if (!list.length) {
        event.preventDefault();
        return;
      }
      const first = list[0], last = list[list.length - 1];
      const inside = root.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", key, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", key, true);
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, [windowRef, open, initial]);
}

// src/components/menu/useLongPress.ts
import { useRef as useRef4 } from "react";
function useLongPress(onLongPress, delay = 500) {
  const timer = useRef4(void 0);
  const start = useRef4(null);
  const fired = useRef4(false);
  const cancel = () => {
    window.clearTimeout(timer.current);
    start.current = null;
  };
  return {
    onTouchStart(event) {
      const touch = event.touches[0];
      if (!touch || event.touches.length > 1) return;
      fired.current = false;
      start.current = { x: touch.clientX, y: touch.clientY };
      timer.current = window.setTimeout(() => {
        if (!start.current) return;
        fired.current = true;
        onLongPress(start.current);
      }, delay);
    },
    onTouchMove(event) {
      const touch = event.touches[0];
      if (start.current && touch && Math.hypot(touch.clientX - start.current.x, touch.clientY - start.current.y) > 10) cancel();
    },
    onTouchEnd: cancel,
    onTouchCancel: cancel,
    onClickCapture(event) {
      if (fired.current) {
        fired.current = false;
        event.preventDefault();
        event.stopPropagation();
      }
    }
  };
}

// src/components/ConfirmDialog.tsx
import { useRef as useRef5 } from "react";
import { createPortal } from "react-dom";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = translate("workbench.delete"),
  busyLabel = translate("workbench.deleting"),
  busy = false,
  error,
  onCancel,
  onConfirm,
  secondaryLabel,
  onSecondary,
  cancelLabel
}) {
  useI18n();
  const windowRef = useRef5(null);
  useModalFocus(windowRef, open, busy ? void 0 : onCancel, "[data-initial-focus]");
  if (!open) {
    return null;
  }
  return createPortal(
    /* @__PURE__ */ jsxs3("div", { className: "fixed inset-0 z-[95] flex items-end justify-center p-0 sm:items-center sm:p-6", children: [
      /* @__PURE__ */ jsx3(
        "button",
        {
          type: "button",
          "aria-label": translate("workbench.closeConfirmationDialog"),
          onClick: onCancel,
          disabled: busy,
          className: "absolute inset-0 bg-[var(--overlay-scrim)] backdrop-blur-sm disabled:cursor-not-allowed"
        }
      ),
      /* @__PURE__ */ jsxs3(
        "div",
        {
          ref: windowRef,
          role: "dialog",
          "aria-modal": "true",
          "aria-label": title,
          className: "relative z-[1] w-full max-w-md rounded-t-2xl border border-b-0 border-[var(--theme-border)] bg-[var(--theme-panel)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-[var(--theme-fg)] shadow-[var(--theme-shadow)] sm:rounded-xl sm:border-b sm:p-6",
          children: [
            /* @__PURE__ */ jsxs3("div", { className: "flex items-start justify-between gap-3", children: [
              /* @__PURE__ */ jsxs3("div", { className: "min-w-0 flex-1", children: [
                /* @__PURE__ */ jsx3("p", { className: "text-sm font-medium", children: title }),
                /* @__PURE__ */ jsx3("p", { className: "mt-2 text-sm leading-6 text-[var(--theme-fg-muted)]", children: description }),
                error ? /* @__PURE__ */ jsx3("p", { role: "alert", className: "mt-2 text-sm text-rose-500", children: error }) : null
              ] }),
              /* @__PURE__ */ jsx3(
                "button",
                {
                  type: "button",
                  "aria-label": translate("workbench.closeDialog"),
                  onClick: onCancel,
                  disabled: busy,
                  className: "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--theme-border)] text-[var(--theme-fg-muted)] transition hover:bg-[var(--theme-hover)] disabled:cursor-not-allowed disabled:opacity-60",
                  children: /* @__PURE__ */ jsx3("svg", { "aria-hidden": "true", viewBox: "0 0 16 16", className: "h-4 w-4 fill-current", children: /* @__PURE__ */ jsx3("path", { d: "M3.22 2.47 8 7.25l4.78-4.78 1.06 1.06L9.06 8.31l4.78 4.78-1.06 1.06L8 9.37l-4.78 4.78-1.06-1.06 4.78-4.78-4.78-4.78 1.06-1.06Z" }) })
                }
              )
            ] }),
            /* @__PURE__ */ jsxs3("div", { className: "mt-5 flex flex-wrap items-center justify-end gap-2", children: [
              /* @__PURE__ */ jsx3(
                "button",
                {
                  type: "button",
                  "data-initial-focus": "",
                  onClick: onCancel,
                  disabled: busy,
                  className: "min-h-10 rounded-md border border-[var(--theme-border)] px-4 py-2 text-sm font-medium text-[var(--theme-fg-soft)] transition hover:bg-[var(--theme-hover)] disabled:cursor-not-allowed disabled:opacity-60",
                  children: cancelLabel ?? translate("workbench.cancel")
                }
              ),
              secondaryLabel && onSecondary ? /* @__PURE__ */ jsx3(
                "button",
                {
                  type: "button",
                  onClick: () => void onSecondary(),
                  disabled: busy,
                  className: "min-h-10 rounded-md border border-[var(--theme-border)] px-4 py-2 text-sm font-medium text-[var(--theme-fg)] transition hover:bg-[var(--theme-hover)] disabled:cursor-not-allowed disabled:opacity-60",
                  children: secondaryLabel
                }
              ) : null,
              /* @__PURE__ */ jsx3(
                "button",
                {
                  type: "button",
                  onClick: () => void onConfirm(),
                  disabled: busy,
                  className: "ui-action-danger min-h-10 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed",
                  children: busy ? busyLabel : confirmLabel
                }
              )
            ] })
          ]
        }
      )
    ] }),
    document.body
  );
}

// src/components/menu/confirmAsync.tsx
import { createRoot } from "react-dom/client";
import { jsx as jsx4 } from "react/jsx-runtime";
function confirmAsync({ title, description, confirmLabel, cancelLabel }) {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const finish = (value) => {
      root.unmount();
      host.remove();
      resolve(value);
    };
    root.render(
      /* @__PURE__ */ jsx4(
        ConfirmDialog,
        {
          open: true,
          title,
          description,
          confirmLabel,
          ...cancelLabel ? { cancelLabel } : {},
          onCancel: () => finish(false),
          onConfirm: () => finish(true)
        }
      )
    );
  });
}

// src/components/graph-ui/Dialog.tsx
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
function Dialog({ ...props }) {
  const { locale: i18nLocale } = useI18n();
  return /* @__PURE__ */ jsx5(DialogPrimitive.Root, { "data-slot": "dialog", ...props });
}
function DialogTrigger({
  ...props
}) {
  const { locale: i18nLocale } = useI18n();
  return /* @__PURE__ */ jsx5(DialogPrimitive.Trigger, { "data-slot": "dialog-trigger", ...props });
}
function DialogPortal({
  ...props
}) {
  const { locale: i18nLocale } = useI18n();
  return /* @__PURE__ */ jsx5(DialogPrimitive.Portal, { "data-slot": "dialog-portal", ...props });
}
function DialogClose({
  ...props
}) {
  const { locale: i18nLocale } = useI18n();
  return /* @__PURE__ */ jsx5(DialogPrimitive.Close, { "data-slot": "dialog-close", ...props });
}
function DialogOverlay({
  className,
  ...props
}) {
  const { locale: i18nLocale } = useI18n();
  return /* @__PURE__ */ jsx5(
    DialogPrimitive.Overlay,
    {
      "data-slot": "dialog-overlay",
      className: cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      ),
      ...props
    }
  );
}
function DialogContent({
  children,
  className,
  showCloseButton = true,
  overlayClassName,
  ...props
}) {
  const { locale: i18nLocale } = useI18n();
  return /* @__PURE__ */ jsxs4(DialogPortal, { "data-slot": "dialog-portal", children: [
    /* @__PURE__ */ jsx5(DialogOverlay, { className: overlayClassName }),
    /* @__PURE__ */ jsxs4(
      DialogPrimitive.Content,
      {
        "data-slot": "dialog-content",
        className: cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
          className
        ),
        ...props,
        children: [
          children,
          showCloseButton ? /* @__PURE__ */ jsxs4(
            DialogPrimitive.Close,
            {
              "data-slot": "dialog-close",
              className: "absolute right-4 top-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
              children: [
                /* @__PURE__ */ jsx5(XIcon, { "data-icon": "close" }),
                /* @__PURE__ */ jsx5("span", { className: "sr-only", children: translate("workbench.close") })
              ]
            }
          ) : null
        ]
      }
    )
  ] });
}
function DialogHeader({ className, ...props }) {
  const { locale: i18nLocale } = useI18n();
  return /* @__PURE__ */ jsx5(
    "div",
    {
      "data-slot": "dialog-header",
      className: cn("flex flex-col gap-2 text-center sm:text-left", className),
      ...props
    }
  );
}
function DialogTitle({
  className,
  ...props
}) {
  const { locale: i18nLocale } = useI18n();
  return /* @__PURE__ */ jsx5(
    DialogPrimitive.Title,
    {
      "data-slot": "dialog-title",
      className: cn("text-lg font-semibold leading-none", className),
      ...props
    }
  );
}
function DialogDescription({
  className,
  ...props
}) {
  const { locale: i18nLocale } = useI18n();
  return /* @__PURE__ */ jsx5(
    DialogPrimitive.Description,
    {
      "data-slot": "dialog-description",
      className: cn("text-sm text-muted-foreground", className),
      ...props
    }
  );
}

// src/components/graph-workspace/explorer/workspaceDocuments.ts
var storeKey = /* @__PURE__ */ Symbol.for("remote-codex.workspace-documents");
var documentGlobal = globalThis;
var memory = documentGlobal[storeKey] ??= {
  stores: /* @__PURE__ */ new Map(),
  listeners: /* @__PURE__ */ new Set()
};
var documentStores = memory.stores;
var documentListeners = memory.listeners;
if (typeof window !== "undefined" && !memory.unloadInstalled) {
  memory.unloadInstalled = true;
  window.addEventListener("beforeunload", (event) => {
    if ([...documentStores.values()].some(
      (store) => [...store.values()].some(isProtected)
    )) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
}
function isProtected(doc) {
  return doc.content !== doc.baseContent || ["saving", "unknown", "conflict"].includes(doc.phase);
}
function newDraft(key, snapshot) {
  return {
    key,
    snapshot,
    content: snapshot.content ?? "",
    baseContent: snapshot.content ?? "",
    revision: 0,
    editing: false,
    phase: "clean",
    error: null
  };
}
function editDraft(doc, content) {
  return {
    ...doc,
    content,
    revision: doc.revision + 1,
    phase: ["saving", "conflict", "unknown"].includes(doc.phase) ? doc.phase : content === doc.baseContent ? "clean" : "dirty"
  };
}
function settleSave(doc, receipt) {
  const submitted = doc.submitted;
  if (!submitted || submitted.operationId !== receipt.operationId || submitted.revision !== receipt.draftRevision)
    return doc;
  if (receipt.status === "saved" && receipt.contentHash && receipt.fileIdentity) {
    return {
      ...doc,
      baseContent: submitted.content,
      snapshot: {
        ...doc.snapshot,
        content: submitted.content,
        contentHash: receipt.contentHash,
        fileIdentity: receipt.fileIdentity,
        size: receipt.size ?? doc.snapshot.size,
        workspaceRevision: receipt.workspaceRevision ?? doc.snapshot.workspaceRevision,
        encoding: receipt.encoding ?? doc.snapshot.encoding,
        bom: receipt.bom ?? doc.snapshot.bom,
        eol: receipt.eol ?? doc.snapshot.eol
      },
      phase: doc.content === submitted.content ? "clean" : "dirty",
      submitted: void 0,
      conflict: void 0,
      needsVerification: false,
      operationPending: false,
      error: null
    };
  }
  if (receipt.status === "conflict")
    return {
      ...doc,
      phase: "conflict",
      conflict: receipt.snapshot,
      conflictFrom: "save",
      submitted: void 0,
      error: receipt.snapshot ? null : translate("files.safeMissing")
    };
  if (receipt.status === "failedBeforeWrite")
    return {
      ...doc,
      phase: "error",
      submitted: void 0,
      snapshot: receipt.code === "forbidden" ? { ...doc.snapshot, readOnlyReason: "permissionDenied" } : doc.snapshot,
      error: receipt.message ?? translate("files.failedToSaveFile")
    };
  return {
    ...doc,
    phase: "unknown",
    operationPending: receipt.status === "pending",
    error: translate(
      receipt.status === "pending" ? "files.safeWaitBeforeLeave" : "files.safeUnknown"
    )
  };
}
function confirmWorkspaceDocumentLeave() {
  const protectedDocs = [...documentStores.values()].flatMap((store) => [...store.values()]).filter(isProtected);
  if (!protectedDocs.length) return true;
  if (protectedDocs.some(
    (doc) => doc.phase === "saving" || doc.phase === "unknown"
  )) {
    window.alert(translate("files.safeWaitBeforeLeave"));
    return false;
  }
  if (!window.confirm(translate("files.safeLeave"))) return false;
  for (const store of documentStores.values())
    for (const [path, doc] of store)
      if (isProtected(doc)) {
        store.delete(path);
        window.dispatchEvent(
          new CustomEvent("workspace-model-release", { detail: doc.key })
        );
      }
  for (const listener of documentListeners) listener();
  return true;
}
function downloadDraft(doc, disk = false) {
  const content = disk ? doc.conflict?.content : doc.content;
  if (content == null) return;
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/plain;charset=utf-8" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.snapshot.name}.${disk ? "disk-snapshot" : "draft"}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// src/components/RenameDialog.tsx
import { useRef as useRef6 } from "react";
import { createPortal as createPortal2 } from "react-dom";
import { jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
function RenameDialog({
  open,
  title,
  label,
  value,
  busy = false,
  error,
  description,
  submitLabel,
  onChange,
  onCancel,
  onSubmit
}) {
  useI18n();
  const windowRef = useRef6(null);
  useModalFocus(windowRef, open, busy ? void 0 : onCancel, "input");
  if (!open) {
    return null;
  }
  function handleSubmit(event) {
    event.preventDefault();
    void onSubmit();
  }
  return createPortal2(
    /* @__PURE__ */ jsxs5("div", { className: "fixed inset-0 z-[95] flex items-end justify-center p-0 sm:items-center sm:p-6", children: [
      /* @__PURE__ */ jsx6(
        "button",
        {
          type: "button",
          "aria-label": translate("workbench.closeRenameDialog"),
          onClick: onCancel,
          disabled: busy,
          className: "absolute inset-0 bg-[var(--overlay-scrim)] backdrop-blur-sm disabled:cursor-not-allowed"
        }
      ),
      /* @__PURE__ */ jsxs5(
        "form",
        {
          ref: windowRef,
          role: "dialog",
          "aria-modal": "true",
          "aria-label": title,
          onSubmit: handleSubmit,
          onKeyDown: (event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              if (!busy) onCancel();
            }
          },
          className: "relative z-[1] w-full max-w-md rounded-t-2xl border border-b-0 border-[var(--theme-border)] bg-[var(--theme-panel)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-[var(--theme-fg)] shadow-[var(--theme-shadow)] sm:rounded-xl sm:border-b sm:p-6",
          children: [
            /* @__PURE__ */ jsxs5("div", { className: "flex items-start justify-between gap-3", children: [
              /* @__PURE__ */ jsxs5("div", { className: "min-w-0 flex-1", children: [
                /* @__PURE__ */ jsx6("p", { className: "text-sm font-medium", children: title }),
                /* @__PURE__ */ jsx6("p", { className: "mt-1 text-sm text-[var(--theme-fg-muted)]", children: description ?? translate("workbench.changesAreSavedOnlyAfterConfirmation") })
              ] }),
              /* @__PURE__ */ jsx6(
                "button",
                {
                  type: "button",
                  "aria-label": translate("workbench.closeDialog"),
                  onClick: onCancel,
                  disabled: busy,
                  className: "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--theme-border)] text-[var(--theme-fg-muted)] transition hover:bg-[var(--theme-hover)] disabled:cursor-not-allowed disabled:opacity-60",
                  children: /* @__PURE__ */ jsx6("svg", { "aria-hidden": "true", viewBox: "0 0 16 16", className: "h-4 w-4 fill-current", children: /* @__PURE__ */ jsx6("path", { d: "M3.22 2.47 8 7.25l4.78-4.78 1.06 1.06L9.06 8.31l4.78 4.78-1.06 1.06L8 9.37l-4.78 4.78-1.06-1.06 4.78-4.78-4.78-4.78 1.06-1.06Z" }) })
                }
              )
            ] }),
            /* @__PURE__ */ jsxs5("div", { className: "mt-5", children: [
              /* @__PURE__ */ jsx6("label", { htmlFor: "rename-dialog-input", className: "text-sm font-medium", children: label }),
              /* @__PURE__ */ jsx6(
                "input",
                {
                  id: "rename-dialog-input",
                  "aria-label": label,
                  autoFocus: true,
                  value,
                  onChange: (event) => onChange(event.target.value),
                  className: "mt-2 w-full rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 py-3 text-[var(--theme-fg)] outline-none transition focus:border-[var(--theme-accent-solid)]"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs5("div", { className: "mt-5 flex items-center justify-end gap-2", children: [
              error ? /* @__PURE__ */ jsx6("p", { role: "alert", className: "text-sm text-rose-500", children: error }) : null,
              /* @__PURE__ */ jsx6(
                "button",
                {
                  type: "button",
                  onClick: onCancel,
                  disabled: busy,
                  className: "rounded-md border border-[var(--theme-border)] px-4 py-2 text-sm font-medium text-[var(--theme-fg-soft)] transition hover:bg-[var(--theme-hover)] disabled:cursor-not-allowed disabled:opacity-60",
                  children: translate("workbench.cancel")
                }
              ),
              /* @__PURE__ */ jsx6(
                "button",
                {
                  type: "submit",
                  disabled: busy || !value.trim(),
                  className: "ui-action-success rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed",
                  children: submitLabel ?? translate("workbench.save")
                }
              )
            ] })
          ]
        }
      )
    ] }),
    document.body
  );
}

// src/components/useTabScrollEdges.ts
import { useLayoutEffect, useState as useState3 } from "react";
function useTabScrollEdges(ref) {
  const [edges, setEdges] = useState3({ start: false, end: false });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const start = element.scrollLeft > 2;
      const end = element.scrollWidth - element.clientWidth - element.scrollLeft > 2;
      setEdges((current) => current.start === start && current.end === end ? current : { start, end });
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    resize?.observe(element);
    const mutation = new MutationObserver(update);
    mutation.observe(element, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", update);
    return () => {
      element.removeEventListener("scroll", update);
      resize?.disconnect();
      mutation.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [ref]);
  return { "data-overflow-start": edges.start, "data-overflow-end": edges.end };
}

// src/components/TabScrollButtons.tsx
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Fragment, jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
function TabScrollButtons({ targetRef, edges }) {
  useI18n();
  const page = (direction) => {
    const strip = targetRef.current;
    if (!strip) return;
    const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    strip.scrollBy({ left: direction * Math.max(80, strip.clientWidth * 0.8), behavior: smooth ? "smooth" : "auto" });
  };
  return /* @__PURE__ */ jsxs6(Fragment, { children: [
    edges["data-overflow-start"] ? /* @__PURE__ */ jsx7(
      "button",
      {
        type: "button",
        className: "tab-scroll-button",
        "data-edge": "start",
        tabIndex: -1,
        "aria-label": translate("workbench.scrollTabsBack"),
        title: translate("workbench.scrollTabsBack"),
        onClick: () => page(-1),
        children: /* @__PURE__ */ jsx7(ChevronLeft, { "aria-hidden": "true" })
      }
    ) : null,
    edges["data-overflow-end"] ? /* @__PURE__ */ jsx7(
      "button",
      {
        type: "button",
        className: "tab-scroll-button",
        "data-edge": "end",
        tabIndex: -1,
        "aria-label": translate("workbench.scrollTabsForward"),
        title: translate("workbench.scrollTabsForward"),
        onClick: () => page(1),
        children: /* @__PURE__ */ jsx7(ChevronRight, { "aria-hidden": "true" })
      }
    ) : null
  ] });
}

// src/components/graph-workspace/GraphResizablePanels.tsx
import { GripVerticalIcon } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";
import { jsx as jsx8 } from "react/jsx-runtime";
function classNames(...values) {
  return values.filter(Boolean).join(" ");
}
function ResizablePanelGroup({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx8(
    ResizablePrimitive.PanelGroup,
    {
      "data-slot": "resizable-panel-group",
      className: classNames(
        "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
        className
      ),
      ...props
    }
  );
}
function ResizablePanel({
  ...props
}) {
  return /* @__PURE__ */ jsx8(ResizablePrimitive.Panel, { "data-slot": "resizable-panel", ...props });
}
function ResizableHandle({
  withHandle,
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx8(
    ResizablePrimitive.PanelResizeHandle,
    {
      "data-slot": "resizable-handle",
      className: classNames(
        "bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2 [&[data-panel-group-direction=vertical]>div]:rotate-90",
        className
      ),
      ...props,
      children: withHandle ? /* @__PURE__ */ jsx8("div", { className: "bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border", children: /* @__PURE__ */ jsx8(GripVerticalIcon, { className: "size-2.5" }) }) : null
    }
  );
}

// src/components/ZoomableImage.tsx
import { createContext, useContext, useEffect as useEffect4, useRef as useRef8, useState as useState5 } from "react";
import { createPortal as createPortal3 } from "react-dom";

// src/components/useImageViewport.ts
import { useRef as useRef7, useState as useState4 } from "react";
var MIN_SCALE = 0.5;
var MAX_SCALE = 5;
var clamp = (scale) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
function useImageViewport() {
  const viewportRef = useRef7(null);
  const [view, setView] = useState4({ x: 0, y: 0, scale: 1 });
  const current = useRef7(view);
  const pointers = useRef7(/* @__PURE__ */ new Map());
  const baseline = useRef7(null);
  const moved = useRef7(false);
  const [dragging, setDragging] = useState4(false);
  const commit = (next) => {
    current.current = next;
    setView(next);
  };
  function centerAndDistance() {
    const points = [...pointers.current.values()].slice(0, 2);
    const a = points[0];
    if (!a) return null;
    const b = points[1] ?? a;
    return { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(a.x - b.x, a.y - b.y) };
  }
  function restartGesture() {
    const points = centerAndDistance();
    baseline.current = points ? { ...points, view: current.current } : null;
    setDragging(pointers.current.size > 0);
  }
  function local(point) {
    const element = viewportRef.current;
    if (!element) return point;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      x: point.x - rect.left - (rect.width + parseFloat(style.paddingLeft || "0") - parseFloat(style.paddingRight || "0")) / 2,
      y: point.y - rect.top - (rect.height + parseFloat(style.paddingTop || "0") - parseFloat(style.paddingBottom || "0")) / 2
    };
  }
  function updateScale(scale, clientX, clientY) {
    const old = current.current;
    const next = clamp(scale);
    const anchor = clientX === void 0 || clientY === void 0 ? { x: 0, y: 0 } : local({ x: clientX, y: clientY });
    const ratio = next / old.scale;
    commit({ scale: next, x: anchor.x - (anchor.x - old.x) * ratio, y: anchor.y - (anchor.y - old.y) * ratio });
  }
  function onPointerDown(event) {
    if (event.button !== 0) return;
    if (pointers.current.size === 0) moved.current = false;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    restartGesture();
  }
  function onPointerMove(event) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const base = baseline.current;
    const points = centerAndDistance();
    if (!base || !points) return;
    const dx = points.center.x - base.center.x;
    const dy = points.center.y - base.center.y;
    if (Math.hypot(dx, dy) > 3 || Math.abs(points.distance - base.distance) > 3) moved.current = true;
    if (pointers.current.size >= 2 && base.distance > 0) {
      const scale = clamp(base.view.scale * points.distance / base.distance);
      const ratio = scale / base.view.scale;
      const start = local(base.center);
      const end = local(points.center);
      commit({ scale, x: end.x - (start.x - base.view.x) * ratio, y: end.y - (start.y - base.view.y) * ratio });
    } else if (base.view.scale > 1) {
      commit({ ...base.view, x: base.view.x + dx, y: base.view.y + dy });
    }
  }
  function onPointerEnd(event) {
    if (!pointers.current.delete(event.pointerId)) return;
    restartGesture();
  }
  return {
    viewportRef,
    scale: view.scale,
    dragging,
    moved,
    transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
    reset: () => {
      commit({ x: 0, y: 0, scale: 1 });
      restartGesture();
    },
    updateScale,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onLostPointerCapture: onPointerEnd,
      onWheel: (event) => {
        event.preventDefault();
        updateScale(current.current.scale + (event.deltaY < 0 ? 0.25 : -0.25), event.clientX, event.clientY);
      }
    }
  };
}

// src/components/ZoomableImage.tsx
import { Maximize2, Minus, Plus, RotateCcw, X } from "lucide-react";
import { Fragment as Fragment2, jsx as jsx9, jsxs as jsxs7 } from "react/jsx-runtime";
var MarkdownImageLinkContext = createContext(false);
var IMAGE_LIGHTBOX_MIN_SCALE = 0.5;
var IMAGE_LIGHTBOX_MAX_SCALE = 5;
var IMAGE_LIGHTBOX_SCALE_STEP = 0.25;
function GraphWorkspaceImageLightbox({
  alt,
  backgroundColor,
  onClose,
  src
}) {
  const { locale: i18nLocale } = useI18n();
  const { viewportRef, scale, dragging, transform, reset: resetView, updateScale, handlers, moved } = useImageViewport();
  const closeButtonRef = useRef8(null);
  const backdropPointer = useRef8(true);
  const windowRef = useRef8(null);
  useModalFocus(windowRef, true, onClose, ".thread-graph-image-lightbox-close");
  useEffect4(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  return createPortal3(
    /* @__PURE__ */ jsxs7(
      "div",
      {
        ref: windowRef,
        className: "thread-graph-image-lightbox",
        style: backgroundColor ? { backgroundColor } : void 0,
        role: "dialog",
        "aria-modal": "true",
        "aria-label": translate("files.imagePreview", { value1: alt || translate("files.workspaceImage") }),
        children: [
          /* @__PURE__ */ jsxs7(
            "div",
            {
              className: "thread-graph-image-lightbox-toolbar",
              role: "toolbar",
              "aria-label": translate("files.imageZoomControls"),
              children: [
                /* @__PURE__ */ jsx9(
                  "button",
                  {
                    type: "button",
                    onClick: () => updateScale(scale - IMAGE_LIGHTBOX_SCALE_STEP),
                    disabled: scale <= IMAGE_LIGHTBOX_MIN_SCALE,
                    title: translate("files.zoomOut"),
                    "aria-label": translate("files.zoomOut"),
                    children: /* @__PURE__ */ jsx9(Minus, { className: "h-4 w-4" })
                  }
                ),
                /* @__PURE__ */ jsxs7(
                  "button",
                  {
                    type: "button",
                    onClick: resetView,
                    className: "thread-graph-image-lightbox-scale",
                    title: translate("files.resetZoom"),
                    "aria-label": translate("files.resetZoomCurrently", { value1: Math.round(scale * 100) }),
                    children: [
                      /* @__PURE__ */ jsx9(RotateCcw, { className: "h-3.5 w-3.5" }),
                      /* @__PURE__ */ jsxs7("span", { children: [
                        Math.round(scale * 100),
                        "%"
                      ] })
                    ]
                  }
                ),
                /* @__PURE__ */ jsx9(
                  "button",
                  {
                    type: "button",
                    onClick: () => updateScale(scale + IMAGE_LIGHTBOX_SCALE_STEP),
                    disabled: scale >= IMAGE_LIGHTBOX_MAX_SCALE,
                    title: translate("files.zoomIn"),
                    "aria-label": translate("files.zoomIn"),
                    children: /* @__PURE__ */ jsx9(Plus, { className: "h-4 w-4" })
                  }
                ),
                /* @__PURE__ */ jsx9(
                  "span",
                  {
                    className: "thread-graph-image-lightbox-divider",
                    "aria-hidden": "true"
                  }
                ),
                /* @__PURE__ */ jsx9(
                  "button",
                  {
                    ref: closeButtonRef,
                    type: "button",
                    onClick: onClose,
                    title: translate("files.closeImagePreview"),
                    "aria-label": translate("files.closeImagePreview"),
                    children: /* @__PURE__ */ jsx9(X, { className: "h-4 w-4" })
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ jsx9(
            "div",
            {
              ref: viewportRef,
              className: "thread-graph-image-lightbox-viewport",
              onClick: (event) => {
                if (event.target === event.currentTarget && backdropPointer.current && !moved.current) {
                  onClose();
                }
              },
              ...handlers,
              onPointerDown: (event) => {
                backdropPointer.current = event.target === event.currentTarget;
                handlers.onPointerDown(event);
              },
              children: /* @__PURE__ */ jsx9(
                "img",
                {
                  src,
                  alt,
                  draggable: false,
                  className: dragging ? "is-dragging" : "",
                  style: {
                    transform
                  }
                }
              )
            }
          )
        ]
      }
    ),
    document.body
  );
}
function ZoomableImage({
  alt,
  className,
  fullSrc,
  loading,
  src,
  width,
  height
}) {
  const { locale: i18nLocale } = useI18n();
  const triggerRef = useRef8(null);
  const [open, setOpen] = useState5(false);
  const insideLink = useContext(MarkdownImageLinkContext);
  const dimension = (value) => typeof value === "number" ? value : value && /^\d+(?:\.\d+)?%?$/.test(value) ? value.endsWith("%") ? value : Number(value) : void 0;
  const imageStyle = { width: dimension(width), height: dimension(height) };
  const image = /* @__PURE__ */ jsx9("img", { src, alt, className, loading, style: imageStyle });
  function closeLightbox() {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }
  if (insideLink) return image;
  return /* @__PURE__ */ jsxs7(Fragment2, { children: [
    /* @__PURE__ */ jsx9(
      "button",
      {
        ref: triggerRef,
        type: "button",
        className: "thread-graph-zoomable-image-trigger",
        style: { width: dimension(width) },
        onClick: () => setOpen(true),
        title: translate("files.openImagePreview"),
        "aria-label": translate("files.openImagePreview_bdac35", { value1: alt || translate("files.workspaceImage") }),
        children: image
      }
    ),
    open ? /* @__PURE__ */ jsx9(
      GraphWorkspaceImageLightbox,
      {
        src: fullSrc || src,
        alt,
        onClose: closeLightbox
      }
    ) : null
  ] });
}
function WorkspaceImagePreview({ src, alt }) {
  useI18n();
  const { viewportRef, scale, dragging, transform, reset, updateScale, handlers } = useImageViewport();
  const [open, setOpen] = useState5(false);
  return /* @__PURE__ */ jsxs7("div", { className: "workspace-image-preview", children: [
    /* @__PURE__ */ jsxs7("div", { className: "workspace-image-controls", role: "toolbar", "aria-label": translate("files.imageZoomControls"), children: [
      /* @__PURE__ */ jsx9("button", { type: "button", onClick: () => updateScale(scale - 0.25), disabled: scale <= IMAGE_LIGHTBOX_MIN_SCALE, "aria-label": translate("files.zoomOut"), children: /* @__PURE__ */ jsx9(Minus, { size: 14 }) }),
      /* @__PURE__ */ jsx9("button", { type: "button", onClick: reset, "aria-label": translate("files.resetZoom"), children: /* @__PURE__ */ jsxs7("span", { children: [
        Math.round(scale * 100),
        "%"
      ] }) }),
      /* @__PURE__ */ jsx9("button", { type: "button", onClick: () => updateScale(scale + 0.25), disabled: scale >= IMAGE_LIGHTBOX_MAX_SCALE, "aria-label": translate("files.zoomIn"), children: /* @__PURE__ */ jsx9(Plus, { size: 14 }) }),
      /* @__PURE__ */ jsx9("button", { type: "button", onClick: () => setOpen(true), "aria-label": translate("files.openImagePreview"), children: /* @__PURE__ */ jsx9(Maximize2, { size: 14 }) })
    ] }),
    /* @__PURE__ */ jsx9("div", { ref: viewportRef, className: "workspace-image-viewport", ...handlers, children: /* @__PURE__ */ jsx9("img", { src, alt, draggable: false, className: dragging ? "is-dragging" : "", style: { transform } }) }),
    open && /* @__PURE__ */ jsx9(GraphWorkspaceImageLightbox, { src, alt, onClose: () => setOpen(false) })
  ] });
}

// src/components/workbench/FilePanelContext.tsx
import { createContext as createContext2, useContext as useContext2 } from "react";
var FilePanelContext = createContext2(null);
var useFilePanel = () => useContext2(FilePanelContext);

// src/components/graph-chat/graphChatShiki.ts
var CSS_VARIABLES_SYNTAX_THEME = "pockymoe-css-variables";
function syntaxThemeFor(dark, cssPalette) {
  if (cssPalette) return CSS_VARIABLES_SYNTAX_THEME;
  return dark ? "ayu-dark" : "github-light-default";
}
var graphChatHighlighterPromise = null;
function getGraphChatHighlighter() {
  graphChatHighlighterPromise ??= Promise.all([
    import("shiki/core"),
    import("shiki/engine/javascript"),
    import("shiki/themes/github-light-default.mjs"),
    import("shiki/themes/ayu-dark.mjs"),
    import("shiki/langs/javascript.mjs"),
    import("shiki/langs/typescript.mjs"),
    import("shiki/langs/tsx.mjs"),
    import("shiki/langs/jsx.mjs"),
    import("shiki/langs/python.mjs"),
    import("shiki/langs/json.mjs"),
    import("shiki/langs/bash.mjs"),
    import("shiki/langs/shellscript.mjs"),
    import("shiki/langs/yaml.mjs"),
    import("shiki/langs/toml.mjs"),
    import("shiki/langs/markdown.mjs"),
    import("shiki/langs/html.mjs"),
    import("shiki/langs/css.mjs"),
    import("shiki/langs/sql.mjs"),
    import("shiki/langs/csv.mjs"),
    import("shiki/langs/ruby.mjs"),
    import("shiki/langs/rust.mjs"),
    import("shiki/langs/go.mjs"),
    import("shiki/langs/java.mjs"),
    import("shiki/langs/c.mjs"),
    import("shiki/langs/cpp.mjs"),
    import("shiki/langs/csharp.mjs"),
    import("shiki/langs/xml.mjs")
  ]).then(
    ([
      { createHighlighterCore, createCssVariablesTheme },
      { createJavaScriptRegexEngine },
      ayuLight,
      ayuDark,
      javascript,
      typescript,
      tsx,
      jsx11,
      python,
      json,
      bash,
      shellscript,
      yaml,
      toml,
      markdown,
      html,
      css,
      sql,
      csv,
      ruby,
      rust,
      go,
      java,
      c,
      cpp,
      csharp,
      xml
    ]) => createHighlighterCore({
      engine: createJavaScriptRegexEngine(),
      themes: [
        ayuLight.default,
        ayuDark.default,
        createCssVariablesTheme({ name: CSS_VARIABLES_SYNTAX_THEME, variablePrefix: "--shiki-", fontStyle: true })
      ],
      langs: [
        javascript.default,
        typescript.default,
        tsx.default,
        jsx11.default,
        python.default,
        json.default,
        bash.default,
        shellscript.default,
        yaml.default,
        toml.default,
        markdown.default,
        html.default,
        css.default,
        sql.default,
        csv.default,
        ruby.default,
        rust.default,
        go.default,
        java.default,
        c.default,
        cpp.default,
        csharp.default,
        xml.default
      ]
    })
  );
  return graphChatHighlighterPromise;
}

// src/components/externalLinkProps.ts
function externalLinkProps(href) {
  if (!href) return {};
  try {
    const origin = typeof window === "undefined" ? void 0 : window.location.origin;
    const url = new URL(href, origin);
    if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== origin) {
      return { target: "_blank", rel: "noopener noreferrer" };
    }
  } catch {
  }
  return {};
}

// src/components/markdownHtml.ts
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
var schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []).filter((attribute) => attribute !== "align"), ["align", "left", "center", "right"]],
    code: [["className", /^language-./, "math-inline", "math-display"]],
    details: [...defaultSchema.attributes?.details ?? [], "open"]
  },
  strip: [...defaultSchema.strip ?? [], "style", "iframe", "object", "embed"],
  protocols: {
    ...defaultSchema.protocols,
    // Preserve adapter links and Windows drive paths; the URL transform still
    // rejects non-file drive schemes before any browser anchor is created.
    href: [...defaultSchema.protocols?.href ?? [], "file", "workspace-auto", ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"]
  }
};
var markdownHtmlPlugins = [rehypeRaw, [rehypeSanitize, schema]];

// src/components/WorkspaceFileLink.tsx
import { useEffect as useEffect5, useRef as useRef9, useState as useState6 } from "react";
import { createPortal as createPortal4 } from "react-dom";
import { Check as Check2, TriangleAlert as TriangleAlert2 } from "lucide-react";
import { Fragment as Fragment3, jsx as jsx10, jsxs as jsxs8 } from "react/jsx-runtime";
function WorkspaceFileLink({ path, line, children, onOpen, className = "thread-inline-link" }) {
  useI18n();
  const [menu, setMenu] = useState6(null);
  const [copy, setCopy] = useState6(null);
  const menuRef = useRef9(null);
  const linkRef = useRef9(null);
  const displayPath = path.startsWith("/") || /^[a-z]:/i.test(path) ? path : `./${path.replace(/^\.\//, "")}`;
  const copyValue = path.replace(/^\.\//, "") + (line ? `:${line}` : "");
  const close = (restoreFocus) => {
    setMenu(null);
    setCopy(null);
    if (restoreFocus) linkRef.current?.focus();
  };
  useMenuKeyboard(menuRef, Boolean(menu), close);
  useEffect5(() => {
    if (!menu) return;
    const dismiss = (event) => {
      if (!menuRef.current?.contains(event.target)) close(false);
    };
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [menu]);
  const show = (x, y) => {
    setCopy(null);
    setMenu({ x: Math.min(x, window.innerWidth - 190), y: Math.min(y, window.innerHeight - 100) });
  };
  const press = useLongPress(({ x, y }) => show(x, y));
  const open = () => {
    setMenu(null);
    onOpen({ path, ...line ? { line } : {} });
  };
  return /* @__PURE__ */ jsxs8(Fragment3, { children: [
    /* @__PURE__ */ jsx10(
      "a",
      {
        ref: linkRef,
        "data-file-link": "",
        href: displayPath.split("/").map(encodeURIComponent).join("/") + (line ? `#L${line}` : ""),
        title: copyValue,
        className,
        ...press,
        onClick: (event) => {
          event.preventDefault();
          open();
        },
        onContextMenu: (event) => {
          event.preventDefault();
          show(event.clientX, event.clientY);
        },
        children
      }
    ),
    menu && createPortal4(/* @__PURE__ */ jsxs8("div", { ref: menuRef, role: "menu", "aria-label": translate("files.fileLink"), className: "thread-workspace-link-menu", style: { left: Math.max(8, menu.x), top: Math.max(8, menu.y) }, children: [
      /* @__PURE__ */ jsx10("button", { type: "button", role: "menuitem", onClick: open, children: translate("files.openFile") }),
      /* @__PURE__ */ jsxs8("button", { type: "button", role: "menuitem", "data-copy-state": copy ?? void 0, onClick: async () => {
        const ok = await copyText(copyValue);
        setCopy(ok ? "copied" : "failed");
        if (ok) window.setTimeout(() => close(true), 700);
      }, children: [
        copy === "copied" ? /* @__PURE__ */ jsx10(Check2, { "aria-hidden": "true" }) : copy === "failed" ? /* @__PURE__ */ jsx10(TriangleAlert2, { "aria-hidden": "true" }) : null,
        copy === "copied" ? translate("common.copied") : copy === "failed" ? translate("common.copyFailed") : translate("common.copyPath")
      ] }),
      /* @__PURE__ */ jsx10("span", { className: "copy-button-status", role: "status", children: copy === "copied" ? translate("common.copied") : copy === "failed" ? translate("common.copyFailed") : "" })
    ] }), linkRef.current?.closest(".thread-ui-shell") ?? document.body)
  ] });
}

export {
  copyText,
  readClipboardText,
  isRiskyPaste,
  pastedLineCount,
  useCopy,
  CopyButton,
  splitPath,
  PathChip,
  useMenuKeyboard,
  useModalFocus,
  useLongPress,
  ConfirmDialog,
  confirmAsync,
  MarkdownImageLinkContext,
  GraphWorkspaceImageLightbox,
  ZoomableImage,
  WorkspaceImagePreview,
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  RenameDialog,
  FilePanelContext,
  useFilePanel,
  useTabScrollEdges,
  TabScrollButtons,
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
  syntaxThemeFor,
  getGraphChatHighlighter,
  externalLinkProps,
  markdownHtmlPlugins,
  WorkspaceFileLink,
  documentStores,
  documentListeners,
  isProtected,
  newDraft,
  editDraft,
  settleSave,
  confirmWorkspaceDocumentLeave,
  downloadDraft
};
