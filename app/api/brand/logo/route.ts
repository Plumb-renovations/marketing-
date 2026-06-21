import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgId } from "@/lib/data/org";

// Uploads a business logo (base64 data URL — png/jpeg/svg/webp) to the PUBLIC
// brand-assets bucket and returns its public URL for use on the client-facing
// quote/invoice documents. Server-side upload; org-scoped path.
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const dataUrl = String(body?.dataUrl || "");
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return NextResponse.json({ error: "invalid_image" }, { status: 400 });

  const contentType = m[1];
  const buffer = Buffer.from(m[2], "base64");
  if (buffer.length > 2_000_000) return NextResponse.json({ error: "too_large", message: "Logo must be under 2MB." }, { status: 400 });
  const ext = (contentType.split("/")[1] || "png").replace("svg+xml", "svg").replace("jpeg", "jpg");

  const orgId = await getOrgId(supabase);
  const admin = createAdminClient();
  const path = `${orgId}/logo-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;

  const { error } = await admin.storage.from("brand-assets").upload(path, buffer, { contentType, upsert: false });
  if (error) {
    console.error(`[brand] logo upload failed org=${orgId}: ${error.message}`);
    return NextResponse.json({ error: "upload_failed", message: error.message }, { status: 502 });
  }

  const { data } = admin.storage.from("brand-assets").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
