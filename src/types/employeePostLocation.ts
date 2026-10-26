/** Coordinate reading from GET `/EmployeePostLocation/by-employee/{employeeId}?postPositionId=`. */
export interface EmployeePostLocation {
  latitude: number;
  longitude: number;
  capturedAt: string;
}

/** Nested location from POST `/Request/requester-requests-with-locations`. */
export interface PostPositionWithLocationsDto {
  postPositionId: string;
  employeeId?: string | null;
  employeeName?: string | null;
  badgeNumber?: string | null;
  callSign?: string | null;
  isPlaceholder?: boolean;
  employeePostLocations?: EmployeePostLocation[] | null;
}

export interface PostWithLocationsDto {
  postId: string;
  postTitle: string;
  postStartTime?: string | null;
  postEndTime?: string | null;
  postLocation?: string | null;
  postPositions?: PostPositionWithLocationsDto[] | null;
}

export interface RequestWithLocationsDto {
  requestId: string;
  startDate?: string;
  endDate?: string;
  name?: string | null;
  projectNumber?: string | null;
  requestType?: unknown;
  releaseStatus?: string;
  requestSchedules?: unknown[];
  postCount?: number;
  posts?: PostWithLocationsDto[] | null;
}

/** Row from GET `/Post/post-employees-with-locations?postId=`. */
export type PostPositionEmployeeLocationDto = PostPositionWithLocationsDto;
