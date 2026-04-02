import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenantId: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  tenantSlug: string | null;
  isLoading: boolean;
  error: string | null;
}

function loadFromStorage(): Pick<AuthState, 'accessToken' | 'tenantSlug'> {
  return {
    accessToken: localStorage.getItem('accessToken'),
    tenantSlug: localStorage.getItem('tenantSlug'),
  };
}

const initialState: AuthState = {
  user: null,
  error: null,
  isLoading: false,
  ...loadFromStorage(),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ user: AuthUser; accessToken: string; tenantSlug: string }>) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.tenantSlug = action.payload.tenantSlug;
      state.error = null;
      localStorage.setItem('accessToken', action.payload.accessToken);
      localStorage.setItem('tenantSlug', action.payload.tenantSlug);
    },
    clearCredentials(state) {
      state.user = null;
      state.accessToken = null;
      state.tenantSlug = null;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('tenantSlug');
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

export const { setCredentials, clearCredentials, setLoading, setError } = authSlice.actions;
export default authSlice.reducer;
