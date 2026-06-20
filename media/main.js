/* global acquireVsCodeApi */
const vscode = acquireVsCodeApi();
const app = document.getElementById('app');

let state = { selectedCode: undefined, explanation: undefined, apiConfigured: false, model: '', apiBaseUrl: '', mode: 'guided' };
let flash = '';
let error = '';
let loading = false;
let answer = null;
let settingsOpen = false;

const modeLabels = {
  brief: '一句话速读',
  guided: '新人友好',
  deep: '深入原理',
  review: '审查模式'
};

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));

function render() {
  const explanation = state.explanation;
  app.innerHTML = `
    <section class="brand" aria-label="Code Lens AI">
      <div class="brand-mark" aria-hidden="true">⌕</div>
      <div><h1>Code Lens AI</h1><p>把陌生代码讲明白</p></div>
    </section>
    ${flash ? `<div class="toast">${escapeHtml(flash)}</div>` : ''}
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
    ${!state.selectedCode && !loading ? welcome() : ''}
    ${state.selectedCode ? controls() : ''}
    ${loading ? `<div class="loading"><span class="spinner"></span><span>正在组织一份清晰的解释…</span></div>` : ''}
    ${explanation && !loading ? explanationView(explanation) : ''}
    ${settings()}
  `;
  bindEvents();
}

function welcome() {
  return `<section class="card welcome">
    <div class="eyebrow">选择 · 理解 · 追问</div>
    <h2>选中代码，剩下交给我。</h2>
    <p>右键选择“解释当前代码”，或按 <strong>Ctrl + Alt + E</strong>。没有选中内容时，会解释光标所在行。</p>
    <button class="primary" data-action="explain">解释当前代码</button>
  </section>`;
}

function controls() {
  const selected = state.selectedCode;
  return `<section class="card">
    <div class="code-meta"><span class="code-name" title="${escapeHtml(selected.fileName)}">${escapeHtml(selected.fileName)}</span><span class="chip">${escapeHtml(selected.rangeLabel)}</span></div>
    <label class="mode-label" for="mode">这次怎么讲？</label>
    <select id="mode" aria-label="选择讲解深度">
      <option value="brief" ${state.mode === 'brief' ? 'selected' : ''}>一句话速读</option>
      <option value="guided" ${state.mode === 'guided' ? 'selected' : ''}>新人友好</option>
      <option value="deep" ${state.mode === 'deep' ? 'selected' : ''}>深入原理</option>
      <option value="review" ${state.mode === 'review' ? 'selected' : ''}>审查模式</option>
    </select>
    <button class="primary" data-action="explain">${state.apiConfigured ? '重新解释选区' : '生成本地预览'}</button>
  </section>`;
}

