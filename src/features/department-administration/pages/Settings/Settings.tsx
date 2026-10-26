import React from 'react';
import { SMSCard } from '@/components/smsatoms';
import { SETTINGS } from '@/constants/strings';
import './Settings.css';

export const Settings: React.FC = () => {
  return (
    <div className="settings">
      <div className="settings__header">
        <h1 className="settings__title">{SETTINGS.TITLE}</h1>
        <p className="settings__subtitle">{SETTINGS.SUBTITLE}</p>
      </div>

      <SMSCard className="settings__card" sx={{ p: 'var(--spacing-lg)' }}>
        <div className="settings__section">
          <p className="settings__section-description">{SETTINGS.COMING_SOON}</p>
        </div>
      </SMSCard>
    </div>
  );
};

