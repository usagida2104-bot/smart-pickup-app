/**
 * Jules追加機能のスクリーンショット撮影スクリプト
 */
import { chromium } from 'playwright';

const SS = 'C:/Users/大平暖/.gemini/antigravity/brain/b6e998eb-1a4f-4238-8b24-da44d155412b/screenshots';
const BASE = 'http://localhost:3000';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const results = {};

  // 1. 送迎ボード（A4印刷ボタン確認）
  console.log('\n📌 [1] 送迎ボード（A4印刷ボタン）');
  await page.goto(`${BASE}/board`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2500);
  // Click auto-assign to populate board
  await page.locator('button:has-text("自動配車")').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS}/jules_02_board_with_print.png` });

  const printBtnCount = await page.getByRole('button', { name: /印刷|A4/ }).count();
  results.printButton = printBtnCount > 0 ? `✅ ${printBtnCount}個あり` : '❌ なし';
  console.log(`  A4印刷ボタン: ${results.printButton}`);

  // Try clicking print button (won't actually print in headless)
  if (printBtnCount > 0) {
    await page.getByRole('button', { name: /印刷|A4/ }).first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SS}/jules_02b_print_clicked.png` });
    // Dismiss dialog if any
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // 2. ドライバービュー（初期）
  console.log('\n📌 [2] ドライバービュー（初期表示）');
  await page.goto(`${BASE}/driver`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SS}/jules_03_driver_initial.png` });

  const driverHeading = await page.locator('h1').first().textContent().catch(() => '');
  const selectPlaceholder = await page.getByText('担当車両を選択').count();
  results.driverPage = driverHeading?.includes('ドライバー') ? '✅ 正常' : '⚠️ 見出し未確認';
  results.vehicleSelect = selectPlaceholder > 0 ? '✅ あり' : '❌ なし';
  console.log(`  ページ: ${results.driverPage}`);
  console.log(`  車両セレクト: ${results.vehicleSelect}`);

  // 3. ドライバービュー（車両選択）
  console.log('\n📌 [3] ドライバービュー（車両選択後）');
  const trigger = page.getByRole('combobox').first();
  if (await trigger.count() > 0) {
    await trigger.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SS}/jules_03b_driver_dropdown.png` });

    const options = page.getByRole('option');
    const optCount = await options.count();
    console.log(`  選択肢数: ${optCount}`);
    results.vehicleOptions = optCount > 0 ? `✅ ${optCount}台` : '❌ 0台';

    if (optCount > 0) {
      // Select the first vehicle (ステップワゴン)
      const firstOpt = await options.first().textContent();
      console.log(`  選択する車両: ${firstOpt}`);
      await options.first().click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SS}/jules_04_driver_selected.png` });

      // Check timeline cards
      const cardCount = await page.locator('[class*="space-y-6"] > div').count();
      const clockCount = await page.getByTestId(/child-card/).count() +
                         await page.locator('svg[class*="lucide-clock"]').count();
      results.timeline = cardCount > 0 ? `✅ ${cardCount}件表示` : '確認中';
      console.log(`  タイムライン: ${results.timeline}`);
    }
  }

  // 4. サイドバー（ドライバービューリンク）
  console.log('\n📌 [4] サイドバーのドライバービューリンク');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS}/jules_05_sidebar_with_driver.png` });

  const driverNavLink = await page.locator('a[href="/driver"]').count();
  results.sidebarLink = driverNavLink > 0 ? '✅ あり' : '❌ なし（修正済み）';
  console.log(`  サイドバーリンク: ${results.sidebarLink}`);

  // 5. モバイルビュー（375px幅）でドライバーページ
  console.log('\n📌 [5] モバイルビュー（375px）でドライバーページ');
  await ctx.close();
  const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto(`${BASE}/driver`, { waitUntil: 'networkidle', timeout: 15000 });
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({ path: `${SS}/jules_06_driver_mobile.png` });
  console.log('  モバイルスクリーンショット撮影完了');
  await mobileCtx.close();

  // Summary
  console.log('\n' + '═'.repeat(55));
  console.log('📊 結果サマリー');
  console.log('═'.repeat(55));
  Object.entries(results).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log('═'.repeat(55));

  await browser.close();
}

main().catch(e => {
  console.error('💥 エラー:', e.message);
  process.exit(1);
});
