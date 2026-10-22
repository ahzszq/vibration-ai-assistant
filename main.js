const names={Omegaet:'激励频率1',Omegaeh:'激励频率2',Phih:'相位1',Phit:'相位2',Epsilon11:'阻尼系数1',Epsilon13:'耦合阻尼1',Epsilon22:'阻尼系数2',Epsilon23:'耦合阻尼2',Epsilon33:'阻尼系数3',K11:'刚度1',K13:'耦合刚度1',K22:'刚度2',K23:'耦合刚度2',Ffb:'力参数1',Ffp:'力参数2',Ffm:'力参数3',Fat:'激励振幅1',Fah:'激励振幅2',HG:'阈值1',Hb1:'阈值2',Hb2:'阈值3',NT_total:'总迭代周期',NT_start:'开始输出周期',NN:'每周期步数'};
const $=id=>document.getElementById(id);let result=null,busy=false;const plotRanges={},figureTitles={};
const groups=[['系统参数',['Omegaet','Omegaeh','Phih','Phit']],['阻尼参数',['Epsilon11','Epsilon13','Epsilon22','Epsilon23','Epsilon33']],['刚度参数',['K11','K13','K22','K23']],['力参数',['Ffb','Ffp','Ffm','Fat','Fah']],['几何参数',['HG','Hb1','Hb2']],['计算参数',['NT_total','NT_start','NN']]];
for(const [title,keys] of groups){const section=document.createElement('details');section.open=['系统参数','计算参数'].includes(title);const summary=document.createElement('summary');summary.textContent=title;section.append(summary);for(const k of keys){const l=document.createElement('label');l.textContent=`${names[k]} / ${k}`;const i=document.createElement('input');i.type='number';i.step=['NT_total','NT_start','NN'].includes(k)?'1':'any';i.value=defaults[k];i.id='p_'+k;i.title=`原代码默认值：${defaults[k]}`;i.addEventListener('input',()=>parameterChanged('已手动修改参数。'));l.append(i);section.append(l)}$('fields').append(section)}
function parameterChanged(message){$('parameterState').textContent=message;if(result)$('resultMeta').textContent='参数已更改：图表仍对应上一次运行，需重新仿真。';document.dispatchEvent(new Event('parameters-changed'))}
function fillParameters(values,message){for(const [k,v] of Object.entries(values))if(k in defaults)$('p_'+k).value=v;parameterChanged(message)}
$('resetDefaults').onclick=()=>fillParameters(defaults,'已恢复原代码全部默认值：20000周期 / 从12000周期后输出 / 每周期256步。');
$('quickDefaults').onclick=()=>fillParameters({...defaults,NT_total:100,NT_start:60,NN:96},'快速试算：100周期 / 从60周期后输出 / 每周期96步。其余参数恢复原值。');
function params(){return Object.fromEntries(Object.keys(defaults).map(k=>{const input=$('p_'+k);if(input.value.trim()==='')throw Error('请填写 '+k);const value=Number(input.value);if(!Number.isFinite(value))throw Error('请填写有效数值：'+k);return [k,value]}))}
function save(name,text,type='application/json'){const u=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000)}
// The same layout is used by the dark preview, white PNG and white SVG.
function figureTitleKey(id){return id==='extra'?`${id}:${$('analysisKind')?.value}`:id==='time'?`${id}:${$('timeAxis')?.value}`:id==='phase'?`${id}:${$('phaseX')?.value}:${$('phaseY')?.value}`:id==='spectrum'?`${id}:${$('spectrumScale')?.value}`:id}
function plotLabels(id){
 const kind=$('analysisKind')?.value;
 const base={time:['t (model time)',$('timeAxis')?.value||'y5'],spectrum:['f (1/model time)',$('spectrumScale')?.value==='db'?'10 log10 [PSD / 1 model unit]':'PSD [y5² / (1/model time)]'],phase:[$('phaseX')?.value||'y5',$('phaseY')?.value||'y6'],section:['y5','y6'],extra:kind==='lyapunov'?['t (model time)','Maximum finite-time Lyapunov exponent']:kind==='correlation_dimension'?['log r','log C(r)']:kind==='rms'?['t (model time)','RMS (y5)']:kind==='histogram'?['y5','Count']:kind==='autocorrelation'?['Lag (model time)','Autocorrelation']:[$('phaseX')?.value||'y5',$('phaseY')?.value||'y6']};
 const title=figureTitles[figureTitleKey(id)]||{};
 return [title.x||base[id][0],title.y||base[id][1]];
}
function paperPlot(ctx,width,height,points,id,exportMode=false){
 const u=Math.min(width/460,height/300),font=Math.max(8,Number($('figureFont')?.value||13))*u;
 const bg=exportMode?'#fff':'#0e192b',ink=exportMode?'#111827':'#e6edf5',rule=exportMode?'#374151':'#aabbd0';
 ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
 if(!points.length)return;
 const finite=points.filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));if(!finite.length)return;
 let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
 for(const [x,y] of finite){xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);ymin=Math.min(ymin,y);ymax=Math.max(ymax,y)}
 if(xmin===xmax){xmin-=.5;xmax+=.5}if(ymin===ymax){ymin-=.5;ymax+=.5}
 const yp=(ymax-ymin)*.06;ymin-=yp;ymax+=yp;if(id==='spectrum'&&$('spectrumScale')?.value!=='db')ymin=0;
 const range=plotRanges[figureTitleKey(id)];if(range){xmin=range.xmin??xmin;xmax=range.xmax??xmax;ymin=range.ymin??ymin;ymax=range.ymax??ymax}
 if(xmin===xmax)xmax=xmin+1;if(ymin===ymax)ymax=ymin+1;
 const fmt=v=>v===0?'0':Math.abs(v)>=1e4||Math.abs(v)<.001?v.toExponential(1):Number(v.toPrecision(4)).toString();
 ctx.font=`${font}px "Times New Roman", "Microsoft YaHei", serif`;
 const widest=Math.max(...Array.from({length:5},(_,i)=>ctx.measureText(fmt(ymin+(ymax-ymin)*i/4)).width));
 const xLabels=Array.from({length:5},(_,i)=>fmt(xmin+(xmax-xmin)*i/4));
 const maxX=Math.max(...xLabels.map(s=>ctx.measureText(s).width));
 const left=Math.max(70*u,widest+font/2+24*u),right=width-Math.max(24*u,ctx.measureText(xLabels[4]).width/2+8*u),top=20*u,bottom=height-Math.max(62*u,font*2.4+15*u);
 if(right-left<40*u||bottom-top<40*u)return;
 const xf=x=>left+(x-xmin)/(xmax-xmin)*(right-left),yf=y=>bottom-(y-ymin)/(ymax-ymin)*(bottom-top);
 ctx.strokeStyle=rule;ctx.fillStyle=ink;ctx.lineWidth=.8*u;ctx.strokeRect(left,top,right-left,bottom-top);
 const xStep=maxX+12*u>(right-left)/4?2:1;
 for(let i=0;i<=4;i++){
  const x=left+(right-left)*i/4,y=bottom-(bottom-top)*i/4;
  ctx.beginPath();ctx.moveTo(x,bottom);ctx.lineTo(x,bottom-5*u);ctx.moveTo(left,y);ctx.lineTo(left+5*u,y);ctx.stroke();
  ctx.textBaseline='middle';ctx.textAlign='right';ctx.fillText(fmt(ymin+(ymax-ymin)*i/4),left-9*u,y);
  if(i%xStep===0){ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(xLabels[i],x,bottom+9*u)}
 }
 const [xLabel,yLabel]=plotLabels(id);
 const labelFont=font*Math.min(1,(right-left)/(Math.max(1,ctx.measureText(xLabel).width)*1.08));
 ctx.font=`${labelFont}px "Times New Roman", "Microsoft YaHei", serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(xLabel,(left+right)/2,height-17*u);
 ctx.font=`${font}px "Times New Roman", "Microsoft YaHei", serif`;
 const yFont=font*Math.min(1,(bottom-top)/(Math.max(1,ctx.measureText(yLabel).width)*1.08));
 ctx.save();ctx.translate(17*u,(top+bottom)/2);ctx.rotate(-Math.PI/2);ctx.font=`${yFont}px "Times New Roman", "Microsoft YaHei", serif`;ctx.fillText(yLabel,0,0);ctx.restore();
 ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
 ctx.strokeStyle=exportMode?'#173ab8':({phase:'#ffc978',section:'#e291ee',extra:'#ef7777',spectrum:'#83a9ff'}[id]||'#83a9ff');ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=Math.max(.5,Number($('figureLine')?.value||.6))*u;ctx.lineJoin='round';
 const dots=id==='section'||(id==='extra'&&$('analysisKind')?.value==='histogram');
 if(dots){for(const [x,y] of finite){ctx.beginPath();ctx.arc(xf(x),yf(y),1.6*u,0,Math.PI*2);ctx.fill()}}
 else{ctx.beginPath();finite.forEach(([x,y],i)=>i?ctx.lineTo(xf(x),yf(y)):ctx.moveTo(xf(x),yf(y)));ctx.stroke()}
 ctx.restore();
}
function chart(id,points){const c=$(id),r=c.getBoundingClientRect(),d=devicePixelRatio||1,h=(id==='time'||id==='spectrum')?300:235;c.width=Math.round(r.width*d);c.height=Math.round(h*d);const ctx=c.getContext('2d');ctx.scale(d,d);paperPlot(ctx,r.width,h,points,id,false)}

function draw(){if(!result)return;chart('time',result.series.map(r=>[r[0],r[1]]));chart('phase',result.phase||result.series.map(r=>[r[1],r[2]]),'#ffc978');const sampling=result.sampling;if(sampling?.phase_points)$('phaseNote').textContent=`横轴：位移 y5　纵轴：速度 y6 = dy5/dt。末 ${sampling.phase_cycles} 个激励周期，${sampling.phase_points} 个连续积分点；未作稳态判定。`;chart('spectrum',spectrumPoints(),'#83a9ff');chart('section',result.poincare,'#e291ee',true)}
function show(r){result=r;$('resultMeta').textContent=`${r.stats.points.toLocaleString()} 个采样点 · ${r.stats.seconds.toFixed(2)} 秒 · 本次结果对应运行时参数`;const s=r.stats;$('rms').textContent=s.rms.toFixed(5);$('peak').textContent=s.peak.toFixed(5);$('freq').textContent=s.dominant_frequency.toFixed(5);$('csv').disabled=false;draw();window.drawAnalysis?.()}
async function task(){if(busy||window.assistantIsBusy?.())return;busy=true;document.dispatchEvent(new Event('task-state-changed'));try{const current=params();$('status').textContent=`正在使用当前手动参数积分求解… 共${(current.NT_total*current.NN).toLocaleString()}步，请保持页面打开。`;const data=await requestApi('simulate',current);show(data);$('status').textContent=`仿真完成：${data.stats.points} 个采样点，用时 ${data.stats.seconds.toFixed(2)} 秒。图表按需抽样，截面使用实际状态速度。`}catch(e){$('status').textContent='任务失败：'+e.message}finally{busy=false;document.dispatchEvent(new Event('task-state-changed'))}}
$('run').onclick=()=>task('simulate');$('config').onclick=()=>{try{save('参数.json',JSON.stringify(params(),null,2))}catch(e){$('status').textContent=e.message}};$('load').onclick=()=>$('file').click();$('file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;const p=JSON.parse(await file.text());if(!p||Array.isArray(p)||typeof p!=='object')throw Error('请选择参数JSON对象');for(const k of Object.keys(defaults)){if(k in p){if(typeof p[k]!=='number'||!Number.isFinite(p[k]))throw Error('参数不是有限数值：'+k)}}for(const k of Object.keys(defaults))if(k in p)$('p_'+k).value=p[k];parameterChanged('已导入参数，请核对后运行。');$('status').textContent='参数已导入，请重新仿真。'}catch(e){$('status').textContent='导入失败：'+e.message}};
$('csv').onclick=()=>save('图表抽样数据.csv','time,y5,y6\n'+result.series.map(r=>r.join(',')).join('\n'),'text/csv;charset=utf-8');let resizeFrame;window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(draw)});

async function requestApi(path,data){
  let response;
  const job=window.crypto?.randomUUID?.()||String(Date.now())+Math.random();let timer=null;const start=Date.now();const stages={waiting:'排队等待',preparing:'准备计算',integrating:'积分求解',analysis:'统计分析与图表整理',finished:'接收结果'};
  if(['simulate','execute','sweep'].includes(path)){const poll=async()=>{try{const r=await fetch('/api/progress?id='+job);const p=await r.json();const detail=p.total?` · 已积分 ${p.completed.toLocaleString()}/${p.total.toLocaleString()} 步（单组）`:'';$('status').textContent=`${stages[p.stage]||'等待计算'}${detail} · 已等待 ${Math.floor((Date.now()-start)/1000)} 秒；多组任务逐组更新。`}catch{}};timer=setInterval(poll,700)}
  try{response=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Job-Id':job},body:JSON.stringify(data)})}
  catch{throw Error('无法连接计算服务，请确认后端仍在运行')}finally{if(timer)clearInterval(timer)}
  let body;try{body=await response.json()}catch{throw Error('服务返回格式异常，请检查服务是否仍在运行')}
  if(!response.ok)throw Error(body.error||`请求失败（${response.status}）`);
  return body;
}
function syncTaskControls(){
 const locked=busy||Boolean(window.assistantIsBusy?.());
 for(const id of ['run','resetDefaults','quickDefaults','load'])$(id).disabled=locked;

 document.querySelectorAll('#fields input').forEach(el=>el.disabled=locked);
 $('workspace').setAttribute('aria-busy',String(locked));
}
document.addEventListener('task-state-changed',syncTaskControls);
$('openAssistant').onclick=()=>{$('assistantTools').open=true;$('openAssistant').setAttribute('aria-expanded','true');$('assistantTools').scrollIntoView({behavior:'smooth',block:'start'})};
$('assistantTools').addEventListener('toggle',()=>{$('openAssistant').setAttribute('aria-expanded',String($('assistantTools').open))});
$('chatLauncher').onclick=()=>{$('chatDock').hidden=false;$('chatInput')?.focus()};
$('closeChat').onclick=()=>{$('chatDock').hidden=true};
