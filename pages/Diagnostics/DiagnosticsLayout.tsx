import React from 'react';
import { Outlet } from 'react-router-dom';
import { DiagnosticsBreadcrumb } from '../../components/DiagnosticsBreadcrumb';

export const DiagnosticsLayout: React.FC = () => (
  <div>
    <DiagnosticsBreadcrumb />
    <Outlet />
  </div>
);
