import {
  setTerminalPreferences,
  useTerminalPreferences
} from "./chunk-5NGPD4NR.js";
import {
  formatNumber,
  translate,
  useI18n
} from "./chunk-S2ZDXRUN.js";

// src/plugins/builtin-plugin-modules.tsx
import { terminalPluginManifest } from "@remote-codex/plugin-terminal";

// src/plugins/deepseek-harness-plugin.ts
var DEEPSEEK_HARNESS_PLUGIN_ID = "remote-codex.deepseek-harness";
var DEEPSEEK_HARNESS_PANEL_KIND = "harness:deepseek";
var deepseekHarnessPlugin = {
  manifest: {
    id: DEEPSEEK_HARNESS_PLUGIN_ID,
    name: "DeepSeek Harness",
    version: "0.1.0",
    get description() {
      return translate("workbench.deepseekHarnessPluginDescription");
    },
    remoteCodex: ">=0.12.0",
    capabilities: {
      artifactTypes: [],
      timelineRenderers: [],
      threadPanels: [
        { id: "deepseek-harness", label: "DeepSeek Harness", kind: DEEPSEEK_HARNESS_PANEL_KIND, artifactTypes: [] }
      ]
    }
  },
  threadPanels: [
    {
      id: "deepseek-harness",
      kind: DEEPSEEK_HARNESS_PANEL_KIND,
      get label() {
        return translate("workbench.deepseekHarness");
      }
    }
  ]
};

