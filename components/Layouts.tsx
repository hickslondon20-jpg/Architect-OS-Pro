import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { TabNav, PageHeader } from './ui';

export const DashboardLayout: React.FC = () => {
  const isAuthenticated = true; 

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header />
        <main className="w-full flex-grow p-6">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

interface SectionLayoutProps {
  title: string;
  tabs?: { label: string; href: string }[];
}

export const SectionLayout: React.FC<SectionLayoutProps> = ({ title, tabs }) => {
  return (
    <div>
      <PageHeader title={title} />
      {tabs && <TabNav tabs={tabs} />}
      <div className="mt-4">
        <Outlet />
      </div>
    </div>
  );
};
