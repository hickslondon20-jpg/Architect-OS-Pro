import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Input, Label } from '../components/ui';
import { supabase } from '../lib/supabaseClient';

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Sign In</h2>
          <p className="mt-2 text-slate-600">Welcome back to Architect OS</p>
        </div>
        <Card className="p-8">
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
            </div>

            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            <Link to="/sign-up" className="text-brand-600 hover:text-brand-500 font-medium">Don't have an account? Sign up</Link>
          </div>
        </Card>
      </div>
    </div>
  );
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
