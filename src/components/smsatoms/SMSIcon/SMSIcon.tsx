import { FC, memo } from 'react';
import { cn } from '@/utils';
import { CUSTOM_SVG_ICONS } from './customIcons';
import styles from './SMSIcon.module.css';

export interface SMSIconProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  className?: string;
}

/** Map internal icon names to Material Symbols names; unmapped names pass through. */
const MATERIAL_NAME_MAP: Record<string, string> = {
  dashboard: 'dashboard',
  skill: 'workspace_premium',
  equipment_type: 'precision_manufacturing',
  business_type: 'business',
  employee_status: 'badge',
  employee_type: 'badge',
  department_division: 'account_tree',
  department_activity_type: 'event_note',
  response_area: 'location_on',
  admin: 'supervisor_account',
  employee: 'admin_panel_settings',
  requester_type: 'attribution',
  post_type: 'signpost',
  user: 'person',
  briefcase: 'work',
  document: 'description',
  bell: 'notifications',
  settings: 'settings',
  shopping: 'shopping_cart',
  menu: 'menu',
  logout: 'logout',
  arrowRight: 'chevron_right',
  arrowLeft: 'chevron_left',
  plus: 'add',
  close: 'close',
  edit: 'edit',
  delete: 'delete',
  'chevron-left': 'chevron_left',
  'chevron-right': 'chevron_right',
  'chevron-double-left': 'keyboard_double_arrow_left',
  'chevron-double-right': 'keyboard_double_arrow_right',
  search: 'search',
  eye: 'visibility',
  'eye-off': 'visibility_off',
  palette: 'palette',
  sun: 'light_mode',
  moon: 'dark_mode',
  calendar: 'calendar_month',
  clock: 'schedule',
  time: 'schedule',
  money: 'attach_money',
  check_circle: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
  arrow_up: 'arrow_upward',
  arrow_down: 'arrow_downward',
  'arrow-up': 'arrow_upward',
  'arrow-down': 'arrow_downward',
  do_not_disturb_on: 'do_not_disturb_on',
  group: 'group',
  list: 'view_list',
  email: 'mail',
  highlight: 'brush',
  drag_indicator: 'drag_indicator',
  'drag-handle': 'drag_indicator',
  history: 'history',
};

const SIZE_CLASS: Record<NonNullable<SMSIconProps['size']>, string> = {
  xs: styles.xs,
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
  xl: styles.xl,
};

export const SMSIcon: FC<SMSIconProps> = memo(({ name, size = 'md', color, className = '' }) => {
  const customSvg = CUSTOM_SVG_ICONS[name];
  const style = color ? { color } : undefined;

  if (customSvg) {
    return (
      <span
        className={cn(
          styles.root,
          styles.svg,
          SIZE_CLASS[size],
          'icon',
          `icon--${size}`,
          className
        )}
        style={style}
        aria-hidden="true"
      >
        {customSvg}
      </span>
    );
  }

  const glyph = MATERIAL_NAME_MAP[name] ?? name;

  return (
    <span
      className={cn(
        styles.root,
        SIZE_CLASS[size],
        'material-symbols-rounded',
        'icon',
        `icon--${size}`,
        className
      )}
      style={style}
      aria-hidden="true"
    >
      {glyph}
    </span>
  );
});

SMSIcon.displayName = 'SMSIcon';

export default SMSIcon;
