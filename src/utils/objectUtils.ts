/**
 * Object utility functions
 */

import isEqual from 'fast-deep-equal';

/**
 * Performs a deep equality check between two objects
 * Uses the fast-deep-equal library for efficient comparison
 * @param obj1 - First object to compare
 * @param obj2 - Second object to compare
 * @returns true if objects are deeply equal, false otherwise
 */
export const isDeepEqual = <T>(obj1: T, obj2: T): boolean => {
  return isEqual(obj1, obj2);
};

