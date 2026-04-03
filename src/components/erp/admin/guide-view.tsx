'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Home, LogIn, LayoutDashboard, Users, Package, FileText, ShoppingCart,
  Receipt, Warehouse, Factory, CreditCard,
  Landmark, Settings, BookOpen, Shield, ChevronRight, CheckCircle2,
  ArrowRight, Info, AlertCircle, CircleDot, ArrowDown, Eye,
  Lock, UserCog, RotateCcw, Truck, TrendingUp, Calculator,
  PackageCheck, Circle, ArrowLeftRight, Ban, CheckCircle, XCircle, Clock,
  FileCheck, FileSpreadsheet, Cpu, Building2, type LucideIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ─── Types ─── */
interface Section {
  id: string
  label: string
  icon: LucideIcon
}

/* ─── Section definitions ─── */
const sections: Section[] = [
  { id: 'introduction', label: 'Introduction', icon: Home },
  { id: 'connexion', label: 'Connexion & Navigation', icon: LogIn },
  { id: 'tableau-de-bord', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'clients', label: 'Gestion des Clients', icon: Users },
  { id: 'produits', label: 'Produits', icon: Package },
  { id: 'devis', label: 'Devis', icon: FileText },
  { id: 'commandes', label: 'Commandes Clients', icon: ShoppingCart },
  { id: 'factures', label: 'Factures', icon: Receipt },
  { id: 'stock', label: 'Gestion du Stock', icon: Warehouse },
  { id: 'production', label: 'Production', icon: Factory },
  { id: 'finance', label: 'Finance', icon: Landmark },
  { id: 'utilisateurs', label: 'Utilisateurs', icon: UserCog },
  { id: 'parametres', label: 'Paramètres', icon: Settings },
]

/* ─── Reusable small components ─── */

