import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, Protected, useAuth, homeFor } from './app/auth';
import { Layout } from './components/layout';
import { ToastProvider } from './components/ui';
import { LoginPage } from './pages/login';
import { DashboardPage, MealsPage, RechargePage, TransactionsPage } from './pages/student';
import {
  AdminCouponsPage,
  AdminDashboardPage,
  AdminDemoPage,
  AdminSalesPage,
  SellerPage,
} from './pages/operations';
import './styles.css';
function Home() {
  const { user } = useAuth();
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />;
}
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <Protected roles={['STUDENT', 'SELLER', 'ADMIN']}>
                  <Layout />
                </Protected>
              }
            >
              <Route
                path="/dashboard"
                element={
                  <Protected roles={['STUDENT']}>
                    <DashboardPage />
                  </Protected>
                }
              />
              <Route
                path="/recharge"
                element={
                  <Protected roles={['STUDENT']}>
                    <RechargePage />
                  </Protected>
                }
              />
              <Route
                path="/transactions"
                element={
                  <Protected roles={['STUDENT']}>
                    <TransactionsPage />
                  </Protected>
                }
              />
              <Route
                path="/meals"
                element={
                  <Protected roles={['STUDENT']}>
                    <MealsPage />
                  </Protected>
                }
              />
              <Route
                path="/seller"
                element={
                  <Protected roles={['SELLER']}>
                    <SellerPage />
                  </Protected>
                }
              />
              <Route
                path="/admin"
                element={
                  <Protected roles={['ADMIN']}>
                    <AdminDashboardPage />
                  </Protected>
                }
              />
              <Route
                path="/admin/coupons"
                element={
                  <Protected roles={['ADMIN']}>
                    <AdminCouponsPage />
                  </Protected>
                }
              />
              <Route
                path="/admin/sales"
                element={
                  <Protected roles={['ADMIN']}>
                    <AdminSalesPage />
                  </Protected>
                }
              />
              <Route
                path="/admin/demo"
                element={
                  <Protected roles={['ADMIN']}>
                    <AdminDemoPage />
                  </Protected>
                }
              />
            </Route>
            <Route path="*" element={<Home />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
