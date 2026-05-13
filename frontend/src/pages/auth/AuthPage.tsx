import { useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, X } from 'lucide-react';

import { ApiError } from '@/api/http';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/cn';
import {
    isPasswordValid,
    isUsernameValid,
    PASSWORD_RULES,
} from '@/lib/password';
import { Button } from '@/components/ui/Button';
import { FieldError, Input, Label } from '@/components/ui/Input';
import { toast } from '@/components/ui/Toast';
import { LogoMark, Wordmark } from '@/components/Logo';
import { AuthLayout } from './AuthLayout';
import { AuthModeToggle, type AuthMode } from './AuthModeToggle';
import { useCardTopAnchor } from './useCardTopAnchor';

const inputMotion =
    'transition-[border-color,box-shadow,transform] duration-200 ease-out focus:-translate-y-px focus:shadow-[0_0_0_3px_rgb(var(--cyan)/0.08)]';

const COPY: Record<AuthMode, { title: string; subtitle: string }> = {
    signin: { title: 'Sign in', subtitle: 'Welcome back to your forge.' },
    signup: {
        title: 'Create account',
        subtitle: 'Spin up your own image foundry.',
    },
};

const heightSpring = {
    type: 'spring' as const,
    stiffness: 420,
    damping: 36,
    mass: 0.85,
};
const contentEase = [0.22, 1, 0.36, 1] as const;

function useAuthMode(): [AuthMode, (mode: AuthMode) => void] {
    const location = useLocation();
    const navigate = useNavigate();
    const mode: AuthMode =
        location.pathname === '/register' ? 'signup' : 'signin';
    const setMode = (next: AuthMode) => {
        const path = next === 'signup' ? '/register' : '/login';
        if (location.pathname !== path) navigate(path, { replace: true });
    };
    return [mode, setMode];
}

