import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button, Card, Input, Label } from '../components/ui';
import { supabase } from '../lib/supabaseClient';

const PASSWORD_RESET_REDIRECT_TO = 'https://architectospro.com/#/reset-password';

const getRecoveryParams = (): URLSearchParams | null => {
  const candidates: string[] = [];
  const { hash, href, search } = window.location;

  if (search) candidates.push(search.slice(1));

  if (hash) {
    const rawHash = hash.slice(1);
    candidates.push(rawHash);

    const nestedHashIndex = rawHash.lastIndexOf('#');
    if (nestedHashIndex >= 0) {
      candidates.push(rawHash.slice(nestedHashIndex + 1));
    }

    const queryIndex = rawHash.indexOf('?');
    if (queryIndex >= 0) {
      candidates.push(rawHash.slice(queryIndex + 1));
    }
  }

  for (const marker of ['#access_token=', '#code=', '#error=']) {
    const markerIndex = href.indexOf(marker);
    if (markerIndex >= 0) {
      candidates.push(href.slice(markerIndex + 1));
    }
  }

  for (const candidate of candidates) {
    const normalizedCandidate = candidate.replace(/&amp;/g, '&');
    const params = new URLSearchParams(normalizedCandidate);
    if (
      params.has('access_token') ||
      params.has('refresh_token') ||
      params.has('code') ||
      params.get('type') === 'recovery' ||
      params.has('error') ||
      params.has('error_description')
    ) {
      return params;
    }
  }

  return null;
};

const hasRecoveryParams = (): boolean => {
  const params = getRecoveryParams();
  return Boolean(params?.get('type') === 'recovery' || params?.has('access_token') || params?.has('code') || params?.has('error'));
};

const AuthShell: React.FC<{
  title: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-canvas)] px-4">
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="mx-auto mb-5 h-12 w-12 rounded-lg bg-[var(--aos-obsidian)] flex items-center justify-center">
          <span className="text-[var(--fg-on-dark)] font-bold text-2xl">A</span>
        </div>
        <h2 className="text-3xl font-bold text-[var(--fg-1)]">{title}</h2>
        <p className="mt-2 text-[var(--fg-3)]">{subtitle}</p>
      </div>
      <Card className="p-8">{children}</Card>
    </div>
  </div>
);

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="text-center max-w-2xl px-4">
        <div className="mb-6 flex justify-center">
          <div className="h-16 w-16 bg-slate-900 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-3xl">A</span>
          </div>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl mb-4">
          Architect OS
        </h1>
        <p className="text-lg text-slate-600 mb-8">
          The strategic operating system for agency founders. Turn your vision into execution.
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/sign-in">
            <Button variant="outline" className="px-8 py-3 text-base">Sign In</Button>
          </Link>
          <Link to="/sign-up">
            <Button className="px-8 py-3 text-base">Sign Up</Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="ghost" className="px-8 py-3 text-base">Go to App (Demo)</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export const SignInPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <AuthShell title="Sign In" subtitle="Welcome back to Architect OS">
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@agency.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="mt-2 text-right">
                <Link to="/forgot-password" className="text-sm font-medium text-[var(--aos-brass)] hover:text-[var(--aos-brass-soft)]">
                  Forgot password?
                </Link>
              </div>
            </div>

            {error && (
              <div className="text-[var(--aos-risk)] text-sm">{error}</div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            <Link to="/sign-up" className="text-[var(--aos-brass)] hover:text-[var(--aos-brass-soft)] font-medium">Don't have an account? Sign up</Link>
          </div>
    </AuthShell>
  );
};

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: PASSWORD_RESET_REDIRECT_TO,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage('Check your email for a password reset link.');
    }

    setLoading(false);
  };

  return (
    <AuthShell title="Reset Password" subtitle="Enter your email and we will send you a reset link.">
      {message ? (
        <div className="space-y-4 text-center">
          <div className="rounded-md border border-[var(--aos-success)] bg-[var(--aos-success-tint)] px-4 py-3 text-sm font-medium text-[var(--aos-success)]">
            {message}
          </div>
          <Link to="/sign-in">
            <Button variant="outline" className="w-full">Back to Sign In</Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleResetRequest} className="space-y-4">
          <div>
            <Label htmlFor="resetEmail">Email</Label>
            <Input
              id="resetEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@agency.com"
            />
          </div>

          {error && <div className="text-[var(--aos-risk)] text-sm">{error}</div>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Sending Reset Link...' : 'Send Reset Link'}
          </Button>
        </form>
      )}
      <div className="mt-6 text-center text-sm">
        <Link to="/sign-in" className="text-[var(--aos-brass)] hover:text-[var(--aos-brass-soft)] font-medium">Back to sign in</Link>
      </div>
    </AuthShell>
  );
};

