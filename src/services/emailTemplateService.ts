/**
 * Email Template API service for CRUD operations
 */
import { apiGet, apiPost, apiPut, apiDelete } from '@/utils/apiClient';
import { expectOkReadText, parseJsonText, parsePagedListJson, readResponseOk } from '@/services/textPlainJson';
import { buildPaginationQueryParams } from '@/utils/paginationUtils';
import { EmailTemplateDto, EmailTypeEnum, EmailTypeOptionDto } from '@/types/emailTemplate';
import { PageParam } from '@/types/common';

const BASE = '/EmailTemplate';

/** Dedupe concurrent GETs only (e.g. React Strict Mode double effect); no session cache so each visit refetches. */
let emailTypesInFlight: Promise<EmailTypeOptionDto[]> | null = null;

async function fetchEmailTypesFromNetwork(): Promise<EmailTypeOptionDto[]> {
  const response = await apiGet(`${BASE}/email-types`);
  const text = await expectOkReadText(response, 'Failed to fetch email types');
  const parsed = parseJsonText<unknown>(text);
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid email types response from server');
  }
  const out: EmailTypeOptionDto[] = [];
  for (const item of parsed) {
    if (item === null || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    const valueRaw = raw.value ?? raw.Value;
    const labelRaw =
      raw.label ??
      raw.Label ??
      raw.displayName ??
      raw.DisplayName ??
      raw.name ??
      raw.Name ??
      '';
    const value = Number(valueRaw);
    const label = String(labelRaw ?? '').trim();
    if (Number.isNaN(value) || label.length === 0) continue;
    out.push({ value, label });
  }
  return out;
}

/** Paged list GET /EmailTemplate. */
export const getEmailTemplates = async (
  pagination?: PageParam
): Promise<{ data: EmailTemplateDto[]; totalRecords: number }> => {
  const queryParams = buildPaginationQueryParams(pagination);
  const queryString = queryParams.toString();
  const endpoint = queryString ? `${BASE}?${queryString}` : BASE;
  const response = await apiGet(endpoint);
  const text = await expectOkReadText(response, 'Failed to fetch email templates');
  return parsePagedListJson(text, (raw) => normalizeDto(raw as Record<string, unknown>));
};

/** Search email templates GET /EmailTemplate/search */
export const searchEmailTemplates = async (
  pagination?: PageParam & { searchTerm?: string }
): Promise<{ data: EmailTemplateDto[]; totalRecords: number }> => {
  const queryParams = buildPaginationQueryParams(pagination);
  const searchTerm = pagination?.searchTerm?.trim();
  if (searchTerm) {
    queryParams.append('searchTerm', searchTerm);
  }
  const queryString = queryParams.toString();
  const endpoint = `/EmailTemplate/search${queryString ? `?${queryString}` : ''}`;
  const response = await apiGet(endpoint);
  const text = await expectOkReadText(response, 'Failed to search email templates');
  return parsePagedListJson(text, (raw) => normalizeDto(raw as Record<string, unknown>));
};

/**
 * Get a single email template by ID
 */
export const getEmailTemplateById = async (id: string): Promise<EmailTemplateDto | null> => {
  const response = await apiGet(`${BASE}/${id}`);
  if (response.status === 404) return null;
  const text = await expectOkReadText(response, 'Failed to fetch email template');
  return normalizeDto(parseJsonText<Record<string, unknown>>(text));
};

/**
 * GET /EmailTemplate/email-types — value + display label in enum order.
 * Callers that run at the same time share one HTTP request (Strict Mode safe).
 * Each new page visit starts a fresh request (no cross-visit cache).
 */
export const getEmailTypes = async (): Promise<EmailTypeOptionDto[]> => {
  if (!emailTypesInFlight) {
    emailTypesInFlight = fetchEmailTypesFromNetwork().finally(() => {
      emailTypesInFlight = null;
    });
  }
  return emailTypesInFlight;
};

