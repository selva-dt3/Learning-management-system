export class ApplicationError extends Error {
  constructor(message, code = 'APP_ERROR', status = 500, details = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// PUBLIC_INTERFACE
export function toUserMessage(err, fallback = 'Something went wrong') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err.message) return err.message;
  return fallback;
}
