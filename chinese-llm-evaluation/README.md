# Chinese LLM Evaluation Benchmark v0.1

A small, reproducible Chinese (Simplified) benchmark for evaluating LLM reliability across instruction following, factuality, reasoning, Chinese language quality, safety, tool-use reliability, agent trajectories, robustness, preference judgment, and adversarial instruction handling.

## Why this benchmark

The benchmark is intentionally task-oriented rather than leaderboard-oriented. It is designed around the kinds of human evaluation and benchmark design that matter for deployed systems: task-specific evaluation, adversarial/edge cases, multilingual evaluation, longitudinal comparison, and agent trajectory assessment.

## Scope

- 50 Chinese (Simplified) evaluation tasks
- 10 capability dimensions
- 3 scoring dimensions per task: instruction following, correctness, clarity
- 0–6 points per task
- Machine-readable JSONL
- Deterministic local validation for dataset integrity
- Designed to be extended with model outputs and human ratings

## Important limitation

This is a portfolio/research benchmark, not a validated academic benchmark and not a claim about model quality in the real world. The gold notes are concise evaluation guidance, not exhaustive reference answers.

## Quick start

```bash
python src/validate_dataset.py
python src/score_outputs.py --predictions examples/predictions.sample.jsonl
```

`score_outputs.py` intentionally does **not** pretend to infer subjective human scores automatically. It checks schema and computes only objective metadata; human ratings should be added in a separate annotation file.

## Suggested evaluation protocol

1. Freeze the task set before model comparison.
2. Run every model on the same prompts and generation settings.
3. Blind the model identity during human rating.
4. Use at least two raters for subjective dimensions.
5. Report mean, median, inter-rater agreement, and category breakdowns.
6. Track failure examples, not only aggregate score.
7. For agents, score both final outcome and trajectory/process reliability.

## Directory

```text
dataset/tasks.jsonl              # 50 benchmark tasks
src/validate_dataset.py          # schema and integrity checks
src/score_outputs.py             # output schema checker + summary
examples/predictions.sample.jsonl
reports/evaluation_protocol.md
```

## Portfolio positioning

This project demonstrates practical ability in:
- human-evaluation rubric design
- multilingual/Chinese evaluation
- adversarial and edge-case generation
- agent reliability evaluation
- benchmark reproducibility
- failure analysis
