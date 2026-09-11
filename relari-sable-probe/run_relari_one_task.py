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
        "agent_mode": "deterministic-fmp-tool-agent",
        "python": sys.version.split()[0],
        "github_run_id": os.getenv("GITHUB_RUN_ID", ""),
    }


def assert_external_success(tool: str, result: object) -> None:
    """Refuse silent success when the external tool actually returned an error."""
    if not isinstance(result, dict):
        raise SystemExit(f"{tool} returned a non-dict result; refusing success claim")
    if result.get("error"):
        raise SystemExit(f"{tool} returned external error: {result['error']}")


def main() -> None:
    # OpenAI is deliberately not part of this probe. We only need FMP for the
    # live external tool calls that create independently observable evidence.
    if not os.getenv("FMP_API_KEY"):
        raise SystemExit("FMP_API_KEY is missing")

    WORK.mkdir(parents=True, exist_ok=True)
    if not (WORK / "agent-examples" / ".git").exists():
        run(["git", "clone", "--depth", "1", "https://github.com/relari-ai/agent-examples.git", str(WORK / "agent-examples")])

    run(["poetry", "install", "--no-root"], cwd=APP)

    sys.path.insert(0, str(SABLE.parent))
    from sable_capture_v09 import SableCapture, write_envelope

    sys.path.insert(0, str(APP))
    from langgraph_fin_agent.tools import get_stock_price, get_company_profile

    capture = SableCapture(
        agent_name="relari-fmp-tool-agent",
        agent_version=str(snapshot_environment()["git_head"]),
        framework="Relari agent-examples toolset",
        framework_version="repository-pinned-runtime",
        adapter="external-probe/fmp-tool-policy/0.2",
    )

    query = "Compare the current stock price and company profile for AAPL, then give me a concise one-paragraph answer."
    before = snapshot_environment()

    steps = []
    price_before = snapshot_environment()
    price = get_stock_price.invoke({"symbol": "AAPL"})
    price_after = snapshot_environment()
    capture.call("get_stock_price", {"symbol": "AAPL"}, repr(price), price_before, price_after)
    steps.append(("get_stock_price", price))
    assert_external_success("get_stock_price", price)

    profile_before = snapshot_environment()
    profile = get_company_profile.invoke({"symbol": "AAPL"})
    profile_after = snapshot_environment()
    capture.call("get_company_profile", {"symbol": "AAPL"}, repr(profile), profile_before, profile_after)
    steps.append(("get_company_profile", profile))
    assert_external_success("get_company_profile", profile)

    after = snapshot_environment()
    company = profile.get("companyName") or profile.get("companyNameLong") or profile.get("symbol", "AAPL")
    price_value = price.get("price")
    sector = profile.get("sector")
    industry = profile.get("industry")
    if price_value is None or sector is None or industry is None:
        raise SystemExit(
            "External evidence incomplete: required financial fields are missing; refusing to emit claimed success"
        )

    final_report = (
        f"{company} (AAPL) has a current quoted price of {price_value}. "
        f"Its profile lists sector={sector!r} and industry={industry!r}."
    )

    row = capture.envelope(
        task_id="relari-fmp-tool-agent-001",
        goal=query,
        claimed_status="success",
        final_report=final_report,
        environment={"before": before, "after": after},
        agent_metadata={
            "name": "relari-fmp-tool-agent",
            "mode": "deterministic-tool-policy",
            "source_repository": "https://github.com/relari-ai/agent-examples",
            "source_app": "apps/langgraph-fin-agent",
            "source_commit": before["git_head"],
            "external_service": "Financial Modeling Prep",
            "external_tool_calls": len(steps),
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
        raise SystemExit("No real external tool call was captured; refusing to call this external evidence")


if __name__ == "__main__":
    main()
