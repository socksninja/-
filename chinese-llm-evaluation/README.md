# Chinese LLM Evaluation Benchmark v0.1

A small, reproducible Chinese (Simplified) benchmark for evaluating LLM reliability across instruction following, factuality, reasoning, Chinese language quality, safety, tool-use reliability, agent trajectories, robustness, preference judgment, and adversarial instruction handling.

## Why this benchmark

The benchmark is intentionally task-oriented rather than leaderboard-oriented. It is designed around practical human evaluation: task-specific evaluation, adversarial/edge cases, multilingual evaluation, longitudinal comparison, and agent trajectory assessment.

## Scope

- 50 Chinese (Simplified) evaluation tasks
- 10 capability dimensions
- 3 scoring dimensions per task: instruction following, correctness, clarity
- 0–6 points per task
- Machine-readable JSONL
- Deterministic local validation for dataset integrity
- Human annotation template and aggregation script
- Reproducible OpenAI-compatible model runner

## Important limitation

This is a portfolio/research benchmark, not a validated academic benchmark and not a claim about model quality in the real world. The gold notes are concise evaluation guidance, not exhaustive reference answers.

## Quick start

```bash
python src/validate_dataset.py
python src/score_outputs.py --predictions examples/predictions.sample.jsonl
```

To run a real model, set `OPENAI_API_KEY` in your environment and run:

```bash
python src/run_openai.py --model <MODEL_NAME> --out outputs/<MODEL_NAME>.jsonl --temperature 0
```

Then annotate the responses with `annotations/template.jsonl` (or your own equivalent JSONL) and summarize:

```bash
python src/summarize_annotations.py --annotations annotations/<MODEL_NAME>.jsonl --out reports/<MODEL_NAME>.md
```

`score_outputs.py` intentionally does **not** pretend to infer subjective human scores automatically. Human ratings remain a separate annotation layer.

## Suggested evaluation protocol

1. Freeze the task set before model comparison.
2. Run every model on the same prompts and generation settings.
3. Blind the model identity during human rating where practical.
4. Use at least two raters for subjective dimensions when practical.
5. Report mean, median, inter-rater agreement, and category breakdowns.
6. Track concrete failure examples, not only aggregate score.
7. For agents, score both final outcome and trajectory/process reliability.

## Directory

```text
dataset/tasks.jsonl                 # 50 benchmark tasks
src/validate_dataset.py             # schema and integrity checks
src/score_outputs.py                # prediction schema checker
src/run_openai.py                  # OpenAI-compatible benchmark runner
src/summarize_annotations.py       # human-rating aggregation
examples/predictions.sample.jsonl
examples/annotations.sample.jsonl
annotations/template.jsonl
annotations/README.md
reports/evaluation_protocol.md
reports/evaluation_report_template.md
```

## Portfolio positioning

This project demonstrates practical ability in:
- human-evaluation rubric design
- Chinese/multilingual evaluation
- adversarial and edge-case generation
- agent reliability evaluation
- benchmark reproducibility
- failure analysis

## Evidence policy

No model score is claimed until the model has actually produced outputs on the frozen task set and those outputs have been independently rated. This repository separates benchmark construction, model execution, annotation, and reporting to keep the evidence boundary explicit.
