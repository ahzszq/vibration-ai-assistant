const stateNames=['y1','y2','y3','y4','y5','y6'];
// Browser simulations and older saved results may not include this analysis.
// Use the same normalized two-state reference calculation as engine.py.
function correlationReference(rows){
 const empty=note=>({status:'insufficient_data',samples:[],slope:null,note});
 let points=rows.map(r=>[r[5],r[6]]).filter(p=>p.every(Number.isFinite));
 if(points.length<12)return empty('末段轨迹点不足，无法估计关联维数。请增加输出周期后重新运行。');
 if(points.length>900){const src=points;points=Array.from({length:900},(_,i)=>src[Math.floor(i*(src.length-1)/899)])}
 const lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];for(const p of points)for(let k=0;k<2;k++){lo[k]=Math.min(lo[k],p[k]);hi[k]=Math.max(hi[k],p[k])}
 const scale=hi.map((v,k)=>v-lo[k]||1),dist=[];
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){const d=Math.hypot((points[i][0]-points[j][0])/scale[0],(points[i][1]-points[j][1])/scale[1]);if(d>0&&Number.isFinite(d))dist.push(d)}
 if(dist.length<20)return empty('轨迹距离不足，无法估计关联维数。当前轨迹可能为常值，请检查参数或延长输出时段。');
 dist.sort((a,b)=>a-b);const quantile=q=>{const i=(dist.length-1)*q,j=Math.floor(i);return dist[j]+(dist[Math.ceil(i)]-dist[j])*(i-j)};
 const a=Math.log(quantile(.02)),b=Math.log(quantile(.8)),samples=[];
 for(let i=0;i<28;i++){const r=Math.exp(a+(b-a)*i/27);let l=0,h=dist.length;while(l<h){const m=(l+h)>>>1;if(dist[m]<=r)l=m+1;else h=m}const c=l/dist.length;if(c>0&&c<1)samples.push([Math.log(r),Math.log(c)])}
 let slope=null;if(samples.length>=5){const fit=samples.slice(Math.floor(samples.length/5),Math.max(5,Math.floor(samples.length*4/5))),mx=fit.reduce((s,p)=>s+p[0],0)/fit.length,my=fit.reduce((s,p)=>s+p[1],0)/fit.length;const den=fit.reduce((s,p)=>s+(p[0]-mx)**2,0);if(den>0)slope=fit.reduce((s,p)=>s+(p[0]-mx)*(p[1]-my),0)/den}
 return {status:'reference_curve',samples,slope,dimensions:2,point_count:points.length,note:'Grassberger–Procaccia 参考曲线；斜率受窗口、采样和尺度区间影响，不作为严格维数证明。'};
}
document.addEventListener('DOMContentLoaded',()=>{
 const panel=$('extra').parentElement,actions=document.createElement('div');actions.className='actions';actions.style.marginBottom='14px';
 for(const [kind,label] of [['lyapunov','李雅普诺夫指数'],['correlation_dimension','关联维数参考图']]){
  const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=label;
  button.onclick=()=>{$('analysisKind').value=kind;$('analysisKind').dispatchEvent(new Event('change'));updateExtra();if(!result)$('extraNote').textContent='已选择'+label+'，请先运行仿真，完成后自动显示。';panel.scrollIntoView({behavior:'smooth',block:'center'})};actions.append(button);
 }
 panel.prepend(actions);
});
const axisOptions={time:['y1','y2','y3','y4','y5','y6'],phase:stateNames};
function stateLabel(k){return `${k}（状态${Number(k.slice(1))}）`}
function fillAxisOptions(){for(const id of ['timeAxis','phaseX','phaseY']){const select=$(id);if(!select)return;select.replaceChildren();for(const k of stateNames){const op=document.createElement('option');op.value=k;op.textContent=stateLabel(k);select.append(op)}}$('timeAxis').value='y5';$('phaseX').value='y5';$('phaseY').value='y6'}
function stateIndex(k){return Number(k.slice(1))-1}
function analysisPoints(kind){if(!result)return[];const rows=result.states||[];if(!rows.length)return[];const idx=k=>1+stateIndex(k);const t=rows.map(r=>r[0]);const y=rows.map(r=>r[idx('y5')]);
 if(kind==='lyapunov')return result.lyapunov?.samples||[];
 if(kind==='correlation_dimension'){
  result.analysis??={};
  result.analysis.correlation_dimension??=correlationReference(result.state_tail||rows);
  return result.analysis.correlation_dimension.samples||[];
 }
 if(kind==='rms')return result.analysis?.rms_windows||[];
 if(kind==='histogram')return result.analysis?.histogram||[];
 if(kind==='autocorrelation'){const tail=result.state_tail||rows,m=Math.min(1024,tail.length),z=tail.slice(-m).map(r=>r[5]),mean=z.reduce((a,v)=>a+v,0)/m,den=z.reduce((a,v)=>a+(v-mean)**2,0)||1;return Array.from({length:Math.min(180,m-1)},(_,lag)=>[lag*result.sampling.dt,z.slice(0,m-lag).reduce((a,v,i)=>a+(v-mean)*(z[i+lag]-mean),0)/den])}
 const xKey=$('phaseX').value,yKey=$('phaseY').value;return rows.map(r=>[r[idx(xKey)],r[idx(yKey)]])
}
function updateExtra(){const kind=$('analysisKind')?.value||'lyapunov',points=analysisPoints(kind);const labels={lyapunov:'最大有限时间李雅普诺夫指数',correlation_dimension:'关联维数参考图',rms:'分窗 RMS（y5）',histogram:'位移分布（y5）',autocorrelation:'自相关（y5，末段）',custom:`${$('phaseX').value}–${$('phaseY').value} 自定义状态投影`};$('extraTitle').textContent=labels[kind];const ly=result?.lyapunov,cd=result?.analysis?.correlation_dimension;$('extraNote').textContent=kind==='lyapunov'?(ly?.status==='finite_time_estimate'?`从末段状态延续 ${ly.window_periods} 个激励周期，最大有限时间指数：${Number(ly.exponent).toPrecision(6)}。仅作局部数值诊断，不自动判定混沌。`:(ly?.note||'运行仿真后显示指数。')):kind==='correlation_dimension'?(cd?`log C(r)–log r 参考曲线；拟合斜率：${cd.slope==null?'—':Number(cd.slope).toPrecision(5)}。${cd.note}`:'运行仿真后显示关联维数参考图。'):kind==='custom'?'可选择任意两个状态作为投影；请结合方程含义解释。':'由本次本地仿真数据计算；不自动作稳态或混沌判定。';chart('extra',points,'#ef5350',kind==='histogram')}
function pngWithDpi(bytes,dpi){
 const crc32=data=>{let crc=0xffffffff;for(const byte of data){crc^=byte;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0};
 const chunk=new Uint8Array(21),view=new DataView(chunk.buffer);view.setUint32(0,9);chunk.set([112,72,89,115],4);const ppm=Math.round(dpi/0.0254);view.setUint32(8,ppm);view.setUint32(12,ppm);chunk[16]=1;view.setUint32(17,crc32(chunk.subarray(4,17)));
 const parts=[bytes.subarray(0,33),chunk];let offset=33;while(offset<bytes.length){const length=new DataView(bytes.buffer,bytes.byteOffset+offset,4).getUint32(0);if(String.fromCharCode(...bytes.subarray(offset+4,offset+8))!=='pHYs')parts.push(bytes.subarray(offset,offset+12+length));offset+=12+length}return new Blob(parts,{type:'image/png'});
}
function exportPoints(id){
 if(id==='extra')return analysisPoints($('analysisKind').value);
 if(id==='phase')return (result.state_tail||[]).map(r=>[r[1+stateIndex($('phaseX').value)],r[1+stateIndex($('phaseY').value)]]);
 if(id==='time')return (result.states||[]).map(r=>[r[0],r[1+stateIndex($('timeAxis').value)]]);
 return id==='spectrum'?spectrumPoints():result.poincare;
}
function validateFigureOptions(){
 const font=Number($('figureFont').value),line=Number($('figureLine').value);
 if(!Number.isFinite(font)||font<8||font>24)throw Error('字体大小须为8–24');
 if(!Number.isFinite(line)||line<.2||line>3)throw Error('曲线线宽须为0.2–3');
 for(const label of plotLabels($('exportPlot').value))if(label.length>160)throw Error('轴标题最多160字符，请缩短标题');
}
async function exportPng(){try{
 if(!result)throw Error('请先运行仿真');validateFigureOptions();await document.fonts.ready;
 const id=$('exportPlot').value,dpi=Number($('pngDpi').value),w=Number($('pngWidth').value),h=Number($('pngHeight').value);
 if(!Number.isFinite(dpi)||dpi<72||dpi>1200||!Number.isFinite(w)||!Number.isFinite(h)||w<2||w>16||h<2||h>16)throw Error('DPI须为72–1200，宽高须为2–16英寸');
 if(w*h*dpi*dpi>24000000)throw Error('导出最多2400万像素，请降低DPI或尺寸');
 const out=document.createElement('canvas');out.width=Math.round(w*dpi);out.height=Math.round(h*dpi);const ctx=out.getContext('2d');
 const points=exportPoints(id);if(!points.length)throw Error('本图暂无数据');paperPlot(ctx,out.width,out.height,points,id,true);
 const blob=await new Promise(resolve=>out.toBlob(resolve,'image/png'));if(!blob)throw Error('图片生成失败，请降低分辨率');const output=pngWithDpi(new Uint8Array(await blob.arrayBuffer()),dpi);save(`振动分析-${id}-${dpi}dpi.png`,output,'image/png');$('pngState').textContent=`已导出 ${w} × ${h} 英寸，${dpi} DPI（${out.width} × ${out.height} 像素）`;
 }catch(e){$('pngState').textContent=e.message}}
document.addEventListener('DOMContentLoaded',()=>{const chat=document.querySelector('.chat-box');chat.open=true;$('dockBody').append(chat);const configButton=document.createElement('button');configButton.className='secondary chat-config-link';configButton.textContent='模型配置 / 文档工具';configButton.onclick=()=>{$('assistantTools').open=true;const settings=$('assistant').querySelector('details');settings.open=true;$('assistantTools').scrollIntoView({behavior:'smooth'});$('chatDock').hidden=true};$('dockBody').prepend(configButton);const historyButton=document.createElement('button');historyButton.className='secondary';historyButton.textContent='导出对话记录';historyButton.onclick=()=>save('AI对话记录.json',JSON.stringify(chatHistory,null,2));chat.querySelector('.actions').append(historyButton);fillAxisOptions();['timeAxis','phaseX','phaseY','analysisKind'].forEach(id=>$(id)?.addEventListener('change',()=>{if(id==='timeAxis'&&result){const key=$('timeAxis').value;chart('time',(result.states||[]).map(r=>[r[0],r[1+stateIndex(key)]]))}if(id!=='timeAxis')draw()}));$('pngDpi')?.addEventListener('input',()=>{$('pngState').textContent=`${$('pngWidth').value} × ${$('pngHeight').value} 英寸，${$('pngDpi').value} DPI = ${Math.round($('pngWidth').value*$('pngDpi').value)} × ${Math.round($('pngHeight').value*$('pngDpi').value)} 像素`});['pngWidth','pngHeight'].forEach(id=>$(id)?.addEventListener('input',()=>$('pngDpi').dispatchEvent(new Event('input'))));$('exportPng')?.addEventListener('click',exportPng);updateExtra()});
const oldDraw=window.draw;window.draw=function(){oldDraw?.();if(result){const key=$('timeAxis')?.value||'y5';$('timeNote').textContent=`横轴：时间　纵轴：状态 ${key}（全时段抽样显示）`;$('phase').parentElement.querySelector('h2').textContent=`相轨线（${$('phaseX').value}–${$('phaseY').value}）`;chart('time',(result.states||[]).map(r=>[r[0],r[1+(stateIndex(key))]]));const tail=result.state_tail;if(tail){chart('phase',tail.map(r=>[r[1+stateIndex($('phaseX').value)],r[1+stateIndex($('phaseY').value)]]),'#ff5252');$('phaseNote').textContent=`${$('phaseX').value}–${$('phaseY').value} 相轨线；末 ${result.sampling.phase_cycles} 个周期的连续积分点，未作稳态判定。`}updateExtra()}};

$('applyRange').onclick=()=>{try{const range={};for(const k of ['xmin','xmax','ymin','ymax']){range[k]=$(k).value.trim()===''?null:Number($(k).value);if(range[k]!==null&&!Number.isFinite(range[k]))throw Error('范围须为有限数值')}if(range.xmin!==null&&range.xmax!==null&&range.xmin>=range.xmax||range.ymin!==null&&range.ymax!==null&&range.ymin>=range.ymax)throw Error('最小值必须小于最大值');plotRanges[figureTitleKey($('exportPlot').value)]=range;draw();$('pngState').textContent='已应用坐标范围，PNG导出使用同一范围'}catch(e){$('pngState').textContent=e.message}};
$('autoRange').onclick=()=>{delete plotRanges[figureTitleKey($('exportPlot').value)];for(const k of ['xmin','xmax','ymin','ymax'])$(k).value='';draw()};





function spectrumPoints(){
 if(!result)return [];
 const limit=Number($('spectrumMax')?.value), mode=$('spectrumScale')?.value||'linear';
 return (result.spectrum_full||result.spectrum).filter(r=>!Number.isFinite(limit)||limit<=0||r[0]<=limit).map(([f,p])=>[f,mode==='db'?10*Math.log10(Math.max(p,1e-300)):p]);
}
function exportFigureCsv(){try{if(!result)throw Error('请先运行仿真');const id=$('exportPlot').value;save('论文图-'+id+'.csv',(id==='spectrum'?'frequency,PSD_display_value':'x,y')+'\n'+exportPoints(id).map(r=>r.join(',')).join('\n'),'text/csv;charset=utf-8')}catch(e){$('pngState').textContent=e.message}}
// A small vector drawing target for the shared paperPlot renderer.
function figureSvg(width,height,points,id,w,h){
 const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
 const parts=[],stack=[],measure=document.createElement('canvas').getContext('2d');let path='',transform='',clip='',count=0;
 const attrs=()=>` transform="${transform}" ${clip}`;
 const ctx={fillStyle:'#fff',strokeStyle:'#111',lineWidth:1,font:'13px Times New Roman',textAlign:'left',textBaseline:'middle',
  fillRect(x,y,w,h){parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${this.fillStyle}"${attrs()}/>` )},
  strokeRect(x,y,w,h){parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${this.strokeStyle}" stroke-width="${this.lineWidth}"${attrs()}/>` )},
  beginPath(){path=''},moveTo(x,y){path+=`M${x},${y}`},lineTo(x,y){path+=`L${x},${y}`},
  rect(x,y,w,h){path+=`M${x},${y}h${w}v${h}h${-w}Z`},
  arc(x,y,r){path+=`M${x+r},${y}A${r},${r} 0 1 0 ${x-r},${y}A${r},${r} 0 1 0 ${x+r},${y}Z`},
  stroke(){parts.push(`<path d="${path}" fill="none" stroke="${this.strokeStyle}" stroke-width="${this.lineWidth}" stroke-linejoin="round"${attrs()}/>` )},
  fill(){parts.push(`<path d="${path}" fill="${this.fillStyle}"${attrs()}/>` )},
  clip(){const name='clip'+count++;parts.push(`<defs><clipPath id="${name}"><path d="${path}"/></clipPath></defs>`);clip=`clip-path="url(#${name})"`},
  save(){stack.push({transform,clip,font:this.font,fillStyle:this.fillStyle,strokeStyle:this.strokeStyle,lineWidth:this.lineWidth,textAlign:this.textAlign,textBaseline:this.textBaseline})},restore(){const state=stack.pop();({transform,clip}=state);for(const k of ['font','fillStyle','strokeStyle','lineWidth','textAlign','textBaseline'])this[k]=state[k]},
  translate(x,y){transform+=` translate(${x} ${y})`},rotate(a){transform+=` rotate(${a*180/Math.PI})`},
  measureText(text){measure.font=this.font;return measure.measureText(String(text))},
  fillText(text,x,y){
   // Encode label glyphs as high-resolution pixels: no remote fonts required.
   const size=parseFloat(this.font);measure.font=this.font;
   const m=measure.measureText(String(text)),pad=size*.25;
   const width=Math.ceil(m.width+pad*2),height=Math.ceil(size*1.8);
   const c=document.createElement('canvas'),scale=8;c.width=width*scale;c.height=height*scale;
   const g=c.getContext('2d');g.scale(scale,scale);g.font=this.font;g.fillStyle=this.fillStyle;g.textBaseline='middle';g.fillText(String(text),pad,height/2);
   const left=this.textAlign==='center'?x-width/2:this.textAlign==='right'?x-width+pad:x-pad;
   const top=this.textBaseline==='top'?y-size*.3:y-height/2;
   parts.push(`<image x="${left}" y="${top}" width="${width}" height="${height}" href="${c.toDataURL('image/png')}"${attrs()}/>`);
  }

 };paperPlot(ctx,width,height,points,id,true);
 return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}in" height="${h}in" viewBox="0 0 ${width} ${height}" role="img"><title>${escape(id)}</title><desc>${escape(plotLabels(id).join(' / '))}. Curves and axes are vector; labels are embedded at 768 DPI, independent of installed fonts.</desc>${parts.join('')}</svg>`;
}
async function exportSvg(){try{
 if(!result)throw Error('请先运行仿真');validateFigureOptions();await document.fonts.ready;const id=$('exportPlot').value,points=exportPoints(id);if(!points.length)throw Error('本图暂无数据');
 const w=Number($('pngWidth').value),h=Number($('pngHeight').value);if(!(w>=2&&w<=16&&h>=2&&h<=16))throw Error('宽高须为2–16英寸');
 save('论文图-'+id+'.svg',figureSvg(w*96,h*96,points,id,w,h),'image/svg+xml;charset=utf-8');$('pngState').textContent='已导出白底 SVG：曲线与坐标线为矢量，文字为高分辨率图层，跨电脑无需字体';
 }catch(e){$('pngState').textContent=e.message}
}
document.addEventListener('DOMContentLoaded',()=>{
 $('exportSvg').onclick=exportSvg;$('exportFigureCsv').onclick=exportFigureCsv;
 function loadTitles(){const key=figureTitleKey($('exportPlot').value),title=figureTitles[key]||{},range=plotRanges[key]||{};$('figureXLabel').value=title.x||'';$('figureYLabel').value=title.y||'';for(const k of ['xmin','xmax','ymin','ymax'])$(k).value=range[k]??'';if(result)draw()}
 for(const id of ['figureXLabel','figureYLabel'])$(id).addEventListener('input',()=>{figureTitles[figureTitleKey($('exportPlot').value)]={x:$('figureXLabel').value.trim(),y:$('figureYLabel').value.trim()};if(result)draw()});
 for(const id of ['exportPlot','analysisKind','timeAxis','phaseX','phaseY','spectrumScale'])$(id).addEventListener('change',loadTitles);
 ['spectrumMax','spectrumScale','figureFont','figureLine'].forEach(id=>$(id).addEventListener('input',()=>{if(result)draw()}));
});



