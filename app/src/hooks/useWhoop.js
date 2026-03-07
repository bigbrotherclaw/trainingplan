import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const EDGE_BASE = import.meta.env.VITE_SUPABASE_URL + '/functions/v1';

export function useWhoop() {
  const { session } = useAuth();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState({
    recovery: [],
    sleep: [],
    cycle: [],
    workout: [],
  });
  const pendingOAuth = useRef(false);

  // ── Check connection status ──
  const checkStatus = useCallback(async () => {
    if (!session?.access_token) {
      setConnected(false);
      setLoading(false);
      return;
    }

    try {
      const resp = await fetch(`${EDGE_BASE}/whoop-auth/status`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await resp.json();
      console.log('[Whoop] status check:', result);
      setConnected(result.connected);
      return result.connected;
    } catch (err) {
      console.error('[Whoop] status check failed:', err);
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

  // ── Deep link listener for native OAuth callback ──
  // When the edge function redirects to com.bigbrother.trainingplan://whoop-callback?whoop=connected,
  // Capacitor fires appUrlOpen. This closes the SFSafariViewController automatically.
  useEffect(() => {
    if (!window.Capacitor?.isNativePlatform()) return;

    let appListener = null;

    const setup = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        appListener = await CapApp.addListener('appUrlOpen', async (event) => {
          console.log('[Whoop] Deep link received:', event.url);

          if (event.url.includes('whoop-callback')) {
            const params = new URL(event.url).searchParams;
            const status = params.get('whoop');

            if (status === 'connected') {
              console.log('[Whoop] OAuth success via deep link');
              setConnected(true);
              pendingOAuth.current = false;
              // Trigger initial data sync
              setTimeout(async () => {
                await syncDataDirect(30);
                await loadCachedData(30);
              }, 500);
            } else if (status === 'error') {
              const reason = params.get('reason') || 'unknown';
              console.error('[Whoop] OAuth failed:', reason);
              pendingOAuth.current = false;
            }
          }
        });
      } catch (err) {
        console.error('[Whoop] Failed to set up deep link listener:', err);
      }
    };

    setup();

    return () => {
      if (appListener) appListener.remove();
    };
  }, [session]);

  // ── Also listen for browser close (fallback) ──
  useEffect(() => {
    if (!window.Capacitor?.isNativePlatform()) return;
    if (!pendingOAuth.current) return;

    // Poll for connection after browser closes (in case deep link doesn't fire)
    let browserListener = null;

    const setup = async () => {
      try {
        const { Browser } = await import('@capacitor/browser');
        browserListener = await Browser.addListener('browserFinished', async () => {
          console.log('[Whoop] Browser closed, checking status...');
          browserListener?.remove();
          if (pendingOAuth.current) {
            const isConnected = await checkStatus();
            if (isConnected) {
              await loadCachedData(30);
            }
            pendingOAuth.current = false;
          }
        });
      } catch (err) {
        console.error('[Whoop] Failed to set up browser listener:', err);
      }
    };

    setup();

    return () => {
      if (browserListener) browserListener.remove();
    };
  }, [pendingOAuth.current, checkStatus]);

  // ── Web URL params check (for web OAuth flow) ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const whoopStatus = params.get('whoop');
    if (whoopStatus === 'connected') {
      setConnected(true);
      window.history.replaceState({}, '', window.location.pathname);
      syncDataDirect(30);
    } else if (whoopStatus === 'error') {
      console.error('[Whoop] OAuth failed (web):', params.get('reason'));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // ── Initiate Whoop connection ──
  const connect = useCallback(async () => {
    if (!session?.access_token) return;

    try {
      const isNative = window.Capacitor?.isNativePlatform();
      const platform = isNative ? 'native' : 'web';

      const resp = await fetch(`${EDGE_BASE}/whoop-auth/login?platform=${platform}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await resp.json();
      console.log('[Whoop] Got auth URL, platform:', platform);

      if (result.url) {
        pendingOAuth.current = true;

        if (isNative) {
          const { Browser } = await import('@capacitor/browser');
          await Browser.open({ url: result.url });
        } else {
          window.location.href = result.url;
        }
      }
    } catch (err) {
      console.error('[Whoop] Failed to start connection:', err);
    }
  }, [session]);

  // ── Disconnect ──
  const disconnect = useCallback(async () => {
    if (!session?.access_token) return;

    try {
      await fetch(`${EDGE_BASE}/whoop-auth/disconnect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      setConnected(false);
      setData({ recovery: [], sleep: [], cycle: [], workout: [] });
    } catch (err) {
      console.error('[Whoop] Disconnect failed:', err);
    }
  }, [session]);

  // ── Sync data (direct, doesn't depend on `connected` state) ──
  const syncDataDirect = useCallback(async (days = 7) => {
    if (!session?.access_token) return;

    setSyncing(true);
    try {
      console.log('[Whoop] Syncing data, days:', days);
      const resp = await fetch(`${EDGE_BASE}/whoop-sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'all', days }),
      });
      const result = await resp.json();
      console.log('[Whoop] Sync result:', result);
      await loadCachedData(days);
    } catch (err) {
      console.error('[Whoop] Sync failed:', err);
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
        .from('whoop_data')
        .select('*')
        .gte('date', startStr)
        .order('date', { ascending: true });

      if (error) throw error;

      const grouped = { recovery: [], sleep: [], cycle: [], workout: [] };
      for (const r of records || []) {
        // Handle workout:uuid format (multiple workouts per day)
        const baseType = r.data_type.startsWith('workout:') ? 'workout' : r.data_type;
        if (grouped[baseType]) {
          grouped[baseType].push({ date: r.date, ...r.data });
        }
      }
      console.log('[Whoop] Loaded cached data:', {
        recovery: grouped.recovery.length,
        sleep: grouped.sleep.length,
        cycle: grouped.cycle.length,
        workout: grouped.workout.length,
      });
      setData(grouped);
    } catch (err) {
      console.error('[Whoop] Failed to load cached data:', err);
    }
  }, [session]);

  // Load cached data on mount if connected
  useEffect(() => {
    if (connected) {
      loadCachedData(30);
    }
  }, [connected, loadCachedData]);

  // ── Derived latest values ──
  const latestRecovery = data.recovery.length > 0 ? data.recovery[data.recovery.length - 1] : null;
  const latestSleep = data.sleep.length > 0 ? data.sleep[data.sleep.length - 1] : null;
  const latestCycle = data.cycle.length > 0 ? data.cycle[data.cycle.length - 1] : null;
  const workouts = data.workout;

  return {
    connected,
    loading,
    syncing,
    data,
    workouts,
    latestRecovery,
    latestSleep,
    latestCycle,
    connect,
    disconnect,
    syncData,
    loadCachedData,
  };
}
