import { SMSButton, SMSIcon, SMSIconButton } from '@/components/smsatoms';
import React, { useState, useRef, useEffect } from 'react';
import { SMSModal as Modal } from '@/components/smsorganisms';
import { useAppDispatch } from '@/store/hooks';
import { showToast } from '@/store/slices/toastSlice';
import { downloadRequestFile, deleteRequestFile, getRequestFileBlobUrl } from '@/services/fileUploadService';
import type { FileUploadDto } from '@/types/fileUpload';
import './UploadFileModal.css';
import { REQUESTER } from '@/constants/strings';
import { getAttachmentIconNameFromTypeKey } from '@/utils/fileAttachmentIcons';

function canPreviewInBrowser(typeKey: string): boolean {
  return ['pdf', 'jpg', 'jpeg', 'png', 'txt'].includes(typeKey);
}

const ACCEPT_UPLOAD = '.xlsx,.xls,.doc,.docx,.pdf,.jpg,.jpeg,.png,.txt';
const SUPPORTED_FORMATS_TEXT = 'Supported formats: XLS, XLSX, Word (DOC/DOCX), PDF, JPG, PNG, TXT';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getTypeKey(file: File): string {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return ext === 'jpeg' ? 'jpg' : ext;
}

function isAllowedType(file: File): boolean {
  const allowed = ['xlsx', 'xls', 'doc', 'docx', 'pdf', 'jpg', 'jpeg', 'png', 'txt'];
  return allowed.includes(getTypeKey(file));
}

export interface UploadFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when user confirms upload with selected files */
  onUpload: (files: File[]) => void;
  /** Modal title. Default: "Upload file" */
  title?: string;
  /** When true, only one file per format (xlsx, doc, pdf, etc.) is allowed. Default: true */
  oneFilePerType?: boolean;
  /** Already uploaded files for this request (shown in same format as Attachments) */
  existingFiles?: FileUploadDto[];
  /** Request ID for download/delete/preview of existing files */
  requestID?: string;
  /** Requester ID (required with requestID for UploadFile API routes) */
  requesterID?: string;
  /** Called after an existing file is deleted so parent can refetch */
  onDeletedFile?: () => void;
}

