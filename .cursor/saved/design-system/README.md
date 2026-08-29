# Design system handoff artifacts

This folder stores outputs from the design-system skill pipeline.

## Files

| File | Producer | Consumer |
|------|----------|----------|
| `design-system-spec.json` | `@design-system-auditor` | `@ui-system-transformer` |
| `design-system-spec.md` | `@design-system-auditor` | Human review |
| `transform-report.md` | `@ui-system-transformer` | QA / iteration |

## Usage

```text
@design-system-auditor audita /app dark, propón light
→ review design-system-spec.json

@ui-system-transformer implementa design-system-spec.json scope: both
→ review transform-report.md + toggle in browser
```

Specs are local working artifacts; commit only when the team wants to version a palette decision.
