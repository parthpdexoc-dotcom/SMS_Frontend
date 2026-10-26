import { EMPLOYEE_LOCATION } from '@/constants/strings';
import type { RequestInRequesterListDto } from '@/types/request';
import type {
  EmployeePostLocation,
  PostPositionEmployeeLocationDto,
  RequestWithLocationsDto,
} from '@/types/employeePostLocation';

export const LOCATION_EMPTY = '—';

export interface LocationEmployee {
  key: string;
  employeeId: string;
  name: string;
  badge: string;
  callSign: string;
  requestId: string;
  postId: string;
  postPositionId: string;
  points: EmployeePostLocation[];
}

export interface LocationPostGroup {
  postId: string;
  postTitle: string;
  postLocation: string;
  postStartTime: string;
  postEndTime: string;
  employees: LocationEmployee[];
}

export interface LocationRequestGroup {
  requestId: string;
  requestName: string;
  projectNumber: string;
  startDate: string;
  endDate: string;
  releaseStatus: string;
  requestType: RequestInRequesterListDto['requestType'];
  requestSchedules: RequestInRequesterListDto['requestSchedules'];
  postCount: number;
  posts: LocationPostGroup[];
}

export type MapEmployee = LocationEmployee & {
  moving: boolean;
  /** Set on Master Map pins so the shared marker can show the requester name. */
  requesterName?: string;
};

const NEAR_DEG = 0.00045;
const OFFSET_DEG = 0.00038;

export type PlotCluster = {
  point: { latitude: number; longitude: number };
  employees: MapEmployee[];
  labelLeft?: boolean;
};

export function latestPoint(points: EmployeePostLocation[]): EmployeePostLocation | null {
  let latest: EmployeePostLocation | null = null;
  for (const point of points) {
    if (!latest || point.capturedAt > latest.capturedAt) latest = point;
  }
  return latest;
}

const MOVE_EPSILON = 1e-5;

export function locationMoved(
  prev: EmployeePostLocation | null,
  next: EmployeePostLocation | null
): boolean {
  return (
    !!prev &&
    !!next &&
    (Math.abs(prev.latitude - next.latitude) > MOVE_EPSILON ||
      Math.abs(prev.longitude - next.longitude) > MOVE_EPSILON)
  );
}

export function isEnroute(points: EmployeePostLocation[]): boolean {
  if (points.length < 2) return false;
  const sorted = [...points].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  return locationMoved(sorted[sorted.length - 2], sorted[sorted.length - 1]);
}

export function toLocationPoints(
  rows: Array<{ latitude?: number; longitude?: number; capturedAt?: string }> | null | undefined
): EmployeePostLocation[] {
  if (!rows?.length) return [];
  return rows.flatMap((row) => {
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return [];
    if (Math.abs(latitude) < 1e-6 && Math.abs(longitude) < 1e-6) return [];
    return [{ latitude, longitude, capturedAt: String(row.capturedAt ?? '') }];
  });
}

function toLocationEmployee(
  position: PostPositionEmployeeLocationDto,
  postId: string,
  requestId: string
): LocationEmployee | null {
  if (position.isPlaceholder) return null;
  const employeeId = String(position.employeeId ?? '').trim();
  const name = position.employeeName?.trim() || position.badgeNumber?.trim() || employeeId;
  if (!employeeId) return null;
  const postPositionId = position.postPositionId?.trim() || `${postId}-${employeeId}`;
  const badge = position.badgeNumber?.trim() || LOCATION_EMPTY;
  return {
    key: postPositionId,
    employeeId,
    name,
    badge,
    callSign: position.callSign?.trim() || badge,
    requestId,
    postId,
    postPositionId,
    points: toLocationPoints(position.employeePostLocations),
  };
}

function employeesFromPositions(
  rows: PostPositionEmployeeLocationDto[] | null | undefined,
  postId: string,
  requestId: string
): LocationEmployee[] {
  return (rows ?? []).flatMap((position) => {
    const employee = toLocationEmployee(position, postId, requestId);
    return employee ? [employee] : [];
  });
}

function mergeByEmployeeId(employees: LocationEmployee[]): LocationEmployee[] {
  const byId = new Map<string, LocationEmployee>();
  for (const employee of employees) {
    const existing = byId.get(employee.employeeId);
    if (!existing) {
      byId.set(employee.employeeId, { ...employee, points: [...employee.points] });
      continue;
    }
    existing.points.push(...employee.points);
  }
  return Array.from(byId.values());
}

