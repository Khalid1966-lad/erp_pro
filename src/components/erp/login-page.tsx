'use client'

import { useState } from 'react'
import { useAuthStore } from '@/lib/stores'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, Info } from 'lucide-react'
import { APP_VERSION } from '@/lib/version'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-lg border-slate-200">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-20 h-20 relative">
            <Image
              src="/logo.avif"
              alt="GEMA ERP PRO"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">GEMA ERP PRO</CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              ERP de Production — Maroc
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@gema-erp.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Se connecter
            </Button>
          </form>
          <div className="mt-6 space-y-3">
            <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 font-medium mb-1.5">
                <Info className="h-3 w-3" />
                Comptes de démonstration
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  className="flex items-center justify-between w-full hover:text-foreground transition-colors"
                  onClick={() => { setEmail('admin@gema-erp.com'); setPassword('admin123') }}
                >
                  <span>Admin</span>
                  <span className="font-mono text-[10px] opacity-70">admin@gema-erp.com</span>
                </button>
                <button
                  type="button"
                  className="flex items-center justify-between w-full hover:text-foreground transition-colors"
                  onClick={() => { setEmail('commercial@gema-erp.com'); setPassword('pass123') }}
                >
                  <span>Commercial</span>
                  <span className="font-mono text-[10px] opacity-70">commercial@gema-erp.com</span>
                </button>
                <button
                  type="button"
                  className="flex items-center justify-between w-full hover:text-foreground transition-colors"
                  onClick={() => { setEmail('magasinier@gema-erp.com'); setPassword('pass123') }}
                >
                  <span>Magasinier</span>
                  <span className="font-mono text-[10px] opacity-70">magasinier@gema-erp.com</span>
                </button>
                <button
                  type="button"
                  className="flex items-center justify-between w-full hover:text-foreground transition-colors"
                  onClick={() => { setEmail('production@gema-erp.com'); setPassword('pass123') }}
                >
                  <span>Production</span>
                  <span className="font-mono text-[10px] opacity-70">production@gema-erp.com</span>
                </button>
                <button
                  type="button"
                  className="flex items-center justify-between w-full hover:text-foreground transition-colors"
                  onClick={() => { setEmail('acheteur@gema-erp.com'); setPassword('pass123') }}
                >
                  <span>Acheteur</span>
                  <span className="font-mono text-[10px] opacity-70">acheteur@gema-erp.com</span>
                </button>
              </div>
            </div>
            <p className="text-center text-[10px] text-muted-foreground">
              GEMA ERP PRO v{APP_VERSION}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
