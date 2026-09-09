import argparse, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument("--predictions", required=True)
args=parser.parse_args()
pred_path=pathlib.Path(args.predictions)
tasks={x["id"]:x for x in (json.loads(line) for line in (ROOT/"dataset/tasks.jsonl").open(encoding="utf-8"))}
preds=[json.loads(line) for line in pred_path.open(encoding="utf-8")]
seen=set()
for i,p in enumerate(preds,1):
    assert p["id"] in tasks, f"unknown task id: {p.get('id')}"
    assert p["id"] not in seen, f"duplicate prediction id: {p['id']}"
    assert isinstance(p.get("response"), str), f"line {i}: response must be string"
    seen.add(p["id"])
print("Prediction schema PASS")
print(f"Tasks in benchmark: {len(tasks)}")
print(f"Predictions supplied: {len(preds)}")
print(f"Coverage: {len(seen)/len(tasks):.1%}")
missing=sorted(set(tasks)-seen)
if missing: print("Missing ids:", ", ".join(missing))
print("No automatic quality score is produced: subjective human scoring belongs in the annotation layer.")
