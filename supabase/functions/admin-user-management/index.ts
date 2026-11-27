import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json(401, { error: "Authentication required" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(500, { error: "Server-side Supabase environment is incomplete" });
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) return json(401, { error: "Invalid session" });

  const { data: actor, error: actorError } = await authClient
    .from("profiles")
    .select("role,is_active")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (actorError || !actor || actor.role !== "system_admin" || actor.is_active !== true) {
    return json(403, { error: "System Admin permission required" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json(400, { error: "Invalid JSON body" }); }

  if (body.action === "create_user") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const fullName = String(body.full_name || "").trim();
    const role = String(body.role || "viewer");
    const employeeId = body.employee_id ? String(body.employee_id) : null;
    const companyIds = Array.isArray(body.company_ids) ? [...new Set(body.company_ids.map(String))] : [];
    const allowedRoles = ["hr_officer", "approver", "viewer", "supervisor", "hr_manager", "executive", "employee"];

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: "Valid email is required" });
    if (password.length < 8) return json(400, { error: "Password must be at least 8 characters" });
    if (!fullName) return json(400, { error: "Full name is required" });
    if (!allowedRoles.includes(role)) return json(400, { error: "Unsupported role" });
    if (role === "employee" && !employeeId) return json(400, { error: "Employee account must be linked to an employee record" });
    if (!companyIds.length) return json(400, { error: "At least one company must be assigned" });

    const { data: companyRows, error: companyError } = await admin
      .from("companies").select("id").in("id", companyIds).eq("is_active", true);
    if (companyError || !companyRows || companyRows.length !== companyIds.length) {
      return json(400, { error: "One or more selected companies are invalid or inactive" });
    }
    const defaultCompanyId = body.default_company_id ? String(body.default_company_id) : companyIds[0];
    if (!companyIds.includes(defaultCompanyId)) return json(400, { error: "Default company must be one of the assigned companies" });

    if (employeeId) {
      const { data: employee, error: employeeError } = await admin
        .from("employees").select("id,company_id").eq("id", employeeId).maybeSingle();
      if (employeeError || !employee || !companyIds.includes(employee.company_id)) {
        return json(400, { error: "Employee record must belong to one of the assigned companies" });
      }
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: fullName },
    });
    if (createError || !created.user) return json(400, { error: createError?.message || "User creation failed" });

    const newUserId = created.user.id;
    const { error: profileError } = await admin.from("profiles").update({
      full_name: fullName, role, employee_id: employeeId, default_company_id: defaultCompanyId, is_active: true,
    }).eq("id", newUserId);
    if (profileError) {
      await admin.auth.admin.deleteUser(newUserId);
      return json(500, { error: "User profile setup failed: " + profileError.message });
    }

    const { error: clearAccessError } = await admin.from("user_company_access").delete().eq("profile_id", newUserId);
    if (clearAccessError) {
      await admin.auth.admin.deleteUser(newUserId);
      return json(500, { error: "Could not reset default company access: " + clearAccessError.message });
    }
    const { error: accessError } = await admin.from("user_company_access").insert(
      companyIds.map((companyId: string) => ({ profile_id: newUserId, company_id: companyId }))
    );
    if (accessError) {
      await admin.auth.admin.deleteUser(newUserId);
      return json(500, { error: "Company access setup failed: " + accessError.message });
    }

    await admin.from("audit_logs").insert({
      actor_id: authData.user.id, action: "admin_user_created", entity_type: "profile",
      entity_id: newUserId, company_id: defaultCompanyId,
      details: { email, role, company_ids: companyIds, email_confirmed_by_admin: true },
    });
    return json(200, { success: true, user_id: newUserId, email, role, company_ids: companyIds });
  }

  if (body.action === "reset_password") {
    const targetUserId = String(body.user_id || "");
    const newPassword = String(body.new_password || "");
    if (!targetUserId) return json(400, { error: "User ID is required" });
    if (targetUserId === authData.user.id) return json(400, { error: "Use self-service password recovery to change your own password" });
    if (newPassword.length < 8) return json(400, { error: "Password must be at least 8 characters" });

    const { data: target, error: targetError } = await admin
      .from("profiles").select("id,full_name,default_company_id").eq("id", targetUserId).maybeSingle();
    if (targetError || !target) return json(404, { error: "Target user not found" });

    const { error: passwordError } = await admin.auth.admin.updateUserById(targetUserId, { password: newPassword });
    if (passwordError) return json(400, { error: passwordError.message });

    await admin.from("audit_logs").insert({
      actor_id: authData.user.id, action: "admin_password_reset", entity_type: "profile",
      entity_id: targetUserId, company_id: target.default_company_id,
      details: { target_name: target.full_name, reset_by_system_admin: true },
    });
    return json(200, { success: true, user_id: targetUserId });
  }

  return json(400, { error: "Unsupported action" });
});
