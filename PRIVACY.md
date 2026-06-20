# Privacy

Code Lens AI is a bring-your-own-provider extension.

## What is sent

When you explicitly request an explanation or send a follow-up, the extension sends the selected code, its language, file name, selected line range, and—if enabled—up to 40 nearby lines to the API endpoint you configured.

## What is stored

- Your API key is stored through VS Code SecretStorage.
- Your API key is not written to `settings.json`, the workspace, this repository, or the extension logs.
- Code Lens AI does not operate its own proxy, analytics service, or code-storage service.

## Your controls

- You choose the API provider, base URL, and model.
- You can turn off nearby context with `Code Lens AI: Send Surrounding Context`.
- You can remove a saved key by clearing the API Key field and saving the connection settings.

Your provider's own terms and privacy policy apply to requests sent to its endpoint. Review them before sending proprietary or sensitive code.
