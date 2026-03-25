import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signUp = (email, password, fullName) =>
    supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })

  const signOut = () => supabase.auth.signOut()

  const enrollMFA = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
    return { data, error }
  }

  const verifyMFA = async (factorId, code) => {
    const { data: challenge } = await supabase.auth.mfa.challenge({ factorId })
    return supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code })
  }

  const loading = session === undefined

  return (
    <AuthContext.Provider value={{ session, profile, setProfile, signIn, signUp, signOut, enrollMFA, verifyMFA, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
