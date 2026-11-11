import { describe, expect, it } from 'vitest';
import { formatJsonPreview, MAX_JSON_PREVIEW_CHARS } from './jsonPreview';

describe('JSON preview formatting', () => {
  it('indents nested records and arrays while keeping empty containers compact', () => {
    expect(
      formatJsonPreview(
        '{"version":1,"events":[{"progress":true}],"empty":{},"array":[]}',
      ),
    ).toBe(
      '{\n  "version": 1,\n  "events": [\n    {\n      "progress": true\n    }\n  ],\n  "empty": {},\n  "array": []\n}',
    );
  });

  it('preserves exact scientific numbers, integer IDs, duplicate keys and key order', () => {
    const raw =
      '{"10":9007199254740993,"2":-0,"energy":-1.234567890123456789e-100,"overflow":1e999,"key":1,"key":2}';
    expect(formatJsonPreview(raw)).toBe(
      '{\n  "10": 9007199254740993,\n  "2": -0,\n  "energy": -1.234567890123456789e-100,\n  "overflow": 1e999,\n  "key": 1,\n  "key": 2\n}',
    );
  });

  it('keeps escaped strings and punctuation inside strings byte for byte', () => {
    const raw = String.raw`{"text":"quote: \" slash: \\ newline: \n unicode: \u0061 ,{}[]: 🧪"}`;
    expect(formatJsonPreview(raw)).toBe(
      raw.replace('{"text":', '{\n  "text": ').replace(/}$/, '\n}'),
    );
    expect(formatJsonPreview(' null \r\n')).toBe('null');
  });

  it.each(['', '{"x":', '{"x":1,}', '{"x":1}\n{"x":2}', '{"x":undefined}'])(
    'leaves invalid or incomplete JSON raw: %s',
    (raw) => {
      expect(formatJsonPreview(raw)).toBeNull();
    },
  );

  it('bounds input, nesting and indentation expansion', () => {
    expect(
      formatJsonPreview('"' + 'a'.repeat(MAX_JSON_PREVIEW_CHARS) + '"'),
    ).toBeNull();
    expect(
      formatJsonPreview('['.repeat(101) + '0' + ']'.repeat(101)),
    ).toBeNull();
    const expanded =
      '['.repeat(99) + '[' + '0,'.repeat(25_000) + '0]' + ']'.repeat(99);
    expect(formatJsonPreview(expanded) === null).toBe(true);
  });
});
