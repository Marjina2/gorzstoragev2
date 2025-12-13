
import React from 'react';
import { HashRouter as Router, useLocation, useRoutes } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

// New Next.js-style folder structure imports
import RootLayout from './app/layout';
import Home from './app/page';
import UploadPage from './app/upload/page';
import DownloadPage from './app/download/page';
import AdminLogin from './app/admin/page';
import AdminDashboard from './app/admin/dashboard/page';

const AnimatedRoutes = () => {
  const location = useLocation();

  const element = useRoutes([
    { path: "/", element: <Home /> },
    { path: "/token", element: <Home /> },
    { path: "/upload", element: <UploadPage /> },
    { path: "/download", element: <DownloadPage /> },
    { path: "/admin", element: <AdminLogin /> },
    { path: "/admin/dashboard", element: <AdminDashboard /> },
  ], location);

  if (!element) return null;

  return (
    <AnimatePresence mode="wait">
      {React.cloneElement(element, { key: location.pathname })}
    </AnimatePresence>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <RootLayout>
        <AnimatedRoutes />
      </RootLayout>
    </Router>
  );
};

export default App;
