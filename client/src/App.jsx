import { useState, useCallback, useEffect } from 'react';
import Canvas from './components/Canvas';
import AuthPage from './components/AuthPage';
import Toast from './components/Toast';
import { checkHealth } from './services/api';
import './App.css';

export default function App() {
  const [toasts, setToasts] = useState([]);
  const [hasApiKey, setHasApiKey] = useState(null);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Check existing session on load
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include',
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => {
          setUser(data.user);
          setAuthChecked(true);
        })
        .catch(() => {
          localStorage.removeItem('token');
          setAuthChecked(true);
        });
    } else {
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    if (user) {
      checkHealth()
        .then(data => setHasApiKey(data.hasApiKey))
        .catch(() => setHasApiKey(false));
    }
  }, [user]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const handleAuth = useCallback((userData, token) => {
    setUser(userData);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setUser(null);
    addToast('Signed out', 'info');
  }, [addToast]);

  if (!authChecked) {
    return (
      <div className="app app--loading">
        <div className="app__spinner" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuth={handleAuth} />;
  }

  return (
    <div className="app">
      {hasApiKey === false && (
        <div className="api-key-banner">
          <span>⚠️</span>
          <span>No OpenAI API key detected. Add <code>OPENAI_API_KEY</code> to your <code>.env</code> and restart the server.</span>
        </div>
      )}
      <div className="app__topbar">
        <div className="app__topbar-left">
          <span className="app__topbar-logo">◈</span>
          <span className="app__topbar-title">OCR Canvas</span>
        </div>
        <div className="app__topbar-right">
          <span className="app__topbar-user">{user.name || user.email}</span>
          <button className="app__topbar-logout" onClick={handleLogout}>Sign Out</button>
        </div>
      </div>
      <Canvas addToast={addToast} />
      <div className="toast-container">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} />
        ))}
      </div>
    </div>
  );
}
