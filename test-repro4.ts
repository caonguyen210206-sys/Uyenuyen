import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  await page.addInitScript(`
    const orig = window.fetch;
    Object.defineProperty(window, 'fetch', {
      get: function() { return orig; },
      set: undefined,
      configurable: false
    });
  `);

  page.on('pageerror', err => console.log('PAGE_ERROR:', err.stack || err));
  page.on('console', msg => console.log('CONSOLE:', msg.text()));

  await page.goto('http://localhost:3000');
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
