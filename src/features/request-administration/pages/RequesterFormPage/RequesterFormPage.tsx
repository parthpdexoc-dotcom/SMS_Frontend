import React, { useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { SMSBox, SMSLoader } from '@/components/smsatoms';
import { SMSFormPage } from '@/components/smsorganisms';
import { RequesterForm } from '@/components/smsmolecules/RequesterForm';
import { SMSErrorState } from '@/components/smsmolecules';
import { REQUESTER } from '@/constants/strings';
import { fetchRequesters, fetchRequesterByIdThunk, clearSelectedRequester } from '@/store/slices/requesterSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { resolveWorkspaceReturnPath } from '@/utils/dailyWorkspaceSessionState';

function requesterIdsMatch(a?: string, b?: string): boolean {
  const x = a?.trim().toLowerCase();
  const y = b?.trim().toLowerCase();
  return Boolean(x && y && x === y);
}

export const RequesterFormPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id?: string }>();
  const dispatch = useAppDispatch();
  
  // Get return path from location state or default to requester list with current tab
  const getReturnPath = (): string => {
    const state = location.state as { returnPath?: string; requesterId?: string; tab?: string } | null;
    const resolvedReturn = resolveWorkspaceReturnPath(state);
    if (resolvedReturn) return resolvedReturn;
    if (state?.returnPath) {
      return state.returnPath;
    }
    const tab = state?.tab || 'manage';
    return `/personnel/requester/${tab}`;
  };

  const { selectedRequester, isLoading, error } = useAppSelector((state) => state.requester);
  const [currentMode, setCurrentMode] = React.useState<'view' | 'edit'>(location.pathname.includes('/edit/') ? 'edit' : 'view');

  const isEditMode = Boolean(id) && currentMode === 'edit';
  const isViewMode = Boolean(id) && currentMode === 'view';

  // Update mode when location changes
  useEffect(() => {
    const newMode = location.pathname.includes('/edit/') ? 'edit' : 'view';
    setCurrentMode(newMode);
  }, [location.pathname]);

  // Fetch requester by ID once per id (view → edit keeps the same id, so no refetch).
  useEffect(() => {
    if (!id) {
      dispatch(clearSelectedRequester());
      return;
    }

    dispatch(fetchRequesterByIdThunk(id));

    return () => {
      dispatch(clearSelectedRequester());
    };
  }, [dispatch, id]);

  const handleSuccess = () => {
    // Refresh requesters list
    dispatch(fetchRequesters());
    // Navigate back to previous page or default return path
    const returnPath = getReturnPath();
    navigate(returnPath);
  };

  const handleCancel = () => {
    navigate(getReturnPath());
  };

  const handleSwitchToEdit = () => {
    setCurrentMode('edit');
    // Update URL to reflect edit mode
    const state = location.state as { returnPath?: string; tab?: string } | null;
    navigate(`/personnel/requester/edit/${id}`, { 
      replace: true,
      state: { returnPath: state?.returnPath || `/personnel/requester/${state?.tab || 'manage'}`, tab: state?.tab || 'manage' }
    });
  };

  const pageTitle = isEditMode ? REQUESTER.EDIT_TITLE : (isViewMode ? REQUESTER.VIEW_TITLE : REQUESTER.TITLE);
  const detailReady = Boolean(
    id && selectedRequester && requesterIdsMatch(selectedRequester.requesterID, id)
  );

  if (id && !detailReady) {
    if (error && !isLoading) {
      return (
        <SMSFormPage title={pageTitle} onCancel={handleCancel}>
          <SMSErrorState
            title="Unable to load requester"
            message={error}
            onRetry={() => dispatch(fetchRequesterByIdThunk(id))}
          />
        </SMSFormPage>
      );
    }

    return (
      <SMSFormPage title={pageTitle} onCancel={handleCancel}>
        <SMSBox sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <SMSLoader loadingText="Loading requester data..." aria-label="Loading requester data..." />
        </SMSBox>
      </SMSFormPage>
    );
  }

  try {
    return (
      <SMSFormPage
        title={pageTitle}
        subtitle={isEditMode ? undefined : (isViewMode ? 'View requester details' : REQUESTER.SUBTITLE)}
        onCancel={handleCancel}
      >
        <RequesterForm
          className="requester-form"
          initialData={selectedRequester || null}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          viewMode={isViewMode}
          onSwitchToEdit={isViewMode ? handleSwitchToEdit : undefined}
        />
      </SMSFormPage>
    );
  } catch (error) {
    console.error('RequesterFormPage: Error during render:', error);
    return (
      <div style={{ padding: '2rem', color: 'red' }}>
        <h2>Error Loading Requester Form</h2>
        <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }
};