// src/plugins/ContentQualitySettings.tsx
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState
} from "react";
import { jsx, jsxs } from "react/jsx-runtime";
var connectionProtocols = [
  "openai_chat",
  "openai_responses",
  "anthropic",
  "gemini"
];
var presets = [
  "concise",
  "clear",
  "technical",
  "beginner",
  "copyedit"
];
var details = ["short", "balanced", "detailed"];
var contextLimits = {
  replyContextTurns: { min: 1, max: 1e3 },
  replyContextMaxChars: { min: 1, max: 1e7 }
};
var defaults = {
  connectionId: "",
  connectionFile: "",
  model: "",
  language: "zh-CN",
  preset: "clear",
  detail: "balanced",
  readerBackground: "",
  minReplyChars: 800,
  replyContextTurns: 5,
  replyContextMaxChars: 1e4,
  autoReplies: true,
  autoDocuments: false,
  documentMode: "review"
};
function readValues(snapshot) {
  if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0 || !snapshot.values || typeof snapshot.values !== "object" || Array.isArray(snapshot.values)) {
    throw new Error("Invalid plugin settings snapshot");
  }
  const values = { ...defaults };
  for (const key of [
    "connectionId",
    "connectionFile",
    "model",
    "language",
    "readerBackground"
  ]) {
    if (typeof snapshot.values[key] === "string")
      values[key] = snapshot.values[key];
  }
  if (presets.includes(snapshot.values.preset))
    values.preset = snapshot.values.preset;
  if (details.includes(snapshot.values.detail))
    values.detail = snapshot.values.detail;
  if (typeof snapshot.values.autoReplies === "boolean")
    values.autoReplies = snapshot.values.autoReplies;
  if (typeof snapshot.values.autoDocuments === "boolean")
    values.autoDocuments = snapshot.values.autoDocuments;
  if (typeof snapshot.values.minReplyChars === "number" && Number.isSafeInteger(snapshot.values.minReplyChars) && snapshot.values.minReplyChars >= 0)
    values.minReplyChars = snapshot.values.minReplyChars;
  for (const key of ["replyContextTurns", "replyContextMaxChars"]) {
    const value = snapshot.values[key];
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= contextLimits[key].min && value <= contextLimits[key].max)
      values[key] = value;
  }
  if (snapshot.values.documentMode === "review" || snapshot.values.documentMode === "rewrite")
    values.documentMode = snapshot.values.documentMode;
  return values;
}
function isConflict(error) {
  if (!error || typeof error !== "object") return false;
  return "statusCode" in error && error.statusCode === 409 || "status" in error && error.status === 409;
}
function contextLimitsSupport(plugin) {
  if (!plugin) return void 0;
  const flagged = (value) => Boolean(value) && typeof value === "object" && value.replyContextLimits === true;
  return flagged(plugin.capabilities) || flagged(plugin);
}
function ContentQualitySettings({
  load,
  save,
  connections,
  plugin
}) {
  const { t } = useI18n();
  const scope = useId();
  const [values, setValues] = useState(null);
  const [stored, setStored] = useState({});
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState("loading");
  const requestId = useRef(0);
  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setStatus("loading");
    try {
      const snapshot = await load();
      const next = readValues(snapshot);
      if (id !== requestId.current) return;
      setValues(next);
      setStored(snapshot.values);
      setRevision(snapshot.revision);
      setStatus("ready");
    } catch {
      if (id === requestId.current) setStatus("loadError");
    }
  }, [load]);
  const cancelPending = useCallback(() => {
    ++requestId.current;
  }, []);
  useEffect(() => {
    void reload();
    return cancelPending;
  }, [reload, cancelPending]);
  function update(key, value) {
    setValues((current) => current ? { ...current, [key]: value } : current);
    setStatus(
      (current) => current === "saved" || current === "saveError" ? "ready" : current
    );
  }
  async function submit() {
    if (!values || status === "loading" || status === "saving" || status === "conflict" || status === "loadError")
      return;
    const id = ++requestId.current;
    setStatus("saving");
    try {
      const body = { ...stored, ...values };
      if (!values.connectionId && !("connectionId" in stored))
        delete body.connectionId;
      for (const key of [
        "replyContextTurns",
        "replyContextMaxChars"
      ]) {
        if (limitsSupported === true) continue;
        if (limitsSupported === false) {
          if (key in stored) body[key] = stored[key];
          else delete body[key];
        } else if (!(key in stored) && values[key] === defaults[key])
          delete body[key];
      }
      const snapshot = await save({ revision, values: body });
      const next = readValues(snapshot);
      if (id !== requestId.current) return;
      setValues(next);
      setStored(snapshot.values);
      setRevision(snapshot.revision);
      setStatus("saved");
    } catch (error2) {
      if (id === requestId.current)
        setStatus(isConflict(error2) ? "conflict" : "saveError");
    }
  }
  function field(key, label, control, hint) {
    return /* @__PURE__ */ jsxs("div", { className: "plugin-settings-field", children: [
      /* @__PURE__ */ jsx("label", { htmlFor: `${scope}-${key}`, children: label }),
      control,
      hint && /* @__PURE__ */ jsx("p", { id: `${scope}-${key}-hint`, children: hint })
    ] });
  }
  const busy = status === "loading" || status === "saving";
  const limitsSupported = contextLimitsSupport(plugin);
  const error = status === "loadError" || status === "saveError" || status === "conflict";
  return /* @__PURE__ */ jsxs(
    "form",
    {
      className: "plugin-settings-form",
      onSubmit: (event) => {
        event.preventDefault();
        void submit();
      },
      "aria-busy": busy,
      children: [
        values && /* @__PURE__ */ jsxs("fieldset", { disabled: busy, className: "plugin-settings-fields", children: [
          /* @__PURE__ */ jsxs(
            "div",
            {
              className: "plugin-settings-field",
              role: "group",
              "aria-labelledby": `${scope}-connection`,
              "aria-describedby": `${scope}-connection-hint`,
              children: [
                /* @__PURE__ */ jsx("span", { id: `${scope}-connection`, children: t("quality.connection") }),
                connections?.renderPicker({
                  connectionId: values.connectionId,
                  model: values.model,
                  protocols: connectionProtocols,
                  disabled: busy,
                  onChange: (next) => {
                    update("connectionId", next.connectionId);
                    update("model", next.model);
                  }
                }),
                /* @__PURE__ */ jsx("p", { id: `${scope}-connection-hint`, children: t(
                  !connections ? "quality.connectionUnavailable" : values.connectionId ? "quality.connectionHint" : values.connectionFile ? "quality.connectionLegacyHint" : "quality.connectionEmpty"
                ) })
              ]
            }
          ),
          field(
            "language",
            t("quality.language"),
            /* @__PURE__ */ jsx(
              "input",
              {
                id: `${scope}-language`,
                "aria-describedby": `${scope}-language-hint`,
                value: values.language,
                maxLength: 64,
                required: true,
                onChange: (event) => update("language", event.target.value)
              }
            ),
            t("quality.languageHint")
          ),
          field(
            "preset",
            t("quality.preset"),
            /* @__PURE__ */ jsx(
              "select",
              {
                id: `${scope}-preset`,
                "aria-describedby": `${scope}-preset-hint`,
                value: values.preset,
                onChange: (event) => update(
                  "preset",
                  event.target.value
                ),
                children: presets.map((preset) => /* @__PURE__ */ jsx("option", { value: preset, children: t(`quality.preset.${preset}`) }, preset))
              }
            ),
            t(`quality.preset.${values.preset}.description`)
          ),
          field(
            "detail",
            t("quality.detail"),
            /* @__PURE__ */ jsx(
              "select",
              {
                id: `${scope}-detail`,
                value: values.detail,
                onChange: (event) => update(
                  "detail",
                  event.target.value
                ),
                children: details.map((detail) => /* @__PURE__ */ jsx("option", { value: detail, children: t(`quality.detail.${detail}`) }, detail))
              }
            )
          ),
          field(
            "readerBackground",
            t("quality.readerBackground"),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                id: `${scope}-readerBackground`,
                "aria-describedby": `${scope}-readerBackground-hint`,
                rows: 3,
                value: values.readerBackground,
                maxLength: 2e3,
                onChange: (event) => update("readerBackground", event.target.value)
              }
            ),
            t("quality.readerBackgroundHint")
          ),
          field(
            "minReplyChars",
            t("quality.minReplyChars"),
            /* @__PURE__ */ jsx(
              "input",
              {
                id: `${scope}-minReplyChars`,
                "aria-describedby": `${scope}-minReplyChars-hint`,
                type: "number",
                min: 0,
                max: 65536,
                step: 1,
                required: true,
                value: Number.isNaN(values.minReplyChars) ? "" : values.minReplyChars,
                onChange: (event) => update("minReplyChars", event.target.valueAsNumber)
              }
            ),
            t("quality.minReplyCharsHint")
          ),
          field(
            "replyContextTurns",
            t("quality.replyContextTurns"),
            /* @__PURE__ */ jsx(
              "input",
              {
                id: `${scope}-replyContextTurns`,
                "aria-describedby": `${scope}-replyContextTurns-hint`,
                disabled: limitsSupported === false,
                type: "number",
                min: contextLimits.replyContextTurns.min,
                max: contextLimits.replyContextTurns.max,
                step: 1,
                required: true,
                value: Number.isNaN(values.replyContextTurns) ? "" : values.replyContextTurns,
                onChange: (event) => update("replyContextTurns", event.target.valueAsNumber)
              }
            ),
            t(
              limitsSupported === false ? "quality.contextLimitsNeedUpdate" : "quality.replyContextTurnsHint"
            )
          ),
          field(
            "replyContextMaxChars",
            t("quality.replyContextMaxChars"),
            /* @__PURE__ */ jsx(
              "input",
              {
                id: `${scope}-replyContextMaxChars`,
                "aria-describedby": `${scope}-replyContextMaxChars-hint`,
                disabled: limitsSupported === false,
                type: "number",
                min: contextLimits.replyContextMaxChars.min,
                max: contextLimits.replyContextMaxChars.max,
                step: 1,
                required: true,
                value: Number.isNaN(values.replyContextMaxChars) ? "" : values.replyContextMaxChars,
                onChange: (event) => update("replyContextMaxChars", event.target.valueAsNumber)
              }
            ),
            t("quality.replyContextMaxCharsHint")
          ),
          /* @__PURE__ */ jsxs("div", { className: "plugin-settings-field", children: [
            /* @__PURE__ */ jsxs(
              "label",
              {
                className: "plugin-settings-checkbox",
                htmlFor: `${scope}-autoReplies`,
                children: [
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      id: `${scope}-autoReplies`,
                      "aria-describedby": `${scope}-autoReplies-hint`,
                      type: "checkbox",
                      checked: values.autoReplies,
                      onChange: (event) => update("autoReplies", event.target.checked)
                    }
                  ),
                  /* @__PURE__ */ jsx("span", { children: t("quality.autoReplies") })
                ]
              }
            ),
            /* @__PURE__ */ jsx("p", { id: `${scope}-autoReplies-hint`, children: t("quality.autoRepliesHint") })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "plugin-settings-field", children: [
            /* @__PURE__ */ jsxs(
              "label",
              {
                className: "plugin-settings-checkbox",
                htmlFor: `${scope}-autoDocuments`,
                children: [
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      id: `${scope}-autoDocuments`,
                      "aria-describedby": `${scope}-autoDocuments-hint`,
                      type: "checkbox",
                      checked: values.autoDocuments,
                      onChange: (event) => update("autoDocuments", event.target.checked)
                    }
                  ),
                  /* @__PURE__ */ jsx("span", { children: t("quality.autoDocuments") })
                ]
              }
            ),
            /* @__PURE__ */ jsx("p", { id: `${scope}-autoDocuments-hint`, children: t("quality.autoDocumentsHint") })
          ] }),
          field(
            "documentMode",
            t("quality.documentMode"),
            /* @__PURE__ */ jsxs(
              "select",
              {
                id: `${scope}-documentMode`,
                "aria-describedby": `${scope}-documentMode-hint`,
                value: values.documentMode,
                onChange: (event) => update(
                  "documentMode",
                  event.target.value
                ),
                children: [
                  /* @__PURE__ */ jsx("option", { value: "review", children: t("quality.documentMode.review") }),
                  /* @__PURE__ */ jsx("option", { value: "rewrite", children: t("quality.documentMode.rewrite") })
                ]
              }
            ),
            t("quality.documentModeHint")
          )
        ] }),
        status !== "ready" && /* @__PURE__ */ jsx(
          "p",
          {
            role: error ? "alert" : "status",
            className: error ? "plugin-settings-error" : void 0,
            children: t(
              status === "loading" ? "quality.loading" : status === "saving" ? "quality.saving" : status === "saved" ? "quality.saved" : status === "conflict" ? "quality.conflict" : status === "loadError" ? "quality.loadError" : "quality.saveError"
            )
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "plugin-settings-actions", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "submit",
              className: "plugin-settings-save",
              disabled: !values || busy || status === "conflict" || status === "loadError",
              children: t("quality.save")
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              disabled: busy,
              onClick: () => void reload(),
              "aria-describedby": `${scope}-reload-hint`,
              children: t("quality.reload")
            }
          )
        ] }),
        /* @__PURE__ */ jsx("p", { id: `${scope}-reload-hint`, className: "plugin-settings-hint", children: t("quality.reloadHint") })
      ]
    }
  );
}

