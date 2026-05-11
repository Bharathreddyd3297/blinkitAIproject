import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

import { MainLayout } from '@layouts/MainLayout';
import { ProtectedRoute } from '@routes/ProtectedRoute';
import { paths } from '@routes/paths';

// =============================================================================
// Lazy-loaded pages
//
// Each page is its own bundle. Vite splits these out automatically and the
// MainLayout's <Suspense> renders the skeleton while a chunk downloads.
// Don't import pages eagerly — that defeats the route-level code-splitting
// and slows down the initial paint.
// =============================================================================

const HomePage            = lazy(() => import('@pages/HomePage'));
const LoginPage           = lazy(() => import('@pages/LoginPage'));
const RegisterPage        = lazy(() => import('@pages/RegisterPage'));
const ProductsPage        = lazy(() => import('@pages/ProductsPage'));
const ProductDetailPage   = lazy(() => import('@pages/ProductDetailPage'));
const CartPage            = lazy(() => import('@pages/CartPage'));
const OrdersPage          = lazy(() => import('@pages/OrdersPage'));
const OrderDetailPage     = lazy(() => import('@pages/OrderDetailPage'));
const CheckoutPage        = lazy(() => import('@pages/CheckoutPage'));
const RecommendationsPage = lazy(() => import('@pages/RecommendationsPage'));
const AccountPage         = lazy(() => import('@pages/AccountPage'));
const AdminPage           = lazy(() => import('@pages/AdminPage'));
const NotFoundPage        = lazy(() => import('@pages/NotFoundPage'));

export function AppRouter() {
  return (
    <Routes>
      {/* All routes share the cinematic shell (navbar, footer, ambient) */}
      <Route element={<MainLayout />}>
        {/* Public */}
        <Route path={paths.home}            element={<HomePage />} />
        <Route path={paths.login}           element={<LoginPage />} />
        <Route path={paths.register}        element={<RegisterPage />} />
        <Route path={paths.products}        element={<ProductsPage />} />
        <Route path="/products/:slug"        element={<ProductDetailPage />} />
        <Route path={paths.recommendations} element={<RecommendationsPage />} />

        {/* Cart is public — anonymous shoppers can build a cart; checkout
            then forces auth via the protected route below. */}
        <Route path={paths.cart} element={<CartPage />} />

        {/* Protected */}
        <Route
          path={paths.orders}
          element={
            <ProtectedRoute>
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <ProtectedRoute>
              <OrderDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={paths.checkout}
          element={
            <ProtectedRoute>
              <CheckoutPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={paths.account}
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={paths.admin}
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminPage />
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
