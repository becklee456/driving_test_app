const FIELD_LABELS = {
  fullName: 'auth.full_name',
  email: 'auth.email',
  password: 'auth.password',
  newPassword: 'auth.new_password',
  currentPassword: 'auth.current_password',
  phone: 'auth.phone',
  otp: 'auth.otp',
  token: 'auth.otp',
  code: 'auth.otp',
};

const SEPARATOR = ' • ';

/**
 * Build a user-facing message from a normalized API error.
 * Surfaces zod field-level `details` (mapped to translated labels) when
 * present, otherwise falls back to the server message or a generic one.
 */
export function formatApiError(err, t) {
  const translate = typeof t === 'function' ? t : (key) => key;
  const details = err?.details;

  if (Array.isArray(details) && details.length) {
    const parts = details
      .map((d) => {
        const path = Array.isArray(d?.path) ? d.path.join('.') : d?.path;
        const message = d?.message || translate('errors.generic');
        const labelKey = FIELD_LABELS[path];
        if (labelKey) return `${translate(labelKey)}: ${message}`;
        return message;
      })
      .filter(Boolean);
    if (parts.length) return parts.join(SEPARATOR);
  }

  if (typeof details === 'string' && details) return details;

  return err?.message || translate('errors.generic');
}

export default formatApiError;
