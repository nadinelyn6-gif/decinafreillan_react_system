import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import AuthForm from './AuthForm.jsx';

export default function LoginPage() {
  const { login, register, error, setError } = useAuth();
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);

  async function handleSubmit({ name, email, password }) {
    setBusy(true);
    if (mode === 'login') await login(email, password);
    else await register(name, email, password);
    setBusy(false);
  }

  function switchMode(next) {
    setError('');
    setMode(next);
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="mark auth-mark" aria-hidden="true">
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            stroke="#1a1405"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <path d="M4 16v0M9 11v10M14 6v20M19 10v12M24 13v6M28 16v0" />
          </svg>
        </div>
        <h1>FreillDe SpeechText</h1>

        <AuthForm mode={mode} busy={busy} error={error} onSubmit={handleSubmit} />

        <p className="auth-switch">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            className="link-button"
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </main>
  );
}
