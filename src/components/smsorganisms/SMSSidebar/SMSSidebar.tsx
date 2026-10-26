import { SMSIcon } from '@/components/smsatoms';
import React, { useEffect, useState } from 'react';
import { MenuItem } from '@/components/smsmolecules/MenuItem';
import { MenuItem as MenuItemType } from '@/types';
import { SIDEBAR } from '@/constants/strings';
import './SMSSidebar.css';

export interface SMSSidebarProps {
  menuItems: MenuItemType[];
  activeItemId?: string;
  onMenuItemClick?: (item: MenuItemType) => void;
  onClose?: () => void;
  disableCollapse?: boolean;
  disabled?: boolean;
  disableMenuItems?: boolean;
}

export const SMSSidebar: React.FC<SMSSidebarProps> = ({
  menuItems,
  activeItemId,
  onMenuItemClick,
  onClose,
  disableCollapse = false,
  disabled = false,
  disableMenuItems = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (disableCollapse) {
      setIsCollapsed(false);
    }
  }, [disableCollapse]);

  const effectiveCollapsed = disableCollapse ? false : isCollapsed;

  return (
    <aside className={`sidebar ${effectiveCollapsed ? 'sidebar--collapsed' : ''} ${disabled ? 'sidebar--disabled' : ''}`}>
      <div className="sidebar__header">
        <h2 className="sidebar__title">{SIDEBAR.TITLE}</h2>
        <div className="sidebar__header-actions">
          {!disableCollapse && (
            <button
              type="button"
              className="sidebar__toggle"
              onClick={() => setIsCollapsed(!isCollapsed)}
              aria-label="Toggle sidebar collapse"
            >
              <SMSIcon name="menu" size="md" />
            </button>
          )}
          {disableCollapse && onClose && (
            <button
              type="button"
              className="sidebar__close"
              onClick={onClose}
              aria-label="Close menu"
            >
              <SMSIcon name="close" size="md" />
            </button>
          )}
        </div>
      </div>
      <nav className="sidebar__nav">
        {menuItems.map((item) => {
          const isActive = activeItemId === item.id;

          return (
            <MenuItem
              key={item.id}
              item={item}
              isActive={isActive}
              activeItemId={activeItemId}
              onClick={onMenuItemClick}
              isCollapsed={effectiveCollapsed}
              disabled={disabled || disableMenuItems}
            />
          );
        })}
      </nav>
    </aside>
  );
};
