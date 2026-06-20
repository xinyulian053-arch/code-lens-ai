import * as vscode from 'vscode';
import { CodeContext, ExplainMode, Explanation, FlowStep } from './types';

const SECRET_KEY = 'codeLensAi.apiKey';

export class AiClient {
  public constructor(private readonly context: vscode.ExtensionContext) {}

  public async hasApiKey(): Promise<boolean> {
    return Boolean(await this.context.secrets.get(SECRET_KEY));
  }

  public async saveApiKey(apiKey: string): Promise<void> {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      await this.context.secrets.delete(SECRET_KEY);
      return;
    }
    await this.context.secrets.store(SECRET_KEY, trimmed);
  }

  public getSettings(): { apiBaseUrl: string; model: string } {
    const config = vscode.workspace.getConfiguration('codeLensAi');
    return {
      apiBaseUrl: config.get<string>('apiBaseUrl', 'https://api.openai.com/v1').replace(/\/+$/, ''),
      model: config.get<string>('model', 'gpt-4.1-mini').trim()
    };
  }

  public async saveSettings(apiBaseUrl: string, model: string, apiKey?: string): Promise<void> {
    const normalizedUrl = apiBaseUrl.trim().replace(/\/+$/, '');
    if (!/^https:\/\/.+/i.test(normalizedUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?/i.test(normalizedUrl)) {
      throw new Error('API 地址必须是 HTTPS，或本地 localhost 地址。');
    }
    if (!model.trim()) {
      throw new Error('请填写模型名称。');
    }
    const config = vscode.workspace.getConfiguration('codeLensAi');
    await config.update('apiBaseUrl', normalizedUrl, vscode.ConfigurationTarget.Global);
    await config.update('model', model.trim(), vscode.ConfigurationTarget.Global);
    if (apiKey !== undefined) {
      await this.saveApiKey(apiKey);
    }
  }

  public async explain(context: CodeContext, mode: ExplainMode): Promise<Explanation> {
    const apiKey = await this.context.secrets.get(SECRET_KEY);
    if (!apiKey) {
      return createPreview(context, mode);
    }

    const settings = this.getSettings();
    const requestBody = {
      model: settings.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `你是一位严谨、耐心的软件工程导师。只返回合法 JSON，不使用 Markdown 代码块。JSON 必须符合：{summary:string,purpose:string,flow:[{step:string,detail:string}],inputsOutputs:string,risks:string[],highlights:string[],followUpPrompt:string}。用简体中文。解释要忠于给定代码；未知之处明确说“无法从当前片段确定”。模式为 ${mode}：brief 最多 3 个流程步骤；guided 面向初学者；deep 说明语言/框架原理；review 聚焦边界、性能和安全风险。`
        },
        {
          role: 'user',
          content: JSON.stringify(context)
        }
      ]
    };

    let response: Response;
    try {
      response = await fetch(`${settings.apiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(45_000)
      });
    } catch (error) {
      throw new Error(`无法连接 AI 服务：${toMessage(error)}`);
    }

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`AI 服务返回 ${response.status}：${detail.slice(0, 240)}`);
    }

    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('AI 服务没有返回可用的解释。');
    }
    return normalizeExplanation(content, context);
  }

  public async answerFollowUp(question: string, context: CodeContext, explanation: Explanation): Promise<string> {
    const apiKey = await this.context.secrets.get(SECRET_KEY);
    if (!apiKey) {
      return '这是离线预览。配置 API Key 后，可以针对这段代码继续追问。';
    }
    const settings = this.getSettings();
    const response = await fetch(`${settings.apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: settings.model,
        temperature: 0.25,
        messages: [
          { role: 'system', content: '你是代码解释助手。用简体中文简洁回答，基于给定片段；不要编造无法确认的事实。' },
          { role: 'user', content: JSON.stringify({ question, code: context.code, language: context.language, previousExplanation: explanation }) }
        ]
      }),
      signal: AbortSignal.timeout(45_000)
    });
    if (!response.ok) {
      throw new Error(`AI 服务返回 ${response.status}。`);
    }
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return payload.choices?.[0]?.message?.content?.trim() || 'AI 没有返回追问答案。';
  }
}

