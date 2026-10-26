import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { SelectChangeEvent, SelectProps } from '@mui/material/Select';
import { SMSLoader } from '@/components/smsatoms/SMSLoader/SMSLoader';
import { FC, memo, useEffect, useId, useMemo, useRef, useState } from 'react';

export interface SMSSearchableDropdownOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SMSSearchableDropdownProps {
  label?: string;
  options?: SMSSearchableDropdownOption[];
  value?: unknown;
  onChange?: SelectProps['onChange'];
  name?: string;
  id?: string;
  placeholder?: string;
  error?: boolean;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: SelectProps['size'];
  clearable?: boolean;
  sx?: SelectProps['sx'];
  MenuProps?: SelectProps['MenuProps'];
  /** Fired after debounce when the user types. May return a Promise (keeps loading until settled). */
  onSearchInputChange: (inputValue: string) => void | Promise<unknown>;
  /** Debounce delay for search input in ms. Default 400. */
  searchDebounceMs?: number;
  /** Custom empty-state text. */
  noOptionsText?: string;
}

function fireSelectChange(
  onChange: SelectProps['onChange'],
  name: string | undefined,
  value: unknown
) {
  if (!onChange) return;
  onChange({ target: { name: name ?? '', value } } as SelectChangeEvent<unknown>, undefined);
}

/**
 * Single-select dropdown with server-side search (no client-side option filtering).
 */
export const SMSSearchableDropdown: FC<SMSSearchableDropdownProps> = memo(
  ({
    label,
    options = [],
    value,
    onChange,
    name,
    id,
    placeholder,
    error,
    helperText,
    required,
    disabled,
    fullWidth = true,
    size = 'small',
    clearable = false,
    sx,
    MenuProps,
    onSearchInputChange,
    searchDebounceMs = 400,
    noOptionsText = 'No options',
  }) => {
    const generatedId = useId().replace(/:/g, '');
    const selectId = id ?? `sms-searchable-dropdown-${generatedId}`;
    const labelId = label ? `${selectId}-label` : undefined;
    const listMaxHeight =
      (MenuProps as { PaperProps?: { style?: { maxHeight?: number } } })?.PaperProps?.style
        ?.maxHeight ?? 320;

    const selectValue = value ?? '';
    const [searchInputValue, setSearchInputValue] = useState('');
    const [isSearchLoading, setIsSearchLoading] = useState(false);
    const searchDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestSearchRequestIdRef = useRef(0);
    const lastServerSearchTermRef = useRef<string | null>(null);

    const optionsWithSelected = useMemo(() => {
      if (options.length === 0) return options;
      if (selectValue === '' || selectValue === null || selectValue === undefined) return options;
      const has = options.some((o) => String(o.value) === String(selectValue));
      if (has) return options;
      return [...options, { value: selectValue as string | number, label: String(selectValue) }];
    }, [options, selectValue]);

    useEffect(() => {
      const searchTerm = searchInputValue;
      if (lastServerSearchTermRef.current === searchTerm) return;
      lastServerSearchTermRef.current = searchTerm;

      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current);
        searchDebounceTimerRef.current = null;
      }

      if (searchTerm.trim() === '') {
        latestSearchRequestIdRef.current += 1;
        setIsSearchLoading(false);
        void Promise.resolve(onSearchInputChange('')).finally(() => {
          setIsSearchLoading(false);
        });
        return;
      }

      const requestId = latestSearchRequestIdRef.current + 1;
      latestSearchRequestIdRef.current = requestId;
      setIsSearchLoading(true);

      searchDebounceTimerRef.current = setTimeout(() => {
        searchDebounceTimerRef.current = null;
        void Promise.resolve(onSearchInputChange(searchTerm)).finally(() => {
          if (latestSearchRequestIdRef.current === requestId) {
            setIsSearchLoading(false);
          }
        });
      }, Math.max(0, searchDebounceMs));

      return () => {
        if (searchDebounceTimerRef.current) {
          clearTimeout(searchDebounceTimerRef.current);
          searchDebounceTimerRef.current = null;
        }
      };
    }, [onSearchInputChange, searchDebounceMs, searchInputValue]);

    const visibleOptions = isSearchLoading ? [] : optionsWithSelected;
    const selected =
      selectValue === '' || selectValue === null || selectValue === undefined
        ? null
        : visibleOptions.find((o) => String(o.value) === String(selectValue)) ?? null;

    const auto = (
      <Autocomplete<SMSSearchableDropdownOption, false, true, false>
        id={selectId}
        options={visibleOptions}
        // Use `null` for empty so Autocomplete stays controlled.
        value={(selected ?? null) as never}
        onChange={(_, newValue) => {
          fireSelectChange(onChange, name, newValue != null ? newValue.value : '');
        }}
        getOptionLabel={(o) => o?.label ?? ''}
        getOptionKey={(o) => String(o?.value ?? '')}
        isOptionEqualToValue={(a, b) => String(a?.value) === String(b?.value)}
        getOptionDisabled={(o) => Boolean(o.disabled)}
        filterOptions={(opts) => opts}
        noOptionsText={noOptionsText}
        loadingText={
          <Box
            sx={{
              minHeight: 120,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SMSLoader size={22} thickness={4} loadingText="Loading..." />
          </Box>
        }
        loading={isSearchLoading}
        onInputChange={(_, newInputValue, reason) => {
          if (reason === 'input' || reason === 'clear' || (reason === 'reset' && newInputValue === '')) {
            if (newInputValue.trim().length > 0) {
              setIsSearchLoading(true);
            }
            setSearchInputValue(newInputValue);
          }
        }}
        // @ts-expect-error MUI Autocomplete generics use a literal disableClearable; toggled via `clearable` at runtime.
        disableClearable={!clearable}
        disabled={disabled}
        fullWidth={fullWidth}
        size={size}
        ListboxProps={{ style: { maxHeight: listMaxHeight } }}
        sx={{
          marginTop: label ? 1 : 0,
          '& .MuiOutlinedInput-root': {
            minHeight: 'var(--sms-input-height, 36px)',
            height: 'var(--sms-input-height, 36px)',
            paddingTop: '2px',
            paddingBottom: '2px',
            boxSizing: 'border-box',
          },
          '& .MuiAutocomplete-endAdornment .MuiAutocomplete-loading': {
            display: 'none',
          },
          ...(sx as object),
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            name={name}
            label={label}
            placeholder={selected ? undefined : placeholder}
            error={error}
            helperText={helperText}
            required={required}
            variant="outlined"
            inputProps={{ ...params.inputProps, title: selected?.label || undefined }}
            InputLabelProps={label ? { ...params.InputLabelProps, id: labelId } : params.InputLabelProps}
          />
        )}
      />
    );

    if (!label) {
      return (
        <Box sx={{ marginTop: 1, width: fullWidth ? '100%' : undefined }}>
          {auto}
        </Box>
      );
    }
    return auto;
  }
);

SMSSearchableDropdown.displayName = 'SMSSearchableDropdown';

export default SMSSearchableDropdown;
