# Copilot instructions for the xcelera CLI / github action

- Match existing formatting (Biome): 2-space indent, single quotes, ~80 cols, minimal semicolons, no trailing commas.
- ESM TypeScript only: prefer Node stdlib, and use `.ts` extensions for internal imports.
- Prefer `const`, minimal typing, and narrow unions; avoid `any` and avoid clever generics unless needed.
- Keep functions small and single-purpose; separate pure parsing/formatting from I/O (fs/network/git).
- Validate inputs early with clear errors; throw `Error` with actionable messages.
- Tests: Jest, table/fixture-friendly where helpful; assert errors/warnings/messages explicitly. Only mock external APIs, and only when absolutely necessary. Use MSW for mocking API responses. We prefer a Classist testing style that tests groups of related modules together, and avoids testing implementation details.
