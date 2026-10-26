import { SMSButton, SMSIcon, SMSLoader, SMSTextArea } from '@/components/smsatoms';
import React, { useState } from 'react';
import './NotesPanel.css';

export interface NoteItem {
  noteID?: string | null;
  notes: string;
  comments?: string;
}

interface NotesPanelProps {
  allNotes: NoteItem[];
  isLoading: boolean;
  onAddNote: (notes: string, comments: string) => Promise<void>;
  isSaving?: boolean;
  getNoteId?: (note: NoteItem, index: number) => string;
  title?: string;
}

export const NotesPanel: React.FC<NotesPanelProps> = ({
  allNotes,
  isLoading,
  onAddNote,
  isSaving = false,
  getNoteId = (note, index) => note.noteID || `note-${index}`,
  title,
}) => {
  const [notes, setNotes] = useState<string>('');
  const [comments, setComments] = useState<string>('');
  const [showComments, setShowComments] = useState(false);
  const [expandedCommentId, setExpandedCommentId] = useState<string | null>(null);


  // Handle adding notes via API
  const handleAddNotes = async () => {
    if ((!notes.trim() && !comments.trim())) {
      return;
    }

    try {
      await onAddNote(notes.trim(), comments.trim());
      // Clear the input fields
      setNotes('');
      setComments('');
      setShowComments(false);
    } catch (error) {
      console.error('NotesPanel: Failed to save note:', error);
    }
  };

  return (
    <div className="notes-panel">
      {/* Title */}
      {title && (
        <h3 className="notes-panel__title">{title}</h3>
      )}
      
      {/* Display all notes from API at the top */}
      {isLoading ? (
        <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center' }}>
          <SMSLoader loadingText="Loading notes..." aria-label="Loading notes..." />
        </div>
      ) : allNotes.length > 0 ? (
        <div className="notes-panel__list">
          {allNotes.map((noteItem, index) => {
            const noteId = getNoteId(noteItem, index);
            const hasComment = Boolean(noteItem.comments);
            const isCommentExpanded = expandedCommentId === noteId;
            
            return (
              <div key={noteId} className="notes-panel__item">
                <span className="notes-panel__number">{index + 1}.</span>
                <div className="notes-panel__content">
                  {noteItem.notes && (
                    <div className="notes-panel__text">{noteItem.notes}</div>
                  )}
                  {hasComment && isCommentExpanded && (
                    <div className="notes-panel__comment-expanded">
                      <div className="notes-panel__comment-label">Comment:</div>
                      <div className="notes-panel__comment-text">{noteItem.comments}</div>
                    </div>
                  )}
                </div>
                {hasComment && (
                  <button
                    type="button"
                    className="notes-panel__view-comment-button"
                    onClick={() => {
                      setExpandedCommentId(isCommentExpanded ? null : noteId);
                    }}
                    aria-label={isCommentExpanded ? "Hide comment" : "View comment"}
                    title={isCommentExpanded ? "Hide comment" : "View comment"}
                  >
                    <SMSIcon name={isCommentExpanded ? "eye-off" : "eye"} size="sm" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: 'auto' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <label style={{ fontWeight: 500, fontSize: '0.875rem' }}>Notes</label>
            {!showComments && (
              <button
                type="button"
                onClick={() => setShowComments(true)}
                className="notes-panel__add-comment-button"
                title="Add comment"
                aria-label="Add comment"
              >
                <SMSIcon name="plus" size="sm" />
              </button>
            )}
          </div>
          <SMSTextArea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Enter your notes here..."
            rows={8}
            className="notes-panel__textarea"
            fullWidth
          />
        </div>
        {showComments && (
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <label style={{ fontWeight: 500, fontSize: '0.875rem' }}>Comments</label>
              <button
                type="button"
                onClick={() => {
                  setShowComments(false);
                  setComments('');
                }}
                className="notes-panel__remove-comment-button"
                title="Remove comment"
                aria-label="Remove comment"
              >
                <SMSIcon name="close" size="sm" />
              </button>
            </div>
            <SMSTextArea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Enter your comments here..."
              rows={8}
              className="notes-panel__textarea"
              fullWidth
            />
          </div>
        )}
      </div>
      <div className="notes-panel__actions">
        <SMSButton
          onClick={handleAddNotes}
          className="notes-panel__add-button"
          disabled={(!notes.trim() && !comments.trim()) || isLoading || isSaving}
        >
          {isSaving ? 'Saving...' : 'Add Notes'}
        </SMSButton>
      </div>
    </div>
  );
};
