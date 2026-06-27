import React from 'react';
import { Lock } from 'lucide-react';
import { FeatureKey, getFeatureGate, getFeatureLockMessage } from '../lib/featureGates';
import { useApp } from '../context/AppContext';

export const LockedFeatureState: React.FC<{ featureKey: FeatureKey }> = ({ featureKey }) => {
  const gate = getFeatureGate(featureKey);
  const title = gate?.postBeta ? 'Post-Beta Scope' : 'Locked for This Program Week';

  return (
    <div className="mx-auto mt-16 max-w-xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <Lock className="h-7 w-7 text-slate-500" />
      </div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
        {gate?.postBeta ? 'Future release' : `Program Week ${gate?.unlockWeek}`}
      </p>
      <h2 className="mb-3 text-2xl font-semibold text-slate-900">{title}</h2>
      <p className="text-sm leading-6 text-slate-600">{getFeatureLockMessage(featureKey)}</p>
    </div>
  );
};

export const FeatureGate: React.FC<{
  featureKey: FeatureKey;
  children: React.ReactNode;
  /** Optional custom locked-state element (e.g. an AOS-tokened, feature-specific panel). */
  lockedElement?: React.ReactNode;
}> = ({ featureKey, children, lockedElement }) => {
  const { accessLoading, featureGatesBypassed, isFeatureUnlocked } = useApp();

  if (featureGatesBypassed) {
    return <>{children}</>;
  }

  if (accessLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-slate-900" />
      </div>
    );
  }

  if (!isFeatureUnlocked(featureKey)) {
    return lockedElement ? <>{lockedElement}</> : <LockedFeatureState featureKey={featureKey} />;
  }

  return <>{children}</>;
};
