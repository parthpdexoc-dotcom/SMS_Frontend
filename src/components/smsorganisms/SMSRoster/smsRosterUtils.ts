/**
 * Roster utility functions
 */
import type { SMSRosterItem, SMSGroupedRosterSection } from './smsRosterTypes';
import type { RosterInformation, RosterTable } from '@/types/roster';
export const hasRosterContent = (tables: RosterTable[]): boolean =>
  tables.some((table) => table.rows.length > 0);

export const flattenRosterRows = (tables: RosterTable[]): RosterInformation[] =>
  tables.flatMap((table) => table.rows);

export const findRosterRowByPostPositionId = (
  tables: RosterTable[],
  postPositionID: string
): RosterInformation | undefined =>
  flattenRosterRows(tables).find((row) => (row.postPositionID ?? '').trim() === postPositionID.trim());

const sortLevels = (a: string, b: string): number => {
  const aParts = a.split('-').map(Number);
  const bParts = b.split('-').map(Number);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;
    if (aVal !== bVal) {
      return aVal - bVal;
    }
  }
  return 0;
};

const isChildOf = (childLevel: string, parentLevel: string): boolean => {
  return childLevel.startsWith(parentLevel + '-');
};

const getParentLevel = (level: string): string | null => {
  const parts = level.split('-');
  if (parts.length <= 1) {
    return null;
  }
  return parts.slice(0, -1).join('-');
};

const isDirectChild = (childLevel: string, parentLevel: string): boolean => {
  if (!isChildOf(childLevel, parentLevel)) return false;
  const parentParts = parentLevel.split('-').length;
  const childParts = childLevel.split('-').length;
  return childParts === parentParts + 1;
};

export const groupRosterByLevel = (data: SMSRosterItem[]): SMSGroupedRosterSection[] => {
  if (!data || data.length === 0) {
    return [];
  }

  const unsortedGroups: SMSGroupedRosterSection[] = [];

  const supervisorItems = data.filter((item) => item.isSupervisorPost === true);
  const nonSupervisorItems = data.filter((item) => item.isSupervisorPost !== true);

  if (supervisorItems.length > 0) {
    const sortedSupervisors = [...supervisorItems].sort((a, b) =>
      sortLevels(a.level || '1', b.level || '1')
    );
    const first = sortedSupervisors[0];

    unsortedGroups.push({
      sectionTitle: first.postTitle || 'Supervisor',
      description: (first.postDescription || '').trim() ? first.postDescription : null,
      rows: sortedSupervisors,
    });
  }

  if (nonSupervisorItems.length === 0) {
    return unsortedGroups;
  }

  const levelToItems = new Map<string, SMSRosterItem[]>();
  nonSupervisorItems.forEach((item) => {
    const lvl = item.level || '1';
    if (!levelToItems.has(lvl)) {
      levelToItems.set(lvl, []);
    }
    levelToItems.get(lvl)!.push(item);
  });

  const allLevels = Array.from(levelToItems.keys()).sort(sortLevels);

  const hasChildren = (lvl: string): boolean =>
    allLevels.some((other) => other !== lvl && isChildOf(other, lvl));

  const supervisorLevels = new Set(
    supervisorItems.map((item) => item.level).filter((lvl): lvl is string => lvl != null)
  );

  const sectionRootsSet = new Set<string>();

  supervisorLevels.forEach((supLevel) => {
    const isTopLevelSupervisor = getParentLevel(supLevel) == null;
    if (isTopLevelSupervisor) return;

    const hasNonSuperDescendants = allLevels.some((lvl) => isChildOf(lvl, supLevel));
    if (hasNonSuperDescendants) {
      sectionRootsSet.add(supLevel);
    }
  });

  allLevels.forEach((lvl) => {
    const parent = getParentLevel(lvl);
    if (parent == null) {
      sectionRootsSet.add(lvl);
    } else {
      const parentIsSupervisor = supervisorLevels.has(parent);
      const parentIsRoot = sectionRootsSet.has(parent);

      if (parentIsSupervisor && !parentIsRoot) {
        sectionRootsSet.add(lvl);
      } else if (hasChildren(lvl) && !parentIsRoot) {
        sectionRootsSet.add(lvl);
      }
    }
  });

  const sectionRoots = Array.from(sectionRootsSet).sort(sortLevels);

  sectionRoots.forEach((rootLevel) => {
    const rootItems = levelToItems.get(rootLevel) || [];

    const supervisorRootItems = supervisorItems.filter((item) => item.level === rootLevel);

    const parent = getParentLevel(rootLevel);
    const isTopLevel = parent == null;

    const descendantLevels = allLevels
      .filter((lvl) => {
        if (lvl === rootLevel) return false;
        if (!isChildOf(lvl, rootLevel)) return false;

        if (isTopLevel) {
          return isDirectChild(lvl, rootLevel);
        }

        return true;
      })
      .sort(sortLevels);

    const rows: SMSRosterItem[] = [];

    if (supervisorRootItems.length > 0) {
      rows.push(...supervisorRootItems);
    } else if (rootItems.length > 0) {
      rows.push(...rootItems);
    }

    rows.push(...descendantLevels.flatMap((lvl) => levelToItems.get(lvl) || []));

    rows.sort((a, b) => sortLevels(a.level || '1', b.level || '1'));

    const getSectionMetadata = (): { title: string; description: string | null } => {
      const defaultTitle = `Level ${rootLevel}`;

      if (supervisorRootItems.length > 0) {
        const firstNonSupervisorRow = rows.find((row) => row.isSupervisorPost !== true);
        if (firstNonSupervisorRow) {
          return {
            title: firstNonSupervisorRow.postTitle || defaultTitle,
            description: (firstNonSupervisorRow.postDescription || '').trim()
              ? firstNonSupervisorRow.postDescription
              : null,
          };
        }
        const firstSupervisor = supervisorRootItems[0];
        return {
          title: firstSupervisor.postTitle || defaultTitle,
          description: (firstSupervisor.postDescription || '').trim() ? firstSupervisor.postDescription : null,
        };
      }

      if (rootItems.length > 0) {
        const firstRoot = rootItems[0];
        return {
          title: firstRoot.postTitle || defaultTitle,
          description: (firstRoot.postDescription || '').trim() ? firstRoot.postDescription : null,
        };
      }

      return { title: defaultTitle, description: null };
    };

    const { title: sectionTitle, description: sectionDescription } = getSectionMetadata();

    if (rows.length > 0) {
      unsortedGroups.push({
        sectionTitle,
        description: sectionDescription,
        rows,
      });
    }
  });

  const groups = [...unsortedGroups].sort((a, b) => {
    const levelA = a.rows[0]?.level || '1';
    const levelB = b.rows[0]?.level || '1';
    return sortLevels(levelA, levelB);
  });

  return groups;
};


