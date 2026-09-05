const PROTOCOL_VERSION = "RNCP-PORTABLE-1";
const EXECUTOR_ID = "external-executor2-vercel-rsta016";
const IMPLEMENTATION = "standalone-webcrypto-next-route";
const EXECUTOR_REPOSITORY = "socksninja/-";
const EXECUTOR_REVISION = "rsta016-executor2-v1";

function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

async function sha256(value) {
  const data = new TextEncoder().encode(canonical(value));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(status, body) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request) {
  const url = new URL(request.url);
  const commitment = {
    protocol_version: PROTOCOL_VERSION,
    commitment_id: url.searchParams.get("commitment_id"),
    action: url.searchParams.get("action"),
    payload: JSON.parse(url.searchParams.get("payload") || "null"),
  };
  if (!commitment.commitment_id || !commitment.action) {
    return json(200, { protocol_version: PROTOCOL_VERSION, executor_id: EXECUTOR_ID, implementation: IMPLEMENTATION, executor_repository: EXECUTOR_REPOSITORY, executor_revision: EXECUTOR_REVISION, status: "READY" });
  }

  const required = ["commitment_id", "action", "payload"];
  if (required.some((k) => !(k in commitment))) return json(400, { decision: "REJECT", reason: "MISSING_PORTABLE_COMMITMENT_FIELDS" });

  const commitmentEnvelope = { protocol_version: PROTOCOL_VERSION, commitment_id: commitment.commitment_id, action: commitment.action, payload: commitment.payload };
  const commitment_hash = await sha256(commitmentEnvelope);
  const execution_id = `${EXECUTOR_ID}:${commitment.commitment_id}`;
  const observed = { status: "EXECUTED", action: commitment.action, payload: commitment.payload };
  const receiptCore = { protocol_version: PROTOCOL_VERSION, commitment_id: commitment.commitment_id, commitment_hash, execution_id, executor_id: EXECUTOR_ID, implementation: IMPLEMENTATION, executor_repository: EXECUTOR_REPOSITORY, executor_revision: EXECUTOR_REVISION, observed };
  const receipt_hash = await sha256(receiptCore);

  return json(200, { decision: "ACCEPT", capability: "EXECUTED", reality_receipt: { ...receiptCore, receipt_hash } });
}
