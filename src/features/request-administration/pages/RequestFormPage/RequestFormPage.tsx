import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { SMSFormPage, SMSRequestForm } from '@/components/smsorganisms';
import { REQUEST } from '@/constants/strings';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchRequestById } from '@/store/slices/requestSlice';
import { showToast } from '@/store/slices/toastSlice';
import { RequestResponse } from '@/types/request';
import { fetchAllRequestNotes, fetchLatestRequestNotes, upsertRequestNoteThunk } from '@/store/slices/requestNoteSlice';
import { NotesPanel, NoteItem } from '@/components/smsmolecules/NotesPanel';
import { SMSLoadingState } from '@/components/smsmolecules';
import { resolveWorkspaceReturnPath } from '@/utils/dailyWorkspaceSessionState';

type RequestFormNavState = {
  returnPath?: string;
  requesterId?: string;
  tab?: string;
  isCloned?: boolean;
};

export const RequestFormPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { id, requesterId } = useParams<{ id?: string; requesterId?: string }>();
  const dispatch = useAppDispatch();
  const stepParam = searchParams.get('step');
  const isEditMode = Boolean(id);
  const pageTitle = useMemo(() => {
    switch (stepParam) {
      case '2':
        return REQUEST.MANAGE_VEHICLE_TITLE;
      case '3':
        return REQUEST.MANAGE_EQUIPMENT_TITLE;
      default:
        return isEditMode ? REQUEST.EDIT_TITLE : REQUEST.TITLE;
    }
  }, [stepParam, isEditMode]);

  const navState = (location.state ?? null) as RequestFormNavState | null;

  const returnPathRef = useRef<string | null>(
    resolveWorkspaceReturnPath(navState, requesterId)
  );
  const previousLocationKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (location.key === previousLocationKeyRef.current) return;
    previousLocationKeyRef.current = location.key;

    const state = navState;

    const workspaceReturn = resolveWorkspaceReturnPath(state, requesterId);
    if (workspaceReturn) {
      returnPathRef.current = workspaceReturn;
    } else if (state?.tab) {
      returnPathRef.current = `/personnel/requester/${state.tab}`;
    }
  }, [location.key, location.state, requesterId]);

  const getReturnPath = (): string | number => {
    const state = navState;

    const resolvedReturn = resolveWorkspaceReturnPath(state, requesterId);
    if (resolvedReturn) {
      returnPathRef.current = resolvedReturn;
      return resolvedReturn;
    }
    if (returnPathRef.current) {
      return returnPathRef.current;
    }
    if (state?.tab) return `/personnel/requester/${state.tab}`;
    // Shared link: no state — go to daily admin with this request expanded so Back restores context
    if (isEditMode && id) return `/personnel/requester/daily?q=${id}`;
    return -1;
  };

  const navigateBack = () => {
    const returnPath = getReturnPath();
    if (typeof returnPath === 'string') navigate(returnPath);
    else navigate(returnPath);
  };

  const [editingRequest, setEditingRequest] = React.useState<RequestResponse | null>(null);
  const [isFetchingRequest, setIsFetchingRequest] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const { allNotes, isLoading: isLoadingAllNotes } = useAppSelector((state) => state.requestNote);

  // Fetch request by ID if in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      setIsFetchingRequest(true);
      setEditingRequest(null);
      dispatch(fetchRequestById(id))
        .unwrap()
        .then((request) => {
          setEditingRequest(request);
        })
        .catch((error) => {
          console.error('RequestFormPage: Failed to fetch request by ID:', error);
          setEditingRequest(null);
          navigateBack();
        })
        .finally(() => {
          setIsFetchingRequest(false);
        });
    }
  }, [dispatch, isEditMode, id, navigate]);

  // Fetch notes when panel is opened
  const handlePanelOpen = () => {
    if (isEditMode && id) {
      dispatch(fetchAllRequestNotes(id));
    }
  };

  // Handle adding notes via API
  const handleAddNotes = async (notes: string, comments: string) => {
    if (!isEditMode || !id) {
      return;
    }

    setIsSavingNote(true);
    try {
      await dispatch(upsertRequestNoteThunk({
        requestID: id,
        notes: notes || '',
        comments: comments || '',
      })).unwrap();

      // Refresh the notes list to show the newly added note
      await dispatch(fetchAllRequestNotes(id));
      
      // Refresh the latest notes to update the display at the bottom of the form
      await dispatch(fetchLatestRequestNotes(id));
    } catch (error) {
      console.error('RequestFormPage: Failed to save note:', error);
      throw error;
    } finally {
      setIsSavingNote(false);
    }
  };

  // Convert request notes to NoteItem format
  const noteItems: NoteItem[] = allNotes.map(note => ({
    noteID: note.requestNoteID,
    notes: note.notes,
    comments: note.comments,
  }));

  const handleSuccess = () => {
    // Edit: stay on the same page, show feedback, and refresh server data
    if (isEditMode && id) {
      dispatch(showToast(REQUEST.SUCCESS.REQUEST_UPDATED, 'success'));
      dispatch(fetchRequestById(id))
        .unwrap()
        .then((request) => setEditingRequest(request))
        .catch((error) => {
          console.error('RequestFormPage: Failed to refresh request after save:', error);
        });
      return;
    }
    const returnPath = getReturnPath();
    if (typeof returnPath === 'string') navigate(returnPath, { state: { savedEntityId: id, savedEntityType: 'request' } });
    else navigate(returnPath);
  };

  const handleCancel = () => {
    navigateBack();
  };

  // Show loading state while fetching data in edit mode
  if (isEditMode && (isFetchingRequest || !editingRequest)) {
    return (
      <SMSFormPage
        title={pageTitle}
        onCancel={handleCancel}
      >
        <SMSLoadingState message="Loading request data..." fullHeight />
      </SMSFormPage>
    );
  }

  try {
    return (
      <SMSFormPage
        title={pageTitle}
        subtitle={isEditMode ? undefined : REQUEST.SUBTITLE}
        onCancel={handleCancel}
        onPanelOpen={handlePanelOpen}
        overlayClassName="requester-list__assign-employees-modal-overlay"
        rightSidePanel={isEditMode ? (
          <NotesPanel
            allNotes={noteItems}
            isLoading={isLoadingAllNotes}
            onAddNote={handleAddNotes}
            isSaving={isSavingNote}
            getNoteId={(note, index) => note.noteID || `note-${index}`}
            title="Request Notes"
          />
        ) : undefined}
        rightSidePanelLabel="Notes"
      >
        <SMSRequestForm
          initialData={editingRequest}
          requesterId={requesterId}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          isCloned={navState?.isCloned === true}
        />
      </SMSFormPage>
    );
  } catch (error) {
    console.error('RequestFormPage: Error during render:', error);
    return (
      <div style={{ padding: '2rem', color: 'red' }}>
        <h2>Error Loading Request Form</h2>
        <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
        <button onClick={navigateBack}>Go Back</button>
      </div>
    );
  }
};
