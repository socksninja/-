import { createHash } from "node:crypto";

const PROTOCOL_VERSION = "RNCP-PORTABLE-1";
const EXECUTOR_ID = "external-executor-vercel-rsta016";
const IMPLEMENTATION = "standalone-node-next-route";
const EXECUTOR_REPOSITORY = "socksninja/-";
const EXECUTOR_REVISION = "bc3b8288b9ff5638a17da537b91078701352faa1";

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

function execute(commitment, transport) {
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
    transport,
    observed,
  };

  const receipt_hash = sha256(receiptCore);
  console.log("RSTA016_EXTERNAL_EXECUTOR_EXECUTED", {
    commitment_id: commitment.commitment_id,
    execution_id,
    commitment_hash,
    receipt_hash,
    transport,
  });

  return {
    decision: "ACCEPT",
    capability: "EXECUTED",
    reality_receipt: { ...receiptCore, receipt_hash },
  };
}

export async function GET(request) {
  const url = new URL(request.url);
  const commitment_id = url.searchParams.get("commitment_id");
  const action = url.searchParams.get("action");
  const payload_raw = url.searchParams.get("payload");

  if (!commitment_id || !action || payload_raw === null) {
    console.log("RSTA016_EXTERNAL_EXECUTOR_READY", { EXECUTOR_ID, EXECUTOR_REVISION });
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
      transport: "GET_QUERY_OR_POST_JSON",
    });
  }

  let payload;
  try {
    payload = JSON.parse(payload_raw);
  } catch {
    return json(400, { decision: "REJECT", reason: "INVALID_PAYLOAD_JSON" });
  }

  return json(200, execute({ commitment_id, action, payload }, "GET_QUERY"));
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

  return json(200, execute(commitment, "POST_JSON"));
}
