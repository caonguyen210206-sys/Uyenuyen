import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('response', async res => {
    if (res.url().includes('env.mjs')) {
      console.log('ENV.MJS:', await res.text());
    }
  });
  await page.goto('http://localhost:3000');
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
