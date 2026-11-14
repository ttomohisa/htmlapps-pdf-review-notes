'use strict';
// Native Chromium checks run only in the existing unprivileged PR build job.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const PHONE_WIDTH = 820;
const HELP = "#helpButton", LANGUAGE = "#languageButton", CLOSE = "#closeHelpButton";
const artifacts = path.resolve('test-results/mobile-layout');

function syntheticPdf() {
  const stream = '0.09 0.38 0.31 rg 30 30 140 60 re f\n';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 240] /Resources << >> /Contents 4 0 R >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`];
  let data = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((value, index) => { offsets.push(Buffer.byteLength(data)); data += `${index + 1} 0 obj\n${value}\nendobj\n`; });
  const xref = Buffer.byteLength(data);
  data += `xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10,'0') + ' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(data);
}
function isPhone(width, height) { return width <= PHONE_WIDTH; }
async function checkActions(page, width, height, label) {
  const nav = page.locator('#mobileTabs');
  assert.equal(await nav.locator('button').count(), 2, label + ': functional actions retained');
  assert.equal(await nav.isVisible(), isPhone(width, height), label + ': functional bar breakpoint');
  if (isPhone(width, height)) {
    const box = await nav.boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= height + 1, label + ': action bar stays inside viewport');
  }
}
async function checkMobileToolbar(page, width, height, label) {
  if (!isPhone(width,height)) return;
  const groups = await Promise.all(['.page-toolbar-group','.zoom-stepper','.mode-switch','.area-toolbar-group'].map(selector=>page.locator('.viewer-toolbar '+selector).boundingBox()));
  assert.ok(groups.every(Boolean),label + ': all mobile toolbar groups are visible');
  const [pages,zoom,fit,area]=groups;
  for (const [index,box] of groups.entries()) {
    assert.ok(box.x>=-1 && box.x+box.width<=width+1,label+': mobile toolbar item '+index+' fits horizontally '+JSON.stringify(box));
  }
  assert.ok(Math.abs(pages.y-zoom.y)<=2,label+': page and zoom are aligned in the first row');
  assert.ok(Math.abs(fit.y-area.y)<=2,label+': fit and area controls are aligned in the second row');
  assert.ok(fit.y>=pages.y+pages.height-2,label+': clear separation between mobile rows');
  assert.ok(pages.x+pages.width<=zoom.x+2,label+': page navigation does not overlap zoom');
  assert.ok(fit.x+fit.width<=area.x+2,label+': fit controls do not overlap area review');
  for(const id of ['#previousPageButton','#nextPageButton','#zoomOutButton','#zoomInButton','#fitPageButton','#fitWidthButton','#areaReviewModeButton']) {
    const b=await page.locator(id).boundingBox();
    assert.ok(b&&b.height>=40&&b.width>=35,label+': touch target '+id+' at least 35x40 px');
  }
  assert.equal(await page.locator('.review-navigation').isVisible(),false,label+': unused review navigation hidden');
}
async function exerciseReviewWorkflow(page, width, height, label) {
  const area=page.locator('#areaReviewModeButton');
  await area.click();assert.equal(await area.getAttribute('aria-pressed'),'true',label+': area mode starts');
  const layer=page.locator('#areaLayer');await layer.scrollIntoViewIfNeeded();
  const b=await layer.boundingBox();assert.ok(b&&b.width>95&&b.height>95,label+': selectable area exists');
  const x=b.x+Math.min(25,b.width/4),y=b.y+Math.min(25,b.height/4);
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+50,y+50,{steps:6});await page.mouse.up();
  await page.locator('#reviewDialog').waitFor({state:'visible'});
  await page.locator('#reviewComment').fill('Release audit note');
  await page.locator('#addReviewButton').click();
  assert.equal(await page.locator('#reviewDialog').isVisible(),false,label+': review added and dialog closed');
  if(isPhone(width,height))await page.locator('#mobileReviewsTab').click();
  const card=page.locator('#reviewList .review-card');
  assert.equal(await card.count(),1,label+': card created');
  assert.match(await card.locator('.review-comment').textContent(),/Release audit note/);
  await card.locator('.review-secondary-actions .review-action').first().click();
  await page.locator('#reviewComment').fill('Updated release audit note');
  await page.locator('#addReviewButton').click();
  assert.match(await card.locator('.review-comment').textContent(),/Updated release audit note/);
  const trash=card.locator('.review-action.is-danger');
  assert.ok(await trash.getAttribute('aria-label'),label+': icon button is accessible');
  await trash.click();await page.locator('#appConfirmCancel').click();
  assert.equal(await card.count(),1,label+': cancel deletion preserves the card');
  await trash.click();await page.locator('#appConfirmOk').click();
  assert.equal(await card.count(),0,label+': confirmed deletion removes the card');
  await page.locator('#appToastAction').click();
  assert.equal(await card.count(),1,label+': Undo restores the card');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#exportSessionButton').click()]);
  assert.match(download.suggestedFilename(),/\.json$/,label+': session JSON is downloaded');
  const data=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  assert.equal(data.reviews.length,1,label+': session JSON contains review');
  assert.equal(data.reviews[0].comment,'Updated release audit note');
  await page.locator('#openExportButton').click();
  const [csv]=await Promise.all([page.waitForEvent('download'),page.locator('#exportCsvButton').click()]);
  assert.match(csv.suggestedFilename(),/\.csv$/,label+': CSV is downloaded');
  const csvData=fs.readFileSync(await csv.path(),'utf8');
  assert.match(csvData,/Updated release audit note/);
}
async function exerciseActions(page, width, height, label) {
  await page.locator('#fileInput').setInputFiles({name:'synthetic.pdf', mimeType:'application/pdf', buffer:syntheticPdf()});
  await page.locator('#readyState').waitFor();
  // A visible viewer/default canvas can precede parsing; wait for the fixture's green shape.
  await page.waitForFunction(() => {
    const canvas = document.querySelector('#pdfCanvas');
    if (!canvas || canvas.width <= 1 || canvas.height <= 1) return false;
    const pixel = canvas.getContext('2d').getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height * .75), 1, 1).data;
    return document.querySelector('#fileName').textContent === 'synthetic.pdf' && pixel[3] === 255 && pixel[1] > pixel[0] + 20;
  });
  if (isPhone(width, height)) {
    await page.locator('#mobileReviewsTab').click();
    assert.match(await page.locator('#mobileReviewsTab').getAttribute('class'), /is-active/);
    await page.locator('#mobilePdfTab').click();
  }
  await checkActions(page, width, height, label);
  await checkMobileToolbar(page, width, height, label);
  if((width===320&&height===568&&label.includes(' ja '))||(width===1360&&height===900&&label.includes(' en '))) await exerciseReviewWorkflow(page,width,height,label);
}

