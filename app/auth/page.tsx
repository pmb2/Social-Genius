'use client';

import {useState, useEffect} from "react";
import Image from "next/image";
import Link from "next/link";
import {Linkedin, Instagram, Facebook, ChevronRight} from "lucide-react";
import {useRouter} from 'next/navigation';
import { getXOAuthUrl } from '@/lib/auth/x-oauth';
import SignInModal from '@/components/SignInModal';
import { signIn } from 'next-auth/react';

// X (Twitter) Logo Component
const XLogo = ({ className = "w-5 h-5" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
);

export default function AuthPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isHttpWarning, setIsHttpWarning] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const router = useRouter();
    const {user, loading} = useAuth();

    // Check for HTTP protocol - in useEffect to avoid hydration mismatch
    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Check security of connection
            setIsHttpWarning(window.location.protocol === 'http:' && window.location.hostname !== 'localhost');

            // Clear any URL parameters that might contain sensitive data
            if (window.location.search) {
                // If there are query parameters in the URL, remove them without reloading the page
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }, []);

    // If user is already logged in, redirect to dashboard
    useEffect(() => {
        if (user && !loading) {
            console.log("Auth page: User is already logged in, redirecting to dashboard");
            router.replace('/dashboard');
        }
    }, [user, loading, router]);

    const toggleView = () => {
        setIsLogin(!isLogin);
        setError('');
    };

    const {login, register} = useAuth();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !password) {
            setError('Please enter both email and password');
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            const result = await signIn('credentials', {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError(result.error);
                setIsLoading(false);
            } else {
                // Login successful - use window.location for a hard redirect instead of Next.js router
                console.log("Login successful - redirecting to dashboard in 1000ms...");
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1000);
            }
        } catch (error) {
            console.error('Login error:', error);
            setError('An unexpected error occurred. Please try again.');
            setIsLoading(false);
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !password || !confirmPassword) {
            setError('Please fill in all required fields');
            return;
        }
        // Name is optional, so we don't check for it

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long');
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/register-nextauth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name: fullName }),
            });
            const data = await response.json();

            if (data.success) {
                console.log('Registration successful - now logging in...');
                const result = await signIn('credentials', {
                    email,
                    password,
                    redirect: false,
                });

                if (result?.error) {
                    setError(result.error);
                    setIsLoading(false);
                } else {
                    console.log("Login successful after registration - redirecting to dashboard in 1000ms...");
                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 1000);
                }
            } else {
                setError(data.error || 'Registration failed. Please try again.');
                setIsLoading(false);
            }
        } catch (error) {
            console.error('Registration error:', error);
            setError(error instanceof Error ? error.message : 'Registration failed');
            setIsLoading(false);
        }
    };

    const handleOAuthLogin = (platform: string, email?: string, password?: string, businessName?: string) => {
        let url = `/api/auth/${platform}/login?mode=${isLogin ? 'login' : 'register'}`;
        if (businessName) {
            url += `&businessName=${encodeURIComponent(businessName)}`;
        }
        if (email) {
            url += `&email=${encodeURIComponent(email)}`;
        }
        if (password) {
            url += `&password=${encodeURIComponent(password)}`;
        }
        window.location.href = url;
    };

    const handleSkip = async (businessName: string) => {
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch('/api/businesses/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: businessName }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to create business');
            }
            alert('Business created successfully!');
            router.push('/dashboard');
        } catch (err) {
            console.error('Error creating business:', err);
            setError(err instanceof Error ? err.message : 'Failed to create business.');
        } finally {
            setIsLoading(false);
            setIsModalOpen(false);
        }
    };

    return (
        <div className="min-h-screen relative flex flex-col">
            {/* Background Image with Fallback */}
            <div className="fixed inset-0 -z-10 bg-purple-900">
                {/* Adding a background color as fallback */}
                <Image
                    src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Login%20BG.png-diZ2NqZ9incruxz1hsB60tcc7ZxU08.jpeg"
                    alt="Colorful background"
                    fill
                    className="object-cover"
                    priority
                    sizes="100vw"
                    onError={(e) => {
                        // If image fails to load, hide it (background color will show)
                        e.currentTarget.style.display = 'none';
                    }}
                />
            </div>

            {/* Header with logo and fallback */}
            <header className="p-4 md:p-6 relative z-10">
                <div className="flex items-center">
                    <div className="relative h-[50px] w-[180px]">
                        <Image
                            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Group%20362-OlzVNwilBa2Y1RsXBO9EU4oTSldQwV.png"
                            alt="SocialGenius Logo"
                            width={220}
                            height={75}
                            className="h-auto w-auto"
                            onError={(e) => {
                                // If image fails to load, show text instead
                                e.currentTarget.style.display = 'none';
                                // Add a text fallback
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                    const textFallback = document.createElement('div');
                                    textFallback.textContent = 'SocialGenius';
                                    textFallback.className = 'text-white text-2xl font-bold';
                                    parent.appendChild(textFallback);
                                }
                            }}
                        />
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-grow flex items-center justify-center p-4 relative z-10">
                <div className="w-full max-w-5xl flex flex-col md:flex-row rounded-2xl overflow-hidden shadow-lg">
                    {/* Left side - brain image with gradient fallback */}
                    <div className="w-full md:w-[600px] relative overflow-hidden min-h-[400px] md:min-h-[600px] bg-gradient-to-r from-purple-700 to-blue-600">
                        <Image
                            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/YWxqO_SjS6SbML6Dys-Wzg%201%20%281%29-Qossl7gkIAHUJZ9A1shZmzIP5vAfuj.png"
                            alt="SocialGenius Brain"
                            fill
                            className="object-cover"
                            priority
                            sizes=" (max-width: 768px) 100vw, 600px"
                            onError={(e) => {
                                // If image fails to load, hide it (gradient background will show)
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                    </div>

                    {/* Right side - login/signup form */}
                    <div className="w-full md:flex-1 bg-[#3A0022] p-8 flex flex-col items-center">
                        {error && (
                            <div
                                className="w-full max-w-md mb-4 px-4 py-3 bg-red-500/20 border border-red-500/30 text-white rounded-lg text-sm">
                                {error}
                            </div>
                        )}


                        {isLogin ? (
                            /* Login View */
                            <>
                                <h1 className="text-white text-4xl font-bold mb-14 text-center whitespace-nowrap">Member
                                    Log In</h1>

                                <form className="w-full max-w-md space-y-6" onSubmit={handleLogin}>
                                    <div className="mb-4">
                                        <label htmlFor="login-email" className="sr-only">Email</label>
                                        <input
                                            id="login-email"
                                            type="email"
                                            name="email"
                                            autoComplete="email"
                                            placeholder="Enter your email address"
                                            className="w-full px-6 py-4 rounded-[30px] bg-white/15 text-white placeholder-white/70 focus:outline-none text-lg font-light"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="mb-4">
                                        <label htmlFor="login-password" className="sr-only">Password</label>
                                        <input
                                            id="login-password"
                                            type="password"
                                            name="password"
                                            autoComplete="current-password"
                                            placeholder="Enter your password"
                                            className="w-full px-6 py-4 rounded-[30px] bg-white/15 text-white placeholder-white/70 focus:outline-none text-lg font-light"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="flex justify-center mt-8">
                                        <button
                                            type="submit"
                                            className="bg-[#0066FF] text-white font-medium py-3 px-12 rounded-full transition duration-200 text-lg disabled:opacity-70"
                                            disabled={isLoading}
                                        >
                                            {isLoading ? 'Logging in...' : 'Log In'}
                                        </button>
                                    </div>
                                </form>

                                <Link href="#" className="text-white hover:text-white/90 text-sm mt-8">
                                    Forgot Username / Password?
                                </Link>

                                <div className="mt-12 text-center w-full">
                                    <button
                                        onClick={() => setIsModalOpen(true)}
                                        className="flex items-center justify-center w-full max-w-md mx-auto bg-black hover:bg-gray-900 text-white font-medium py-4 px-8 rounded-full transition duration-200 text-lg focus:border-[3px] focus:border-[#FFAB19] active:border-[3px] active:border-[#FFAB19] outline-none"
                                    >
                                        <span>Sign in with Social</span>
                                    </button>
                                </div>


                                <button
                                    onClick={toggleView}
                                    className="mt-10 text-white hover:text-white/90 flex items-center group text-base bg-transparent border-none cursor-pointer p-0"
                                >
                                    <span>Create your Account</span>
                                    <span
                                        className="ml-2 w-6 h-6 bg-[#FFA726] rounded-full flex items-center justify-center">
                    <ChevronRight className="w-4 h-4 text-white" strokeWidth={3}/>
                  </span>
                                </button>
                            </>
                        ) : (
                            /* Signup View */
                            <>
                                <h1 className="text-white text-4xl font-bold tracking-wide mb-10 text-center whitespace-nowrap">
                                    Create Your Account
                                </h1>

                                <form className="w-full max-w-md flex flex-col gap-[5px]" onSubmit={handleSignup}>
                                    <div className="mb-4">
                                        <label htmlFor="register-name" className="sr-only">Full Name</label>
                                        <input
                                            id="register-name"
                                            type="text"
                                            name="name"
                                            autoComplete="name"
                                            placeholder="Enter your full name (optional)"
                                            className="w-full px-6 py-4 rounded-[30px] bg-white/15 text-white placeholder-white/70 focus:outline-none text-lg font-light"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                        />
                                    </div>

                                    <div className="mb-4">
                                        <label htmlFor="register-email" className="sr-only">Email</label>
                                        <input
                                            id="register-email"
                                            type="email"
                                            name="email"
                                            autoComplete="email"
                                            placeholder="Enter your email address"
                                            className="w-full px-6 py-4 rounded-[30px] bg-white/15 text-white placeholder-white/70 focus:outline-none text-lg font-light"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="mb-4">
                                        <label htmlFor="register-password" className="sr-only">Password</label>
                                        <input
                                            id="register-password"
                                            type="password"
                                            name="new-password"
                                            autoComplete="new-password"
                                            placeholder="Create a password (min. 6 characters)"
                                            className="w-full px-6 py-4 rounded-[30px] bg-white/15 text-white placeholder-white/70 focus:outline-none text-lg font-light"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            minLength={6}
                                            required
                                        />
                                    </div>

                                    <div className="mb-4">
                                        <label htmlFor="register-confirm-password" className="sr-only">Confirm
                                            Password</label>
                                        <input
                                            id="register-confirm-password"
                                            type="password"
                                            name="confirm-password"
                                            autoComplete="new-password"
                                            placeholder="Re-enter your password to confirm"
                                            className="w-full px-6 py-4 rounded-[30px] bg-white/15 text-white placeholder-white/70 focus:outline-none text-lg font-light"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            minLength={6}
                                            required
                                        />
                                    </div>

                                    <div className="flex justify-center mt-6">
                                        <button
                                            type="submit"
                                            className="bg-[#0066FF] text-white font-medium py-3 px-12 rounded-full transition duration-200 text-lg disabled:opacity-70"
                                            disabled={isLoading}
                                        >
                                            {isLoading ? 'Signing Up...' : 'Sign Up'}
                                        </button>
                                    </div>
                                </form>

                                <div className="mt-8 text-center w-full">
                                    <p className="text-white text-lg mb-4">Or sign up with</p>
                                    <button
                                        onClick={() => setIsModalOpen(true)}
                                        className="flex items-center justify-center w-full max-w-md mx-auto bg-black hover:bg-gray-900 text-white font-medium py-4 px-8 rounded-full transition duration-200 text-lg focus:border-[3px] focus:border-[#FFAB19] active:border-[3px] active:border-[#FFAB19] outline-none"
                                    >
                                        <span>Sign up with Social</span>
                                    </button>
                                </div>


                                <button
                                    onClick={toggleView}
                                    className="mt-6 text-white hover:text-white/90 flex items-center group text-base bg-transparent border-none cursor-pointer p-0"
                                >
                                    <span>Already Have an Account? Log In</span>
                                    <span
                                        className="ml-2 w-6 h-6 bg-[#FFA726] rounded-full flex items-center justify-center">
                    <ChevronRight className="w-4 h-4 text-white" strokeWidth={3}/>
                  </span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </main>
            <SignInModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onLogin={handleOAuthLogin} onSkip={handleSkip} mode={isLogin ? 'login' : 'register'} />
        </div>
    );
}
