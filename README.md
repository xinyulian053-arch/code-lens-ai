# Code Lens AI

**Understand unfamiliar code without leaving VS Code.**

[Install from VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=XinyuLabs.code-lens-ai)

[简体中文](README.zh-CN.md) · [Report a bug](https://github.com/xinyulian053-arch/code-lens-ai/issues/new?template=bug_report.yml) · [Request a feature](https://github.com/xinyulian053-arch/code-lens-ai/issues/new?template=feature_request.yml)

> Code Lens AI turns a selected code fragment into a clear explanation: the conclusion first, then the logic, inputs and outputs, risks, and a place to ask the next question.

## Why Code Lens AI?

Reading an unfamiliar codebase is rarely a one-shot question. You want a quick answer when scanning, a patient walkthrough when learning, and risks called out when reviewing. Code Lens AI keeps those paths in one lightweight sidebar.

- Explain the current selection, or the current line when nothing is selected.
- Choose the explanation depth: **Quick read**, **Beginner-friendly**, **Deep dive**, or **Review**.
- Ask follow-up questions in a continuous thread that keeps the selected fragment, initial explanation, and recent conversation context.
- Connect any OpenAI-compatible `/chat/completions` API, including DeepSeek.
- Keep API keys in VS Code SecretStorage; they are never written to workspace settings, and can be explicitly deleted from the connection panel.
- Use a clearly labeled local preview before configuring a model provider.

## Quick start

1. Download a release `.vsix` file, then run **Extensions: Install from VSIX...** in VS Code.
2. Reload the VS Code window.
3. Open the **Code Lens AI** icon in the Activity Bar.
4. Under **AI Connection & Privacy**, add your API key, API base URL, and model name.
5. Select code and press `Ctrl+Alt+E` (`Cmd+Alt+E` on macOS), or choose **Explain current code** from the editor context menu.

### DeepSeek preset

| Setting | Value |
| --- | --- |
| API base URL | `https://api.deepseek.com` |
| Model | `deepseek-chat` |
| API key | Your DeepSeek key (`sk-...`) |

Do not append `/chat/completions`; Code Lens AI adds that endpoint automatically.

## Privacy

Your selected code is sent only after you choose **Explain** or ask a follow-up, and only to the API provider you configure. The optional surrounding context is limited to 40 lines and can be disabled in VS Code Settings with `Code Lens AI: Send Surrounding Context`.

Read the full [privacy note](PRIVACY.md).

## Development

```powershell
npm install
npm run compile
```

Press `F5` in VS Code to open an Extension Development Host. Run `npm run lint` before opening a pull request, and `npm run package` to build a `.vsix`.

## Roadmap

- [ ] English / Simplified Chinese UI and response-language switching
- [ ] Code-evidence links that jump from an explanation to the relevant line
- [ ] Provider presets for DeepSeek and other compatible APIs
- [ ] Explain Git diffs and error stacks

## Contributing

Contributions, UX feedback, and provider-compatibility reports are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

[MIT](LICENSE)
