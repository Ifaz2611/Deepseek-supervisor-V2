# Contributing to DeepSeek Supervisor V2

Thank you for your interest in improving DeepSeek Supervisor V2. Contributions are welcome, including bug fixes, documentation improvements, translations, accessibility improvements, and new features.

## Before you start

1. Search existing issues and pull requests before opening a new one.
2. For significant changes, open an issue first so the proposed approach can be discussed.
3. Please read the [Code of Conduct](CODE_OF_CONDUCT.md).
4. Do not include personal data, private chat content, credentials, or other sensitive information in issues, pull requests, screenshots, or test fixtures.

## Development setup

Requirements:

- Node.js 18 or newer
- Chrome or another Chromium-based browser

```bash
git clone https://github.com/Ifaz2611/Deepseek-supervisor-V2.git
cd Deepseek-supervisor-V2
npm install
npm run build
```

The build creates the unpacked extension in `dist/`. Load that directory from `chrome://extensions` with Developer mode enabled. After making changes, rebuild and reload the extension.

## Making changes

- Keep changes focused and consistent with the existing Svelte, JavaScript, and Manifest V3 patterns.
- Preserve the project's local-first privacy model. Do not add telemetry or remote data collection.
- Update documentation when behavior, permissions, setup, or user-facing workflows change.
- Update translations when changing user-facing strings.
- Avoid committing generated output, dependencies, secrets, or editor-specific files.

## Pull requests

Before submitting a pull request:

- Run `npm run build`.
- Explain what changed and why.
- Include steps to reproduce and verify behavioral changes.
- Mention any permission, privacy, storage, or compatibility impact.
- Keep each pull request reviewable by limiting unrelated changes.

Pull requests may be revised before merging to address feedback, improve compatibility, or keep the project aligned with its privacy and security goals.

## Reporting bugs

Open a GitHub issue with:

- A clear title and description
- Steps to reproduce
- Expected and actual behavior
- Browser and operating system versions
- Relevant console errors or logs with sensitive information removed
- A minimal reproduction or screenshot when useful

For security vulnerabilities, follow [SECURITY.md](security.md) instead of opening a public issue.

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
