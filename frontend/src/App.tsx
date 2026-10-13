import { DashboardPage } from './pages/DashboardPage';
import { OutletsPage } from './pages/OutletsPage';
import { useState } from 'react';
import { AlertsPage } from './pages/AlertsPage';
import { ProductsPage } from './pages/ProductsPage';

const pages = [
  { id: 'rankings', label: 'Rankings' },
  { id: 'outlets', label: 'Outlets' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'products', label: 'Products' },
] as const;

export function App() {
  const [page, setPage] = useState<(typeof pages)[number]['id']>('rankings');
  return (
    <>
      <nav aria-label="Main navigation">
        {pages.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={page === item.id}
            onClick={() => setPage(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {page === 'rankings' && <DashboardPage />}
      {page === 'outlets' && <OutletsPage />}
      {page === 'alerts' && <AlertsPage />}
      {page === 'products' && <ProductsPage />}
    </>
  );
}
