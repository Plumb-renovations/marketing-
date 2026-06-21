import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgId } from "@/lib/data/org";

// Uploads a composer image (base64 data URL) to the PUBLIC post-media bucket and
// returns its public URL — required because Instagram (PR 2) fetches the image
// by URL. Server-side upload via the service-role client; org-scoped path.
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
  const ext = (contentType.split("/")[1] || "jpg").replace("jpeg", "jpg");

  const orgId = await getOrgId(supabase);
  const admin = createAdminClient();
  const path = `${orgId}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;

  const { error } = await admin.storage.from("post-media").upload(path, buffer, { contentType, upsert: false });
  if (error) {
    console.error(`[social] image upload failed org=${orgId}: ${error.message}`);
    return NextResponse.json({ error: "upload_failed", message: error.message }, { status: 502 });
  }

  const { data } = admin.storage.from("post-media").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path });
}
