import React, { useEffect, useState } from 'react';
import { SMSHeader } from '@/components/smsorganisms';
import { SMSSidebar } from '@/components/smsorganisms';
import { MenuItem } from '@/types';
import { useAppSelector } from '@/store/hooks';
import { formatLastNameCommaFirstName } from '@/utils';
import './SMSLayout.css';

export interface SMSLayoutProps {
  children: React.ReactNode;
  menuItems: MenuItem[];
  activeMenuItemId?: string;
  onMenuItemClick?: (item: MenuItem) => void;
  onSignOut?: () => void;
  hideSidebar?: boolean;
  disableSidebar?: boolean;
  disableMenuItems?: boolean;
}

export const SMSLayout: React.FC<SMSLayoutProps> = ({
  children,
  menuItems,
  activeMenuItemId,
  onMenuItemClick,
  onSignOut,
  hideSidebar = false,
  disableSidebar = false,
  disableMenuItems = false,
}) => {
  const { user } = useAppSelector((state) => state.auth);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileNav, setIsMobileNav] = useState(false);

  const userName =
    formatLastNameCommaFirstName(user?.firstName, user?.lastName) ||
    user?.fullName ||
    user?.username ||
    'User';

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const update = () => setIsMobileNav(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (hideSidebar) {
      setIsSidebarOpen(false);
    }
  }, [hideSidebar]);

  useEffect(() => {
    if (!hideSidebar && isMobileNav && isSidebarOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
    return;
  }, [hideSidebar, isMobileNav, isSidebarOpen]);

  const handleMenuClick = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const handleSidebarItemClick = (item: MenuItem) => {
    if (disableSidebar || disableMenuItems) return;
    setIsSidebarOpen(false);
    onMenuItemClick?.(item);
  };

  return (
    <div className={`layout ${hideSidebar ? 'layout--no-sidebar' : ''}`}>
      {!hideSidebar && (
        <div className={`sidebar-wrapper ${isSidebarOpen ? 'sidebar-wrapper--open' : ''}`}>
          <SMSSidebar
            menuItems={menuItems}
            activeItemId={activeMenuItemId}
            onMenuItemClick={handleSidebarItemClick}
            onClose={() => setIsSidebarOpen(false)}
            disableCollapse={isMobileNav}
            disabled={disableSidebar}
            disableMenuItems={disableMenuItems}
          />
        </div>
      )}
      {!hideSidebar && (
        <div
          className={`layout__overlay ${isSidebarOpen ? 'layout__overlay--visible' : ''}`}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <div className="layout__main">
        <SMSHeader
          userName={userName}
          onMenuClick={!hideSidebar ? handleMenuClick : undefined}
          onSignOut={onSignOut}
          disableProfileMenu={disableMenuItems}
        />
        <main className="layout__content">{children}</main>
      </div>
    </div>
  );
};
