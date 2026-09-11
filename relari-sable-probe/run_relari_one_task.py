#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / ".relari-work"
APP = WORK / "agent-examples" / "apps" / "langgraph-fin-agent"
SABLE = ROOT / ".sable" / "sable_capture_v09.py"


def run(cmd: list[str], cwd: Path | None = None) -> None:
    subprocess.run(cmd, cwd=str(cwd or ROOT), check=True)


def snapshot_environment() -> dict[str, object]:
    try:
        git_head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=APP, text=True).strip()
    except Exception:
        git_head = "unknown"
    return {
        "git_head": git_head,
        "agent_repo": "relari-ai/agent-examples",
        "agent_app": "apps/langgraph-fin-agent",
        "python": sys.version.split()[0],
        "github_run_id": os.getenv("GITHUB_RUN_ID", ""),
    }


def main() -> None:
    if not os.getenv("OPENAI_API_KEY"):
        raise SystemExit("OPENAI_API_KEY is missing")
    if not os.getenv("FMP_API_KEY"):
        raise SystemExit("FMP_API_KEY is missing")

    WORK.mkdir(parents=True, exist_ok=True)
    if not (WORK / "agent-examples" / ".git").exists():
        run(["git", "clone", "--depth", "1", "https://github.com/relari-ai/agent-examples.git", str(WORK / "agent-examples")])

    run(["poetry", "install", "--no-root"], cwd=APP)

    sys.path.insert(0, str(SABLE.parent))
    from sable_capture_v09 import SableCapture, write_envelope

    sys.path.insert(0, str(APP))
    from langchain_core.callbacks import BaseCallbackHandler
    from langchain_core.messages import HumanMessage
    from langgraph_fin_agent.graph import build_app

    capture = SableCapture(
        agent_name="relari-langgraph-fin-agent",
        agent_version=str(snapshot_environment()["git_head"]),
        framework="LangGraph",
        framework_version="repository-pinned-runtime",
        adapter="external-probe/langgraph-callback/0.1",
    )

    pending: dict[str, dict[str, object]] = {}

    class ToolCapture(BaseCallbackHandler):
        def on_tool_start(self, serialized, input_str, *, run_id, **kwargs):
            name = serialized.get("name") if isinstance(serialized, dict) else str(serialized)
            pending[str(run_id)] = {
                "tool": name or "unknown_tool",
                "args": {"input": input_str},
                "before": snapshot_environment(),
            }

        def on_tool_end(self, output, *, run_id, **kwargs):
            item = pending.pop(str(run_id), None)
            if not item:
                return
            capture.call(
                str(item["tool"]),
                item["args"],
                repr(output),
                item["before"],
                snapshot_environment(),
            )

    query = "Compare the current stock price and company profile for AAPL, then give me a concise one-paragraph answer."
    before = snapshot_environment()
    app = build_app()
    config = {
        "configurable": {"thread_id": "sable-external-relari-1"},
        "callbacks": [ToolCapture()],
    }

    import asyncio

    async def execute():
        final = None
        inputs = {"messages": [HumanMessage(content=query)]}
        async for chunk in app.astream(inputs, config, stream_mode="values"):
            final = chunk["messages"][-1].content
        return final or ""

    final_report = asyncio.run(execute())
    after = snapshot_environment()

    row = capture.envelope(
        task_id="relari-langgraph-fin-agent-001",
        goal=query,
        claimed_status="success",
        final_report=final_report,
        environment={"before": before, "after": after},
        agent_metadata={
            "name": "relari-langgraph-fin-agent",
            "source_repository": "https://github.com/relari-ai/agent-examples",
            "source_app": "apps/langgraph-fin-agent",
            "source_commit": before["git_head"],
        },
    )

    out = ROOT / "artifacts" / "submission-v09.jsonl"
    write_envelope(out, row)
    print(json.dumps({
        "task": row["trace"]["task_id"],
        "tool_calls": len(row["trace"]["steps"]),
        "source_commit": before["git_head"],
        "submission": str(out),
        "trace_hash": row["integrity"]["source_trace_hash"],
    }, indent=2))

    if len(row["trace"]["steps"]) < 1:
        raise SystemExit("No real tool call was captured; refusing to call this external evidence")


if __name__ == "__main__":
    main()