export const ResetPasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    let isMounted = true;

    const normalizeRecoverySession = async () => {
      const params = getRecoveryParams();
      const errorDescription = params?.get('error_description') ?? params?.get('error');
      if (errorDescription) {
        if (isMounted) {
          setError(decodeURIComponent(errorDescription).replace(/\+/g, ' '));
          setCheckingSession(false);
        }
        return;
      }

      const accessToken = params?.get('access_token');
      const refreshToken = params?.get('refresh_token');
      const code = params?.get('code');
      let recoverySessionReady = false;

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          if (isMounted) {
            setError(error.message);
            setCheckingSession(false);
          }
          return;
        }

        recoverySessionReady = Boolean(data.session);
        window.history.replaceState(null, '', `${window.location.origin}${window.location.pathname}#/reset-password`);
      } else if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          if (isMounted) {
            setError(error.message);
            setCheckingSession(false);
          }
          return;
        }

        recoverySessionReady = Boolean(data.session);
        window.history.replaceState(null, '', `${window.location.origin}${window.location.pathname}#/reset-password`);
      }

      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (recoverySessionReady || data.session) {
        setReady(true);
        setError(null);
      } else {
        setError('This reset link is invalid or expired. Please request a new password reset link.');
      }
      setCheckingSession(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && isMounted) {
        setReady(true);
        setError(null);
        setCheckingSession(false);
      }
    });

    normalizeRecoverySession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    await supabase.auth.signOut();
    navigate('/sign-in', { replace: true });
  };

  return (
    <AuthShell title="Set New Password" subtitle="Choose a new password for your Architect OS account.">
      {checkingSession ? (
        <div className="text-center text-sm text-[var(--fg-3)]">Preparing your reset session...</div>
      ) : error && !ready ? (
        <div className="space-y-4 text-center">
          <div className="rounded-md border border-[var(--aos-risk)] bg-[var(--aos-risk-tint)] px-4 py-3 text-sm text-[var(--aos-risk)]">
            {error}
          </div>
          <Link to="/forgot-password">
            <Button className="w-full">Request New Link</Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handlePasswordUpdate} className="space-y-4">
          <div>
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && <div className="text-[var(--aos-risk)] text-sm">{error}</div>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Updating Password...' : 'Update Password'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
};

export const RecoveryAwareFallback: React.FC = () => {
  if (hasRecoveryParams()) {
    return <ResetPasswordPage />;
  }

  return <Navigate to="/" replace />;
};

export const SignUpPage: React.FC = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          access_code: accessCode.trim(),
        },
      },
    });

    if (error) {
      setError(error.message);
    } else if (data.session) {
      await supabase
        .from('beta_user_access')
        .insert({
          user_id: data.session.user.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          access_code: accessCode.trim(),
          is_beta: true,
          beta_cohort_week: 1,
          status: 'active',
        });
      // Email confirmation is disabled, or auto-confirmed
      navigate('/dashboard');
    } else {
      setMessage('Check your email for the confirmation link.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Sign Up</h2>
          <p className="mt-2 text-slate-600">Create your beta program access.</p>
        </div>
        <Card className="p-8">
          {message ? (
            <div className="text-center space-y-4">
              <div className="text-green-600 font-medium">{message}</div>
              <Link to="/sign-in">
                <Button variant="outline" className="w-full">Back to Sign In</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    placeholder="London"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    placeholder="Hicks"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@agency.com"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div>
                <Label htmlFor="accessCode">Access Code</Label>
                <Input
                  id="accessCode"
                  type="text"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  required
                  placeholder="Beta access code"
                />
                <p className="mt-1 text-xs text-slate-500">Validation will be enabled before public beta invitations go out.</p>
              </div>

              {error && (
                <div className="text-red-500 text-sm">{error}</div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>
          )}
          <div className="mt-6 text-center text-sm">
            <Link to="/sign-in" className="text-brand-600 hover:text-brand-500 font-medium">Already have an account? Sign in</Link>
          </div>
        </Card>
      </div>
    </div>
  );
};