// src/plugins/ContentQualityActionOutput.tsx
import { Fragment, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function text(value, limit = 2e3) {
  return typeof value === "string" ? value.length > limit ? `${value.slice(0, limit)}\u2026` : value : "";
}
var statusKeys = {
  reviewed: "quality.report.reviewed",
  completed: "automation.completed",
  failed: "automation.failed",
  skipped: "automation.skipped",
  connected: "quality.report.connected"
};
var reasonKeys = {
  autoRepliesDisabled: "quality.report.repliesDisabled",
  noReply: "quality.report.noReply",
  belowMinReplyChars: "quality.report.shortReply",
  alreadyPolished: "quality.report.alreadyPolished",
  turnNotCompleted: "quality.report.turnNotCompleted",
  unsupportedMarkup: "quality.report.unsupportedMarkup"
};
function reasonText(report, t) {
  const reason = text(report.reason, 500);
  if (reason === "replyExceedsContextBudget") {
    const max = report.maxChars;
    return typeof max === "number" && Number.isSafeInteger(max) && max > 0 ? t("quality.report.exceedsContextBudget", { maxChars: formatNumber(max) }) : t("quality.report.exceedsContextBudgetPlain");
  }
  return Object.hasOwn(reasonKeys, reason) ? t(reasonKeys[reason]) : reason;
}
var statusTones = {
  reviewed: "success",
  completed: "success",
  connected: "success",
  failed: "danger"
};
function Tag({ tone = "neutral", children }) {
  return /* @__PURE__ */ jsx2("span", { className: `plugin-report-tag is-${tone}`, children });
}
function ReportStatus({ report, hideCompleted = false }) {
  const { t } = useI18n();
  const status = text(report.status, 200);
  const reason = reasonText(report, t);
  const statusKey = Object.hasOwn(statusKeys, status) ? statusKeys[status] : void 0;
  const showStatus = Boolean(status) && !(hideCompleted && status === "completed");
  return /* @__PURE__ */ jsxs2(Fragment, { children: [
    (showStatus || reason) && /* @__PURE__ */ jsxs2("p", { className: "plugin-report-line", children: [
      showStatus && /* @__PURE__ */ jsx2(Tag, { tone: Object.hasOwn(statusTones, status) ? statusTones[status] : "neutral", children: statusKey ? t(statusKey) : status }),
      reason && /* @__PURE__ */ jsx2("span", { children: reason })
    ] }),
    typeof report.error === "string" && /* @__PURE__ */ jsx2("p", { role: "status", className: "plugin-report-error", children: text(report.error) })
  ] });
}
function Model({ report }) {
  const { t } = useI18n();
  if (typeof report.model !== "string" || !report.model) return null;
  return /* @__PURE__ */ jsxs2("span", { className: "plugin-report-meta", children: [
    t("quality.model"),
    ": ",
    text(report.model, 200)
  ] });
}
function diffTone(line) {
  if (line.startsWith("@@")) return "is-hunk";
  if (line.startsWith("+") && !line.startsWith("+++")) return "is-add";
  if (line.startsWith("-") && !line.startsWith("---")) return "is-del";
  return void 0;
}
function ReportText({
  label,
  value,
  truncated,
  diff = false
}) {
  const { t } = useI18n();
  if (typeof value !== "string" || !value) return null;
  const shown = text(value, 12e3);
  return /* @__PURE__ */ jsxs2("details", { className: "plugin-report-disclosure", children: [
    /* @__PURE__ */ jsx2("summary", { children: label }),
    /* @__PURE__ */ jsx2("pre", { className: `plugin-report-pre${diff ? " quality-diff" : ""}`, children: diff ? shown.split("\n").map((line, index) => /* @__PURE__ */ jsxs2("span", { className: diffTone(line), children: [
      line,
      "\n"
    ] }, index)) : shown }),
    (truncated || value.length > 12e3) && /* @__PURE__ */ jsx2("p", { className: "plugin-report-note", children: t("automation.outputTruncated") })
  ] });
}
function DocumentReport({ report }) {
  const { t } = useI18n();
  const findings = Array.isArray(report.findings) ? report.findings.filter(
    (finding) => typeof finding === "string"
  ) : [];
  const status = text(report.status, 200);
  const statusKey = Object.hasOwn(statusKeys, status) ? statusKeys[status] : void 0;
  const reason = reasonText(report, t);
  return /* @__PURE__ */ jsxs2("article", { className: "quality-doc", "data-status": status || void 0, children: [
    /* @__PURE__ */ jsxs2("header", { className: "quality-doc-header", children: [
      /* @__PURE__ */ jsx2("h4", { className: "quality-doc-path", children: text(report.path, 4096) }),
      /* @__PURE__ */ jsxs2("span", { className: "quality-doc-tags", children: [
        status && /* @__PURE__ */ jsx2(Tag, { tone: Object.hasOwn(statusTones, status) ? statusTones[status] : "neutral", children: statusKey ? t(statusKey) : status }),
        typeof report.written === "boolean" && /* @__PURE__ */ jsx2(Tag, { tone: report.written ? "accent" : "neutral", children: t(
          report.written ? "quality.report.fileWritten" : "quality.report.fileUnchanged"
        ) }),
        findings.length > 0 && /* @__PURE__ */ jsx2(Tag, { tone: "accent", children: t(findings.length === 1 ? "quality.report.findingOne" : "quality.report.findingCount", { value1: findings.length }) })
      ] })
    ] }),
    reason && /* @__PURE__ */ jsx2("p", { className: "plugin-report-meta", children: reason }),
    typeof report.error === "string" && /* @__PURE__ */ jsx2("p", { role: "status", className: "plugin-report-error", children: text(report.error) }),
    !!findings.length && /* @__PURE__ */ jsx2("ul", { className: "quality-doc-findings", "aria-label": t("quality.report.findings"), children: findings.slice(0, 100).map((finding, index) => /* @__PURE__ */ jsx2("li", { children: text(finding) }, index)) }),
    findings.length > 100 && /* @__PURE__ */ jsx2("p", { className: "plugin-report-note", children: t("automation.outputTruncated") }),
    Array.isArray(report.findings) && !findings.length && /* @__PURE__ */ jsx2("p", { className: "plugin-report-meta", children: t("quality.report.noFindings") }),
    /* @__PURE__ */ jsxs2("div", { className: "quality-doc-actions", children: [
      /* @__PURE__ */ jsx2(
        ReportText,
        {
          label: t("quality.report.diff"),
          value: report.diff,
          truncated: report.diffTruncated === true,
          diff: true
        }
      ),
      /* @__PURE__ */ jsx2(
        ReportText,
        {
          label: t("quality.report.proposal"),
          value: report.proposedRewrite
        }
      ),
      /* @__PURE__ */ jsx2(Model, { report })
    ] })
  ] });
}
function canRenderContentQualityActionOutput({
  action,
  output
}) {
  const report = record(output);
  if (!report) return false;
  if (action === "afterTurn") return Array.isArray(report.documents);
  if (action === "reviewDocument") return typeof report.path === "string";
  return (action === "rewriteReply" || action === "testConnection") && typeof report.status === "string";
}
function ContentQualityActionOutput({
  action,
  output
}) {
  const { t } = useI18n();
  const report = record(output);
  if (!report) return null;
  if (action === "afterTurn" && Array.isArray(report.documents)) {
    const documents = report.documents.map(record).filter((value) => Boolean(value));
    const reply = record(report.reply);
    return /* @__PURE__ */ jsxs2("div", { className: "quality-report", children: [
      /* @__PURE__ */ jsx2(ReportStatus, { report, hideCompleted: true }),
      reply && /* @__PURE__ */ jsxs2("div", { className: "quality-report-reply", children: [
        /* @__PURE__ */ jsx2("span", { className: "quality-report-label", children: t("quality.report.reply") }),
        /* @__PURE__ */ jsxs2("div", { children: [
          /* @__PURE__ */ jsx2(ReportStatus, { report: reply }),
          /* @__PURE__ */ jsx2(Model, { report: reply })
        ] })
      ] }),
      typeof report.documentScanError === "string" && /* @__PURE__ */ jsxs2("p", { role: "status", className: "plugin-report-error", children: [
        t("quality.report.scanError"),
        ": ",
        text(report.documentScanError)
      ] }),
      !documents.length && /* @__PURE__ */ jsx2("p", { className: "plugin-report-meta", children: t("quality.report.noDocuments") }),
      !!documents.length && /* @__PURE__ */ jsx2("div", { className: "quality-docs", children: documents.slice(0, 5).map((document, index) => /* @__PURE__ */ jsx2(DocumentReport, { report: document }, index)) }),
      (report.documentsTruncated === true || documents.length > 5) && /* @__PURE__ */ jsx2("p", { className: "plugin-report-note", children: t("quality.report.moreDocuments") })
    ] });
  }
  if (action === "reviewDocument" && typeof report.path === "string")
    return /* @__PURE__ */ jsx2(DocumentReport, { report });
  if ((action === "rewriteReply" || action === "testConnection") && typeof report.status === "string")
    return /* @__PURE__ */ jsxs2("div", { className: "quality-report", children: [
      /* @__PURE__ */ jsx2(ReportStatus, { report }),
      /* @__PURE__ */ jsx2(Model, { report })
    ] });
  return null;
}

// src/plugins/content-quality-plugin.tsx
import { jsx as jsx3 } from "react/jsx-runtime";
var CONTENT_QUALITY_PLUGIN_ID = "pockymoe.content-quality";
var contentQualityPlugin = {
  renderActionOutput: (context) => canRenderContentQualityActionOutput(context) ? /* @__PURE__ */ jsx3(ContentQualityActionOutput, { ...context }) : null,
  defaultEnabled: false,
  manifest: {
    id: CONTENT_QUALITY_PLUGIN_ID,
    get name() {
      return translate("quality.name");
    },
    version: "0.1.0",
    get description() {
      return translate("quality.description");
    },
    remoteCodex: ">=0.13.6",
    capabilities: {
      artifactTypes: [],
      timelineRenderers: [],
      threadPanels: [],
      actions: [
        "rewriteReply",
        "reviewDocument",
        "testConnection",
        "afterTurn"
      ]
    }
  },
  settingsSections: [
    {
      id: "quality",
      get label() {
        return translate("quality.name");
      },
      get description() {
        return translate("quality.description");
      },
      render: (context) => /* @__PURE__ */ jsx3(ContentQualitySettings, { ...context })
    }
  ],
  presentMessage: ({ item, streaming }) => {
    const reply = item.polishedReply;
    if (item.kind !== "agentMessage" || streaming || !reply || typeof reply.text !== "string" || !reply.text.trim() || typeof reply.sourceHash !== "string" || !/^[a-f0-9]{64}$/.test(reply.sourceHash))
      return null;
    return {
      id: `quality:${reply.sourceHash}:${reply.createdAt}`,
      text: reply.text,
      label: translate("quality.polished"),
      originalLabel: translate("quality.original"),
      validate: async () => {
        const hash = await globalThis.crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(item.text)
        );
        return Array.from(
          new Uint8Array(hash),
          (byte) => byte.toString(16).padStart(2, "0")
        ).join("") === reply.sourceHash;
      }
    };
  }
};

