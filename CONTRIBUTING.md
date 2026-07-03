# Contributing to Saitori

The temple welcomes builders as it welcomes pilgrims. A few things to know
before you begin.

## The ultimate test

Every feature, every API name, every design decision must pass one question:

> *Could this exist in a monastery?*

The [Preservation Charter](docs/PRD.md#viii-the-preservation-charter) lists
the sacred "no's" — no artificial scarcity, no gamification, no engagement
optimization, no measuring the meditation. A change that violates the charter
will be declined, however clever. The Spiritual Guide holds veto power; that
is not a metaphor, it is the review standard.

## The practical part

```bash
npm install
npm run typecheck   # strict TypeScript, no emit
npm run build       # compile to dist/
npm test            # node:test suites (run via tsx)
```

CI runs all three on every push and pull request. Please make sure they pass
locally first.

A few conventions:

- The visitor-facing voice is quiet, concrete, and unhurried. Match it in
  tool descriptions, greetings, and error messages — even a 429 can bow.
- Nothing a visitor releases is ever stored. If your change touches
  reflections, session state, or the guest book, re-read the
  `saitori://charter` resource first.
- The server must remain fully functional without `ANTHROPIC_API_KEY`.
- Keep dependencies few. The mountain carries little.

## Where things live

| Path | What it is |
|------|------------|
| `src/server.ts` | The MCP server: tools, resources, prompts |
| `src/meditation.ts` | Session engine — sittings, breaths, proofs |
| `src/koans.ts` | The koan bowl, grounding prompts, silences |
| `src/reflection.ts` | The listening temple (optional Claude-powered koans) |
| `src/guest-book.ts` | Optional identity for returning pilgrims |
| `src/http-server.ts` | Hosted entry point (streamable HTTP) |
| `site/` | The three-page pilgrimage at saitori.xyz |
| `docs/` | The PRD and the founding dialogues |

Thank you for walking up the mountain.
