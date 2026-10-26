import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Post, prepareClonedPostForCreate } from '@/types/post';
import { resolveWorkspaceReturnPath } from '@/utils/dailyWorkspaceSessionState';
import { SMSFormPage, SMSPostForm } from '@/components/smsorganisms';
import { FormMode } from '@/types/common';
import { POST } from '@/constants/strings';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchPostById } from '@/store/slices/postSlice';
import { showToast } from '@/store/slices/toastSlice';
import { fetchAllPostNotes, fetchLatestPostNotes, upsertPostNoteThunk } from '@/store/slices/postNoteSlice';
import { NotesPanel, NoteItem } from '@/components/smsmolecules/NotesPanel';
import { SMSLoadingState } from '@/components/smsmolecules';

export const PostFormPage: React.FC = () => {
    const { requestId, postId } = useParams<{ requestId: string; postId: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useAppDispatch();
    
    // Store the return path from location state - capture it fresh on each navigation
    const returnPathRef = useRef<string | null>(
        resolveWorkspaceReturnPath(
            location.state as { returnPath?: string; requesterId?: string; tab?: string } | null
        )
    );
    const previousLocationKeyRef = useRef<string | undefined>(undefined);
    
    // Capture return path whenever location.key changes (indicating a new navigation)
    // location.key is unique for each navigation, ensuring we capture fresh state
    useEffect(() => {
        if (location.key === previousLocationKeyRef.current) return;
        previousLocationKeyRef.current = location.key;

        const state = location.state as {
            returnPath?: string;
            requesterId?: string;
            tab?: string;
            parentPostId?: string;
            clonePost?: Post;
        } | null;

        const resolvedReturn = resolveWorkspaceReturnPath(state);
        if (resolvedReturn) {
            returnPathRef.current = resolvedReturn;
        } else if (state?.tab) {
            returnPathRef.current = `/personnel/requester/${state.tab}`;
        }
    }, [location.key, location.state]);
    
    const getReturnPath = (): string | number => {
        const state = location.state as {
            returnPath?: string;
            requesterId?: string;
            tab?: string;
        } | null;

        const resolvedReturn = resolveWorkspaceReturnPath(state);
        if (resolvedReturn) {
            returnPathRef.current = resolvedReturn;
            return resolvedReturn;
        }
        if (returnPathRef.current) {
            return returnPathRef.current;
        }
        if (state?.tab) return `/personnel/requester/${state.tab}`;
        // Shared link: no state — go to daily admin with this request and post expanded so Back restores context
        if (!isCreate && requestId && postId) {
            const params = new URLSearchParams({ q: requestId, p: postId });
            return `/personnel/requester/daily?${params.toString()}`;
        }
        return -1;
    };

    // Determine mode
    const isCreate = !postId;
    const modeParam = searchParams.get('mode');
    const initialMode = isCreate ? FormMode.CREATE : (modeParam === 'edit' ? FormMode.EDIT : FormMode.VIEW);
    const isEditMode = !isCreate && initialMode === FormMode.EDIT;

    const state = (location.state as {
        parentPostId?: string;
        clonePost?: Post;
        highlightCloneTimeFields?: boolean;
        isCloned?: boolean;
    } | null) || null;

    const highlightTimeFieldsFromClone = Boolean(
        isEditMode && state?.highlightCloneTimeFields === true
    );
    const parentPostIdForCreate = isCreate && state && typeof state === 'object' ? state.parentPostId : undefined;
    const rawClonePost = isCreate && state && typeof state === 'object' ? state.clonePost : undefined;
    const cloneSourcePost = isCreate && rawClonePost && requestId
        ? prepareClonedPostForCreate(rawClonePost, requestId)
        : undefined;

    const [post, setPost] = useState<Post | null>(null);
    const [hasFetched, setHasFetched] = useState(false);
    const [isFetchingPost, setIsFetchingPost] = useState(false);
    const closeHandlerRef = useRef<(() => void) | null>(null);

    // Notes panel state
    const [isSavingNote, setIsSavingNote] = useState(false);
    const { allNotes, isLoading: isLoadingAllNotes } = useAppSelector((state) => state.postNote);

    useEffect(() => {
        if (isCreate || !postId) {
            return;
        }

        let cancelled = false;

        const load = async () => {
            setIsFetchingPost(true);
            setHasFetched(false);
            setPost(null);
            try {
                const data = await dispatch(fetchPostById({ postId })).unwrap();
                if (!cancelled) {
                    setPost(data);
                }
            } catch {
                if (!cancelled) {
                    setPost(null);
                }
            } finally {
                if (!cancelled) {
                    setHasFetched(true);
                    setIsFetchingPost(false);
                }
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [dispatch, postId, isCreate]);

    useEffect(() => {
        if (!isCreate && hasFetched && !post && postId) {
            console.error('Post not found');
            const returnPath = getReturnPath();
            if (typeof returnPath === 'string') navigate(returnPath);
            else navigate(returnPath);
        }
    }, [isCreate, hasFetched, post, postId, navigate]);

    const handleSaveSuccess = () => {
        // Edit: stay on the same page, show feedback, and refresh server data
        if (isEditMode && postId) {
            dispatch(showToast(POST.SUCCESS.UPDATED, 'success'));
            dispatch(fetchPostById({ postId }))
                .unwrap()
                .then((data) => setPost(data))
                .catch((error) => {
                    console.error('PostFormPage: Failed to refresh job after save:', error);
                });
            return;
        }
        const returnPath = getReturnPath();
        if (typeof returnPath === 'string') {
            navigate(returnPath, { state: { savedEntityId: postId, savedEntityType: 'post' } });
        } else {
            navigate(returnPath);
        }
    };

    const navigateBack = () => {
        const returnPath = getReturnPath();
        if (typeof returnPath === 'string') navigate(returnPath);
        else navigate(returnPath);
    };

    const handleClose = () => {
        if (closeHandlerRef.current) {
            closeHandlerRef.current();
            return;
        }
        navigateBack();
    };

    // Fetch notes when panel is opened
    const handlePanelOpen = () => {
        if (isEditMode && postId) {
            dispatch(fetchAllPostNotes(postId));
        }
    };

    // Handle adding notes via API
    const handleAddNotes = async (notes: string, comments: string) => {
        if (!isEditMode || !postId) {
            return;
        }

        setIsSavingNote(true);
        try {
            await dispatch(upsertPostNoteThunk({
                postID: postId,
                notes: notes || '',
                comments: comments || '',
            })).unwrap();

            // Refresh the notes list to show the newly added note
            await dispatch(fetchAllPostNotes(postId));
            
            // Refresh the latest notes to update the display at the bottom of the form
            await dispatch(fetchLatestPostNotes(postId));
        } catch (error) {
            console.error('PostFormPage: Failed to save note:', error);
            throw error;
        } finally {
            setIsSavingNote(false);
        }
    };

    // Convert post notes to NoteItem format
    const noteItems: NoteItem[] = allNotes.map(note => ({
        noteID: note.postNoteID,
        notes: note.notes,
        comments: note.comments,
    }));

    // Only show loading when in edit/view mode and actually loading
    // In create mode, we don't need to wait for posts to load
    if (!isCreate && (isFetchingPost || !hasFetched || !post)) {
        return (
            <SMSFormPage title={POST.EDIT_TITLE} onCancel={handleClose}>
                <SMSLoadingState message={POST.LIST.LOADING} fullHeight />
            </SMSFormPage>
        );
    }

    const pageTitle = initialMode === FormMode.CREATE ? POST.CREATE_TITLE : (initialMode === FormMode.EDIT ? POST.EDIT_TITLE : POST.DETAILS);

    return (
        <SMSFormPage
            title={pageTitle}
            onCancel={handleClose}
            onPanelOpen={handlePanelOpen}
            rightSidePanel={isEditMode && postId ? (
                <NotesPanel
                    allNotes={noteItems}
                    isLoading={isLoadingAllNotes}
                    onAddNote={handleAddNotes}
                    isSaving={isSavingNote}
                    getNoteId={(note, index) => note.noteID || `note-${index}`}
                    title={POST.FORM.NOTES_PANEL_TITLE}
                />
            ) : undefined}
            rightSidePanelLabel="Notes"
        >
            <SMSPostForm
                post={post}
                requestID={requestId || ''}
                initialMode={initialMode}
                onClose={navigateBack}
                onSaveSuccess={handleSaveSuccess}
                parentPostIdForCreate={parentPostIdForCreate}
                cloneSourcePost={cloneSourcePost}
                highlightTimeFieldsFromClone={highlightTimeFieldsFromClone}
                isCloned={state?.isCloned === true}
                closeHandlerRef={closeHandlerRef}
            />
        </SMSFormPage>
    );
};
