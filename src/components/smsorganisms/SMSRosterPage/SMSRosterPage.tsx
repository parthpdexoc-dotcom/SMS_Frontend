import { SMSIcon, SMSLoader, SMSBox } from '@/components/smsatoms';
import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchRosterInformation, fetchRosterInformationByRequest, clearRoster } from '@/store/slices/rosterSlice';
import { SMSRosterSection, hasRosterContent } from '../SMSRoster';
import { SMSPrintAction } from '@/components/smsmolecules';
import './SMSRosterPage.css';
import '../SMSRoster/SMSRosterPrint.css';

export const SMSRosterPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const postId = searchParams.get('postId') || '';
  const dateParam = searchParams.get('date') || '';
  const requestID = searchParams.get('requestID') || '';
  const { rosterTables, requesterName, rosterDate, isLoading, error } = useAppSelector((state) => state.roster);

  useEffect(() => {
    if (!postId || !dateParam || !requestID) {
      return;
    }

    dispatch(fetchRosterInformation({ postId, dateOfWork: dateParam }));
    dispatch(fetchRosterInformationByRequest({ requestID, dateOfWork: dateParam }));
    return () => {
      dispatch(clearRoster());
    };
  }, [postId, dateParam, dispatch, requestID]);

  const hasContent = hasRosterContent(rosterTables);

  const formattedDate = rosterDate || dateParam || '';

  if (isLoading) {
    return (
      <div className="roster-page">
        <SMSBox className="roster-page__loading" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
          <SMSLoader loadingText="Loading roster information..." aria-label="Loading roster information..." />
        </SMSBox>
      </div>
    );
  }

  if (error) {
    return (
      <div className="roster-page">
        <div className="roster-page__error">
          <SMSIcon name="error" size="lg" color="#d32f2f" />
          <p>{error}</p>
          <button className="roster-page__back-button" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!hasContent) {
    return (
      <div className="roster-page">
        <div className="roster-page__empty">
          <SMSIcon name="description" size="lg" />
          <p>No roster information available for this job and date.</p>
          <button className="roster-page__back-button" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="roster-page roster-print-document">
      <div className="roster-page__header">
        <div className="roster-page__header-left">
          <h1 className="roster-page__requester-name">{requesterName || 'Roster'}</h1>
          <div className="roster-page__date">{formattedDate}</div>
        </div>
        <div className="roster-page__header-actions">
          <SMSPrintAction targetSelector=".roster-page" documentTitle="Scheduled Roster" label="Print Roster" />
        </div>
      </div>

      <div className="roster-page__content">
        {rosterTables.map((table, index) => (
          <SMSRosterSection
            key={`section-${index}`}
            table={table}
            showWaitingListIndicator={false}
          />
        ))}
      </div>
    </div>
  );
};
