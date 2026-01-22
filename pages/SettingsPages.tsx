import React from 'react';
import { Card, PlaceholderContent } from '../components/ui';

export const AccountSettings: React.FC = () => (
  <Card className="p-6 min-h-[400px]">
    <h2 className="text-lg font-semibold mb-4">Account Settings</h2>
    <PlaceholderContent text="User profile, preferences" />
  </Card>
);

export const SubscriptionBilling: React.FC = () => (
  <Card className="p-6 min-h-[400px]">
    <h2 className="text-lg font-semibold mb-4">Subscription & Billing</h2>
    <PlaceholderContent text="Tier management, billing info" />
  </Card>
);

export const DataManager: React.FC = () => (
  <Card className="p-6 min-h-[400px]">
    <h2 className="text-lg font-semibold mb-4">Data Manager</h2>
    <PlaceholderContent text="View/download/delete uploads" />
  </Card>
);

export const PrivacySecurity: React.FC = () => (
  <Card className="p-6 min-h-[400px]">
    <h2 className="text-lg font-semibold mb-4">Privacy & Security</h2>
    <PlaceholderContent text="Privacy controls, security settings" />
  </Card>
);

export const Referrals: React.FC = () => (
  <Card className="p-6 min-h-[400px]">
    <h2 className="text-lg font-semibold mb-4">Invite Others</h2>
    <PlaceholderContent text="Referral link, tracking, rewards" />
  </Card>
);