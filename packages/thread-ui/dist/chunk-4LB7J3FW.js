import {
  extensionOf
} from "./chunk-LPTBJWOL.js";

// src/components/graph-workspace/explorer/filePreviewPolicy.ts
var DRAWIO_MAX_BYTES = 8 * 1024 * 1024;
function isDrawioPath(path) {
  return ["drawio", "dio"].includes(extensionOf(path));
}
var DOWNLOAD_EXTENSIONS = /* @__PURE__ */ new Set([
  "zip",
  "7z",
  "rar",
  "tar",
  "gz",
  "tgz",
  "bz2",
  "xz",
  "zst",
  "br",
  "exe",
  "dll",
  "so",
  "dylib",
  "dmg",
  "iso",
  "pkg",
  "deb",
  "rpm",
  "msi",
  "bin",
  "wasm",
  "class",
  "jar",
  "pyc",
  "o",
  "a",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "odt",
  "ods",
  "odp",
  "db",
  "sqlite",
  "sqlite3",
  "parquet",
  "arrow",
  "npy",
  "npz",
  "h5",
  "hdf5",
  "mp3",
  "wav",
  "flac",
  "ogg",
  "m4a",
  "mp4",
  "mov",
  "mkv",
  "webm",
  "avi",
  "psd",
  "ai",
  "sketch",
  "heic",
  "tif",
  "tiff",
  "woff",
  "woff2",
  "ttf",
  "otf"
]);
var SCIENTIFIC_BINARY_EXTENSIONS = /* @__PURE__ */ new Set([
  "gbw",
  "densities",
  "mp2nat",
  "uno",
  "qro",
  "uco",
  "chk",
  "bson",
  "ubjson",
  "msgpack"
]);
function isDownloadOnlyPath(path) {
  const extension = extensionOf(path);
  return DOWNLOAD_EXTENSIONS.has(extension) || SCIENTIFIC_BINARY_EXTENSIONS.has(extension);
}
function downloadOnlyReason(path) {
  return SCIENTIFIC_BINARY_EXTENSIONS.has(extensionOf(path)) ? "scientificBinaryFile" : null;
}
var CODE_LANGUAGES = {
  py: "python",
  pyi: "python",
  ipy: "python",
  md: "markdown",
  markdown: "markdown",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  yml: "yaml",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "typescript",
  rs: "rust",
  h: "cpp",
  hpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  jsonl: "json",
  text: "plaintext",
  txt: "plaintext"
};
function codeLanguage(language) {
  const key = language.toLowerCase();
  return CODE_LANGUAGES[key] ?? (key || "plaintext");
}
var HDF5_SIGNATURE = "\uFFFDHDF\r\n\n";
function isBinaryPreview(content) {
  if (content.includes("\0") || content.startsWith(HDF5_SIGNATURE)) return true;
  const sample = content.slice(0, 8e3);
  const suspicious = sample.match(/[\x01-\x08\x0e-\x1f\ufffd]/g)?.length ?? 0;
  return suspicious >= 3 && suspicious / sample.length > 0.02;
}

export {
  DRAWIO_MAX_BYTES,
  isDrawioPath,
  isDownloadOnlyPath,
  downloadOnlyReason,
  codeLanguage,
  isBinaryPreview
};
