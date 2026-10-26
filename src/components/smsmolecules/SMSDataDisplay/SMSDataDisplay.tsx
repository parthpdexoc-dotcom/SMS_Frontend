import React, { type CSSProperties } from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { SMSStack, SMSTypography, SMSBox, SMSIcon } from '@/components/smsatoms';

export interface SMSDataDisplayProps {
  label?: string;
  value: React.ReactNode;
  fullWidth?: boolean;
  icon?: string;
  iconPosition?: 'left' | 'right' | 'top' | 'label-left';
  variant?: 'default' | 'inline' | 'vertical' | 'icon-left-vertical' | 'body1' | 'body2';
  spacing?: number;
  labelVariant?: 'body1' | 'body2' | 'caption';
  valueVariant?: 'body1' | 'body2' | 'h6' | 'caption';
  /** Root wrapper (e.g. grid cell layout hooks). */
  className?: string;
  /** Applied to the value text; use for truncation / tooltips in parents. */
  valueClassName?: string;
  /** Native tooltip for value; defaults to string `value` when omitted. */
  valueTitle?: string;
  /** When set, applies to inline variant label (e.g. 600 for semibold). */
  labelFontWeight?: CSSProperties['fontWeight'];
  /** Merged into label `SMSTypography` `sx` (overrides default `color` where applicable). */
  labelSx?: SxProps<Theme>;
  /** Merged into value `SMSTypography` `sx`. */
  valueSx?: SxProps<Theme>;
  /** Passed to `SMSIcon` when an icon is shown. */
  iconColor?: string;
}

export const SMSDataDisplay: React.FC<SMSDataDisplayProps> = ({
  label,
  value,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  variant = 'default',
  spacing = 1,
  labelVariant = 'body2',
  valueVariant = 'body1',
  className,
  valueClassName,
  valueTitle,
  labelFontWeight,
  labelSx,
  valueSx,
  iconColor,
}) => {
  const valueStr = typeof value === 'string' ? value : undefined;
  const titleResolved = valueTitle ?? valueStr;
  const valueTypographyProps = {
    className: valueClassName,
    ...(titleResolved ? { title: titleResolved } : {}),
    ...(valueStr ? { 'data-full-text': valueStr } : {}),
  };

  const renderContent = () => {
    if (variant === 'icon-left-vertical') {
      return (
        <SMSStack direction="row" spacing={1.5} alignItems="flex-start" sx={{ width: '100%', minWidth: 0 }}>
          {icon && (
            <SMSIcon name={icon} size="xs" color={iconColor} />
          )}
          <SMSStack spacing={spacing} alignItems="flex-start" sx={{ flex: 1, minWidth: 0, width: '100%' }}>
            {label && (
              <SMSTypography variant={labelVariant} color="text.secondary" sx={labelSx}>
                {label}
              </SMSTypography>
            )}
            <SMSTypography variant={valueVariant} sx={valueSx} {...valueTypographyProps}>
              {value}
            </SMSTypography>
          </SMSStack>
        </SMSStack>
      );
    }

    if (variant === 'vertical') {
      return (
        <SMSStack spacing={spacing} alignItems="flex-start">
          {icon && iconPosition === 'top' && (
            <SMSIcon name={icon} size="xs" color={iconColor} />
          )}
          {label && (
            <SMSTypography variant={labelVariant} color="text.secondary" sx={labelSx}>
              {label}
            </SMSTypography>
          )}
          <SMSTypography variant={valueVariant} sx={valueSx} {...valueTypographyProps}>
            {value}
          </SMSTypography>
        </SMSStack>
      );
    }

    if (variant === 'inline') {
      const inlineValueRowSx: SxProps<Theme> = [
        { flex: 1, minWidth: 0 },
        ...(valueSx == null ? [] : Array.isArray(valueSx) ? valueSx : [valueSx]),
      ];
      return (
        <SMSStack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%', minWidth: 0 }}>
          {icon && iconPosition === 'left' && <SMSIcon name={icon} size="xs" color={iconColor} />}
          {label && (
            <SMSTypography
              variant={labelVariant}
              color="text.secondary"
              component="span"
              sx={labelSx}
              {...(labelFontWeight != null ? { fontWeight: labelFontWeight } : {})}
            >
              {label}:
            </SMSTypography>
          )}
          <SMSTypography
            variant={valueVariant}
            component="span"
            sx={inlineValueRowSx}
            {...valueTypographyProps}
          >
            {value}
          </SMSTypography>
          {icon && iconPosition === 'right' && <SMSIcon name={icon} size="xs" color={iconColor} />}
        </SMSStack>
      );
    }

    return (
      <SMSStack spacing={spacing}>
        {label &&
          (iconPosition === 'label-left' && icon ? (
            <SMSStack direction="row" spacing={0.5} alignItems="center">
              <SMSIcon name={icon} size="xs" color={iconColor} />
              <SMSTypography variant={labelVariant} color="text.secondary" sx={labelSx}>
                {label}
              </SMSTypography>
            </SMSStack>
          ) : (
            <SMSTypography variant={labelVariant} color="text.secondary" sx={labelSx}>
              {label}
            </SMSTypography>
          ))}
        <SMSStack direction="row" spacing={1.5} alignItems="flex-start">
          {icon && iconPosition === 'left' && <SMSIcon name={icon} size="xs" color={iconColor} />}
          <SMSTypography variant={valueVariant} sx={valueSx} {...valueTypographyProps}>
            {value}
          </SMSTypography>
          {icon && iconPosition === 'right' && <SMSIcon name={icon} size="xs" color={iconColor} />}
        </SMSStack>
      </SMSStack>
    );
  };

  return <SMSBox className={className} sx={fullWidth ? { width: 1 } : undefined}>{renderContent()}</SMSBox>;
};

export default SMSDataDisplay;

