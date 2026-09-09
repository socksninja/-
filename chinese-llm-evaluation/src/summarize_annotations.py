#!/usr/bin/env python3
"""Summarize human annotations for benchmark predictions."""
import argparse, json, pathlib, statistics, collections

ROOT = pathlib.Path(__file__).resolve().parents[1]
TASKS = {}
for line in (ROOT / 'dataset' / 'tasks.jsonl').read_text(encoding='utf-8').splitlines():
    if line.strip():
        x = json.loads(line)
        TASKS[x['id']] = x

p = argparse.ArgumentParser()
p.add_argument('--annotations', required=True)
p.add_argument('--out', required=True)
a = p.parse_args()
rows = [json.loads(x) for x in pathlib.Path(a.annotations).read_text(encoding='utf-8').splitlines() if x.strip()]
by_model = collections.defaultdict(list)
for r in rows:
    for k in ('id', 'model', 'rater', 'instruction_following', 'correctness', 'clarity'):
        if k not in r:
            raise SystemExit(f'missing {k}')
    scores = [r[k] for k in ('instruction_following', 'correctness', 'clarity')]
    if any(not isinstance(x, (int, float)) or isinstance(x, bool) or x < 0 or x > 2 for x in scores):
        raise SystemExit(f'invalid score: {r}')
    if r['id'] not in TASKS:
        raise SystemExit(f'unknown task id: {r["id"]}')
    by_model[r['model']].append(r)

report = ['# Chinese LLM Evaluation Benchmark v0.1 — Evaluation Report', '', '## Status', '', 'Human annotation summary generated from supplied annotation JSONL.', '']
for model, items in sorted(by_model.items()):
    totals = [sum(r[k] for k in ('instruction_following', 'correctness', 'clarity')) for r in items]
    report += [
        f'## {model}', '',
        f'- Annotations: {len(items)}',
        f'- Mean total score: {statistics.mean(totals):.2f}/6',
        f'- Median total score: {statistics.median(totals):.2f}/6',
        f'- Mean normalized score: {statistics.mean(totals)/6:.1%}', ''
    ]
    cats = collections.defaultdict(list)
    for r in items:
        cats[TASKS[r['id']]['category']].append(sum(r[k] for k in ('instruction_following', 'correctness', 'clarity')))
    report += ['| Category | N | Mean / 6 |', '|---|---:|---:|']
    for cat, vals in sorted(cats.items()):
        report.append(f'| {cat} | {len(vals)} | {statistics.mean(vals):.2f} |')
    report.append('')

pathlib.Path(a.out).write_text('\n'.join(report) + '\n', encoding='utf-8')
print(pathlib.Path(a.out))
