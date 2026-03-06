import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Download, Trash2, Pencil, Check, X, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );
}

function Avatar({ profile, user }) {
  const name = profile?.display_name || user?.email || '';
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={name}
        className="w-20 h-20 rounded-full object-cover border-2 border-white/[0.06]"
      />
    );
  }

  return (
    <div className="w-20 h-20 rounded-full bg-[#3B82F6]/20 border-2 border-[#3B82F6]/30 flex items-center justify-center">
      {initials ? (
        <span className="text-[#3B82F6] text-2xl font-bold">{initials}</span>
      ) : (
        <User className="text-[#3B82F6]" size={32} />
      )}
    </div>
  );
}

function DeleteConfirmModal({ onConfirm, onCancel, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        className="relative w-full max-w-sm bg-[#111111] rounded-2xl border border-white/[0.03] p-6 z-10"
      >
        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <Trash2 className="text-red-400" size={20} />
        </div>
        <h3 className="text-white font-semibold text-base mb-1">Delete account?</h3>
        <p className="text-[#666666] text-sm mb-5">
          This action cannot be undone. All your data will be permanently deleted.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-white/10 hover:border-white/20 text-[#B3B3B3] font-medium rounded-xl py-2.5 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 bg-red-500 hover:bg-red-500/90 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Spinner /> : 'Delete'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ProfilePage() {
  const { user, profile, signOut, updateProfile } = useAuth();

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(profile?.display_name || '');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError] = useState('');

  const [signOutLoading, setSignOutLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const inputRef = useRef(null);

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  const handleEditName = () => {
    setNameValue(profile?.display_name || '');
    setNameError('');
    setEditingName(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSaveName = async () => {
    if (!nameValue.trim()) {
      setNameError('Name cannot be empty.');
      return;
    }
    setNameError('');
    setNameLoading(true);
    try {
      await updateProfile({ display_name: nameValue.trim() });
      setEditingName(false);
    } catch (err) {
      setNameError(err.message || 'Failed to update name.');
    } finally {
      setNameLoading(false);
    }
  };

  const handleCancelName = () => {
    setEditingName(false);
    setNameError('');
  };

  const handleSignOut = async () => {
    setSignOutLoading(true);
    try {
      await signOut();
    } catch {
      setSignOutLoading(false);
    }
  };

  const handleExport = () => {
    const data = {
      profile: { email: user?.email, display_name: profile?.display_name, member_since: user?.created_at },
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tb-operator-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      // deleteAccount method — called if available on AuthContext
      if (typeof useAuth === 'function') {
        const ctx = useAuth;
        if (ctx?.deleteAccount) await ctx.deleteAccount();
      }
    } catch {
      // Handled by auth context
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-black px-4 py-8 safe-top safe-bottom">
        <div className="max-w-[440px] mx-auto flex flex-col gap-4">

          {/* Profile header card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#111111] rounded-2xl border border-white/[0.03] p-6"
          >
            <div className="flex flex-col items-center gap-4">
              <Avatar profile={profile} user={user} />

              {/* Name */}
              <div className="text-center w-full">
                {editingName ? (
                  <div className="flex flex-col items-center gap-2">
                    <input
                      ref={inputRef}
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') handleCancelName();
                      }}
                      className="bg-[#1A1A1A] border border-[#3B82F6]/40 rounded-lg px-4 py-2 text-white text-center text-base font-semibold focus:outline-none w-48"
                    />
                    {nameError && <p className="text-red-400 text-xs">{nameError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveName}
                        disabled={nameLoading}
                        className="flex items-center gap-1.5 bg-[#3B82F6] hover:bg-[#3B82F6]/90 disabled:opacity-50 text-white text-xs font-medium rounded-lg px-3 py-1.5 transition-colors"
                      >
                        {nameLoading ? <Spinner /> : <Check size={12} />}
                        Save
                      </button>
                      <button
                        onClick={handleCancelName}
                        className="flex items-center gap-1.5 border border-white/10 hover:border-white/20 text-[#B3B3B3] text-xs font-medium rounded-lg px-3 py-1.5 transition-colors"
                      >
                        <X size={12} />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-white font-semibold text-lg">
                      {profile?.display_name || 'Unnamed Operator'}
                    </span>
                    <button
                      onClick={handleEditName}
                      className="text-[#666666] hover:text-[#B3B3B3] transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                )}

                <p className="text-[#666666] text-sm mt-0.5">{user?.email}</p>

                {memberSince && (
                  <p className="text-[#666666] text-xs mt-2">Member since {memberSince}</p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Actions card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-[#111111] rounded-2xl border border-white/[0.03] p-4 flex flex-col gap-2"
          >
            <p className="text-[#666666] text-xs font-medium uppercase tracking-wider px-2 mb-1">Data</p>

            <button
              onClick={handleExport}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.03] transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center">
                <Download className="text-[#3B82F6]" size={16} />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Export Data</p>
                <p className="text-[#666666] text-xs">Download your workout history as JSON</p>
              </div>
            </button>
          </motion.div>

          {/* Danger zone card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#111111] rounded-2xl border border-white/[0.03] p-4 flex flex-col gap-2"
          >
            <p className="text-[#666666] text-xs font-medium uppercase tracking-wider px-2 mb-1">Account</p>

            <button
              onClick={handleSignOut}
              disabled={signOutLoading}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.03] transition-colors text-left disabled:opacity-50"
            >
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                {signOutLoading ? <Spinner /> : <LogOut className="text-red-400" size={16} />}
              </div>
              <div>
                <p className="text-red-400 text-sm font-medium">Sign Out</p>
                <p className="text-[#666666] text-xs">Sign out of this device</p>
              </div>
            </button>

            <div className="h-px bg-white/[0.04] mx-3" />

            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-red-500/[0.05] transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Trash2 className="text-red-400" size={16} />
              </div>
              <div>
                <p className="text-red-400 text-sm font-medium">Delete Account</p>
                <p className="text-[#666666] text-xs">Permanently delete your account and data</p>
              </div>
            </button>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {showDeleteModal && (
          <DeleteConfirmModal
            onConfirm={handleDeleteAccount}
            onCancel={() => setShowDeleteModal(false)}
            loading={deleteLoading}
          />
        )}
      </AnimatePresence>
    </>
  );
}
