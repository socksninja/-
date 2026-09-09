import json, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
p = ROOT / "dataset" / "tasks.jsonl"
rows=[]
with p.open(encoding="utf-8") as f:
    for i,line in enumerate(f,1):
        x=json.loads(line)
        rows.append(x)
        for k in ("id","category","locale","prompt","evaluation_notes","scoring","max_score"):
            assert k in x, f"line {i}: missing {k}"
        assert x["locale"] == "zh-CN"
        assert x["max_score"] == 6
        assert set(x["scoring"]) == {"instruction_following","correctness","clarity"}
ids=[x["id"] for x in rows]
assert len(rows)==50, len(rows)
assert len(set(ids))==50, "duplicate ids"
cats={x["category"] for x in rows}
assert len(cats)==10, cats
print(f"PASS: {len(rows)} tasks, {len(cats)} categories, {len(set(ids))} unique ids")