/** GET /EmailTemplate/keywords?emailType= — placeholders for the rich text editor by template type */
export const getKeywordsByEmailType = async (
  emailType: EmailTypeEnum,
  options?: { signal?: AbortSignal }
): Promise<string[]> => {
  const params = new URLSearchParams({ emailType: String(emailType) });
  const response = await apiGet(`${BASE}/keywords?${params.toString()}`, {
    signal: options?.signal,
  });
  const text = await expectOkReadText(response, 'Failed to fetch email template keywords');
  const parsed = parseJsonText<unknown>(text);
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid keywords response from server');
  }
  return parsed.map((item) => String(item ?? '').trim()).filter((s) => s.length > 0);
};

/**
 * Normalize API response: API uses emailTemplateId, title, subject, content.
 * We use emailTemplateID, name, subject, body internally.
 */
function normalizeDto(raw: Record<string, unknown>): EmailTemplateDto {
  const id = raw.emailTemplateId ?? raw.emailTemplateID ?? raw.EmailTemplateId ?? raw.EmailTemplateID ?? '';
  const emailTypeRaw = raw.emailType ?? raw.EmailType;
  const emailType =
    emailTypeRaw !== undefined && emailTypeRaw !== null
      ? (Number(emailTypeRaw) as EmailTypeEnum)
      : undefined;
  const smsBodyRaw =
    raw.smsBody ??
    raw.SmsBody ??
    raw.smsContent ??
    raw.SmsContent ??
    raw.smsText ??
    raw.SmsText;
  const smsBody = smsBodyRaw !== undefined && smsBodyRaw !== null ? String(smsBodyRaw) : undefined;
  return {
    emailTemplateID: String(id),
    name: String(raw.title ?? raw.name ?? ''),
    subject: String(raw.subject ?? ''),
    body: String(raw.content ?? raw.body ?? ''),
    ...(smsBody !== undefined ? { smsBody } : {}),
    ...(emailType !== undefined && !Number.isNaN(emailType) ? { emailType } : {}),
  };
}

/** Convert our DTO to API payload (API expects emailTemplateId, title, subject, content, emailType, smsBody) */
function toApiPayload(dto: EmailTemplateDto): Record<string, unknown> {
  const trimmedSms = dto.smsBody !== undefined ? dto.smsBody.trim() : '';
  return {
    emailTemplateId: dto.emailTemplateID || '00000000-0000-0000-0000-000000000000',
    title: dto.name,
    subject: dto.subject,
    content: dto.body,
    smsBody: trimmedSms,
    smsContent: trimmedSms,
    emailType: dto.emailType,
  };
}

/**
 * Create a new email template (POST)
 */
export const createEmailTemplate = async (
  dto: Omit<EmailTemplateDto, 'emailTemplateID'> & { emailTemplateID?: string }
): Promise<EmailTemplateDto> => {
  const payload = toApiPayload({
    ...dto,
    emailTemplateID: dto.emailTemplateID ?? '',
  });
  const response = await apiPost(BASE, payload);
  const text = await readResponseOk(response, 'Failed to create email template');
  return normalizeDto(parseJsonText<Record<string, unknown>>(text));
};

/**
 * Update an existing email template (PUT)
 */
export const updateEmailTemplate = async (
  id: string,
  dto: EmailTemplateDto
): Promise<EmailTemplateDto> => {
  const payload = toApiPayload({ ...dto, emailTemplateID: id });
  const response = await apiPut(`${BASE}/${id}`, payload);
  const text = await readResponseOk(response, 'Failed to update email template');
  return normalizeDto(parseJsonText<Record<string, unknown>>(text));
};

/**
 * Delete an email template
 */
export const deleteEmailTemplate = async (id: string): Promise<void> => {
  const response = await apiDelete(`${BASE}/${id}`);
  if (response.status === 404) {
    throw new Error('Email template not found.');
  }
  await readResponseOk(response, 'Failed to delete email template');
};
