// =============================================================================
// Response helpers — enforce the platform-wide API envelope
// All endpoints MUST use these helpers to ensure consistent response shape.
//
// Success envelope:  { success: true, data: {}, meta: {} }
// Error envelope:    { success: false, error: { code, message } }
//
// The error envelope is handled by the global error handler (error-handler.js).
// =============================================================================

/**
 * 200 OK — resource read / operation succeeded
 * @param {import('express').Response} res
 * @param {*} data
 * @param {object} [meta]  pagination info, counts, etc.
 */
export const ok = (res, data, meta = {}) =>
  res.status(200).json({ success: true, data, meta });

/**
 * 201 Created — resource successfully created
 * @param {import('express').Response} res
 * @param {*} data
 */
export const created = (res, data) =>
  res.status(201).json({ success: true, data });

/**
 * 204 No Content — mutation succeeded, nothing to return
 * @param {import('express').Response} res
 */
export const noContent = (res) => res.status(204).send();
