---
name: pr-description
description: Create standardized Markdown pull request descriptions for Sessionux repositories. Use when asked to draft, generate, update, or review a PR description/body from local changes, commits, task links, issue references, or implementation notes.
---

# PR Description

Generate PR descriptions in the exact Sessionux Markdown structure.

## Workflow

1. Inspect the current repository changes with `git status --short`, `git diff --stat`, and focused diffs as needed.
2. Use recent commits only when the user asks for a commit-based PR description or the working tree is clean.
3. Identify the task code and task link from the user's request, branch name, commit message, or issue reference. If unavailable, keep a clear placeholder.
4. Classify changes into:
   - `Adicionado`: new files, features, tests, docs, workflows, APIs, components, or capabilities.
   - `Modificado`: changed behavior, refactors, configuration updates, threshold changes, or documentation updates.
   - `Corrigido`: bug fixes, failing checks fixed, broken config repaired, security hardening for incorrect behavior.
   - `Removido`: deleted files, removed dependencies, removed behavior, or obsolete docs.
5. Keep the description concise and factual. Avoid implementation trivia unless it is useful for reviewers.
6. Preserve every top-level and nested section even when a category has no items; write `- N/A` for empty categories.
7. Include validation evidence in `Observações` when available, such as `npm run check:all`, `npm run build`, CI status, or manual verification.

## Required Format

```markdown
## Escopo
[Descrição concisa da entrega apresentada pela PR]

## Tarefa
[Código da tarefa](Link da tarefa)

## Descrição

### Adicionado

- lista de itens adicionados pela PR

### Modificado

- lista de itens modificados pela PR

### Corrigido

- lista de itens corrigidos pela PR

### Removido

- lista de itens removidos pela PR

## Observações
[Informações complementares e/ou evidências, se necessário]
```

## Output Rules

- Return only the Markdown PR description unless the user asks for commentary.
- Use Portuguese by default.
- Use short bullets, one concrete change per bullet.
- Do not invent task links, test results, reviewers, or issue numbers.
- If the task is unknown, use `[TAREFA-000](TODO)` and mention in `Observações` that the task link needs confirmation.
