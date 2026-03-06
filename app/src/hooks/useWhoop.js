import { useState, useEffect, useCallback } from 'react';
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

  // Check connection status
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
      setConnected(result.connected);
    } catch (err) {
      console.error('Whoop status check failed:', err);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Check URL params for OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const whoopStatus = params.get('whoop');
    if (whoopStatus === 'connected') {
      setConnected(true);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      // Trigger initial sync
      syncData(30);
    } else if (whoopStatus === 'error') {
      console.error('Whoop connection failed');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Initiate Whoop connection
  const connect = useCallback(async () => {
    if (!session?.access_token) return;

    try {
      const resp = await fetch(`${EDGE_BASE}/whoop-auth/login`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await resp.json();

      if (result.url) {
        // On native iOS, use Capacitor Browser
        if (window.Capacitor?.isNativePlatform()) {
          const { Browser } = await import('@capacitor/browser');
          // Listen for browser close to re-check connection status
          const listener = await Browser.addListener('browserFinished', () => {
            listener.remove();
            // Re-check connection after OAuth flow completes
            setTimeout(() => checkStatus(), 500);
            setTimeout(() => { checkStatus(); loadCachedData(30); }, 2000);
          });
          await Browser.open({ url: result.url });
        } else {
          window.location.href = result.url;
        }
      }
    } catch (err) {
      console.error('Failed to start Whoop connection:', err);
    }
  }, [session]);

  // Disconnect Whoop
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
      console.error('Failed to disconnect Whoop:', err);
    }
  }, [session]);

  // Sync data from Whoop
  const syncData = useCallback(async (days = 7) => {
    if (!session?.access_token || !connected) return;

    setSyncing(true);
    try {
      await fetch(`${EDGE_BASE}/whoop-sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'all', days }),
      });

      // Fetch cached data from Supabase
      await loadCachedData(days);
    } catch (err) {
      console.error('Whoop sync failed:', err);
    } finally {
      setSyncing(false);
    }
  }, [session, connected]);

  // Load cached data from Supabase
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
        if (grouped[r.data_type]) {
          grouped[r.data_type].push({ date: r.date, ...r.data });
        }
      }
      setData(grouped);
    } catch (err) {
      console.error('Failed to load cached Whoop data:', err);
    }
  }, [session]);

  // Load cached data on mount if connected
  useEffect(() => {
    if (connected) {
      loadCachedData(30);
    }
  }, [connected, loadCachedData]);

  // Derived data
  const latestRecovery = data.recovery[data.recovery.length - 1];
  const latestSleep = data.sleep[data.sleep.length - 1];
  const latestCycle = data.cycle[data.cycle.length - 1];

  return {
    connected,
    loading,
    syncing,
    data,
    latestRecovery,
    latestSleep,
    latestCycle,
    connect,
    disconnect,
    syncData,
    loadCachedData,
  };
}
