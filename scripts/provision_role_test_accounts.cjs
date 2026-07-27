#!/usr/bin/env node
/**
 * Create Supabase Auth users for role test accounts and link core.staff.auth_user_id.
 *
 * Prerequisites:
 *   - sql/seeds/seed_role_test_staff.sql applied
 *   - web/.env.local has NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   - ROLE_TEST_PASSWORD set (shared demo password for all role accounts)
 *
 * Usage (from kit root):
 *   node scripts/provision_role_test_accounts.cjs
 *
 * Never commit ROLE_TEST_PASSWORD or print it to docs.
 */

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const ROOT = path.resolve(__dirname, "..");
const ENV_CANDIDATES = [
  path.join(ROOT, "web", ".env.local"),
  path.join(ROOT, ".env.local"),
];

const requireFromWeb = createRequire(path.join(ROOT, "web", "package.json"));
const { createClient } = requireFromWeb("@supabase/supabase-js");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = val;
    }
  }
}

for (const p of ENV_CANDIDATES) loadEnvFile(p);

const ACCOUNTS = [
  {
    email: "cm.demo@tuttlelawfirm.com",
    staffId: "00000000-0000-0000-0000-00000000e031",
    role: "case_manager",
    name: "Camila Manager",
  },
  {
    email: "lit.demo@tuttlelawfirm.com",
    staffId: "00000000-0000-0000-0000-00000000e033",
    role: "litigation_paralegal",
    name: "Leo Paralegal",
  },
  {
    email: "intake.demo@tuttlelawfirm.com",
    staffId: "00000000-0000-0000-0000-00000000e022",
    role: "intake",
    name: "Ava Intake",
  },
  {
    email: "demand.demo@tuttlelawfirm.com",
    staffId: "00000000-0000-0000-0000-00000000e035",
    role: "demand_writer",
    name: "Kate Demand",
  },
  {
    email: "liens.demo@tuttlelawfirm.com",
    staffId: "00000000-0000-0000-0000-00000000e037",
    role: "lien_disbursement",
    name: "Emily Liens",
  },
  {
    email: "review.demo@tuttlelawfirm.com",
    staffId: "00000000-0000-0000-0000-00000000e039",
    role: "senior_paralegal",
    name: "Daniel Review",
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const password = process.env.ROLE_TEST_PASSWORD;

  if (!url || !key || key === "your_service_role_key_here") {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
    process.exit(1);
  }
  if (!password || password.length < 10) {
    console.error(
      "Set ROLE_TEST_PASSWORD in web/.env.local (min 10 chars). Shared across all role demo logins. Do not commit it.",
    );
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Provisioning role test Auth users…\n");

  for (const acct of ACCOUNTS) {
    let userId = null;

    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listed.error) {
      console.error(`listUsers failed: ${listed.error.message}`);
      process.exit(1);
    }
    const existing = (listed.data.users ?? []).find(
      (u) => u.email?.toLowerCase() === acct.email.toLowerCase(),
    );

    if (existing) {
      userId = existing.id;
      const upd = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { full_name: acct.name, role_code: acct.role },
      });
      if (upd.error) {
        console.error(`  ✗ ${acct.email}: update failed — ${upd.error.message}`);
        continue;
      }
      console.log(`  · ${acct.email} — Auth user exists, password refreshed`);
    } else {
      const created = await admin.auth.admin.createUser({
        email: acct.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: acct.name, role_code: acct.role },
      });
      if (created.error) {
        console.error(`  ✗ ${acct.email}: create failed — ${created.error.message}`);
        continue;
      }
      userId = created.data.user.id;
      console.log(`  ✓ ${acct.email} — Auth user created`);
    }

    const { error: linkErr } = await admin
      .schema("core")
      .from("staff")
      .update({
        auth_user_id: userId,
        email: acct.email,
        role_code: acct.role,
        active: true,
      })
      .eq("staff_id", acct.staffId);

    if (linkErr) {
      console.error(
        `  ✗ ${acct.email}: staff link failed — ${linkErr.message}`,
      );
      continue;
    }
    console.log(`  ✓ ${acct.email} — linked to staff ${acct.staffId} (${acct.role})`);
  }

  console.log("\nDone. See docs/ROLE_TEST_ACCOUNTS.md for the matrix.");
  console.log("Password is ROLE_TEST_PASSWORD from .env.local (not printed).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
