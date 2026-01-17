import { useState, useEffect } from 'react';
import { login, isAdminLoggedIn, logout } from '../lib/auth';
import { ui, type Lang } from '../lib/i18n';

interface Props {
  lang?: Lang;
}

export default function AdminLogin({ lang = 'zh' }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);

  const t = (key: keyof typeof ui.zh) => ui[lang][key] || ui.zh[key];
  const basePath = lang === 'zh' ? '' : `/${lang}`;

  useEffect(() => {
    setLoggedIn(isAdminLoggedIn());
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(password);
    if (result.success) {
      setLoggedIn(true);
      setPassword('');
    } else {
      setError(result.error || t('admin.invalidToken'));
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await logout();
    setLoggedIn(false);
    setPassword('');
  };

  if (loggedIn) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-lg shadow-sm border text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold mb-2">{t('admin.loggedIn')}</h1>
        <p className="text-gray-600 mb-6">
          {t('admin.loggedInDesc')}
        </p>
        <div className="space-y-3">
          <a
            href={`${basePath}/blog`}
            className="block w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            {t('admin.goToBlog')}
          </a>
          <button
            onClick={handleLogout}
            className="block w-full py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t('admin.logout')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-lg shadow-sm border">
      <h1 className="text-2xl font-semibold mb-6 text-center">{t('admin.title')}</h1>

      <form onSubmit={handleLogin}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('admin.token')}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={t('admin.tokenPlaceholder')}
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm mb-4">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {loading ? (lang === 'zh' ? '登录中...' : 'Logging in...') : t('admin.login')}
        </button>
      </form>
    </div>
  );
}
