import { fileExtension, formatFileSize } from '../attachments/attachmentFiles';
import { translate } from '../../i18n';

const knownExtensions = new Set((
  'xyz pdb cif mmcif mol2 sdf mol log out fchk chk cube cub csv tsv json jsonc yaml yml '
  + 'pdf md markdown txt rst png jpg jpeg svg gif webp avif bmp ico heic heif tif tiff '
  + 'zip tar gz tgz bz2 xz zst 7z rar doc docx odt rtf pages ppt pptx key xls xlsx ods '
  + 'mp3 wav m4a flac ogg aac mp4 mov webm mkv avi js jsx ts tsx mjs cjs py rs go java '
  + 'kt swift c cc cpp h hpp cs rb php sh bash zsh ps1 toml ini xml html htm css scss sql '
  + 'lua dart vue svelte'
).split(' '));

export function composerFileBadge(name: string) {
  const extension = fileExtension(name);
  return extension && knownExtensions.has(extension) ? extension.toUpperCase() : 'FILE';
}

export function composerImageFile(name: string) {
  return /\.(png|jpe?g|svg|gif|webp|avif|bmp|ico|heic|heif|tiff?)$/i.test(name);
}

/** Compare exact uploaded names. A suffix starts at a word/extension boundary,
 * never in the middle of e.g. caffeine/theobromine. A mixed batch stays normal. */
export function sharedFilenameSuffix(names: string[]) {
  if (names.length < 2 || new Set(names).size < 2) return '';
  const chars = Array.from(names[0] ?? '');
  let length = 0;
  while (length < chars.length && names.every(name => name.endsWith(chars.slice(-length - 1).join('')))) length++;
  const common = chars.slice(chars.length - length).join('');
  const boundary = common.search(/[._\-\s]/u);
  if (boundary < 0) return '';
  const suffix = common.slice(boundary);
  // Retain a distinguishing name; an identical whole name is not boilerplate.
  return names.every(name => name.length > suffix.length) ? suffix : '';
}

/** CSS shrinks only the head. Neither part loses or changes filename characters. */
export function filenameMiddleParts(name: string) {
  const extension = name.match(/(?:\.tar\.(?:gz|bz2|xz|zst)|\.[^.]+)$/i)?.[0] ?? '';
  const chars = Array.from(name);
  // Pathological/unknown extensions must not turn the entire filename into a
  // nonshrinking tail. Keep the end, while the full name remains in the title.
  const extensionLength = Array.from(extension).length;
  const keep = Math.min(chars.length, Math.max(8, extensionLength <= 12 ? extensionLength + 4 : 8));
  return { head: chars.slice(0, -keep).join(''), tail: chars.slice(-keep).join('') };
}

export type ComposerFileMetadata = { pageCount?: number; entryCount?: number };

export function composerFileDetail(name: string, size: number | undefined, metadata?: ComposerFileMetadata) {
  if (/\.(log|out|fchk|cube|cub)$/i.test(name) && size !== undefined) return formatFileSize(size);
  if (/\.pdf$/i.test(name) && metadata?.pageCount !== undefined) {
    return translate('chat.attachmentPages', { count: metadata.pageCount });
  }
  const archive = name.match(/\.(tar\.(?:gz|bz2|xz|zst)|zip|tar|tgz|gz|bz2|xz|zst|7z|rar)$/i)?.[1];
  if (archive && metadata?.entryCount !== undefined) {
    return `${archive.toLowerCase()} · ${translate('chat.attachmentFiles', { count: metadata.entryCount })}`;
  }
  return '';
}
