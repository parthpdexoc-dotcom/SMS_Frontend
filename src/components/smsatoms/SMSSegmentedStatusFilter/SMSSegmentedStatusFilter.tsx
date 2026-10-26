import {
  FC,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { SMSIcon } from '../SMSIcon';
import { cn } from '@/utils';
import styles from './SMSSegmentedStatusFilter.module.css';

export type SMSSegmentedStatusFilterValue = 'active' | 'inactive' | null;

export interface SMSSegmentedStatusFilterProps {
  value: SMSSegmentedStatusFilterValue;
  onChange: (value: SMSSegmentedStatusFilterValue) => void;
  activeLabel: string;
  inactiveLabel: string;
  /** When true, clicking the already-selected segment clears the filter (`null`). */
  allowClear?: boolean;
  /** Show leading icons (check / do-not-disturb). */
  showIcons?: boolean;
  /** When true, both segments are not interactive. */
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

type PillMetrics = {
  opacity: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

const initialPill: PillMetrics = {
  opacity: 0,
  left: 0,
  top: 0,
  width: 0,
  height: 0,
};

export const SMSSegmentedStatusFilter: FC<SMSSegmentedStatusFilterProps> = memo(
  function SMSSegmentedStatusFilter({
    value,
    onChange,
    activeLabel,
    inactiveLabel,
    allowClear = false,
    showIcons = true,
    disabled = false,
    className,
    ariaLabel = 'Status filter',
  }) {
    const rootRef = useRef<HTMLDivElement>(null);
    const activeRef = useRef<HTMLButtonElement>(null);
    const inactiveRef = useRef<HTMLButtonElement>(null);
    const [pill, setPill] = useState<PillMetrics>(initialPill);

    const isActive = value === 'active';
    const isInactive = value === 'inactive';

    const syncPill = useCallback(() => {
      const root = rootRef.current;
      if (!root) return;

      if (value === null) {
        setPill((prev) => ({ ...prev, opacity: 0 }));
        return;
      }

      const btn = value === 'active' ? activeRef.current : inactiveRef.current;
      if (!btn) return;

      const rootRect = root.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();

      setPill({
        opacity: 1,
        left: btnRect.left - rootRect.left,
        top: btnRect.top - rootRect.top,
        width: btnRect.width,
        height: btnRect.height,
      });
    }, [value, disabled]);

    useLayoutEffect(() => {
      syncPill();
    }, [syncPill, showIcons, activeLabel, inactiveLabel, disabled]);

    useEffect(() => {
      const root = rootRef.current;
      if (!root) return;

      const ro = new ResizeObserver(() => syncPill());
      ro.observe(root);
      const a = activeRef.current;
      const i = inactiveRef.current;
      if (a) ro.observe(a);
      if (i) ro.observe(i);

      window.addEventListener('resize', syncPill);
      return () => {
        ro.disconnect();
        window.removeEventListener('resize', syncPill);
      };
    }, [syncPill]);

    const handleActive = () => {
      if (disabled) return;
      if (allowClear && isActive) onChange(null);
      else onChange('active');
    };

    const handleInactive = () => {
      if (disabled) return;
      if (allowClear && isInactive) onChange(null);
      else onChange('inactive');
    };

    return (
      <div
        ref={rootRef}
        className={cn(styles.root, disabled && styles.rootDisabled, className)}
        role="tablist"
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
      >
        <div
          className={cn(
            styles.slidingPill,
            disabled && styles.slidingPillDisabled,
            !disabled && value === 'active' && styles.slidingPillActive,
            !disabled && value === 'inactive' && styles.slidingPillInactive
          )}
          style={{
            left: pill.left,
            top: pill.top,
            width: pill.width,
            height: pill.height,
            opacity: pill.opacity,
          }}
          aria-hidden
        />
        <button
          ref={activeRef}
          type="button"
          className={cn(
            styles.segment,
            !disabled && isActive && styles.segmentActive
          )}
          onClick={handleActive}
          aria-pressed={isActive}
          disabled={disabled}
        >
          {showIcons && !disabled && (
            <span className={styles.icon}>
              <SMSIcon name="check_circle" size="sm" />
            </span>
          )}
          <span className={styles.label}>{activeLabel}</span>
        </button>
        <button
          ref={inactiveRef}
          type="button"
          className={cn(
            styles.segment,
            !disabled && isInactive && styles.segmentInactive
          )}
          onClick={handleInactive}
          aria-pressed={isInactive}
          disabled={disabled}
        >
          {showIcons && !disabled && (
            <span className={styles.icon}>
              <SMSIcon name="do_not_disturb_on" size="sm" />
            </span>
          )}
          <span className={styles.label}>{inactiveLabel}</span>
        </button>
      </div>
    );
  }
);

SMSSegmentedStatusFilter.displayName = 'SMSSegmentedStatusFilter';

export default SMSSegmentedStatusFilter;
