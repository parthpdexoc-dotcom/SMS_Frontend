import { FC, memo } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';

export interface SMSMultiSelectDropdownOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SMSMultiSelectDropdownProps {
  label?: string;
  options?: SMSMultiSelectDropdownOption[];
  value?: (string | number)[];
  onChange?: (value: (string | number)[]) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  required?: boolean;
  id?: string;
  name?: string;
  fullWidth?: boolean;
  lockedValues?: (string | number)[];
  /** When false, selected values are not shown as chips below the field (caller can render them elsewhere). */
  showSelectedChips?: boolean;
  /** Shows an X that clears every selected value. Locked values stay selected. */
  clearable?: boolean;
}

export const SMSMultiSelectDropdown: FC<SMSMultiSelectDropdownProps> = memo(
  ({
    label,
    options = [],
    value = [],
    onChange,
    placeholder = 'Select options',
    disabled = false,
    error = false,
    helperText,
    required = false,
    id,
    name,
    fullWidth = true,
    lockedValues = [],
    showSelectedChips = true,
    clearable = false,
  }) => {
    const selectedOptions = options.filter((opt) => value.includes(opt.value));
    // Selections are shown as chips below; keep placeholder in the field so users can add more.
    const selectedLookup = new Set(value.map((v) => String(v)));
    const lockedLookup = new Set(lockedValues.map((v) => String(v)));

    return (
      <Box sx={{ marginTop: 1, width: fullWidth ? '100%' : undefined, maxWidth: '100%', minWidth: 0 }}>
        <Autocomplete
          multiple
          disableCloseOnSelect
          disableClearable={!clearable}
          id={id || name || `sms-multiselect-${Math.random().toString(36).slice(2, 9)}`}
          options={options}
          getOptionLabel={(option) => (typeof option === 'string' ? option : option.label)}
          value={selectedOptions}
          onChange={(_, newValue) => {
            const nextValues = (newValue ?? []).map((o) => o.value);
            const mergedValues = Array.from(
              new Set([
                ...nextValues,
                ...lockedValues,
              ].map((v) => String(v)))
            );
            const normalizedValues = options
              .map((opt) => opt.value)
              .filter((optValue) => mergedValues.includes(String(optValue)));
            onChange?.(normalizedValues);
          }}
          disabled={disabled}
          getOptionDisabled={(option) =>
            Boolean(option.disabled) || lockedLookup.has(String(option.value))
          }
          size="small"
          fullWidth={fullWidth}
          renderTags={() => []}
          renderInput={(params) => (
            <TextField
              {...params}
              label={label}
              placeholder={placeholder}
              required={required}
              error={error}
              helperText={helperText}
              variant="outlined"
              name={name}
              inputProps={{
                ...params.inputProps,
                placeholder,
              }}
              sx={{
                width: '100%',
                '& .MuiOutlinedInput-root': {
                  width: '100%',
                  maxWidth: '100%',
                  minHeight: 'var(--sms-input-height, 36px)',
                  height: 'var(--sms-input-height, 36px)',
                  alignItems: 'center',
                  paddingY: 0,
                  boxSizing: 'border-box',
                  '& .MuiOutlinedInput-input': {
                    minWidth: 60,
                    padding: '0 4px',
                  },
                },
              }}
            />
          )}
          renderOption={(liProps, option) => {
            const checked = selectedLookup.has(String(option.value));
            return (
              <li {...liProps} key={String(option.value)}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box component="span" sx={{ width: 16, textAlign: 'center', color: '#1e4976', fontWeight: 600 }}>
                    {checked ? '✓' : ''}
                  </Box>
                  <Box component="span">{option.label}</Box>
                </Box>
              </li>
            );
          }}
          sx={{
            marginTop: 0,
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            '& .MuiAutocomplete-tag': {
              display: 'none',
            },
            '& .MuiOutlinedInput-root': {
              width: '100% !important',
              maxWidth: '100% !important',
              boxSizing: 'border-box',
              overflow: 'hidden',
            },
          }}
        />
        {showSelectedChips && selectedOptions.length > 0 && (
          <Box
            sx={{
              mt: 0.75,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 0.75,
            }}
          >
            {selectedOptions.map((option) => (
              <Chip
                key={String(option.value)}
                size="small"
                label={option.label}
                onDelete={
                  disabled || lockedLookup.has(String(option.value))
                    ? undefined
                    : () =>
                        onChange?.(value.filter((v) => String(v) !== String(option.value)))
                }
                sx={{
                  maxWidth: '100%',
                  borderRadius: '9999px !important',
                  height: 26,
                  backgroundColor: '#e5e7eb',
                  border: '1px solid #d1d5db',
                  color: '#0f172a',
                  fontWeight: 500,
                  '& .MuiChip-label': {
                    paddingLeft: '10px',
                    paddingRight: '8px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                  '& .MuiChip-deleteIcon': {
                    color: '#6b7280',
                    marginRight: '4px',
                    '&:hover': {
                      color: '#334155',
                    },
                  },
                }}
              />
            ))}
          </Box>
        )}
      </Box>
    );
  }
);

SMSMultiSelectDropdown.displayName = 'SMSMultiSelectDropdown';

export default SMSMultiSelectDropdown;
