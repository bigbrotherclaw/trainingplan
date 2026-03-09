import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const EDGE_BASE = import.meta.env.VITE_SUPABASE_URL + '/functions/v1';

export function useGarmin() {
  const { session } = useAuth();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState({ activities: [] });

  // ── Check connection status ──
  const checkStatus = useCallback(async () => {
    if (!session?.access_token) {
      setConnected(false);
      setLoading(false);
      return;
    }

    try {
      const resp = await fetch(`${EDGE_BASE}/garmin-auth/status`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await resp.json();
      console.log('[Garmin] status check:', result);
      setConnected(result.connected);
      return result.connected;
    } catch (err) {
      console.error('[Garmin] status check failed:', err);
      setConnected(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, [session]);

  // Initial status check
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // ── Connect with email/password ──
  const connect = useCallback(async (email, password) => {
    if (!session?.access_token) return { error: 'Not authenticated' };

    try {
      const resp = await fetch(`${EDGE_BASE}/garmin-auth/connect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      const result = await resp.json();

      if (!resp.ok) {
        return { error: result.error || 'Connection failed' };
      }

      // Check if MFA is needed
      if (result.needsMfa) {
        return { needsMfa: true };
      }

      setConnected(true);
      // Trigger initial sync
      setTimeout(async () => {
        await syncDataDirect(30);
        await loadCachedData(30);
      }, 500);

      return { success: true };
    } catch (err) {
      console.error('[Garmin] Connect failed:', err);
      return { error: err.message };
    }
  }, [session]);

  // ── Verify MFA code ──
  const verifyMfa = useCallback(async (code) => {
    if (!session?.access_token) return { error: 'Not authenticated' };

    try {
      const resp = await fetch(`${EDGE_BASE}/garmin-auth/verify-mfa`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });
      const result = await resp.json();

      if (!resp.ok) {
        return { error: result.error || 'MFA verification failed' };
      }

      setConnected(true);
      setTimeout(async () => {
        await syncDataDirect(30);
        await loadCachedData(30);
      }, 500);

      return { success: true };
    } catch (err) {
      console.error('[Garmin] MFA verification failed:', err);
      return { error: err.message };
    }
  }, [session]);

  // ── Disconnect ──
  const disconnect = useCallback(async () => {
    if (!session?.access_token) return;

    try {
      await fetch(`${EDGE_BASE}/garmin-auth/disconnect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      setConnected(false);
      setData({ activities: [] });
    } catch (err) {
      console.error('[Garmin] Disconnect failed:', err);
    }
  }, [session]);

  // ── Sync data (direct, doesn't depend on `connected` state) ──
  const syncDataDirect = useCallback(async (days = 7, quickCheck = false) => {
    if (!session?.access_token) return;

    setSyncing(true);
    try {
      console.log('[Garmin] Syncing data, days:', days, 'quickCheck:', quickCheck);
      const resp = await fetch(`${EDGE_BASE}/garmin-sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ days, quickCheck }),
      });
      const result = await resp.json();
      console.log('[Garmin] Sync result:', result);
      if (!result.noNewData) {
        await loadCachedData(days);
      }
    } catch (err) {
      console.error('[Garmin] Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  }, [session]);

  // ── Public sync (checks connected state) ──
  const syncData = useCallback(async (days = 7) => {
    if (!connected) return;
    return syncDataDirect(days);
  }, [connected, syncDataDirect]);

  // ── Load cached data from Supabase ──
  const loadCachedData = useCallback(async (days = 30) => {
    if (!session) return;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startStr = startDate.toISOString().split('T')[0];

    try {
      const { data: records, error } = await supabase
        .from('garmin_data')
        .select('*')
        .gte('date', startStr)
        .order('date', { ascending: true });

      if (error) throw error;

      const activities = [];
      for (const r of records || []) {
        if (r.data_type.startsWith('activity:')) {
          activities.push({ date: r.date, ...r.data });
        }
      }

      console.log('[Garmin] Loaded cached data:', { activities: activities.length });
      setData({ activities });
    } catch (err) {
      console.error('[Garmin] Failed to load cached data:', err);
    }
  }, [session]);

  // Load cached data on mount if connected, then sync fresh
  useEffect(() => {
    if (connected) {
      loadCachedData(30);
      const initialSync = setTimeout(() => {
        console.log('[Garmin] Auto-sync: fetching fresh data...');
        syncDataDirect(7).then(() => loadCachedData(30));
      }, 2000);
      return () => clearTimeout(initialSync);
    }
  }, [connected, loadCachedData, syncDataDirect]);

  // Periodic refresh every 10 minutes (with quick check to skip if no new data)
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => {
      console.log('[Garmin] Periodic sync: quick check for new data...');
      syncDataDirect(3, true).then(() => loadCachedData(30));
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [connected, syncDataDirect, loadCachedData]);

  // ── App foreground detection: sync when app comes back ──
  useEffect(() => {
    if (!connected) return;

    let capacitorListener = null;

    // Capacitor native: listen for appStateChange
    if (window.Capacitor?.isNativePlatform()) {
      const setup = async () => {
        try {
          const { App: CapApp } = await import('@capacitor/app');
          capacitorListener = await CapApp.addListener('appStateChange', (state) => {
            if (state.isActive) {
              console.log('[Garmin] App foregrounded, syncing...');
              syncDataDirect(3, true);
            }
          });
        } catch (err) {
          console.error('[Garmin] Failed to set up appStateChange listener:', err);
        }
      };
      setup();
    }

    // Web: listen for visibilitychange
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Garmin] Tab visible, syncing...');
        syncDataDirect(3, true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (capacitorListener) capacitorListener.remove();
    };
  }, [connected, syncDataDirect]);

  // ── Supabase Realtime: instant UI updates when garmin_data changes ──
  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel('garmin-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'garmin_data',
        filter: `user_id=eq.${session.user.id}`,
      }, () => {
        console.log('[Garmin] Realtime update received');
        loadCachedData(30);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [session?.user?.id, loadCachedData]);

  const activities = data.activities;

  return {
    connected,
    loading,
    syncing,
    data,
    activities,
    connect,
    verifyMfa,
    disconnect,
    syncData,
    loadCachedData,
  };
}
