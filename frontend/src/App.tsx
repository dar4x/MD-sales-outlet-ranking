import { DashboardPage } from './pages/DashboardPage';
import { OutletsPage } from './pages/OutletsPage';
import { useState } from 'react';

export function App() {
  const [page, setPage] = useState<'rankings' | 'outlets'>('rankings');
  return (
    <>
      <nav aria-label="Main navigation">
        <button
          type="button"
          aria-pressed={page === 'rankings'}
          onClick={() => setPage('rankings')}
        >
          Rankings
        </button>{' '}
        <button
          type="button"
          aria-pressed={page === 'outlets'}
          onClick={() => setPage('outlets')}
        >
          Outlets
        </button>
      </nav>
      {page === 'rankings' ? <DashboardPage /> : <OutletsPage />}
    </>
  );
}
