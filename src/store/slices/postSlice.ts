import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Post, PostFilter } from '@/types/post';
import type { PostCallSign } from '@/types/postCallSign';
import {
    getPosts,
    upsertPost,
    getPostById,
    deletePost,
    clonePost,
} from '@/services/postService';
import { showToast } from './toastSlice';

/** 409 body when decreasing TotalPostPositions requires selecting call signs to hard-delete. */
export type PostDecreasePositionsConflictDto = {
    message: string;
    requiresHardDeletePostCallSign: true;
    callSigns: PostCallSign[];
};

export type PostDecreasePositionsConflictError = PostDecreasePositionsConflictDto & {
    status: 409;
};

export function isPostDecreasePositionsConflict(
    error: unknown
): error is PostDecreasePositionsConflictError {
    if (!error || typeof error !== 'object') return false;
    const err = error as Partial<PostDecreasePositionsConflictError>;
    return err.status === 409 && err.requiresHardDeletePostCallSign === true;
}

export type FetchPostByIdArg = { postId: string; silent?: boolean };

export interface PostState {
    postsByRequestId: Record<string, Post[]>;
    totalRecordsByRequestId: Record<string, number>;
    loadingByRequestId: Record<string, boolean>;
    errorsByRequestId: Record<string, string | null>;
    /** Single post loaded by GET /Post/{postId} (e.g. post form edit/view). */
    currentPostById: Record<string, Post | null>;
    currentPostLoadingById: Record<string, boolean>;
    // Keep legacy fields for backward compatibility if needed, but we'll focus on the map
    posts: Post[];
    loading: boolean;
    error: string | null;
}

const initialState: PostState = {
    postsByRequestId: {},
    totalRecordsByRequestId: {},
    loadingByRequestId: {},
    errorsByRequestId: {},
    currentPostById: {},
    currentPostLoadingById: {},
    posts: [],
    loading: false,
    error: null,
};

export const fetchPosts = createAsyncThunk(
    'post/fetchPosts',
    async (filters: PostFilter | undefined, { rejectWithValue, dispatch }) => {
        try {
            // Enforce default sorting to prevent 500 errors from backend
            const effectiveFilters: PostFilter = {
                ...filters
            };
            const response = await getPosts(effectiveFilters);
            return { requestID: filters?.requestID || 'all', data: response.data, totalRecords: response.totalRecords };
        } catch (error: any) {
            const errorMessage = error?.message || 'Failed to fetch posts';
            dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue({
                requestID: filters?.requestID || 'all',
                error: errorMessage
            });
        }
    },
    {
        condition: (filters, { getState }) => {
            const { post } = getState() as { post: PostState };
            const requestID = filters?.requestID || 'all';
            if (post.loadingByRequestId[requestID]) {
                return false;
            }
        }
    }
);

export type SavePostArg =
    | Post
    | {
          post: Post;
          silent?: boolean;
          confirmScheduleChanges?: boolean;
          confirmHardDeletePostCallSign?: boolean;
          hardDeletePostCallSignIDs?: string[];
      };

function normalizeSavePostArg(arg: SavePostArg): {
    post: Post;
    silent: boolean;
    confirmScheduleChanges?: boolean;
    confirmHardDeletePostCallSign?: boolean;
    hardDeletePostCallSignIDs?: string[];
} {
    if (arg && typeof arg === 'object' && 'post' in arg && (arg as { post?: Post }).post != null) {
        const opt = arg as {
            post: Post;
            silent?: boolean;
            confirmScheduleChanges?: boolean;
            confirmHardDeletePostCallSign?: boolean;
            hardDeletePostCallSignIDs?: string[];
        };
        return {
            post: opt.post,
            silent: opt.silent === true,
            confirmScheduleChanges: opt.confirmScheduleChanges,
            confirmHardDeletePostCallSign: opt.confirmHardDeletePostCallSign,
            hardDeletePostCallSignIDs: opt.hardDeletePostCallSignIDs,
        };
    }
    return {
        post: arg as Post,
        silent: false,
        confirmScheduleChanges: undefined,
        confirmHardDeletePostCallSign: undefined,
        hardDeletePostCallSignIDs: undefined,
    };
}

