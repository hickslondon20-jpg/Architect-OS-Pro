import { ReactNode } from 'react';

export interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
  children?: NavItem[];
  locked?: boolean;
}

export interface TabItem {
  label: string;
  href: string;
}

export interface PageContainerProps {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}