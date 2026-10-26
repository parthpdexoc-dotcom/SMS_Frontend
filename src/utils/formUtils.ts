/**
 * Utility functions for form handling
 */

/**
 * Determines if a form should be displayed on a separate page instead of a modal
 * based on the number of fields.
 * 
 * @param fieldCount - The number of fields in the form
 * @param threshold - The threshold for when to use a page (default: 6)
 * @returns true if the form should use a page, false if it should use a modal
 */
export const shouldUseFormPage = (fieldCount: number, threshold: number = 6): boolean => {
  return fieldCount > threshold;
};

/**
 * Common form field count thresholds
 */
export const FORM_FIELD_THRESHOLDS = {
  MODAL_MAX: 6, // Forms with 6 or fewer fields can use modal
  PAGE_MIN: 7,   // Forms with 7 or more fields should use page
} as const;

