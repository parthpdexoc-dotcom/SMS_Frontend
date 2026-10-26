import {
  CSSProperties,
  FC,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import { SMSIcon } from '../SMSIcon';
import { cn } from '@/utils';
import styles from './SMSTabs.module.css';

export interface SMSTabOption {
  id: string;
  label: string;
  /** Material Symbols icon name (same as `SMSIcon` `name`). */
  icon?: string;
  disabled?: boolean;
  /** When `icon` is set, render it after the label instead of before. */
  iconPosition?: 'start' | 'end';
  /** Show a small attention badge (pulsing dot) on the tab. */
  badge?: boolean;
}

export interface SMSTabsProps {
  options: SMSTabOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  size?: 'small' | 'medium';
  /** `fill`: bar uses full width; each tab sizes to its label. `content`: bar shrink-wraps to tabs. */
  distribution?: 'fill' | 'content';
  /** Tab label font size (any CSS font-size value). Overrides the default for the chosen `size`. */
  fontSize?: CSSProperties['fontSize'];
  /** Optional active pill color override for the selected tab. */
  activePillColor?: string;
}

type Pill = { opacity: number; left: number; top: number; width: number; height: number };

const hiddenPill: Pill = { opacity: 0, left: 0, top: 0, width: 0, height: 0 };

function pillsEqual(a: Pill, b: Pill): boolean {
  return (
    a.opacity === b.opacity &&
    Math.round(a.left) === Math.round(b.left) &&
    Math.round(a.top) === Math.round(b.top) &&
    Math.round(a.width) === Math.round(b.width) &&
    Math.round(a.height) === Math.round(b.height)
  );
}

/**
 * Pill is `position: absolute` inside the scrollable `.tablist`. Viewport deltas from
 * `getBoundingClientRect()` ignore `scrollLeft`/`scrollTop`, so the highlight drifts and
 * overlaps tabs until we convert to content coordinates.
 */
function readPillForValue(
  root: HTMLDivElement,
  tabRefs: Record<string, HTMLButtonElement | null>,
  value: string,
  hasMatch: boolean
): Pill | null {
  if (!hasMatch) return null;
  const btn = tabRefs[value];
  if (!btn) return null;
  const rootRect = root.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  const left = btnRect.left - rootRect.left - root.clientLeft + root.scrollLeft;
  const top = btnRect.top - rootRect.top - root.clientTop + root.scrollTop;
  return {
    opacity: 1,
    left,
    top,
    width: btnRect.width,
    height: btnRect.height,
  };
}

export const SMSTabs: FC<SMSTabsProps> = memo(function SMSTabs({
  options,
  value,
  onChange,
  className,
  size = 'medium',
  distribution = 'fill',
  fontSize,
  activePillColor,
}) {
  const theme = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState<Pill>(hiddenPill);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => setIsNarrowViewport(mq.matches);
    apply();

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }

    mq.addListener(apply);
    return () => mq.removeListener(apply);
  }, []);

  const effectiveSize = size === 'small' || isNarrowViewport ? 'small' : 'medium';

  const hasCustomFontSize = fontSize != null && fontSize !== '';
  const rootStyle = useMemo((): CSSProperties => {
    const vars: Record<string, string> = {
      '--sms-tabs-hover-muted': theme.palette.action.hover,
      '--sms-tabs-hover-on-pill': alpha(theme.palette.primary.contrastText, 0.14),
    };
    if (hasCustomFontSize) {
      vars['--sms-tabs-font-size'] =
        typeof fontSize === 'number' ? `${fontSize}px` : String(fontSize);
    }
    return vars as CSSProperties;
  }, [theme, fontSize, hasCustomFontSize]);

  const optionsKey = useMemo(() => options.map((o) => o.id).join('|'), [options]);
  const hasActiveOption = useMemo(() => options.some((o) => o.id === value), [options, value]);

  const applyPill = useCallback(() => {
    const root = rootRef.current;
    if (!root || options.length === 0) {
      setPill((prev) => (pillsEqual(prev, hiddenPill) ? prev : hiddenPill));
      return;
    }

    const next = readPillForValue(root, tabRefs.current, value, hasActiveOption);
    if (next == null) {
      setPill((prev) => {
        const faded = { ...prev, opacity: 0 };
        return pillsEqual(prev, faded) ? prev : faded;
      });
      return;
    }

    setPill((prev) => (pillsEqual(prev, next) ? prev : next));
  }, [value, hasActiveOption, options.length]);

  useLayoutEffect(() => {
    applyPill();
  }, [applyPill, optionsKey, distribution, effectiveSize, fontSize]);

  useEffect(() => {
    const root = rootRef.current;
    const activeBtn = tabRefs.current[value];
    if (!root || !activeBtn) return;

    const rootRect = root.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    const outOfView = btnRect.left < rootRect.left || btnRect.right > rootRect.right;
    if (outOfView) {
      activeBtn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }, [value, optionsKey]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver(() => applyPill());
    ro.observe(root);
    window.addEventListener('resize', applyPill);
    root.addEventListener('scroll', applyPill, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', applyPill);
      root.removeEventListener('scroll', applyPill);
    };
  }, [applyPill]);

  const pillBg = activePillColor ?? theme.palette.primary.main;
  const pillShadow = `0 1px 4px ${alpha(pillBg, 0.35)}`;

  return (
    <div
      ref={rootRef}
      className={cn(
        styles.tablist,
        effectiveSize === 'small' && styles.tablistSmall,
        distribution === 'content' && styles.tablistInline,
        hasCustomFontSize && styles.tablistFontOverride,
        className
      )}
      style={rootStyle}
      role="tablist"
    >
      <div
        className={styles.pill}
        style={{
          left: pill.left,
          top: pill.top,
          width: pill.width,
          height: pill.height,
          opacity: pill.opacity,
          backgroundColor: pillBg,
          boxShadow: pillShadow,
        }}
        aria-hidden
      />
      {options.map((option) => {
        const selected = value === option.id;
        const iconPos = option.iconPosition ?? 'start';
        const iconSize = effectiveSize === 'small' ? 'sm' : 'md';
        const icon =
          option.icon != null ? (
            <SMSIcon name={option.icon} size={iconSize} className={styles.icon} />
          ) : null;

        const textColor = option.disabled
          ? selected
            ? alpha(theme.palette.primary.contrastText, 0.5)
            : theme.palette.action.disabled
          : selected
            ? theme.palette.primary.contrastText
            : theme.palette.text.secondary;

        return (
          <div key={option.id} className={styles.cell}>
            <button
              ref={(el) => {
                tabRefs.current[option.id] = el;
              }}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={option.disabled}
              className={styles.trigger}
              style={{ color: textColor }}
              onClick={() => onChange(option.id)}
            >
              {icon && iconPos === 'start' ? icon : null}
              <span className={styles.label}>{option.label}</span>
              {icon && iconPos === 'end' ? icon : null}
              {option.badge && <span className={styles.badge} aria-label="Attention needed" />}
            </button>
          </div>
        );
      })}
    </div>
  );
});

SMSTabs.displayName = 'SMSTabs';

export default SMSTabs;
