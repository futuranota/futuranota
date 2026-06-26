# Blueprint: Intel model selector + créditos por consumo

> **Estado:** implementado  
> **Fecha:** 2026-06-25

## Resumen

Intel permite elegir modelo (Gemini Flash/Pro, Groq Llama 70B/8B). Cada búsqueda debita créditos según modelo; Pro ve `0/150`, Free `0/10`.

## Catálogo

[`server/intelModels.js`](../../server/intelModels.js) — re-export en [`src/lib/intelModels.js`](../../src/lib/intelModels.js).

| ID | Label | Créditos | Tokens |
|----|-------|----------|--------|
| gemini-flash | Gemini 2.0 Flash | 1 | 10,000 |
| groq-llama-8b | Groq Llama 3.1 8B | 1 | 10,000 |
| groq-llama-70b | Groq Llama 3.3 70B | 1 | 10,000 |
| gemini-pro | Gemini 2.5 Pro | 2 | 20,000 (solo Pro) |

## Flujo

1. UI [`IntelModelSelect`](../../src/components/intel/IntelModelSelect.jsx) → `intelSelectedModelId` (localStorage).
2. `runIntelSearch` → preflight + `POST /api/intel/overview` con `modelId`.
3. Server `completeJsonForProvider` → LLM explícito (sin fallback).
4. Débito: Free `search_count += creditCost` · Pro `tokens_balance -= tokenCost`.

## Env opcional

- `GEMINI_FLASH_MODEL`, `GEMINI_PRO_MODEL`, `GROQ_MODEL`, `GROQ_FALLBACK_MODEL`
