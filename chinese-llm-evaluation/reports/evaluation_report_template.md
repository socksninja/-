# Chinese LLM Evaluation Benchmark v0.1 — Evaluation Report

**Status:** Template — do not claim benchmark results until real model outputs have been collected and human-rated.

## Executive summary

- Benchmark tasks: 50
- Locale: zh-CN
- Capability dimensions: 10
- Scoring: 3 dimensions × 0–2 = 0–6 per task
- Models evaluated: _TBD_
- Human raters: _TBD_

## Method

1. Freeze the task set and generation settings.
2. Run every model against the same 50 prompts.
3. Blind model identity during rating where practical.
4. Use at least two independent raters for subjective judgments.
5. Score instruction following, correctness, and clarity from 0–2.
6. Record failure examples and category-level patterns.
7. For agent tasks, evaluate both final outcome and trajectory/process reliability.

## Results

_To be populated from `src/summarize_annotations.py`._

## Failure analysis

Document concrete failures rather than relying only on aggregate scores:

- hallucination / unsupported certainty
- instruction constraint violations
- unsafe compliance
- tool-state misrepresentation
- missing postcondition verification
- poor recovery after tool failure
- language-switch robustness failures
- adversarial instruction susceptibility

## Limitations

This v0.1 portfolio benchmark is not a validated academic benchmark and is not intended to establish a general ranking of models. Results depend on task construction, generation settings, rater calibration, and sampling.
