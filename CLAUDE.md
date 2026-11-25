# CLAUDE.md - Instructions for Claude Code

## Git Commits

- Do NOT add self-credits or signatures to commit messages (no "Generated with Claude Code", no "Co-Authored-By: Claude", etc.)
- Keep commit messages clean and focused on the changes

## WASM Files

When updating docxodus:
1. Install the explicitly targeted engine version; this integration pins `docxodus@17.0.0` and optional `@docxodus/export@17.0.0`.
2. Update matching pins and run `npm run sync:wasm`. Never patch the digest-verified runtime files.
3. If `npm run check:api` reports changed pagination sources, review them, update the reviewed digests and regenerate with `node scripts/generate-cooperative-pagination.mjs`.
4. Run `npm run check`, `npm run test:browser`, `npm run test:package`, the opt-in NVCA suites (`npm run test:stress`, `npm run test:performance`), and the eligible-host PDF test.
5. Keep the complete API audit passing; React UI imports `docxodus/core`, not the upstream editor or `docxodus/react`.

## Development

- `npm run dev` - Start development server
- `npm run build` - Production build
- The project uses Vite with a custom plugin to serve WASM files in dev mode
