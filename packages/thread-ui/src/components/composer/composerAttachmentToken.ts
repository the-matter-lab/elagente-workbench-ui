import { getLocale, translate } from '../../i18n';
import { fileFamily } from '../attachments/attachmentFiles';
import { attachmentDisplayLabel, type PromptAttachmentSegment } from './composerUtils';
import { composerFileBadge, composerFileDetail, filenameMiddleParts, type ComposerFileMetadata } from './composerFileChips';

export function composerAttachmentName(segment: PromptAttachmentSegment) {
  const attachment = segment.attachment;
  return attachment.file?.name || attachment.originalName || attachmentDisplayLabel(attachment);
}

function appendFilename(parent: HTMLElement, name: string, suffix: string) {
  const { head, tail } = filenameMiddleParts(name);
  const split = suffix ? name.length - suffix.length : name.length;
  let offset = 0;
  for (const [part, value] of [['head', head], ['tail', tail]] as const) {
    if (!value) continue;
    const span = document.createElement('span');
    span.className = `composer-file-name-${part}`;
    const normal = Math.max(0, Math.min(value.length, split - offset));
    span.append(document.createTextNode(value.slice(0, normal)));
    if (normal < value.length) {
      const shared = document.createElement('span');
      shared.className = 'composer-file-name-shared';
      shared.textContent = value.slice(normal);
      span.append(shared);
    }
    parent.append(span);
    offset += value.length;
  }
}

/** A contenteditable atom. Keep its placeholder (submission/selection identity)
 * separate from its presentation, and preserve the outer node on async updates. */
export function createPromptAttachmentToken(
  segment: PromptAttachmentSegment,
  previewUrls: Record<string, string>,
  suffix: string,
  metadata?: ComposerFileMetadata,
  existing?: HTMLElement,
) {
  const { attachment } = segment;
  const name = composerAttachmentName(segment);
  const preview = previewUrls[attachment.clientId];
  const detail = composerFileDetail(name, attachment.file?.size, metadata);
  const signature = JSON.stringify([name, preview, suffix, detail, attachment.placeholder, attachment.kind, attachment.file?.size, getLocale()]);
  const token = existing ?? document.createElement('span');
  if (token.dataset.presentation === signature) return token;
  token.dataset.presentation = signature;
  token.dataset.segmentType = 'attachment';
  token.dataset.clientId = attachment.clientId;
  token.dataset.placeholder = attachment.placeholder;
  token.dataset.family = fileFamily(name, attachment.kind, attachment.file?.type);
  token.dataset.kind = attachment.kind;
  token.dataset.name = name;
  if (attachment.file) token.dataset.size = String(attachment.file.size);
  token.contentEditable = 'false';
  token.className = 'composer-file-chip';
  token.setAttribute('role', 'group');
  token.tabIndex = -1;
  token.setAttribute('aria-label', name);
  token.title = name;

  const control = document.createElement('span');
  control.className = 'composer-file-details';
  control.setAttribute('role', 'button');
  control.setAttribute('aria-label', translate('chat.attachmentDetails', { name }));
  control.tabIndex = 0;
  const icon = document.createElement('span');
  icon.className = 'composer-file-badge';
  icon.setAttribute('aria-hidden', 'true');
  if (preview) {
    icon.classList.add('composer-file-thumbnail');
    const image = document.createElement('img');
    image.src = preview;
    image.alt = '';
    image.draggable = false;
    image.addEventListener('error', () => {
      icon.classList.remove('composer-file-thumbnail');
      icon.textContent = composerFileBadge(name);
    }, { once: true });
    icon.append(image);
  } else icon.textContent = composerFileBadge(name);
  const label = document.createElement('span');
  label.className = 'composer-file-name';
  appendFilename(label, name, suffix);
  control.append(icon, label);
  if (detail) {
    const info = document.createElement('span');
    info.className = 'composer-file-meta';
    info.textContent = detail;
    control.append(info);
  }
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'composer-file-remove';
  remove.dataset.removeAttachment = 'true';
  remove.setAttribute('aria-label', `${translate('chat.attachmentRemove')}: ${name}`);
  remove.title = translate('chat.attachmentRemove');
  // Static glyph only; filenames are always text nodes.
  remove.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  const focused = token.contains(document.activeElement) ? document.activeElement : null;
  const wasRemove = focused instanceof Element && focused.matches('[data-remove-attachment]');
  token.replaceChildren(control, remove);
  if (focused) (wasRemove ? remove : control).focus({ preventScroll: true });
  return token;
}
