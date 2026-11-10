import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const output = path.resolve(process.env.MOLECULE_OUTPUT || './molecule-representation-evidence');
await mkdir(output, {recursive:true});
const browser = await chromium.launch({headless:true});
const records = [];
function luminance(color) {
  const channels = color.match(/[\d.]+/g).slice(0, 3).map(value => {
    const channel = Number(value) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

try {
  for (const theme of ['light', 'dark']) {
    // The app's explicit theme must work even when the OS prefers the opposite.
    const page = await browser.newPage({viewport:{width:900, height:700}, colorScheme:theme === 'dark' ? 'light' : 'dark'});
    await page.goto(`${process.env.LAYOUT_URL || 'http://127.0.0.1:5183'}/?molecule&theme=${theme}`);
    await page.getByText('Structure tools & selection', {exact:true}).click();
    const select = page.getByRole('combobox', {name:'Representation', exact:true});

    for (const expanded of [false, true]) {
      if (expanded) await page.getByRole('button', {name:'Open full view', exact:true}).click();
      const styles = await select.evaluate(element => {
        const style = getComputedStyle(element);
        const probe = document.createElement('span');
        probe.style.color = 'var(--theme-fg)';
        probe.style.backgroundColor = 'var(--theme-surface)';
        element.parentElement.append(probe);
        const expected = getComputedStyle(probe);
        const result = {
          color:style.color, background:style.backgroundColor,
          expectedColor:expected.color, expectedBackground:expected.backgroundColor,
          options:Array.from(element.options, option => ({
            value:option.value, color:getComputedStyle(option).color,
            background:getComputedStyle(option).backgroundColor,
          })),
        };
        probe.remove();
        return result;
      });
      assert.equal(styles.color, styles.expectedColor, `${theme}: select text must follow the host theme`);
      assert.equal(styles.background, styles.expectedBackground, `${theme}: select needs an opaque themed background`);
      assert.equal(luminance(styles.background) < 0.5, theme === 'dark', 'The fixture must render the requested app theme');
      for (const option of styles.options) {
        assert.equal(option.color, styles.expectedColor, `${theme}: ${option.value} text`);
        assert.equal(option.background, styles.expectedBackground, `${theme}: ${option.value} background`);
        const light = luminance(option.color), dark = luminance(option.background);
        const contrast = (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
        assert.ok(contrast >= 4.5, `${theme}: ${option.value} contrast is ${contrast}`);
      }

      await select.selectOption('stick');
      await page.getByRole('button', {name:'Sticks', exact:true}).waitFor();
      assert.equal(await page.getByRole('button', {name:'Sticks', exact:true}).getAttribute('aria-pressed'), 'true');
      await page.getByRole('button', {name:'Ball & stick', exact:true}).click();
      assert.equal(await select.inputValue(), 'ball-stick');
      await select.focus();
      assert.equal(await select.evaluate(element => document.activeElement === element), true);
      const name = `${theme}-${expanded ? 'expanded' : 'workspace'}`;
      await select.click();
      await page.screenshot({path:path.join(output, `${name}.png`)});
      await page.keyboard.press('Escape');
      records.push({theme, expanded, ...styles});
    }
    await page.close();
  }
  await writeFile(path.join(output, 'results.json'), JSON.stringify(records, null, 2));
  console.log(`Passed ${records.length} representation theme/expansion checks`);
} finally {
  await browser.close();
}
