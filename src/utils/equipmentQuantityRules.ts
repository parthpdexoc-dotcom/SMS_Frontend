export function equipmentQuantityFieldProps(
  isPerPosition: boolean,
  addError: string | null,
  quantityInvalidMessage: string,
  perPositionWarning: string
): { helperText?: string; error: boolean } {
  const isQuantityError = addError === quantityInvalidMessage;
  if (isQuantityError) {
    return { helperText: addError ?? undefined, error: true };
  }
  if (isPerPosition) {
    return { helperText: perPositionWarning, error: false };
  }
  return { helperText: undefined, error: false };
}
