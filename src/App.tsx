import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import CatalogPage from './pages/CatalogPage';
import NotFoundPage from './pages/NotFoundPage';
import ProductPage from './pages/ProductPage';

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
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  );
}
