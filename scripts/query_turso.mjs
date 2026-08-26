import { createClient } from "@libsql/client";
import "dotenv/config";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

const db = createClient({ url, authToken });

async function getCasesAndApprovals() {
  const cRes = await db.execute("SELECT * FROM cases");
  console.log("=== ALL CASES IN TURSO DB (" + cRes.rows.length + "건) ===");
  console.log(JSON.stringify(cRes.rows, null, 2));

  const aRes = await db.execute("SELECT * FROM approvals");
  console.log("=== ALL APPROVALS IN TURSO DB (" + aRes.rows.length + "건) ===");
  console.log(JSON.stringify(aRes.rows, null, 2));
}

getCasesAndApprovals();