export const savePost = createAsyncThunk(
    'post/savePost',
    async (arg: SavePostArg, { rejectWithValue, dispatch }) => {
        const {
            post,
            silent,
            confirmScheduleChanges,
            confirmHardDeletePostCallSign,
            hardDeletePostCallSignIDs,
        } = normalizeSavePostArg(arg);
        try {
            const data = await upsertPost({
                ...post,
                ...(typeof confirmScheduleChanges === 'boolean'
                    ? { confirmScheduleChanges }
                    : {}),
                ...(confirmHardDeletePostCallSign === true
                    ? { confirmHardDeletePostCallSign: true }
                    : {}),
                ...(hardDeletePostCallSignIDs && hardDeletePostCallSignIDs.length > 0
                    ? { hardDeletePostCallSignIDs }
                    : {}),
            });
            if (!silent && data?.hasAssignmentWarning !== true) {
                const isUpdate = Boolean(post.postId);
                dispatch(showToast(isUpdate ? 'Job updated successfully' : 'Job created successfully', 'success'));
            }
            return data;
        } catch (error: unknown) {
            if (isPostDecreasePositionsConflict(error)) {
                return rejectWithValue(error);
            }
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : (error as { message?: string })?.message || 'Failed to save post';
            dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue(errorMessage);
        }
    }
);

export const fetchPostById = createAsyncThunk(
    'post/fetchPostById',
    async ({ postId, silent = false }: FetchPostByIdArg, { rejectWithValue, dispatch }) => {
        try {
            const data = await getPostById(postId);
            return data;
        } catch (error: any) {
            const errorMessage = error?.message || 'Failed to fetch post';
            if (!silent) {
                dispatch(showToast(errorMessage, 'error'));
            }
            return rejectWithValue(errorMessage);
        }
    }
);

export const deletePostThunk = createAsyncThunk(
    'post/deletePost',
    async (postId: string, { rejectWithValue, dispatch }) => {
        try {
            await deletePost(postId);
            dispatch(showToast('Job deleted successfully', 'success'));
            return postId;
        } catch (error: any) {
            const errorMessage = error?.message || 'Failed to delete job';
            dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue(errorMessage);
        }
    }
);

export const clonePostThunk = createAsyncThunk(
    'post/clonePost',
    async (postId: string, { rejectWithValue, dispatch }) => {
        try {
            const data = await clonePost(postId);
            dispatch(showToast('Job cloned successfully', 'success'));
            return data;
        } catch (error: any) {
            const errorMessage = error?.message || 'Failed to clone job';
            dispatch(showToast(errorMessage, 'error'));
            return rejectWithValue(errorMessage);
        }
    }
);