// src/components/shell/TerminalSettings.tsx
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
function TerminalSettings() {
  useI18n();
  const preferences = useTerminalPreferences();
  const choice = (key, label, options) => /* @__PURE__ */ jsxs3("fieldset", { className: "terminal-settings-choice", children: [
    /* @__PURE__ */ jsx4("legend", { children: label }),
    options.map(([value, text2]) => /* @__PURE__ */ jsxs3("label", { children: [
      /* @__PURE__ */ jsx4(
        "input",
        {
          type: "radio",
          name: `terminal-${key}`,
          checked: preferences[key] === value,
          onChange: () => setTerminalPreferences({ [key]: value })
        }
      ),
      /* @__PURE__ */ jsx4("span", { children: text2 })
    ] }, value))
  ] });
  const toggle = (key, label, hint) => /* @__PURE__ */ jsxs3("label", { className: "terminal-settings-toggle", children: [
    /* @__PURE__ */ jsxs3("span", { children: [
      /* @__PURE__ */ jsx4("b", { children: label }),
      /* @__PURE__ */ jsx4("small", { children: hint })
    ] }),
    /* @__PURE__ */ jsx4("input", { type: "checkbox", checked: preferences[key], onChange: (event) => setTerminalPreferences({ [key]: event.target.checked }) })
  ] });
  return /* @__PURE__ */ jsxs3("div", { className: "terminal-settings", children: [
    toggle("copyOnSelect", translate("files.terminalCopyOnSelect"), translate("files.terminalCopyOnSelectHint")),
    choice("ctrlV", "Ctrl+V", [
      ["smart", translate("files.terminalCtrlVSmart")],
      ["paste", translate("files.terminalCtrlVPaste")]
    ]),
    choice("rightClick", translate("files.terminalRightClick"), [
      ["menu", translate("files.terminalRightClickMenu")],
      ["copyPaste", translate("files.terminalRightClickCopyPaste")]
    ]),
    toggle("pasteWarning", translate("files.terminalPasteWarning"), translate("files.terminalPasteWarningHint")),
    /* @__PURE__ */ jsx4("p", { className: "terminal-settings-note", children: translate("files.terminalKeysNote") })
  ] });
}

// src/plugins/builtin-plugin-modules.tsx
import { jsx as jsx5 } from "react/jsx-runtime";
var builtinFrontendPlugins = [
  {
    manifest: terminalPluginManifest,
    threadPanels: [
      {
        id: "terminal",
        kind: "terminal",
        get label() {
          return translate("workbench.terminal");
        }
      }
    ],
    browserSettingsSections: [{
      id: "clipboard",
      get label() {
        return translate("workbench.terminal");
      },
      get description() {
        return translate("files.terminalSettingsDescription");
      },
      render: () => /* @__PURE__ */ jsx5(TerminalSettings, {})
    }]
  },
  deepseekHarnessPlugin,
  contentQualityPlugin
];
export {
  CONTENT_QUALITY_PLUGIN_ID,
  DEEPSEEK_HARNESS_PANEL_KIND,
  DEEPSEEK_HARNESS_PLUGIN_ID,
  builtinFrontendPlugins,
  builtinFrontendPlugins as defaultBuiltinFrontendPlugins
};