function explanationView(explanation) {
  const sourceText = explanation.source === 'ai' ? `AI · ${escapeHtml(state.model)} · ${modeLabels[state.mode]}` : `本地快速预览 · ${modeLabels[state.mode]}`;
  const flow = explanation.flow.length ? explanation.flow.map((item, index) => `<div class="flow-item"><span class="flow-num">${index + 1}</span><div><strong>${escapeHtml(item.step)}</strong><p>${escapeHtml(item.detail)}</p></div></div>`).join('') : '<p class="muted">没有可展开的步骤。</p>';
  const risks = explanation.risks.length ? explanation.risks.map(item => `<li>${escapeHtml(item)}</li>`).join('') : '<li>暂未标注明显风险；仍建议结合调用方验证。</li>';
  const highlights = explanation.highlights.length ? `<ul class="highlight-list">${explanation.highlights.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '';
  return `
    <section class="card">
      <div class="section-head"><h2 class="section-title">先说结论</h2><span class="status ${explanation.source === 'preview' ? 'preview' : ''}">${sourceText}</span></div>
      <p class="summary">${escapeHtml(explanation.summary)}</p>
      <p class="detail">${escapeHtml(explanation.purpose)}</p>
    </section>
    ${highlights ? `<section class="card"><h2 class="section-title">关键线索</h2>${highlights}</section>` : ''}
    <section class="card"><h2 class="section-title">执行流程</h2><div class="flow" style="margin-top:10px">${flow}</div></section>
    <section class="card"><h2 class="section-title">输入、输出与副作用</h2><p class="detail">${escapeHtml(explanation.inputsOutputs)}</p></section>
    <section class="card"><h2 class="section-title">需要留意</h2><ul class="risk-list" style="margin-top:7px">${risks}</ul></section>
    <section class="card">
      <div class="section-head"><h2 class="section-title">继续追问</h2><button class="secondary" data-action="copy">复制解释</button></div>
      <div class="ask-row"><input id="question" value="${escapeHtml(explanation.followUpPrompt)}" aria-label="输入追问"/><button data-action="ask" title="发送追问">问</button></div>
      ${answer ? `<div class="answer" style="margin-top:10px"><strong>${escapeHtml(answer.question)}</strong><br/>${escapeHtml(answer.text)}</div>` : ''}
    </section>`;
}

function settings() {
  return `<details class="card settings" ${settingsOpen ? 'open' : ''}><summary>AI 连接与隐私 ${state.apiConfigured ? '· 已配置' : '· 尚未配置'}</summary>
    <div class="settings-inner">
      <div class="field"><label class="field-label" for="apiKey">API Key（安全保存在 VS Code 密钥库）</label><input id="apiKey" type="password" autocomplete="off" placeholder="${state.apiConfigured ? '已保存；留空则不修改' : '粘贴你的 API Key'}" /></div>
      <div class="field"><label class="field-label" for="apiBaseUrl">API 地址</label><input id="apiBaseUrl" value="${escapeHtml(state.apiBaseUrl)}" /></div>
      <div class="field"><label class="field-label" for="model">模型名称</label><input id="model" value="${escapeHtml(state.model)}" /></div>
      <button class="primary" data-action="save">保存连接设置</button>
      <p class="privacy">代码只会在你点击解释或追问时发送到此处配置的服务。关闭“发送相邻上下文”可减少发送内容。</p>
    </div>
  </details>`;
}

function bindEvents() {
  document.querySelectorAll('[data-action]').forEach(element => element.addEventListener('click', () => {
    const action = element.dataset.action;
    if (action === 'explain') {
      const mode = document.getElementById('mode')?.value || 'guided';
      state.mode = mode;
      vscode.postMessage({ type: 'explain', mode });
    }
    if (action === 'copy') vscode.postMessage({ type: 'copyExplanation' });
    if (action === 'ask') {
      const question = document.getElementById('question')?.value?.trim();
      if (question) vscode.postMessage({ type: 'followUp', question });
    }
    if (action === 'save') {
      settingsOpen = true;
      vscode.postMessage({ type: 'saveSettings', apiKey: document.getElementById('apiKey')?.value, apiBaseUrl: document.getElementById('apiBaseUrl')?.value, model: document.getElementById('model')?.value });
    }
  }));
  document.querySelector('.settings')?.addEventListener('toggle', event => { settingsOpen = event.currentTarget.open; });
}

window.addEventListener('message', event => {
  const message = event.data;
  if (message.type === 'hydrate') { state = message.state; loading = false; }
  if (message.type === 'loading') { loading = true; error = ''; flash = ''; answer = null; }
  if (message.type === 'explanation') { state.selectedCode = message.selectedCode; state.explanation = message.explanation; state.mode = message.mode || state.mode; loading = false; answer = null; }
  if (message.type === 'error') { loading = false; error = message.text; }
  if (message.type === 'settingsSaved') { state = message.state; flash = '连接设置已保存。'; error = ''; }
  if (message.type === 'openSettings') settingsOpen = true;
  if (message.type === 'toast') flash = message.text;
  if (message.type === 'followUpLoading') { loading = true; }
  if (message.type === 'followUpAnswer') { loading = false; answer = { question: message.question, text: message.answer }; }
  render();
});

vscode.postMessage({ type: 'ready' });
render();
