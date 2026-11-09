import { expect, it } from 'vitest';
import { messagePreview } from './messagePreview';

it('keeps the file path crossing the preview budget intact', () => {
  const prefix = `${'Summary. '.repeat(260)}\n\nFiles:\n\n`;
  const path = 'runs/hf-def2svp-smiles-fresh-20261109-b1/reports/acetylsalicylic_acid/report.md';
  const visible = `${prefix}\`${path}\``;
  const text = `${visible}\n\n\`runs/batch/final_geometry.xyz\`\n\nBatch records`;
  expect(messagePreview(text, prefix.length + 12)).toBe(visible);
});

it.each([
  '[report](runs/batch/\nreport.md)',
  '```text\nfirst line\n\nlast line\n```',
  '- `runs/batch/report.md`\n- `runs/batch/final_geometry.xyz`',
])('does not split a Markdown block: %s', block => {
  const text = `Summary.\n\n${block}\n\nHidden conclusion.`;
  expect(messagePreview(text, 15)).toBe(`Summary.\n\n${block}`);
});

it('returns short messages and a single complete block without truncation', () => {
  expect(messagePreview('Short reply', 20)).toBe('Short reply');
  expect(messagePreview('A single long paragraph.', 5)).toBe('A single long paragraph.');
  expect(messagePreview('A single long paragraph. \n\n', 5)).toBe('A single long paragraph. \n\n');
});
