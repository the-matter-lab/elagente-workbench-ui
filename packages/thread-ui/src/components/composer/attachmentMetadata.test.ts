import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ATTACHMENT_METADATA_LIMITS as limits, readAttachmentMetadata } from './attachmentMetadata';

const encode = (text: string) => new TextEncoder().encode(text);
function join(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) { result.set(part, at); at += part.length; }
  return result;
}
function write16(bytes: Uint8Array, at: number, value: number) {
  new DataView(bytes.buffer, bytes.byteOffset).setUint16(at, value, true);
}
function write32(bytes: Uint8Array, at: number, value: number) {
  new DataView(bytes.buffer, bytes.byteOffset).setUint32(at, value, true);
}
function zip(names: string[], flags = 0): Uint8Array<ArrayBuffer> {
  const locals: Uint8Array[] = [];
  const records: Uint8Array[] = [];
  let offset = 0;
  for (const name of names) {
    const bytes = encode(name);
    const local = new Uint8Array(30 + bytes.length);
    write32(local, 0, 0x04034b50);
    write16(local, 4, 20);
    write16(local, 6, flags);
    write16(local, 26, bytes.length);
    local.set(bytes, 30);
    const directory = new Uint8Array(46 + bytes.length);
    write32(directory, 0, 0x02014b50);
    write16(directory, 4, 20);
    write16(directory, 6, 20);
    write16(directory, 8, flags);
    write16(directory, 28, bytes.length);
    write32(directory, 42, offset);
    directory.set(bytes, 46);
    locals.push(local);
    records.push(directory);
    offset += local.length;
  }
  const directory = join(...records);
  const end = new Uint8Array(22);
  write32(end, 0, 0x06054b50);
  write16(end, 8, names.length);
  write16(end, 10, names.length);
  write32(end, 12, directory.length);
  write32(end, 16, offset);
  return join(...locals, directory, end);
}
function tar(entries: Array<{ name: string; type?: string; content?: string }>): Uint8Array<ArrayBuffer> {
  const records: Uint8Array[] = [];
  for (const { name, type = '0', content = '' } of entries) {
    const header = new Uint8Array(512);
    header.set(encode(name));
    header.set(encode('0000644\0'), 100);
    header.set(encode(content.length.toString(8).padStart(11, '0') + '\0'), 124);
    header.fill(32, 148, 156);
    header[156] = type.charCodeAt(0);
    header.set(encode('ustar\0'), 257);
    const sum = header.reduce((total, byte) => total + byte, 0);
    header.set(encode(sum.toString(8).padStart(6, '0') + '\0 '), 148);
    const payload = new Uint8Array(Math.ceil(content.length / 512) * 512);
    payload.set(encode(content));
    records.push(header, payload);
  }
  return join(...records, new Uint8Array(1024));
}
function pdf(pageCount: number): Uint8Array<ArrayBuffer> {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Count ${pageCount} /Kids [${Array.from({ length: pageCount }, (_, index) => `${index + 3} 0 R`).join(' ')}] >>`,
    ...Array.from({ length: pageCount }, () => '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>'),
  ];
  let text = '%PDF-1.7\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(text.length);
    text += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = text.length;
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  text += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  text += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return encode(text);
}
const metadata = (bytes: Uint8Array<ArrayBuffer>, name: string, signal = new AbortController().signal) =>
  readAttachmentMetadata(new File([bytes], name), signal);

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('local attachment metadata', () => {
  it('counts ZIP files using the directory and excludes folders, including empty archives', async () => {
    expect(await metadata(zip(['folder/', 'folder/first.txt', '../second.txt']), 'files.zip')).toEqual({ entryCount: 2 });
    expect(await metadata(zip([]), 'empty.zip')).toEqual({ entryCount: 0 });
  });

  it('reads only the ZIP tail and central directory, never inflating entries', async () => {
    const file = new File([zip(['file.txt'])], 'files.zip');
    const slice = vi.spyOn(file, 'slice');
    expect(await readAttachmentMetadata(file, new AbortController().signal)).toEqual({ entryCount: 1 });
    expect(slice).toHaveBeenCalledTimes(2);
  });

  it('skips encrypted, invalid, truncated, split and ZIP64 archives', async () => {
    for (const flags of [1, 64, 8192]) expect(await metadata(zip(['secret'], flags), 'encrypted.zip')).toBeUndefined();
    const split = zip([]); write16(split, 4, 1);
    const zip64 = zip([]); write16(zip64, 10, 0xffff);
    for (const bytes of [encode('not zip'), zip(['x']).slice(0, -1), split, zip64]) {
      expect(await metadata(bytes, 'broken.zip')).toBeUndefined();
    }
  });

  it('does not read oversized files or unsupported types', async () => {
    const file = new File(['x'], 'large.zip');
    Object.defineProperty(file, 'size', { value: limits.archiveBytes + 1 });
    const slice = vi.spyOn(file, 'slice');
    expect(await readAttachmentMetadata(file, new AbortController().signal)).toBeUndefined();
    expect(slice).not.toHaveBeenCalled();
    expect(await metadata(encode('x'), 'notes.txt')).toBeUndefined();
    expect(await readAttachmentMetadata({ name: 'x.zip' } as File, new AbortController().signal)).toBeUndefined();
  });

  it('counts TAR files, skips directories and metadata, and accepts empty archives', async () => {
    const bytes = tar([
      { name: 'folder/', type: '5' },
      { name: '././@LongLink', type: 'L', content: 'long-name\0' },
      { name: 'pax-header', type: 'x', content: '19 path=long-name\n' },
      { name: 'folder/first.txt', content: 'data' },
      { name: 'link', type: '2' },
    ]);
    expect(await metadata(bytes, 'files.tar')).toEqual({ entryCount: 2 });
    expect(await metadata(tar([]), 'empty.tar')).toEqual({ entryCount: 0 });
  });

  it('rejects corrupt/truncated TAR headers and unsafe sparse or size overrides', async () => {
    const corrupt = tar([{ name: 'x' }]); corrupt[0] ^= 1;
    for (const bytes of [corrupt, tar([{ name: 'x' }]).slice(0, 512), tar([{ name: 'pax', type: 'x', content: '11 size=99\n' }]), tar([{ name: 'sparse', type: 'S' }])]) {
      expect(await metadata(bytes, 'broken.tar')).toBeUndefined();
    }
  });

  it('counts TAR.GZ and TGZ files and verifies gzip integrity', async () => {
    const bytes = new Uint8Array(gzipSync(tar([{ name: 'dir/', type: '5' }, { name: 'a' }, { name: 'b' }])));
    expect(await metadata(bytes, 'files.tar.gz')).toEqual({ entryCount: 2 });
    expect(await metadata(new Uint8Array(gzipSync(tar([]))), 'empty.tgz')).toEqual({ entryCount: 0 });
    expect(await metadata(bytes.slice(0, -4), 'broken.tar.gz')).toBeUndefined();
  });

  it('bounds gzip expansion and compressed input', async () => {
    const bomb = new Uint8Array(gzipSync(new Uint8Array(limits.inflatedBytes + 1)));
    expect(await metadata(bomb, 'bomb.tar.gz')).toBeUndefined();
    const file = new File(['x'], 'huge.tar.gz');
    Object.defineProperty(file, 'size', { value: limits.gzipBytes + 1 });
    const stream = vi.spyOn(file, 'stream');
    expect(await readAttachmentMetadata(file, new AbortController().signal)).toBeUndefined();
    expect(stream).not.toHaveBeenCalled();
  });

  it('cancels gzip work and closes its reader', async () => {
    const controller = new AbortController();
    const file = new File(['x'], 'files.tar.gz');
    const cancel = vi.fn();
    const reader = { read: () => new Promise(() => {}), cancel: cancel.mockResolvedValue(undefined), releaseLock: vi.fn() };
    vi.spyOn(file, 'stream').mockReturnValue({ pipeThrough: () => ({ getReader: () => reader }) } as unknown as ReadableStream);
    vi.stubGlobal('DecompressionStream', class {});
    const result = readAttachmentMetadata(file, controller.signal);
    controller.abort();
    expect(await result).toBeUndefined();
    expect(cancel).toHaveBeenCalled();
  });

  it('returns unknown on an elapsed deadline or pre-cancelled signal', async () => {
    vi.useFakeTimers();
    const file = new File(['x'], 'slow.zip');
    vi.spyOn(file, 'slice').mockReturnValue({ arrayBuffer: () => new Promise(() => {}) } as Blob);
    const result = readAttachmentMetadata(file, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(limits.milliseconds);
    expect(await result).toBeUndefined();
    const controller = new AbortController(); controller.abort();
    expect(await metadata(zip([]), 'empty.zip', controller.signal)).toBeUndefined();
  });

  it('uses the maintained PDF parser to count actual pages without workers', async () => {
    expect(await metadata(pdf(3), 'document.pdf')).toEqual({ pageCount: 3 });
    expect(await metadata(encode('%PDF-1.7 garbage'), 'invalid.pdf')).toBeUndefined();
  });

  it('skips encrypted, cyclic, truncated and compressed-object PDFs truthfully', async () => {
    const plain = new TextDecoder().decode(pdf(1));
    const encrypted = plain.replace('/Root 1 0 R', '/Root 1 0 R /Encrypt 9 0 R');
    const cycle = plain.replace('/Kids [3 0 R]', '/Kids [2 0 R]');
    const stream = plain.replace('xref\n', '9 0 obj\n<< /Type /ObjStm /N 1 /First 4 /Length 0 >>\nstream\n\nendstream\nendobj\nxref\n');
    for (const input of [encrypted, cycle, stream, plain.slice(0, -10)]) {
      expect(await metadata(encode(input), 'unsupported.pdf')).toBeUndefined();
    }
  });

  it('reads generated classic PDFs but skips real encrypted and object-stream PDFs', async () => {
    const { PDFDocument } = await import('@cantoo/pdf-lib');
    const document = await PDFDocument.create();
    document.addPage(); document.addPage();
    expect(await metadata(new Uint8Array(await document.save({ useObjectStreams: false })), 'classic.pdf')).toEqual({ pageCount: 2 });
    expect(await metadata(new Uint8Array(await document.save({ useObjectStreams: true })), 'compressed.pdf')).toBeUndefined();
    document.encrypt({ userPassword: 'secret', ownerPassword: 'owner' });
    expect(await metadata(new Uint8Array(await document.save({ useObjectStreams: false })), 'encrypted.pdf')).toBeUndefined();
  });

  it('skips oversized PDFs before reading', async () => {
    const file = new File(['x'], 'huge.pdf');
    Object.defineProperty(file, 'size', { value: limits.pdfBytes + 1 });
    const arrayBuffer = vi.spyOn(file, 'arrayBuffer');
    expect(await readAttachmentMetadata(file, new AbortController().signal)).toBeUndefined();
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
});
