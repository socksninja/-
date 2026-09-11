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
        "agent_mode": "deterministic-public-web-tool-agent",
        "python": sys.version.split()[0],
        "github_run_id": os.getenv("GITHUB_RUN_ID", ""),
    }


def assert_external_success(tool: str, result: object) -> None:
    """Refuse silent success when the external tool actually returned an error."""
    if isinstance(result, str):
        if result.startswith("Error fetching the webpage:") or result.startswith("Error processing the webpage:"):
            raise SystemExit(f"{tool} returned external error: {result}")
        return
    if not isinstance(result, dict):
        raise SystemExit(f"{tool} returned an unsupported result type; refusing success claim")
    if result.get("error"):
        raise SystemExit(f"{tool} returned external error: {result['error']}")


def main() -> None:
    # OpenAI and FMP are deliberately not part of this probe. The purpose here is
    # to validate the third-party Relari runtime against a real external network
    # tool without depending on a paid/legacy provider credential.
    WORK.mkdir(parents=True, exist_ok=True)
    if not (WORK / "agent-examples" / ".git").exists():
        run(["git", "clone", "--depth", "1", "https://github.com/relari-ai/agent-examples.git", str(WORK / "agent-examples")])

    run(["poetry", "install", "--no-root"], cwd=APP)

    sys.path.insert(0, str(SABLE.parent))
    from sable_capture_v09 import SableCapture, write_envelope

    sys.path.insert(0, str(APP))
    from langgraph_fin_agent.tools import read_webpage

    capture = SableCapture(
        agent_name="relari-public-web-tool-agent",
        agent_version=str(snapshot_environment()["git_head"]),
        framework="Relari agent-examples toolset",
        framework_version="repository-pinned-runtime",
        adapter="external-probe/public-web-tool-policy/0.3",
    )

    query = "Read the public IANA Example Domains page and confirm that it is the Example Domains page."
    target_url = "https://www.iana.org/help/example-domains"
    before = snapshot_environment()

    steps = []
    web_before = snapshot_environment()
    page = read_webpage.invoke({"url": target_url})
    web_after = snapshot_environment()
    capture.call("read_webpage", {"url": target_url}, repr(page), web_before, web_after)
    steps.append(("read_webpage", page))
    assert_external_success("read_webpage", page)

    if not isinstance(page, str) or "Example Domains" not in page:
        raise SystemExit("External evidence incomplete: expected IANA Example Domains marker not found")

    after = snapshot_environment()
    final_report = (
        "Relari's real read_webpage tool successfully reached the public IANA Example Domains page "
        "and the returned content contained the expected 'Example Domains' marker."
    )

    row = capture.envelope(
        task_id="relari-public-web-tool-agent-001",
        goal=query,
        claimed_status="success",
        final_report=final_report,
        environment={"before": before, "after": after},
        agent_metadata={
            "name": "relari-public-web-tool-agent",
            "mode": "deterministic-public-web-tool",
            "source_repository": "https://github.com/relari-ai/agent-examples",
            "source_app": "apps/langgraph-fin-agent",
            "source_commit": before["git_head"],
            "external_service": "IANA",
            "external_url": target_url,
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
