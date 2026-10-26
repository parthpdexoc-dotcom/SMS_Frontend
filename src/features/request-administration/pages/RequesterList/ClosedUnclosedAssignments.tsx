import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { SMSBox, SMSSwitch, SMSTabs } from '@/components/smsatoms';
import type { SMSTabOption } from '@/components/smsatoms';
import { EMPLOYEE_ASSIGNMENT_FILTERS } from '@/constants/strings';
import { CloseAssignments } from './CloseAssignments';
import { UnclosedAssignments } from './UnclosedAssignments';
import './ClosedUnclosedAssignments.css';

type SubTabId = 'unclosed' | 'closed';

const VALID_SUB_TABS: readonly SubTabId[] = ['unclosed', 'closed'];
const DEFAULT_SUB_TAB: SubTabId = 'unclosed';
const PARENT_TAB_PATH = '/personnel/requester/close-unclosed';

const SUB_TAB_OPTIONS: SMSTabOption[] = [
  { id: 'unclosed', label: 'Unclosed', icon: 'check_circle' },
  { id: 'closed', label: 'Closed', icon: 'assignment_turned_in' },
];

const isValidSubTab = (value: string | null | undefined): value is SubTabId =>
  value != null && (VALID_SUB_TABS as readonly string[]).includes(value);

/**
 * Wrapper for the merged "Closed/Unclosed Assignment" tab.
 * The selected sub-tab is encoded as a path segment
 * (`/personnel/requester/close-unclosed/closed|unclosed`) so deep links and
 * browser back/forward navigate naturally.
 */
export const ClosedUnclosedAssignments: React.FC = () => {
  const { subtab: subtabFromPath } = useParams<{ subtab?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPlaceholders, setShowPlaceholders] = React.useState(false);

  const activeSubTab: SubTabId = isValidSubTab(subtabFromPath) ? subtabFromPath : DEFAULT_SUB_TAB;

  const handleSubTabChange = React.useCallback(
    (next: string) => {
      if (!isValidSubTab(next) || next === activeSubTab) return;
      // Preserve any existing query string / hash when only the sub-tab changes.
      navigate(`${PARENT_TAB_PATH}/${next}${location.search}${location.hash}`, { replace: true });
    },
    [activeSubTab, navigate, location.search, location.hash]
  );

  // Render only the active sub-tab. Switching unmounts the previous pane and
  // mounts the next one, so each pane re-runs its initial API fetch every time
  // the user lands on it. The `key` makes that explicit even when React reuses
  // the component instance.
  return (
    <SMSBox className="closed-unclosed-assignments">
      <SMSBox className="closed-unclosed-assignments__tabs">
        <SMSTabs
          options={SUB_TAB_OPTIONS}
          value={activeSubTab}
          onChange={handleSubTabChange}
          distribution="content"
          fontSize="0.95rem"
        />
        <SMSBox className="closed-unclosed-assignments__placeholder-toggle">
          <SMSSwitch
            label={EMPLOYEE_ASSIGNMENT_FILTERS.SHOW_PLACEHOLDERS_LABEL}
            checked={showPlaceholders}
            onChange={(e) => setShowPlaceholders(e.target.checked)}
          />
        </SMSBox>
      </SMSBox>

      <SMSBox className="closed-unclosed-assignments__panel">
        <SMSBox className="closed-unclosed-assignments__pane">
          {activeSubTab === 'unclosed' ? (
            <UnclosedAssignments
              key="unclosed"
              showPlaceholders={showPlaceholders}
              onShowPlaceholdersChange={setShowPlaceholders}
            />
          ) : (
            <CloseAssignments
              key="closed"
              showPlaceholders={showPlaceholders}
              onShowPlaceholdersChange={setShowPlaceholders}
            />
          )}
        </SMSBox>
      </SMSBox>
    </SMSBox>
  );
};

export default ClosedUnclosedAssignments;
