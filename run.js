import { chromium } from 'playwright';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const email = process.env.EMAIL;
const password = process.env.PASSWORD;
const rawMonth = process.env.MONTH;

if (!email || !password || !rawMonth) {
  console.error('❌ Brakuje EMAIL, PASSWORD lub MONTH w .env');
  process.exit(1);
}

function getDatesInMonth(month) {
  const [year, monthNum] = month.split('-').map(Number);
  const days = new Date(year, monthNum, 0).getDate();
  const dates = [];
  for (let d = 1; d <= days; d++) {
    const day = String(d).padStart(2, '0');
    const m = String(monthNum).padStart(2, '0');
    dates.push({
      from: `${year}/${m}/${day} 00:00:00`,
      to: `${year}/${m}/${day} 23:59:59`,
      label: `${year}-${m}-${day}`
    });
  }
  return dates;
}

(async () => {
  console.log(`🔐 Logowanie jako ${email} dla miesiąca ${rawMonth}...`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    await page.goto('https://panel.posbistro.com/users/sign_in', { waitUntil: 'networkidle' });
    await page.fill('#email', email);
    await page.fill('#password', password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('input.btn'),
    ]);
    console.log('✅ Zalogowano.');

    // Ustaw katalog ./downloads
    const reportsDir = path.resolve('./downloads');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

    const baseUrl = 'https://panel.posbistro.com/locations/f1767d0d-c3cb-27e5-5a15-da63f3b0c4cc/reports/item_sales.csv';
    const dates = getDatesInMonth(rawMonth);
    const total = dates.length;

    for (let i = 0; i < total; i++) {
      const { from, to, label } = dates[i];
      const query = new URLSearchParams({
        time_range: 'time_range',
        ignore_rw: 'false',
        show_purchase_value: 'false',
        show_net_profit: 'false',
        show_orders: 'false',
        show_guests: 'false',
        show_product_price: 'false',
        show_service_price: 'false',
        ignore_zero_foodcost: 'false',
        group_by: 'no_grouping',
        include_value: 'all',
        business_id: '',
        from,
        to,
      });

      const fullUrl = `${baseUrl}?${query}`;
      console.log(`⬇️  Pobieranie: ${label}`);

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.evaluate((url) => { window.location.href = url; }, fullUrl),
      ]);

      const filePath = path.join(reportsDir, `raport-${label}.csv`);
      await download.saveAs(filePath);
      console.log(`✅ Zapisano: ${filePath}`);

      const progress = Math.round(((i + 1) / total) * 100);
      console.log(JSON.stringify({ progress, label }));

      await new Promise(r => setTimeout(r, 500));
    }

  } catch (err) {
    console.error('❌ Błąd:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
