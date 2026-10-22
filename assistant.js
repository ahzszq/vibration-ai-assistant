/* Secrets stay in the page's memory and are never included in exported experiments. */
$('assistant').innerHTML = `<div class="panel assistant-panel"><h2>AI 对话与文档实验</h2><p>上传参数文档或描述实验，AI制定计划，本地求解器生成真实曲线。</p>
<details><summary>模型配置（密钥仅保留在本页内存）</summary>
<label>服务类型<select id="provider"><option value="compatible">OpenAI兼容服务 / 自定义模型</option><option value="deepseek">DeepSeek</option><option value="ollama">本机 Ollama</option><option value="native">其他服务商（需安装可选LiteLLM）</option></select></label>
<label>API 基础地址<input id="apiBase" value="https://api.openai.com/v1" placeholder="https://服务商地址/v1"></label>
<label>API 密钥<input id="apiKey" type="password" autocomplete="off" placeholder="在这里输入，不要发到聊天中"></label>
<label>模型ID<select id="modelPreset"><option value="">手动填写服务商提供的模型ID</option><option value="deepseek/deepseek-chat">DeepSeek Chat</option><option value="deepseek/deepseek-reasoner">DeepSeek Reasoner</option><option value="ollama_chat/qwen3:8b">本机 qwen3:8b（须自行安装模型）</option></select><input id="modelId" placeholder="openai/您的模型ID"></label>
<div class="actions"><button id="testModel" class="secondary">测试模型连接</button><button id="clearKey" class="secondary">清除密钥</button></div><div class="preset-row"><button class="secondary provider-preset" data-provider="deepseek">DeepSeek</button><button class="secondary provider-preset" data-provider="dashscope">DashScope</button><button class="secondary provider-preset" data-provider="kimi">Kimi</button><button class="secondary provider-preset" data-provider="siliconflow">SiliconFlow</button><button class="secondary provider-preset" data-provider="openrouter">OpenRouter</button><button class="secondary provider-preset" data-provider="ollama">Ollama</button></div><small>兼容服务使用 openai/模型ID；预设只填写地址和示例模型，密钥由你自行输入。</small></details>
<details class="chat-box"><summary>对话调参 / 结果追问</summary><div class="chat-memory">连续对话上下文 <select id="contextTurns"><option value="20">最近20条</option><option value="50">最近50条</option><option value="100" selected>最近100条</option><option value="200">最近200条</option></select><small id="chatContextInfo"></small></div><div class="chat-preferences"><label><input id="rememberChat" type="checkbox"> 在此浏览器保存对话（不含密钥；共享电脑请勿开启）</label><label><input id="chatAutoExecute" type="checkbox"> 允许对话自动执行仿真 / 扫描</label></div><div id="chatLog" class="chat-log" role="log"><div class="chat-msg assistant">可以直接说“把 Epsilon33 调到 0.04 并运行”，或“对 Epsilon33 从0.02扫到0.08，做8点扫频”。</div></div><textarea id="chatInput" placeholder="自然语言输入参数修改、运行、扫频或结果问题"></textarea><div class="actions"><button id="sendChat">发送</button><button id="retryChat" class="secondary" disabled>重试提问</button><button id="clearChat" class="secondary">清空对话</button></div><pre id="chatState"></pre></details>
<label>导入参数资料（PDF / TXT / CSV / JSON / MD，最多10MB）<input type="file" id="documentFile" accept=".pdf,.txt,.csv,.json,.md"></label><p id="documentState">文档先在本地提取；点击AI解析时，提取文本会发送到上方API地址。</p><details><summary>查看本地提取文本</summary><pre id="documentText">尚未导入</pre></details>
<label>用自然语言描述实验<textarea id="requestText" placeholder="例如：保持其他参数不变，比较 Epsilon33=0.02、0.04、0.06 的响应。其余参数使用当前配置。"></textarea></label>
<label><input type="checkbox" id="autoRun"> 参数明确且通过校验后自动运行（最多8组实验）</label>
<div class="actions"><button id="planTask">AI解析需求与文档</button><button id="runPlan" class="secondary" disabled>按已核对计划运行</button></div><pre id="planState" role="status">自然语言以手动面板当前参数为基础；首次打开使用原代码默认值。涉及实际物理单位或参数歧义时会要求澄清。</pre>
<label>选一个AI计划转入手动面板<select id="planCase" disabled></select></label><button id="editPlan" class="secondary" disabled>转入手动调参</button>
<div class="scroll-table"><table id="planTable"></table></div><p id="inheritState"></p>
<div class="scroll-table"><table id="comparisonTable"></table></div><label>切换图表实验<select id="caseSelect" disabled></select></label>
<div class="actions"><button id="explainTask" class="secondary" disabled>AI解释结果 / 回答追问</button><button id="exportTask" class="secondary" disabled>导出完整任务报告</button><button id="exampleTask" class="secondary">查看示例需求</button></div><pre id="explanation"></pre></div>`;
let importedDocument = null, plannedTask = null, experiment = null, assistantBusy = false;
let chatHistory=[{role:'assistant',content:'可以直接说“把 Epsilon33 调到 0.04 并运行”，或“对 Epsilon33 从0.02扫到0.08，做8点扫频”。'}];
function aiConfig(){return {api_key:$('apiKey').value.trim(),base_url:$('apiBase').value.trim(),model:$('modelId').value.trim()}}
const CHAT_STORE='vibration-ai-chat-v1';
let chatStorageNotice='',lastFailedMessage='';
function persistChat(){
 if(!$('rememberChat').checked)return;
 try{localStorage.setItem(CHAT_STORE,JSON.stringify({version:1,messages:chatHistory,context:Number($('contextTurns').value)||100}));chatStorageNotice='已在此浏览器保存对话';}
 catch{chatStorageNotice='浏览器无法保存；请导出对话备份';}
}
function selectedChatContext(history=chatHistory){
 const limit=Number($('contextTurns').value)||100,selected=[];let chars=0;
 for(const h of history.slice(-limit).reverse()){
  if(h.error)continue;
  const content=String(h.content).slice(0,12000);
  if(chars+content.length>80000)break;
  selected.unshift({role:h.role,content});chars+=content.length;
 }
 return {messages:selected,chars};
}
function updateChatContext(){const c=selectedChatContext();$('chatContextInfo').textContent=`历史 ${chatHistory.length} 条 · 上下文 ${c.messages.length} 条 / ${c.chars.toLocaleString()} 字符（最多8万）`;}
function renderChatMessage(h){const el=document.createElement('div');el.className='chat-msg '+h.role+(h.error?' chat-error':'');el.textContent=h.content;$('chatLog').append(el);}
function renderChat(){ $('chatLog').replaceChildren();chatHistory.forEach(renderChatMessage);$('chatLog').scrollTop=$('chatLog').scrollHeight;updateChatContext();}
function chatMessage(role,text,error=false){
 const h={role,content:text,time:new Date().toISOString(),...(error?{error:true}:{})};
 chatHistory.push(h);renderChatMessage(h);$('chatLog').scrollTop=$('chatLog').scrollHeight;
 persistChat();updateChatContext();
}
function restoreChat(){
 try{const raw=localStorage.getItem(CHAT_STORE);if(!raw)return;const data=JSON.parse(raw);
  if(data.version!==1||!Array.isArray(data.messages))return;
  chatHistory=data.messages.filter(h=>h&&['user','assistant'].includes(h.role)&&typeof h.content==='string').map(h=>({role:h.role,content:h.content,time:h.time,error:!!h.error}));
  if(!chatHistory.length)return;
  $('rememberChat').checked=true;if([20,50,100,200].includes(data.context))$('contextTurns').value=String(data.context);
  renderChat();$('chatState').textContent='已恢复对话记录。当前参数和计算结果仍以本页为准；模型密钥需重新填写。';
 }catch{chatStorageNotice='无法恢复本地记录，可继续新对话';}
}
function applyChatPatch(patch){if(!patch||!Object.keys(patch).length)return;fillParameters({...params(),...patch},'AI对话已修改参数：'+Object.entries(patch).map(([k,v])=>`${k}=${v}`).join('、'));}
function chatRequestsRun(message){
 // Conservative: negated instructions never trigger a computation.
 if(/(?:不|别|勿|不要|不用|无需|暂缓|取消|停止).{0,12}(?:运行|仿真|计算|执行)/.test(message))return false;
 return /(?:运行|开始仿真|重新计算|执行仿真)/.test(message);
}
async function sendChat(){
 if(assistantBusy||busy)return;
 const message=$('chatInput').value.trim();if(!message)return;
 if(message.length>5000){$('chatState').textContent='单次问题最多5000字符，请拆分提问。';return;}
 const context=selectedChatContext();
 chatMessage('user',message);$('chatInput').value='';lastFailedMessage='';
 $('chatState').textContent='AI正在回答…';$('chatLog').setAttribute?.('aria-busy','true');
 const started=Date.now();setAssistantBusy(true);
 try{
  const latest=result?[{name:'当前显示的实验',params:result.params,stats:result.stats}]:[];
  const recent=experiment?.runs?.map(r=>({name:r.name,params:r.result.params,stats:r.result.stats})).slice(-7)||[];
  const r=await api('chat',{config:aiConfig(),message,base:params(),history:context.messages,results:[...latest,...recent]});
  const a=r.action||{};
  if(a.patch&&Object.keys(a.patch).length){
   applyChatPatch(a.patch);chatMessage('assistant',(a.reply||'已应用参数修改')+'\n已更新参数：'+Object.entries(a.patch).map(([k,v])=>`${k}=${v}`).join('、'));
   if($('chatAutoExecute').checked&&chatRequestsRun(message)){await runManualFromChat();chatMessage('assistant','已完成本地仿真。RMS='+result.stats.rms+'；峰值='+result.stats.peak+'；主频='+result.stats.dominant_frequency+'（模型时间⁻¹）。');}
   else chatMessage('assistant','尚未运行，请点击“运行物理仿真”，或开启对话自动执行后明确要求运行。');
  }else if(a.sweep){
   chatMessage('assistant',(a.reply||'已识别参数扫描')+`\n扫描方案：${a.sweep.param}，${a.sweep.from} → ${a.sweep.to}，${a.sweep.n} 点。`);
   if($('chatAutoExecute').checked&& !/(?:不|别|勿|不要|不用|无需|暂缓|取消|停止).{0,12}(?:运行|仿真|计算|执行|扫)/.test(message)){
    const scan=await api('sweep',{base:params(),sweep:a.sweep});renderSweep(scan);chatMessage('assistant',`参数扫描已完成，共${scan.runs.length}组；结果可在实验表格中查看。`);
   }else chatMessage('assistant','扫描尚未执行。确认方案后可开启对话自动执行并重新提出扫描要求。');
  }else if($('chatAutoExecute').checked&&/^(运行|开始仿真|运行仿真|重新计算)[。！!\s]*$/.test(message)){
   await runManualFromChat();chatMessage('assistant','已使用当前参数完成本地仿真。');
  }else chatMessage('assistant',a.reply||'未识别到操作，请说明参数名或具体问题。');
  $('chatState').textContent=`本轮完成 · ${((Date.now()-started)/1000).toFixed(1)} 秒。${chatStorageNotice}`;
 }catch(e){lastFailedMessage=message;chatMessage('assistant','操作失败：'+e.message+'\n如已执行部分调参，请核对当前参数；重试会使用当前参数。',true);$('chatState').textContent='请求失败；可编辑问题后发送，或点击“重试提问”。';}
 finally{$('chatLog').setAttribute?.('aria-busy','false');setAssistantBusy(false);updateChatContext();}
}
async function runManualFromChat(){const r=await api('simulate',params());experiment={runs:[{name:'AI对话仿真',result:r}],generated_at:new Date().toISOString()};$('exportTask').disabled=false;show(r);$('parameterState').textContent='已按AI对话修改后的参数完成一次物理仿真。'}
function renderSweep(s){experiment={runs:s.runs.map(x=>({name:`${s.param}=${x.value}`,result:x.result})),note:s.note,generated_at:new Date().toISOString()};$('exportTask').disabled=false;const select=$('caseSelect');select.replaceChildren();experiment.runs.forEach((r,i)=>{const op=document.createElement('option');op.value=i;op.textContent=r.name;select.append(op)});select.disabled=false;const table=$('comparisonTable');table.replaceChildren();addRow(table,['扫频参数','RMS','绝对峰值','主频（未标定）'],true);s.runs.forEach(x=>addRow(table,[`${s.param}=${x.value}`,x.result.stats.rms.toFixed(6),x.result.stats.peak.toFixed(6),x.result.stats.dominant_frequency.toFixed(6)]));if(s.runs[0])show(s.runs[0].result);$('planState').textContent=s.note}
async function api(path,data){return requestApi(path,data)}
function setAssistantBusy(value){assistantBusy=value;window.assistantIsBusy=()=>assistantBusy;const locked=value||busy;for(const id of ['planTask','testModel','documentFile','provider','modelPreset','apiBase','apiKey','modelId','clearKey','run','sendChat','clearChat','rememberChat','chatAutoExecute','editPlan','resetDefaults','quickDefaults','load'])$(id).disabled=locked;$('runPlan').disabled=locked||!plannedTask||plannedTask.plan.status!=='ready';$('explainTask').disabled=locked||!experiment;$('editPlan').disabled=locked||!plannedTask||plannedTask.plan.status!=='ready';document.querySelectorAll('#fields input,#advanced input,.provider-preset').forEach(el=>el.disabled=locked);$('retryChat').disabled=locked||!lastFailedMessage;}
document.addEventListener('task-state-changed',()=>setAssistantBusy(assistantBusy));
async function action(fn){if(assistantBusy||busy)return;setAssistantBusy(true);try{await fn()}catch(e){$('planState').textContent='操作失败：'+e.message}finally{setAssistantBusy(false)}}
function invalidate(){plannedTask=null;$('runPlan').disabled=true;$('planCase').disabled=true;$('editPlan').disabled=true;$('planTable').replaceChildren();$('planState').textContent='需求、文档或手动参数已更改，请重新解析。'}
document.addEventListener('parameters-changed',invalidate);
$('requestText').addEventListener('input',invalidate);
$('provider').onchange=()=>{const kind=$('provider').value;if(kind==='deepseek'){$('apiBase').value='https://api.deepseek.com';$('modelId').value='deepseek/deepseek-chat'}else if(kind==='ollama'){$('apiBase').value='http://127.0.0.1:11434/v1';$('modelId').value='ollama_chat/qwen3:8b';$('apiKey').value=''}else{$('apiBase').value=kind==='native'?'':'https://api.openai.com/v1';$('modelId').value=''}};
const presets={deepseek:['https://api.deepseek.com','deepseek/deepseek-chat'],dashscope:['https://dashscope.aliyuncs.com/compatible-mode/v1','openai/qwen-plus'],kimi:['https://api.moonshot.cn/v1','openai/moonshot-v1-8k'],siliconflow:['https://api.siliconflow.cn/v1','openai/deepseek-ai/DeepSeek-V3'],openrouter:['https://openrouter.ai/api/v1','openai/deepseek/deepseek-chat'],ollama:['http://127.0.0.1:11434/v1','ollama_chat/qwen3:8b']};document.querySelectorAll('.provider-preset').forEach(b=>b.onclick=()=>{const p=presets[b.dataset.provider];if($('apiBase').value!==p[0])$('apiKey').value='';$('apiBase').value=p[0];$('modelId').value=p[1];$('provider').value=b.dataset.provider==='ollama'?'ollama':'compatible';$('planState').textContent='已套用'+b.textContent+'连接预设，请填写自己的密钥；模型ID可自行修改。'});
$('sendChat').onclick=sendChat;
$('retryChat').onclick=()=>{if(lastFailedMessage){$('chatInput').value=lastFailedMessage;sendChat()}};
$('clearChat').onclick=()=>{
 chatHistory=[{role:'assistant',content:'新对话已开始。当前手动参数和已有仿真结果保留。'}];lastFailedMessage='';
 try{localStorage.removeItem(CHAT_STORE)}catch{}
 renderChat();persistChat();$('chatState').textContent='已新建对话。';$('retryChat').disabled=true;
};
$('contextTurns').addEventListener('change',()=>{updateChatContext();persistChat()});
$('rememberChat').addEventListener('change',()=>{
 if($('rememberChat').checked)persistChat();else{try{localStorage.removeItem(CHAT_STORE)}catch{}chatStorageNotice='仅在本页内存保留对话';}
 $('chatState').textContent=chatStorageNotice;
});
$('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.isComposing){e.preventDefault();sendChat()}});
restoreChat();updateChatContext();
$('modelPreset').onchange=()=>{const m=$('modelPreset').value;if(!m)return;$('modelId').value=m;if(m.startsWith('deepseek/')){$('apiBase').value='https://api.deepseek.com';$('provider').value='deepseek'}else if(m.startsWith('ollama')){$('apiBase').value='http://127.0.0.1:11434/v1';$('provider').value='ollama';$('apiKey').value=''}};
$('clearKey').onclick=()=>{$('apiKey').value='';$('planState').textContent='本页密钥已清除。服务端不保存密钥。'};
$('testModel').onclick=()=>action(async()=>{$('planState').textContent='正在实际调用模型…';const r=await api('test',{config:aiConfig()});$('planState').textContent=r.message});
$('documentFile').onchange=()=>action(async()=>{const file=$('documentFile').files[0];if(!file)return;invalidate();importedDocument=null;if(file.size>10*1024*1024)throw Error('文件最多10MB');$('documentState').textContent='正在本地解析…';const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));importedDocument=await api('document',{name:file.name,data:btoa(binary)});$('documentState').textContent=`${file.name}：${importedDocument.sources.length} 个来源段；${importedDocument.parser}。`+importedDocument.warnings.join('\n');$('documentText').textContent=importedDocument.sources.map(s=>`[${s.id}] ${s.label}\n${s.text}`).join('\n\n')});
function addRow(table,values,heading=false){const tr=document.createElement('tr');for(const value of values){const td=document.createElement(heading?'th':'td');td.textContent=String(value);tr.append(td)}table.append(tr)}
function displayPlan(){const p=plannedTask.plan;$('planState').textContent=`${p.status==='ready'?'计划可运行':p.status==='clarify'?'需要澄清':'当前不支持'}：${p.summary}\n${p.questions.join('\n')}\n${p.warnings.join('\n')}`;const table=$('planTable');table.replaceChildren();addRow(table,['实验','修改参数','来源与引文'],true);for(const c of p.cases){addRow(table,[c.name,Object.entries(c.changes).map(([k,v])=>`${k} = ${v}`).join('\n')||'使用当前配置',c.evidence.map(e=>`${e.parameter}: [${e.source}] ${e.quote}`).join('\n')])}$('inheritState').textContent='未列出的参数继承手动面板配置。修改手动参数后旧计划失效；也可选择一组计划转入手动面板继续修改。';}
$('planTask').onclick=()=>action(async()=>{plannedTask=null;$('planState').textContent='模型正在识别需求和参数来源…';const r=await api('plan',{config:aiConfig(),message:$('requestText').value,base:params(),sources:importedDocument?.sources||[]});plannedTask=r;displayPlan();const select=$('planCase');select.replaceChildren();r.plan.cases.forEach((c,i)=>{const op=document.createElement('option');op.value=i;op.textContent=c.name;select.append(op)});select.disabled=r.plan.status!=='ready';$('editPlan').disabled=r.plan.status!=='ready';if(r.plan.status==='ready'&&$('autoRun').checked)await runPlanned()});
$('editPlan').onclick=()=>{if(!plannedTask)return;const chosen=plannedTask.plan.cases[Number($('planCase').value)];const values={...plannedTask.base,...chosen.changes};fillParameters(values,`已载入AI计划“${chosen.name}”，可继续手动修改并运行。`);$('manualPanel').scrollIntoView({behavior:'smooth',block:'start'})};
async function runPlanned(){if(!plannedTask||plannedTask.plan.status!=='ready')throw Error('请先生成可运行计划');$('planState').textContent='正在按计划调用本地动力学求解器…';experiment=await api('execute',plannedTask);experiment.document=importedDocument?{name:importedDocument.name,warnings:importedDocument.warnings}:null;experiment.model=aiConfig().model;experiment.generated_at=new Date().toISOString();const table=$('comparisonTable');table.replaceChildren();addRow(table,['实验','RMS','绝对峰值','主频（未标定）'],true);const select=$('caseSelect');select.replaceChildren();experiment.runs.forEach((r,i)=>{addRow(table,[r.name,r.result.stats.rms.toFixed(6),r.result.stats.peak.toFixed(6),r.result.stats.dominant_frequency.toFixed(6)]);const op=document.createElement('option');op.value=i;op.textContent=r.name;select.append(op)});select.disabled=false;show(experiment.runs[0].result);$('exportTask').disabled=false;$('explanation').textContent='可在需求框输入关于本次结果的追问，再点击“AI解释结果 / 回答追问”。';$('planState').textContent=`已完成 ${experiment.runs.length} 组真实仿真。${experiment.note}`;}
$('runPlan').onclick=()=>action(runPlanned);$('caseSelect').onchange=()=>show(experiment.runs[Number($('caseSelect').value)].result);
$('explainTask').onclick=()=>action(async()=>{$('explanation').textContent='AI正在根据实际统计量分析…';const r=await api('explain',{config:aiConfig(),experiment,message:$('requestText').value});$('explanation').textContent=r.text;experiment.explanation=r.text});
$('exportTask').onclick=()=>save('自然语言仿真实验.json',JSON.stringify(experiment,null,2));
$('exampleTask').onclick=()=>{$('requestText').value='保持其他参数不变，比较 Epsilon33=0.02、0.04、0.06 的响应。其余参数使用当前配置。';invalidate()};
