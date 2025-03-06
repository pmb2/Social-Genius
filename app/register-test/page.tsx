'use client';

import { RegisterForm } from '@/components/auth/register-form';

export default function RegisterTest() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center">Create an Account</h1>
        <RegisterForm />
      </div>
    </div>
  );
}