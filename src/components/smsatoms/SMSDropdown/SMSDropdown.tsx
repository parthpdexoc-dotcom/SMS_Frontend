import Select, { SelectChangeEvent, SelectProps } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import FormHelperText from '@mui/material/FormHelperText';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { SMSSearchableDropdown } from '@/components/smsatoms/SMSSearchableDropdown';
import { FC, memo, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export interface SMSDropdownOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

const defaultFilterOptions = createFilterOptions<SMSDropdownOption>({
  ignoreCase: true,
  matchFrom: 'start',
  stringify: (option) => option.label,
});

/** First enabled option whose label starts with `typed` (case-insensitive). */
function findPrefixOption(options: SMSDropdownOption[], typed: string) {
  const query = typed.trim().toLowerCase();
  if (!query) return undefined;
  return options.find((o) => !o.disabled && o.label.toLowerCase().startsWith(query));
}

/** Prefer exact label, then prefix match — used when Enter commits autofill. */
function findEnterCommitOption(options: SMSDropdownOption[], inputLabel: string, typed: string) {
  const exact = inputLabel.trim().toLowerCase();
  if (exact) {
    const byLabel = options.find((o) => !o.disabled && o.label.trim().toLowerCase() === exact);
    if (byLabel) return byLabel;
  }
  return findPrefixOption(options, typed);
}

export interface SMSDropdownProps extends Omit<SelectProps, 'error'> {
  label?: string;
  options?: SMSDropdownOption[];
  placeholder?: string;
  /**
   * When false, placeholder text is not added as a selectable empty menu item.
   * Default true (existing behavior).
   */
  includePlaceholderOption?: boolean;
  error?: boolean;
  helperText?: string;
  /**
   * When true (default), options are filterable via a search field in the dropdown (Autocomplete).
   * Set false for tiny static lists if you prefer a plain Select.
   */
  searchable?: boolean;
  /** Single-select searchable only: show clear (X). Default false. */
  clearable?: boolean;
  /**
   * When true, delegates to SMSSearchableDropdown (server-side search).
   * Prefer importing SMSSearchableDropdown directly for new usages.
   */
  serverSideSearch?: boolean;
  /** Debounce delay for server-side search input in ms. */
  searchDebounceMs?: number;
  /**
   * Fired after internal debounce when the user types in a searchable single-select dropdown.
   * Can return a Promise; when provided, loading remains visible until it settles.
   */
  onSearchInputChange?: (inputValue: string) => void | Promise<unknown>;
  /** Custom empty-state text for searchable dropdowns. */
  noOptionsText?: string;
}

const inputSlotSx = {
  '& .MuiOutlinedInput-root': {
    minHeight: 'var(--sms-input-height, 36px)',
    height: 'var(--sms-input-height, 36px)',
    paddingTop: '2px',
    paddingBottom: '2px',
    boxSizing: 'border-box',
  },
};

const multiInputSlotSx = {
  '& .MuiOutlinedInput-root': {
    minHeight: 'var(--sms-input-height, 36px)',
    height: 'auto',
    alignItems: 'flex-start',
    paddingY: 0.5,
    boxSizing: 'border-box',
  },
};

function fireSelectChange(
  onChange: SelectProps['onChange'],
  name: string | undefined,
  value: unknown
) {
  if (!onChange) return;
  onChange({ target: { name: name ?? '', value } } as SelectChangeEvent<unknown>, undefined);
}

export const SMSDropdown: FC<SMSDropdownProps> = memo(
  ({
    label,
    options = [],
    placeholder,
    includePlaceholderOption = true,
    error,
    helperText,
    children,
    fullWidth = true,
    size = 'small',
    searchable = true,
    clearable = false,
    serverSideSearch = false,
    searchDebounceMs = 400,
    onSearchInputChange,
    noOptionsText = 'No options',
    ...props
  }) => {
    const generatedId = useId().replace(/:/g, '');
    const selectId = props.id ?? `sms-dropdown-${generatedId}`;
    const labelId = label ? `${selectId}-label` : undefined;
    const hasPlaceholder = Boolean(placeholder);
    const isMultiple = Boolean(props.multiple);
    const listMaxHeight =
      (props.MenuProps as { PaperProps?: { style?: { maxHeight?: number } } })?.PaperProps?.style
        ?.maxHeight ?? 320;

    const selectValue = useMemo(() => {
      if (isMultiple) {
        const v = props.value;
        if (Array.isArray(v)) return v.map(String);
        return [];
      }
      return props.value ?? '';
    }, [isMultiple, props.value]);

    const labelByValue = useMemo(() => {
      const m = new Map<string, string>();
      options.forEach((o: SMSDropdownOption) => m.set(String(o.value), o.label));
      return m;
    }, [options]);

    /** Single-select Autocomplete + per-option disabled is unreliable (options can disappear); use Select instead. */
    const hasDisabledOption = useMemo(
      () => options.some((o: SMSDropdownOption) => Boolean(o.disabled)),
      [options]
    );
    const useSearchable =
      searchable &&
      (serverSideSearch || options.length > 0) &&
      !(hasDisabledOption && !isMultiple);

    const selectMenuProps = useMemo(() => {
      const mp = (props.MenuProps ?? {}) as NonNullable<SelectProps['MenuProps']>;
      const paper = (mp.PaperProps ?? {}) as { sx?: unknown };
      const existingSx = paper.sx;
      const disabledMenuItemSx = {
        '& .MuiMenuItem-root.Mui-disabled': {
          display: 'flex !important',
          visibility: 'visible !important',
          opacity: 0.55,
        },
      };
      const nextPaperSx =
        existingSx == null
          ? disabledMenuItemSx
          : Array.isArray(existingSx)
            ? [...existingSx, disabledMenuItemSx]
            : [existingSx, disabledMenuItemSx];

      return {
        ...mp,
        PaperProps: {
          ...paper,
          sx: nextPaperSx,
        },
      };
    }, [props.MenuProps]);
    const [multiInputValue, setMultiInputValue] = useState('');
    const [singleInputValue, setSingleInputValue] = useState('');
    /** Typed text only — used for filtering so the autofilled label does not collapse the list. */
    const typedRef = useRef('');
    const isDeletingRef = useRef(false);
    const inputElRef = useRef<HTMLInputElement | null>(null);
    /** Pending RAF that highlights the autofill suffix — cancel on commit so Enter doesn't leave selection. */
    const suffixSelectRafRef = useRef<number | null>(null);
    /** Filter only while the user is typing; opening via click shows all options. */
    const filterByTypingRef = useRef(false);
    /** Set in onInputChange before onOpen so typing-driven open keeps the filter. */
    const openFromTypingRef = useRef(false);

    const cancelSuffixSelectRaf = () => {
      if (suffixSelectRafRef.current == null) return;
      cancelAnimationFrame(suffixSelectRafRef.current);
      suffixSelectRafRef.current = null;
    };

    /** Collapse any autofill highlight so committed text is not left selected. */
    const collapseInputSelection = () => {
      cancelSuffixSelectRaf();
      suffixSelectRafRef.current = requestAnimationFrame(() => {
        suffixSelectRafRef.current = null;
        const el = inputElRef.current;
        if (!el) return;
        const len = el.value.length;
        try {
          el.setSelectionRange(len, len);
        } catch {
          /* input may not support selection in some states */
        }
      });
    };

    const optionsForSingleSearchable = useMemo(() => {
      if (isMultiple || !searchable || options.length === 0) return options;
      if (selectValue === '' || selectValue === null || selectValue === undefined) return options;
      const has = options.some((o: SMSDropdownOption) => String(o.value) === String(selectValue));
      if (has) return options;
      return [...options, { value: selectValue as string | number, label: String(selectValue) }];
    }, [isMultiple, searchable, options, selectValue]);

    const selected =
      isMultiple || selectValue === '' || selectValue === null || selectValue === undefined
        ? null
        : optionsForSingleSearchable.find(
            (o: SMSDropdownOption) => String(o.value) === String(selectValue)
          ) ?? null;

    // Keep the text box in sync when value changes outside typing (open / clear / select).
    useEffect(() => {
      if (isMultiple || !useSearchable) return;
      typedRef.current = selected?.label ?? '';
      setSingleInputValue(typedRef.current);
    }, [isMultiple, useSearchable, selected?.value, selected?.label]);

    if (serverSideSearch && !isMultiple && onSearchInputChange) {
      return (
        <SMSSearchableDropdown
          id={selectId}
          label={label}
          options={options}
          value={props.value}
          onChange={props.onChange}
          name={props.name}
          placeholder={placeholder}
          error={error}
          helperText={helperText}
          required={props.required}
          disabled={props.disabled}
          fullWidth={fullWidth}
          size={size}
          clearable={clearable}
          sx={props.sx}
          MenuProps={props.MenuProps}
          onSearchInputChange={onSearchInputChange}
          searchDebounceMs={searchDebounceMs}
          noOptionsText={noOptionsText}
        />
      );
    }

    if (useSearchable && !isMultiple) {
      const selected =
        selectValue === '' || selectValue === null || selectValue === undefined
          ? null
          : optionsForSingleSearchable.find((o: SMSDropdownOption) => String(o.value) === String(selectValue)) ?? null;

      const auto = (
        <Autocomplete<SMSDropdownOption, false, true, false>
          id={selectId}
          options={optionsForSingleSearchable}
          // Use `null` for empty (not `undefined`) so Autocomplete stays controlled for its whole lifetime.
          value={(selected ?? null) as never}
          onChange={(_, newValue) => {
            filterByTypingRef.current = false;
            openFromTypingRef.current = false;
            collapseInputSelection();
            fireSelectChange(props.onChange, props.name, newValue != null ? newValue.value : '');
          }}
          onClose={(event, reason) => {
            // Escape cancels via consumer onKeyDown; do not treat it as a commit.
            if (reason === 'escape') return;
            // Blur / select / Enter close can leave the autofill suffix highlighted (e.g. "10|2|").
            collapseInputSelection();
            props.onClose?.(event);
          }}
          onKeyDown={(e) => {
            isDeletingRef.current = e.key === 'Backspace' || e.key === 'Delete';
            // Autofill only fills the input text — commit the matched option on Enter.
            // Must block MUI autoHighlight: it can select a different list item (e.g. contains
            // match) and overwrite the prefix/autofill value shown in the input.
            if (e.key === 'Enter') {
              const match = findEnterCommitOption(
                optionsForSingleSearchable,
                singleInputValue,
                typedRef.current
              );
              if (match) {
                e.preventDefault();
                (e as unknown as { defaultMuiPrevented?: boolean }).defaultMuiPrevented = true;
                typedRef.current = match.label;
                setSingleInputValue(match.label);
                filterByTypingRef.current = false;
                openFromTypingRef.current = false;
                collapseInputSelection();
                fireSelectChange(props.onChange, props.name, match.value);
                // List may be closed / nothing highlighted, so Autocomplete won't fire onClose.
                props.onClose?.(e);
              }
            }
            props.onKeyDown?.(e as unknown as KeyboardEvent<HTMLInputElement>);
          }}
          getOptionLabel={(o) => o?.label ?? ''}
          getOptionKey={(o) => String(o?.value ?? '')}
          isOptionEqualToValue={(a, b) => String(a?.value) === String(b?.value)}
          getOptionDisabled={(o) => Boolean(o.disabled)}
          filterOptions={defaultFilterOptions}
          noOptionsText={noOptionsText}
          // @ts-expect-error MUI Autocomplete generics use a literal disableClearable; toggled via `clearable` at runtime.
          disableClearable={!clearable}
          disabled={props.disabled}
          fullWidth={fullWidth}
          size={size}
          ListboxProps={{ style: { maxHeight: listMaxHeight } }}
          /* marginTop: 1 with label matches SMSDatePicker / SMSTimePicker; no label → outer Box has mt:1, inner 0 */
          sx={{
            marginTop: label ? 1 : 0,
            ...inputSlotSx,
            ...(props.sx as object),
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              name={props.name}
              label={label}
              placeholder={selected ? undefined : placeholder}
              error={error}
              helperText={helperText}
              required={props.required}
              variant="outlined"
              autoFocus={props.autoFocus}
              inputRef={inputElRef}
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

    if (useSearchable && isMultiple) {
      const selectedIds = selectValue as string[];
      const findOpt = (id: string) =>
        options.find((o) => String(o.value).toLowerCase() === String(id).toLowerCase());
      const selectedOptions: SMSDropdownOption[] = selectedIds.map((id) => {
        const o = findOpt(id);
        if (o) return o;
        return { value: id, label: 'Loading…' };
      });

      const autoMulti = (
        <Autocomplete<SMSDropdownOption, true, true, false>
          multiple
          disableCloseOnSelect
          disableClearable
          id={selectId}
          options={options}
          value={selectedOptions}
          inputValue={multiInputValue}
          onOpen={() => {
            if (!openFromTypingRef.current) {
              filterByTypingRef.current = false;
            }
            openFromTypingRef.current = false;
          }}
          onInputChange={(_, newInputValue, reason) => {
            if (reason === 'input') {
              filterByTypingRef.current = true;
              openFromTypingRef.current = true;
            } else {
              filterByTypingRef.current = false;
              openFromTypingRef.current = false;
            }
            setMultiInputValue(newInputValue);
          }}
          onChange={(_, newValue) => {
            filterByTypingRef.current = false;
            openFromTypingRef.current = false;
            fireSelectChange(
              props.onChange,
              props.name,
              newValue.map((o) => o.value)
            );
            // Clear typed query after selecting/removing options in multi-select.
            setMultiInputValue('');
          }}
          getOptionLabel={(o) => o.label}
          getOptionKey={(o) => String(o?.value ?? '')}
          isOptionEqualToValue={(a, b) =>
            String(a.value).toLowerCase() === String(b.value).toLowerCase()
          }
          getOptionDisabled={(o) => Boolean(o.disabled)}
          filterOptions={(opts, state) => {
            if (!filterByTypingRef.current) return opts;
            return defaultFilterOptions(opts, state);
          }}
          disabled={props.disabled}
          fullWidth={fullWidth}
          size={size}
          ListboxProps={{ style: { maxHeight: listMaxHeight } }}
          sx={{ marginTop: label ? 1 : 0, ...multiInputSlotSx, ...(props.sx as object) }}
          renderOption={(liProps, option, { selected: sel }) => (
            <li {...liProps} key={String(option.value)}>
              <Checkbox size="small" style={{ marginRight: 8 }} checked={sel} />
              <ListItemText primary={option.label} />
            </li>
          )}
          renderInput={(params) => {
            const hasSelectedValues = selectedOptions.length > 0;
            const showPlaceholder = !hasSelectedValues && multiInputValue.trim().length === 0;
            const inputPlaceholder = showPlaceholder ? placeholder : undefined;
            return (
              <TextField
                {...params}
                name={props.name}
                label={label}
                placeholder={inputPlaceholder}
                error={error}
                helperText={helperText}
                required={props.required}
                variant="outlined"
                inputProps={{
                  ...params.inputProps,
                  placeholder: inputPlaceholder,
                }}
                InputLabelProps={label ? { ...params.InputLabelProps, id: labelId } : params.InputLabelProps}
              />
            );
          }}
        />
      );

      if (!label) {
        return (
          <Box sx={{ marginTop: 1, width: fullWidth ? '100%' : undefined }}>
            {autoMulti}
          </Box>
        );
      }
      return autoMulti;
    }

    const select = (
      <Select
        {...props}
        id={selectId}
        labelId={labelId}
        {...(label ? { label } : {})}
        value={selectValue}
        error={error}
        fullWidth={fullWidth}
        size={size}
        onChange={props.onChange}
        SelectDisplayProps={{
          ...props.SelectDisplayProps,
          title: isMultiple
            ? (selectValue as string[]).map((id) => labelByValue.get(id) || id).join(', ') || undefined
            : labelByValue.get(String(selectValue)) || undefined,
        }}
        MenuProps={selectMenuProps}
        sx={{
          ...(isMultiple
            ? {
                minHeight: 'var(--sms-input-height, 36px)',
                height: 'auto',
                '& .MuiSelect-select': {
                  minHeight: 'var(--sms-input-height, 36px)',
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 0.5,
                  py: 0.75,
                },
              }
            : {
                height: 'var(--sms-input-height, 36px)',
                minHeight: 'var(--sms-input-height, 36px)',
                '& .MuiSelect-select': {
                  height: '100%',
                  minHeight: '100%',
                  display: 'flex',
                  alignItems: 'center',
                },
              }),
          ...props.sx,
        }}
        renderValue={
          isMultiple
            ? (selected) => {
                const ids = selected as string[];
                if (!ids.length) {
                  return <em style={{ opacity: 0.6 }}>{placeholder || 'Select'}</em>;
                }
                return ids.map((id) => labelByValue.get(id) || id).join(', ');
              }
            : props.renderValue
        }
      >
        {!isMultiple && hasPlaceholder && includePlaceholderOption && (
          <MenuItem value="">
            <em>{placeholder}</em>
          </MenuItem>
        )}
        {options.length > 0
          ? options.map((option) => (
              <MenuItem key={String(option.value)} value={option.value} disabled={option.disabled}>
                {isMultiple ? (
                  <>
                    <Checkbox size="small" checked={(selectValue as string[]).includes(String(option.value))} />
                    <ListItemText primary={option.label} />
                  </>
                ) : (
                  option.label
                )}
              </MenuItem>
            ))
          : children}
      </Select>
    );

    const heightSx = {
      '& .MuiOutlinedInput-root': {
        height: 'var(--sms-input-height, 36px)',
        minHeight: 'var(--sms-input-height, 36px)',
      },
    };

    if (label) {
      return (
        <FormControl fullWidth={fullWidth} error={error} size={size} sx={{ marginTop: 1, ...heightSx }}>
          <InputLabel id={labelId}>{label}</InputLabel>
          {select}
          {(error || helperText) && <FormHelperText>{helperText}</FormHelperText>}
        </FormControl>
      );
    }

    return (
      <Box sx={{ marginTop: 1, ...heightSx }}>
        {select}
        {(error || helperText) && <FormHelperText error={error}>{helperText}</FormHelperText>}
      </Box>
    );
  }
);

SMSDropdown.displayName = 'SMSDropdown';

export default SMSDropdown;
