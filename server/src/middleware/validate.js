import { AppError } from '../utils/errors.js';

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const input = source === 'query' ? { ...req.query } : req[source];
    const result = schema.safeParse(input);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      return next(
        new AppError(
          400,
          'VALIDATION_ERROR',
          'Please check the highlighted fields and try again.',
          fieldErrors,
        ),
      );
    }

    req.validated = req.validated || {};
    req.validated[source] = result.data;
    next();
  };
}

export function parsePositiveId(raw, label = 'ID') {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new AppError(400, 'INVALID_ID', `${label} must be a positive integer.`);
  }
  return value;
}
