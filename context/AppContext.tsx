import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabaseClient';
import { FeatureKey, getFeatureGate } from '../lib/featureGates';

type Tier = 'beta_fit_call' | 'beta_fit_call_full' | 'beta' | 'free' | 'pro' | (string & {});

const FEATURE_GATES_BYPASSED = import.meta.env.VITE_BYPASS_FEATURE_GATES !== 'false';

interface BetaAccess {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  access_code: string | null;
  is_beta: boolean;
  beta_cohort_week: number;
  status: 'active' | 'paused' | 'revoked';
}

interface AppContextType {
  tier: Tier;
  betaAccess: BetaAccess | null;
  betaWeek: number;
  accessLoading: boolean;
  refreshBetaAccess: () => Promise<void>;
  featureGatesBypassed: boolean;
  isFeatureUnlocked: (featureKey: FeatureKey) => boolean;
  getFeatureUnlockWeek: (featureKey: FeatureKey) => number | null;
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
  isSidebarCollapsed: boolean;
  setSidebarCollapsed: (isCollapsed: boolean) => void;
  toggleSidebarCollapse: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [tier, setTier] = useState<Tier>('beta_fit_call');
  const [accessibleFeatures, setAccessibleFeatures] = useState<Set<FeatureKey>>(new Set());
  const [featureWeekMap, setFeatureWeekMap] = useState<Partial<Record<FeatureKey, number | null>>>({});
  const [betaAccess, setBetaAccess] = useState<BetaAccess | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(false); // Default closed on mobile, layout handles desktop

  // Initialize from localStorage if available
  const [isSidebarCollapsed, setSidebarCollapsedState] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });

  const setSidebarCollapsed = (value: boolean) => {
    setSidebarCollapsedState(value);
    localStorage.setItem('sidebarCollapsed', String(value));
  };

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(!isSidebarCollapsed);
  };

  const loadAccess = async () => {
    if (!user) {
      setBetaAccess(null);
      setTier('beta_fit_call');
      setAccessibleFeatures(new Set());
      setFeatureWeekMap({});
      setAccessLoading(false);
      return;
    }

    setAccessLoading(true);

    // Step 1: Get or create the user's profile to determine their tier
    let tierId: Tier = 'beta_fit_call';
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('tier_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error loading profile:', profileError);
    } else if (profileData) {
      tierId = profileData.tier_id as Tier;
    } else {
      // No profile yet - create one with the default tier
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({ user_id: user.id, tier_id: 'beta_fit_call' });
      if (insertError) {
        console.error('Error creating profile:', insertError);
      }
    }
    setTier(tierId);

    // Step 2: Fetch accessible feature keys for this tier
    const { data: tierFeatureRows, error: tierFeaturesError } = await supabase
      .from('tier_features')
      .select('feature_key')
      .eq('tier_code', tierId);

    if (tierFeaturesError) {
      console.error('Error loading tier features:', tierFeaturesError);
    }

    const featureKeys = (tierFeatureRows || []).map(r => r.feature_key as FeatureKey);
    setAccessibleFeatures(new Set(featureKeys));

    // Step 3: For beta tier, fetch beta_unlock_week values from feature_registry
    if (tierId === 'beta' && featureKeys.length > 0) {
      const { data: registryRows, error: registryError } = await supabase
        .from('feature_registry')
        .select('key, beta_unlock_week')
        .in('key', featureKeys);

      if (registryError) {
        console.error('Error loading feature registry:', registryError);
      }

      const weekMap: Partial<Record<FeatureKey, number | null>> = {};
      (registryRows || []).forEach(r => {
        weekMap[r.key as FeatureKey] = r.beta_unlock_week;
      });
      setFeatureWeekMap(weekMap);
    } else {
      setFeatureWeekMap({});
    }

    // Step 4: Fetch beta_user_access (for cohort week and status - beta tier only)
    const { data: betaData, error: betaError } = await supabase
      .from('beta_user_access')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (betaError) {
      console.error('Error loading beta access:', betaError);
      setAccessLoading(false);
      return;
    }

    if (betaData) {
      setBetaAccess(betaData as BetaAccess);
    } else if (tierId === 'beta') {
      // Only auto-create beta_user_access for beta tier users
      const metadata = user.user_metadata || {};
      const { data: inserted, error: insertError } = await supabase
        .from('beta_user_access')
        .insert({
          user_id: user.id,
          first_name: metadata.first_name || null,
          last_name: metadata.last_name || null,
          access_code: metadata.access_code || null,
          is_beta: true,
          beta_cohort_week: 1,
          status: 'active',
        })
        .select('*')
        .single();

      if (insertError) {
        console.error('Error creating beta access:', insertError);
        setBetaAccess({
          user_id: user.id,
          first_name: metadata.first_name || null,
          last_name: metadata.last_name || null,
          access_code: metadata.access_code || null,
          is_beta: true,
          beta_cohort_week: 1,
          status: 'active',
        });
      } else {
        setBetaAccess(inserted as BetaAccess);
      }
    }

    setAccessLoading(false);
  };

  useEffect(() => {
    loadAccess();
  }, [user?.id]);

  const betaWeek = betaAccess?.status === 'active' && betaAccess.is_beta
    ? betaAccess.beta_cohort_week
    : 1;

  const isFeatureUnlocked = (featureKey: FeatureKey): boolean => {
    if (FEATURE_GATES_BYPASSED) return true;

    // Check 1: does the user's tier have access to this feature at all?
    if (!accessibleFeatures.has(featureKey)) return false;

    // Check 2: for beta tier users, apply cohort week gate and status check
    if (tier === 'beta') {
      if (betaAccess && betaAccess.status !== 'active') return false;
      const unlockWeek = featureWeekMap[featureKey];
      if (unlockWeek != null) {
        return betaWeek >= unlockWeek;
      }
    }

    return true;
  };

  const getFeatureUnlockWeek = (featureKey: FeatureKey) => getFeatureGate(featureKey)?.unlockWeek ?? null;

  return (
    <AppContext.Provider value={{
      tier,
      betaAccess,
      betaWeek,
      accessLoading,
      refreshBetaAccess: loadAccess,
      featureGatesBypassed: FEATURE_GATES_BYPASSED,
      isFeatureUnlocked,
      getFeatureUnlockWeek,
      isSidebarOpen,
      setSidebarOpen,
      isSidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebarCollapse
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
