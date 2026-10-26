import { SMSIcon } from '@/components/smsatoms';
import { forwardRef } from 'react';

export const PRESET_COLORS = [
  '#000000', '#333333', '#e53935', '#d84315', '#ef6c00', '#f9a825',
  '#7cb342', '#00897b', '#1e88e5', '#5e35b1', '#8e24aa', '#c2185b',
];

export interface ColorPickerProps {
  /** Popover title (e.g. "Text color", "Highlight color") */
  title: string;
  /** Icon name for the trigger (e.g. "format_color_text", "highlight") */
  iconName: 'format_color_text' | 'highlight';
  /** Current color value */
  color: string;
  /** Default color when "Remove color" is used */
  defaultColor: string;
  /** execCommand name: foreColor or backColor */
  command: 'foreColor' | 'backColor';
  /** Value to apply when "Remove color" is clicked */
  removeValue: string;
  disabled?: boolean;
  /** Whether the popover is open */
  isOpen: boolean;
  /** Called when open state should change */
  onOpenChange: (open: boolean) => void;
  /** Called when color value changes (e.g. from swatch or custom input) */
  onColorChange: (hex: string) => void;
  /** Called to apply a color to the selection (command, value) */
  onApplyColor: (cmd: 'foreColor' | 'backColor', value: string) => void;
  /** Callback before opening (e.g. to save selection) */
  onBeforeOpen?: () => void;
}

export const ColorPicker = forwardRef<HTMLDivElement, ColorPickerProps>(function ColorPicker(
  {
    title,
    iconName,
    color,
    defaultColor,
    command,
    removeValue,
    disabled = false,
    isOpen,
    onOpenChange,
    onColorChange,
    onApplyColor,
    onBeforeOpen,
  },
  ref
) {
  const handleTriggerClick = () => {
    if (disabled) return;
    onBeforeOpen?.();
    onOpenChange(!isOpen);
  };

  const handleClose = () => onOpenChange(false);

  return (
    <div ref={ref} className="rich-text-editor__toolbar-dropdown" onMouseDownCapture={onBeforeOpen}>
      <button
        type="button"
        className="rich-text-editor__toolbar-btn rich-text-editor__toolbar-btn--color"
        onClick={handleTriggerClick}
        disabled={disabled}
        aria-label={title}
        aria-expanded={isOpen}
      >
        <SMSIcon name={iconName} size="sm" color={color} />
        <span className="rich-text-editor__tooltip" role="tooltip">{title}</span>
      </button>
      {isOpen && (
        <div className="rich-text-editor__color-popover">
          <div className="rich-text-editor__color-popover-title">{title}</div>
          <div className="rich-text-editor__color-presets">
            {PRESET_COLORS.map((hex) => (
              <button
                key={hex}
                type="button"
                className="rich-text-editor__swatch"
                style={{ backgroundColor: hex }}
                title={hex}
                disabled={disabled}
                onClick={() => {
                  onColorChange(hex);
                  onApplyColor(command, hex);
                  handleClose();
                }}
                aria-label={`Color ${hex}`}
              />
            ))}
          </div>
          <div className="rich-text-editor__color-custom">
            <span className="rich-text-editor__color-custom-label">Custom</span>
            <input
              type="color"
              className="rich-text-editor__color-input"
              value={color}
              onChange={(e) => {
                const v = e.target.value;
                onColorChange(v);
                onApplyColor(command, v);
              }}
              disabled={disabled}
              aria-label={`Custom ${title.toLowerCase()}`}
            />
          </div>
          <button
            type="button"
            className="rich-text-editor__remove-color-btn"
            onClick={() => {
              onApplyColor(command, removeValue);
              onColorChange(defaultColor);
              handleClose();
            }}
            disabled={disabled}
          >
            Remove color
          </button>
        </div>
      )}
    </div>
  );
});
