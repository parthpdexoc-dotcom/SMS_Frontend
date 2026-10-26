import React from 'react';
import { SMSDataDisplay } from '@/components/smsmolecules/SMSDataDisplay';
import type { EmployeePostListingItem } from '@/types/employeePostListingItem';
import { PostPositionResponse } from '@/types/postPosition';
import { formatDateShort, formatDuration, getPostEndTime } from '@/utils';
import './PostDetailsDisplay.css';

export type PostDetailsFallbackPost = PostPositionResponse | EmployeePostListingItem;

export interface PostDetailsDisplayProps {
  postData: PostPositionResponse | null;
  fallbackPost?: PostDetailsFallbackPost | null;
  layoutClassName?: string;
  /** Applied to each row for parent layout (e.g. CloseForm grid + truncation). */
  fieldClassName?: string;
  valueClassName?: string;
}

const getVal = <K extends keyof PostPositionResponse>(
  postData: PostPositionResponse | null,
  fallback: PostDetailsFallbackPost | null | undefined,
  key: K
): PostPositionResponse[K] | undefined => postData?.[key] ?? (fallback && key in fallback ? (fallback as PostPositionResponse)[key] : undefined);

function workDateForDisplay(
  postData: PostPositionResponse | null,
  fallback: PostDetailsFallbackPost | null | undefined
): string | undefined {
  const fromData = postData?.dateOfWork ?? postData?.startDate;
  if (fromData) return String(fromData);
  if (!fallback) return undefined;
  if ('dateOfWork' in fallback && fallback.dateOfWork) return String(fallback.dateOfWork);
  return fallback.startDate ? String(fallback.startDate) : undefined;
}

function startTimeForDisplay(
  postData: PostPositionResponse | null,
  fallback: PostDetailsFallbackPost | null | undefined
): string | undefined {
  const fromData = postData?.postStartTime;
  if (fromData) return String(fromData);
  if (!fallback) return undefined;
  if ('postStartTime' in fallback && fallback.postStartTime) return String(fallback.postStartTime);
  if ('startTime' in fallback && (fallback as EmployeePostListingItem).startTime) {
    return String((fallback as EmployeePostListingItem).startTime);
  }
  return undefined;
}

function endTimeForDisplay(
  postData: PostPositionResponse | null,
  fallback: PostDetailsFallbackPost | null | undefined,
  startTime: string | undefined,
  durationMinutes: number | undefined
): string | undefined {
  const fromData = postData?.postEndTime;
  if (fromData != null && String(fromData).trim() !== '') return String(fromData);
  if (fallback && 'postEndTime' in fallback && fallback.postEndTime != null && String(fallback.postEndTime).trim() !== '') {
    return String(fallback.postEndTime);
  }
  if (startTime && durationMinutes != null && durationMinutes > 0) {
    return getPostEndTime(startTime, durationMinutes) ?? undefined;
  }
  return undefined;
}

function durationMinutesForDisplay(
  postData: PostPositionResponse | null,
  fallback: PostDetailsFallbackPost | null | undefined
): number | undefined {
  const raw =
    postData?.postLength ??
    postData?.lengthOfWork ??
    (fallback && 'postLength' in fallback ? fallback.postLength : undefined) ??
    (fallback && 'lengthOfWork' in fallback ? fallback.lengthOfWork : undefined);
  if (raw == null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function totalPositionsForDisplay(
  postData: PostPositionResponse | null,
  fallback: PostDetailsFallbackPost | null | undefined
): number | undefined {
  const fromData = postData?.totalPostPositions;
  if (fromData != null) return Number(fromData);
  if (fallback && 'totalPositions' in fallback && fallback.totalPositions != null) {
    return Number(fallback.totalPositions);
  }
  return undefined;
}

export const PostDetailsDisplay: React.FC<PostDetailsDisplayProps> = ({
  postData,
  fallbackPost,
  layoutClassName = 'post-details-display__grid',
  fieldClassName,
  valueClassName,
}) => {
  const dateVal = workDateForDisplay(postData, fallbackPost);
  const startTime = startTimeForDisplay(postData, fallbackPost);
  const minutes = durationMinutesForDisplay(postData, fallbackPost);
  const endTime = endTimeForDisplay(postData, fallbackPost, startTime, minutes);
  const description = getVal(postData, fallbackPost, 'postDescription');
  const location = getVal(postData, fallbackPost, 'postLocation');
  const callSign = getVal(postData, fallbackPost, 'callSign');
  const notes = (postData as Record<string, unknown> | null)?.postNotes as string | undefined;
  const totalPositions = totalPositionsForDisplay(postData, fallbackPost);

  const detailOnly = postData as PostPositionResponse | null;
  const definedFields = [
    detailOnly?.postDepartmentDefinedFieldValue1,
    detailOnly?.postDepartmentDefinedFieldValue2,
    detailOnly?.postDepartmentDefinedFieldValue3,
    detailOnly?.postDepartmentDefinedFieldValue4,
    detailOnly?.postDepartmentDefinedFieldValue5,
    detailOnly?.postDepartmentDefinedFieldValue6,
    detailOnly?.postDepartmentDefinedFieldValue7,
    detailOnly?.postDepartmentDefinedFieldValue8,
    detailOnly?.postDepartmentDefinedFieldValue9,
    detailOnly?.postDepartmentDefinedFieldValue10,
  ].filter((v): v is string => !!v && String(v).trim() !== '');

  const rowProps = {
    variant: 'inline' as const,
    className: fieldClassName,
    valueClassName,
    labelFontWeight: 600 as const,
  };

  return (
    <div className={`post-details-display ${layoutClassName}`}>
      <SMSDataDisplay
        {...rowProps}
        label="Date"
        value={dateVal ? formatDateShort(String(dateVal)) : '-'}
        icon="calendar"
      />
      <SMSDataDisplay
        {...rowProps}
        label="Start Time"
        value={startTime ? String(startTime).substring(0, 5) : '-'}
        icon="clock"
      />
      <SMSDataDisplay
        {...rowProps}
        label="End Time"
        value={endTime ? String(endTime).substring(0, 5) : '-'}
        icon="clock"
      />
      <SMSDataDisplay
        {...rowProps}
        label="Duration"
        value={minutes != null ? formatDuration(minutes) : '-'}
        icon="schedule"
      />
      {description && (
        <SMSDataDisplay {...rowProps} label="Description" value={String(description)} icon="description" />
      )}
      {location && (
        <SMSDataDisplay {...rowProps} label="Location" value={String(location)} icon="location_on" />
      )}
      {callSign && (
        <SMSDataDisplay {...rowProps} label="Call Sign" value={String(callSign)} icon="radio" />
      )}
      {notes && (
        <SMSDataDisplay {...rowProps} label="Notes" value={String(notes)} icon="note" />
      )}
      {totalPositions != null && (
        <SMSDataDisplay {...rowProps} label="Total Positions" value={String(totalPositions)} icon="group" />
      )}
      {definedFields.length > 0 &&
        definedFields.map((val, idx) => (
          <SMSDataDisplay key={idx} {...rowProps} label={`Defined Field ${idx + 1}`} value={val} icon="document" />
        ))}
    </div>
  );
};
