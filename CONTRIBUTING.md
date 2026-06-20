# Contributing to Code Lens AI

Thanks for helping make code reading calmer and clearer.

## Before opening a pull request

1. Create a focused branch from `main`.
2. Keep changes small and describe the user-facing result.
3. Run `npm run lint` and `npm run compile`.
4. Include screenshots or a short recording for Webview UI changes.
5. Do not commit API keys, provider credentials, generated `.vsix` files, or `node_modules`.

## Issues

For a bug report, include the VS Code version, extension version, provider and model name (never the key), expected behavior, and a minimal reproducible code sample with sensitive details removed.

## Design principles

- The conclusion should be visible before the details.
- Do not present a guess as a fact.
- Respect the user's code and privacy.
- Keep interactions fast enough to fit inside code-reading flow.
