import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getAdminById, patchAdminProfile } from '@/services/adminService';
import type { AdminProfileDto } from '@/types/admin';
import type { JsonPatchReplaceOperation } from '@/types/employee';
import { logout } from '@/store/slices/authSlice';

const strEq = (a: string | null | undefined, b: string | null | undefined): boolean =>
  (a ?? '').trim() === (b ?? '').trim();

export const fetchAdminProfile = createAsyncThunk(
  'adminProfile/fetch',
  async (adminId: string, { rejectWithValue }) => {
    try {
      return await getAdminById(adminId);
    } catch (e) {
      return rejectWithValue(e instanceof Error ? e.message : 'Failed to load admin profile');
    }
  }
);

function buildSelfEditPatch(
  original: AdminProfileDto,
  draft: { firstName: string; lastName: string; userName: string; password?: string }
): JsonPatchReplaceOperation[] {
  const ops: JsonPatchReplaceOperation[] = [];
  if (!strEq(original.firstName, draft.firstName)) {
    ops.push({
      op: 'replace',
      path: '/firstName',
      value: draft.firstName.trim() || null,
    });
  }
  if (!strEq(original.lastName, draft.lastName)) {
    ops.push({
      op: 'replace',
      path: '/lastName',
      value: draft.lastName.trim() || null,
    });
  }
  if (!strEq(original.userName, draft.userName)) {
    ops.push({
      op: 'replace',
      path: '/userName',
      value: draft.userName.trim(),
    });
  }
  const newPassword = draft.password?.trim() ?? '';
  if (newPassword.length > 0) {
    ops.push({
      op: 'replace',
      path: '/password',
      value: newPassword,
    });
  }
  return ops;
}

export const saveAdminProfileSelfEdit = createAsyncThunk(
  'adminProfile/save',
  async (
    {
      adminId,
      original,
      draft,
    }: {
      adminId: string;
      original: AdminProfileDto;
      draft: { firstName: string; lastName: string; userName: string; password?: string };
    },
    { rejectWithValue }
  ) => {
    try {
      const patchDoc = buildSelfEditPatch(original, draft);
      if (patchDoc.length === 0) {
        return original;
      }
      return await patchAdminProfile(adminId, patchDoc);
    } catch (e) {
      return rejectWithValue(e instanceof Error ? e.message : 'Failed to save admin profile');
    }
  }
);

interface AdminProfileState {
  admin: AdminProfileDto | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

const initialState: AdminProfileState = {
  admin: null,
  isLoading: false,
  isSaving: false,
  error: null,
};

const adminProfileSlice = createSlice({
  name: 'adminProfile',
  initialState,
  reducers: {
    clearAdminProfile: () => ({ ...initialState }),
    clearAdminProfileError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout.fulfilled, () => ({ ...initialState }))
      .addCase(fetchAdminProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAdminProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.admin = action.payload;
        state.error = null;
      })
      .addCase(fetchAdminProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.admin = null;
        state.error = (action.payload as string) || 'Failed to load admin profile';
      })
      .addCase(saveAdminProfileSelfEdit.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(saveAdminProfileSelfEdit.fulfilled, (state, action) => {
        state.isSaving = false;
        state.admin = action.payload;
        state.error = null;
      })
      .addCase(saveAdminProfileSelfEdit.rejected, (state, action) => {
        state.isSaving = false;
        state.error = (action.payload as string) || 'Failed to save admin profile';
      });
  },
});

export const { clearAdminProfile, clearAdminProfileError } = adminProfileSlice.actions;
export default adminProfileSlice.reducer;
