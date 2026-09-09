# Human annotation pack

Rate each model response independently. When practical, use at least two raters.

Scores per task:
- `instruction_following`: 0–2
- `correctness`: 0–2
- `clarity`: 0–2

Do not score from model identity or reputation. Judge the response against the task prompt and evaluation notes.

Workflow:
1. Run a model with `src/run_openai.py` or another compatible runner.
2. Convert predictions to annotation JSONL using `examples/annotations.sample.jsonl` as the schema reference.
3. Rate responses blindly where practical.
4. Run `src/summarize_annotations.py`.
5. Review concrete failures and complete `reports/evaluation_report_template.md`.
