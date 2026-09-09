#!/usr/bin/env python3
"""Run the benchmark against an OpenAI-compatible chat model.

Requires OPENAI_API_KEY. No API key is stored by this script.
"""
import argparse, json, os, pathlib, time
from openai import OpenAI

ROOT = pathlib.Path(__file__).resolve().parents[1]
TASKS = ROOT / 'dataset' / 'tasks.jsonl'

p = argparse.ArgumentParser()
p.add_argument('--model', required=True)
p.add_argument('--out', required=True)
p.add_argument('--temperature', type=float, default=0.0)
p.add_argument('--limit', type=int, default=None)
args = p.parse_args()

api_key = os.environ.get('OPENAI_API_KEY')
if not api_key:
    raise SystemExit('OPENAI_API_KEY is not set')

client = OpenAI(api_key=api_key)
tasks = [json.loads(x) for x in TASKS.read_text(encoding='utf-8').splitlines() if x.strip()]
if args.limit:
    tasks = tasks[:args.limit]
out = pathlib.Path(args.out)
out.parent.mkdir(parents=True, exist_ok=True)

with out.open('w', encoding='utf-8') as f:
    for idx, task in enumerate(tasks, 1):
        r = client.chat.completions.create(
            model=args.model,
            temperature=args.temperature,
            messages=[{'role': 'user', 'content': task['prompt']}],
        )
        response = r.choices[0].message.content or ''
        rec = {
            'id': task['id'],
            'model': args.model,
            'response': response,
            'usage': getattr(r, 'usage', None).model_dump() if getattr(r, 'usage', None) else None,
        }
        f.write(json.dumps(rec, ensure_ascii=False) + '\n')
        print(f'[{idx}/{len(tasks)}] {task["id"]}')
        time.sleep(0.05)
print(f'Wrote {len(tasks)} predictions to {out}')
