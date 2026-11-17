import {
  ArrowUpRight,
  BookOpen,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  ShieldCheck,
  Ticket,
  Utensils,
  Wallet,
  Wheat,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../app/auth';
import { month } from '../services/format';
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <Wheat size={24} />
      </span>
      <span>
        smart<span>resto</span>
        <small>LE CAMPUS, EN PLUS SIMPLE.</small>
      </span>
    </div>
  );
}
export function DemoBanner() {
  return (
    <div className="demo-banner">
      <FlaskConical size={14} />
      <span>Démonstration — aucun solde réel modifié</span>
      <span className="demo-pill">ENVIRONNEMENT DÉMO</span>
    </div>
  );
}
const links = {
  STUDENT: [
    { to: '/dashboard', label: 'Vue d’ensemble', icon: LayoutDashboard },
    { to: '/recharge', label: 'Recharger mon solde', icon: Wallet },
    { to: '/transactions', label: 'Mes transactions', icon: ReceiptText },
    { to: '/meals', label: 'Mes repas', icon: Utensils },
  ],
  SELLER: [{ to: '/seller', label: 'Coupons & ventes', icon: Ticket }],
  ADMIN: [
    { to: '/admin', label: 'Vue d’ensemble', icon: LayoutDashboard },
    { to: '/admin/coupons', label: 'Gestion des coupons', icon: Ticket },
    { to: '/admin/sales', label: 'Ventes & registre', icon: ReceiptText },
    { to: '/admin/demo', label: 'Simuler un repas', icon: FlaskConical },
  ],
};
export function Layout() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const roleName =
    user.role === 'STUDENT'
      ? 'Espace étudiant'
      : user.role === 'SELLER'
        ? 'Espace vendeur'
        : 'Administration';
  return (
    <>
      <DemoBanner />
      <div className="app-layout">
        <aside className="sidebar">
          <Brand />
          <p className="nav-caption">{roleName}</p>
          <nav aria-label="Navigation principale">
            {links[user.role].map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end>
                <Icon size={19} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-note">
            <ShieldCheck size={24} />
            <strong>Votre campus connecté.</strong>
            <p>
              Un coupon, un repas,
              <br />
              une journée plus simple.
            </p>
            <span>
              Prototype universitaire <ArrowUpRight size={13} />
            </span>
          </div>
          <div className="sidebar-bottom">
            <span>
              <BookOpen size={16} /> SmartResto · MVP 1.0
            </span>
            <small>Conçu pour la vie étudiante.</small>
          </div>
        </aside>
        <div className="main-column">
          <header className="topbar">
            <span>
              {roleName}
              <span className="topbar-divider">/</span>
              <span className="muted">SmartResto</span>
            </span>
            <div className="profile">
              <span className="avatar">
                {user.fullName
                  .split(' ')
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join('')}
              </span>
              <span>
                <strong>{user.fullName}</strong>
                <small>{user.studentNumber ?? roleName}</small>
              </span>
              <button
                className="icon-button"
                onClick={logout}
                aria-label="Se déconnecter"
                title="Se déconnecter"
              >
                <LogOut size={18} />
              </button>
            </div>
          </header>
          <main>
            <Outlet />
          </main>
          <footer>
            <span>© {new Date().getFullYear()} SmartResto · Prototype universitaire</span>
            <span>
              Simulation uniquement <span className="dot" /> {month()}
            </span>
          </footer>
        </div>
      </div>
    </>
  );
}
