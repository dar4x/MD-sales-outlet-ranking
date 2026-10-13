import { DashboardPage } from './pages/DashboardPage';
import { OutletsPage } from './pages/OutletsPage';
import { useEffect, useRef, useState } from 'react';
import { AlertsPage } from './pages/AlertsPage';
import { ProductsPage } from './pages/ProductsPage';
import { Icon } from './components/Icon';

const pages = [
  { id: 'rankings', label: 'Rankings' },
  { id: 'outlets', label: 'Outlets' },
  { id: 'settings', label: 'Settings' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'products', label: 'Products' },
] as const;

export function App() {
  const [page, setPage] = useState<(typeof pages)[number]['id']>('rankings');
  const [selectedOutlet, setSelectedOutlet] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const openMenuButton = useRef<HTMLButtonElement>(null);
  const closeMenuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (menuOpen) closeMenuButton.current?.focus();
  }, [menuOpen]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 901px)');
    const change = (): void => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener('change', change);
    return () => desktop.removeEventListener('change', change);
  }, []);
  function closeMenu(): void {
    setMenuOpen(false);
    requestAnimationFrame(() => openMenuButton.current?.focus());
  }
  function navigate(next: typeof page): void {
    setPage(next);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
    if (menuOpen)
      requestAnimationFrame(() =>
        document.getElementById('main-content')?.focus(),
      );
  }
  function openOutlet(id: string): void {
    setSelectedOutlet(id);
    navigate('outlets');
  }
  return (
    <div
      className="app-shell"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && menuOpen) closeMenu();
      }}
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside
        id="app-sidebar"
        role={menuOpen ? 'dialog' : undefined}
        aria-modal={menuOpen || undefined}
        aria-label={menuOpen ? 'Main navigation drawer' : undefined}
        onKeyDown={(event) => {
          if (!menuOpen || event.key !== 'Tab') return;
          const buttons =
            event.currentTarget.querySelectorAll<HTMLButtonElement>('button');
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}
      >
        <div className="brand">
          <span className="brand-mark">
            <Icon name="rankings" size={18} />
          </span>
          <span>Outlet Monitor</span>
          <button
            type="button"
            className="icon-button mobile-menu sidebar-close"
            ref={closeMenuButton}
            aria-label="Close navigation"
            onClick={closeMenu}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="workspace">
          <span className="workspace-mark">R</span>
          <div>
            <strong>Retail workspace</strong>
            <span>Sales operations</span>
          </div>
        </div>
        <p className="nav-heading">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {pages.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={page === item.id}
              className={`nav-item ${page === item.id ? 'nav-active' : ''}`}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.id === 'outlets' ? 'outlet' : item.id} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="workspace-mark small">
            <Icon name="outlet" size={15} />
          </span>
          <div>
            <strong>Retail monitoring</strong>
            <span>One view of your operations</span>
          </div>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="sidebar-backdrop"
          tabIndex={-1}
          aria-label="Close navigation"
          onClick={closeMenu}
        />
      )}
      <div className="app-body" inert={menuOpen}>
        <header className="app-header">
          <button
            type="button"
            className="icon-button mobile-menu"
            ref={openMenuButton}
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            aria-controls="app-sidebar"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{pages.find((item) => item.id === page)?.label}</strong>
          </div>
          <span className="header-label">Sales monitoring</span>
        </header>
        <div id="main-content" className="page-content" tabIndex={-1}>
          {page === 'rankings' && <DashboardPage onOpenOutlet={openOutlet} />}
          {(page === 'outlets' || page === 'settings') && (
            <OutletsPage
              view={page === 'settings' ? 'settings' : 'details'}
              selected={selectedOutlet}
              onSelect={setSelectedOutlet}
              onOpenSettings={() => navigate('settings')}
              onOpenDetails={() => navigate('outlets')}
            />
          )}
          {page === 'alerts' && <AlertsPage />}
          {page === 'products' && <ProductsPage />}
        </div>
      </div>
    </div>
  );
}
