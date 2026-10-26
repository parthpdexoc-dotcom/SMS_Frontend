import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Autocomplete,
  TextField,
  CircularProgress,
  Box,
  Typography,
  Chip,
  InputAdornment,
} from '@mui/material';
import { searchPhotonLocations, PhotonLocationResult } from '@/services/photonGeocodingService';
import { SMSIcon } from '@/components/smsatoms';

interface DepartmentHomeLocationPickerProps {
  value?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  onChange: (result: {
    location: string;
    latitude: number | null;
    longitude: number | null;
  } | null) => void;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
}

export const DepartmentHomeLocationPicker: React.FC<DepartmentHomeLocationPickerProps> = ({
  value,
  latitude,
  longitude,
  onChange,
  disabled = false,
  required = false,
  error = false,
  helperText,
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [options, setOptions] = useState<PhotonLocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Handle debounced search when user types
  const handleInputChange = (newInputValue: string) => {
    setInputValue(newInputValue);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!newInputValue.trim() || newInputValue.trim().length < 2) {
      setOptions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchPhotonLocations(newInputValue, 8);
        setOptions(results);
      } catch (err) {
        console.error('Failed to search locations:', err);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  const selectedOption = useMemo<PhotonLocationResult | null>(() => {
    if (!value) return null;
    return (
      options.find((o) => o.label === value) ?? {
        label: value,
        name: value,
        latitude: latitude ?? 0,
        longitude: longitude ?? 0,
      }
    );
  }, [value, latitude, longitude, options]);

  return (
    <Box sx={{ width: '100%', mt: 0.5, mb: 0.5 }}>
      <Autocomplete<PhotonLocationResult, false, false, false>
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        value={selectedOption}
        disabled={disabled}
        options={options}
        loading={loading}
        popupIcon={null}
        clearText=""
        getOptionLabel={(option) => (typeof option === 'string' ? option : option.label || '')}
        isOptionEqualToValue={(option, val) =>
          option.label === val.label ||
          (option.latitude === val.latitude && option.longitude === val.longitude)
        }
        filterOptions={(x) => x} // Photon handles filtering server-side
        onInputChange={(_event, newInputValue, reason) => {
          if (reason === 'input') {
            handleInputChange(newInputValue);
          } else if (reason === 'clear') {
            setInputValue('');
            setOptions([]);
            onChange(null);
          }
        }}
        onChange={(_event, selected) => {
          if (selected) {
            onChange({
              location: selected.label,
              latitude: selected.latitude,
              longitude: selected.longitude,
            });
          } else {
            setInputValue('');
            setOptions([]);
            onChange(null);
          }
        }}
        sx={{
          width: '100%',
          '& .MuiAutocomplete-input': {
            paddingRight: '8px !important',
          },
          '& .MuiAutocomplete-endAdornment': {
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          },
          '& .MuiAutocomplete-clearIndicator': {
            marginRight: 0,
            padding: '4px',
          },
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            label={
              <span>
                Department Home Location{required ? <span style={{ color: '#d32f2f', marginLeft: 3 }}>*</span> : ''}
              </span>
            }
            placeholder="Search address, landmark, or city (via Photon)..."
            error={error}
            helperText={helperText}
            InputLabelProps={{
              ...params.InputLabelProps,
              shrink: true,
            }}
            inputProps={{
              ...params.inputProps,
              required: false,
            }}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position="start" sx={{ pl: 0.5, color: 'text.secondary' }}>
                  <SMSIcon name="location_on" size="sm" />
                </InputAdornment>
              ),
              endAdornment: (
                <React.Fragment>
                  {loading ? <CircularProgress color="inherit" size={18} sx={{ mr: 1 }} /> : null}
                  {params.InputProps.endAdornment}
                </React.Fragment>
              ),
            }}
          />
        )}
        renderOption={(props, option) => {
          const { key, ...restProps } = props as unknown as { key: string };
          return (
            <Box
              component="li"
              key={key || `${option.latitude}-${option.longitude}-${option.label}`}
              {...restProps}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                py: 1,
                px: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                '&:last-child': { borderBottom: 'none' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                <SMSIcon name="place" size="sm" />
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', flex: 1 }}>
                  {option.name || option.label}
                </Typography>
                <Chip
                  size="small"
                  label={`${option.latitude.toFixed(4)}, ${option.longitude.toFixed(4)}`}
                  sx={{
                    height: 20,
                    fontSize: '0.7rem',
                    bgcolor: 'action.hover',
                    fontFamily: 'monospace',
                  }}
                />
              </Box>
              {option.label !== option.name && (
                <Typography variant="caption" sx={{ color: 'text.secondary', ml: 3, mt: 0.25 }}>
                  {option.label}
                </Typography>
              )}
            </Box>
          );
        }}
        noOptionsText={
          inputValue.trim().length < 2
            ? 'Type at least 2 characters to search addresses...'
            : loading
            ? 'Searching Photon API...'
            : 'No matching locations found'
        }
      />

      {/* Coordinate display badge when location is set */}
      {latitude != null && longitude != null && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 0.5,
            mt: 0.75,
            pl: 0.25,
          }}
        >
          <Chip
            size="small"
            color="primary"
            variant="outlined"
            icon={<SMSIcon name="my_location" size="sm" />}
            label={`Lat: ${Number(latitude).toFixed(5)}, Lon: ${Number(longitude).toFixed(5)}`}
            sx={{
              height: 22,
              fontSize: '0.72rem',
              fontWeight: 600,
              fontFamily: 'monospace',
              bgcolor: 'action.hover',
            }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem', lineHeight: 1.2 }}>
            Will be used as default center on Master Map
          </Typography>
        </Box>
      )}
    </Box>
  );
};
