import { chromium } from 'playwright-core';
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('pageerror', err => console.log('PAGE_ERROR:', err.stack || err));
  await page.goto('http://localhost:3000');
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