function SectionTitle({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-semibold mt-8 mb-4 text-foreground">{children}</h3>
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground leading-relaxed mb-4">{children}</p>
}

function TipBox({ type = 'info', children }: { type?: 'info' | 'warning' | 'success'; children: React.ReactNode }) {
  const styles = {
    info: 'bg-sky-50 border-sky-200 text-sky-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  }
  const icons = {
    info: <Info className="h-4 w-4 shrink-0 mt-0.5" />,
    warning: <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />,
    success: <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />,
  }
  const labels = { info: 'Info', warning: 'Attention', success: 'Astuce' }
  return (
    <div className={cn('rounded-lg border p-4 mb-4', styles[type])}>
      <div className="flex gap-3">
        {icons[type]}
        <div>
          <span className="font-semibold text-sm">{labels[type]} : </span>
          <span className="text-sm">{children}</span>
        </div>
      </div>
    </div>
  )
}

function Step({ num, children }: { num: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 mb-4">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
        {num}
      </div>
      <div className="flex-1 pt-1">{children}</div>
    </div>
  )
}

function FlowDiagram({ steps }: { steps: { label: string; color?: string; icon?: LucideIcon }[] }) {
  return (
    <div className="flex items-center flex-wrap gap-2 my-6">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium',
            step.color || 'bg-muted border-border'
          )}>
            {step.icon && <step.icon className="h-4 w-4" />}
            {step.label}
          </div>
          {i < steps.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Actif: 'bg-emerald-100 text-emerald-700',
    Prospect: 'bg-amber-100 text-amber-700',
    Inactif: 'bg-gray-100 text-gray-600',
    Brouillon: 'bg-gray-100 text-gray-600',
    Envoyé: 'bg-sky-100 text-sky-700',
    Accepté: 'bg-emerald-100 text-emerald-700',
    Refusé: 'bg-red-100 text-red-700',
    Expiré: 'bg-orange-100 text-orange-700',
    Confirmée: 'bg-emerald-100 text-emerald-700',
    'En préparation': 'bg-sky-100 text-sky-700',
    Prête: 'bg-violet-100 text-violet-700',
    Partielle: 'bg-amber-100 text-amber-700',
    Payée: 'bg-emerald-100 text-emerald-700',
    Impayée: 'bg-red-100 text-red-700',
    Bloqué: 'bg-red-100 text-red-700',
  }
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', map[status] || 'bg-gray-100 text-gray-600')}>{status}</span>
}

function ScreenMock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden mb-6">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <span className="text-xs font-medium text-muted-foreground ml-2">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

/* ─── Main guide sections (rendered only when active) ─── */

function IntroSection() {
  return (
    <div>
      <SectionTitle icon={Home} title="Bienvenue dans GEMA ERP PRO" />
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 mb-6">
        <CardContent className="p-6">
          <h3 className="text-xl font-bold mb-2">Qu'est-ce que GEMA ERP PRO ?</h3>
          <p className="text-muted-foreground leading-relaxed">
            GEMA ERP PRO est une solution de gestion intégré (ERP) complète conçue spécialement pour les entreprises marocaines.
            Elle couvre l'ensemble du cycle d'activité : de la gestion commerciale et des stocks, jusqu'à la production,
            la comptabilité et l'administration. Développée avec les standards du marché marocain (ICE, TVA, CNSS, Patente),
            elle s'adapte à tous les secteurs d'activité.
          </p>
        </CardContent>
      </Card>

      <SubTitle>À qui s'adresse ce guide ?</SubTitle>
      <Paragraph>
        Ce guide est conçu pour les nouveaux utilisateurs de GEMA ERP PRO. Que vous soyez commercial,
        magasinier, responsable de production ou administrateur, vous trouverez ici toutes les informations
        nécessaires pour maîtriser le système rapidement.
      </Paragraph>

      <TipBox type="info">
        Ce guide utilise des données d'exemple avec des noms d'entreprises et de villes marocaines pour faciliter la compréhension.
      </TipBox>

      <SubTitle>Vue d'ensemble des modules</SubTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {[
          { icon: LayoutDashboard, label: 'Tableau de bord', desc: 'KPIs et indicateurs', color: 'text-sky-500 bg-sky-50' },
          { icon: Users, label: 'Clients', desc: 'Gestion commerciale', color: 'text-violet-500 bg-violet-50' },
          { icon: Package, label: 'Produits', desc: 'Catalogue complet', color: 'text-amber-500 bg-amber-50' },
          { icon: FileText, label: 'Devis', desc: 'Propositions clients', color: 'text-cyan-500 bg-cyan-50' },
          { icon: ShoppingCart, label: 'Commandes', desc: 'Suivi des ventes', color: 'text-emerald-500 bg-emerald-50' },
          { icon: Receipt, label: 'Factures', desc: 'Facturation et TVA', color: 'text-rose-500 bg-rose-50' },
          { icon: Warehouse, label: 'Stock', desc: 'Mouvements et alertes', color: 'text-slate-500 bg-slate-50' },
          { icon: Factory, label: 'Production', desc: 'Fabrication et BOM', color: 'text-green-600 bg-green-50' },
          { icon: Landmark, label: 'Finance', desc: 'Caisses et banque', color: 'text-blue-600 bg-blue-50' },
          { icon: UserCog, label: 'Utilisateurs', desc: 'Rôles et permissions', color: 'text-emerald-500 bg-emerald-50' },
          { icon: Settings, label: 'Paramètres', desc: 'Configuration système', color: 'text-gray-500 bg-gray-50' },
          { icon: Shield, label: 'Audit', desc: 'Traçabilité totale', color: 'text-slate-500 bg-slate-50' },
        ].map((m) => (
          <Card key={m.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 text-center">
              <div className={cn('inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3', m.color)}>
                <m.icon className="h-6 w-6" />
              </div>
              <p className="font-semibold text-sm">{m.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function ConnexionSection() {
  return (
    <div>
      <SectionTitle icon={LogIn} title="Connexion & Navigation" />

      <SubTitle>Comment se connecter</SubTitle>
      <Paragraph>Suivez ces étapes simples pour accéder à votre espace GEMA ERP PRO :</Paragraph>

      <Step num={1}>
        <p className="text-sm text-muted-foreground">
          Ouvrez votre navigateur web et saisissez l'adresse de votre ERP.
        </p>
      </Step>
      <Step num={2}>
        <p className="text-sm text-muted-foreground">
          Saisissez votre <strong>adresse e-mail</strong> dans le champ « Email ».
        </p>
      </Step>
      <Step num={3}>
        <p className="text-sm text-muted-foreground">
          Entrez votre <strong>mot de passe</strong> dans le champ « Mot de passe ».
        </p>
      </Step>
      <Step num={4}>
        <p className="text-sm text-muted-foreground">
          Cliquez sur le bouton <strong>« Se connecter »</strong>.
        </p>
      </Step>
      <Step num={5}>
        <p className="text-sm text-muted-foreground">
          Vous êtes redirigé vers le <strong>Tableau de bord</strong>.
        </p>
      </Step>

      <ScreenMock title="GEMA ERP PRO — Connexion">
        <div className="max-w-sm mx-auto space-y-4">
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-2">
              <Lock className="h-6 w-6" />
            </div>
            <p className="font-bold text-lg">Connexion</p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <div className="h-9 rounded-md border bg-muted/50 px-3 flex items-center text-sm text-muted-foreground">
              contact@jazelwebagency.com
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Mot de passe</label>
            <div className="h-9 rounded-md border bg-muted/50 px-3 flex items-center text-sm text-muted-foreground">
              ••••••••••
            </div>
          </div>
          <div className="h-9 rounded-md bg-primary flex items-center justify-center text-sm font-medium text-primary-foreground">
            Se connecter
          </div>
        </div>
      </ScreenMock>

      <SubTitle>Comptes de démonstration</SubTitle>
      <Paragraph>Voici les comptes disponibles pour tester le système :</Paragraph>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rôle</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Mot de passe</TableHead>
                <TableHead>Accès</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { role: 'Super Admin', email: 'contact@jazelwebagency.com', pass: 'hello@erp2026', access: 'Accès total' },
                { role: 'Admin', email: 'admin@gema-erp.com', pass: 'admin123', access: 'Gestion complète' },
                { role: 'Commercial', email: 'commercial@gema-erp.com', pass: 'pass123', access: 'Clients, Devis, Factures' },
                { role: 'Magasinier', email: 'magasinier@gema-erp.com', pass: 'pass123', access: 'Stock, Produits' },
                { role: 'Acheteur', email: 'acheteur@gema-erp.com', pass: 'pass123', access: 'Fournisseurs, Achats' },
              ].map((r) => (
                <TableRow key={r.role}>
                  <TableCell className="font-medium">{r.role}</TableCell>
                  <TableCell className="text-xs font-mono">{r.email}</TableCell>
                  <TableCell className="text-xs font-mono">{r.pass}</TableCell>
                  <TableCell><Badge variant="outline">{r.access}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TipBox type="warning">
        En production, modifiez immédiatement les mots de passe par défaut pour des raisons de sécurité.
      </TipBox>

      <SubTitle>Navigation dans le système</SubTitle>
      <Paragraph>
        L'interface est organisée avec une <strong>barre latérale</strong> (sidebar) à gauche qui regroupe tous les modules
        par catégorie. Chaque catégorie peut être dépliée ou repliée en cliquant sur son titre.
      </Paragraph>

      <ScreenMock title="Structure de la barre latérale">
        <div className="space-y-2 max-w-xs">
          {[
            { title: 'Tableau de bord', items: ['Vue d\'ensemble'] },
            { title: 'Commercial', items: ['Clients', 'Produits', 'Devis', 'Commandes', 'Factures'] },
            { title: 'Achats', items: ['Fournisseurs', 'Commandes fournisseur', 'Réceptions'] },
            { title: 'Stock', items: ['Mouvements', 'Alertes', 'Inventaires'] },
          ].map((g) => (
            <div key={g.title} className="rounded-lg border p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">{g.title}</p>
              <div className="space-y-1 pl-2">
                {g.items.map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm py-1">
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScreenMock>
    </div>
  )
}

function DashboardSection() {
  return (
    <div>
      <SectionTitle icon={LayoutDashboard} title="Tableau de bord" />
      <Paragraph>
        Le tableau de bord est la page d'accueil de GEMA ERP PRO. Il offre une vue synthétique de l'activité
        de l'entreprise avec des indicateurs clés de performance (KPI) actualisés en temps réel.
      </Paragraph>

      <SubTitle>Cartes KPI</SubTitle>
      <Paragraph>Les principales métriques sont affichées sous forme de cartes en haut de page :</Paragraph>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Chiffre d\'affaires', value: '1 245 600 DH', change: '+12,5%', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Commandes', value: '48', change: '+8 ce mois', icon: ShoppingCart, color: 'text-sky-600', bg: 'bg-sky-50' },
          { label: 'Valeur du stock', value: '856 200 DH', change: '-2,3%', icon: Package, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Clients actifs', value: '127', change: '+5 nouveaux', icon: Users, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground font-medium">{k.label}</span>
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', k.bg)}>
                  <k.icon className={cn('h-4 w-4', k.color)} />
                </div>
              </div>
              <p className="text-xl font-bold">{k.value}</p>
              <p className={cn('text-xs mt-1', k.change.startsWith('+') ? 'text-emerald-600' : 'text-red-500')}>{k.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <SubTitle>Graphiques et courbes</SubTitle>
      <Paragraph>
        Le tableau de bord intègre des graphiques interactifs : courbe d'évolution du chiffre d'affaires,
        répartition des ventes par catégorie, top produits, et suivi des commandes en cours.
      </Paragraph>

      <TipBox type="info">
        Cliquez sur un graphique pour afficher les détails. Utilisez les filtres de date en haut de page pour ajuster la période affichée.
      </TipBox>

      <SubTitle>Comment lire le tableau de bord</SubTitle>
      <Step num={1}>Repérez les <strong>cartes KPI</strong> en haut pour un aperçu immédiat.</Step>
      <Step num={2}>Consultez les <strong>graphiques</strong> pour analyser les tendances.</Step>
      <Step num={3}>Utilisez les <strong>listes récentes</strong> (devis, commandes, factures) pour accéder directement aux éléments.</Step>
      <Step num={4}>Cliquez sur <strong>« Voir tout »</strong> pour accéder au module complet correspondant.</Step>
    </div>
  )
}

function ClientsSection() {
  return (
    <div>
      <SectionTitle icon={Users} title="Gestion des Clients" />
      <Paragraph>
        Le module Clients permet de gérer l'ensemble de votre portefeuille client : création, modification,
        suivi des interactions et historique des transactions.
      </Paragraph>

      <SubTitle>Créer un nouveau client</SubTitle>
      <Paragraph>Voici un exemple complet de création d'un client avec des données marocaines :</Paragraph>

      <Step num={1}>
        <p className="text-sm text-muted-foreground mb-2">Accédez au module <strong>Clients</strong> depuis la barre latérale.</p>
      </Step>
      <Step num={2}>
        <p className="text-sm text-muted-foreground mb-2">Cliquez sur le bouton <strong>« + Nouveau client »</strong>.</p>
      </Step>
      <Step num={3}>
        <p className="text-sm text-muted-foreground mb-2">Remplissez les informations du client :</p>
      </Step>

      <ScreenMock title="Fiche client — SARL AL MOUATAZ INDUSTRIE">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Raison sociale *</label>
            <div className="h-8 rounded border bg-muted/50 px-3 flex items-center text-sm">SARL AL MOUATAZ INDUSTRIE</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">ICE *</label>
            <div className="h-8 rounded border bg-muted/50 px-3 flex items-center text-sm font-mono">002456789000015</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">CNSS</label>
            <div className="h-8 rounded border bg-muted/50 px-3 flex items-center text-sm font-mono">12345678</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Patente</label>
            <div className="h-8 rounded border bg-muted/50 px-3 flex items-center text-sm font-mono">98765432</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Ville *</label>
            <div className="h-8 rounded border bg-muted/50 px-3 flex items-center text-sm">Casablanca</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Forme juridique</label>
            <div className="h-8 rounded border bg-muted/50 px-3 flex items-center text-sm">SARL</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Régime fiscal</label>
            <div className="h-8 rounded border bg-muted/50 px-3 flex items-center text-sm">IS</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Taux TVA (%)</label>
            <div className="h-8 rounded border bg-muted/50 px-3 flex items-center text-sm">20%</div>
          </div>
        </div>
      </ScreenMock>

      <Step num={4}>
        <p className="text-sm text-muted-foreground">Cliquez sur <strong>« Enregistrer »</strong> pour valider la création du client.</p>
      </Step>

      <TipBox type="success">
        L'ICE (Identifiant Commun de l'Entreprise) est obligatoire au Maroc pour toute entreprise. Vérifiez toujours sa validité sur le portail de l'Anpme.
      </TipBox>

      <SubTitle>Types de clients</SubTitle>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Champs spécifiques</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { type: 'SOCIÉTÉ', desc: 'Entreprise avec ICE, CNSS, patente', fields: 'ICE, CNSS, Patente, Régime fiscal' },
                { type: 'REVENDEUR', desc: 'Partenaire de distribution', fields: 'Conditions commerciales, Remises' },
                { type: 'PARTICULIER', desc: 'Client individuel', fields: 'CIN, Nom complet' },
                { type: 'AUTRES', desc: 'Association, administration...', fields: 'Référence, Contact' },
              ].map((t) => (
                <TableRow key={t.type}>
                  <TableCell><Badge variant="outline">{t.type}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.desc}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.fields}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SubTitle>Cycle de vie d'un client</SubTitle>
      <FlowDiagram steps={[
        { label: 'Prospect', color: 'bg-amber-50 border-amber-200 text-amber-700', icon: Eye },
        { label: 'Actif', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle },
        { label: 'Inactif', color: 'bg-gray-100 border-gray-200 text-gray-600', icon: Clock },
        { label: 'Bloqué', color: 'bg-red-50 border-red-200 text-red-700', icon: Ban },
      ]} />

      <SubTitle>Exemples de clients</SubTitle>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entreprise</TableHead>
                <TableHead>ICE</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { name: 'SARL Al Mouataz Industrie', ice: '002456789000015', city: 'Casablanca', status: 'Actif' },
                { name: 'SA Tanger Metallurgie', ice: '001234567000033', city: 'Tanger', status: 'Actif' },
                { name: 'AutoParts Maroc SARL', ice: '003456789000078', city: 'Rabat', status: 'Prospect' },
                { name: 'BatiConseil SARL', ice: '004567890000044', city: 'Marrakech', status: 'Actif' },
                { name: 'ElectroDistrib Fès', ice: '005678901000055', city: 'Fès', status: 'Inactif' },
              ].map((c) => (
                <TableRow key={c.ice}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs">{c.ice}</TableCell>
                  <TableCell>{c.city}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function ProduitsSection() {
  return (
    <div>
      <SectionTitle icon={Package} title="Produits" />
      <Paragraph>
        Le module Produits gère le catalogue complet de votre entreprise : matières premières,
        semi-finis et produits finis. Chaque produit dispose d'une fiche détaillée avec prix, stock et unités.
      </Paragraph>

      <SubTitle>Types de produits</SubTitle>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { type: 'Matière première', icon: CircleDot, desc: 'Matières brutes utilisées dans la fabrication. Exemples : tôle, aluminium, visserie.', color: 'text-amber-600 bg-amber-50 border-amber-200' },
          { type: 'Semi-fini', icon: Cpu, desc: 'Produits intermédiaires en cours de fabrication. Exemples : châssis soudé, pièces découpées.', color: 'text-sky-600 bg-sky-50 border-sky-200' },
          { type: 'Produit fini', icon: PackageCheck, desc: 'Produits prêts à la vente. Exemples : armoire industrielle, banc de travail.', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
        ].map((p) => (
          <Card key={p.type} className={p.color}>
            <CardContent className="p-4">
              <p.icon className="h-6 w-6 mb-2" />
              <p className="font-semibold text-sm mb-1">{p.type}</p>
              <p className="text-xs opacity-80">{p.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <SubTitle>Exemples de produits</SubTitle>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Réf</TableHead>
                <TableHead>Désignation</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Prix HT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { ref: 'MP-001', name: 'Tôle acier 2mm', type: 'Matière première', stock: '2 500 kg', price: '45,00 DH' },
                { ref: 'MP-002', name: 'Aluminium 6061 barre 30mm', type: 'Matière première', stock: '800 m', price: '18,50 DH' },
                { ref: 'SF-001', name: 'Châssis soudé type A', type: 'Semi-fini', stock: '25 pcs', price: '120,00 DH' },
                { ref: 'PF-001', name: 'Armoire industrielle modulable', type: 'Produit fini', stock: '12 pcs', price: '850,00 DH' },
                { ref: 'PF-002', name: 'Banc de travail technique', type: 'Produit fini', stock: '5 pcs', price: '1 250,00 DH' },
              ].map((p) => (
                <TableRow key={p.ref}>
                  <TableCell className="font-mono text-xs font-medium">{p.ref}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{p.type}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{p.stock}</TableCell>
                  <TableCell className="text-right font-mono">{p.price}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TipBox type="info">
        Les prix sont exprimés en <strong>Dirhams (DH)</strong>, la devise officielle du Maroc. Le prix affiché est toujours Hors Taxe (HT).
      </TipBox>
    </div>
  )
}

function DevisSection() {
  return (
    <div>
      <SectionTitle icon={FileText} title="Devis (Propositions commerciales)" />
      <Paragraph>
        Le module Devis permet de créer des propositions commerciales pour vos clients.
        Chaque devis peut suivre un cycle de vie complet : du brouillon jusqu'à l'acceptation ou le refus.
      </Paragraph>

      <SubTitle>Cycle de vie d'un devis</SubTitle>
      <FlowDiagram steps={[
        { label: 'Brouillon', color: 'bg-gray-100 border-gray-200 text-gray-600', icon: FileText },
        { label: 'Envoyé', color: 'bg-sky-50 border-sky-200 text-sky-700', icon: ArrowDown },
        { label: 'Accepté', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle },
        { label: 'Refusé', color: 'bg-red-50 border-red-200 text-red-700', icon: XCircle },
        { label: 'Expiré', color: 'bg-orange-50 border-orange-200 text-orange-700', icon: Clock },
      ]} />

      <TipBox type="info">
        Un devis accepté peut être automatiquement converti en <strong>commande client</strong> en un seul clic.
      </TipBox>

      <SubTitle>Créer un devis — Exemple complet</SubTitle>
      <Step num={1}>Accédez au module <strong>Devis</strong> et cliquez sur <strong>« + Nouveau devis »</strong>.</Step>
      <Step num={2}>Sélectionnez le client : <strong>SARL Al Mouataz Industrie</strong>.</Step>
      <Step num={3}>Ajoutez les lignes de produits :</Step>

      <ScreenMock title="Devis DEV-2026-0042 — SARL Al Mouataz Industrie">
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Client : <strong className="text-foreground">SARL Al Mouataz Industrie</strong></span>
            <span className="text-muted-foreground">Date : <strong className="text-foreground">15/01/2026</strong></span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Réf</TableHead>
                <TableHead>Désignation</TableHead>
                <TableHead className="text-right">Qté</TableHead>
                <TableHead className="text-right">Prix HT</TableHead>
                <TableHead className="text-right">Total HT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { ref: 'PF-001', name: 'Armoire industrielle modulable', qty: '3', unit: 'pcs', price: '850,00', total: '2 550,00' },
                { ref: 'PF-002', name: 'Banc de travail technique', qty: '2', unit: 'pcs', price: '1 250,00', total: '2 500,00' },
                { ref: 'MP-001', name: 'Tôle acier 2mm', qty: '100', unit: 'kg', price: '45,00', total: '4 500,00' },
              ].map((l) => (
                <TableRow key={l.ref}>
                  <TableCell className="font-mono text-xs">{l.ref}</TableCell>
                  <TableCell className="text-sm">{l.name}</TableCell>
                  <TableCell className="text-right text-sm">{l.qty} {l.unit}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{l.price}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium">{l.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Separator />
          <div className="flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Sous-total HT</span><span className="font-mono">9 550,00 DH</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Remise (5%)</span><span className="font-mono text-red-500">-477,50 DH</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Frais de port</span><span className="font-mono">150,00 DH</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Total HT</span><span className="font-mono font-medium">9 222,50 DH</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">TVA (20%)</span><span className="font-mono font-medium">1 844,50 DH</span></div>
              <Separator />
              <div className="flex justify-between text-base"><span className="font-semibold">Total TTC</span><span className="font-bold text-primary font-mono">11 067,00 DH</span></div>
            </div>
          </div>
        </div>
      </ScreenMock>

      <Step num={4}>Vérifiez les montants et cliquez sur <strong>« Enregistrer »</strong> puis <strong>« Envoyer »</strong>.</Step>

      <TipBox type="success">
        Le système calcule automatiquement les montants HT, la TVA et le TTC en fonction du taux de TVA du client.
      </TipBox>

      <SubTitle>Détail du calcul</SubTitle>
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2"><Calculator className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">Formule de calcul</span></div>
          <div className="bg-muted/50 rounded-lg p-3 font-mono text-sm space-y-1">
            <p>Sous-total HT = (3 × 850) + (2 × 1 250) + (100 × 45) = 9 550,00 DH</p>
            <p>Remise 5% = 9 550 × 0,05 = 477,50 DH</p>
            <p>Net HT = 9 550 - 477,50 + 150 = 9 222,50 DH</p>
            <p>TVA 20% = 9 222,50 × 0,20 = 1 844,50 DH</p>
            <p className="font-bold text-primary">Total TTC = 9 222,50 + 1 844,50 = 11 067,00 DH</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function CommandesSection() {
  return (
    <div>
      <SectionTitle icon={ShoppingCart} title="Commandes Clients" />
      <Paragraph>
        Les commandes clients représentent les engagements fermes de vos clients après acceptation d'un devis
        ou commande directe. Elles déclenchent le processus de préparation et de livraison.
      </Paragraph>

      <SubTitle>Cycle de vie d'une commande</SubTitle>
      <FlowDiagram steps={[
        { label: 'Confirmée', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle },
        { label: 'En préparation', color: 'bg-sky-50 border-sky-200 text-sky-700', icon: Package },
        { label: 'Prête', color: 'bg-violet-50 border-violet-200 text-violet-700', icon: PackageCheck },
        { label: 'Livrée', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: Truck },
        { label: 'Facturée', color: 'bg-gray-100 border-gray-200 text-gray-600', icon: Receipt },
      ]} />

      <SubTitle>Convertir un devis en commande</SubTitle>
      <Step num={1}>Ouvrez le devis accepté (statut <StatusBadge status="Accepté" />).</Step>
      <Step num={2}>Cliquez sur le bouton <strong>« Convertir en commande »</strong>.</Step>
      <Step num={3}>Vérifiez les informations transférées (client, lignes, prix).</Step>
      <Step num={4}>Validez la création. La commande hérite du numéro et des données du devis.</Step>

      <TipBox type="info">
        La conversion est automatique : les lignes de produits, les quantités, les remises et les conditions sont reprises du devis.
      </TipBox>

      <SubTitle>Suivi de préparation</SubTitle>
      <Paragraph>
        Chaque commande peut être associée à une <strong>préparation</strong> qui détaille le prélèvement en stock.
        Le magasinier indique les quantités prélevées et les éventuels manquants.
      </Paragraph>
      <ScreenMock title="Préparation de commande CMD-2026-0089">
        <div className="space-y-3">
          <div className="flex gap-4 text-sm">
            <span className="text-muted-foreground">Commande : <strong>CMD-2026-0089</strong></span>
            <span className="text-muted-foreground">Client : <strong>SARL Al Mouataz Industrie</strong></span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Demandé</TableHead>
                <TableHead className="text-right">Préparé</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { name: 'Armoire industrielle modulable', asked: 3, prepared: 3, status: 'Complet' },
                { name: 'Banc de travail technique', asked: 2, prepared: 1, status: 'Partiel' },
              ].map((l) => (
                <TableRow key={l.name}>
                  <TableCell className="text-sm">{l.name}</TableCell>
                  <TableCell className="text-right font-mono">{l.asked}</TableCell>
                  <TableCell className="text-right font-mono">{l.prepared}</TableCell>
                  <TableCell><StatusBadge status={l.status === 'Complet' ? 'Actif' : 'Partielle'} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ScreenMock>
    </div>
  )
}

function FacturesSection() {
  return (
    <div>
      <SectionTitle icon={Receipt} title="Factures" />
      <Paragraph>
        Le module Factures gère la facturation client avec conformité fiscale marocaine.
        Les factures sont générées à partir des commandes livrées ou créées manuellement.
      </Paragraph>

      <SubTitle>Types de factures</SubTitle>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { type: 'Facture standard', icon: FileText, desc: 'Facture de vente classique liée à une commande ou devis.', color: 'bg-sky-50 border-sky-200 text-sky-700' },
          { type: 'Facture d\'avoir', icon: RotateCcw, desc: 'Crédit pour un retour ou remise. Annule partiellement ou totalement une facture.', color: 'bg-orange-50 border-orange-200 text-orange-700' },
          { type: 'Facture proforma', icon: FileSpreadsheet, desc: 'Document préalable non comptable. Sert de base pour les formalités douanières.', color: 'bg-violet-50 border-violet-200 text-violet-700' },
        ].map((f) => (
          <Card key={f.type} className={f.color}>
            <CardContent className="p-4">
              <f.icon className="h-5 w-5 mb-2" />
              <p className="font-semibold text-sm mb-1">{f.type}</p>
              <p className="text-xs opacity-80">{f.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <SubTitle>Taux de TVA au Maroc</SubTitle>
      <Paragraph>
        GEMA ERP PRO prend en charge tous les taux de TVA en vigueur au Maroc :
      </Paragraph>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Taux</TableHead>
                <TableHead>Application</TableHead>
                <TableHead>Exemples</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { rate: '20%', application: 'Taux normal', examples: 'Services, produits manufacturés' },
                { rate: '14%', application: 'Taux intermédiaire', examples: 'Transport, électricité industrielle' },
                { rate: '10%', application: 'Taux réduit', examples: 'Hôtellerie, restauration' },
                { rate: '7%', application: 'Taux super réduit', examples: 'Produits de première nécessité' },
                { rate: '0%', application: 'Exonéré', examples: 'Exportations, produits pharmaceutiques' },
              ].map((t) => (
                <TableRow key={t.rate}>
                  <TableCell className="font-mono font-bold">{t.rate}</TableCell>
                  <TableCell className="text-sm">{t.application}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.examples}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SubTitle>Suivi des paiements</SubTitle>
      <Paragraph>
        Chaque facture peut être liée à un ou plusieurs paiements. Le système affiche automatiquement
        le solde restant et le statut de paiement : <StatusBadge status="Payée" />, <StatusBadge status="Impayée" />, ou <StatusBadge status="Partielle" />.
      </Paragraph>

      <TipBox type="warning">
        Les factures doivent respecter les obligations légales marocaines : numéro séquentiel, date, identifiant fiscal du client, détail des opérations, et mentions légales.
      </TipBox>
    </div>
  )
}

function StockSection() {
  return (
    <div>
      <SectionTitle icon={Warehouse} title="Gestion du Stock" />
      <Paragraph>
        Le module Stock permet de suivre en temps réel les mouvements de marchandises,
        de gérer les alertes de seuil minimum et de réaliser des inventaires.
      </Paragraph>

      <SubTitle>Types de mouvements</SubTitle>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { type: 'Entrée', icon: ArrowDown, desc: 'Réception de marchandises (fournisseur, retour client, inventaire). Augmente le stock disponible.', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
          { type: 'Sortie', icon: Package, desc: 'Expédition vers client, consommation production, perte. Diminue le stock disponible.', color: 'bg-red-50 border-red-200 text-red-700' },
          { type: 'Ajustement', icon: ArrowLeftRight, desc: 'Correction manuelle suite à un inventaire ou une erreur. Peut être positif ou négatif.', color: 'bg-amber-50 border-amber-200 text-amber-700' },
        ].map((m) => (
          <Card key={m.type} className={m.color}>
            <CardContent className="p-4">
              <m.icon className="h-5 w-5 mb-2" />
              <p className="font-semibold text-sm mb-1">{m.type}</p>
              <p className="text-xs opacity-80">{m.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <SubTitle>Alertes de stock minimum</SubTitle>
      <Paragraph>
        Pour chaque produit, vous pouvez définir un <strong>seuil minimum</strong>. Lorsque le stock tombe
        en dessous de ce seuil, une alerte apparaît dans le module « Alertes stock » et sur le tableau de bord.
      </Paragraph>

      <ScreenMock title="Alertes de stock — Produits sous seuil">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead className="text-right">Stock actuel</TableHead>
              <TableHead className="text-right">Seuil min.</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              { name: 'Tôle acier 2mm', current: '150 kg', min: '500 kg' },
              { name: 'Armoire industrielle modulable', current: '2 pcs', min: '5 pcs' },
              { name: 'Visserie M8x30', current: '0 pcs', min: '100 pcs' },
            ].map((a) => (
              <TableRow key={a.name}>
                <TableCell className="text-sm font-medium">{a.name}</TableCell>
                <TableCell className="text-right font-mono text-red-600 font-medium">{a.current}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{a.min}</TableCell>
                <TableCell><StatusBadge status="Inactif" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScreenMock>

      <SubTitle>Gestion des inventaires</SubTitle>
      <Paragraph>
        Les inventaires permettent de vérifier l'écart entre le stock théorique (système) et le stock physique (réel).
        Un ajustement automatique est proposé après validation de l'inventaire.
      </Paragraph>
      <Step num={1}>Créez un nouvel inventaire dans le module <strong>Inventaires</strong>.</Step>
      <Step num={2}>Sélectionnez les produits ou catégories à inventorier.</Step>
      <Step num={3}>Saisissez les quantités réelles constatées.</Step>
      <Step num={4}>Validez : le système génère les écarts et les ajustements de stock.</Step>

      <TipBox type="success">
        Planifiez des inventaires tournants régulièrement pour maintenir la fiabilité des données de stock.
      </TipBox>
    </div>
  )
}

function ProductionSection() {
  return (
    <div>
      <SectionTitle icon={Factory} title="Production" />
      <Paragraph>
        Le module Production gère la fabrication de produits : des nomenclatures (BOM) jusqu'aux
        ordres de fabrication, en passant par les gammes opératoires et les postes de travail.
      </Paragraph>

      <SubTitle>Nomenclatures (BOM — Bill of Materials)</SubTitle>
      <Paragraph>
        Une nomenclature définit la liste des composants nécessaires pour fabriquer un produit fini.
        Elle inclut les quantités et les liens entre matières premières et semi-finis.
      </Paragraph>

      <ScreenMock title="Nomenclature — PF-001 Armoire industrielle modulable">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Composant</TableHead>
              <TableHead>Réf</TableHead>
              <TableHead className="text-right">Quantité</TableHead>
              <TableHead>Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              { name: 'Tôle acier 2mm', ref: 'MP-001', qty: '15 kg', type: 'Matière première' },
              { name: 'Aluminium 6061 barre 30mm', ref: 'MP-002', qty: '4 m', type: 'Matière première' },
              { name: 'Châssis soudé type A', ref: 'SF-001', qty: '1 pcs', type: 'Semi-fini' },
            ].map((c) => (
              <TableRow key={c.ref}>
                <TableCell className="text-sm">{c.name}</TableCell>
                <TableCell className="font-mono text-xs">{c.ref}</TableCell>
                <TableCell className="text-right font-mono">{c.qty}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{c.type}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScreenMock>

      <SubTitle>Gammes opératoires</SubTitle>
      <Paragraph>
        Une gamme opératoire décrit les étapes successives de fabrication : découpe, soudure, peinture,
        assemblage, contrôle qualité, etc. Chaque étape est associée à un poste de travail et un temps estimé.
      </Paragraph>

      <SubTitle>Ordres de fabrication (OF)</SubTitle>
      <Paragraph>
        Un ordre de fabrication est lancé pour produire une quantité déterminée d'un produit fini.
        Il consomme les matières premières de la nomenclature et suit l'avancement via la gamme.
      </Paragraph>
      <FlowDiagram steps={[
        { label: 'Planifié', color: 'bg-gray-100 border-gray-200 text-gray-600', icon: Circle },
        { label: 'En cours', color: 'bg-sky-50 border-sky-200 text-sky-700', icon: Cpu },
        { label: 'Terminé', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle },
        { label: 'Contrôlé', color: 'bg-violet-50 border-violet-200 text-violet-700', icon: FileCheck },
      ]} />

      <SubTitle>Postes de travail</SubTitle>
      <Paragraph>
        Les postes de travail représentent les ressources physiques de production : machines, ateliers,
        stations de montage. Ils sont associés aux étapes des gammes opératoires.
      </Paragraph>

      <TipBox type="info">
        Chaque poste de travail peut avoir un coût horaire qui sert au calcul du coût de revient des produits fabriqués.
      </TipBox>
    </div>
  )
}

function FinanceSection() {
  return (
    <div>
      <SectionTitle icon={Landmark} title="Finance" />
      <Paragraph>
        Le module Finance centralise la gestion des flux financiers : caisses, comptes bancaires,
        paiements reçus et émis, ainsi qu'un aperçu de la comptabilité.
      </Paragraph>

      <SubTitle>Caisses</SubTitle>
      <Paragraph>
        Gérez vos caisses physiques (caisse principale, caisse de dépannage) avec suivi des entrées
        et sorties d'espèces. Chaque mouvement est tracé avec la date, le montant et la référence associée.
      </Paragraph>

      <SubTitle>Comptes bancaires</SubTitle>
      <Paragraph>
        Enregistrez vos comptes bancaires pour suivre les virements, les prélèvements et les soldes.
        Associez les paiements reçus par virement aux factures correspondantes.
      </Paragraph>

      <SubTitle>Paiements</SubTitle>
      <Paragraph>
        Le module Paiements centralise tous les flux financiers entrants et sortants :
      </Paragraph>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[
          { type: 'Paiements reçus', icon: TrendingUp, desc: 'Règlements clients par virement, chèque, espèces ou traite.', items: ['Associer à une facture', 'Suivi des impayés', 'Relances automatiques'] },
          { type: 'Paiements émis', icon: CreditCard, desc: 'Règlements fournisseurs et dépenses diverses.', items: ['Liés aux factures fournisseur', 'Suivi des échéances', 'Multi-mode de paiement'] },
        ].map((p) => (
          <Card key={p.type}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <p.icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm">{p.type}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground mb-2">{p.desc}</p>
              <ul className="space-y-1">
                {p.items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />{item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <SubTitle>Comptabilité</SubTitle>
      <Paragraph>
        Le module Comptabilité offre une vue d'ensemble des écritures comptables générées automatiquement
        par les opérations commerciales (factures, paiements, avoirs). Les écritures sont classées par journal
        et par période.
      </Paragraph>

      <TipBox type="warning">
        Pour une comptabilité complète conforme au PCG Maroc (Plan Comptable Général), l'export vers un logiciel comptable dédié est recommandé.
      </TipBox>
    </div>
  )
}

function UtilisateursSection() {
  return (
    <div>
      <SectionTitle icon={UserCog} title="Gestion des Utilisateurs" />
      <Paragraph>
        Le module Utilisateurs est réservé au <strong>Super Administrateur</strong>. Il permet de créer,
        modifier et gérer les comptes des utilisateurs du système, ainsi que leurs rôles et permissions.
      </Paragraph>

      <TipBox type="warning">
        Seul le Super Administrateur (contact@jazelwebagency.com) a accès à ce module. Cette restriction garantit la sécurité du système.
      </TipBox>

      <SubTitle>Rôles et permissions</SubTitle>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rôle</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Accès principaux</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { role: 'Super Admin', desc: 'Accès total au système', access: 'Tous les modules + Gestion utilisateurs' },
                { role: 'Admin', desc: 'Administration courante', access: 'Tous les modules sauf utilisateurs' },
                { role: 'Commercial', desc: 'Gestion de la relation client', access: 'Clients, Devis, Commandes, Factures' },
                { role: 'Magasinier', desc: 'Gestion des stocks', access: 'Stock, Mouvements, Produits' },
                { role: 'Acheteur', desc: 'Gestion des achats', access: 'Fournisseurs, Commandes fournisseur, Réceptions' },
                { role: 'Resp. Production', desc: 'Supervision de la fabrication', access: 'Production, BOM, Gammes, OF' },
                { role: 'Opérateur', desc: 'Exécution des tâches de production', access: 'Ordres de fabrication assignés' },
                { role: 'Comptable', desc: 'Gestion financière', access: 'Factures, Paiements, Comptabilité' },
              ].map((r) => (
                <TableRow key={r.role}>
                  <TableCell className="font-medium">{r.role}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.desc}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.access}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SubTitle>Bloquer / Débloquer un utilisateur</SubTitle>
      <Step num={1}>Accédez au module <strong>Utilisateurs</strong> dans la section Administration.</Step>
      <Step num={2}>Trouvez l'utilisateur dans la liste.</Step>
      <Step num={3}>Cliquez sur le bouton <strong>« Bloquer »</strong> ou <strong>« Débloquer »</strong>.</Step>
      <Step num={4}>Un utilisateur bloqué ne peut plus se connecter au système.</Step>

      <TipBox type="info">
        Le Super Administrateur peut réinitialiser le mot de passe de n'importe quel utilisateur depuis ce module.
      </TipBox>
    </div>
  )
}

function ParametresSection() {
  return (
    <div>
      <SectionTitle icon={Settings} title="Paramètres" />
      <Paragraph>
        Le module Paramètres permet de configurer les informations de l'entreprise et les valeurs par défaut
        du système. Ces paramètres s'appliquent globalement à tous les modules.
      </Paragraph>

      <SubTitle>Informations de l'entreprise</SubTitle>
      <ScreenMock title="Paramètres — Informations société">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          {[
            { label: 'Raison sociale', value: 'JAZEL WEB AGENCY SARL' },
            { label: 'ICE', value: '009876543000012' },
            { label: 'Téléphone', value: '+212 5 22 00 00 00' },
            { label: 'Email', value: 'contact@jazelwebagency.com' },
            { label: 'Adresse', value: '123, Bd Zerktouni, Casablanca' },
            { label: 'Devise', value: 'MAD (Dirham marocain)' },
          ].map((f) => (
            <div key={f.label} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
              <div className="h-8 rounded border bg-muted/50 px-3 flex items-center text-sm">{f.value}</div>
            </div>
          ))}
        </div>
      </ScreenMock>

      <SubTitle>Valeurs par défaut</SubTitle>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paramètre</TableHead>
                <TableHead>Valeur par défaut</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { param: 'Taux de TVA', value: '20%', desc: 'Taux appliqué par défaut aux nouveaux produits' },
                { param: 'Durée validité devis', value: '30 jours', desc: 'Date d\'expiration automatique des devis' },
                { param: 'Conditions de paiement', value: '30 jours', desc: 'Délai de paiement affiché par défaut' },
                { param: 'Format numéro', value: 'AUTO', desc: 'Numérotation séquentielle automatique' },
                { param: 'Langue', value: 'Français', desc: 'Langue de l\'interface' },
                { param: 'Fuseau horaire', value: 'Africa/Casablanca', desc: 'Heure locale marocaine (GMT+1)' },
              ].map((p) => (
                <TableRow key={p.param}>
                  <TableCell className="font-medium">{p.param}</TableCell>
                  <TableCell><Badge variant="outline">{p.value}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.desc}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TipBox type="success">
        Les paramètres sont enregistrés immédiatement et appliqués à toutes les nouvelles opérations. Les opérations existantes conservent leurs valeurs d'origine.
      </TipBox>
    </div>
  )
}

/* ─── Section content map ─── */
const sectionComponents: Record<string, () => JSX.Element> = {
  'introduction': IntroSection,
  'connexion': ConnexionSection,
  'tableau-de-bord': DashboardSection,
  'clients': ClientsSection,
  'produits': ProduitsSection,
  'devis': DevisSection,
  'commandes': CommandesSection,
  'factures': FacturesSection,
  'stock': StockSection,
  'production': ProductionSection,
  'finance': FinanceSection,
  'utilisateurs': UtilisateursSection,
  'parametres': ParametresSection,
}

/* ─── Main Guide View ─── */
export default function GuideView() {
  const [activeSection, setActiveSection] = useState('introduction')
  const contentRef = useRef<HTMLDivElement>(null)

  const scrollToSection = useCallback((id: string) => {
    setActiveSection(id)
    const el = document.getElementById(`guide-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  // Update active section on scroll using IntersectionObserver
  useEffect(() => {
    const container = contentRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id.replace('guide-', ''))
          }
        })
      },
      { root: container, threshold: 0.15, rootMargin: '-60px 0px -60% 0px' }
    )

    const ids = sections.map((s) => `guide-${s.id}`)
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <div className="flex flex-col lg:flex-row gap-6 -m-4 md:-m-6 p-4 md:p-6 min-h-full">
      {/* Sidebar Navigation */}
      <div className="lg:w-72 shrink-0">
        <div className="lg:sticky lg:top-6">
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Guide d&apos;utilisation</CardTitle>
                  <CardDescription className="text-xs">GEMA ERP PRO v1.0</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 pb-3">
              <Separator />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-2">
              <ScrollArea className="max-h-[calc(100vh-240px)]">
                <nav className="space-y-0.5">
                  {sections.map((section) => {
                    const Icon = section.icon
                    const isActive = activeSection === section.id
                    return (
                      <button
                        key={section.id}
                        onClick={() => scrollToSection(section.id)}
                        className={cn(
                          'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors text-left',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{section.label}</span>
                      </button>
                    )
                  })}
                </nav>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0" ref={contentRef}>
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Hero header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              Guide d&apos;utilisation
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Découvrez GEMA ERP PRO et apprenez à maîtriser tous les modules du système.
              Ce guide complet vous accompagne pas à pas.
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <Badge variant="outline" className="gap-1">
                <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
                Version 1.0
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Globe className="h-3 w-3" />
                Français
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Building2 className="h-3 w-3" />
                Maroc
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Render all sections */}
          {sections.map((section) => {
            const SectionComponent = sectionComponents[section.id]
            if (!SectionComponent) return null
            return (
              <div key={section.id} id={`guide-${section.id}`}>
                <SectionComponent />
              </div>
            )
          })}

          {/* Footer */}
          <Separator />
          <div className="text-center py-8 text-sm text-muted-foreground">
            <BookOpen className="h-8 w-8 mx-auto mb-3 text-primary/30" />
            <p className="font-medium">GEMA ERP PRO — Guide d&apos;utilisation</p>
            <p className="mt-1">Développé avec passion au Maroc.</p>
            <p className="mt-1 text-xs">&copy; {new Date().getFullYear()} JAZEL WEB AGENCY SARL. Tous droits réservés.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Globe({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  )
}
