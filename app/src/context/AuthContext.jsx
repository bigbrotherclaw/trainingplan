import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [userSettings, setUserSettings] = useState(null)

  async function fetchUserData(userId) {
    const [{ data: profileData }, { data: settingsData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('user_settings').select('*').eq('id', userId).single(),
    ])
    setProfile(profileData ?? null)
    setUserSettings(settingsData ?? null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchUserData(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserData(session.user.id)
      } else {
        setProfile(null)
        setUserSettings(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signUp(email, password, fullName) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (error) return { error }
      return { data }
    } catch (error) {
      return { error }
    }
  }

  async function signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error }
      return { data }
    } catch (error) {
      return { error }
    }
  }

  async function signInWithGoogle() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname },
      })
      if (error) return { error }
      return { data }
    } catch (error) {
      return { error }
    }
  }

  async function signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) return { error }
      return {}
    } catch (error) {
      return { error }
    }
  }

  async function updateProfile(updates) {
    if (!user) return { error: new Error('Not authenticated') }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, ...updates })
        .select()
        .single()
      if (error) return { error }
      setProfile(data)
      return { data }
    } catch (error) {
      return { error }
    }
  }

  async function updateSettings(updates) {
    if (!user) return { error: new Error('Not authenticated') }
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .upsert({ id: user.id, ...updates })
        .select()
        .single()
      if (error) return { error }
      setUserSettings(data)
      return { data }
    } catch (error) {
      return { error }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        profile,
        userSettings,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        updateProfile,
        updateSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
