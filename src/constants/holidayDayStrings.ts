/**
 * Holiday Day UI strings (kept separate so existing strings.ts is unchanged).
 */

export const HOLIDAY_DAY = {
  TITLE: 'Add Holiday Day',
  EDIT_TITLE: 'Edit Holiday Day',
  SUBTITLE: 'Define a holiday day',
  FORM: {
    NAME: 'Name',
    NAME_PLACEHOLDER: 'Enter holiday name',
    DATE: 'Date',
    DATE_PLACEHOLDER: 'Select date',
    IS_PREMIUM_RATE: 'Premium Rate',
    IS_ACTIVE: 'Is Active',
    PAY_PREMIUM_FOR_ENTIRE_SHIFT: 'Pay Premium For Entire Shift',
    RECORD_ADDED: 'Record Added',
    ADDED_BY: 'Added By',
    EDITED_BY: 'Edited By',
    EDIT_DATE: 'Edit Date',
    SUBMIT_BUTTON: 'Save',
    SUBMITTING: 'Saving...',
    CANCEL_BUTTON: 'Cancel',
  },
  ERRORS: {
    NAME_REQUIRED: 'Name is required',
    DATE_REQUIRED: 'Date is required',
  },
  SUCCESS: {
    ADDED: 'Holiday day added successfully!',
    UPDATED: 'Holiday day updated successfully!',
    DELETED: 'Holiday day deleted successfully!',
  },
  TABLE: {
    TITLE: 'Holiday Days',
    FILTERS: {
      ACTIVE: 'Active',
      INACTIVE: 'Inactive',
    },
    COLUMNS: {
      TITLE: 'Name',
      DESCRIPTION: 'Date',
      STATUS: 'Status',
      IS_PREMIUM_RATE: 'Premium Rate',
      PAY_PREMIUM_ENTIRE_SHIFT: 'Pay Premium Entire Shift',
      CREATED_BY: 'Created By',
      EDITED_BY: 'Edited By',
      ACTION: 'Action',
    },
    NO_DATA: 'No holiday days found',
    LOADING: 'Loading holiday days...',
  },
  BUTTON: {
    ADD_NEW: 'Add Holiday Day',
    EDIT: 'Edit',
    DELETE: 'Delete',
    UPDATE: 'Update',
    UPDATING: 'Updating...',
  },
  CONFIRM: {
    DELETE_TITLE: 'Delete Holiday Day',
    DELETE_MESSAGE:
      'Are you sure you want to delete this holiday day? This action cannot be undone.',
    DELETE_CONFIRM: 'Delete',
    DELETE_CANCEL: 'Cancel',
    DELETING: 'Deleting...',
  },
};
