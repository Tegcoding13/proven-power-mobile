import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { requireManager, type AuthedRequest } from "../middleware/require-manager.js";

export const staffRouter = Router();

const DEPARTMENTS = ["sales", "parts", "service", "office", "manager"] as const;
type Department = (typeof DEPARTMENTS)[number];

function isDepartment(value: unknown): value is Department {
  return typeof value === "string" && (DEPARTMENTS as readonly string[]).includes(value);
}

// Creates a dealership staff account. Only an existing manager can call this —
// there is no public sign-up path for staff (mirrors the old DriverGo project's
// manager-creates-driver-accounts pattern).
staffRouter.post("/", requireManager, async (req: AuthedRequest, res) => {
  const { email, full_name, department, dealership_location_id } = req.body ?? {};

  if (typeof email !== "string" || typeof full_name !== "string" || !isDepartment(department)) {
    res.status(400).json({ error: "email, full_name, and a valid department are required." });
    return;
  }

  const temporaryPassword = crypto.randomUUID();

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name, account_type: "staff" },
  });

  if (createError || !created.user) {
    res.status(400).json({ error: createError?.message ?? "Failed to create staff user." });
    return;
  }

  const { error: roleError } = await supabaseAdmin.from("staff_roles").insert({
    profile_id: created.user.id,
    department,
    dealership_location_id: dealership_location_id ?? null,
  });

  if (roleError) {
    res.status(500).json({ error: roleError.message });
    return;
  }

  res.status(201).json({
    profileId: created.user.id,
    email,
    temporaryPassword,
  });
});
