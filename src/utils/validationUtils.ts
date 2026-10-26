/**
 * Validation utility functions
 */

/**
 * SMTP-style email format (stricter than a loose pattern):
 * - no consecutive dots; local/domain cannot start or end with a dot
 * - local: alphanumeric start/end; middle may include . _ % + -
 * - domain labels: alphanumeric only at start/end of each label (rejects @-gmail.com, gmail-.com)
 * - TLD: letters only, min length 2
 */
const DOMAIN_LABEL = '[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?';
const LOCAL_PART = '[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?';

export const EMAIL_REGEX = new RegExp(
  `^(?!.*\\.\\.)(?!\\.)(?!.*\\.$)(?!.*@\\.)(?!.*@-)${LOCAL_PART}@(?:${DOMAIN_LABEL}\\.)+[A-Za-z]{2,}$`
);

/**
 * Validates an email address format
 * @param email - Email string to validate
 * @returns true if email is valid or empty/whitespace-only (optional), false otherwise
 */
export const validateEmail = (email: string): boolean => {
  const trimmed = String(email ?? '').trim();
  if (!trimmed) return true;
  return EMAIL_REGEX.test(trimmed);
};

/** Optional phone: empty is valid; otherwise requires 10 digits after stripping formatting. */
export const isValidOptionalPhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, '');
  if (!digits.length) return true;
  return digits.length === 10;
};

/** Optional placeholder badge suffix: empty is valid; otherwise exactly 5 digits. */
export const isValidOptionalPlaceholderBadge = (badge: string): boolean => {
  const digits = badge.replace(/\D/g, '');
  if (!digits.length) return true;
  return digits.length === 5;
};

/** Keep up to 5 digits for placeholder badge input. */
export const formatPlaceholderBadgeInput = (value: string): string => {
  return value.replace(/\D/g, '').slice(0, 5);
};

