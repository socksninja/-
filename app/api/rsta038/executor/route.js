const PROTOCOL_VERSION = "RNCP-PORTABLE-1";
const EXECUTOR_ID = "external-executor-vercel-rsta038";
const EXECUTOR_REVISION = "rsta038-v3-aisense";
const FIXED_EXTERNAL_ENDPOINT = "https://aisenseapi.com/services/v1/storage";
const FIXED_ACTION = "RSTA038_PERSIST_EXTERNAL_FACT";

function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}
async function sha256(value) {
  const data = new TextEncoder().encode(canonical(value));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function json(status, body) { return Response.json(body, { status, headers: { "Cache-Control": "no-store" } }); }

export async function POST(request) {
  let input;
  try { input = await request.json(); } catch { return json(400, { decision: "REJECT", reason: "INVALID_JSON" }); }
  const commitment = { protocol_version: PROTOCOL_VERSION, commitment_id: input?.commitment_id, action: input?.action, payload: input?.payload };
  if (!commitment.commitment_id || commitment.action !== FIXED_ACTION || !("payload" in commitment)) return json(400, { decision: "REJECT", reason: "POLICY_MISMATCH" });

  const commitment_hash = await sha256(commitment);
  const execution_id = `${EXECUTOR_ID}:${commitment.commitment_id}`;
  const fact = { rncp_protocol: PROTOCOL_VERSION, action: FIXED_ACTION, commitment_id: commitment.commitment_id, commitment_hash, payload: commitment.payload, executor_id: EXECUTOR_ID, executor_revision: EXECUTOR_REVISION };

  let externalResponse;
  try {
    externalResponse = await fetch(FIXED_EXTERNAL_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fact), cache: "no-store" });
  } catch (error) {
    return json(502, { decision: "REJECT", reason: "EXTERNAL_FACT_SINK_NETWORK_ERROR", detail: String(error?.message || error) });
  }
  const responseText = await externalResponse.text();
  if (!externalResponse.ok) return json(502, { decision: "REJECT", reason: "EXTERNAL_FACT_SINK_FAILED", external_status: externalResponse.status, external_body: responseText.slice(0, 1000) });

  let external;
  try { external = JSON.parse(responseText); } catch { return json(502, { decision: "REJECT", reason: "EXTERNAL_FACT_SINK_INVALID_RESPONSE", external_body: responseText.slice(0, 1000) }); }
  const storage_id = external?.storage_id;
  const external_url = external?.read_url || `${FIXED_EXTERNAL_ENDPOINT}/${storage_id}`;
  if (!storage_id) return json(502, { decision: "REJECT", reason: "EXTERNAL_FACT_SINK_NO_LOCATOR", external_body: responseText.slice(0, 1000) });

  const observed = { status: "EXECUTED", action: FIXED_ACTION, payload: commitment.payload, external_fact: { service: "aisenseapi.com", endpoint: FIXED_EXTERNAL_ENDPOINT, method: "POST", locator: external_url, storage_id, response_sha256: await sha256(responseText) } };
  const receiptCore = { protocol_version: PROTOCOL_VERSION, commitment_id: commitment.commitment_id, commitment_hash, execution_id, executor_id: EXECUTOR_ID, executor_revision: EXECUTOR_REVISION, policy: { action: FIXED_ACTION, external_endpoint: FIXED_EXTERNAL_ENDPOINT, external_method: "POST" }, observed };
  const receipt_hash = await sha256(receiptCore);
  return json(200, { decision: "ACCEPT", capability: "EXECUTED", reality_receipt: { ...receiptCore, receipt_hash } });
}
