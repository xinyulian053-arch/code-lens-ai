# Code Lens AI

**不离开 VS Code，也能把陌生代码讲明白。**

[English](README.md) · [报告问题](https://github.com/xinyulian053-arch/code-lens-ai/issues/new?template=bug_report.yml) · [提出功能建议](https://github.com/xinyulian053-arch/code-lens-ai/issues/new?template=feature_request.yml)

> Code Lens AI 会把选中的代码整理成清晰解释：先给结论，再说明逻辑、输入输出、风险，并保留继续追问的入口。

## 它解决什么问题？

阅读陌生项目不是一次提问就结束的事：扫代码时想快速知道它做什么，学习时想逐步理解，审查时想优先看到风险。Code Lens AI 把这些路径放进一个轻量侧栏。

- 解释当前选区；没有选区时解释光标所在行。
- 四种讲解深度：**一句话速读**、**新人友好**、**深入原理**、**审查模式**。
- 对同一片代码连续追问，不必重复粘贴上下文；当前代码、初始解释和最近对话会自动带入。
- 支持任意 OpenAI-compatible `/chat/completions` 服务，包括 DeepSeek。
- API Key 使用 VS Code SecretStorage 保存，不会写入工作区配置文件；可在连接面板中单独删除。
- 未配置模型时也可使用明确标识的本地快速预览。

## 快速开始

1. 下载 Release 中的 `.vsix` 文件，在 VS Code 运行“Extensions: Install from VSIX...”。
2. 重载 VS Code 窗口。
3. 点击活动栏中的 **Code Lens AI** 图标。
4. 在“AI 连接与隐私”填写 API Key、API 地址与模型名。
5. 选中代码后按 `Ctrl+Alt+E`（macOS：`Cmd+Alt+E`），或右键选择“解释当前代码”。

### DeepSeek 配置

| 字段 | 填写内容 |
| --- | --- |
| API 地址 | `https://api.deepseek.com` |
| 模型名称 | `deepseek-chat` |
| API Key | 你的 DeepSeek Key（`sk-...`） |

不需要填写 `/chat/completions`；扩展会自动补上这个路径。

## 隐私

只有在点击“解释”或发送追问后，扩展才会把代码发送给你配置的 API 服务。相邻上下文默认最多 40 行，可通过 VS Code 设置 `Code Lens AI: Send Surrounding Context` 关闭。

完整说明见 [PRIVACY.md](PRIVACY.md)。

## 本地开发

```powershell
npm install
npm run compile
```

在 VS Code 中按 `F5` 开启扩展开发宿主。提交前请运行 `npm run lint`；运行 `npm run package` 可生成 `.vsix`。

## 路线图

- [ ] 中英 UI 与回答语言切换
- [ ] 可点击的代码证据和行号跳转
- [ ] DeepSeek 等服务的一键配置预设
- [ ] Git Diff 与报错堆栈解释

## 参与贡献

欢迎提交功能建议、界面反馈和模型兼容性报告。提交 PR 前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)
