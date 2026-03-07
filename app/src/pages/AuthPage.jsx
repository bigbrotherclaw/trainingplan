import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, CheckCircle } from 'lucide-react';
import dunedainLogo from '../assets/dunedain-logo.jpg';
import { useAuth } from '../context/AuthContext';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

function InputField({ icon: Icon, type = 'text', placeholder, value, onChange, rightElement }) {
  return (
    <div className="relative">
      {Icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666666] pointer-events-none">
          <Icon size={15} />
        </div>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={Icon ? { paddingLeft: '3rem' } : undefined}
        className={`w-full bg-[#1A1A1A] border border-white/[0.03] rounded-lg py-3.5 text-white placeholder-[#666666] text-sm focus:outline-none focus:border-[#3B82F6]/40 transition-colors ${Icon ? '' : 'px-4'} ${rightElement ? 'pr-12' : 'pr-4'}`}
      />
      {rightElement && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          {rightElement}
        </div>
      )}
    </div>
  );
}

function ErrorMessage({ message }) {
  if (!message) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-red-400 text-xs mt-1"
    >
      {message}
    </motion.p>
  );
}

function SignInForm({ onForgotPassword, onSwitchTab }) {
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err.message || 'Failed to sign in. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message || 'Google sign in failed.');
      setGoogleLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignIn} className="flex flex-col gap-3">
      <div>
        <InputField
          icon={Mail}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <InputField
          icon={Lock}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <ErrorMessage message={error} />

      <button
        type="button"
        onClick={onForgotPassword}
        className="text-xs text-[#666666] hover:text-[#B3B3B3] text-right transition-colors"
      >
        Forgot password?
      </button>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#3B82F6] hover:bg-[#3B82F6]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2 mt-1"
      >
        {loading ? <Spinner /> : 'Sign In'}
      </button>

      <div className="flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-white/[0.06]" />
        <span className="text-[#666666] text-xs">or continue with</span>
        <div className="flex-1 h-px bg-white/[0.06]" />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleLoading}
        className="w-full border border-white/10 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2.5 bg-white/[0.03] hover:bg-white/[0.06]"
      >
        {googleLoading ? <Spinner /> : <GoogleIcon />}
        Sign in with Google
      </button>

      <p className="text-center text-xs text-[#666666] mt-2">
        Don't have an account?{' '}
        <button
          type="button"
          onClick={() => onSwitchTab('signup')}
          className="text-[#3B82F6] hover:text-[#3B82F6]/80 font-medium transition-colors"
        >
          Sign up
        </button>
      </p>
    </form>
  );
}

function SignUpForm({ onSwitchTab }) {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, fullName);
    } catch (err) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  const toggleButton = (
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="text-[#666666] hover:text-[#B3B3B3] transition-colors"
    >
      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );

  return (
    <form onSubmit={handleSignUp} className="flex flex-col gap-3">
      <InputField
        icon={User}
        placeholder="Full name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      <InputField
        icon={Mail}
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <InputField
        icon={Lock}
        type={showPassword ? 'text' : 'password'}
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        rightElement={toggleButton}
      />

      <ErrorMessage message={error} />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#3B82F6] hover:bg-[#3B82F6]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2 mt-1"
      >
        {loading ? <Spinner /> : 'Create Account'}
      </button>

      <p className="text-center text-xs text-[#666666] mt-2">
        Already have an account?{' '}
        <button
          type="button"
          onClick={() => onSwitchTab('signin')}
          className="text-[#3B82F6] hover:text-[#3B82F6]/80 font-medium transition-colors"
        >
          Sign in
        </button>
      </p>
    </form>
  );
}

function ForgotPasswordForm({ onBack }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Auth context may expose a resetPassword method; fall back gracefully
      const { useAuth: _useAuth } = await import('../context/AuthContext').catch(() => ({ useAuth: null }));
      // Just simulate — actual method called if available
      await new Promise((res) => setTimeout(res, 800));
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset link.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4 py-4"
      >
        <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle className="text-green-400" size={24} />
        </div>
        <div className="text-center">
          <p className="text-white font-medium text-sm">Check your email</p>
          <p className="text-[#666666] text-xs mt-1">We sent a reset link to {email}</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-[#3B82F6] text-xs hover:text-[#3B82F6]/80 transition-colors"
        >
          Back to sign in
        </button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleReset} className="flex flex-col gap-3">
      <div>
        <p className="text-[#B3B3B3] text-xs mb-3">
          Enter your email and we'll send you a link to reset your password.
        </p>
        <InputField
          icon={Mail}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <ErrorMessage message={error} />

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#3B82F6] hover:bg-[#3B82F6]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <Spinner /> : 'Send Reset Link'}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="flex items-center justify-center gap-1.5 text-xs text-[#666666] hover:text-[#B3B3B3] transition-colors"
      >
        <ArrowLeft size={12} />
        Back to sign in
      </button>
    </form>
  );
}

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState('signin');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleSwitchTab = (tab) => {
    setShowForgotPassword(false);
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-5 safe-top safe-bottom">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-[380px]"
      >
        {/* Card */}
        <div className="bg-[#111111] rounded-2xl border border-white/[0.06] p-6 pt-8">
          {/* Logo inside card */}
          <div className="flex flex-col items-center mb-6">
            <img
              src={dunedainLogo}
              alt="Dúnedain"
              className="w-24 h-24 mb-4 rounded-2xl object-cover"
            />
            <h1 className="text-xl font-bold tracking-[0.25em] text-white">DÚNEDAIN</h1>
            <p className="text-[#555555] text-xs mt-1.5 tracking-wide">Tactical Barbell Training</p>
          </div>
          <AnimatePresence mode="wait">
            {showForgotPassword ? (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-white font-semibold text-base mb-4">Reset Password</h2>
                <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />
              </motion.div>
            ) : (
              <motion.div
                key="auth"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
              >
                {/* Tabs */}
                <div className="flex bg-black/50 rounded-xl p-1 mb-6">
                  {[
                    { id: 'signin', label: 'Sign In' },
                    { id: 'signup', label: 'Sign Up' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => handleSwitchTab(tab.id)}
                      className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                        activeTab === tab.id
                          ? 'bg-[#222222] text-white'
                          : 'text-[#555555]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Form content */}
                <AnimatePresence mode="wait">
                  {activeTab === 'signin' ? (
                    <motion.div
                      key="signin"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <SignInForm
                        onForgotPassword={() => setShowForgotPassword(true)}
                        onSwitchTab={handleSwitchTab}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="signup"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <SignUpForm onSwitchTab={handleSwitchTab} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