export const UploadFileModal: React.FC<UploadFileModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  title = REQUESTER.ACTIONS.ADD_FILE,
  oneFilePerType = true,
  existingFiles = [],
  requestID,
  requesterID,
  onDeletedFile,
}) => {
  const dispatch = useAppDispatch();
  const [files, setFiles] = useState<{ id: string; file: File; typeKey: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ id: string; file: File; typeKey: string } | null>(null);
  const [previewExistingFile, setPreviewExistingFile] = useState<FileUploadDto | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const openPreview = (item: { id: string; file: File; typeKey: string }) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setPreviewExistingFile(null);
    setPreviewFile(item);
    setPreviewUrl(URL.createObjectURL(item.file));
  };

  const openPreviewExisting = async (file: FileUploadDto) => {
    if (!requestID || !requesterID) return;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setPreviewFile(null);
    setPreviewExistingFile(file);
    try {
      const url = await getRequestFileBlobUrl(requesterID, requestID, file.fileUploadedId);
      setPreviewUrl(url);
    } catch {
      dispatch(showToast('Failed to load file for preview', 'error'));
      setPreviewExistingFile(null);
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setPreviewFile(null);
    setPreviewExistingFile(null);
  };

  const downloadPreviewFile = () => {
    if (previewExistingFile) {
      handleDownloadExisting(previewExistingFile);
      return;
    }
    if (!previewFile || !previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = previewFile.file.name;
    a.click();
  };

  const existingTypeKey = (typeOfFile: string) => {
    const t = (typeOfFile || '').toLowerCase().replace(/^\./, '');
    if (['xls', 'xlsx', 'csv'].includes(t)) return 'xls';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(t)) return 'jpg';
    return t === 'doc' || t === 'docx' ? 'doc' : t || 'file';
  };
  const previewTitle = previewFile?.file.name ?? previewExistingFile?.fileName ?? '';
  const previewTypeKey = previewFile?.typeKey ?? (previewExistingFile ? existingTypeKey(previewExistingFile.typeOfFile) : '');
  const isPreviewOpen = (previewFile != null || previewExistingFile != null) && previewUrl != null;

  const processFile = (file: File): boolean => {
    if (!isAllowedType(file)) {
      dispatch(showToast(SUPPORTED_FORMATS_TEXT, 'error'));
      return false;
    }
    const typeKey = getTypeKey(file);
    setFiles((prev) => {
      if (oneFilePerType && prev.some((a) => a.typeKey === typeKey)) {
        dispatch(showToast(`A ${typeKey.toUpperCase()} file is already added. Remove it to upload another.`, 'error'));
        return prev;
      }
      return [...prev, { id: `${typeKey}-${Date.now()}`, file, typeKey }];
    });
    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) processFile(e.dataTransfer.files[0]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) processFile(e.target.files[0]);
    e.target.value = '';
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSubmit = () => {
    if (files.length > 0) {
      onUpload(files.map((f) => f.file));
      setFiles([]);
      onClose();
    }
  };

  const handleClose = () => {
    closePreview();
    setFiles([]);
    setDragOver(false);
    onClose();
  };

  const handleDeleteExisting = async (file: FileUploadDto) => {
    if (!requestID || !requesterID) return;
    try {
      await deleteRequestFile(requesterID, requestID, file.fileUploadedId);
      onDeletedFile?.();
    } catch {
      dispatch(showToast('Failed to delete file', 'error'));
    }
  };

  const handleDownloadExisting = async (file: FileUploadDto) => {
    if (!requestID || !requesterID) return;
    try {
      await downloadRequestFile(requesterID, requestID, file.fileUploadedId, file.fileName);
    } catch {
      dispatch(showToast('Failed to download file', 'error'));
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="small">
      <div className="upload-modal__body">
        <div className="upload-modal__row">
          <div className="upload-modal__zone-col">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_UPLOAD}
              onChange={handleInputChange}
              className="upload-modal__file-input"
              aria-label="Choose file"
            />
            <div
              className={`upload-modal__zone ${dragOver ? 'upload-modal__zone--dragover' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <div className="upload-modal__zone-icon">
                <SMSIcon name="upload_file" size="xl" className="upload-modal__icon" />
              </div>
              <p className="upload-modal__zone-text">
                Drag and Drop file here or <span className="upload-modal__choose">Choose file</span>
              </p>
            </div>
          </div>
        </div>
        <div className="upload-modal__meta">
          <span className="upload-modal__formats">{SUPPORTED_FORMATS_TEXT}</span>
        </div>
        {(existingFiles.length > 0 || files.length > 0) && (
          <>
            <ul className="upload-modal__list">
              {[
                ...existingFiles.map((file) => ({ kind: 'existing' as const, key: file.fileUploadedId, file })),
                ...files.map((item) => ({ kind: 'new' as const, key: item.id, item })),
              ].map((entry) =>
                entry.kind === 'existing' ? (
                  <li key={entry.key} className="upload-modal__item">
                    <SMSIcon name={getAttachmentIconNameFromTypeKey(existingTypeKey(entry.file.typeOfFile))} size="md" className="upload-modal__item-icon" />
                    <div className="upload-modal__item-info">
                      <span className="upload-modal__item-name" title={entry.file.fileName}>{entry.file.fileName}.{entry.file.typeOfFile}</span>
                      <span className="upload-modal__item-size">
                        {entry.file.fileSize != null ? formatFileSize(entry.file.fileSize) : '-'}
                      </span>
                    </div>
                    <div className="upload-modal__item-actions">
                      <SMSIconButton
                        type="button"
                        size="small"
                        tone="primary"
                        className="upload-modal__item-preview"
                        onClick={() => openPreviewExisting(entry.file)}
                        aria-label={`Preview ${entry.file.fileName}`}
                        title="Preview"
                        allowWhenSuspended
                      >
                        <SMSIcon name="eye" size="sm" />
                      </SMSIconButton>
                      <SMSIconButton
                        type="button"
                        size="small"
                        tone="error"
                        className="upload-modal__item-delete"
                        onClick={() => handleDeleteExisting(entry.file)}
                        aria-label={`Delete ${entry.file.fileName}`}
                        title="Delete"
                        allowWhenSuspended
                      >
                        <SMSIcon name="delete" size="sm" />
                      </SMSIconButton>
                    </div>
                  </li>
                ) : (
                  <li key={entry.key} className="upload-modal__item">
                    <SMSIcon name={getAttachmentIconNameFromTypeKey(entry.item.typeKey)} size="md" className="upload-modal__item-icon" />
                    <div className="upload-modal__item-info">
                      <span className="upload-modal__item-name" title={entry.item.file.name}>{entry.item.file.name}</span>
                      <span className="upload-modal__item-size">{formatFileSize(entry.item.file.size)}</span>
                    </div>
                    <div className="upload-modal__item-actions">
                      <SMSIconButton
                        type="button"
                        size="small"
                        tone="primary"
                        className="upload-modal__item-preview"
                        onClick={() => openPreview(entry.item)}
                        aria-label={`Preview ${entry.item.file.name}`}
                        title="Preview"
                        allowWhenSuspended
                      >
                        <SMSIcon name="eye" size="sm" />
                      </SMSIconButton>
                      <SMSIconButton
                        type="button"
                        size="small"
                        tone="error"
                        className="upload-modal__item-delete"
                        onClick={() => removeFile(entry.item.id)}
                        aria-label={`Delete ${entry.item.file.name}`}
                        title="Delete"
                        allowWhenSuspended
                      >
                        <SMSIcon name="delete" size="sm" />
                      </SMSIconButton>
                    </div>
                  </li>
                )
              )}
            </ul>
            {isPreviewOpen && (
              <div className="upload-modal__preview-overlay" role="dialog" aria-modal="true" aria-label="File preview">
                <div className="upload-modal__preview-header">
                  <span className="upload-modal__preview-title">{previewTitle}</span>
                  <div className="upload-modal__preview-header-btns">
                    <SMSButton variant="outlined" allowWhenSuspended onClick={downloadPreviewFile} className="upload-modal__preview-download">
                      Download
                    </SMSButton>
                    <button
                      type="button"
                      className="upload-modal__preview-close"
                      onClick={closePreview}
                      aria-label="Close preview"
                    >
                      <SMSIcon name="close" size="sm" />
                    </button>
                  </div>
                </div>
                <div className="upload-modal__preview-content">
                  {canPreviewInBrowser(previewTypeKey) ? (
                    previewTypeKey === 'pdf' || previewTypeKey === 'txt' ? (
                      <iframe src={previewUrl!} title={previewTitle} className="upload-modal__preview-iframe" />
                    ) : (
                      <img src={previewUrl!} alt={previewTitle} className="upload-modal__preview-img" />
                    )
                  ) : (
                    <div className="upload-modal__preview-unavailable">
                      <p>Preview not available for this file type.</p>
                      <SMSButton allowWhenSuspended onClick={downloadPreviewFile}>Download file</SMSButton>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="upload-modal__actions">
              <SMSButton onClick={handleClose}>Cancel</SMSButton>
              <SMSButton onClick={handleSubmit}>Upload</SMSButton>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
