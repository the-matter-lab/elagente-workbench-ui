/** Optional, local-only metadata. Absence means unknown, never zero. */
import type { PDFDict as PDFDictionary, PDFRef as PDFReference } from '@cantoo/pdf-lib';

export type AttachmentMetadata = { pageCount?: number; entryCount?: number };

export const ATTACHMENT_METADATA_LIMITS = {
  pdfBytes: 2 * 1024 * 1024,
  archiveBytes: 512 * 1024 * 1024,
  directoryBytes: 2 * 1024 * 1024,
  gzipBytes: 16 * 1024 * 1024,
  inflatedBytes: 32 * 1024 * 1024,
  entries: 10_000,
  milliseconds: 12_000,
} as const;

type Format = 'pdf' | 'zip' | 'tar' | 'gzip';

function format(file: File): Format | undefined {
  if (typeof File === 'undefined' || !(file instanceof File)) return;
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.zip')) return 'zip';
  if (name.endsWith('.tar.gz') || name.endsWith('.tgz')) return 'gzip';
  if (name.endsWith('.tar')) return 'tar';
}

export function supportsAttachmentMetadata(file: File): boolean {
  return format(file) !== undefined;
}

function check(signal: AbortSignal) {
  if (signal.aborted) throw new Error('Metadata cancelled');
}

function invalid(): never {
  throw new Error('Unsupported or invalid metadata');
}

// FileReader can cancel an in-flight local read. The fallback is for environments
// with native Blob.arrayBuffer but no FileReader; reads are still size bounded.
async function read(blob: Blob, signal: AbortSignal): Promise<Uint8Array> {
  check(signal);
  if (typeof FileReader === 'undefined') {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    check(signal);
    return bytes;
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => reader.abort();
    const finish = () => signal.removeEventListener('abort', abort);
    reader.onload = () => {
      finish();
      resolve(new Uint8Array(reader.result as ArrayBuffer));
    };
    reader.onerror = reader.onabort = () => {
      finish();
      reject(new Error('Metadata read cancelled or failed'));
    };
    signal.addEventListener('abort', abort, { once: true });
    reader.readAsArrayBuffer(blob);
  });
}

const u16 = (bytes: Uint8Array, at: number) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(at, true);
const u32 = (bytes: Uint8Array, at: number) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(at, true);

async function zipCount(file: File, signal: AbortSignal): Promise<number> {
  if (file.size > ATTACHMENT_METADATA_LIMITS.archiveBytes || file.size < 22) invalid();
  const tail = await read(file.slice(Math.max(0, file.size - 65_557)), signal);
  let end = -1;
  for (let at = tail.length - 22; at >= 0; at--) {
    if (u32(tail, at) === 0x06054b50 && at + 22 + u16(tail, at + 20) === tail.length) {
      end = at;
      break;
    }
  }
  if (end < 0 || u16(tail, end + 4) || u16(tail, end + 6)) invalid();
  const entries = u16(tail, end + 10);
  const size = u32(tail, end + 12);
  const offset = u32(tail, end + 16);
  const absoluteEnd = file.size - tail.length + end;
  // ZIP64, split archives and extra directory structures are deliberately skipped.
  if (entries === 0xffff || entries > ATTACHMENT_METADATA_LIMITS.entries ||
      entries !== u16(tail, end + 8) || size > ATTACHMENT_METADATA_LIMITS.directoryBytes ||
      offset + size !== absoluteEnd) invalid();
  const directory = await read(file.slice(offset, offset + size), signal);
  let at = 0;
  let count = 0;
  for (let index = 0; index < entries; index++) {
    check(signal);
    if (at + 46 > directory.length || u32(directory, at) !== 0x02014b50) invalid();
    const flags = u16(directory, at + 8);
    const nameSize = u16(directory, at + 28);
    const extraSize = u16(directory, at + 30);
    const recordSize = 46 + nameSize + extraSize + u16(directory, at + 32);
    const localOffset = u32(directory, at + 42);
    if ((flags & 0x2041) || !nameSize || at + recordSize > directory.length ||
        u16(directory, at + 34) || localOffset >= offset ||
        u32(directory, at + 20) === 0xffffffff ||
        u32(directory, at + 24) === 0xffffffff) invalid();
    for (let extra = at + 46 + nameSize; extra < at + 46 + nameSize + extraSize;) {
      if (extra + 4 > at + 46 + nameSize + extraSize) invalid();
      const id = u16(directory, extra);
      const length = u16(directory, extra + 2);
      if (id === 1 || id === 0x9901 || extra + 4 + length > at + 46 + nameSize + extraSize) invalid();
      extra += 4 + length;
    }
    const attributes = u32(directory, at + 38);
    const isDirectory = directory[at + 46 + nameSize - 1] === 47 ||
      Boolean(attributes & 0x10) || ((attributes >>> 16) & 0xf000) === 0x4000;
    if (!isDirectory) count++;
    at += recordSize;
  }
  if (at !== directory.length) invalid();
  return count;
}

