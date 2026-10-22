(() => {
 const entry=document.createElement('button');entry.className='text-button';entry.textContent='使用教程';entry.id='openGuide';entry.setAttribute('aria-haspopup','dialog');
 document.querySelector('.entry-modes').append(entry);
 const modal=document.createElement('dialog');modal.className='guide-dialog';modal.setAttribute('aria-label','使用教程');
 modal.innerHTML=`<div class="guide-header"><strong>振动 AI · 使用教程</strong><button id="guideClose" class="secondary">关闭</button></div><p id="guideCount"></p><h2 id="guideTitle"></h2><div id="guideText"></div><div class="actions"><button id="guideRestart" class="secondary">从头开始</button><button id="guideLocate" class="secondary">查看对应位置</button><button id="guideBack" class="secondary">上一步</button><button id="guideNext">下一步</button></div><small>教程不会修改参数，也不会自动调用 AI 或运行计算。</small>`;
 document.body.append(modal);
 const steps=[
  ['先看一组结果','点击“一键快速试算”即可实时计算，无需配置 AI。页面初始参数是原代码默认值；快速试算会改用短计算配置。正式研究可在左侧恢复默认值。','#demoSingle'],
  ['手动调整参数','左侧可修改阻尼、刚度、激励与计算参数。修改后旧图仍属于上次运行，请重新点击“运行物理仿真”。NT_total 为总周期，NT_start 为舍弃的前段周期，NN 为每周期积分步数。','#manualPanel'],
  ['读懂动力学图','时域图展示选定状态随时间变化；相轨线默认 y5–y6 连续轨迹；功率谱默认去均值、Hann窗、单边PSD；庞加莱截面每激励周期取一点。所有时间、频率均为模型单位。','#charts'],
  ['切换附加分析','在“附加分析”下拉框选择李雅普诺夫指数、自相关或关联维数参考图。先运行仿真。有限时间指数和参考斜率都不能单独证明混沌。','#analysisKind'],
  ['配置 AI 与连续提问','打开“AI 辅助工具 → 模型配置”，选择服务商、填写 API 地址、模型ID和自己的密钥，再测试连接。右下角“AI 连续提问”支持追问。默认只调参，自动执行须在对话中开启。密钥不保存。','#assistantTools'],
  ['从 PDF 生成实验','在 AI 辅助工具中导入文本PDF或TXT/CSV/JSON/MD，查看本地提取文本，再描述需求并点击“AI解析需求与文档”。核对参数来源与实验计划后运行；扫描PDF当前不支持OCR。','#documentFile'],
  ['比较参数影响','点击“三组阻尼对比”生成三次真实仿真，切换实验查看图表。表格只反映当前模型与计算窗口；论文结果须另做步长与时长复核。','#demoCompare'],
  ['导出清晰图片','先运行，再在“导出图”选择目标，再设置该图的轴标题、字体、范围、宽高和DPI。标题按图分别保存，切换图或状态不会串用标题。建议6×4英寸、600 DPI，即3600×2400像素。PNG与SVG均为白底；网页保持深色。SVG曲线为矢量、文字内嵌768 DPI图层，免除接收电脑字体依赖；它不是全文字可编辑的纯矢量文件。CSV可核对当前图的数据。','#exportPlot'],
  ['遇到问题如何检查','图空白：先运行并检查所选分析是否有数据。AI失败：检查模型ID、地址、额度及网络，密钥只填配置框。坐标不合适：恢复自动范围，清空自定义标题再试。保存原始参数和实验记录，才能复现结果。','#status']
 ];let index=0;
 function render(){const [title,text]=steps[index];$('guideCount').textContent=`${index+1} / ${steps.length}`;$('guideTitle').textContent=title;$('guideText').textContent=text;$('guideBack').disabled=index===0;$('guideNext').textContent=index===steps.length-1?'完成':'下一步';}
 function open(){render();modal.showModal()}
 entry.onclick=open;$('guideClose').onclick=()=>modal.close();
 $('guideRestart').onclick=()=>{index=0;render()};
 $('guideBack').onclick=()=>{if(index>0){index--;render()}};
 $('guideNext').onclick=()=>{if(index<steps.length-1){index++;render()}else modal.close()};
 $('guideLocate').onclick=()=>{
  const el=document.querySelector(steps[index][2]);if(!el)return;
  for(let parent=el.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
  if(el.tagName==='DETAILS')el.open=true;
  modal.close();el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('guide-highlight');setTimeout(()=>el.classList.remove('guide-highlight'),3500);
 };
 // Always visible, no first-visit storage or forced popup.
 const hint=document.createElement('button');hint.className='secondary';hint.textContent='新手教程 · 9 步上手';hint.onclick=open;
 document.querySelector('.review-card .actions').append(hint);
})();
