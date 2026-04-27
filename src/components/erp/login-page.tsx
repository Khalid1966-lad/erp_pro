'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/stores'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { APP_VERSION } from '@/lib/version'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { login } = useAuthStore()

  useEffect(() => {
    // Trigger entrance animations after mount
    const timer = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const data = await api.post<{ token: string; user: { id: string; email: string; name: string; role: string } }>(
        '/auth/login',
        { email, password }
      )
      login(data.token, data.user)
      toast.success('Connexion réussie', { description: `Bienvenue ${data.user.name}` })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erreur de connexion'
      toast.error('Erreur de connexion', { description: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-aurora-wrapper">
      {/* Aurora Borealis Background */}
      <div className="login-aurora-bg" aria-hidden="true">
        {/* Stars */}
        <div className="login-stars" />
        {/* Aurora layers */}
        <div className="login-aurora login-aurora-1" />
        <div className="login-aurora login-aurora-2" />
        <div className="login-aurora login-aurora-3" />
        <div className="login-aurora login-aurora-4" />
        <div className="login-aurora login-aurora-5" />
        {/* Horizon glow */}
        <div className="login-horizon" />
      </div>

      {/* Login Card */}
      <div
        className={`login-card-container ${mounted ? 'login-card-enter' : ''}`}
      >
        <div className="login-card-glass">
          {/* Logo */}
          <div className="login-logo-wrap">
            <div className="login-logo-ring">
              <Image
                src="/logo.png"
                alt="GEMA ERP PRO"
                width={72}
                height={72}
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* Title */}
          <div className="login-title-section">
            <h1 className="login-title">GEMA ERP PRO</h1>
            <p className="login-subtitle">Solution de Gestion Intégrée</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <Label htmlFor="email" className="login-label">Adresse email</Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="login-input"
                autoComplete="email"
              />
            </div>
            <div className="login-field">
              <Label htmlFor="password" className="login-label">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="login-input login-input-password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Se connecter
            </Button>
          </form>

          {/* Footer */}
          <p className="login-footer">
            GEMA ERP PRO v{APP_VERSION}
          </p>
        </div>
      </div>
    </div>
  )
}
