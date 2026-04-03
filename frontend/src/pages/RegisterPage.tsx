import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function RegisterPage() {
  const { register, isLoading, error } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await register(name, email, password);
      navigate('/login');
    } catch { /* error shown via Redux state */ }
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <h1>Create account</h1>
        <p>Set up your SmartCollab workspace</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Workspace name</label>
            <input className="form-control" value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Company" required />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input className="form-control" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input className="form-control" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={8} required />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}
            type="submit" disabled={isLoading}>
            {isLoading ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 16, color: 'var(--muted)', fontSize: 13 }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
