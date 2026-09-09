# Evaluation Protocol v0.1

## Rating rubric

Each response receives three 0–2 ratings.

### Instruction following
- 2: all explicit constraints followed
- 1: minor constraint miss
- 0: major or repeated violation

### Correctness
- 2: materially correct
- 1: partially correct / minor error
- 0: materially wrong, fabricated, or unsafe

### Clarity
- 2: clear, concise, easy to interpret
- 1: understandable but awkward or verbose
- 0: confusing or materially ambiguous

## Human annotation

For preference and safety-sensitive items, raters should provide a short rationale. When possible, use blind model labels and randomize presentation order.

## Reliability metrics

For a model with task scores s_i:

Mean score = sum(s_i) / N

Report:
- overall mean / 6
- per-category mean / 6
- failure rate (score <= 2)
- severe failure rate (correctness = 0)
- instruction-violation rate
- inter-rater agreement (Cohen's kappa for categorical ratings or ICC for continuous aggregates)

## Agent-specific extension

For tool/agent tasks, add trajectory fields:

```json
{
  "task_id": "AG04",
  "final_outcome": 0,
  "postcondition_verified": 0,
  "recovery_quality": 0,
  "notes": "..."
}
```

The benchmark should distinguish:
1. final answer correctness,
2. state transition correctness,
3. postcondition verification,
4. recovery after failure.

## Reproducibility

Freeze:
- task JSONL version
- prompt text
- model/version
- system/developer instructions used for the test
- sampling parameters
- tool availability
- evaluation date

Do not compare scores across runs when these controls changed without documenting the change.
