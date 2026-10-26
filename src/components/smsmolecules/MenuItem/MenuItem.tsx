import React, { useState } from 'react';
import { SMSIcon } from '@/components/smsatoms';
import { MenuItem as MenuItemType } from '@/types';
import './MenuItem.css';

export interface MenuItemProps {
  item: MenuItemType;
  isActive?: boolean;
  activeItemId?: string;
  onClick?: (item: MenuItemType) => void;
  level?: number;
  isCollapsed?: boolean;
  disabled?: boolean;
}

const isDescendantActive = (
  children: MenuItemType[] | undefined,
  activeId: string | undefined
): boolean => {
  if (!children || !activeId) return false;
  return children.some(
    (child) => child.id === activeId || isDescendantActive(child.children, activeId)
  );
};

export const MenuItem: React.FC<MenuItemProps> = ({
  item,
  isActive = false,
  activeItemId,
  onClick,
  level = 0,
  isCollapsed = false,
  disabled = false,
}) => {
  const hasChildren = Boolean(item.children && item.children.length > 0);
  const swapIconOnHover = hasChildren && !!item.icon;
  const hasActiveChild = hasChildren && isDescendantActive(item.children, activeItemId);
  const [isExpanded, setIsExpanded] = useState(hasActiveChild || false);

  React.useEffect(() => {
    if (hasActiveChild) {
      setIsExpanded(true);
    }
  }, [hasActiveChild]);

  const handleClick = () => {
    if (disabled) return;
    if (hasChildren) {
      setIsExpanded((prev) => !prev);
      return;
    }
    onClick?.(item);
  };

  const areChildrenVisible = hasChildren && isExpanded;
  const shouldHighlightAsParentOfActive = hasChildren && hasActiveChild && !areChildrenVisible;
  const shouldShowActive = isActive || shouldHighlightAsParentOfActive;

  return (
    <div className={`menu-item ${isCollapsed ? 'menu-item--collapsed' : ''}`}>
      <button
        type="button"
        className={`menu-item__button ${shouldShowActive ? 'menu-item__button--active' : ''} ${isCollapsed ? 'menu-item__button--collapsed' : ''} ${disabled ? 'menu-item__button--disabled' : ''}`}
        onClick={handleClick}
        style={{ paddingLeft: isCollapsed ? '0' : `${1 + level * 1.5}rem` }}
        title={isCollapsed ? item.label : undefined}
        aria-expanded={hasChildren ? isExpanded : undefined}
        disabled={disabled}
      >
        {item.icon && (
          <span className={`menu-item__icon ${swapIconOnHover ? 'menu-item__icon--swap' : ''}`}>
            {swapIconOnHover ? (
              <>
                <span className="menu-item__icon-primary">{item.icon}</span>
                {hasChildren && (
                  <SMSIcon
                    name="arrowRight"
                    size="sm"
                    className={`menu-item__icon-hover ${isExpanded ? 'menu-item__icon-hover--expanded' : ''}`}
                  />
                )}
              </>
            ) : (
              item.icon
            )}
          </span>
        )}
        {!isCollapsed && (
          <>
            <span className="menu-item__label">{item.label}</span>
            {hasChildren && !swapIconOnHover && (
              <SMSIcon
                name="arrowRight"
                size="sm"
                className={`menu-item__arrow ${isExpanded ? 'menu-item__arrow--expanded' : ''}`}
              />
            )}
          </>
        )}
      </button>
      {hasChildren && (
        <div
          className={`menu-item__children ${isCollapsed ? 'menu-item__children--collapsed' : ''} ${isExpanded ? 'menu-item__children--expanded' : ''}`}
        >
          {item.children?.map((child) => (
            <MenuItem
              key={child.id}
              item={child}
              isActive={activeItemId === child.id}
              activeItemId={activeItemId}
              onClick={onClick}
              level={isCollapsed ? 0 : level + 1}
              isCollapsed={isCollapsed}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
};
