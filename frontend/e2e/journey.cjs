/* eslint-disable no-console */
// End-to-end journey of the homologation script (docs/guia-do-desenvolvedor.md, 13.1) in a real browser, against the
// whole stack: sign-up with the code read from Mailpit, the main screens (Início, Plano do mês, Meu método and
// Entradas e saídas included) at 375 and 1280 px, Open Finance sandbox connect/authorise/revoke and "Baixar meus
// dados". Any JavaScript error or 5xx answer fails the run.
//
//   node e2e/journey.cjs                      (stack on http://localhost:3001, Mailpit on http://localhost:8025)
//   E2E_BASE_URL=... E2E_MAILPIT_URL=... PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node e2e/journey.cjs
//
// ponytail: plain Node and the playwright library instead of @playwright/test, so it runs without a new
// dependency in package.json. Move to the test runner when the journeys multiply.
const assert = require('node:assert/strict');

const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3001';
const MAILPIT = process.env.E2E_MAILPIT_URL || 'http://localhost:8025';
const SCREENS = [
  '/',
  '/plan',
  '/plan/method',
  '/cash-flow',
  '/future',
  '/commitments',
  '/insights',
  '/open-finance',
  '/privacy',
];
const PASSWORD = 'Senha-forte-123';

async function codeFor(email) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const search = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    if (search.messages?.length) {
      const message = await (await fetch(`${MAILPIT}/api/v1/message/${search.messages[0].ID}`)).json();
      return message.Text.match(/\b(\d{8})\b/)[1];
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`no code e-mail for ${email}`);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ locale: 'pt-BR', acceptDownloads: true });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (error) => problems.push(`JS: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 500) problems.push(`${response.status()} ${response.url()}`);
  });
  const step = (name) => console.log(`- ${name}`);

  try {
    const username = `e2e${Date.now()}`;
    const email = `${username}@example.test`;

    step('cadastro e código pelo Mailpit');
    await page.goto(`${BASE}/signup`);
    for (const [name, value] of Object.entries({ firstName: 'Ponta', lastName: 'Aponta', username, email, password: PASSWORD })) {
      await page.fill(`input[name="${name}"]`, value);
    }
    await page.click('form button[type="submit"]');
    await page.fill('input[name="code"]', await codeFor(email));
    await page.click('form button[type="submit"]');
    await page.waitForURL((url) => !/\/(signup|login)/.test(url.pathname), { timeout: 15000 });

    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of SCREENS) {
        step(`${path} em ${width} px`);
        await page.goto(`${BASE}${path}`);
        await page.waitForLoadState('networkidle');
        const errors = await page.locator('.MuiAlert-standardError, .MuiAlert-filledError').allTextContents();
        assert.deepEqual(errors, [], `${path} at ${width}px shows an error`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(overflow <= 1, `${path} at ${width}px scrolls sideways by ${overflow}px`);
      }
    }

    step('Open Finance: conectar, autorizar e revogar');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}/open-finance`);
    await page.getByRole('button', { name: 'Conectar', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Autorizar' }).click();
    await page.getByRole('button', { name: 'Sincronizar dados' }).waitFor({ timeout: 20000 });

    step('altura da tela Futuro com dados, em 375 px');
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(`${BASE}/future`);
    await page.waitForLoadState('networkidle');
    const futureHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    console.log(`  Futuro: ${futureHeight} px de altura`);

    step('baixar meus dados');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}/privacy`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Baixar meus dados' }).click(),
    ]);
    const chunks = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk);
    const exported = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    assert.equal(exported.profile.username, username);
    assert.ok(exported.transactions.length > 0, 'the export carries the imported history');
    assert.ok(!JSON.stringify(exported).includes('enc:'), 'descriptions come decrypted');

    step('revogar apaga os dados importados');
    await page.goto(`${BASE}/open-finance`);
    await page.getByRole('button', { name: 'Revogar compartilhamento' }).click();
    await page.getByRole('button', { name: 'Revogar e apagar dados' }).click();
    await page.getByRole('button', { name: 'Conectar de novo' }).waitFor({ timeout: 15000 });

    assert.deepEqual(problems, [], 'no JavaScript error and no 5xx during the journey');
    console.log('E2E ok');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
