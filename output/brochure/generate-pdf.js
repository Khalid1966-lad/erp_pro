const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  const htmlPath = path.resolve(__dirname, 'gemaplast-erp-brochure.html');
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0', timeout: 30000 });
  
  const outputPath = path.resolve(__dirname, 'GEMAPLAST_ERP_PRO_Brochure.pdf');
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: '0',
    preferCSSPageSize: true
  });
  
  console.log('PDF generated:', outputPath);
  
  await browser.close();
})();
