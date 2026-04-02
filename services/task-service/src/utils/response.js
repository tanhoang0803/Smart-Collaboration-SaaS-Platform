export const success = (res, data, statusCode = 200, meta = undefined) => {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
};

export const fail = (res, message, code, statusCode = 400) =>
  res.status(statusCode).json({ success: false, error: { code, message } });
