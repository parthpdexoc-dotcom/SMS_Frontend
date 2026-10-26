import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SMSButton,
  SMSCard,
  SMSTextField,
  SMSStackColumn,
  SMSBox,
  SMSLoader,
  SMSTypography,
} from '@/components/smsatoms';
import { EDIT_PROFILE, LOGIN } from '@/constants/strings';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  fetchAdminProfile,
  saveAdminProfileSelfEdit,
  clearAdminProfileError,
} from '@/store/slices/adminProfileSlice';
import { updateSessionUserProfile } from '@/store/slices/authSlice';
import { showToast } from '@/store/slices/toastSlice';
import { UserRoleType, hasRole } from '@/types/userRole';
import './SuperUserEditProfilePage.css';

const L = EDIT_PROFILE.SUPER_USER;

export const SuperUserEditProfilePage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const { admin, isLoading, isSaving, error } = useAppSelector((state) => state.adminProfile);
  const isSuperUser = user?.isSuperUser === true || hasRole(user?.roles, UserRoleType.SuperUser);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordFieldError, setPasswordFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperUser) {
      navigate('/forbidden', { replace: true });
    }
  }, [isSuperUser, navigate]);

  useEffect(() => {
    dispatch(clearAdminProfileError());
    const adminId = user?.adminID?.trim();
    if (!isSuperUser || !adminId) return;
    void dispatch(fetchAdminProfile(adminId));
  }, [dispatch, isSuperUser, user?.adminID]);

  useEffect(() => {
    if (!admin) return;
    setFirstName(admin.firstName ?? '');
    setLastName(admin.lastName ?? '');
    setUserName(admin.userName ?? '');
    setPassword('');
    setPasswordFieldError(null);
  }, [admin]);

  const adminId = user?.adminID?.trim();
  const canLoad = Boolean(isSuperUser && adminId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admin || !adminId) return;

    const pw = password.trim();
    setPasswordFieldError(null);

    if (pw.length > 0 && pw.length < 6) {
      setPasswordFieldError(LOGIN.ERRORS.PASSWORD_MIN_LENGTH);
      return;
    }

    try {
      const updated = await dispatch(
        saveAdminProfileSelfEdit({
          adminId,
          original: admin,
          draft: {
            firstName,
            lastName,
            userName,
            ...(pw ? { password: pw } : {}),
          },
        })
      ).unwrap();
      dispatch(
        updateSessionUserProfile({
          firstName: updated.firstName ?? undefined,
          lastName: updated.lastName ?? undefined,
          username: updated.userName,
        })
      );
      setPassword('');
      dispatch(showToast(L.SAVE_SUCCESS, 'success'));
      navigate('/admin/department', { replace: true });
    } catch {
      // Error surfaced via Redux `error` and optional toast from slice consumers
    }
  };

  if (!isSuperUser) {
    return null;
  }

  if (!adminId) {
    return (
      <div className="super-user-edit-profile">
        <SMSTypography variant="body1" color="error">
          {L.MISSING_ADMIN_ID}
        </SMSTypography>
      </div>
    );
  }

  if (isLoading && !admin) {
    return (
      <SMSBox className="super-user-edit-profile super-user-edit-profile--centered">
        <SMSLoader />
        <SMSTypography variant="body2">{L.LOADING}</SMSTypography>
      </SMSBox>
    );
  }

  return (
    <div className="super-user-edit-profile">
      <div className="super-user-edit-profile__header">
        <h1 className="super-user-edit-profile__title">{L.PAGE_TITLE}</h1>
        <p className="super-user-edit-profile__subtitle">{L.PAGE_SUBTITLE}</p>
      </div>

      <SMSCard elevation={1} className="super-user-edit-profile__card">
        <form onSubmit={handleSubmit}>
          <SMSStackColumn gap="md">
            {error ? (
              <SMSTypography variant="body2" color="error">
                {error}
              </SMSTypography>
            ) : null}
            <SMSTextField
              label={L.FIRST_NAME_LABEL}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              fullWidth
              autoComplete="given-name"
            />
            <SMSTextField
              label={L.LAST_NAME_LABEL}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              fullWidth
              autoComplete="family-name"
            />
            <SMSTextField
              label={L.USERNAME_LABEL}
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              fullWidth
              required
              autoComplete="username"
            />
            <SMSTextField
              type="password"
              label={L.NEW_PASSWORD_LABEL}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordFieldError(null);
              }}
              placeholder={L.NEW_PASSWORD_PLACEHOLDER}
              fullWidth
              autoComplete="new-password"
              error={Boolean(passwordFieldError)}
              helperText={passwordFieldError ?? undefined}
            />
            <SMSButton type="submit" variant="contained" disabled={isSaving || !canLoad}>
              {isSaving ? L.SAVING : L.SAVE}
            </SMSButton>
          </SMSStackColumn>
        </form>
      </SMSCard>
    </div>
  );
};
