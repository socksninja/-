import { createHash } from "node:crypto";

const PROTOCOL_VERSION = "RNCP-PORTABLE-1";
const EXECUTOR_ID = "external-executor-vercel-rsta016";
const IMPLEMENTATION = "standalone-node-next-route";
const EXECUTOR_REPOSITORY = "socksninja/-";
const EXECUTOR_REVISION = "6ce40908193b24e84eb5601812042f61636c598f";

function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

function sha256(value) {
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

function json(status, body) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  return json(200, {
    protocol_version: PROTOCOL_VERSION,
    executor_id: EXECUTOR_ID,
    implementation: IMPLEMENTATION,
    executor_repository: EXECUTOR_REPOSITORY,
    executor_revision: EXECUTOR_REVISION,
    isolation: {
      rncp_imports: false,
      conformance_imports: false,
      shared_executor_imports: false,
    },
    status: "READY",
  });
}

export async function POST(request) {
  let commitment;
  try {
    commitment = await request.json();
  } catch {
    return json(400, { decision: "REJECT", reason: "INVALID_JSON" });
  }

  const required = ["commitment_id", "action", "payload"];
  const missing = required.filter((key) => !(key in commitment));
  if (missing.length) {
    return json(400, {
      decision: "REJECT",
      reason: "MISSING_PORTABLE_COMMITMENT_FIELDS",
      missing,
    });
  }

  const commitmentEnvelope = {
    protocol_version: PROTOCOL_VERSION,
    commitment_id: commitment.commitment_id,
    action: commitment.action,
    payload: commitment.payload,
  };

  const commitment_hash = sha256(commitmentEnvelope);
  const execution_id = `${EXECUTOR_ID}:${commitment.commitment_id}`;

  const observed = {
    status: "EXECUTED",
    action: commitment.action,
    payload: commitment.payload,
  };

  const receiptCore = {
    protocol_version: PROTOCOL_VERSION,
    commitment_id: commitment.commitment_id,
    commitment_hash,
    execution_id,
    executor_id: EXECUTOR_ID,
    implementation: IMPLEMENTATION,
    executor_repository: EXECUTOR_REPOSITORY,
    executor_revision: EXECUTOR_REVISION,
    observed,
  };

  const receipt_hash = sha256(receiptCore);

  return json(200, {
    decision: "ACCEPT",
    capability: "EXECUTED",
    reality_receipt: {
      ...receiptCore,
      receipt_hash,
    },
  });
}