function matches(query: string, ...values: string[]): boolean {
  return values.some((value) => value.toLowerCase().includes(query));
}

function matchesEmployee(employee: LocationEmployee, query: string): boolean {
  return matches(query, employee.name, employee.badge, employee.callSign);
}

function matchesPostFields(post: LocationPostGroup, query: string): boolean {
  return matches(query, post.postTitle, post.postLocation);
}

function matchesRequestFields(request: LocationRequestGroup, query: string): boolean {
  return matches(query, request.requestName, request.projectNumber, request.requestId, request.releaseStatus);
}

export function isSameSeat(
  employee: Pick<LocationEmployee, 'employeeId' | 'postPositionId'>,
  employeeId: string | null,
  postPositionId: string | null
): boolean {
  return (
    !!employeeId &&
    !!postPositionId &&
    employee.employeeId === employeeId &&
    employee.postPositionId === postPositionId
  );
}

export function filterLocationRequests(
  requests: LocationRequestGroup[],
  query: string
): LocationRequestGroup[] {
  if (!query) return requests;
  return requests.flatMap((request) => {
    const requestHit = matchesRequestFields(request, query);
    const posts = request.posts.flatMap((post) => {
      const employees = post.employees.filter((employee) => matchesEmployee(employee, query));
      if (requestHit || matchesPostFields(post, query)) return [post];
      return employees.length > 0 ? [{ ...post, employees }] : [];
    });
    return requestHit || posts.length > 0 ? [{ ...request, posts }] : [];
  });
}

export function isPostExpanded(
  post: LocationPostGroup,
  query: string,
  openPostIds: string[]
): boolean {
  return (
    openPostIds.includes(post.postId) ||
    (!!query &&
      (matchesPostFields(post, query) ||
        post.employees.some((employee) => matchesEmployee(employee, query))))
  );
}

export function withMoving(
  employees: LocationEmployee[],
  movingByEmployeeId: Record<string, boolean>
): MapEmployee[] {
  return employees.map((employee) => ({
    ...employee,
    moving: !!movingByEmployeeId[employee.employeeId],
  }));
}

export function movementByEmployeeId(
  prevEmployees: LocationEmployee[],
  nextEmployees: LocationEmployee[],
  force: boolean
): Record<string, boolean> {
  const prevById = new Map(prevEmployees.map((employee) => [employee.employeeId, employee]));
  const moving: Record<string, boolean> = {};
  for (const employee of nextEmployees) {
    const prev = prevById.get(employee.employeeId);
    moving[employee.employeeId] = force
      ? locationMoved(latestPoint(prev?.points ?? []), latestPoint(employee.points))
      : isEnroute(employee.points);
  }
  return moving;
}

export function beginPoll(tick: () => void): () => void {
  const timer = window.setInterval(tick, 60_000);
  return () => window.clearInterval(timer);
}

export function employeePinLabel(employee: MapEmployee): string {
  const badge = employee.badge.trim();
  const name = !badge || badge === LOCATION_EMPTY ? employee.name : `${badge} - ${employee.name}`;
  return employee.moving ? `${name} ${EMPLOYEE_LOCATION.ENROUTE_STATUS}` : name;
}

export function requesterPinTitles(employees: MapEmployee[]): string[] {
  const names = new Set<string>();
  for (const employee of employees) {
    const name = employee.requesterName?.trim();
    if (name) names.add(name);
  }
  return Array.from(names);
}

export function overlayPostEmployees(
  requests: LocationRequestGroup[],
  postId: string | null,
  loadedPostId: string | null,
  postEmployees: LocationEmployee[]
): LocationRequestGroup[] {
  if (!postId || loadedPostId !== postId) return requests;
  return requests.map((request) => ({
    ...request,
    posts: request.posts.map((post) =>
      post.postId === postId ? { ...post, employees: postEmployees } : post
    ),
  }));
}

export function locationCounts(requests: LocationRequestGroup[]) {
  const employeeIds = new Set<string>();
  let posts = 0;
  for (const request of requests) {
    posts += request.postCount ?? request.posts.length;
    for (const post of request.posts) {
      for (const employee of post.employees) employeeIds.add(employee.employeeId);
    }
  }
  return { requests: requests.length, posts, employees: employeeIds.size };
}

