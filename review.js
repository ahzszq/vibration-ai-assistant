/* Short, reproducible demonstrations. Every curve is computed by the solver. */
(() => {
 const card=document.createElement('section');card.className='review-card';card.setAttribute('aria-label','快速实验');
 card.innerHTML=`<div class="review-intro"><div><span class="tag">从参数到可复现实验</span><h2>快速查看振动响应，比较阻尼影响</h2><p>面向已有动力学方程的科研试算：手动设置或 AI 调参 → 本地求解 → 分析与导出。</p></div><span class="review-badge">无需密钥可试算</span></div>
 <ol class="review-steps"><li>设置实验参数</li><li>求解六状态方程</li><li>对比响应指标</li><li>导出图表与记录</li></ol>
 <div class="actions"><button id="demoSingle">一键快速试算</button><button id="demoCompare" class="secondary">三组阻尼对比</button><button id="demoAI" class="secondary">向 AI 追问结果</button><button id="demoExport" class="secondary" disabled>导出对比记录</button></div>
 <p id="demoStatus" role="status">试算将载入快速配置：180 周期、舍弃前80周期、每周期128步。原代码默认值可在左侧恢复；耗时取决于设备。</p>
 <div id="demoComparison" hidden><div class="scroll-table"><table id="demoTable"></table></div><label>查看某组完整图表<select id="demoCase"></select></label><p id="demoConclusion"></p></div>
 <details class="review-details"><summary>计算依据与适用范围</summary><p>数值由原始六状态方程计算，AI 用于需求解析、调参和结果问答。当前模型未进行设备单位标定；响应差异属于本次仿真对比，不直接代表工程改进。附加分析包含有限时间李雅普诺夫指数和关联维数参考图。</p><p>已有两项解析基准和步长 / 时长敏感性验证；验证脚本及报告见项目 validation 目录。对比试算使用较短窗口，论文使用前需单独复核收敛。</p></details>`;
 $('workspace').prepend(card);
 let demoExperiment=null;
 const controls=['demoSingle','demoCompare','demoAI','demoCase'];
 function locked(){return busy||Boolean(window.assistantIsBusy?.())}
 function sync(){controls.forEach(id=>$(id).disabled=locked());$('demoExport').disabled=locked()||!demoExperiment}
 document.addEventListener('task-state-changed',sync);
 // AI operations also use setAssistantBusy rather than task-state-changed.
 const observe=new MutationObserver(sync);observe.observe($('run'),{attributes:true,attributeFilter:['disabled']});
 async function runDemo(compare){
  if(locked())return;
  busy=true;document.dispatchEvent(new Event('task-state-changed'));
  const started=performance.now();let runs=[];
  demoExperiment=null;$('demoExport').disabled=true;$('demoComparison').hidden=true;
  const base={...defaults,NT_total:180,NT_start:80,NN:128};
  const values=compare?[.02,.04,.06]:[defaults.Epsilon33];
  try{
   for(let i=0;i<values.length;i++){
    const p={...base,Epsilon33:values[i]};
    fillParameters(p,`快速实验 ${i+1}/${values.length}：Epsilon33=${values[i]}。`);
    $('demoStatus').textContent=`正在求解第 ${i+1}/${values.length} 组，Epsilon33=${values[i]}；图表将显示本次真实计算结果…`;
    // Yield once so the progress message appears before browser computation.
    await new Promise(resolve=>setTimeout(resolve,30));
    const r=await requestApi('simulate',p);runs.push({name:`Epsilon33=${values[i]}`,result:r});show(r);
   }
   demoExperiment={schema:'vibration-comparison-v1',generated_at:new Date().toISOString(),
    origin:'local_solver',ai_used:false,changed_parameter:'Epsilon33',
    elapsed_seconds:(performance.now()-started)/1000,
    method:'Original six-state equations; fixed-step Runge–Kutta; mean-removed Hann one-sided PSD',
    limits:'Short-window comparison, uncalibrated model units. No engineering or chaos conclusion.',runs};
   const table=$('demoTable');table.replaceChildren();addRow(table,['阻尼 Epsilon33','位移 RMS','绝对峰值','主频（模型时间⁻¹）','RMS 相对基准变化'],true);
   const baseline=runs[0].result.stats.rms;
   for(const [i,run] of runs.entries()){
    const s=run.result.stats,change=baseline?(s.rms/baseline-1)*100:null;
    addRow(table,[run.result.params.Epsilon33,s.rms.toPrecision(7),s.peak.toPrecision(7),s.dominant_frequency.toPrecision(7),i===0?'基准':change==null?'基准为零':`${change>=0?'+':''}${change.toFixed(2)}%`]);
   }
   $('demoCase').replaceChildren();runs.forEach((r,i)=>{const option=document.createElement('option');option.value=i;option.textContent=r.name;$('demoCase').append(option)});
   $('demoCase').value=String(runs.length-1);$('demoComparison').hidden=false;
   $('demoConclusion').textContent=compare?'仅改变 Epsilon33，其他物理参数、初值、步长和输出窗口一致。正值表示 RMS 增大，负值表示减小；这不是最优参数搜索。':'本次结果来自实时积分，可向 AI 提问或导出完整记录。';
   $('demoStatus').textContent=`完成 ${runs.length} 组真实计算，用时 ${demoExperiment.elapsed_seconds.toFixed(2)} 秒。可切换图表并导出含参数、指标和数据的记录。`;
   $('status').textContent='快速实验完成。下方图表对应所选实验组。';
  }catch(e){$('demoStatus').textContent=`实验未完成（已完成 ${runs.length}/${values.length} 组）：${e.message}。可重试。`;}
  finally{busy=false;document.dispatchEvent(new Event('task-state-changed'));sync()}
 }
 $('demoSingle').onclick=()=>runDemo(false);$('demoCompare').onclick=()=>runDemo(true);
 $('demoCase').onchange=()=>{const r=demoExperiment?.runs[Number($('demoCase').value)];if(r){fillParameters(r.result.params,'已载入对比组：'+r.name);show(r.result)}};
 $('demoAI').onclick=()=>{
  if(demoExperiment){experiment={runs:demoExperiment.runs,generated_at:demoExperiment.generated_at};$('exportTask').disabled=false;}
  $('chatDock').hidden=false;
  $('chatInput').value=demoExperiment?.runs.length>1?'请根据本次三组实验的真实统计量，比较 Epsilon33 对 RMS 和峰值的影响，区分计算事实与推测，并说明还需要哪些验证。':'请根据当前结果解释 RMS、峰值和主频，并说明本次仿真的局限。';
  $('chatState').textContent='示例问题已填写，配置模型后点击发送。此次尚未调用 AI。';$('chatInput').focus();
 };
 $('demoExport').onclick=()=>{if(demoExperiment)save('阻尼对比实验记录.json',JSON.stringify(demoExperiment,null,2))};
 sync();
})();