function octal(bytes: Uint8Array): number {
  const text = new TextDecoder().decode(bytes).replace(/\0.*$/s, '').trim();
  if (!/^[0-7]+$/.test(text)) invalid();
  const value = Number.parseInt(text, 8);
  if (!Number.isSafeInteger(value)) invalid();
  return value;
}

async function tarCount(blob: Blob, signal: AbortSignal): Promise<number> {
  if (blob.size > ATTACHMENT_METADATA_LIMITS.archiveBytes || blob.size % 512) invalid();
  let offset = 0;
  let count = 0;
  let headers = 0;
  while (offset + 512 <= blob.size) {
    check(signal);
    if (++headers * 512 > ATTACHMENT_METADATA_LIMITS.directoryBytes) invalid();
    const header = await read(blob.slice(offset, offset + 512), signal);
    if (header.every((byte) => byte === 0)) {
      // Require both end blocks and validate bounded trailing padding.
      if (blob.size - offset < 1024 || blob.size - offset > ATTACHMENT_METADATA_LIMITS.directoryBytes) invalid();
      const padding = await read(blob.slice(offset), signal);
      if (!padding.every((byte) => byte === 0)) invalid();
      return count;
    }
    let checksum = 0;
    for (let index = 0; index < 512; index++) {
      checksum += index >= 148 && index < 156 ? 32 : header[index];
    }
    if (checksum !== octal(header.subarray(148, 156)) || header[0] === 0) invalid();
    const size = octal(header.subarray(124, 136));
    const type = header[156];
    const nextOffset = offset + 512 + Math.ceil(size / 512) * 512;
    if (!Number.isSafeInteger(nextOffset) || nextOffset > blob.size) invalid();
    if (type === 120 || type === 103) {
      // PAX may override sizes or describe sparse files; those layouts need a
      // full archive implementation. Names are never interpreted as paths.
      if (size > 64 * 1024) invalid();
      const pax = new TextDecoder().decode(await read(blob.slice(offset + 512, offset + 512 + size), signal));
      if (/(?:^|\n)\d+ (?:size|GNU\.sparse\.[^=]*)=/.test(pax)) invalid();
    } else if (![0, 48, 49, 50, 51, 52, 53, 54, 55, 76, 75].includes(type)) {
      invalid();
    }
    // Directories, PAX headers and GNU long-name/link headers are metadata.
    if (![53, 120, 103, 76, 75].includes(type)) {
      if (++count > ATTACHMENT_METADATA_LIMITS.entries) invalid();
    }
    offset = nextOffset;
  }
  return invalid();
}

