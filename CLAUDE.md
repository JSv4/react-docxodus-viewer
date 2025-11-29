# CLAUDE.md - Instructions for Claude Code

## Git Commits

- Do NOT add self-credits or signatures to commit messages (no "Generated with Claude Code", no "Co-Authored-By: Claude", etc.)
- Keep commit messages clean and focused on the changes

## WASM Files

When updating docxodus:
1. `npm install docxodus@latest`
2. `rm -rf public/wasm && cp -r node_modules/docxodus/dist/wasm public/wasm`
3. `npm run build`

## Development

- `npm run dev` - Start development server
- `npm run build` - Production build
- The project uses Vite with a custom plugin to serve WASM files in dev mode
