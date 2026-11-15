import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { RequireAdmin, RequireAuth, RequireCustomer } from './auth';
import Layout from './components/Layout';
import AdminCategories from './pages/admin/AdminCategories';
import AdminCustomerDetail from './pages/admin/AdminCustomerDetail';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminLayout from './pages/admin/AdminLayout';
import AdminProductEdit from './pages/admin/AdminProductEdit';
import AdminProducts from './pages/admin/AdminProducts';
import AdminSettings from './pages/admin/AdminSettings';
import AdminTransactions from './pages/admin/AdminTransactions';
import AccountPage from './pages/AccountPage';
import CatalogPage from './pages/CatalogPage';
import DiscountPage from './pages/DiscountPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import ProductPage from './pages/ProductPage';
import ProfilePage from './pages/ProfilePage';
import SignupPage from './pages/SignupPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  // Braces matter: an effect must return nothing (or a cleanup function), never scrollTo's result.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<CatalogPage />} />
          <Route path="products/:id" element={<ProductPage />} />
          <Route path="discount" element={<DiscountPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route
            path="account"
            element={
              <RequireCustomer>
                <AccountPage />
              </RequireCustomer>
            }
          />
          <Route
            path="account/profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path="admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="customers/:id" element={<AdminCustomerDetail />} />
            <Route path="transactions" element={<AdminTransactions />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/:id" element={<AdminProductEdit />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}
