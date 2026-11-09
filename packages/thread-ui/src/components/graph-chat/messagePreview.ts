import { fromMarkdown } from 'mdast-util-from-markdown';

/** Finish the block at the budget so disclosure never feeds cut Markdown to the renderer. */
export function messagePreview(text: string, budget: number): string {
  if (text.length <= budget) return text;
  const blocks = fromMarkdown(text).children;
  const end = blocks.find(block => (block.position?.end.offset ?? 0) >= budget)
    ?.position?.end.offset ?? text.length;
  return text.slice(0, end).trimEnd();
}
