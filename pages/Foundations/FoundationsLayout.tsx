import React from 'react';
import { Outlet } from 'react-router-dom';
import { FoundationsBreadcrumb } from '../../components/FoundationsBreadcrumb';

export const FoundationsLayout: React.FC = () => (
  <div>
    <FoundationsBreadcrumb />
    <Outlet />
  </div>
);
