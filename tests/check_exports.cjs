/* Tests real standalone app downloads with a local headless Chromium. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const out=path.resolve(process.argv[2]||path.join(root,'validation','export-check'));
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_EXE||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--allow-file-access-from-files']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'振动AI实验助手.html')).href);
  await page.locator('#quickDefaults').click();await page.evaluate(()=>task());
  assert(await page.evaluate(()=>!!result?.stats?.points),'Real simulation missing');
  const results=[];
  for(const labels of ['automatic','Chinese-symbols']){
   for(const id of ['time','spectrum','phase','section','extra']){
    if(id==='extra')await page.locator('#analysisKind').selectOption('correlation_dimension');
    await page.locator('#exportPlot').selectOption(id);
    await page.locator('#figureXLabel').fill(labels==='automatic'?'':'时间 t（模型单位）');
    await page.locator('#figureYLabel').fill(labels==='automatic'?'':'位移 y₅（μm） / Ω²');
    for(const format of ['Png','Svg']){
     const pending=page.waitForEvent('download',{timeout:15000});
     await page.locator('#export'+format).click();
     const download=await pending;
     assert.equal(await download.failure(),null);
     const target=path.join(out,`${labels}-${id}.${format.toLowerCase()}`);
     await download.saveAs(target);
     results.push({labels,id,format,file:path.basename(target)});
    }
   }
  }
  // A custom time-axis title must not label a spectrum or another state.
  await page.locator('#exportPlot').selectOption('time');
  await page.locator('#figureXLabel').fill('仅时域使用的标题');
  await page.locator('#exportPlot').selectOption('spectrum');
  assert.notEqual(await page.locator('#figureXLabel').inputValue(),'仅时域使用的标题');
  await page.locator('#exportPlot').selectOption('time');
  assert.equal(await page.locator('#figureXLabel').inputValue(),'仅时域使用的标题');
  await page.locator('#timeAxis').selectOption('y1');
  assert.equal(await page.locator('#figureXLabel').inputValue(),'');
  await page.locator('#timeAxis').selectOption('y5');
  assert.equal(await page.locator('#figureXLabel').inputValue(),'仅时域使用的标题');
  // Range settings are scoped to a plot and selected state/analysis as well.
  await page.locator('#xmin').fill('400');await page.locator('#xmax').fill('500');await page.locator('#applyRange').click();
  await page.locator('#exportPlot').selectOption('spectrum');assert.equal(await page.locator('#xmin').inputValue(),'');
  await page.locator('#exportPlot').selectOption('time');assert.equal(await page.locator('#xmin').inputValue(),'400');
  await page.locator('#autoRange').click();
  // Each additional analysis must export independently, with the right axis titles.
  await page.locator('#exportPlot').selectOption('extra');
  for(const kind of ['lyapunov','rms','histogram','autocorrelation','custom']){
   await page.locator('#analysisKind').selectOption(kind);
   for(const format of ['Png','Svg']){
    const pending=page.waitForEvent('download');await page.locator('#export'+format).click();
    const download=await pending;assert.equal(await download.failure(),null);
    const file=`extra-${kind}.${format.toLowerCase()}`;await download.saveAs(path.join(out,file));results.push({labels:'automatic',id:kind,format,file});
   }
  }
  // Large fonts and tall/wide physical sizes exercise margins and title fitting.
  await page.locator('#exportPlot').selectOption('time');
  await page.locator('#figureXLabel').fill('时间 t & 激励相位 < Ωt（模型单位）');
  await page.locator('#figureYLabel').fill('位移响应 y₅ 与符号 μ、Ω²、λ（模型单位）');
  await page.locator('#figureFont').fill('24');
  for(const [w,h] of [[2,4],[8,2]]){
   await page.locator('#pngWidth').fill(String(w));await page.locator('#pngHeight').fill(String(h));
   for(const format of ['Png','Svg']){
    const pending=page.waitForEvent('download');await page.locator('#export'+format).click();const download=await pending;
    const file=`layout-${w}x${h}.${format.toLowerCase()}`;await download.saveAs(path.join(out,file));results.push({labels:'layout',id:'time',format,file});
   }
  }
  // Oversized image requests must fail explicitly, rather than download an empty image.
  await page.locator('#pngWidth').fill('16');await page.locator('#pngHeight').fill('16');await page.locator('#exportPng').click();
  await page.waitForFunction(()=>document.getElementById('pngState').textContent.includes('2400万像素'));
  await page.locator('#pngWidth').fill('6');await page.locator('#pngHeight').fill('4');await page.locator('#figureFont').fill('13');
  await page.locator('#openGuide').click();
  assert(await page.locator('dialog').evaluate(el=>el.open));
  await page.screenshot({path:path.join(out,'教程预览.png')});
  for(let i=0;i<8;i++)await page.locator('#guideNext').click();
  assert.match(await page.locator('#guideCount').innerText(),/9 \/ 9/);
  await page.locator('#guideLocate').click();assert(!await page.locator('dialog').evaluate(el=>el.open));
  assert(await page.locator('#status').evaluate(el=>el.classList.contains('guide-highlight')));
  await page.locator('#openGuide').click();await page.keyboard.press('Escape');
  assert(!await page.locator('dialog').evaluate(el=>el.open));
  await page.setViewportSize({width:390,height:844});await page.locator('#openGuide').click();
  await page.locator('#guideRestart').click();await page.screenshot({path:path.join(out,'教程手机预览.png')});
  const fit=await page.locator('dialog').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight});assert(fit);
  await page.locator('#guideClose').click();
  // Reload the SVG as an image in Chromium: verifies self-contained glyph images decode.
  for(const labels of ['automatic','Chinese-symbols']){
   const file=path.join(out,`${labels}-time.svg`);
   const p=await browser.newPage({viewport:{width:1200,height:800}});
   await p.goto(pathToFileURL(file).href);
   await p.screenshot({path:path.join(out,`${labels}-time-svg-render.png`)});await p.close();
  }
  assert.deepEqual(errors,[],'Unexpected browser JS error');
  await fs.writeFile(path.join(out,'browser-results.json'),JSON.stringify({ok:true,downloads:results,guide:'9 steps + locate + Escape passed',errors},null,2));
  console.log(`PASS: ${results.length} real PNG/SVG downloads, scoped titles/ranges, all analyses, size limits, desktop/mobile guide.`);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