export function plotClusters(employees: MapEmployee[]): PlotCluster[] {
  const groups = new Map<string, PlotCluster>();
  for (const employee of employees) {
    const point = latestPoint(employee.points);
    if (!point) continue;
    const key = `${point.latitude.toFixed(6)}:${point.longitude.toFixed(6)}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        point: { latitude: point.latitude, longitude: point.longitude },
        employees: [employee],
      });
      continue;
    }
    if (!existing.employees.some((item) => item.employeeId === employee.employeeId)) {
      existing.employees.push(employee);
    }
  }

  const clusters = Array.from(groups.values());
  if (clusters.length < 2) return clusters;

  const next = clusters.map((cluster) => ({ ...cluster, point: { ...cluster.point } }));
  const used = new Array(next.length).fill(false);

  for (let i = 0; i < next.length; i += 1) {
    if (used[i]) continue;
    const group = [i];
    used[i] = true;
    for (let j = i + 1; j < next.length; j += 1) {
      if (
        used[j] ||
        Math.abs(next[i].point.latitude - next[j].point.latitude) >= NEAR_DEG ||
        Math.abs(next[i].point.longitude - next[j].point.longitude) >= NEAR_DEG
      ) {
        continue;
      }
      group.push(j);
      used[j] = true;
    }
    if (group.length < 2) continue;

    const origin = {
      latitude: group.reduce((sum, idx) => sum + clusters[idx].point.latitude, 0) / group.length,
      longitude: group.reduce((sum, idx) => sum + clusters[idx].point.longitude, 0) / group.length,
    };
    const cosLat = Math.max(Math.cos((origin.latitude * Math.PI) / 180), 0.2);
    group.forEach((idx, offset) => {
      const angle = (2 * Math.PI * offset) / group.length - Math.PI / 2;
      next[idx] = {
        ...next[idx],
        labelLeft: offset % 2 === 1,
        point: {
          latitude: origin.latitude + OFFSET_DEG * Math.cos(angle),
          longitude: origin.longitude + (OFFSET_DEG * Math.sin(angle)) / cosLat,
        },
      };
    });
  }

  return next;
}

function text(value: string | null | undefined, fallback = LOCATION_EMPTY): string {
  return value?.trim() || fallback;
}

/** Nested request → post → employee tree from with-locations API. */
export function treeFromLocationRequests(
  requests: RequestWithLocationsDto[]
): LocationRequestGroup[] {
  return (requests ?? []).flatMap((request) => {
    const requestId = String(request.requestId ?? '').trim();
    if (!requestId) return [];
    const posts = (request.posts ?? []).flatMap((post) => {
      const postId = String(post.postId ?? '').trim();
      if (!postId) return [];
      return [{
        postId,
        postTitle: text(post.postTitle),
        postLocation: text(post.postLocation),
        postStartTime: text(post.postStartTime, ''),
        postEndTime: text(post.postEndTime, ''),
        employees: employeesFromPositions(post.postPositions, postId, requestId),
      }];
    });

    return [
      {
        requestId,
        requestName: text(request.name?.trim() || request.projectNumber),
        projectNumber: text(request.projectNumber),
        startDate: String(request.startDate ?? ''),
        endDate: String(request.endDate ?? ''),
        releaseStatus: String(request.releaseStatus ?? ''),
        requestType: (request.requestType ?? null) as RequestInRequesterListDto['requestType'],
        requestSchedules: (request.requestSchedules ??
          []) as RequestInRequesterListDto['requestSchedules'],
        postCount: request.postCount ?? posts.length,
        posts,
      },
    ];
  });
}

export function mapEmployeesFromTree(requests: LocationRequestGroup[]): LocationEmployee[] {
  return mergeByEmployeeId(requests.flatMap((request) => request.posts.flatMap((post) => post.employees)));
}

export function employeesFromPostLocations(
  rows: PostPositionEmployeeLocationDto[] | null | undefined,
  postId: string,
  requestId: string
): LocationEmployee[] {
  return mergeByEmployeeId(employeesFromPositions(rows, postId, requestId));
}

export function toRequestCardDto(request: LocationRequestGroup): RequestInRequesterListDto {
  return {
    requestId: request.requestId,
    startDate: request.startDate,
    endDate: request.endDate,
    name: request.requestName,
    projectNumber: request.projectNumber === LOCATION_EMPTY ? null : request.projectNumber,
    requestType: request.requestType,
    releaseStatus: request.releaseStatus,
    requestSchedules: request.requestSchedules,
    postCount: request.postCount,
  };
}
