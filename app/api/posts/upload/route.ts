import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgId } from "@/lib/data/org";

// Uploads composer/ad media to the PUBLIC post-media bucket and returns its
// public URL — required because Meta/Instagram fetch the media by URL (images,
// and now videos via file_url / video_url).
//   - Images come in as a base64 data URL (JSON body), as before.
//   - Videos come in as a raw file (multipart/form-data) to avoid base64 bloat.
// Server-side upload via the service-role client; org-scoped path.
export const runtime = "nodejs";
export const maxDuration = 60;

const IMAGE_MAX = 15 * 1024 * 1024; // 15 MB
const VIDEO_MAX = 300 * 1024 * 1024; // 300 MB (matches the bucket limit)
const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase);
  const admin = createAdminClient();
  const contentType = req.headers.get("content-type") || "";

  let buffer: Buffer;
  let mimeType: string;
  let ext: string;
  let mediaType: "image" | "video";

  if (contentType.includes("multipart/form-data")) {
    // ---- Video (raw file) ----
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 });
    mimeType = file.type;
    if (!VIDEO_TYPES[mimeType]) {
      return NextResponse.json({ error: "unsupported_type", message: "Upload an MP4 or MOV video." }, { status: 400 });
    }
    if (file.size > VIDEO_MAX) {
      return NextResponse.json({ error: "too_large", message: "Video must be 300 MB or smaller." }, { status: 413 });
    }
    buffer = Buffer.from(await file.arrayBuffer());
    ext = VIDEO_TYPES[mimeType];
    mediaType = "video";
  } else {
    // ---- Image (base64 data URL) ----
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    const dataUrl = String(body?.dataUrl || "");
    const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
    if (!m) return NextResponse.json({ error: "invalid_image" }, { status: 400 });
    mimeType = m[1];
    buffer = Buffer.from(m[2], "base64");
    if (buffer.length > IMAGE_MAX) {
      return NextResponse.json({ error: "too_large", message: "Image must be 15 MB or smaller." }, { status: 413 });
    }
    ext = (mimeType.split("/")[1] || "jpg").replace("jpeg", "jpg");
    mediaType = "image";
  }

  const path = `${orgId}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  const { error } = await admin.storage.from("post-media").upload(path, buffer, { contentType: mimeType, upsert: false });
  if (error) {
    console.error(`[social] ${mediaType} upload failed org=${orgId}: ${error.message}`);
    return NextResponse.json({ error: "upload_failed", message: error.message }, { status: 502 });
  }

  const { data } = admin.storage.from("post-media").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path, mediaType });
}