/** Smooth height + crossfade while both forms stay mounted (preserves field state). */
function AuthFormSwap({
    mode,
    signInMeasureRef,
}: {
    mode: AuthMode;
    signInMeasureRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
    const reduceMotion = useReducedMotion();
    const signUpRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState<number | 'auto'>('auto');

    const measure = () => {
        const el =
            mode === 'signin' ? signInMeasureRef.current : signUpRef.current;
        return el?.scrollHeight ?? 0;
    };

    useLayoutEffect(() => {
        setHeight(measure());
        const ro = new ResizeObserver(() => setHeight(measure()));
        if (signInMeasureRef.current) ro.observe(signInMeasureRef.current);
        if (signUpRef.current) ro.observe(signUpRef.current);
        return () => ro.disconnect();
    }, [mode, signInMeasureRef]);

    const fadeTransition = reduceMotion
        ? { duration: 0 }
        : { duration: 0.28, ease: contentEase };

    return (
        <motion.div
            className="relative mt-6 overflow-hidden will-change-[height]"
            style={{ transformOrigin: 'top center' }}
            animate={{ height: reduceMotion ? 'auto' : height }}
            transition={reduceMotion ? { duration: 0 } : heightSpring}
        >
            <motion.div
                ref={signInMeasureRef}
                role="tabpanel"
                aria-hidden={mode !== 'signin'}
                className={cn(
                    mode !== 'signin' &&
                        'pointer-events-none absolute inset-x-0 top-0',
                )}
                initial={false}
                animate={
                    reduceMotion
                        ? { opacity: mode === 'signin' ? 1 : 0 }
                        : mode === 'signin'
                          ? { opacity: 1, x: 0, filter: 'blur(0px)' }
                          : { opacity: 0, x: -10, filter: 'blur(3px)' }
                }
                transition={fadeTransition}
            >
                <SignInPanel tabbable={mode === 'signin'} />
            </motion.div>

            <motion.div
                ref={signUpRef}
                role="tabpanel"
                aria-hidden={mode !== 'signup'}
                className={cn(
                    mode !== 'signup' &&
                        'pointer-events-none absolute inset-x-0 top-0',
                )}
                initial={false}
                animate={
                    reduceMotion
                        ? { opacity: mode === 'signup' ? 1 : 0 }
                        : mode === 'signup'
                          ? { opacity: 1, x: 0, filter: 'blur(0px)' }
                          : { opacity: 0, x: 10, filter: 'blur(3px)' }
                }
                transition={fadeTransition}
            >
                <SignUpPanel tabbable={mode === 'signup'} />
            </motion.div>
        </motion.div>
    );
}

export function AuthPage() {
    const [mode, setMode] = useAuthMode();
    const copy = COPY[mode];
    const reduceMotion = useReducedMotion();
    const topBlockRef = useRef<HTMLDivElement>(null);
    const signInMeasureRef = useRef<HTMLDivElement>(null);
    const cardTop = useCardTopAnchor(topBlockRef, signInMeasureRef);

    return (
        <AuthLayout cardTop={cardTop}>
            <div ref={topBlockRef} className="shrink-0">
                <div className="mb-6 flex items-center lg:hidden">
                    <LogoMark className="h-8 w-8" />
                    <Wordmark />
                </div>
                <AuthModeToggle mode={mode} onChange={setMode} />

                {/* Fixed-height header — crossfade only, no vertical shift */}
                <div className="relative h-[4.75rem] overflow-hidden">
                    <AnimatePresence mode="sync" initial={false}>
                        <motion.div
                            key={mode}
                            className="absolute inset-0"
                            initial={reduceMotion ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={reduceMotion ? undefined : { opacity: 0 }}
                            transition={{ duration: 0.2, ease: contentEase }}
                        >
                            <h2 className="text-2xl font-bold tracking-tight">
                                {copy.title}
                            </h2>
                            <p className="mt-1.5 text-sm text-muted">
                                {copy.subtitle}
                            </p>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            <AuthFormSwap mode={mode} signInMeasureRef={signInMeasureRef} />
        </AuthLayout>
    );
}

function SignInPanel({ tabbable }: { tabbable: boolean }) {
    const login = useAuthStore((s) => s.login);
    const navigate = useNavigate();
    const location = useLocation();
    const from = (location.state as { from?: string } | null)?.from ?? '/';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await login({ email, password });
            toast.success('Welcome back');
            navigate(from, { replace: true });
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div className="group">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                    id="signin-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    tabIndex={tabbable ? 0 : -1}
                    className={inputMotion}
                />
            </div>
            <div className="group">
                <Label htmlFor="signin-password">Password</Label>
                <Input
                    id="signin-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    tabIndex={tabbable ? 0 : -1}
                    className={inputMotion}
                />
            </div>
            {error && <FieldError>{error}</FieldError>}
            <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                tabIndex={tabbable ? 0 : -1}
                className="w-full transition-transform duration-150 ease-out active:scale-[0.98] motion-reduce:active:scale-100"
            >
                Sign in
            </Button>
        </form>
    );
}

function SignUpPanel({ tabbable }: { tabbable: boolean }) {
    const register = useAuthStore((s) => s.register);
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [touched, setTouched] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const usernameOk = isUsernameValid(username);
    const passwordOk = isPasswordValid(password);
    const canSubmit = email.length > 3 && usernameOk && passwordOk;

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setTouched(true);
        if (!canSubmit) return;
        setError(null);
        setLoading(true);
        try {
            await register({ email, username, password });
            toast.success('Account created', 'Welcome to DockerForge');
            navigate('/', { replace: true });
        } catch (err) {
            setError(
                err instanceof ApiError ? err.message : 'Registration failed',
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div>
                <Label htmlFor="signup-email">Email</Label>
                <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    tabIndex={tabbable ? 0 : -1}
                    className={inputMotion}
                />
            </div>
            <div>
                <Label htmlFor="signup-username">Username</Label>
                <Input
                    id="signup-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="forgemaster"
                    invalid={touched && username.length > 0 && !usernameOk}
                    required
                    tabIndex={tabbable ? 0 : -1}
                    className={inputMotion}
                />
                {touched && username.length > 0 && !usernameOk && (
                    <FieldError>
                        3–30 chars, letters/numbers/_/- and no leading or
                        trailing _ or -
                    </FieldError>
                )}
            </div>
            <div>
                <Label htmlFor="signup-password">Password</Label>
                <Input
                    id="signup-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    tabIndex={tabbable ? 0 : -1}
                    className={inputMotion}
                />
                <ul className="mt-2.5 grid grid-cols-2 gap-1.5">
                    {PASSWORD_RULES.map((rule) => {
                        const ok = rule.test(password);
                        return (
                            <li
                                key={rule.id}
                                className={cn(
                                    'flex items-center gap-1.5 text-2xs transition-colors',
                                    ok ? 'text-ok' : 'text-dim',
                                )}
                            >
                                <span
                                    className={cn(
                                        'grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border',
                                        ok
                                            ? 'border-ok bg-ok/15'
                                            : 'border-line2',
                                    )}
                                >
                                    {ok ? (
                                        <Check className="h-2.5 w-2.5" />
                                    ) : (
                                        <X className="h-2.5 w-2.5 opacity-40" />
                                    )}
                                </span>
                                {rule.label}
                            </li>
                        );
                    })}
                </ul>
            </div>
            {error && <FieldError>{error}</FieldError>}
            <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                disabled={touched && !canSubmit}
                tabIndex={tabbable ? 0 : -1}
                className="w-full transition-transform duration-150 ease-out active:scale-[0.98] motion-reduce:active:scale-100"
            >
                Create account
            </Button>
        </form>
    );
}
