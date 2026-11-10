import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const {chromium, expect} = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const output = path.resolve(process.env.MOLECULE_OUTPUT || './molecule-representation-evidence');
const baseUrl = process.env.LAYOUT_URL || 'http://127.0.0.1:5183';
const choices = ['ball-stick', 'stick', 'spacefill', 'surface'];
const toolbarNames = {'ball-stick':'Ball & stick', stick:'Sticks', spacefill:'Space-fill'};
await mkdir(output, {recursive:true});
const browser = await chromium.launch({headless:true});
const records = [];

async function styles(locator, properties) {
  return locator.evaluate((element, names) => {
    const computed = getComputedStyle(element);
    return Object.fromEntries(names.map(name => [name, computed.getPropertyValue(name)]));
  }, properties);
}
const surfaceProperties = ['color', 'background-color', 'border-top-color', 'border-top-width', 'border-top-style', 'border-radius', 'box-shadow', 'padding', 'width', 'font-family', 'font-size'];
const rowProperties = ['color', 'background-color', 'border-radius', 'padding', 'font-family', 'font-size', 'font-weight'];
const focusProperties = [...rowProperties, 'outline-color', 'outline-style', 'outline-width', 'outline-offset'];
function luminance(color) {
  const channels = color.match(/[\d.]+/g).slice(0, 3).map(value => {
    const channel = Number(value) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function assertContrast(foreground, background, label) {
  const light = luminance(foreground), dark = luminance(background);
  const ratio = (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
  assert.ok(ratio >= 4.5, `${label}: text contrast ${ratio.toFixed(2)} must be at least 4.5`);
  return ratio;
}
async function assertFocused(locator) {
  await expect(locator).toBeFocused();
  assert.equal(await locator.evaluate(element => element.matches(':focus-visible')), true, 'Keyboard focus must be visible');
}
async function inspectMode(page, appearance, theme, expanded) {
  const name = `${appearance}-${theme}-${expanded ? 'expanded' : 'workspace'}`;
  const screenshots = [];
  async function screenshot(suffix) {
    const file = `${name}-${suffix}.png`;
    await page.screenshot({path:path.join(output, file)});
    screenshots.push(file);
  }
  const figure = page.locator('.molecule-figure');
  const view = page.locator('.molecule-view-menu:not(.molecule-representation-menu)');
  const viewTrigger = view.locator('summary');
  const viewPopup = view.locator(':scope > div');
  const trigger = page.getByRole('button', {name:'Representation', exact:true});
  const popup = page.getByRole('menu', {name:'Representation', exact:true});
  const row = value => popup.getByRole('menuitemradio', {name:value, exact:true});
  const toolbar = page.getByRole('group', {name:'Style', exact:true});
  const hydrogens = view.getByRole('button', {name:'Hydrogens', exact:true});
  const labels = view.getByRole('button', {name:'Atom labels', exact:true});
  const assertExpanded = async () => assert.equal(await figure.evaluate(element => element.open), expanded, 'Menu interaction must preserve expanded/workspace state');
  async function openRepresentation() {
    if (!await popup.isVisible()) await trigger.click();
    await expect(popup).toBeVisible();
    await expect(popup.getByRole('menuitemradio')).toHaveCount(choices.length);
    for (const value of choices) await expect(row(value)).toBeVisible();
  }
  async function assertSelection(value) {
    await expect(trigger).toContainText(value);
    await openRepresentation();
    for (const entry of choices) await expect(row(entry)).toHaveAttribute('aria-checked', String(entry === value));
    for (const [entry, label] of Object.entries(toolbarNames)) await expect(toolbar.getByRole('button', {name:label, exact:true})).toHaveAttribute('aria-pressed', String(entry === value));
  }
  // Start each mode with the same real selected state on both menus.
  await toolbar.getByRole('button', {name:'Ball & stick', exact:true}).click();
  await viewTrigger.click();
  await expect(viewPopup).toBeVisible();
  await expect(hydrogens).toHaveAttribute('aria-pressed', 'true');
  await expect(labels).toHaveAttribute('aria-pressed', 'false');
  await page.mouse.move(0, 0);
  const viewStyles = {surface:await styles(viewPopup, surfaceProperties), selected:await styles(hydrogens, rowProperties), normal:await styles(labels, rowProperties)};
  await labels.hover();
  viewStyles.hover = await styles(labels, rowProperties);
  await screenshot('view-selected-hover');
  await page.mouse.move(0, 0);
  await viewTrigger.focus();
  await page.keyboard.press('Tab');
  await assertFocused(labels);
  viewStyles.keyboard = await styles(labels, focusProperties);
  await page.keyboard.press('Tab');
  await assertFocused(hydrogens);
  viewStyles.selectedKeyboard = await styles(hydrogens, focusProperties);
  await screenshot('view-selected-keyboard');
  await page.keyboard.press('Escape');
  await expect(view).not.toHaveAttribute('open', '');
  await expect(viewTrigger).toBeFocused();
  await assertExpanded();

  await assertSelection('ball-stick');
  await page.mouse.move(0, 0);
  const representationStyles = {surface:await styles(popup, surfaceProperties), selected:await styles(row('ball-stick'), rowProperties), normal:await styles(row('stick'), rowProperties)};
  assert.deepEqual(representationStyles.surface, viewStyles.surface, `${name}: open popup surface must match View`);
  assert.deepEqual(representationStyles.selected, viewStyles.selected, `${name}: checked row must match View's selected row`);
  assert.deepEqual(representationStyles.normal, viewStyles.normal, `${name}: normal row must match View`);
  assert.equal(luminance(representationStyles.surface['background-color']) < 0.5, theme === 'dark', `${name}: explicit app theme must beat opposite OS preference`);
  assert.match(representationStyles.surface['background-color'], /^rgb\(/, `${name}: popup must be opaque`);
  const contrast = assertContrast(representationStyles.normal.color, representationStyles.surface['background-color'], name);
  await row('stick').hover();
  representationStyles.hover = await styles(row('stick'), rowProperties);
  assert.deepEqual(representationStyles.hover, viewStyles.hover, `${name}: hovered row must match View`);
  assert.notEqual(representationStyles.hover['background-color'], representationStyles.normal['background-color'], `${name}: hover needs a visible state`);
  await screenshot('representation-selected-hover');

  const bounds = await popup.boundingBox(), triggerBounds = await trigger.boundingBox(), viewerBounds = await figure.boundingBox();
  assert.ok(bounds && triggerBounds && viewerBounds);
  assert.ok(bounds.y + bounds.height <= triggerBounds.y + 1, `${name}: popup must open above its trigger`);
  assert.ok(bounds.x >= viewerBounds.x && bounds.y >= viewerBounds.y && bounds.x + bounds.width <= viewerBounds.x + viewerBounds.width + 1 && bounds.y + bounds.height <= viewerBounds.y + viewerBounds.height + 1, `${name}: popup must stay inside the viewer`);
  for (const value of choices) {
    assert.equal(await row(value).evaluate(element => {
      const rect = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    }), true, `${name}: ${value} must be clickable without clipping or occlusion`);
  }
  // Mouse selection must close, return focus, and synchronize all toolbar buttons.
  for (const value of choices) {
    await openRepresentation();
    await row(value).click();
    await expect(popup).toBeHidden();
    await expect(trigger).toBeFocused();
    await assertSelection(value);
    await page.keyboard.press('Escape');
    await expect(popup).toBeHidden();
    await assertExpanded();
  }
  // Toolbar changes must update both the lower label and its checked row.
  for (const [value, label] of Object.entries(toolbarNames)) {
    await toolbar.getByRole('button', {name:label, exact:true}).click();
    await assertSelection(value);
    await page.keyboard.press('Escape');
  }
  await toolbar.getByRole('button', {name:'Ball & stick', exact:true}).click();
  await trigger.focus();
  await page.mouse.move(0, 0);
  await page.keyboard.press('ArrowDown');
  await expect(popup).toBeVisible();
  await assertFocused(row('ball-stick'));
  representationStyles.selectedKeyboard = await styles(row('ball-stick'), focusProperties);
  assert.deepEqual(representationStyles.selectedKeyboard, viewStyles.selectedKeyboard, `${name}: keyboard selected row must match View`);
  await page.keyboard.press('ArrowDown');
  await assertFocused(row('stick'));
  representationStyles.keyboard = await styles(row('stick'), focusProperties);
  assert.deepEqual(representationStyles.keyboard, viewStyles.keyboard, `${name}: keyboard row colors and focus ring must match View`);
  await screenshot('representation-selected-keyboard');
  await page.keyboard.press('End');
  await assertFocused(row('surface'));
  await page.keyboard.press('ArrowDown');
  await assertFocused(row('ball-stick'));
  await page.keyboard.press('ArrowUp');
  await assertFocused(row('surface'));
  await page.keyboard.press('Home');
  await assertFocused(row('ball-stick'));
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(popup).toBeHidden();
  await expect(trigger).toBeFocused();
  await assertSelection('stick');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(popup).toBeHidden();
  await assertExpanded();
  // Keyboard activation of the trigger and outside click preserve expanded state.
  await page.keyboard.press('Enter');
  await expect(popup).toBeVisible();
  await page.locator('.thread-graph-molecule-header h2').click();
  await expect(popup).toBeHidden();
  await assertExpanded();
  // Space uses the button's native activation for both the trigger and a radio.
  await trigger.focus();
  await page.keyboard.press('Space');
  await expect(popup).toBeVisible();
  await assertFocused(row('stick'));
  await page.keyboard.press('End');
  await assertFocused(row('surface'));
  await page.keyboard.press('Space');
  await expect(popup).toBeHidden();
  await assertFocused(trigger);
  await assertSelection('surface');
  await page.keyboard.press('Escape');
  await assertFocused(trigger);
  await assertExpanded();

  // The popup is portalled to the figure. Tab must follow the trigger's original
  // control order, rather than the popup's position at the end of the figure.
  const inspectCoordinates = page.getByRole('button', {name:'Inspect coordinates', exact:true});
  const toolsSummary = page.locator('.molecule-scientific-tools > summary');
  await page.keyboard.press('Space');
  await expect(popup).toBeVisible();
  await assertFocused(row('surface'));
  await page.keyboard.press('Tab');
  await expect(popup).toBeHidden();
  await assertFocused(inspectCoordinates);
  await assertExpanded();
  await page.keyboard.press('Shift+Tab');
  await assertFocused(trigger);
  await page.keyboard.press('Space');
  await expect(popup).toBeVisible();
  await page.keyboard.press('Home');
  await assertFocused(row('ball-stick'));
  await page.keyboard.press('Shift+Tab');
  await expect(popup).toBeHidden();
  await assertFocused(toolsSummary);
  await expect(page.locator('.molecule-scientific-tools')).toHaveAttribute('open', '');
  await assertExpanded();
  const keyboardTraversal = {spaceTrigger:true, spaceRadio:true, tabDestination:'Inspect coordinates', shiftTabDestination:'Structure tools & selection'};
  return {appearance, theme, expanded, osPreference:theme === 'dark' ? 'light' : 'dark', view:viewStyles, representation:representationStyles, contrast, bounds, triggerBounds, viewerBounds, keyboardTraversal, screenshots};
}

try {
  for (const appearance of ['classical', 'terminal']) {
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({viewport:{width:1100, height:900}, colorScheme:theme === 'dark' ? 'light' : 'dark'});
      await page.goto(`${baseUrl}/?molecule&appearance=${appearance}&theme=${theme}`);
      await page.getByRole('button', {name:'Ball & stick', exact:true}).waitFor({state:'visible'});
      await expect(page.getByRole('button', {name:'Ball & stick', exact:true})).toBeEnabled({timeout:30000});
      await page.getByText('Structure tools & selection', {exact:true}).click();
      for (const expanded of [false, true]) {
        try {
          if (expanded) await page.getByRole('button', {name:'Open full view', exact:true}).click();
          records.push(await inspectMode(page, appearance, theme, expanded));
          console.log(`PASS ${appearance} ${theme} ${expanded ? 'expanded' : 'workspace'}`);
        } catch (error) {
          await page.screenshot({path:path.join(output, `${appearance}-${theme}-${expanded ? 'expanded' : 'workspace'}-failure.png`)});
          records.push({appearance, theme, expanded, error:error.stack});
          throw error;
        }
      }
      await page.close();
    }
  }
  // Catch fixtures that only relabel the same appearance without changing its CSS.
  for (const theme of ['light', 'dark']) {
    const classic = records.find(record => record.appearance === 'classical' && record.theme === theme);
    const terminal = records.find(record => record.appearance === 'terminal' && record.theme === theme);
    assert.notEqual(classic.view.surface['font-family'], terminal.view.surface['font-family'], 'Terminal appearance must load its real monospace font');
    assert.notEqual(classic.view.surface['background-color'], terminal.view.surface['background-color'], 'Terminal appearance must use its own palette');
  }
  console.log(`Passed ${records.length} representation appearance/theme/expansion checks`);
} finally {
  await writeFile(path.join(output, 'results.json'), JSON.stringify(records, null, 2));
  await browser.close();
}
