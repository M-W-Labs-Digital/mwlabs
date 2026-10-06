export class RequestBodyTooLargeError extends Error {}

/** Enforce the limit while reading, including chunked bodies without Content-Length. */
export async function readRequestBytes(request: Request, maximumBytes: number) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maximumBytes) throw new RequestBodyTooLargeError("Request body is too large.");
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maximumBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError("Request body is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
