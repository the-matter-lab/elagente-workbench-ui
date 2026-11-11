import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium, expect } = require(
  process.env.PLAYWRIGHT_MODULE || '@playwright/test',
);
const out = process.env.JSON_PREVIEW_OUTPUT || './json-preview-evidence';
const baseUrl = process.env.LAYOUT_URL || 'http://127.0.0.1:5183';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const appearance of ['classical', 'terminal'])
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({
        viewport: { width: 1100, height: 760 },
      });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(
        `${baseUrl}/json-preview.html?appearance=${appearance}&theme=${theme}`,
      );
      await expect(page.locator('.monaco-editor')).toBeVisible({
        timeout: 60000,
      });
      const state = () =>
        page.evaluate(() => {
          const f = window.__jsonFixture;
          const editors = f.monaco.editor.getEditors();
          const e = editors.find((e) => e.getDomNode()?.isConnected);
          return {
            text: e?.getValue(),
            readOnly: e?.getRawOptions().readOnly,
            resource: e?.getModel()?.uri.toString(),
            changes: f.changes,
            saves: f.saves,
            content: f.draft.content,
            phase: f.draft.phase,
            source: f.source,
          };
        });
      const initial = await state();
      expect(initial.text).toContain('\n  "version": 1,\n');
      expect(initial.text).toContain('9007199254740993');
      expect(initial.text).toContain('-1.234567890123456789e-100');
      expect(initial.readOnly).toBe(true);
      expect(initial.changes).toBe(0);
      expect(initial.phase).toBe('clean');
      await expect(
        page.getByRole('button', { name: 'Formatted', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      const folding = page.locator('.codicon-folding-expanded').first();
      await expect(folding).toBeAttached();
      // Monaco deliberately hides fold controls until mouseover; the native folding
      // action verifies the model has computed regions without relying on opacity.
      await page.evaluate(async () => {
        const e = window.__jsonFixture.monaco.editor
          .getEditors()
          .find((e) => e.getDomNode()?.isConnected);
        await e.getAction('editor.foldAll').run();
      });
      await expect(
        page.locator('.codicon-folding-collapsed').first(),
      ).toBeAttached();
      await page.evaluate(async () => {
        const e = window.__jsonFixture.monaco.editor
          .getEditors()
          .find((e) => e.getDomNode()?.isConnected);
        await e.getAction('editor.unfoldAll').run();
      });
      await page.screenshot({
        path: `${out}/${appearance}-${theme}-formatted.png`,
      });
      await page.getByRole('button', { name: 'Raw', exact: true }).click();
      expect((await state()).text).toBe(initial.source);
      await page
        .getByRole('button', { name: 'Formatted', exact: true })
        .focus();
      await page.keyboard.press('Space');
      expect((await state()).text).toBe(initial.text);
      await page
        .getByRole('button', { name: 'File actions', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Download file', exact: true })
        .click();
      expect(await page.evaluate(() => window.__download)).toBe(initial.source);
      await page
        .getByRole('button', { name: 'Edit file', exact: true })
        .click();
      await expect(
        page.getByRole('group', { name: 'JSON view', exact: true }),
      ).toHaveCount(0);
      const edit = await state();
      expect(edit.text).toBe(initial.source);
      expect(edit.readOnly).toBe(false);
      expect(edit.changes).toBe(0);
      // A real edit may change the draft; simply previewing must not.
      await page.evaluate(() => {
        const e = window.__jsonFixture.monaco.editor
          .getEditors()
          .find((e) => e.getDomNode()?.isConnected);
        e.setValue('{"edited":true}');
      });
      await expect.poll(async () => (await state()).changes).toBe(1);
      expect((await state()).content).toBe('{"edited":true}');
      expect((await state()).saves).toBe(0);
      expect(errors).toEqual([]);
      results.push({
        appearance,
        theme,
        status: 'passed',
        folding: true,
        rawExact: true,
        previewDidNotDirty: true,
        editingUsesOriginal: true,
        errors,
      });
      await page.close();
    }
  for (const mode of ['invalid', 'partial']) {
    const page = await browser.newPage({
      viewport: { width: 1100, height: 760 },
    });
    await page.goto(`${baseUrl}/json-preview.html?${mode}=1`);
    await expect(page.locator('.monaco-editor')).toBeVisible({
      timeout: 60000,
    });
    await expect(
      page.getByRole('group', { name: 'JSON view', exact: true }),
    ).toHaveCount(0);
    results.push({ mode, status: 'passed', rawFallback: true });
    await page.close();
  }
  {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 800 },
    });
    await page.goto(`${baseUrl}/json-preview.html?duplicate=1`);
    await expect(page.locator('.monaco-editor')).toHaveCount(2);
    for (const editor of await page.locator('.monaco-editor').all()) {
      await expect.poll(async () => (await editor.boundingBox())?.height ?? 0).toBeGreaterThan(200);
      await expect.poll(async () => (await editor.boundingBox())?.width ?? 0).toBeGreaterThan(400);
    }
    const models = () =>
      page.evaluate(() =>
        window.__jsonFixture.monaco.editor
          .getEditors()
          .filter((e) => e.getDomNode()?.isConnected)
          .map((e) => ({
            uri: e.getModel()?.uri.toString() ?? null,
            text: e.getValue(),
          })),
      );
    const before = await models();
    const originalSource = await page.evaluate(
      () => window.__jsonFixture.source,
    );
    expect(before[0].uri).not.toBe(before[1].uri);
    await page
      .getByRole('button', { name: 'Raw', exact: true })
      .first()
      .click();
    await expect.poll(async () => (await models()).length).toBe(2);
    const after = await models();
    expect(after.every((e) => e.uri !== null)).toBe(true);
    expect(after.some((e) => e.text === originalSource)).toBe(true);
    expect(after.some((e) => e.text === before[0].text)).toBe(true);
    await page.screenshot({ path: `${out}/two-previews-independent.png` });
    results.push({
      mode: 'two-previews',
      status: 'passed',
      separateModels: true,
      otherPreviewRetained: true,
    });
    await page.close();
  }
  {
    const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
    await page.goto(`${baseUrl}/json-preview.html?preformatted=1`);
    await expect(page.getByText('Source is already formatted', { exact: true })).toBeVisible();
    const value = () => page.evaluate(() => window.__jsonFixture.monaco.editor.getEditors().find(e => e.getDomNode()?.isConnected)?.getValue());
    await expect(page.locator('.monaco-editor')).toBeVisible();
    const formatted = await value();
    await page.getByRole('button', { name: 'Raw', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Raw', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await value()).toBe(await page.evaluate(() => window.__jsonFixture.source));
    expect((await value()).trimEnd()).toBe(formatted);
    await page.getByRole('button', { name: 'Formatted', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Formatted', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await value()).toBe(formatted);
    await page.screenshot({ path: `${out}/already-formatted-source.png` });
    results.push({ mode: 'already-formatted', status: 'passed', rawExact: true, explanationVisible: true });
    await page.close();
  }
  for (const appearance of ['classical', 'terminal'])
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${baseUrl}/json-preview.html?event=1&duplicate=1&appearance=${appearance}&theme=${theme}`);
      await expect(page.locator('.monaco-editor')).toHaveCount(2);
      for (const editor of await page.locator('.monaco-editor').all()) {
        await expect.poll(async () => (await editor.boundingBox())?.height ?? 0).toBeGreaterThan(200);
        await expect.poll(async () => (await editor.boundingBox())?.width ?? 0).toBeGreaterThan(400);
      }
      await expect(page.getByRole('group', { name: 'JSON view', exact: true })).toHaveCount(0);
      const models = await page.evaluate(() => window.__jsonFixture.monaco.editor.getEditors().filter(e => e.getDomNode()?.isConnected).map(e => ({
        value: e.getValue(), language: e.getModel()?.getLanguageId(), readOnly: e.getRawOptions().readOnly, uri: e.getModel()?.uri.toString(),
      })));
      expect(models).toHaveLength(2);
      expect(models[0].uri).not.toBe(models[1].uri);
      for (const m of models) {
        expect(m.language).toBe('json');
        expect(m.readOnly).toBe(true);
        expect(m.value).toContain('\n  "version": 1,\n');
        expect(m.value).toContain('9007199254740993');
      }
      await page.evaluate(async () => {
        const editors = window.__jsonFixture.monaco.editor.getEditors().filter(e => e.getDomNode()?.isConnected);
        await editors[0].getAction('editor.foldAll').run();
      });
      await expect(page.locator('.codicon-folding-collapsed').first()).toBeAttached();
      await page.getByRole('button', { name: 'File actions', exact: true }).first().click();
      await expect(page.getByRole('button', { name: 'Edit file', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'File actions', exact: true }).first().click();
      await page.evaluate(async () => {
        const editors = window.__jsonFixture.monaco.editor.getEditors().filter(e => e.getDomNode()?.isConnected);
        await editors[0].getAction('editor.unfoldAll').run();
      });
      expect(await page.evaluate(() => window.__jsonFixture.changes)).toBe(0);
      expect(await page.evaluate(() => window.__jsonFixture.saves)).toBe(0);
      expect(errors).toEqual([]);
      await page.screenshot({ path: `${out}/debug-${appearance}-${theme}.png` });
      results.push({ mode: 'debug-event', appearance, theme, status: 'passed', noToggle: true, readOnly: true, jsonLanguage: true, folding: true, separateModels: true });
      await page.close();
    }
  await writeFile(
    `${out}/BROWSER_RESULTS.json`,
    JSON.stringify({ status: 'passed', results }, null, 2) + '\n',
  );
  console.log(JSON.stringify({ status: 'passed', cases: results.length }));
} finally {
  await browser.close();
}
