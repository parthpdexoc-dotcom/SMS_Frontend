import React, { useMemo } from 'react';
import {
  SMSButton,
  SMSDialog,
  SMSDialogActions,
  SMSDialogContent,
} from '@/components/smsatoms';
import { CONSENT_DISCLOSURE_DIALOG } from '@/constants/strings';
import { buildSmsConsentFormHtml } from './smsConsentFormTemplate';
import './SMSConsentDisclosureDialog.css';

/**
 * `consent`: opened when the user checks a consent box; shows Yes / No.
 * `review`: opened from a "read the disclosure" link; shows Close only and must not change state.
 */
export type SMSConsentDisclosureDialogMode = 'consent' | 'review';

export interface SMSConsentDisclosureDialogProps {
  open: boolean;
  mode: SMSConsentDisclosureDialogMode;
  firstName: string;
  lastName: string;
  /** SMS telephone number already entered on the employee form. */
  phoneNumber: string;
  email?: string;
  /** Whether the consent box inside the form should render as checked. */
  consentChecked?: boolean;
  /** User agreed (only fired in `consent` mode). */
  onAccept: () => void;
  /** User declined, closed the dialog, or dismissed it in `review` mode. */
  onDecline: () => void;
}

const C = CONSENT_DISCLOSURE_DIALOG;

export const SMSConsentDisclosureDialog: React.FC<SMSConsentDisclosureDialogProps> = ({
  open,
  mode,
  firstName,
  lastName,
  phoneNumber,
  email = '',
  consentChecked = true,
  onAccept,
  onDecline,
}) => {
  const srcDoc = useMemo(
    () => buildSmsConsentFormHtml({ firstName, lastName, phoneNumber, email, consentChecked }),
    [firstName, lastName, phoneNumber, email, consentChecked]
  );

  return (
    <SMSDialog open={open} onClose={onDecline} maxWidth="md" fullWidth>
      <SMSDialogContent>
        <iframe
          className="sms-consent-disclosure-dialog__frame"
          srcDoc={srcDoc}
          title={C.FRAME_TITLE}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
        />
      </SMSDialogContent>
      <SMSDialogActions>
        {mode === 'consent' ? (
          <>
            <SMSButton allowWhenSuspended variant="outlined" onClick={onDecline}>
              {C.NO}
            </SMSButton>
            <SMSButton allowWhenSuspended onClick={onAccept}>
              {C.YES}
            </SMSButton>
          </>
        ) : (
          <SMSButton allowWhenSuspended onClick={onDecline}>
            {C.CLOSE}
          </SMSButton>
        )}
      </SMSDialogActions>
    </SMSDialog>
  );
};

export default SMSConsentDisclosureDialog;
