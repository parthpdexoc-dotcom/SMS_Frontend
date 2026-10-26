import React, { useState } from 'react';
import { TabsProps } from '@/types';
import { Tab } from '@/components/smsmolecules/Tab';
import './SMSContentTabs.css';

export const SMSContentTabs: React.FC<TabsProps> = ({
  tabs,
  defaultActiveTab,
  activeTab: controlledActiveTab,
  onChange,
  variant = 'default',
  className = '',
  keepMounted = false,
}) => {
  if (!tabs || tabs.length === 0) {
    return null;
  }

  const [internalActiveTab, setInternalActiveTab] = useState<string>(
    defaultActiveTab || tabs[0]?.id || ''
  );

  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;
  const validActiveTab = tabs.find((tab) => tab.id === activeTab) ? activeTab : tabs[0]?.id || '';

  const handleTabChange = (tabId: string) => {
    if (controlledActiveTab === undefined) {
      setInternalActiveTab(tabId);
    }
    if (onChange) {
      onChange(tabId);
    }
  };

  const activeTabContent = tabs.find((tab) => tab.id === validActiveTab)?.content;
  const classNames = ['tabs', `tabs--${variant}`, className].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      <div className="tabs__header" role="tablist">
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            id={tab.id}
            label={tab.label}
            icon={tab.icon}
            active={validActiveTab === tab.id}
            disabled={tab.disabled}
            hasError={tab.hasError}
            onClick={handleTabChange}
          />
        ))}
      </div>
      {keepMounted
        ? tabs.map((tab) => {
            const isActive = validActiveTab === tab.id;
            return (
              <div
                key={tab.id}
                id={`tabpanel-${tab.id}`}
                className={['tabs__content', !isActive && 'tabs__content--hidden'].filter(Boolean).join(' ')}
                role="tabpanel"
                aria-labelledby={tab.id}
                aria-hidden={!isActive}
                hidden={!isActive}
              >
                {tab.content}
              </div>
            );
          })
        : activeTabContent && (
            <div className="tabs__content" role="tabpanel">
              {activeTabContent}
            </div>
          )}
    </div>
  );
};
