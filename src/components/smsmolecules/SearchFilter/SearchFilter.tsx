import React from 'react';
import { SMSTextField } from '@/components/smsatoms/SMSTextField/SMSTextField';
import { BaseComponentProps } from '@/types';

export interface SearchFilterProps extends BaseComponentProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

export const SearchFilter: React.FC<SearchFilterProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <SMSTextField
      type="text"
      value={value}
      onChange={handleChange}
      label={placeholder}
      className={className}
      fullWidth
      size="small"
    />
  );
};


