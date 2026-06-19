import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase-admin.js";

export interface AuthedRequest extends Request {
  staffProfileId?: string;
}

/**
 * Verifies the caller's bearer token belongs to an active staff manager.
 * Used to gate privileged actions (e.g. creating staff accounts) that RLS
 * can't express because they involve auth.admin calls via the service role.
 */
export async function requireManager(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!token) {
    res.status(401).json({ error: "Missing bearer token." });
    return;
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    res.status(401).json({ error: "Invalid or expired session." });
    return;
  }

  const { data: staffRole, error: roleError } = await supabaseAdmin
    .from("staff_roles")
    .select("department, is_active")
    .eq("profile_id", userData.user.id)
    .eq("department", "manager")
    .eq("is_active", true)
    .maybeSingle();

  if (roleError || !staffRole) {
    res.status(403).json({ error: "Manager role required." });
    return;
  }

  req.staffProfileId = userData.user.id;
  next();
}
