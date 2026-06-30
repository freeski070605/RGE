import { FormEvent, useEffect, useState } from 'react';
import { LockKeyhole, RefreshCw } from 'lucide-react';
import { AuthenticatedDashboard } from './components/AuthenticatedDashboard';
import { dashboardApi, extractApiError, isUnauthorizedError } from './lib/api';
import { OperatorRecord } from './lib/types';

export default function App() {
  const [operator, setOperator] = useState<OperatorRecord | null>(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      setIsCheckingSession(true);
      try {
        const session = await dashboardApi.getSession();
        if (!active) {
          return;
        }

        setOperator(session.operator);
        setLoginForm((current) => ({ ...current, email: session.operator.email }));
      } catch (error) {
        if (active && !isUnauthorizedError(error)) {
          setToast({ type: 'error', message: extractApiError(error) });
        }
      } finally {
        if (active) {
          setIsCheckingSession(false);
        }
      }
    };

    void restoreSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoggingIn(true);

    try {
      const session = await dashboardApi.login(loginForm);
      setOperator(session.operator);
      setToast({ type: 'success', message: `Signed in as ${session.operator.name}.` });
    } catch (error) {
      setToast({ type: 'error', message: extractApiError(error) });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = async () => {
    try {
      await dashboardApi.logout();
      setOperator(null);
      setToast({ type: 'success', message: 'Signed out.' });
    } catch (error) {
      setToast({ type: 'error', message: extractApiError(error) });
    }
  };

  if (isCheckingSession) {
    return (
      <div className="app-shell">
        <div className="background-orb background-orb--left" />
        <div className="background-orb background-orb--right" />
        <div className="dashboard-shell" style={{ placeItems: 'center' }}>
          <div className="form-card" style={{ maxWidth: 420 }}>
            <div className="form-card__header">
              <RefreshCw size={18} />
              <strong>Checking operator session</strong>
            </div>
            <p>Connecting to ReemTeam HQ and restoring your secure workspace.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!operator) {
    return (
      <div className="app-shell">
        <div className="background-orb background-orb--left" />
        <div className="background-orb background-orb--right" />
        {toast ? <div className={`toast toast--${toast.type}`}>{toast.message}</div> : null}
        <div className="dashboard-shell" style={{ placeItems: 'center' }}>
          <form className="form-card" style={{ maxWidth: 440 }} onSubmit={login}>
            <div className="form-card__header">
              <LockKeyhole size={18} />
              <strong>Operator sign in</strong>
            </div>
            <p>Use your ReemTeam HQ operator account to access the live workspace.</p>
            <label>
              Email
              <input
                type="email"
                value={loginForm.email}
                onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                required
              />
            </label>
            <button className="primary-button" type="submit" disabled={isLoggingIn}>
              <LockKeyhole size={16} />
              {isLoggingIn ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <AuthenticatedDashboard operator={operator} onLogout={logout} globalToast={toast} setGlobalToast={setToast} />;
}
