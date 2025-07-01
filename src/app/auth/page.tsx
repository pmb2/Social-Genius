'use client';

import {useState, useEffect} from "react";
import Image from "next/image";
import Link from "next/link";
import {Linkedin, Instagram, Facebook, ChevronRight} from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";
import {useRouter} from 'next/navigation';
import {useAuth} from '@/lib/auth/context';

export default function AuthPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isHttpWarning, setIsHttpWarning] = useState(false);

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

    // Handle OAuth errors from URL parameters
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const oauthError = urlParams.get('error');
            
            if (oauthError) {
                switch (oauthError) {
                    case 'twitter_oauth_denied':
                        setError('Twitter login was cancelled');
                        break;
                    case 'twitter_oauth_invalid':
                        setError('Invalid Twitter OAuth response');
                        break;
                    case 'twitter_oauth_state_mismatch':
                        setError('Twitter OAuth security error');
                        break;
                    case 'twitter_token_exchange_failed':
                        setError('Failed to connect with Twitter');
                        break;
                    case 'twitter_user_fetch_failed':
                        setError('Failed to get Twitter user information');
                        break;
                    default:
                        setError('Twitter login failed');
                }
                
                // Clear the error from URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }, []);

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
            const result = await login(email, password);

            if (!result.success) {
                setError(result.error || 'Login failed');
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
            // Use our custom auth context for registration
            const result = await register(email, password, fullName);

            if (result.success) {
                // Registration successful - redirect to dashboard directly
                // The auth context already does auto-login in the register function
                console.log('Registration successful - redirecting to dashboard');
                router.push('/dashboard');
            } else {
                // Registration failed
                setError(result.error || 'Registration failed. Please try again.');
                setIsLoading(false);
            }
        } catch (error) {
            console.error('Registration error:', error);
            setError(error instanceof Error ? error.message : 'Registration failed');
            setIsLoading(false);
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
                            sizes="(max-width: 768px) 100vw, 600px"
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
                                <h2 className="text-white text-4xl font-bold mb-14 text-center whitespace-nowrap">Member
                                    Log In</h2>

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
                                    <h3 className="text-white text-lg mb-6">Or sign in with</h3>
                                    <div className="flex justify-center">
                                        <Link
                                            href="/api/auth/signin/twitter"
                                            className="flex items-center justify-center px-6 py-3 rounded-full bg-black hover:bg-gray-800 transition-colors duration-200 focus:border-[3px] focus:border-[#FFAB19] active:border-[3px] active:border-[#FFAB19] outline-none"
                                        >
                                            <FaXTwitter className="w-5 h-5 text-white mr-2"/>
                                            <span className="text-white font-medium">Sign in with X</span>
                                        </Link>
                                    </div>
                                    {/* Commented out previous social login buttons
                                    <div className="flex justify-center space-x-4">
                                        <Link
                                            href="#"
                                            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#0077B5] focus:border-[3px] focus:border-[#FFAB19] active:border-[3px] active:border-[#FFAB19] outline-none"
                                        >
                                            <Linkedin className="w-5 h-5 text-white"/>
                                        </Link>
                                        <Link
                                            href="#"
                                            className="w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] focus:border-[3px] focus:border-[#FFAB19] active:border-[3px] active:border-[#FFAB19] outline-none"
                                        >
                                            <Instagram className="w-5 h-5 text-white"/>
                                        </Link>
                                        <Link
                                            href="#"
                                            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#1877F2] focus:border-[3px] focus:border-[#FFAB19] active:border-[3px] active:border-[#FFAB19] outline-none"
                                        >
                                            <Facebook className="w-5 h-5 text-white"/>
                                        </Link>
                                    </div>
                                    */}
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
                                <h2 className="text-white text-4xl font-bold tracking-wide mb-10 text-center whitespace-nowrap">
                                    Create Your Account
                                </h2>

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
                                    <div className="flex justify-center">
                                        <Link
                                            href="/api/auth/signin/twitter"
                                            className="flex items-center justify-center px-6 py-3 rounded-full bg-black hover:bg-gray-800 transition-colors duration-200 focus:border-[3px] focus:border-[#FFAB19] active:border-[3px] active:border-[#FFAB19] outline-none"
                                        >
                                            <FaXTwitter className="w-5 h-5 text-white mr-2"/>
                                            <span className="text-white font-medium">Sign up with X</span>
                                        </Link>
                                    </div>
                                    {/* Commented out previous social login buttons
                                    <div className="flex justify-center items-center space-x-4">
                                        <Link
                                            href="#"
                                            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#0077B5] focus:border-[3px] focus:border-[#FFAB19] active:border-[3px] active:border-[#FFAB19] outline-none"
                                        >
                                            <Linkedin className="w-5 h-5 text-white"/>
                                        </Link>
                                        <Link
                                            href="#"
                                            className="w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-r from-[#F58529] to-[#DD2A7B] focus:border-[3px] focus:border-[#FFAB19] active:border-[3px] active:border-[#FFAB19] outline-none"
                                        >
                                            <Instagram className="w-5 h-5 text-white"/>
                                        </Link>
                                        <Link
                                            href="#"
                                            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#1877F2] focus:border-[3px] focus:border-[3px] focus:border-[#FFAB19] active:border-[3px] active:border-[#FFAB19] outline-none"
                                        >
                                            <Facebook className="w-5 h-5 text-white"/>
                                        </Link>
                                    </div>
                                    */}
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
        </div>
    );
}
