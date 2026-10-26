/** Matches backend RosterDto.RosterInformationDto (JSON shape). */
export interface RosterInformation {
  postID?: string | null;
  requestID?: string | null;
  postParentID?: string | null;
  level?: string | null;
  postTitle?: string | null;
  postDescription?: string | null;
  postLocation?: string | null;
  isSupervisorPost?: boolean;
  payCodeID?: string | null;
  payCodeValue?: string | null;
  callUnit?: string | null;
  postCallSignID?: string | null;
  employeeName?: string | null;
  employeeNumber?: string | null;
  vehicleName?: string | null;
  postPositionID?: string | null;
  postPositionStatus?: number | null;
}

/** Matches backend RosterDto.RosterTableDto */
export interface RosterTable {
  postTitle: string;
  postDescription?: string | null;
  payCodeValue: string | null;
  rows: RosterInformation[];
}

/** Matches backend RosterDto.RosterResponseDto */
export interface RosterResponse {
  requesterName: string | null;
  rosterDate: string;
  tables: RosterTable[];
}
