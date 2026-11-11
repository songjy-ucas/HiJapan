import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

// Run against production .vite code with an unfused development Electron runtime.
// The packaged/fused EXE is smoke-launched separately without inspector flags.
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const temporary = fs.mkdtempSync(path.join(root, '.tmp-build/pet-e2e-'));
const appSource = path.join(temporary, 'app-source');
fs.mkdirSync(appSource);
fs.cpSync(path.join(root, '.vite'), path.join(appSource, '.vite'), {
  recursive: true,
});
fs.copyFileSync(
  path.join(root, 'package.json'),
  path.join(appSource, 'package.json'),
);
const screenshots = path.join(temporary, 'screenshots');
fs.mkdirSync(screenshots);
let application;
const errors = [];
const server = createServer(async (request, response) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  const payload = JSON.parse(body);
  const test = payload.messages.at(-1)?.content === 'test';
  const greeting = payload.messages.at(-1)?.content === 'はじめまして';
  if (greeting) {
    assert.ok(payload.messages[0].content.includes('当前是普通聊天'));
    assert.ok(!payload.messages[0].content.includes('程序检索的真实本地课程'));
  }
  response.setHeader('Content-Type', 'application/json');
  response.end(
    JSON.stringify({
      choices: [
        {
          message: {
            content: test
              ? 'OK'
              : greeting
                ? JSON.stringify({
                    answer: 'はじめまして！会えてうれしいな。',
                    recommendations: [
                      { lessonId: 'jlpt-n5-001', reason: '应被过滤' },
                    ],
                    followUp: '应被过滤的考题',
                  })
                : JSON.stringify({
                    answer:
                      '「は」提示话题，「が」标记主语。私は学生です。（我是学生。）',
                    recommendations: [],
                    followUp: '请说说「雨が降っています」中 が 的作用。',
                  }),
          },
        },
      ],
    }),
  );
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
try {
  application = await electron.launch({
    executablePath: process.argv[2]
      ? path.resolve(process.argv[2])
      : path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: [appSource, `--user-data-dir=${path.join(temporary, 'user-data')}`],
    timeout: 30_000,
  });
  application.on('window', (window) =>
    window.on('pageerror', (error) => errors.push(error.message)),
  );
  await application.firstWindow();
  const main = await Promise.any(
    application.windows().map(async (page) => {
      await page.waitForFunction(() => Boolean(window.hiJapan), undefined, {
        timeout: 10_000,
      });
      return page;
    }),
  );
  let pet = application
    .windows()
    .find((page) => page.url().includes('pet.html'));
  if (!pet)
    pet = await application.waitForEvent('window', {
      predicate: (page) => page.url().includes('pet.html'),
    });
  await pet.locator('.pet-character img').waitFor({ state: 'attached' });
  await pet.waitForFunction(
    () => document.querySelector('.pet-character img')?.naturalWidth > 0,
  );
  assert.equal(
    await pet.evaluate(() => typeof window.hiJapan),
    'undefined',
    'pet must not receive main API',
  );
  assert.equal(
    await main.evaluate(() => typeof window.desktopPet),
    'undefined',
  );

  await pet.screenshot({
    path: path.join(screenshots, 'pet-idle.png'),
    omitBackground: true,
  });
  await pet.locator('.pet-name').click();
  await pet.getByRole('button', { name: '☾ 睡眠', exact: true }).click();
  await pet.locator('.activity-sleep').waitFor();
  await pet.locator('.pet-name').click();
  await pet.getByRole('button', { name: '☀ 唤醒', exact: true }).click();
  await pet.locator('.activity-idle').waitFor();
  await pet.locator('.pet-name').click();
  await pet.screenshot({
    path: path.join(screenshots, 'pet-menu.png'),
    omitBackground: true,
  });
  await pet.getByRole('button', { name: '⚙ 桌宠设置', exact: true }).click();

  // Fresh profile is deliberately created only in isolated test user-data.
  await main.evaluate(() =>
    window.hiJapan.app.saveProfile({
      displayName: '桌宠验收',
      primaryMode: 'travel',
      dailyMinutes: 10,
      level: 'starter',
      focusScenes: ['hotel'],
    }),
  );
  await main.reload();
  await main.getByRole('button', { name: /设置/ }).first().click();
  await main.getByRole('heading', { name: '桌面学习伙伴' }).waitFor();
  await main.getByLabel('锁定位置，防止误拖动').check();
  assert.equal(await pet.evaluate(() => window.desktopPet.beginDrag()), false);
  await main.getByLabel('减少动画').check();
  await pet.locator('.reduced-motion').waitFor();
  await main.getByRole('combobox', { name: '桌宠大小' }).selectOption('1.25');
  await pet.waitForFunction(() =>
    document
      .querySelector('.pet-scene')
      ?.getAttribute('style')
      ?.includes('1.25'),
  );
  assert.ok(
    await pet.evaluate(() => Math.abs(window.innerWidth - 350) <= 2),
    'allow native DPI rounding',
  );
  await pet.screenshot({
    path: path.join(screenshots, 'pet-large.png'),
    omitBackground: true,
  });
  await main.getByRole('combobox', { name: '桌宠大小' }).selectOption('1');
  await main.getByLabel('锁定位置，防止误拖动').uncheck();
  await pet.evaluate(() => window.desktopPet.beginDrag());
  await pet.locator('.activity-drag').waitFor();
  await pet.evaluate(() => window.desktopPet.endDrag());
  const point = await application.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find(
      (window) => window.getTitle() === 'HiJapan 学习伙伴',
    );
    return window.getBounds();
  });
  assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
  await pet.locator('.pet-name').click();
  await pet.getByRole('button', { name: '隐藏桌宠', exact: true }).click();
  assert.equal(
    (await main.evaluate(() => window.hiJapan.companion.getState())).preferences
      .enabled,
    false,
  );
  await main.getByLabel('显示桌宠（下次启动保持此选择）').check();
  assert.equal(
    (await pet.evaluate(() => window.desktopPet.getState())).preferences
      .enabled,
    true,
  );
  await main.screenshot({ path: path.join(screenshots, 'pet-settings.png') });
  const stored = JSON.parse(
    fs.readFileSync(path.join(temporary, 'user-data/desktop-pet.json'), 'utf8'),
  );
  assert.equal(stored.preferences.enabled, true);
  assert.equal(stored.preferences.reducedMotion, true);
  assert.equal(stored.preferences.scale, 1);
  const port = server.address().port;
  await main.evaluate(
    ({ port }) =>
      window.hiJapan.ai.saveAndTest({
        baseUrl: `http://127.0.0.1:${port}/v1`,
        apiKey: 'local-mock-placeholder',
        model: 'mock',
      }),
    { port },
  );
  await pet.evaluate(() => window.desktopPet.setChatOpen(true));
  await pet.getByRole('textbox', { name: '给桌宠的消息' }).fill('はじめまして');
  await pet.getByRole('button', { name: '发送', exact: true }).click();
  await pet
    .getByText('はじめまして！会えてうれしいな。', { exact: true })
    .waitFor();
  const casualHistory = await pet.evaluate(() => window.desktopPet.getChat());
  assert.equal(casualHistory.at(-1).recommendations.length, 0);
  assert.equal(casualHistory.at(-1).followUp, '');
  await pet
    .getByRole('textbox', { name: '给桌宠的消息' })
    .fill('は和が有什么区别');
  await pet.getByRole('button', { name: '发送', exact: true }).click();
  await pet.locator('.pet-course').first().waitFor();
  const history = await pet.evaluate(() => window.desktopPet.getChat());
  assert.ok(
    history.at(-1).recommendations.length > 0,
    'mandatory real-course recommendation',
  );
  assert.ok(history.at(-1).followUp.length > 0);
  await pet.screenshot({
    path: path.join(screenshots, 'pet-chat.png'),
    omitBackground: true,
  });
  await pet.locator('.pet-course').first().click();
  await main.locator('.jlpt-entry-panel').waitFor();
  for (const [mode, selector] of [
    ['matching', '.jlpt-match-board'],
    ['game', '.uta-game-board'],
    ['puzzle', '.sentence-puzzle-card'],
  ]) {
    await pet.evaluate(
      ({ id, mode }) => window.desktopPet.openLesson(`${id}::${mode}`),
      { id: history.at(-1).recommendations[0].lessonId, mode },
    );
    await main.locator(selector).waitFor();
  }
  await pet.evaluate(() => window.desktopPet.setChatOpen(false));
  assert.deepEqual(errors, []);
  await application.close();
  application = await electron.launch({
    executablePath: process.argv[2]
      ? path.resolve(process.argv[2])
      : path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: [appSource, `--user-data-dir=${path.join(temporary, 'user-data')}`],
    timeout: 30_000,
  });
  await application.firstWindow();
  const restored = await Promise.any(
    application.windows().map(async (page) => {
      await page.waitForFunction(() => Boolean(window.hiJapan), undefined, {
        timeout: 10_000,
      });
      return page;
    }),
  );
  const state = await restored.evaluate(() =>
    window.hiJapan.companion.getState(),
  );
  assert.equal(state.preferences.reducedMotion, true);
  assert.equal(state.preferences.enabled, true);
  assert.equal(state.preferences.scale, 1);
  await restored.evaluate(() => window.hiJapan.app.resetAllData());
  assert.equal(
    fs.existsSync(path.join(temporary, 'user-data/desktop-pet.json')),
    false,
  );
  assert.equal(
    (await restored.evaluate(() => window.hiJapan.companion.getState()))
      .preferences.enabled,
    false,
  );
  console.log(`Pet E2E passed: ${screenshots}`);
} finally {
  await application?.close();
  server.close();
}
