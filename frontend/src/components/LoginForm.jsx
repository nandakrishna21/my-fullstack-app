import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

const COLORS = ['#e94560', '#4ade80', '#60a5fa', '#f59e0b', '#a78bfa', '#34d399', '#fb923c', '#2dd4bf'];

function hashColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function LoginForm({ onAuth }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetUsername, setResetUsername] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState('request');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = (isRegister ? '/api/auth/register' : '/api/auth/login');
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }

      onAuth(data.user, data.token);
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotRequest = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: resetUsername }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }
      setResetToken(data.token);
      setStep('reset');
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }
      setShowForgot(false);
      setStep('request');
      setResetUsername('');
      setResetToken('');
      setNewPassword('');
      setUsername(resetUsername);
      setPassword(newPassword);
      setIsRegister(false);
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  if (showForgot) {
    return (
      <div className="container">
        <form className="auth-form" onSubmit={step === 'request' ? handleForgotRequest : handleResetPassword}>
          <div className="auth-logo">🔑</div>
          <h1>Reset <span>Password</span></h1>
          {error && <div className="error">{error}</div>}
          {step === 'request' && (
            <>
              <input
                type="text"
                placeholder="Enter your username"
                value={resetUsername}
                onChange={(e) => setResetUsername(e.target.value)}
                required
              />
              <button type="submit" disabled={loading}>
                {loading && <span className="spinner" />}
                {loading ? 'Please wait...' : 'Generate Reset Token'}
              </button>
            </>
          )}
          {step === 'reset' && (
            <>
              <div className="reset-token-display">
                <label>Your reset token:</label>
                <code>{resetToken}</code>
              </div>
              <input
                type="password"
                placeholder="New password (min 6 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
              <button type="submit" disabled={loading}>
                {loading && <span className="spinner" />}
                {loading ? 'Please wait...' : 'Reset Password'}
              </button>
            </>
          )}
          <div className="toggle" onClick={() => { setShowForgot(false); setStep('request'); setError(''); }}>
            Back to login
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-logo">⚡</div>
        <h1><span>Chat</span>App</h1>
        {error && <div className="error">{error}</div>}
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password (min 6 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <button type="submit" disabled={loading}>
          {loading && <span className="spinner" />}
          {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
        </button>
        <div className="toggle" onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
        </div>
        {!isRegister && (
          <div className="toggle forgot-link" onClick={() => { setShowForgot(true); setError(''); }}>
            Forgot password?
          </div>
        )}
      </form>
    </div>
  );
}

export default LoginForm;