function normalizeExplanation(content: string, context: CodeContext): Explanation {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {
      summary: content.trim(),
      purpose: 'AI 返回了非结构化内容，已保留原文。',
      flow: [],
      inputsOutputs: '无法从当前响应中结构化提取。',
      risks: [],
      highlights: [],
      followUpPrompt: `这段 ${context.language} 代码的边界条件是什么？`,
      source: 'ai'
    };
  }

  const flow = Array.isArray(raw.flow)
    ? raw.flow.slice(0, 6).map((item, index) => ({
      step: textOf((item as Record<string, unknown>).step, `步骤 ${index + 1}`),
      detail: textOf((item as Record<string, unknown>).detail)
    }))
    : [];

  return {
    summary: textOf(raw.summary, 'AI 未给出摘要。'),
    purpose: textOf(raw.purpose, '无法从当前片段确定完整业务目的。'),
    flow,
    inputsOutputs: textOf(raw.inputsOutputs, '请结合调用方确认输入输出。'),
    risks: listOf(raw.risks),
    highlights: listOf(raw.highlights),
    followUpPrompt: textOf(raw.followUpPrompt, '这里最需要关注的边界条件是什么？'),
    source: 'ai'
  };
}

function createPreview(context: CodeContext, mode: ExplainMode): Explanation {
  const lines = context.code.split(/\r?\n/).filter(line => line.trim());
  const hasAsync = /\b(await|async|Promise|then\s*\()\b/.test(context.code);
  const conditions = (context.code.match(/\b(if|else|switch|catch|for|while)\b/g) || []).length;
  const functionMatch = context.code.match(/(?:function\s+|(?:const|let|var)\s+)([A-Za-z_$][\w$]*)|([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?:=>|\{)/);
  const functionName = functionMatch?.[1] || functionMatch?.[2];
  const steps: FlowStep[] = [
    { step: '读取代码', detail: `当前选中了 ${lines.length} 个非空行，语言为 ${context.language || '未识别'}。` },
    { step: '识别主逻辑', detail: functionName ? `片段看起来围绕 “${functionName}” 展开。` : '片段没有明显的命名函数，建议结合调用位置理解职责。' }
  ];
  if (hasAsync) {
    steps.push({ step: '处理异步结果', detail: '代码包含异步调用；需要确认异常、超时和取消是否被妥善处理。' });
  } else if (conditions) {
    steps.push({ step: '分支判断', detail: `代码中检测到约 ${conditions} 处流程控制，需要覆盖正常与异常路径。` });
  }

  const risks = [
    ...(hasAsync ? ['异步操作失败时的错误处理和用户反馈是否完整。'] : []),
    ...(conditions ? ['条件分支在空值、边界值下是否按预期执行。'] : ['调用方是否传入了符合预期的参数。'])
  ];

  return {
    summary: `这是本地快速预览：${functionName ? `正在分析 ${functionName} 的职责。` : '正在梳理这段代码的结构。'}`,
    purpose: '配置 API Key 后可获得结合语义、调用上下文和项目惯例的 AI 解释。',
    flow: mode === 'brief' ? steps.slice(0, 2) : steps,
    inputsOutputs: '本地预览不会推断完整输入输出；请选择函数体并配置 AI 以获得准确结论。',
    risks,
    highlights: [hasAsync ? '包含异步控制流' : '同步执行路径', conditions ? `包含 ${conditions} 个流程控制关键词` : '结构相对线性'],
    followUpPrompt: functionName ? `“${functionName}” 在参数为空时会怎样？` : '这段代码的输入和副作用分别是什么？',
    source: 'preview'
  };
}

function textOf(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function listOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 6) : [];
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
