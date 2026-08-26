import { createClient } from "@libsql/client";
import "dotenv/config";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

const db = createClient({ url, authToken });

async function migrateSujeNo() {
  console.log("=== STARTING TURSO DB MIGRATION: ADD suje_no, DROP gyeongje_no ===");

  try {
    // 1. Add suje_no column to cases table
    try {
      await db.execute("ALTER TABLE cases ADD COLUMN suje_no TEXT;");
      console.log("✅ Added column 'suje_no' to cases table.");
    } catch (e) {
      if (String(e.message || e).includes("duplicate column")) {
        console.log("ℹ️ Column 'suje_no' already exists in cases table.");
      } else {
        console.warn("⚠️ ADD COLUMN suje_no warning:", e.message);
      }
    }

    // 2. Populate suje_no from hyeongje_no for existing rows
    const updateRes = await db.execute(`
      UPDATE cases 
      SET suje_no = hyeongje_no,
          hyeongje_no = '-'
      WHERE (suje_no IS NULL OR suje_no = '' OR suje_no = '-') 
        AND (hyeongje_no LIKE '%수제%' OR hyeongje_no LIKE '%내사%');
    `);
    console.log(`✅ Updated existing cases: suje_no populated, hyeongje_no reset to '-' if unindicted.`);

    // 3. Drop gyeongje_no from cases table
    try {
      await db.execute("ALTER TABLE cases DROP COLUMN gyeongje_no;");
      console.log("✅ Dropped column 'gyeongje_no' from cases table.");
    } catch (e) {
      console.warn("ℹ️ DROP COLUMN gyeongje_no from cases:", e.message);
    }

    // 4. Drop gyeongje_no from appeals table if present
    try {
      await db.execute("ALTER TABLE appeals DROP COLUMN gyeongje_no;");
      console.log("✅ Dropped column 'gyeongje_no' from appeals table.");
    } catch (e) {
      console.warn("ℹ️ DROP COLUMN gyeongje_no from appeals:", e.message);
    }

    // 5. Verify updated cases table
    const result = await db.execute("SELECT id, suje_no, hyeongje_no, prosecutor_name, suspect_name FROM cases");
    console.log("\n=== VERIFIED CASES TABLE ===");
    console.table(result.rows);

  } catch (err) {
    console.error("Migration Error:", err);
  }
}

migrateSujeNo();
