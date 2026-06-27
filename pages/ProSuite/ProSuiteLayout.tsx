import React from 'react';
import { Outlet } from 'react-router-dom';
import { ProBreadcrumb } from '../../components/pro-suite/ProBreadcrumb';

export const ProSuiteLayout: React.FC = () => (
  <div>
    <ProBreadcrumb />
    <Outlet />
  </div>
);
