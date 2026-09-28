import { get, put } from '@vercel/blob'

// This project's Blob store is PRIVATE, so every read and write must use
// access: 'private' and go through the SDK (private blob URLs cannot be
// fetched directly). Files in api/ that start with "_" are not routes.

const auth = process.env.BLOB_READ_WRITE_TOKEN ? { token: process.env.BLOB_READ_WRITE_TOKEN } : {}

export async function readJSON(pathname) {
  let r
  try {
    r = await get(pathname, { access: 'private', useCache: false, ...auth })
  } catch (e) {
    if (e?.name === 'BlobNotFoundError' || /not found/i.test(e?.message || '')) return null
    throw e
  }
  if (!r || r.statusCode !== 200 || !r.stream) return null
  const text = await new Response(r.stream).text()
  return text ? JSON.parse(text) : null
}

export async function writeJSON(pathname, data) {
  await put(pathname, JSON.stringify(data), {
    access: 'private', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json', ...auth,
  })
}
