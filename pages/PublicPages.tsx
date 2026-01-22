import React from 'react';
import { Link } from 'react-router-dom';
import { Button, Card } from '../components/ui';

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

export const SignInPage: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
         <h2 className="text-3xl font-bold text-slate-900">Sign In</h2>
         <p className="mt-2 text-slate-600">Welcome back to Architect OS</p>
      </div>
      <Card className="p-8">
        <div className="space-y-4">
           <div className="h-10 bg-slate-100 rounded animate-pulse" />
           <div className="h-10 bg-slate-100 rounded animate-pulse" />
           <Button className="w-full">Sign In</Button>
        </div>
        <div className="mt-6 text-center text-sm">
           <Link to="/sign-up" className="text-brand-600 hover:text-brand-500 font-medium">Don't have an account? Sign up</Link>
        </div>
      </Card>
    </div>
  </div>
);

export const SignUpPage: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
         <h2 className="text-3xl font-bold text-slate-900">Sign Up</h2>
         <p className="mt-2 text-slate-600">Start your transformation journey</p>
      </div>
      <Card className="p-8">
        <div className="space-y-4">
           <div className="h-10 bg-slate-100 rounded animate-pulse" />
           <div className="h-10 bg-slate-100 rounded animate-pulse" />
           <div className="h-10 bg-slate-100 rounded animate-pulse" />
           <Button className="w-full">Create Account</Button>
        </div>
        <div className="mt-6 text-center text-sm">
           <Link to="/sign-in" className="text-brand-600 hover:text-brand-500 font-medium">Already have an account? Sign in</Link>
        </div>
      </Card>
    </div>
  </div>
);