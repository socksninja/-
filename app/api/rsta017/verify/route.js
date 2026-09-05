import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

const PROTOCOL = "RNCP-PORTABLE-1";

function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function POST(request) {
  try {
    const body = await request.json();
    const receipt = body?.receipt;
    if (!receipt || typeof receipt !== "object") {
      return Response.json({ decision: "REJECT", reason: "missing_receipt" }, { status: 400 });
    }

    const required = ["protocol", "commitment_id", "action", "payload", "commitment_hash", "execution_id", "executor_id", "executor_revision", "observed", "receipt_hash"];
    const missing = required.filter((key) => !(key in receipt));
    if (missing.length) return Response.json({ decision: "REJECT", reason: "missing_fields", missing });

    const commitmentHash = sha256(canonical({
      commitment_id: receipt.commitment_id,
      action: receipt.action,
      payload: receipt.payload,
    }));

    const { receipt_hash, ...unsigned } = receipt;
    const receiptHash = sha256(canonical(unsigned));
    const checks = {
      protocol: receipt.protocol === PROTOCOL,
      commitment_hash: receipt.commitment_hash === commitmentHash,
      identity: Boolean(receipt.execution_id && receipt.executor_id && receipt.executor_revision),
      receipt_hash: receipt.receipt_hash === receiptHash,
    };
    const accepted = Object.values(checks).every(Boolean);
    return Response.json({
      decision: accepted ? "ACCEPT" : "REJECT",
      verifier: "rsta017-independent-verifier",
      checks,
      recomputed_commitment_hash: commitmentHash,
      recomputed_receipt_hash: receiptHash,
    }, { status: accepted ? 200 : 422 });
  } catch (error) {
    return Response.json({ decision: "REJECT", reason: "invalid_json", error: String(error?.message || error) }, { status: 400 });
  }
}

export async function GET() {
  return Response.json({
    verifier: "rsta017-independent-verifier",
    protocol: PROTOCOL,
    implementation: "standalone-node-crypto-next-route",
    repository: "socksninja/-",
    imports_rncp_orion: false,
    verifies_execution_semantics: false,
    verifies_portable_receipt_integrity: true,
  });
}