async function main() {
  fs.mkdirSync(artifacts, {recursive:true});
  const browser = await chromium.launch();
  try {
    const cases = [];
    for (const language of ['ja', 'en']) {
      for (const [width, height] of [[1360,900], [PHONE_WIDTH + 1,568], [PHONE_WIDTH,568], [320,568], [393,252]]) cases.push({file:'dist/index.html', language, width, height});
    }
    // Also load the compressed and root download variants, without duplicating the full matrix.
    cases.push({file:'dist/index.self-extract.html', language:'en', width:360, height:640});
    cases.push({file:'pdf-review-notes.html', language:'ja', width:1360, height:900});
    for (const {file, language, width, height} of cases) {
      const context = await browser.newContext({viewport:{width,height}, locale:language, reducedMotion:'reduce', acceptDownloads:true});
      const page = await context.newPage();
      const errors = [], requests = [];
      const label = `${file} ${language} ${width}x${height}`;
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
      try {
        await page.goto(pathToFileURL(path.resolve(file)).href);
        await page.locator(HELP).waitFor();
        if (await page.locator('html').getAttribute('lang') !== language) await page.locator(LANGUAGE).click();
        assert.equal((await page.locator('[data-i18n="localBadge"]').textContent()).trim(), language === 'en' ? 'Fully local processing' : '完全ローカル処理', label + ': privacy wording');
        assert.equal(await page.locator('.app-footer').isVisible(), !isPhone(width, height), label + ': informational footer breakpoint');
        const badge = page.locator('.local-badge');
        assert.equal(await badge.isVisible(), width > 820, label + ': preserve existing badge visibility');
        if (await badge.isVisible()) {
          const box = await badge.boundingBox(), text = await page.locator('[data-i18n="localBadge"]').boundingBox();
          assert.ok(box && text && box.x >= 0 && box.x + box.width <= width + 1 && text.x >= box.x && text.x + text.width <= box.x + box.width + 1, label + ': local-processing badge fits');
        }
        await exerciseActions(page, width, height, label);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label + ': page width');
        // Responsive changes must not leave the informational footer in a stale state.
        await page.setViewportSize({width:PHONE_WIDTH + 1, height});
        assert.equal(await page.locator('.app-footer').isVisible(), !isPhone(PHONE_WIDTH + 1, height), label + ': wider resize');
        await page.setViewportSize({width:PHONE_WIDTH, height});
        assert.equal(await page.locator('.app-footer').isVisible(), false, label + ': phone resize');
        await page.setViewportSize({width,height});
        // Capture the actual viewport after resize, not a stitched full-page image of fixed controls.
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await checkActions(page, width, height, label);
        if (file === 'dist/index.html' && [1360,320].includes(width)) await page.screenshot({path:path.join(artifacts, `${language}-${width}.png`)});

        await page.locator(HELP).click();
        const body = page.locator('#helpDialog .dialog-body');
        // The outer dialog remains clipped; only its internal body scrolls.
        await body.evaluate(el => { el.scrollTop = el.scrollHeight; });
        assert.equal(await body.evaluate(el => getComputedStyle(el).overflowY), 'auto', label + ': Help scroll remains inside the dialog');
        assert.equal(await page.locator('#helpDialog').evaluate(el => getComputedStyle(el).overflowY), 'hidden', label + ': outer Help frame never shows the scrollbar');
        const finalItem = page.locator('#helpDialog .dialog-body p:visible, #helpDialog .dialog-body li:visible').last();
        const end = await finalItem.evaluate(el => { const r = el.getBoundingClientRect(), b = el.closest('.dialog-body').getBoundingClientRect(), d = el.closest('dialog').getBoundingClientRect(); return {top:r.top,bottom:r.bottom,clipTop:Math.max(0,b.top,d.top),clipBottom:Math.min(innerHeight,b.bottom,d.bottom)}; });
        assert.ok(end.top >= end.clipTop - 1 && end.bottom <= end.clipBottom + 1, label + ': final Help guidance reachable ' + JSON.stringify(end));
        assert.ok(await body.evaluate(el => el.scrollWidth <= el.clientWidth + 1), label + ': Help width');
        const header = await page.locator('#helpDialog .dialog-head, #helpDialog .dialog-header').boundingBox();
        assert.ok(header && header.y >= 0 && header.y + header.height <= height, label + ': Help header visible');
        const beforeScroll = await page.evaluate(() => scrollY);
        await page.mouse.move(2, Math.floor(height / 2));
        await page.mouse.wheel(0,400);
        await page.waitForTimeout(100);
        assert.equal(await page.evaluate(() => scrollY), beforeScroll, label + ': modal background locked');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#helpDialog').isVisible(), false, label + ': Escape closes Help');
        await page.locator(HELP).click();
        await page.mouse.click(2, Math.floor(height / 2));
        assert.equal(await page.locator('#helpDialog').isVisible(), false, label + ': backdrop tap closes Help');
        await page.locator(HELP).click();
        await page.locator('#helpDialog').locator(CLOSE).first().click();
        assert.equal(await page.locator('#helpDialog').isVisible(), false, label + ': Help reopens and closes');
        assert.deepEqual(errors, [], label + ': console errors');
        assert.deepEqual(requests, [], label + ': no external runtime requests');
        console.log('PASS ' + label);
      } catch (error) {
        await page.screenshot({path:path.join(artifacts,'failure.png')}).catch(() => {});
        throw new Error(label + ': ' + error.message, {cause:error});
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
