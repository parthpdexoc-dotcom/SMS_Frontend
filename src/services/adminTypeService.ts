// /**
//  * AdminType API Service
//  * Handles all API calls related to Admin Type
//  */

// import { apiDelete, apiGetAll, apiPost } from '@/utils/apiClient';
// import {
//   AdminTypePaginationParams,
//   AdminTypeResponse,
// } from '@/types/adminType';
// import { expectOkReadText, parseJsonText, parsePagedListJson, readResponseOk } from '@/services/textPlainJson';
// import { normalizeAdminType } from '@/utils/normalizers';
// import { coalesceKeyedRequest } from '@/utils/coalesceKeyedRequest';

// export const getAdminTypes = async (
//   pagination?: AdminTypePaginationParams,
//   isActive?: boolean
// ): Promise<{ data: AdminTypeResponse[]; totalRecords: number }> => {
//   const defaultPagination = { ...pagination };
//   if (isActive !== undefined) {
//     defaultPagination.isActive = isActive;
//   }
//   const key = JSON.stringify(defaultPagination ?? {});
//   return coalesceKeyedRequest('getAdminTypes', key, async () => {
//     try {
//       const response = await apiGetAll('/AdminType', defaultPagination);
//       const responseText = await expectOkReadText(response, 'Failed to fetch admin types');
//       return parsePagedListJson(responseText, (row) => normalizeAdminType(row));
//     } catch (error) {
//       console.error('Error fetching admin types:', error);
//       throw error;
//     }
//   });
// };

// export const createAdminType = async (
//   payload: Record<string, unknown>
// ): Promise<AdminTypeResponse> => {
//   try {
//     const response = await apiPost('/AdminType', payload, {
//       headers: {
//         'Content-Type': 'application/json',
//       },
//     });

//     const responseText = await readResponseOk(response, 'Failed to create admin type');
//     return normalizeAdminType(parseJsonText<Record<string, unknown>>(responseText));
//   } catch (error) {
//     console.error('Error creating admin type:', error);
//     throw error;
//   }
// };

// export const updateAdminType = async (
//   payload: Record<string, unknown>
// ): Promise<AdminTypeResponse> => {
//   try {
//     const response = await apiPost('/AdminType', payload, {
//       headers: {
//         'Content-Type': 'application/json',
//       },
//     });

//     const responseText = await readResponseOk(response, 'Failed to update admin type');
//     return normalizeAdminType(parseJsonText<Record<string, unknown>>(responseText));
//   } catch (error) {
//     console.error('Error updating admin type:', error);
//     throw error;
//   }
// };

// export const deleteAdminType = async (adminTypeID: string): Promise<void> => {
//   try {
//     const response = await apiDelete(`/AdminType/${adminTypeID}`, {
//       headers: {
//         accept: '*/*',
//       },
//     });
//     await readResponseOk(response, 'Failed to delete admin type');
//   } catch (error) {
//     console.error('Error deleting admin type:', error);
//     throw error;
//   }
// };


