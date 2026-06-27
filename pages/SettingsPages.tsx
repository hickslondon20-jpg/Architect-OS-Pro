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

export const AIUsageSettings: React.FC = () => (
  <Card className="p-6 min-h-[400px]">
    <div className="mb-6">
      <div className="aos-eyebrow mb-2" style={{ color: 'var(--aos-brass)' }}>
        Settings
      </div>
      <h2 className="aos-h2">AI Usage</h2>
      <p className="aos-small mt-2 max-w-2xl">
        Stub target for global AI usage reporting across OS Engine, Virtual CSO, and Domain Agents.
        Domain Agents links here, but the reporting surface is owned by Settings.
      </p>
    </div>
    <PlaceholderContent text="AI usage reporting stub" />
  </Card>
);
