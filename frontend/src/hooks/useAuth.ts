import { useAppDispatch, useAppSelector } from '../app/store';
import { setCredentials, clearCredentials, setLoading, setError } from '../features/auth/authSlice';
import { authApi } from '../services/api';

export function useAuth() {
  const dispatch = useAppDispatch();
  const { user, accessToken, isLoading, error } = useAppSelector((s) => s.auth);

  async function login(email: string, password: string) {
    dispatch(setLoading(true));
    try {
      const res = await authApi.login(email, password);
      const { accessToken: token, user: u } = res.data.data;
      dispatch(setCredentials({ user: u, accessToken: token, tenantSlug: u.tenantId }));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Login failed';
      dispatch(setError(msg));
      throw err;
    }
  }

  async function register(name: string, email: string, password: string) {
    dispatch(setLoading(true));
    try {
      await authApi.register(name, email, password);
      dispatch(setLoading(false));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Registration failed';
      dispatch(setError(msg));
      throw err;
    }
  }

  async function logout() {
    try { await authApi.logout(); } catch { /* ignore */ }
    dispatch(clearCredentials());
  }

  return { user, accessToken, isLoading, error, login, register, logout };
}