async function gzipTarCount(file: File, signal: AbortSignal): Promise<number> {
  if (file.size > ATTACHMENT_METADATA_LIMITS.gzipBytes ||
      typeof DecompressionStream === 'undefined' || typeof file.stream !== 'function') invalid();
  const reader = file.stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      check(signal);
      const result = await reader.read();
      check(signal);
      if (result.done) break;
      size += result.value.byteLength;
      if (size > ATTACHMENT_METADATA_LIMITS.inflatedBytes) invalid();
      chunks.push(new Uint8Array(result.value));
    }
    return await tarCount(new Blob(chunks), signal);
  } finally {
    signal.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function pdfCount(file: File, signal: AbortSignal): Promise<number> {
  if (file.size > ATTACHMENT_METADATA_LIMITS.pdfBytes) invalid();
  const data = await read(file, signal);
  if (!new TextDecoder().decode(data.subarray(-1024)).trimEnd().endsWith('%%EOF')) invalid();
  const { PDFParser, PDFRawStream, PDFName, PDFDict, PDFArray } =
    await import('@cantoo/pdf-lib');
  check(signal);
  // A maintained PDF parser reads actual objects. Reject compressed object/xref
  // streams before its decoders run: the library exposes no decompression limit.
  // Classic PDFs remain supported without unbounded stream inflation, workers,
  // CDN assets or host-specific bundler configuration.
  class MetadataPDFParser extends PDFParser {
    private objects = 0;
    private depth = 0;
    override parseObject(ref?: PDFReference) {
      check(signal);
      if (++this.objects > 30_000 || ++this.depth > 128) invalid();
      try {
        const object = super.parseObject(ref);
        if (object instanceof PDFRawStream) {
          const type = object.dict.lookup(PDFName.of('Type'));
          if (type === PDFName.of('ObjStm') || type === PDFName.of('XRef')) invalid();
        }
        return object;
      } finally {
        this.depth--;
      }
    }
  }
  // Yield after small batches; parseObject checks cancellation between objects.
  const context = await new MetadataPDFParser(data, 25, true).parseDocument();
  check(signal);
  if (context.trailerInfo.Encrypt) invalid();
  const catalog = context.lookup(context.trailerInfo.Root, PDFDict);
  if (catalog.lookup(PDFName.of('Type')) !== PDFName.of('Catalog')) invalid();
  const root = catalog.lookup(PDFName.of('Pages'), PDFDict);
  const stack = [root];
  const visited = new Set<PDFDictionary>();
  let count = 0;
  while (stack.length) {
    check(signal);
    const node = stack.pop()!;
    if (visited.has(node) || visited.size >= ATTACHMENT_METADATA_LIMITS.entries) invalid();
    visited.add(node);
    const type = node.lookup(PDFName.of('Type'));
    if (type === PDFName.of('Page')) {
      count++;
    } else if (type === PDFName.of('Pages')) {
      const children = node.lookup(PDFName.of('Kids'), PDFArray);
      if (children.size() > ATTACHMENT_METADATA_LIMITS.entries) invalid();
      for (let index = 0; index < children.size(); index++) {
        stack.push(context.lookup(children.get(index), PDFDict));
      }
    } else invalid();
  }
  if (!count) invalid();
  return count;
}

/** Best effort; unknown/unsupported/failed/cancelled inputs never produce counts. */
export async function readAttachmentMetadata(
  file: File,
  signal: AbortSignal,
): Promise<AttachmentMetadata | undefined> {
  const kind = format(file);
  if (!kind || signal.aborted) return;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, ATTACHMENT_METADATA_LIMITS.milliseconds);
  let rejectOnAbort: (() => void) | undefined;
  try {
    const localSignal = controller.signal;
    const cancelled = new Promise<never>((_, reject) => {
      rejectOnAbort = () => reject(new Error('Metadata cancelled'));
      localSignal.addEventListener('abort', rejectOnAbort, { once: true });
    });
    const operation = kind === 'pdf'
      ? pdfCount(file, localSignal).then((pageCount) => ({ pageCount }))
      : (kind === 'zip' ? zipCount(file, localSignal)
        : kind === 'tar' ? tarCount(file, localSignal) : gzipTarCount(file, localSignal))
        .then((entryCount) => ({ entryCount }));
    const result = await Promise.race([operation, cancelled]);
    check(localSignal);
    return result;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
    if (rejectOnAbort) controller.signal.removeEventListener('abort', rejectOnAbort);
    signal.removeEventListener('abort', abort);
  }
}
