import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AiState {
  drafts: Record<string, string>;
  isGenerating: boolean;
  error: string | null;
}

const initialState: AiState = {
  drafts: {},
  isGenerating: false,
  error: null,
};

const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    setDraft(state, action: PayloadAction<{ taskId: string; draft: string }>) {
      state.drafts[action.payload.taskId] = action.payload.draft;
    },
    clearDraft(state, action: PayloadAction<string>) {
      delete state.drafts[action.payload];
    },
    setGenerating(state, action: PayloadAction<boolean>) {
      state.isGenerating = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isGenerating = false;
    },
  },
});

export const { setDraft, clearDraft, setGenerating, setError } = aiSlice.actions;
export default aiSlice.reducer;
