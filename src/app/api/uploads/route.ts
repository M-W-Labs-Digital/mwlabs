import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/dal";
import { detectImageExtension, uploadMimeTypes } from "@/lib/upload-store";
import { readRequestBytes, RequestBodyTooLargeError } from "@/lib/request-body";

export const runtime = "nodejs";

const maximumUploadBytes = 8 * 1024 * 1024;
const maximumMultipartBytes = maximumUploadBytes + 1024 * 1024;

export async function POST(request: Request) {
  const session = await requireApiSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const declaredBytes = Number(request.headers.get("content-length") || 0);
  if (declaredBytes > maximumMultipartBytes) {
    return Response.json({ error: "Images must be 8 MB or smaller." }, { status: 413 });
  }

  try {
    const bytes = await readRequestBytes(request, maximumMultipartBytes);
    const form = await new Response(bytes, { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose an image to upload." }, { status: 400 });
    if (!file.size) return Response.json({ error: "The selected image is empty." }, { status: 400 });
    if (file.size > maximumUploadBytes) return Response.json({ error: "Images must be 8 MB or smaller." }, { status: 413 });

    const imageBytes = new Uint8Array(await file.arrayBuffer());
    const extension = detectImageExtension(imageBytes);
    if (!extension) {
      return Response.json({ error: "Use a valid JPG, PNG, WebP, or AVIF image." }, { status: 415 });
    }

    const filename = `${randomUUID()}.${extension}`;
    await db.$transaction([
      db.mediaAsset.create({ data: { organizationId: session.organizationId, filename, originalName: file.name.slice(0, 191), mimeType: uploadMimeTypes[extension], bytes: file.size, data: imageBytes } }),
      db.auditLog.create({
        data: {
          organizationId: session.organizationId,
          userId: session.userId,
          action: "media.uploaded",
          resource: "media",
          resourceId: filename,
          metadata: JSON.stringify({ originalName: file.name.slice(0, 240), bytes: file.size, type: uploadMimeTypes[extension], storage: "database" }),
        },
      }),
    ]);

    return Response.json({ url: `/media/${filename}`, filename }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: "Images must be 8 MB or smaller." }, { status: 413 });
    if (error instanceof TypeError) return Response.json({ error: "Invalid image upload." }, { status: 400 });
    return Response.json({ error: "The image could not be stored. Check the database connection and try again." }, { status: 500 });
  }
}
