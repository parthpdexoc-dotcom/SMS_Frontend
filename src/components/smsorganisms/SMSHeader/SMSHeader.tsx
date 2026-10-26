import { SMSIcon, SMSInitialAvatar } from '@/components/smsatoms';
import React, { useEffect, useRef, useState } from 'react';
import { Box, Divider, ListItemIcon, Menu, MenuItem, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { EDIT_PROFILE, HEADER } from '@/constants/strings';
import { getEmployeePhotoPreviewUrl } from '@/services/fileUploadService';
import { isImpersonationSession } from '@/services/authService';
import { useAppSelector } from '@/store/hooks';
import { UserRoleType, hasRole } from '@/types/userRole';
import './SMSHeader.css';

export interface SMSHeaderProps {
  title?: string;
  userName?: string;
  onMenuClick?: () => void;
  onSignOut?: () => void;
  disableProfileMenu?: boolean;
}

export const SMSHeader: React.FC<SMSHeaderProps> = ({
  title = HEADER.TITLE,
  userName,
  onMenuClick,
  onSignOut,
  disableProfileMenu = false,
}) => {
  const navigate = useNavigate();
  const { user, profilePhotoRefreshNonce } = useAppSelector((state) => state.auth);
  const isSuperUser = user?.isSuperUser === true || hasRole(user?.roles, UserRoleType.SuperUser);
  const showExitImpersonation = isImpersonationSession() && !isSuperUser;
  const displayName = userName || 'User';
  const [profileAnchorEl, setProfileAnchorEl] = React.useState<null | HTMLElement>(null);
  const profileMenuOpen = Boolean(profileAnchorEl);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const profilePhotoBlobRef = useRef<string | null>(null);

  const employeeIdForPhoto = user?.employeeID?.trim() ?? '';
  const tokenRequestsEmployeePhoto = user?.isLogo === true;
  const avatarInitialFrom = user?.lastName?.trim() || displayName;

  useEffect(() => {
    if (profilePhotoBlobRef.current) {
      URL.revokeObjectURL(profilePhotoBlobRef.current);
      profilePhotoBlobRef.current = null;
    }
    setProfilePhotoUrl(null);

    if (!tokenRequestsEmployeePhoto || !employeeIdForPhoto) {
      return undefined;
    }

    let cancelled = false;
    void getEmployeePhotoPreviewUrl(employeeIdForPhoto, {
      cacheBust: profilePhotoRefreshNonce,
    }).then((url) => {
      if (cancelled) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      if (!url) return;
      profilePhotoBlobRef.current = url;
      setProfilePhotoUrl(url);
    });

    return () => {
      cancelled = true;
      if (profilePhotoBlobRef.current) {
        URL.revokeObjectURL(profilePhotoBlobRef.current);
        profilePhotoBlobRef.current = null;
      }
    };
  }, [employeeIdForPhoto, tokenRequestsEmployeePhoto, profilePhotoRefreshNonce]);

  const handleOpenProfileMenu = (event: React.MouseEvent<HTMLElement>) => {
    setProfileAnchorEl(event.currentTarget);
  };

  const handleCloseProfileMenu = () => {
    setProfileAnchorEl(null);
  };

  const handleEditProfile = () => {
    if (disableProfileMenu) return;
    handleCloseProfileMenu();
    if (isSuperUser) {
      navigate('/settings/edit-admin-profile');
      return;
    }
    if (hasRole(user?.roles, UserRoleType.DepartmentAdmin) && user?.employeeID) {
      navigate(`/personnel/employee/edit/${user.employeeID}`);
      return;
    }
    navigate('/settings/edit-profile');
  };

  const handleSignOut = () => {
    if (disableProfileMenu) return;
    handleCloseProfileMenu();
    onSignOut?.();
  };

  return (
    <header className="header">
      <div className="header__left">
        {onMenuClick && (
          <button
            type="button"
            className="header__menu-button"
            onClick={onMenuClick}
            aria-label="Toggle menu"
          >
            <SMSIcon name="menu" size="md" />
          </button>
        )}
        <h1 className="header__title">{title}</h1>
        <div id="header-center-portal" className="header__portal-target"></div>
      </div>
      <div className="header__right">
        <span className="header__welcome">
          {HEADER.WELCOME} {displayName}
        </span>
        <button
          type="button"
          className="header__profile-trigger"
          onClick={handleOpenProfileMenu}
          aria-label="Open user profile menu"
        >
          {tokenRequestsEmployeePhoto && profilePhotoUrl ? (
            <img
              src={profilePhotoUrl}
              alt=""
              className="header__profile-photo header__profile-photo--sm"
              width={34}
              height={34}
            />
          ) : (
            <SMSInitialAvatar
              displayName={displayName}
              initialFrom={avatarInitialFrom}
              size="sm"
              decorative
            />
          )}
        </button>
        <Menu
          anchorEl={profileAnchorEl}
          open={profileMenuOpen}
          onClose={handleCloseProfileMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: {
              className: 'header__profile-menu-paper',
            },
          }}
        >
          <Box className="header__profile-card">
            {tokenRequestsEmployeePhoto && profilePhotoUrl ? (
              <img
                src={profilePhotoUrl}
                alt=""
                className="header__profile-photo header__profile-photo--md"
                width={48}
                height={48}
              />
            ) : (
              <SMSInitialAvatar
                displayName={displayName}
                initialFrom={avatarInitialFrom}
                size="md"
                decorative
              />
            )}
            <Typography className="header__profile-name">{displayName}</Typography>
          </Box>
          <Divider />
          <MenuItem onClick={handleEditProfile} disabled={disableProfileMenu}>
            <ListItemIcon>
              <SMSIcon name="edit" size="sm" />
            </ListItemIcon>
            {EDIT_PROFILE.PROFILE_MENU_LABEL}
          </MenuItem>
          <MenuItem onClick={handleSignOut} disabled={disableProfileMenu}>
            <ListItemIcon>
              <SMSIcon name="logout" size="sm" />
            </ListItemIcon>
            {showExitImpersonation ? HEADER.EXIT_IMPERSONATION : HEADER.SIGN_OUT}
          </MenuItem>
        </Menu>
      </div>
    </header>
  );
};