const postSlice = createSlice({
    name: 'post',
    initialState,
    reducers: {
        clearPosts: (state, action: PayloadAction<string | undefined>) => {
            if (action.payload) {
                delete state.postsByRequestId[action.payload];
            } else {
                state.postsByRequestId = {};
                state.posts = [];
            }
        },
        clearError: (state, action: PayloadAction<string | undefined>) => {
            if (action.payload) {
                state.errorsByRequestId[action.payload] = null;
            } else {
                state.error = null;
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchPosts.pending, (state, action) => {
                const requestID = action.meta.arg?.requestID || 'all';
                state.loadingByRequestId[requestID] = true;
                state.errorsByRequestId[requestID] = null;
                state.loading = true;
            })
            .addCase(fetchPosts.fulfilled, (state, action) => {
                const { requestID, data, totalRecords } = action.payload;
                // Ensure we always store an array (API may return array or single object)
                const dataArray = Array.isArray(data) ? data : data != null ? [data] : [];

                // Sort posts by time (date removed from Post)
                const sortedData = [...dataArray].sort((a, b) => {
                    // Sort by Time (Ascending)
                    const timeA = a.postStartTime || '';
                    const timeB = b.postStartTime || '';
                    return timeA.localeCompare(timeB);
                });

                state.loadingByRequestId[requestID] = false;
                state.postsByRequestId[requestID] = sortedData;
                state.totalRecordsByRequestId[requestID] = totalRecords;
                state.loading = false;
                state.posts = sortedData; // Keep legacy field updated
            })
            .addCase(fetchPosts.rejected, (state, action) => {
                const payload = action.payload as any;
                const requestID = payload?.requestID || action.meta.arg?.requestID || 'all';
                state.loadingByRequestId[requestID] = false;
                state.errorsByRequestId[requestID] = payload?.error || 'Failed to fetch posts';
                state.loading = false;
                state.error = payload?.error || 'Failed to fetch posts';
            })
            .addCase(savePost.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(savePost.fulfilled, (state, action: PayloadAction<Post>) => {
                state.loading = false;
                const post = action.payload;
                const requestID = post.requestID;

                // Update in map
                if (state.postsByRequestId[requestID as string]) {
                    const index = state.postsByRequestId[requestID as string].findIndex((p: Post) => p.postId === post.postId);
                    if (index !== -1) {
                        state.postsByRequestId[requestID as string][index] = post;
                    } else {
                        state.postsByRequestId[requestID as string].push(post);
                    }
                }

                // Update legacy array
                const index = state.posts.findIndex((p) => p.postId === post.postId);
                if (index !== -1) {
                    state.posts[index] = post;
                } else {
                    state.posts.push(post);
                }
            })
            .addCase(savePost.rejected, (state, action) => {
                state.loading = false;
                if (isPostDecreasePositionsConflict(action.payload)) {
                    state.error = null;
                    return;
                }
                state.error =
                    typeof action.payload === 'string' ? action.payload : 'Failed to save post';
            })
            .addCase(fetchPostById.pending, (state, action) => {
                const { postId } = action.meta.arg;
                state.currentPostLoadingById[postId] = true;
                state.error = null;
            })
            .addCase(fetchPostById.fulfilled, (state, action) => {
                const post = action.payload;
                const { postId: argPostId } = action.meta.arg;
                const postId = post.postId ?? argPostId;
                if (postId) {
                    state.currentPostById[postId] = post;
                    state.currentPostLoadingById[postId] = false;
                }
                const requestID = post.requestID;
                if (requestID) {
                    const list = state.postsByRequestId[requestID];
                    if (list) {
                        const index = list.findIndex((p) => p.postId === post.postId);
                        if (index !== -1) {
                            list[index] = post;
                        }
                    }
                }
            })
            .addCase(fetchPostById.rejected, (state, action) => {
                const { postId } = action.meta.arg;
                state.currentPostLoadingById[postId] = false;
                state.currentPostById[postId] = null;
                state.error = action.payload as string;
            })
            .addCase(deletePostThunk.fulfilled, (state, action) => {
                const deletedId = action.payload;
                // Remove from legacy posts array
                state.posts = state.posts.filter(p => p.postId !== deletedId);
                // Remove from postsByRequestId maps
                Object.keys(state.postsByRequestId).forEach((requestID) => {
                    state.postsByRequestId[requestID] = state.postsByRequestId[requestID].filter(p => p.postId !== deletedId);
                });
            })
            .addCase(clonePostThunk.fulfilled, (state, action: PayloadAction<Post>) => {
                const post = action.payload;
                const requestID = post.requestID;
                if (requestID && state.postsByRequestId[requestID]) {
                    const exists = state.postsByRequestId[requestID].some((p) => p.postId === post.postId);
                    if (!exists) {
                        state.postsByRequestId[requestID].push(post);
                        state.totalRecordsByRequestId[requestID] = (state.totalRecordsByRequestId[requestID] ?? 0) + 1;
                    }
                }

                const existsInLegacy = state.posts.some((p) => p.postId === post.postId);
                if (!existsInLegacy) {
                    state.posts.push(post);
                }
            });
    },
});

export const { clearPosts, clearError } = postSlice.actions;
export default postSlice.reducer;
