import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Integration {
  id: string;
  provider: string;
  lastSyncedAt: string | null;
  config: Record<string, unknown>;
  createdAt: string;
}

interface IntegrationsState {
  items: Integration[];
  isLoading: boolean;
  error: string | null;
}

const initialState: IntegrationsState = {
  items: [],
  isLoading: false,
  error: null,
};

const integrationsSlice = createSlice({
  name: 'integrations',
  initialState,
  reducers: {
    setIntegrations(state, action: PayloadAction<Integration[]>) {
      state.items = action.payload;
    },
    addIntegration(state, action: PayloadAction<Integration>) {
      state.items.push(action.payload);
    },
    removeIntegration(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => i.provider !== action.payload);
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
    },
  },
});

export const { setIntegrations, addIntegration, removeIntegration, setLoading, setError } = integrationsSlice.actions;
export default integrationsSlice.reducer;
