# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- `docs/specs/README.md` and the spec for the area. The project glossary lives in that index.
- `docs/decisions/`: decisions that touch the area. Approval state is in the decision record itself.
- `CONTEXT.md` at the repo root, if the file exists.
- `CONTEXT-MAP.md` at the repo root, if it exists: it points at one `CONTEXT.md` per context. Read each one relevant to the topic.

If `CONTEXT.md` does not exist, proceed silently. Don't flag its absence and don't suggest creating it upfront. The `/domain-modeling` skill creates it lazily when terms actually get resolved.

## File structure

Single-context repo:

```
/
├── docs/specs/          ← requirements and glossary
├── docs/decisions/      ← decisions and their approval state
└── docs/issues/         ← historical local delivery notes
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `docs/specs/README.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag decision conflicts

If your output contradicts an existing decision, surface it explicitly rather than silently overriding:

> Contradicts decision NN, but worth reopening because…
