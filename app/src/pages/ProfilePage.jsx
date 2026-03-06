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
        className="w-20 h-20 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="w-20 h-20 rounded-full bg-accent-blue text-[28px] font-bold text-white flex items-center justify-center">
      {initials ? initials : <User size={32} />}
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
        className="relative w-full max-w-sm bg-[#111111] rounded-2xl border border-white/[0.06] p-6 z-10"
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
            className="flex-1 min-h-[48px] border border-white/[0.06] text-[#B3B3B3] font-semibold rounded-xl text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 min-h-[48px] bg-red-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
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
      <div className="px-5 pt-4 pb-28 min-h-screen bg-black">
        <div className="max-w-[440px] mx-auto flex flex-col gap-5">

          {/* Top: Avatar + Name + Email */}
          <div className="flex flex-col items-center text-center mb-8">
            <Avatar profile={profile} user={user} />

            {editingName ? (
              <div className="flex flex-col items-center gap-2 mt-4 w-full">
                <input
                  ref={inputRef}
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') handleCancelName();
                  }}
                  className="bg-[#1A1A1A] border border-[#3B82F6]/40 rounded-xl px-4 py-3 min-h-[48px] text-white text-center text-base font-semibold focus:outline-none w-56"
                />
                {nameError && <p className="text-red-400 text-xs">{nameError}</p>}
                <div className="flex gap-2 w-56">
                  <button
                    onClick={handleSaveName}
                    disabled={nameLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 min-h-[48px] bg-[#3B82F6] disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    {nameLoading ? <Spinner /> : <Check size={14} />}
                    Save
                  </button>
                  <button
                    onClick={handleCancelName}
                    className="flex-1 flex items-center justify-center gap-1.5 min-h-[48px] border border-white/[0.06] text-[#B3B3B3] text-sm font-semibold rounded-xl transition-colors"
                  >
                    <X size={14} />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <h1 className="text-[22px] font-bold text-white">
                    {profile?.display_name || 'Unnamed Operator'}
                  </h1>
                  <button
                    onClick={handleEditName}
                    className="text-[#666666] active:text-[#B3B3B3] transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
                <p className="text-[15px] text-[#666666] mt-1">{user?.email}</p>
              </>
            )}
          </div>

          {/* Account info card */}
          <div className="bg-[#111111] rounded-2xl border border-white/[0.06] p-5 space-y-4">
            <p className="text-[12px] uppercase tracking-widest text-[#555555] font-semibold">Account</p>
            {memberSince && (
              <div className="flex justify-between py-2 border-b border-white/[0.04]">
                <span className="text-[15px] text-[#A0A0A0]">Member since</span>
                <span className="text-[15px] font-semibold text-white">{memberSince}</span>
              </div>
            )}
            <div className="flex justify-between py-2">
              <span className="text-[15px] text-[#A0A0A0]">Email</span>
              <span className="text-[15px] font-semibold text-white truncate ml-4 max-w-[200px]">{user?.email}</span>
            </div>
          </div>

          {/* Export */}
          <button
            onClick={handleExport}
            className="w-full min-h-[48px] bg-[#111111] border border-white/[0.06] rounded-2xl text-[15px] font-medium text-white flex items-center justify-center gap-2"
          >
            <Download size={16} />
            Export Data
          </button>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            disabled={signOutLoading}
            className="w-full min-h-[48px] border border-red-500/20 rounded-2xl text-red-400 text-[15px] font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {signOutLoading ? <Spinner /> : <LogOut size={16} />}
            Sign Out
          </button>

          {/* Delete Account */}
          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full min-h-[48px] text-red-400/50 text-[13px] flex items-center justify-center"
          >
            Delete Account
          </button>

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
