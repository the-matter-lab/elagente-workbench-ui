// Bound both input and indentation expansion before handing text to the viewer.
export const MAX_JSON_PREVIEW_CHARS = 1024 * 1024;
const MAX_FORMATTED_CHARS = 4 * MAX_JSON_PREVIEW_CHARS;
const MAX_DEPTH = 100;

/** Display-only formatting. Preserve number/string spelling, duplicate keys and
 * key order: parsing and re-serializing would change scientific data or IDs. */
export function formatJsonPreview(content: string): string | null {
  if (content.length > MAX_JSON_PREVIEW_CHARS) return null;
  try {
    JSON.parse(content);
  } catch {
    return null;
  }
  const tokens =
    content.match(/"(?:[^"\\]|\\.)*"|[{}\[\],:]|[^\s{}\[\],:]+/g) ?? [];
  const parts: string[] = [];
  let depth = 0;
  let length = 0;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    const next = tokens[index + 1];
    let part = token;
    if (token === '{' || token === '[') {
      if (++depth > MAX_DEPTH) return null;
      if (next !== '}' && next !== ']') part += '\n' + '  '.repeat(depth);
    } else if (token === '}' || token === ']') {
      depth--;
      const previous = tokens[index - 1];
      if (previous !== '{' && previous !== '[')
        part = '\n' + '  '.repeat(depth) + token;
    } else if (token === ',') {
      part += '\n' + '  '.repeat(depth);
    } else if (token === ':') {
      part += ' ';
    }
    length += part.length;
    if (length > MAX_FORMATTED_CHARS) return null;
    parts.push(part);
  }
  return parts.join('');
}
