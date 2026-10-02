# Bulk QA Import — 34 domains × 700000 turns

Պարտադիր աղբյուրներ (միայն այս 34 թեմաները, հերթականությամբ)՝
`app/km_gemini_config.js` → `CURRICULUM_34_DAYS`, `MAX_TURNS=700000`, `CURRICULUM_TOTAL_QA=700000`.

## Ավտոմատ գեներացիա + ներմուծում

```powershell
cd app

# Ամբողջ խողովակ (batch → bulk-import/generated → BotKnowledge import+FTS)
npm run pipeline:700k

# Շարունակել + Wikipedia open data
npm run pipeline:700k:resume

# Միայն արդեն գեներացված JSONL-երի ներմուծում
npm run pipeline:700k:import

# Փոքր թեստ
npm run pipeline:700k -- --target 5000 --batch 1000 --dry-run
```

Generated batches → `app/data/bulk-import/generated/day-XX-batch-YYYYY.jsonl`  
Progress → `generated/.gen-progress.json`

## Ձեռքով ներմուծում

```powershell
npm run bot:import
npm run bot:fts
```

## Ֆորմատ (մեկ JSON տող)

```json
{"q":"…","a":"…","day":3,"domain":"Ֆիզիկա","turn":1,"source":"bulk-gen","tags":["curriculum34","day-3"]}
```

## Պահեստ (runtime)

`%LOCALAPPDATA%\KM\UserData\BotKnowledge\`

- `qa.jsonl`
- `knowledge.db` (SQLite FTS5)
- `vectors/index.json`

## Help Bot turn limit

Օրական/սեսիա՝ **700000** (`MAX_TURNS`). Հին 800 սահմանը հանված է։
