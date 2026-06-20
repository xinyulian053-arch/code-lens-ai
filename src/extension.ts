import * as vscode from 'vscode';
import { AiClient } from './aiClient';
import { AppState, CodeContext, ExplainMode, Explanation } from './types';

const VIEW_ID = 'codeLensAi.explainView';

export function activate(context: vscode.ExtensionContext): void {
  const aiClient = new AiClient(context);
  const provider = new CodeLensViewProvider(context, aiClient);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_ID, provider, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand('codeLensAi.explainSelection', () => provider.explainActiveSelection()),
    vscode.commands.registerCommand('codeLensAi.configure', () => provider.revealSettings())
  );
}

export function deactivate(): void {}

class CodeLensViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private selectedCode?: CodeContext;
  private explanation?: Explanation;
  private mode: ExplainMode = 'guided';

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly aiClient: AiClient
  ) {}

  public resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')]
    };
    view.webview.html = this.getHtml(view.webview);
    view.webview.onDidReceiveMessage(message => void this.handleMessage(message), undefined, this.context.subscriptions);
    view.onDidDispose(() => { this.view = undefined; });
  }

  public async explainActiveSelection(mode: ExplainMode = 'guided'): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showInformationMessage('请先打开一个代码文件。');
      return;
    }

    this.mode = mode;
    this.selectedCode = this.getContext(editor);
    this.explanation = undefined;
    await vscode.commands.executeCommand('workbench.view.extension.codeLensAi');
    this.post({ type: 'loading', text: '正在理解选中的代码…' });
    try {
      this.explanation = await this.aiClient.explain(this.selectedCode, mode);
      this.post({ type: 'explanation', explanation: this.explanation, selectedCode: this.selectedCode, mode: this.mode });
    } catch (error) {
      this.post({ type: 'error', text: toMessage(error) });
    }
  }

  public async revealSettings(): Promise<void> {
    await vscode.commands.executeCommand('workbench.view.extension.codeLensAi');
    this.post({ type: 'openSettings' });
  }

  private async handleMessage(message: { type?: string; [key: string]: unknown }): Promise<void> {
    switch (message.type) {
      case 'ready':
        this.post({ type: 'hydrate', state: await this.state() });
        break;
      case 'explain':
        await this.explainActiveSelection(isMode(message.mode) ? message.mode : 'guided');
        break;
      case 'saveSettings':
        try {
          const submittedApiKey = stringOf(message.apiKey).trim();
          await this.aiClient.saveSettings(
            stringOf(message.apiBaseUrl),
            stringOf(message.model),
            submittedApiKey || undefined
          );
          this.post({ type: 'settingsSaved', state: await this.state() });
          void vscode.window.showInformationMessage('Code Lens AI 已保存连接设置。');
        } catch (error) {
          this.post({ type: 'error', text: toMessage(error) });
        }
        break;
      case 'deleteApiKey':
        await this.aiClient.deleteApiKey();
        this.post({ type: 'settingsSaved', state: await this.state(), text: '已删除保存的 API Key。' });
        void vscode.window.showInformationMessage('Code Lens AI 已删除保存的 API Key。');
        break;
      case 'followUp':
        await this.answerFollowUp(stringOf(message.question));
        break;
      case 'copyExplanation':
        if (this.explanation) {
          await vscode.env.clipboard.writeText(asMarkdown(this.explanation, this.selectedCode));
          this.post({ type: 'toast', text: '解释已复制为 Markdown。' });
        }
        break;
    }
  }

  private async answerFollowUp(question: string): Promise<void> {
    if (!question || !this.selectedCode || !this.explanation) {
      return;
    }
    this.post({ type: 'followUpLoading' });
    try {
      const answer = await this.aiClient.answerFollowUp(question, this.selectedCode, this.explanation);
      this.post({ type: 'followUpAnswer', question, answer });
    } catch (error) {
      this.post({ type: 'error', text: toMessage(error) });
    }
  }

  private getContext(editor: vscode.TextEditor): CodeContext {
    const selection = editor.selection;
    const document = editor.document;
    const range = selection.isEmpty
      ? new vscode.Range(selection.active.line, 0, selection.active.line, document.lineAt(selection.active.line).text.length)
      : new vscode.Range(selection.start, selection.end);
    const code = document.getText(range).slice(0, 12_000);
    const sendContext = vscode.workspace.getConfiguration('codeLensAi').get<boolean>('sendSurroundingContext', true);
    const start = Math.max(0, range.start.line - 20);
    const end = Math.min(document.lineCount - 1, range.end.line + 20);
    return {
      code,
      language: document.languageId,
      fileName: vscode.workspace.asRelativePath(document.uri, false),
      rangeLabel: selection.isEmpty ? `第 ${range.start.line + 1} 行` : `第 ${range.start.line + 1}–${range.end.line + 1} 行`,
      surroundingContext: sendContext ? document.getText(new vscode.Range(start, 0, end, document.lineAt(end).text.length)).slice(0, 8_000) : undefined
    };
  }

  private async state(): Promise<AppState> {
    const settings = this.aiClient.getSettings();
    return {
      selectedCode: this.selectedCode,
      explanation: this.explanation,
      apiConfigured: await this.aiClient.hasApiKey(),
      model: settings.model,
      apiBaseUrl: settings.apiBaseUrl,
      mode: this.mode
    };
  }

  private post(message: unknown): void {
    void this.view?.webview.postMessage(message);
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = randomNonce();
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.js'));
    return `<!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
        <link href="${styleUri}" rel="stylesheet" />
        <title>Code Lens AI</title>
      </head>
      <body>
        <main id="app" aria-live="polite"></main>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}

function isMode(value: unknown): value is ExplainMode {
  return value === 'brief' || value === 'guided' || value === 'deep' || value === 'review';
}

function stringOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function randomNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

function asMarkdown(explanation: Explanation, context?: CodeContext): string {
  const flow = explanation.flow.map(item => `- **${item.step}**：${item.detail}`).join('\n');
  const risks = explanation.risks.map(item => `- ${item}`).join('\n') || '- 未发现需要特别标注的风险。';
  return `# 代码解释\n\n${context ? `> ${context.fileName} · ${context.rangeLabel}\n\n` : ''}## 一句话\n${explanation.summary}\n\n## 目的\n${explanation.purpose}\n\n## 执行流程\n${flow || '- 无。'}\n\n## 输入、输出与副作用\n${explanation.inputsOutputs}\n\n## 注意点\n${risks}`;
}
