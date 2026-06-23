## TODO - Kiro SDLC Agents VSCode Extension (Local Deploy)

- [x] 1) Build extension (`kiro-sdlc-agents`) using `npm run esbuild-production` to generate `out/extension.js`
- [x] 2) Package extension into a fresh `.vsix` using `npx vsce package`
- [x] 3) Deploy to local VSCode using `code --install-extension <generated-vsix-path>`
- [ ] 4) Verify installation by opening VSCode and running command: `Kiro SDLC: Status` / check activity bar “Kiro SDLC”
- [ ] 5) (Optional) If verification fails, inspect output/extension logs and adjust build/package steps
