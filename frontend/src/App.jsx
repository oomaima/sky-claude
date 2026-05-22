import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

import Login from './components/Login';
import Layout from './components/Layout';
import GenerateDashboard from './components/GenerateDashboard';
import SavedDashboards from './components/SavedDashboards';
import SystemPrompts from './components/SystemPrompts';
import UserManagement from './components/UserManagement';
import QueryData from './components/QueryData';
import ApplicationFeatures from './components/ApplicationFeatures';
import QueryDataComponent from './components/QueryData';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<GenerateDashboard />} />
          <Route path="dashboards" element={<SavedDashboards />} />
          <Route path="features" element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
              <ApplicationFeatures />
            </ProtectedRoute>
          } />
          <Route path="prompts" element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'DATA_ANALYST']}>
              <SystemPrompts />
            </ProtectedRoute>
          } />
          <Route path="users" element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
              <UserManagement />
            </ProtectedRoute>
          } />
          <Route path="query-data" element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
              <QueryData />
            </ProtectedRoute>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
