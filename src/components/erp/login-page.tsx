'use client'

import { useState } from 'react'
import { useAuthStore } from '@/lib/stores'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Factory, Eye, EyeOff, Loader2 } from 'lucide-react'

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
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center">
            <Factory className="w-9 h-9 text-primary-foreground" />
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
          <div className="mt-6 p-3 bg-muted rounded-lg text-xs text-muted-foreground">
            <p className="font-medium mb-1">Comptes de démonstration :</p>
            <p>Admin: admin@proerp.com / admin123</p>
            <p>Commercial: commercial@proerp.com / pass123</p>
            <p>Magasinier: magasinier@proerp.com / pass123</p>
            <p>Production: production@proerp.com / pass123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
