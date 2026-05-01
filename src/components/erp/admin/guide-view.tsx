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
  Landmark, Settings, BookOpen, Shield, ChevronRight, ChevronDown, CheckCircle2,
  ArrowRight, Info, AlertCircle, CircleDot, ArrowDown, Eye,
  Lock, UserCog, RotateCcw, Truck, TrendingUp, Calculator,
  PackageCheck, Circle, ArrowLeftRight, Ban, CheckCircle, XCircle, Clock,
  FileCheck, FileSpreadsheet, Cpu, Building2, Printer, MessageSquare, Bell, Database,
  Wrench, Cog, Layers, AlertTriangle, Gauge, ClipboardList, Timer, Hammer, Globe, Hash, Zap, Send, type LucideIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_VERSION } from '@/lib/version'
import { useNavStore } from '@/lib/stores'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

/* ─── Types ─── */
interface SubItem {
  id: string
  label: string
}

interface Section {
  id: string
  label: string
  icon: LucideIcon
  children?: SubItem[]
}

/* ─── Section definitions ─── */
const sections: Section[] = [
  { id: 'introduction', label: 'Introduction', icon: Home, children: [
    { id: 'bienvenue', label: 'Bienvenue' },
    { id: 'modules-roles', label: 'Modules & Rôles' },
  ]},
  { id: 'connexion', label: 'Connexion & Navigation', icon: LogIn, children: [
    { id: 'se-connecter', label: 'Se connecter' },
    { id: 'navigation', label: 'Navigation' },
    { id: 'mode-sombre', label: 'Mode sombre' },
  ]},
  { id: 'tableau-de-bord', label: 'Tableau de bord', icon: LayoutDashboard, children: [
    { id: 'kpis', label: 'KPIs' },
    { id: 'graphiques', label: 'Graphiques' },
  ]},
  { id: 'ventes', label: 'Ventes', icon: ShoppingCart, children: [
    { id: 'clients', label: 'Clients' },
    { id: 'produits', label: 'Produits' },
    { id: 'devis', label: 'Devis' },
    { id: 'commandes', label: 'Commandes' },
    { id: 'preparations', label: 'Préparations' },
    { id: 'bons-livraison', label: 'Bons de livraison' },
    { id: 'icones-statut', label: 'Légende des icônes' },
    { id: 'factures-tva', label: 'Factures & TVA' },
    { id: 'avoirs', label: 'Avoirs' },
  ]},
  { id: 'achats', label: 'Achats', icon: Truck, children: [
    { id: 'fournisseurs', label: 'Fournisseurs' },
    { id: 'demandes-prix', label: 'Demandes de prix' },
    { id: 'devis-fournisseurs', label: 'Devis fournisseurs' },
    { id: 'commandes-fournisseurs', label: 'Commandes fournisseurs' },
    { id: 'receptions', label: 'Réceptions' },
    { id: 'bons-retour', label: 'Bons de retour' },
    { id: 'avoirs-fournisseurs', label: 'Avoirs fournisseurs' },
    { id: 'factures-fournisseurs', label: 'Factures fournisseurs' },
    { id: 'icones-statut', label: 'Légende des icônes' },
  ]},
  { id: 'stock', label: 'Stock', icon: Warehouse, children: [
    { id: 'mouvements', label: 'Mouvements' },
    { id: 'alertes-stock', label: 'Alertes stock' },
    { id: 'inventaires', label: 'Inventaires' },
    { id: 'lots-stock', label: 'Lots de stock (FIFO)' },
  ]},
  { id: 'production', label: 'Production', icon: Factory, children: [
    { id: 'nomenclatures', label: 'Nomenclatures (BOM)' },
    { id: 'gammes', label: 'Gammes opératoires' },
    { id: 'postes-travail', label: 'Postes de travail' },
    { id: 'ordres-fabrication', label: 'Ordres de fabrication' },
    { id: 'controle-qualite', label: 'Contrôle qualité' },
    { id: 'equipements', label: 'Équipements' },
    { id: 'maintenance', label: 'Maintenance industrielle' },
  ]},
  { id: 'finance', label: 'Finance', icon: Landmark, children: [
    { id: 'caisses', label: 'Caisses' },
    { id: 'banque', label: 'Banque' },
    { id: 'paiements', label: 'Paiements' },
    { id: 'cheques-effets', label: 'Chèques & Effets' },
    { id: 'comptabilite', label: 'Comptabilité' },
    { id: 'etats-financiers', label: 'États financiers' },
  ]},
  { id: 'impression', label: 'Impression', icon: Printer, children: [
    { id: 'docs-imprimables', label: 'Documents imprimables' },
    { id: 'entete-pied', label: 'En-tête & Pied de page' },
    { id: 'notes-visa', label: 'Notes & Visa' },
  ]},
  { id: 'communication', label: 'Communication', icon: MessageSquare, children: [
    { id: 'messagerie', label: 'Messagerie interne' },
    { id: 'notifications', label: 'Notifications' },
  ]},
  { id: 'agenda', label: 'Agenda & Notifications', icon: Bell, children: [
    { id: 'agenda-personnel', label: 'Agenda personnel' },
    { id: 'calendrier', label: 'Calendrier' },
  ]},
  { id: 'administration', label: 'Administration', icon: Settings, children: [
    { id: 'utilisateurs', label: 'Utilisateurs' },
    { id: 'journal-audit', label: 'Journal d\'audit' },
    { id: 'parametres', label: 'Paramètres' },
    { id: 'sauvegarde', label: 'Sauvegarde' },
  ]},
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

function SubTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return <h3 id={id} className={cn('text-lg font-semibold mt-8 mb-4 text-foreground', id && 'scroll-mt-20')}>{children}</h3>
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
    <div className="rounded-xl border bg-card dark:bg-card shadow-sm overflow-hidden mb-6">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b">
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

/* ─── Main guide sections ─── */

function IntroSection() {
  return (
    <div>
      <SectionTitle icon={Home} title="Bienvenue dans GEMA ERP PRO" />
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 mb-6">
        <CardContent className="p-6">
          <h3 className="text-xl font-bold mb-2">Qu'est-ce que GEMA ERP PRO ?</h3>
          <p className="text-muted-foreground leading-relaxed">
            GEMA ERP PRO est une solution de gestion intégré (ERP) complète conçue spécialement pour les entreprises marocaines.
            Elle couvre l'ensemble du cycle d'activité : de la gestion commerciale et des achats, jusqu'à la production,
            la finance et l'administration. Développée avec les standards du marché marocain (ICE, TVA, CNSS, Patente),
            elle s'adapte à tous les secteurs d'activité.
          </p>
        </CardContent>
      </Card>

      <SubTitle id="introduction-bienvenue">À qui s'adresse ce guide ?</SubTitle>
      <Paragraph>
        Ce guide est conçu pour les nouveaux utilisateurs de GEMA ERP PRO. Que vous soyez commercial,
        magasinier, responsable de production, comptable ou administrateur, vous trouverez ici toutes les informations
        nécessaires pour maîtriser le système rapidement.
      </Paragraph>

      <TipBox type="info">
        Ce guide utilise des données d'exemple avec des noms d'entreprises et de villes marocaines pour faciliter la compréhension.
      </TipBox>

      <SubTitle>Vue d'ensemble des modules</SubTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        {[
          { icon: LayoutDashboard, label: 'Tableau de bord', desc: 'KPIs et indicateurs', color: 'text-sky-500 bg-sky-50' },
          { icon: ShoppingCart, label: 'Ventes', desc: 'Clients, devis, factures', color: 'text-emerald-500 bg-emerald-50' },
          { icon: Truck, label: 'Achats', desc: 'Fournisseurs, commandes', color: 'text-amber-500 bg-amber-50' },
          { icon: Warehouse, label: 'Stock', desc: 'Mouvements et alertes', color: 'text-slate-500 bg-slate-50' },
          { icon: Factory, label: 'Production', desc: 'Fabrication et BOM', color: 'text-green-600 bg-green-50' },
          { icon: Landmark, label: 'Finance', desc: 'Caisses et banque', color: 'text-blue-600 bg-blue-50' },
          { icon: Settings, label: 'Administration', desc: 'Utilisateurs et config', color: 'text-gray-500 bg-gray-50' },
          { icon: Printer, label: 'Impression', desc: 'Documents PDF', color: 'text-rose-500 bg-rose-50' },
          { icon: MessageSquare, label: 'Communication', desc: 'Messagerie interne', color: 'text-sky-600 bg-sky-50' },
          { icon: Bell, label: 'Notifications', desc: 'Alertes et rappels', color: 'text-amber-600 bg-amber-50' },
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

      <SubTitle id="introduction-modules-roles">10 rôles utilisateurs</SubTitle>
      <Paragraph>
        GEMA ERP PRO gère 10 rôles distincts pour contrôler précisément les accès de chaque utilisateur :
      </Paragraph>
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
                { role: 'super_admin', desc: 'Super Administrateur', access: 'Accès total + gestion utilisateurs' },
                { role: 'admin', desc: 'Administrateur', access: 'Tous les modules sauf utilisateurs' },
                { role: 'commercial', desc: 'Commercial', access: 'Clients, Devis, Commandes, Factures' },
                { role: 'buyer', desc: 'Acheteur', access: 'Fournisseurs, Demandes, Commandes fournisseurs' },
                { role: 'storekeeper', desc: 'Magasinier', access: 'Stock, Mouvements, Produits' },
                { role: 'prod_manager', desc: 'Resp. Production', access: 'Nomenclatures, Gammes, OF' },
                { role: 'operator', desc: 'Opérateur', access: 'Ordres de fabrication assignés' },
                { role: 'accountant', desc: 'Comptable', access: 'Factures, Paiements, Comptabilité' },
                { role: 'cashier', desc: 'Caissier', access: 'Caisses, Paiements reçus' },
                { role: 'direction', desc: 'Direction', access: 'Tableau de bord, Rapports, Lecture seule' },
              ].map((r) => (
                <TableRow key={r.role}>
                  <TableCell className="font-mono text-xs font-medium">{r.role}</TableCell>
                  <TableCell className="text-sm">{r.desc}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.access}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function ConnexionSection() {
  return (
    <div>
      <SectionTitle icon={LogIn} title="Connexion & Navigation" />

      <SubTitle id="connexion-se-connecter">Comment se connecter</SubTitle>
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

      <SubTitle id="connexion-navigation">Navigation dans le système</SubTitle>
      <Paragraph>
        L'interface est organisée avec une <strong>barre latérale</strong> (sidebar) à gauche qui regroupe tous les modules
        par catégorie. Chaque catégorie peut être dépliée ou repliée en cliquant sur son titre.
      </Paragraph>

      <SubTitle id="connexion-mode-sombre">Mode sombre</SubTitle>
      <Paragraph>
        GEMA ERP PRO prend en charge le <strong>mode sombre</strong>. Pour basculer entre le mode clair et sombre,
        cliquez sur l'icône soleil/lune dans la barre d'en-tête en haut à droite de l'écran. Le choix est mémorisé
        automatiquement pour votre prochaine session.
      </Paragraph>

      <ScreenMock title="Structure de la barre latérale">
        <div className="space-y-2 max-w-xs">
          {[
            { title: 'Tableau de bord', items: ['Vue d\'ensemble'] },
            { title: 'Ventes', items: ['Clients', 'Devis', 'Commandes', 'Préparations', 'Bons de livraison', 'Factures', 'Avoirs'] },
            { title: 'Achats', items: ['Fournisseurs', 'Demandes de prix', 'Devis fournisseurs', 'Commandes fournisseurs', 'Réceptions', 'Bons de retour', 'Avoirs fournisseurs', 'Factures fournisseurs'] },
            { title: 'Stock', items: ['Produits', 'Mouvements', 'Alertes stock', 'Inventaires', 'Lots de stock'] },
            { title: 'Production', items: ['Nomenclatures', 'Gammes', 'Postes de travail', 'Ordres de fabrication', 'Équipements', 'Maintenance', 'Contrôle qualité'] },
            { title: 'Finance', items: ['Caisses', 'Banque', 'Paiements', 'Chèques & Effets', 'Comptabilité', 'États financiers'] },
            { title: 'Communication', items: ['Messagerie'] },
            { title: 'Administration', items: ['Utilisateurs', 'Journal d\'audit', 'Paramètres', 'Guide d\'utilisation'] },
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

      <SubTitle id="tableau-de-bord-kpis">Cartes KPI</SubTitle>
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

      <SubTitle id="tableau-de-bord-graphiques">Graphiques et courbes</SubTitle>
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

function VentesSection() {
  return (
    <div>
      <SectionTitle icon={ShoppingCart} title="Ventes" />
      <Paragraph>
        Le module Ventes couvre l'intégralité du cycle commercial client : de la gestion des clients et du catalogue produits,
        jusqu'à la facturation et les avoirs, en passant par les devis, commandes, préparations et bons de livraison.
      </Paragraph>

      <SubTitle>Cycle de vente complet</SubTitle>
      <FlowDiagram steps={[
        { label: 'Devis', color: 'bg-cyan-50 border-cyan-200 text-cyan-700', icon: FileText },
        { label: 'Commande', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: ShoppingCart },
        { label: 'Préparation', color: 'bg-sky-50 border-sky-200 text-sky-700', icon: Package },
        { label: 'BL', color: 'bg-violet-50 border-violet-200 text-violet-700', icon: Truck },
        { label: 'Facture', color: 'bg-rose-50 border-rose-200 text-rose-700', icon: Receipt },
        { label: 'Paiement', color: 'bg-amber-50 border-amber-200 text-amber-700', icon: CreditCard },
        { label: 'Avoir', color: 'bg-orange-50 border-orange-200 text-orange-700', icon: RotateCcw },
      ]} />

      <TipBox type="info">
        Chaque étape peut être convertie automatiquement en la suivante. Un devis accepté devient commande, une commande livrée génère un bon de livraison, etc.
      </TipBox>

      {/* Clients */}
      <SubTitle id="ventes-clients">Clients</SubTitle>
      <Paragraph>
        Le sous-module Clients gère l'ensemble de votre portefeuille client. La fiche client comporte <strong>8 onglets</strong> :
        Identité, Coordonnées, Contacts, Commercial, Fiscal, Suivi, Relances et Production.
      </Paragraph>

      <Step num={1}>Accédez à <strong>Ventes → Clients</strong> depuis la barre latérale.</Step>
      <Step num={2}>Cliquez sur <strong>« + Nouveau client »</strong> pour créer un client.</Step>
      <Step num={3}>Remplissez les 8 onglets de la fiche client selon les besoins.</Step>
      <Step num={4}>Cliquez sur <strong>« Enregistrer »</strong> pour valider.</Step>

      <ScreenMock title="Fiche client — SARL AL MOUATAZ INDUSTRIE (onglet Identité)">
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
            <label className="text-xs font-medium text-muted-foreground">IF (Identifiant Fiscal)</label>
            <div className="h-8 rounded border bg-muted/50 px-3 flex items-center text-sm font-mono">12345678</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">CNSS</label>
            <div className="h-8 rounded border bg-muted/50 px-3 flex items-center text-sm font-mono">98765432</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Ville *</label>
            <div className="h-8 rounded border bg-muted/50 px-3 flex items-center text-sm">Casablanca</div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Taux TVA par défaut</label>
            <div className="h-8 rounded border bg-muted/50 px-3 flex items-center text-sm">20%</div>
          </div>
        </div>
      </ScreenMock>

      <TipBox type="success">
        L'ICE (Identifiant Commun de l'Entreprise) est obligatoire au Maroc. Vérifiez sa validité sur le portail de l'Anpme avant toute saisie.
      </TipBox>

      {/* Produits */}
      <SubTitle id="ventes-produits">Produits</SubTitle>
      <Paragraph>
        Le sous-module Produits gère le catalogue complet : matières premières, semi-finis et produits finis.
        Chaque produit dispose d'une fiche avec prix HT, unité de mesure et seuil de stock minimum.
      </Paragraph>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { type: 'Matière première', icon: CircleDot, desc: 'Tôle, aluminium, visserie...', color: 'text-amber-600 bg-amber-50 border-amber-200' },
          { type: 'Semi-fini', icon: Cpu, desc: 'Châssis soudé, pièces découpées...', color: 'text-sky-600 bg-sky-50 border-sky-200' },
          { type: 'Produit fini', icon: PackageCheck, desc: 'Armoire industrielle, banc de travail...', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
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

      <TipBox type="info">
        Les prix sont exprimés en <strong>Dirhams (MAD)</strong>, la devise officielle du Maroc. Le prix affiché est toujours Hors Taxe (HT).
      </TipBox>

      {/* Devis */}
      <SubTitle id="ventes-devis">Devis</SubTitle>
      <Paragraph>
        Les devis sont des propositions commerciales envoyées aux clients. Chaque devis suit un cycle de vie :
        Brouillon → Envoyé → Accepté / Refusé / Expiré.
      </Paragraph>

      <FlowDiagram steps={[
        { label: 'Brouillon', color: 'bg-gray-100 border-gray-200 text-gray-600', icon: FileText },
        { label: 'Envoyé', color: 'bg-sky-50 border-sky-200 text-sky-700', icon: ArrowDown },
        { label: 'Accepté', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle },
        { label: 'Refusé / Expiré', color: 'bg-red-50 border-red-200 text-red-700', icon: XCircle },
      ]} />

      <Step num={1}>Accédez à <strong>Ventes → Devis</strong> et cliquez sur <strong>« + Nouveau devis »</strong>.</Step>
      <Step num={2}>Sélectionnez le client et ajoutez les lignes de produits.</Step>
      <Step num={3}>Le système calcule automatiquement le HT, la TVA (selon le taux du client) et le TTC.</Step>
      <Step num={4}>Enregistrez puis envoyez le devis au client.</Step>

      <TipBox type="success">
        Un devis accepté peut être converti en <strong>commande client</strong> en un seul clic : les lignes, quantités et prix sont repris automatiquement.
      </TipBox>

      {/* Commandes */}
      <SubTitle id="ventes-commandes">Commandes</SubTitle>
      <Paragraph>
        Les commandes clients représentent les engagements fermes. Elles déclenchent le processus de préparation
        et de livraison. Le cycle : Confirmée → En préparation → Prête → Livrée → Facturée.
      </Paragraph>

      <FlowDiagram steps={[
        { label: 'Confirmée', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle },
        { label: 'En préparation', color: 'bg-sky-50 border-sky-200 text-sky-700', icon: Package },
        { label: 'Prête', color: 'bg-violet-50 border-violet-200 text-violet-700', icon: PackageCheck },
        { label: 'Livrée', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: Truck },
        { label: 'Facturée', color: 'bg-gray-100 border-gray-200 text-gray-600', icon: Receipt },
      ]} />

      {/* Préparations */}
      <SubTitle id="ventes-preparations">Préparations</SubTitle>
      <Paragraph>
        Les préparations détaillent le prélèvement en stock pour chaque commande. Le magasinier indique
        les quantités réellement prélevées et signale les éventuels manquants.
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

      <TipBox type="success">
        Une préparation validée peut être convertie directement en <strong>bon de livraison</strong> en un seul clic.
        Les quantités préparées sont automatiquement reprises dans le BL.
      </TipBox>

      {/* Bons de livraison */}
      <SubTitle id="ventes-bons-livraison">Bons de livraison</SubTitle>
      <Paragraph>
        Le bon de livraison (BL) est édité après la préparation complète. Il atteste la remise de la marchandise
        au client et constitue le document de référence pour la facturation.
      </Paragraph>
      <TipBox type="tip">
        <strong>Mode édition :</strong> Les BL peuvent être modifiés après création. Cliquez sur l'icône crayon dans les actions
        pour ouvrir le mode édition. Vous pouvez modifier l'adresse de livraison, les quantités, les prix unitaires
        et les taux de TVA. Si le BL est lié à une commande, les quantités livrées dans la commande et le stock
        sont automatiquement mis à jour.
      </TipBox>

      {/* Icônes de statut — Ventes */}
      <SubTitle id="ventes-icones-statut">Légende des icônes de statut</SubTitle>
      <Paragraph>
        Dans toutes les listes du module Ventes, des <strong>icônes colorées</strong> s'affichent à côté du numéro
        de document pour identifier rapidement son statut. Une légende est toujours visible en haut du tableau.
      </Paragraph>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Icône</TableHead>
                <TableHead>Couleur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Commandes */}
              <TableRow><TableCell rowSpan={7} className="font-medium">Commandes</TableCell><TableCell>En attente</TableCell><TableCell><Clock className="h-4 w-4 text-yellow-500" /></TableCell><TableCell><span className="text-yellow-500 text-xs">Jaune</span></TableCell></TableRow>
              <TableRow><TableCell>Confirmé</TableCell><TableCell><ClipboardList className="h-4 w-4 text-blue-500" /></TableCell><TableCell><span className="text-blue-500 text-xs">Bleu</span></TableCell></TableRow>
              <TableRow><TableCell>En préparation</TableCell><TableCell><Package className="h-4 w-4 text-orange-500" /></TableCell><TableCell><span className="text-orange-500 text-xs">Orange</span></TableCell></TableRow>
              <TableRow><TableCell>Préparé</TableCell><TableCell><FileCheck className="h-4 w-4 text-teal-500" /></TableCell><TableCell><span className="text-teal-500 text-xs">Teal</span></TableCell></TableRow>
              <TableRow><TableCell>Partiellement livré</TableCell><TableCell><Truck className="h-4 w-4 text-indigo-500" /></TableCell><TableCell><span className="text-indigo-500 text-xs">Indigo</span></TableCell></TableRow>
              <TableRow><TableCell>Livré</TableCell><TableCell><CheckCircle className="h-4 w-4 text-green-500" /></TableCell><TableCell><span className="text-green-500 text-xs">Vert</span></TableCell></TableRow>
              <TableRow><TableCell>Annulé</TableCell><TableCell><XCircle className="h-4 w-4 text-red-500" /></TableCell><TableCell><span className="text-red-500 text-xs">Rouge</span></TableCell></TableRow>
              {/* BL */}
              <TableRow><TableCell rowSpan={4} className="font-medium">Bons de livraison</TableCell><TableCell>Brouillon</TableCell><TableCell><FileText className="h-4 w-4 text-yellow-500" /></TableCell><TableCell><span className="text-yellow-500 text-xs">Jaune</span></TableCell></TableRow>
              <TableRow><TableCell>Confirmé</TableCell><TableCell><Truck className="h-4 w-4 text-blue-500" /></TableCell><TableCell><span className="text-blue-500 text-xs">Bleu</span></TableCell></TableRow>
              <TableRow><TableCell>Livré</TableCell><TableCell><CheckCircle className="h-4 w-4 text-green-500" /></TableCell><TableCell><span className="text-green-500 text-xs">Vert</span></TableCell></TableRow>
              <TableRow><TableCell>Annulé</TableCell><TableCell><XCircle className="h-4 w-4 text-red-500" /></TableCell><TableCell><span className="text-red-500 text-xs">Rouge</span></TableCell></TableRow>
              {/* Factures */}
              <TableRow><TableCell rowSpan={6} className="font-medium">Factures</TableCell><TableCell>Brouillon</TableCell><TableCell><FileText className="h-4 w-4 text-slate-400" /></TableCell><TableCell><span className="text-slate-400 text-xs">Gris</span></TableCell></TableRow>
              <TableRow><TableCell>Validée</TableCell><TableCell><Shield className="h-4 w-4 text-emerald-500" /></TableCell><TableCell><span className="text-emerald-500 text-xs">Émeraude</span></TableCell></TableRow>
              <TableRow><TableCell>Envoyée</TableCell><TableCell><Send className="h-4 w-4 text-blue-500" /></TableCell><TableCell><span className="text-blue-500 text-xs">Bleu</span></TableCell></TableRow>
              <TableRow><TableCell>Payée</TableCell><TableCell><CheckCircle className="h-4 w-4 text-green-500" /></TableCell><TableCell><span className="text-green-500 text-xs">Vert</span></TableCell></TableRow>
              <TableRow><TableCell>En retard</TableCell><TableCell><AlertCircle className="h-4 w-4 text-red-500" /></TableCell><TableCell><span className="text-red-500 text-xs">Rouge</span></TableCell></TableRow>
              <TableRow><TableCell>Annulée</TableCell><TableCell><XCircle className="h-4 w-4 text-red-500" /></TableCell><TableCell><span className="text-red-500 text-xs">Rouge</span></TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Factures */}
      <SubTitle id="ventes-factures-tva">Factures</SubTitle>
      <Paragraph>
        Les factures sont générées à partir des commandes livrées ou créées manuellement.
        Elles respectent les obligations fiscales marocaines : numérotation séquentielle, TVA, mentions légales.
      </Paragraph>

      <SubTitle>Taux de TVA au Maroc</SubTitle>
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

      <TipBox type="warning">
        Les factures doivent respecter les obligations légales : numéro séquentiel, date, identifiant fiscal du client, détail des opérations et mentions légales complètes.
      </TipBox>

      {/* Avoirs */}
      <SubTitle id="ventes-avoirs">Avoirs</SubTitle>
      <Paragraph>
        Les avoirs sont des notes de crédit émises en cas de retour marchandise, remise commerciale
        ou erreur de facturation. Ils viennent en déduction du montant de la facture d'origine, partiellement ou totalement.
      </Paragraph>

      <Step num={1}>Accédez à <strong>Ventes → Avoirs</strong> et cliquez sur <strong>« + Nouvel avoir »</strong>.</Step>
      <Step num={2}>Sélectionnez la facture d'origine concernée.</Step>
      <Step num={3}>Indiquez les produits retournés et les quantités.</Step>
      <Step num={4}>Enregistrez l'avoir. Le solde client sera mis à jour automatiquement.</Step>
    </div>
  )
}

function AchatsSection() {
  return (
    <div>
      <SectionTitle icon={Truck} title="Achats" />
      <Paragraph>
        Le module Achats gère l'intégralité du processus d'approvisionnement : de la demande de prix
        jusqu'à la facturation fournisseur, en passant par les devis, commandes, réceptions et retours.
      </Paragraph>

      <SubTitle>Cycle d'achat complet</SubTitle>
      <FlowDiagram steps={[
        { label: 'Demande de prix', color: 'bg-cyan-50 border-cyan-200 text-cyan-700', icon: FileText },
        { label: 'Devis fournisseur', color: 'bg-sky-50 border-sky-200 text-sky-700', icon: FileSpreadsheet },
        { label: 'Commande', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: ShoppingCart },
        { label: 'Réception', color: 'bg-violet-50 border-violet-200 text-violet-700', icon: PackageCheck },
        { label: 'Facture fournisseur', color: 'bg-rose-50 border-rose-200 text-rose-700', icon: Receipt },
      ]} />

      {/* Fournisseurs */}
      <SubTitle id="achats-fournisseurs">Fournisseurs</SubTitle>
      <Paragraph>
        Le sous-module Fournisseurs gère votre base de données fournisseurs avec les informations légales,
        les coordonnées bancaires et les conditions commerciales (délais de livraison, remises).
      </Paragraph>

      <Step num={1}>Accédez à <strong>Achats → Fournisseurs</strong>.</Step>
      <Step num={2}>Cliquez sur <strong>« + Nouveau fournisseur »</strong>.</Step>
      <Step num={3}>Saisissez la raison sociale, l'ICE, l'adresse et les coordonnées bancaires (RIB/IBAN).</Step>
      <Step num={4}>Enregistrez le fournisseur.</Step>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fournisseur</TableHead>
                <TableHead>ICE</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { name: 'AcierPlus Industries', ice: '001122334400055', city: 'Tanger', status: 'Actif' },
                { name: 'AluMaroc Distribution', ice: '002233445500066', city: 'Casablanca', status: 'Actif' },
                { name: 'Visserie Atlas SARL', ice: '003344556600077', city: 'Fès', status: 'Actif' },
              ].map((f) => (
                <TableRow key={f.ice}>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell className="font-mono text-xs">{f.ice}</TableCell>
                  <TableCell>{f.city}</TableCell>
                  <TableCell><StatusBadge status={f.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Demandes de prix */}
      <SubTitle id="achats-demandes-prix">Demandes de prix</SubTitle>
      <Paragraph>
        Les demandes de prix sont envoyées à un ou plusieurs fournisseurs pour obtenir des offres comparatives.
        Elles listent les produits souhaités avec les quantités nécessaires.
      </Paragraph>

      <Step num={1}>Créez une demande de prix depuis <strong>Achats → Demandes de prix</strong>.</Step>
      <Step num={2}>Ajoutez les produits et quantités souhaitées.</Step>
      <Step num={3}>Sélectionnez un ou plusieurs fournisseurs destinataires.</Step>
      <Step num={4}>Envoyez la demande. Les fournisseurs pourront y répondre via un devis fournisseur.</Step>

      {/* Devis fournisseurs */}
      <SubTitle id="achats-devis-fournisseurs">Devis fournisseurs</SubTitle>
      <Paragraph>
        Les devis fournisseurs contiennent les offres de prix reçues en réponse à vos demandes.
        Vous pouvez comparer les offres et sélectionner la plus avantageuse avant de passer commande.
      </Paragraph>

      <TipBox type="info">
        Pour comparer facilement les offres, utilisez le tableau de comparaison qui affiche les prix unitaires, les remises et les délais de livraison côte à côte.
      </TipBox>

      {/* Commandes fournisseurs */}
      <SubTitle id="achats-commandes-fournisseurs">Commandes fournisseurs</SubTitle>
      <Paragraph>
        Les commandes fournisseurs formalisent votre engagement d'achat auprès d'un fournisseur sélectionné.
        Elles peuvent être créées directement ou converties depuis un devis fournisseur accepté.
      </Paragraph>

      <FlowDiagram steps={[
        { label: 'Brouillon', color: 'bg-gray-100 border-gray-200 text-gray-600', icon: FileText },
        { label: 'Envoyée', color: 'bg-sky-50 border-sky-200 text-sky-700', icon: ArrowDown },
        { label: 'Confirmée', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle },
        { label: 'Partiellement reçue', color: 'bg-amber-50 border-amber-200 text-amber-700', icon: Package },
        { label: 'Reçue', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: PackageCheck },
      ]} />

      {/* Réceptions */}
      <SubTitle id="achats-receptions">Réceptions</SubTitle>
      <Paragraph>
        Les réceptions enregistrent l'entrée en stock des marchandises livrées par le fournisseur.
        Le magasinier vérifie les quantités reçues et signale les éventuels écarts.
      </Paragraph>

      <Step num={1}>Accédez à <strong>Achats → Réceptions</strong>.</Step>
      <Step num={2}>Sélectionnez la commande fournisseur concernée.</Step>
      <Step num={3}>Vérifiez et saisissez les quantités effectivement reçues pour chaque produit.</Step>
      <Step num={4}>Validez : le stock est automatiquement mis à jour avec une entrée.</Step>

      <TipBox type="success">
        La réception met à jour automatiquement le stock (entrée) et le statut de la commande fournisseur (partiellement ou totalement reçue).
      </TipBox>

      {/* Bons de retour */}
      <SubTitle id="achats-bons-retour">Bons de retour</SubTitle>
      <Paragraph>
        Les bons de retour permettent de retourner de la marchandise au fournisseur (produits défectueux,
        non conformes ou en excédent). Un bon de retour génère une sortie de stock.
      </Paragraph>

      {/* Avoirs fournisseurs */}
      <SubTitle id="achats-avoirs-fournisseurs">Avoirs fournisseurs</SubTitle>
      <Paragraph>
        Les avoirs fournisseurs sont les notes de crédit reçues du fournisseur suite à un retour
        ou à une remise. Ils viennent en déduction de la facture fournisseur correspondante.
      </Paragraph>

      {/* Factures fournisseurs */}
      <SubTitle id="achats-factures-fournisseurs">Factures fournisseurs</SubTitle>
      <Paragraph>
        Les factures fournisseurs enregistrent les dettes envers vos fournisseurs. Elles sont généralement
        rapprochées des réceptions et des avoirs fournisseurs correspondants.
      </Paragraph>

      <TipBox type="warning">
        Vérifiez toujours que le montant de la facture fournisseur correspond aux réceptions validées et aux avoirs appliqués avant de l'enregistrer.
      </TipBox>

      {/* Icônes de statut — Achats */}
      <SubTitle id="achats-icones-statut">Légende des icônes de statut</SubTitle>
      <Paragraph>
        Dans toutes les listes du module Achats, des <strong>icônes colorées</strong> s'affichent à côté du numéro
        de document pour identifier rapidement son statut. Une légende est toujours visible en haut du tableau.
      </Paragraph>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Icône</TableHead>
                <TableHead>Couleur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Devis fournisseurs */}
              <TableRow><TableCell rowSpan={4} className="font-medium">Devis fournisseurs</TableCell><TableCell>Reçu</TableCell><TableCell><PackageCheck className="h-4 w-4 text-blue-500" /></TableCell><TableCell><span className="text-blue-500 text-xs">Bleu</span></TableCell></TableRow>
              <TableRow><TableCell>Accepté</TableCell><TableCell><CheckCircle className="h-4 w-4 text-green-500" /></TableCell><TableCell><span className="text-green-500 text-xs">Vert</span></TableCell></TableRow>
              <TableRow><TableCell>Rejeté</TableCell><TableCell><XCircle className="h-4 w-4 text-red-500" /></TableCell><TableCell><span className="text-red-500 text-xs">Rouge</span></TableCell></TableRow>
              <TableRow><TableCell>Expiré</TableCell><TableCell><Clock className="h-4 w-4 text-orange-500" /></TableCell><TableCell><span className="text-orange-500 text-xs">Orange</span></TableCell></TableRow>
              {/* Commandes fournisseurs */}
              <TableRow><TableCell rowSpan={5} className="font-medium">Commandes fournisseurs</TableCell><TableCell>Brouillon</TableCell><TableCell><FileText className="h-4 w-4 text-gray-400" /></TableCell><TableCell><span className="text-gray-400 text-xs">Gris</span></TableCell></TableRow>
              <TableRow><TableCell>Envoyée</TableCell><TableCell><Send className="h-4 w-4 text-blue-500" /></TableCell><TableCell><span className="text-blue-500 text-xs">Bleu</span></TableCell></TableRow>
              <TableRow><TableCell>Partiellement reçue</TableCell><TableCell><Truck className="h-4 w-4 text-yellow-500" /></TableCell><TableCell><span className="text-yellow-500 text-xs">Jaune</span></TableCell></TableRow>
              <TableRow><TableCell>Reçue</TableCell><TableCell><CheckCircle className="h-4 w-4 text-green-500" /></TableCell><TableCell><span className="text-green-500 text-xs">Vert</span></TableCell></TableRow>
              <TableRow><TableCell>Annulée</TableCell><TableCell><XCircle className="h-4 w-4 text-red-500" /></TableCell><TableCell><span className="text-red-500 text-xs">Rouge</span></TableCell></TableRow>
              {/* Factures fournisseurs */}
              <TableRow><TableCell rowSpan={6} className="font-medium">Factures fournisseurs</TableCell><TableCell>Reçue</TableCell><TableCell><Receipt className="h-4 w-4 text-blue-500" /></TableCell><TableCell><span className="text-blue-500 text-xs">Bleu</span></TableCell></TableRow>
              <TableRow><TableCell>Vérifiée</TableCell><TableCell><Shield className="h-4 w-4 text-purple-500" /></TableCell><TableCell><span className="text-purple-500 text-xs">Violet</span></TableCell></TableRow>
              <TableRow><TableCell>Payée</TableCell><TableCell><CheckCircle className="h-4 w-4 text-green-500" /></TableCell><TableCell><span className="text-green-500 text-xs">Vert</span></TableCell></TableRow>
              <TableRow><TableCell>Partiellement payée</TableCell><TableCell><AlertCircle className="h-4 w-4 text-yellow-500" /></TableCell><TableCell><span className="text-yellow-500 text-xs">Jaune</span></TableCell></TableRow>
              <TableRow><TableCell>En retard</TableCell><TableCell><Clock className="h-4 w-4 text-red-500" /></TableCell><TableCell><span className="text-red-500 text-xs">Rouge</span></TableCell></TableRow>
              <TableRow><TableCell>Annulée</TableCell><TableCell><XCircle className="h-4 w-4 text-gray-400" /></TableCell><TableCell><span className="text-gray-400 text-xs">Gris</span></TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function StockSection() {
  return (
    <div>
      <SectionTitle icon={Warehouse} title="Stock" />
      <Paragraph>
        Le module Stock permet de suivre en temps réel les mouvements de marchandises,
        de gérer les alertes de seuil minimum et de réaliser des inventaires physiques.
      </Paragraph>

      {/* Mouvements */}
      <SubTitle id="stock-mouvements">Mouvements</SubTitle>
      <Paragraph>
        Les mouvements de stock enregistrent toutes les entrées et sorties de marchandises.
        Chaque mouvement est tracé avec la date, la quantité, le produit, la référence du document source
        et le type de mouvement.
      </Paragraph>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { type: 'Entrée', icon: ArrowDown, desc: 'Réception fournisseur, retour client, ajustement positif. Augmente le stock.', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
          { type: 'Sortie', icon: Package, desc: 'Expédition client, consommation production, perte. Diminue le stock.', color: 'bg-red-50 border-red-200 text-red-700' },
          { type: 'Ajustement', icon: ArrowLeftRight, desc: 'Correction manuelle suite à un inventaire. Peut être positif ou négatif.', color: 'bg-amber-50 border-amber-200 text-amber-700' },
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

      <TipBox type="info">
        Les mouvements sont générés automatiquement lors des réceptions (achats), préparations (ventes) et ordres de fabrication (production). Vous pouvez aussi les créer manuellement.
      </TipBox>

      {/* Alertes stock */}
      <SubTitle id="stock-alertes-stock">Alertes stock</SubTitle>
      <Paragraph>
        Pour chaque produit, vous pouvez définir un <strong>seuil minimum</strong>. Lorsque le stock tombe
        en dessous de ce seuil, une alerte apparaît dans ce module et sur le tableau de bord, vous permettant
        de déclencher rapidement un réapprovisionnement.
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
                <TableCell><StatusBadge status="Bloqué" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScreenMock>

      {/* Inventaires */}
      <SubTitle id="stock-inventaires">Inventaires</SubTitle>
      <Paragraph>
        Les inventaires permettent de vérifier l'écart entre le stock théorique (système) et le stock physique (réel).
        Un ajustement automatique est proposé après validation de l'inventaire.
      </Paragraph>

      <Step num={1}>Créez un nouvel inventaire dans <strong>Stock → Inventaires</strong>.</Step>
      <Step num={2}>Sélectionnez les produits ou catégories à inventorier.</Step>
      <Step num={3}>Saisissez les quantités réelles constatées pour chaque produit.</Step>
      <Step num={4}>Validez : le système calcule les écarts et propose des ajustements de stock.</Step>
      <Step num={5}>Confirmez les ajustements pour mettre à jour le stock.</Step>

      <TipBox type="success">
        Planifiez des inventaires tournants régulièrement (mensuels ou trimestriels) pour maintenir la fiabilité des données de stock.
      </TipBox>

      {/* Lots de stock */}
      <SubTitle id="stock-lots-stock">Lots de stock (FIFO)</SubTitle>
      <Paragraph>
        Le suivi par lots permet de tracer l'origine et la destination de chaque lot de marchandises.
        Chaque lot dispose d'un numéro unique, d'une date d'entrée, d'une date d'expiration et d'un suivi
        des mouvements individuels. Le système gère automatiquement la méthode <strong>FIFO</strong> (First In, First Out)
        pour la consommation du stock.
      </Paragraph>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { type: 'Entrée lot', icon: ArrowDown, desc: 'Réception d\'un nouveau lot avec quantité, date d\'entrée et date de péremption.', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
          { type: 'Sortie lot', icon: Package, desc: 'Consommation FIFO automatique : le lot le plus ancien est consommé en premier.', color: 'bg-red-50 border-red-200 text-red-700' },
          { type: 'Réservation', icon: ClipboardList, desc: 'Réserver des quantités d\'un lot pour un ordre de fabrication ou une commande.', color: 'bg-sky-50 border-sky-200 text-sky-700' },
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

      <SubTitle id="stock-lots-stock-creation">Comment gérer les lots</SubTitle>
      <Step num={1}>Accédez à <strong>Stock → Lots de stock</strong> depuis la barre latérale.</Step>
      <Step num={2}>Consultez le tableau récapitulatif avec les filtres par produit, numéro de lot et statut.</Step>
      <Step num={3}>Pour créer un lot, cliquez sur <strong>« + Nouveau lot »</strong> et renseignez le produit, la quantité, la date d'entrée et la date de péremption.</Step>
      <Step num={4}>Pour exécuter le FIFO manuellement, sélectionnez un lot et cliquez sur <strong>« Exécuter FIFO »</strong> : le système consomme automatiquement les lots les plus anciens.</Step>
      <Step num={5}>Chaque mouvement de lot est tracé dans l'historique (entrées, sorties, réservations, annulations).</Step>

      <ScreenMock title="Lots de stock — Tableau récapitulatif">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N° Lot</TableHead>
              <TableHead>Produit</TableHead>
              <TableHead className="text-right">Quantité</TableHead>
              <TableHead className="text-right">Réservé</TableHead>
              <TableHead>Entrée</TableHead>
              <TableHead>Péremption</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              { lot: 'LOT-2026-001', product: 'Résine PVC K-67', qty: '5 000 kg', reserved: '2 000 kg', entry: '10/01/2026', expiry: '10/01/2027' },
              { lot: 'LOT-2026-002', product: 'Résine PVC K-67', qty: '3 000 kg', reserved: '0 kg', entry: '25/01/2026', expiry: '25/01/2027' },
              { lot: 'LOT-2026-010', product: 'Stabilisant Ca/Zn', qty: '500 kg', reserved: '200 kg', entry: '05/02/2026', expiry: '05/02/2027' },
            ].map((l) => (
              <TableRow key={l.lot}>
                <TableCell className="font-mono text-xs font-medium">{l.lot}</TableCell>
                <TableCell className="text-sm">{l.product}</TableCell>
                <TableCell className="text-right font-mono">{l.qty}</TableCell>
                <TableCell className="text-right font-mono text-amber-600">{l.reserved}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.entry}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.expiry}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScreenMock>

      <TipBox type="info">
        La méthode FIFO garantit que les lots les plus anciens sont consommés en premier, ce qui est essentiel pour les produits périssables (résines, additifs, stabilisants). Vous pouvez également annuler une réservation si l'ordre de fabrication est reporté.
      </TipBox>

      <TipBox type="warning">
        Les lots sont sauvegardés dans le système de sauvegarde automatique. En cas de perte de données, les lots et leurs mouvements sont entièrement restaurables.
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

      <SubTitle>Cycle de production</SubTitle>
      <FlowDiagram steps={[
        { label: 'Nomenclature', color: 'bg-amber-50 border-amber-200 text-amber-700', icon: FileSpreadsheet },
        { label: 'Gamme', color: 'bg-sky-50 border-sky-200 text-sky-700', icon: FileCheck },
        { label: 'Ordre de fabrication', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: Factory },
        { label: 'Production', color: 'bg-violet-50 border-violet-200 text-violet-700', icon: Cpu },
      ]} />

      {/* Nomenclatures */}
      <SubTitle id="production-nomenclatures">Nomenclatures (BOM — Bill of Materials)</SubTitle>
      <Paragraph>
        Une nomenclature définit la liste des composants et matières premières nécessaires pour fabriquer
        un produit fini. Elle inclut les quantités exactes et les liens entre composants.
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
              { name: 'Visserie M8x30', ref: 'MP-003', qty: '20 pcs', type: 'Matière première' },
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

      <Step num={1}>Accédez à <strong>Production → Nomenclatures</strong>.</Step>
      <Step num={2}>Sélectionnez le produit fini concerné.</Step>
      <Step num={3}>Ajoutez les composants avec leurs quantités unitaires.</Step>
      <Step num={4}>Enregistrez la nomenclature.</Step>

      {/* Gammes */}
      <SubTitle id="production-gammes">Gammes opératoires</SubTitle>
      <Paragraph>
        Une gamme opératoire décrit les étapes successives de fabrication : découpe, soudure, peinture,
        assemblage, contrôle qualité, etc. Chaque étape est associée à un poste de travail et un temps estimé.
      </Paragraph>

      <ScreenMock title="Gamme — PF-001 Armoire industrielle modulable">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Étape</TableHead>
              <TableHead>Opération</TableHead>
              <TableHead>Poste de travail</TableHead>
              <TableHead className="text-right">Temps estimé</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              { step: '10', op: 'Découpe tôle', station: 'Découpe laser', time: '30 min' },
              { step: '20', op: 'Pliage et formage', station: 'Presse plieuse', time: '20 min' },
              { step: '30', op: 'Soudure', station: 'Poste soudure TIG', time: '45 min' },
              { step: '40', op: 'Peinture poudre', station: 'Cabine peinture', time: '60 min' },
              { step: '50', op: 'Assemblage', station: 'Poste montage', time: '40 min' },
              { step: '60', op: 'Contrôle qualité', station: 'Labo QC', time: '15 min' },
            ].map((g) => (
              <TableRow key={g.step}>
                <TableCell className="font-mono text-xs">{g.step}</TableCell>
                <TableCell className="text-sm">{g.op}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{g.station}</TableCell>
                <TableCell className="text-right font-mono">{g.time}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScreenMock>

      {/* Postes de travail */}
      <SubTitle id="production-postes-travail">Postes de travail</SubTitle>
      <Paragraph>
        Les postes de travail représentent les ressources physiques de production : machines, ateliers,
        stations de montage. Ils sont associés aux étapes des gammes opératoires.
      </Paragraph>

      <TipBox type="info">
        Chaque poste de travail peut avoir un <strong>coût horaire</strong> qui sert au calcul du coût de revient des produits fabriqués.
      </TipBox>

      {/* Ordres de fabrication */}
      <SubTitle id="production-ordres-fabrication">Ordres de fabrication (OF)</SubTitle>
      <Paragraph>
        Un ordre de fabrication est lancé pour produire une quantité déterminée d'un produit fini.
        Il consomme les matières premières de la nomenclature et suit l'avancement via la gamme opératoire.
      </Paragraph>

      <FlowDiagram steps={[
        { label: 'Planifié', color: 'bg-gray-100 border-gray-200 text-gray-600', icon: Circle },
        { label: 'En cours', color: 'bg-sky-50 border-sky-200 text-sky-700', icon: Cpu },
        { label: 'Terminé', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle },
        { label: 'Contrôlé', color: 'bg-violet-50 border-violet-200 text-violet-700', icon: FileCheck },
      ]} />

      <Step num={1}>Accédez à <strong>Production → Ordres de fabrication</strong>.</Step>
      <Step num={2}>Cliquez sur <strong>« + Nouvel OF »</strong> et sélectionnez le produit fini.</Step>
      <Step num={3}>Indiquez la quantité à produire. Le système calcule les composants nécessaires via la nomenclature.</Step>
      <Step num={4}>Lancez l'OF : les matières premières sont réservées en stock.</Step>
      <Step num={5}>Suivez l'avancement étape par étape selon la gamme opératoire.</Step>
      <Step num={6}>À la fin, validez la production : le stock de produit fini est augmenté.</Step>

      <TipBox type="warning">
        Les composants sont réservés en stock au lancement de l'OF. Assurez-vous d'avoir suffisamment de stock avant de démarrer la production.
      </TipBox>

      {/* Contrôle qualité */}
      <SubTitle id="production-controle-qualite">Contrôle qualité</SubTitle>
      <Paragraph>
        Le module Contrôle qualité permet de gérer les inspections de qualité lors des réceptions fournisseurs,
        de la production et des inventaires. Chaque contrôle génère une fiche avec des lignes d'inspection
        détaillant les critères vérifiés, les résultats obtenus (Conforme / Non conforme) et les observations.
      </Paragraph>

      <Step num={1}>Accédez à <strong>Production → Contrôle qualité</strong>.</Step>
      <Step num={2}>Cliquez sur <strong>« + Nouveau contrôle »</strong> et sélectionnez le type (Réception, Production, Inventaire).</Step>
      <Step num={3}>Ajoutez les lignes d'inspection avec les critères, mesures et résultats.</Step>
      <Step num={4}>Enregistrez le contrôle. Les produits non conformes peuvent déclencher des actions correctives.</Step>

      <TipBox type="warning">
        Les contrôles qualité sont sauvegardés dans les sauvegardes automatiques du système. Assurez-vous de documenter
        tous les non-conformités pour le suivi qualité.
      </TipBox>

      {/* ═══ ÉQUIPEMENTS ═══ */}
      <SubTitle id="production-equipements">Équipements</SubTitle>
      <Paragraph>
        Le sous-module Équipements constitue le registre complet des machines et outils de production de l'entreprise.
        Il permet de suivre l'état de chaque équipement, de planifier les maintenances préventives et d'anticiper
        les pannes. Chaque équipement dispose d'une fiche détaillée avec ses caractéristiques techniques,
        son historique de maintenance et ses plans préventifs.
      </Paragraph>

      <SubTitle id="production-equipements-types">Types d'équipements</SubTitle>
      <Paragraph>
        Le système supporte 12 types d'équipements prédéfinis, couvrant l'ensemble des machines
        d'une unité de production industrielle :
      </Paragraph>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        {[
          { type: 'Extrudeuse', desc: 'Ligne d\'extrusion PVC', icon: Factory },
          { type: 'Moule', desc: 'Moules de fabrication', icon: Cog },
          { type: 'Compresseur', desc: 'Compresseurs d\'air', icon: Gauge },
          { type: 'Four', desc: 'Fours de traitement', icon: AlertTriangle },
          { type: 'Découpeuse', desc: 'Machines de découpe', icon: Hammer },
          { type: 'Emballage', desc: 'Lignes d\'emballage', icon: Package },
          { type: 'Pompe', desc: 'Pompes industriels', icon: CircleDot },
          { type: 'Moteur', desc: 'Moteurs électriques', icon: Cpu },
          { type: 'Climatisation', desc: 'Systèmes CVC', icon: Building2 },
          { type: 'Convoyeur', desc: 'Tapis et convoyeurs', icon: ArrowRight },
          { type: 'Générateur', desc: 'Groupes électrogènes', icon: Zap },
          { type: 'Autre', desc: 'Autres équipements', icon: Settings },
        ].map((e) => (
          <Card key={e.type} className="hover:shadow-md transition-shadow">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <e.icon className="h-4 w-4 text-primary" />
                <p className="font-semibold text-sm">{e.type}</p>
              </div>
              <p className="text-xs text-muted-foreground">{e.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <SubTitle id="production-equipements-statuts">Statuts et criticité</SubTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Statuts de l'équipement</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {[
                { status: 'En service', color: 'bg-emerald-100 text-emerald-700', desc: 'Fonctionne normalement' },
                { status: 'En panne', color: 'bg-red-100 text-red-700', desc: 'Hors service, nécessite une réparation' },
                { status: 'En maintenance', color: 'bg-amber-100 text-amber-700', desc: 'En cours d\'intervention' },
                { status: 'Hors service', color: 'bg-gray-100 text-gray-600', desc: 'Retiré définitivement' },
                { status: 'En réserve', color: 'bg-sky-100 text-sky-700', desc: 'Stocké, non utilisé' },
              ].map((s) => (
                <div key={s.status} className="flex items-center gap-3">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', s.color)}>{s.status}</span>
                  <span className="text-xs text-muted-foreground">{s.desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Niveaux de criticité</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {[
                { level: 'Haute', color: 'bg-red-100 text-red-700', desc: 'Arrêt = arrêt total de la production' },
                { level: 'Moyenne', color: 'bg-amber-100 text-amber-700', desc: 'Impact partiel sur la production' },
                { level: 'Basse', color: 'bg-emerald-100 text-emerald-700', desc: 'Pas d\'impact direct sur la production' },
              ].map((l) => (
                <div key={l.level} className="flex items-center gap-3">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', l.color)}>{l.level}</span>
                  <span className="text-xs text-muted-foreground">{l.desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <SubTitle id="production-equipements-gerer">Comment gérer les équipements</SubTitle>
      <Step num={1}>Accédez à <strong>Production → Équipements</strong> depuis la barre latérale.</Step>
      <Step num={2}>Consultez les <strong>cartes récapitulatives</strong> en haut : Total, En service, En panne, Maintenance prévue ≤ 7 jours.</Step>
      <Step num={3}>Utilisez les <strong>filtres</strong> (recherche, statut, type, criticité) pour trouver un équipement.</Step>
      <Step num={4}>Pour créer un équipement, cliquez sur <strong>« + Nouvel équipement »</strong> et remplissez la fiche :</Step>

      <ScreenMock title="Fiche équipement — EXT-001 Extrudeuse principale PVC">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          {[
            { label: 'Code *', value: 'EXT-001' },
            { label: 'Désignation *', value: 'Extrudeuse principale PVC 160mm' },
            { label: 'Type', value: 'Extrudeuse' },
            { label: 'Marque', value: 'Reifenhauser' },
            { label: 'Modèle', value: 'REILLOY 90' },
            { label: 'N° de série', value: 'RFH-2023-45872' },
            { label: 'Date d\'installation', value: '15/03/2023' },
            { label: 'Emplacement', value: 'Hall A — Ligne 1' },
            { label: 'Statut', value: 'En service' },
            { label: 'Criticité', value: 'Haute' },
          ].map((f) => (
            <div key={f.label} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
              <div className="h-8 rounded border bg-muted/50 px-3 flex items-center text-sm">{f.value}</div>
            </div>
          ))}
        </div>
      </ScreenMock>

      <SubTitle id="production-equipements-detail">Vue détaillée d'un équipement</SubTitle>
      <Paragraph>
        En cliquant sur un équipement, vous accédez à sa <strong>fiche détaillée</strong> qui comprend trois onglets :
      </Paragraph>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { title: 'Informations', desc: 'Toutes les caractéristiques techniques : code, type, marque, modèle, N° série, emplacement, statut, criticité et notes.', color: 'bg-sky-50 border-sky-200 text-sky-700' },
          { title: 'Plans préventifs', desc: 'Liste des plans de maintenance préventive associés : fréquence, dernier passage, prochain passage.', color: 'bg-amber-50 border-amber-200 text-amber-700' },
          { title: 'Ordres de travail', desc: 'Historique des ordres de travail maintenance (OTM) récents : type, statut, date, description.', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
        ].map((t) => (
          <Card key={t.title} className={t.color}>
            <CardContent className="p-4">
              <p className="font-semibold text-sm mb-1">{t.title}</p>
              <p className="text-xs opacity-80">{t.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <TipBox type="warning">
        Un équipement ne peut pas être supprimé s'il a des plans de maintenance actifs ou des ordres de travail en cours. Il faut d'abord supprimer ou terminer les éléments liés.
      </TipBox>

      {/* ═══ MAINTENANCE INDUSTRIELLE ═══ */}
      <SubTitle id="production-maintenance">Maintenance industrielle</SubTitle>
      <Paragraph>
        Le sous-module Maintenance gère l'ensemble des interventions techniques sur les équipements de production.
        Il couvre la <strong>maintenance préventive</strong> (planifiée), <strong>corrective</strong> (suite à panne),
        <strong>conditionnelle</strong> (basée sur l'état) et <strong>améliorative</strong> (optimisation).
        Chaque intervention est tracée via un Ordre de Travail Maintenance (OTM).
      </Paragraph>

      <SubTitle id="production-maintenance-types">Types de maintenance</SubTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[
          { type: 'Préventive', icon: ClipboardList, desc: 'Interventions planifiées à intervalle régulier pour prévenir les pannes. Basée sur les plans de maintenance.', color: 'bg-sky-50 border-sky-200 text-sky-700' },
          { type: 'Corrective', icon: Wrench, desc: 'Réparation suite à une panne ou un dysfonctionnement. Objectif : remettre l\'équipement en état de marche.', color: 'bg-red-50 border-red-200 text-red-700' },
          { type: 'Conditionnelle', icon: Gauge, desc: 'Intervention déclenchée par un indicateur de condition (vibration, température, usure). Maintenance prédictive.', color: 'bg-amber-50 border-amber-200 text-amber-700' },
          { type: 'Améliorative', icon: TrendingUp, desc: 'Modification ou optimisation d\'un équipement pour améliorer ses performances ou sa fiabilité.', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
        ].map((m) => (
          <Card key={m.type} className={m.color}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <m.icon className="h-5 w-5" />
                <p className="font-semibold">{m.type}</p>
              </div>
              <p className="text-xs opacity-80">{m.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <SubTitle id="production-maintenance-cycle">Cycle de vie d'un OTM</SubTitle>
      <FlowDiagram steps={[
        { label: 'Planifiée', color: 'bg-gray-100 border-gray-200 text-gray-600', icon: Circle },
        { label: 'En cours', color: 'bg-sky-50 border-sky-200 text-sky-700', icon: Wrench },
        { label: 'Attente pièces', color: 'bg-amber-50 border-amber-200 text-amber-700', icon: Clock },
        { label: 'Terminée', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle },
        { label: 'Validée', color: 'bg-violet-50 border-violet-200 text-violet-700', icon: FileCheck },
      ]} />

      <Paragraph>
        Un OTM peut aussi être <strong>Annulé</strong> à tout moment avant sa validation. Les transitions de statut
        sont les suivantes : Démarrer (→ En cours), Terminer (→ Terminée), Attente pièces (→ En attente pièces),
        Reprendre (→ En cours), Annuler (→ Annulée), Valider (→ Validée).
      </Paragraph>

      <SubTitle id="production-maintenance-priorites">Priorités des interventions</SubTitle>
      <div className="flex flex-wrap gap-3 mb-6">
        {[
          { label: 'Urgente', desc: 'Arrêt de production, sécurité en jeu', color: 'bg-red-100 text-red-700 border-red-200' },
          { label: 'Haute', desc: 'Impact significatif sur la production', color: 'bg-orange-100 text-orange-700 border-orange-200' },
          { label: 'Normale', desc: 'Planifié, pas d\'impact immédiat', color: 'bg-sky-100 text-sky-700 border-sky-200' },
          { label: 'Basse', desc: 'Peut être reporté sans risque', color: 'bg-gray-100 text-gray-600 border-gray-200' },
        ].map((p) => (
          <div key={p.label} className={cn('px-4 py-3 rounded-lg border', p.color)}>
            <p className="font-semibold text-sm">{p.label}</p>
            <p className="text-xs mt-1 opacity-80">{p.desc}</p>
          </div>
        ))}
      </div>

      <SubTitle id="production-maintenance-creer">Comment créer un ordre de travail (OTM)</SubTitle>
      <Step num={1}>Accédez à <strong>Production → Maintenance</strong> depuis la barre latérale.</Step>
      <Step num={2}>Consultez les <strong>cartes récapitulatives</strong> : Total OTM, En cours, Planifiées, En retard.</Step>
      <Step num={3}>Cliquez sur <strong>« + Nouvel OTM »</strong> et remplissez le formulaire :</Step>

      <ScreenMock title="Nouvel Ordre de Travail Maintenance — OTM-2026-0015">
        <div className="space-y-4 max-w-2xl">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Équipement *', value: 'EXT-001 — Extrudeuse principale PVC' },
              { label: 'Type *', value: 'Préventive' },
              { label: 'Priorité *', value: 'Normale' },
              { label: 'Date prévue', value: '20/02/2026' },
            ].map((f) => (
              <div key={f.label} className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
                <div className="h-8 rounded border bg-muted/50 px-3 flex items-center text-sm">{f.value}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Description de l'intervention *</label>
            <div className="h-16 rounded border bg-muted/50 px-3 flex items-start pt-2 text-sm text-muted-foreground">
              Remplacement du filtre hydraulique et contrôle des roulements du vis sans fin. Vérification de la température de chauffe.
            </div>
          </div>
        </div>
      </ScreenMock>

      <SubTitle id="production-maintenance-executer">Exécuter un OTM</SubTitle>
      <Paragraph>
        Une fois l'OTM créé, le technicien de maintenance peut le traiter étape par étape :
      </Paragraph>
      <Step num={1}>Ouvrez l'OTM et cliquez sur <strong>« Démarrer »</strong> pour passer en statut « En cours ». L'équipement passe automatiquement en statut « En maintenance ».</Step>
      <Step num={2}>Si des pièces de rechange sont nécessaires, cliquez sur <strong>« Attente pièces »</strong> pour mettre l'OTM en pause.</Step>
      <Step num={3}>Ajoutez les <strong>pièces consommées</strong> depuis le catalogue produits (filtrer par usage « maintenance »). Marquez chaque pièce comme utilisée après consommation.</Step>
      <Step num={4}>Lorsque l'intervention est terminée, cliquez sur <strong>« Terminer »</strong> et remplissez le <strong>rapport d'intervention</strong> :</Step>

      <ScreenMock title="Rapport d'intervention — OTM-2026-0015">
        <div className="space-y-3 max-w-lg">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Rapport d'intervention</label>
            <div className="h-20 rounded border bg-muted/50 px-3 flex items-start pt-2 text-sm text-muted-foreground">
              Filtre hydraulique remplacé. Roulements vis sans fin contrôlés, état acceptable. Température de chauffe normale (185°C). Prochain contrôle recommandé dans 3 mois.
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Main d'œuvre (DH)</label>
              <div className="h-8 rounded border bg-muted/50 px-3 flex items-center text-sm font-mono">450.00</div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Temps d'arrêt (h)</label>
              <div className="h-8 rounded border bg-muted/50 px-3 flex items-center text-sm font-mono">3.5</div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Perte production (DH)</label>
              <div className="h-8 rounded border bg-muted/50 px-3 flex items-center text-sm font-mono">2 800.00</div>
            </div>
          </div>
        </div>
      </ScreenMock>

      <Step num={5}>Cliquez sur <strong>« Valider »</strong> pour confirmer l'OTM. L'équipement repasse en statut « En service ».</Step>

      <TipBox type="success">
        Les pièces consommées lors de la maintenance génèrent automatiquement des <strong>sorties de stock</strong> avec l'origine « maintenance ». Le stock est donc mis à jour en temps réel.
      </TipBox>

      <SubTitle id="production-maintenance-pieces">Gestion des pièces de rechange</SubTitle>
      <Paragraph>
        Lors d'une intervention, vous pouvez ajouter des pièces de rechange depuis le catalogue produits.
        Les produits ayant l'usage « maintenance » sont filtrés automatiquement pour faciliter la recherche.
        Chaque pièce ajoutée peut être marquée comme <strong>« Utilisée »</strong> une fois consommée,
        ce qui génère une sortie de stock automatique.
      </Paragraph>

      <TipBox type="info">
        Pour préparer les pièces de rechange, créez vos produits dans <strong>Stock → Produits</strong> avec le type d'usage « maintenance » (ex: filtres, roulements, courroies, joints, huile hydraulique). Ils seront disponibles dans le sélecteur de pièces de l'OTM.
      </TipBox>

      <SubTitle id="production-maintenance-kpis">Indicateurs clés de maintenance (KPIs)</SubTitle>
      <Paragraph>
        Le module Maintenance fournit des indicateurs essentiels pour évaluer la performance de la politique
        de maintenance de l'entreprise :
      </Paragraph>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[
          { kpi: 'MTBF', full: 'Mean Time Between Failures', desc: 'Temps moyen entre deux pannes. Plus il est élevé, plus l\'équipement est fiable.', icon: Timer, color: 'text-emerald-600 bg-emerald-50' },
          { kpi: 'MTTR', full: 'Mean Time To Repair', desc: 'Temps moyen de réparation. Plus il est faible, plus la maintenance est efficace.', icon: Clock, color: 'text-sky-600 bg-sky-50' },
          { kpi: 'Taux de disponibilité', full: 'Disponibilité = MTBF / (MTBF + MTTR)', desc: 'Pourcentage du temps où l\'équipement est opérationnel. Objectif : > 95%.', icon: Gauge, color: 'text-amber-600 bg-amber-50' },
          { kpi: 'Coût maintenance', full: 'Coût total / machine / mois', desc: 'Suivi des dépenses de maintenance par équipement pour optimiser le budget.', icon: Calculator, color: 'text-rose-600 bg-rose-50' },
          { kpi: 'Taux de maintenance préventive', full: 'OTM préventives / Total OTM', desc: 'Objectif : > 80% de maintenance préventive pour minimiser les pannes imprévues.', icon: TrendingUp, color: 'text-violet-600 bg-violet-50' },
          { kpi: 'Nb de pannes / mois', full: 'Nombre de pannes par mois', desc: 'Suivi de la fiabilité globale du parc machines.', icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
        ].map((k) => (
          <Card key={k.kpi} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-3', k.color)}>
                <k.icon className="h-5 w-5" />
              </div>
              <p className="font-bold text-sm">{k.kpi}</p>
              <p className="text-xs text-muted-foreground mb-2">{k.full}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{k.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <SubTitle id="production-maintenance-integration">Intégration avec les autres modules</SubTitle>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { module: 'Stock', desc: 'Consommation automatique des pièces de rechange. Sorties de stock avec origine « maintenance ».', color: 'bg-amber-50 border-amber-200 text-amber-700' },
          { module: 'Production (OF)', desc: 'Alerte quand une machine est en maintenance. Un OF ne peut pas utiliser un équipement indisponible.', color: 'bg-sky-50 border-sky-200 text-sky-700' },
          { module: 'Achats', desc: 'Les pièces de rechange fréquemment utilisées peuvent être réapprovisionnées via les commandes fournisseurs.', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
        ].map((i) => (
          <Card key={i.module} className={i.color}>
            <CardContent className="p-4">
              <p className="font-semibold text-sm mb-1">{i.module}</p>
              <p className="text-xs opacity-80">{i.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <TipBox type="info">
        Les ordres de travail maintenance et les équipements sont entièrement sauvegardés dans le système de backup. En cas de restauration, toutes les données de maintenance sont préservées.
      </TipBox>

      <TipBox type="success">
        <strong>Bonne pratique :</strong> Mettez en place des plans de maintenance préventive pour tous les équipements à criticité haute. Un bon plan préventif réduit les pannes imprévues de 60 à 80% et prolonge la durée de vie des machines.
      </TipBox>
    </div>
  )
}

function FinanceSection() {
  return (
    <div>
      <SectionTitle icon={Landmark} title="Finance" />
      <Paragraph>
        Le module Finance centralise la gestion des flux financiers de l'entreprise : caisses,
        comptes bancaires, paiements reçus et émis, ainsi qu'un aperçu de la comptabilité.
      </Paragraph>

      {/* Caisses */}
      <SubTitle id="finance-caisses">Caisses</SubTitle>
      <Paragraph>
        Gérez vos caisses physiques (caisse principale, caisse de dépannage) avec suivi des entrées
        et sorties d'espèces. Chaque mouvement est tracé avec la date, le montant, le motif et la référence associée.
      </Paragraph>

      <Step num={1}>Accédez à <strong>Finance → Caisses</strong>.</Step>
      <Step num={2}>Consultez le solde actuel et l'historique des mouvements de la caisse.</Step>
      <Step num={3}>Ajoutez une entrée ou une sortie en spécifiant le montant et le motif.</Step>

      {/* Banque */}
      <SubTitle id="finance-banque">Banque</SubTitle>
      <Paragraph>
        Enregistrez vos comptes bancaires pour suivre les virements, les prélèvements et les soldes.
        Associez les paiements reçus par virement aux factures correspondantes.
      </Paragraph>

      <TipBox type="info">
        Vous pouvez gérer plusieurs comptes bancaires (Attijariwafa, BMCE, BCP, CIH, etc.) et suivre les soldes individuellement.
      </TipBox>

      {/* Paiements */}
      <SubTitle id="finance-paiements">Paiements</SubTitle>
      <Paragraph>
        Le sous-module Paiements centralise tous les flux financiers entrants et sortants :
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

      <ScreenMock title="Modes de paiement acceptés">
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Espèces', icon: CircleDot },
            { label: 'Chèque', icon: FileCheck },
            { label: 'Virement bancaire', icon: Building2 },
            { label: 'Traite', icon: FileText },
            { label: 'Effet de commerce', icon: Receipt },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50 text-sm">
              <m.icon className="h-4 w-4 text-muted-foreground" />
              {m.label}
            </div>
          ))}
        </div>
      </ScreenMock>

      {/* Chèques & Effets */}
      <SubTitle id="finance-cheques-effets">Chèques & Effets</SubTitle>
      <Paragraph>
        Le sous-module Chèques & Effets gère les instruments de paiement différés : chèques reçus de clients,
        effets de commerce (lettres de change, billets à ordre). Il permet de suivre le cycle de vie complet
        de ces titres, depuis leur réception jusqu'à leur encaissement ou leur remise à la banque.
      </Paragraph>

      <FlowDiagram steps={[
        { label: 'Réception', color: 'bg-sky-50 border-sky-200 text-sky-700', icon: PackageCheck },
        { label: 'En instance', color: 'bg-amber-50 border-amber-200 text-amber-700', icon: Clock },
        { label: 'Remise banque', color: 'bg-violet-50 border-violet-200 text-violet-700', icon: Building2 },
        { label: 'Encaissé', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: CheckCircle },
        { label: 'Rejeté', color: 'bg-red-50 border-red-200 text-red-700', icon: XCircle },
      ]} />

      <Step num={1}>Accédez à <strong>Finance → Chèques & Effets</strong> depuis la barre latérale.</Step>
      <Step num={2}>Consultez le résumé en haut de page : total des chèques en instance, remis à la banque, encaissés et rejetés.</Step>
      <Step num={3}>Utilisez les <strong>filtres</strong> pour afficher uniquement les chèques selon leur statut.</Step>
      <Step num={4}>Pour remettre un chèque à la banque, sélectionnez-le et cliquez sur <strong>« Remettre à la banque »</strong>.</Step>

      <TipBox type="info">
        Les chèques non remis à la banque sont visibles dans le filtre <strong>« En instance »</strong>. Vérifiez régulièrement cette liste pour optimiser votre trésorerie.
      </TipBox>

      {/* Comptabilité */}
      <SubTitle id="finance-comptabilite">Comptabilité</SubTitle>
      <Paragraph>
        Le sous-module Comptabilité offre une vue d'ensemble des écritures comptables générées automatiquement
        par les opérations commerciales (factures, paiements, avoirs). Les écritures sont classées par journal
        et par période.
      </Paragraph>

      <TipBox type="warning">
        Pour une comptabilité complète conforme au PCG Maroc (Plan Comptable Général), l'export vers un logiciel comptable dédié est recommandé.
      </TipBox>

      {/* États financiers */}
      <SubTitle id="finance-etats-financiers">États financiers</SubTitle>
      <Paragraph>
        Le module États financiers offre des rapports détaillés pour suivre la santé financière de l'entreprise :
      </Paragraph>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[
          { title: 'Extrait client', desc: 'Résumé complet des opérations, soldes et BL non facturés pour un client donné', color: 'text-violet-600 bg-violet-50' },
          { title: 'Balance globale', desc: 'Vue d\'ensemble de tous les clients : encaissements, impayés, et solds cumulés', color: 'text-blue-600 bg-blue-50' },
        ].map((r) => (
          <Card key={r.title}>
            <CardContent className="p-4">
              <p className="font-semibold text-sm mb-1">{r.title}</p>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Step num={1}>Accédez à <strong>Finance → États financiers</strong>.</Step>
      <Step num={2}>Sélectionnez un client pour l'extrait individuel, ou consultez la balance globale.</Step>
      <Step num={3}>Filtrez par période pour analyser une période spécifique.</Step>
      <Step num={4}>Utilisez les données pour le suivi des relances et la prise de décision.</Step>
    </div>
  )
}

function CommunicationSection() {
  return (
    <div>
      <SectionTitle icon={MessageSquare} title="Communication" />
      <Paragraph>
        Le module Communication permet la collaboration interne entre les utilisateurs de l'ERP.
        Il comprend une messagerie interne pour échanger des messages en temps réel entre collègues,
        ainsi qu'un système de notifications pour rester informé des événements importants.
      </Paragraph>

      <SubTitle id="communication-messagerie">Messagerie interne</SubTitle>
      <Paragraph>
        La messagerie permet d'envoyer et recevoir des messages entre les utilisateurs du système.
        Chaque conversation est privée entre deux utilisateurs. L'interface est divisée en deux panneaux :
        la liste des conversations à gauche et la fenêtre de discussion à droite.
      </Paragraph>

      <Step num={1}>Accédez à <strong>Communication → Messagerie</strong> depuis la barre latérale.</Step>
      <Step num={2}>La liste de vos conversations apparaît à gauche. Cliquez sur une conversation pour l'ouvrir.</Step>
      <Step num={3}>Pour démarrer une nouvelle conversation, cliquez sur le bouton <strong>« + »</strong> en haut à droite.</Step>
      <Step num={4}>Recherchez un utilisateur par nom, e-mail ou rôle, puis sélectionnez-le et cliquez sur <strong>« Démarrer »</strong>.</Step>
      <Step num={5}>Saisissez votre message dans la zone de texte en bas et appuyez sur <strong>Entrée</strong> pour l'envoyer.</Step>

      <SubTitle>Fonctionnalités de la messagerie</SubTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[
          { feature: 'Indicateur de présence en ligne', desc: 'Un point vert s\'affiche à côté de l\'avatar lorsque l\'utilisateur est connecté', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
          { feature: 'Sélecteur d\'emojis', desc: 'Plus de 200 emojis répartis en 4 catégories : Smileys, Gestes, Cœurs, Objets', color: 'bg-amber-50 border-amber-200 text-amber-700' },
          { feature: 'Chargement des messages anciens', desc: 'Bouton pour charger l\'historique complet d\'une conversation', color: 'bg-sky-50 border-sky-200 text-sky-700' },
          { feature: 'Recherche de conversations', desc: 'Filtrer les conversations par nom d\'utilisateur', color: 'bg-violet-50 border-violet-200 text-violet-700' },
        ].map((f) => (
          <Card key={f.feature} className={f.color}>
            <CardContent className="p-4">
              <p className="font-semibold text-sm mb-1">{f.feature}</p>
              <p className="text-xs opacity-80">{f.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <TipBox type="success">
        Les messages sont actualisés automatiquement toutes les 5 secondes. Vous pouvez continuer à travailler sur d'autres modules pendant que la messagerie fonctionne en arrière-plan.
      </TipBox>

      <SubTitle>Supprimer une conversation</SubTitle>
      <Paragraph>
        Les administrateurs (super_admin et admin) peuvent supprimer une conversation entière.
        Cette action supprime définitivement la conversation et tous ses messages.
      </Paragraph>
      <Step num={1}>Dans la liste des conversations, repérez l\'icône <strong className="text-red-500">🗑️ corbeille rouge</strong> à droite du contact.</Step>
      <Step num={2}>Cliquez sur l\'icône. Une fenêtre de confirmation apparaît.</Step>
      <Step num={3}>Confirmez la suppression. La conversation et tous ses messages seront effacés.</Step>

      <TipBox type="warning">
        La suppression d\'une conversation est irréversible et supprime tous les messages pour tous les participants.
      </TipBox>

      <SubTitle>Supprimer un message individuel</SubTitle>
      <Paragraph>
        Chaque message dispose d\'une icône de suppression permettant de le retirer de la conversation.
      </Paragraph>
      <Step num={1}>Survolez un message pour voir l\'icône <strong className="text-red-500">🗑️</strong> de suppression.</Step>
      <Step num={2}>Cliquez sur l\'icône et confirmez la suppression dans la boîte de dialogue.</Step>

      <SubTitle id="communication-notifications">Notifications</SubTitle>
      <Paragraph>
        Le système de notifications vous alerte en temps réel sur les événements importants :
        tâches à réaliser, échéances, retards de production, livraisons, modifications de commandes, etc.
        Les administrateurs et opérateurs sont notifiés pour chaque changement ou tâche à effectuer.
      </Paragraph>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[
          { type: 'Alertes commerciales', desc: 'Nouveaux devis, commandes en retard, factures impayées', color: 'bg-rose-50 border-rose-200 text-rose-700' },
          { type: 'Alertes stock', desc: 'Produits sous seuil minimum, ruptures imminentes', color: 'bg-amber-50 border-amber-200 text-amber-700' },
          { type: 'Alertes production', desc: 'OF en retard, ordres à démarrer, achèvements', color: 'bg-sky-50 border-sky-200 text-sky-700' },
          { type: 'Alertes financières', desc: 'Chèques à encaisser, échéances, relances', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
        ].map((n) => (
          <Card key={n.type} className={n.color}>
            <CardContent className="p-4">
              <p className="font-semibold text-sm mb-1">{n.type}</p>
              <p className="text-xs opacity-80">{n.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Step num={1}>L'icône <strong>cloche</strong> dans la barre supérieure affiche le nombre de notifications non lues.</Step>
      <Step num={2}>Cliquez sur la cloche pour ouvrir le panneau des notifications.</Step>
      <Step num={3}>Chaque notification affiche le type, le message et la date. Cliquez pour la marquer comme lue.</Step>
      <Step num={4}>Utilisez le bouton <strong>« Tout marquer comme lu »</strong> pour effacer toutes les notifications d'un coup.</Step>

      <TipBox type="info">
        Les notifications sont automatiquement créées par le système lors des événements clés (création de commande, retard de livraison, etc.).
      </TipBox>
    </div>
  )
}

function ImpressionSection() {
  return (
    <div>
      <SectionTitle icon={Printer} title="Impression" />
      <Paragraph>
        GEMA ERP PRO permet d'imprimer <strong>tous les 13 types de documents</strong> du système
        au format PDF professionnel. Chaque document imprimé inclut automatiquement l'en-tête de l'entreprise
        (logo, identifiants fiscaux) et le montant en toutes lettres en français.
      </Paragraph>

      <SubTitle id="impression-docs-imprimables">Documents imprimables</SubTitle>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { module: 'Ventes', doc: 'Devis client', desc: 'Proposition commerciale avec détail des lignes et totaux TVA' },
                { module: 'Ventes', doc: 'Commande client', desc: 'Confirmation de commande avec conditions de vente' },
                { module: 'Ventes', doc: 'Préparation', desc: 'Bon de prélèvement pour le magasinier' },
                { module: 'Ventes', doc: 'Bon de livraison', desc: 'Document de remise de marchandise au client' },
                { module: 'Ventes', doc: 'Facture client', desc: 'Facture de vente avec TVA et mentions légales' },
                { module: 'Ventes', doc: 'Avoir client', desc: 'Note de crédit pour retour ou remise' },
                { module: 'Achats', doc: 'Demande de prix', desc: 'Demande de devis envoyée aux fournisseurs' },
                { module: 'Achats', doc: 'Commande fournisseur', desc: 'Commande d&apos;achat avec délais et conditions' },
                { module: 'Achats', doc: 'Bon de réception', desc: 'Accusé de réception des marchandises' },
                { module: 'Achats', doc: 'Bon de retour fournisseur', desc: 'Autorisation de retour de marchandise' },
                { module: 'Achats', doc: 'Avoir fournisseur', desc: 'Note de crédit reçue du fournisseur' },
                { module: 'Achats', doc: 'Facture fournisseur', desc: 'Facture d&apos;achat pour comptabilisation' },
                { module: 'Production', doc: 'Ordre de fabrication', desc: 'Ordre de production avec nomenclature et gamme' },
              ].map((d, i) => (
                <TableRow key={i}>
                  <TableCell><Badge variant="outline">{d.module}</Badge></TableCell>
                  <TableCell className="font-medium text-sm">{d.doc}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.desc}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SubTitle id="impression-entete-pied">En-tête de l'entreprise</SubTitle>
      <Paragraph>
        Chaque document imprimé affiche automatiquement l'en-tête de votre entreprise, configurable dans les Paramètres :
      </Paragraph>

      <ScreenMock title="En-tête d'un document imprimé">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg bg-muted border flex items-center justify-center text-xs text-muted-foreground">Logo</div>
              <div>
                <p className="font-bold text-sm">JAZEL WEB AGENCY SARL</p>
                <p className="text-xs text-muted-foreground">123, Bd Zerktouni, Casablanca</p>
                <p className="text-xs text-muted-foreground">Tél : +212 5 22 00 00 00</p>
                <p className="text-xs text-muted-foreground">contact@jazelwebagency.com</p>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground space-y-0.5">
              <p><span className="font-medium">ICE :</span> 009876543000012</p>
              <p><span className="font-medium">IF :</span> 12345678</p>
              <p><span className="font-medium">CNSS :</span> 98765432</p>
              <p><span className="font-medium">TVA :</span> 11223344</p>
              <p><span className="font-medium">RC :</span> 55667788</p>
            </div>
          </div>
          <Separator />
          <p className="text-center font-bold text-base">FACTURE N° FAC-2026-0067</p>
        </div>
      </ScreenMock>

      <SubTitle>Montant en lettres</SubTitle>
      <Paragraph>
        Le montant TTC est automatiquement converti en <strong>toutes lettres en français</strong> au bas de chaque document.
        Par exemple : <em>&laquo; Onze mille soixante-sept dirhams et zéro centimes &raquo;</em>.
      </Paragraph>

      <SubTitle>Comment imprimer un document</SubTitle>
      <Step num={1}>Ouvrez le document souhaité (devis, facture, commande, etc.).</Step>
      <Step num={2}>Cliquez sur le bouton <strong>« Imprimer »</strong> ou <strong>« Télécharger PDF »</strong>.</Step>
      <Step num={3}>Le PDF est généré avec l'en-tête entreprise, les données du document et le pied de page configuré.</Step>
      <Step num={4}>Vous pouvez ensuite l'imprimer physiquement ou l'envoyer par e-mail.</Step>

      <TipBox type="info">
        Le pied de page des documents imprimés est configurable dans <strong>Administration → Paramètres</strong>. Vous pouvez y ajouter jusqu'à 4 lignes de texte personnalisé.
      </TipBox>

      <SubTitle id="impression-notes-visa">Encadrés Notes &amp; Visa</SubTitle>
      <Paragraph>
        Tous les documents clients (devis, commandes, BL, factures, avoirs, retours) et fournisseurs incluent
        automatiquement dans les impressions un <strong>encadré Notes</strong> et deux encadrés de <strong>Visa</strong>
        (Visa Client / Visa Administration pour les ventes, Visa Fournisseur / Visa Administration pour les achats).
        Ces encadrés sont imprimés en pied de page, juste avant la signature.
      </Paragraph>

      <SubTitle id="impression-bl-details">Informations BL</SubTitle>
      <Paragraph>
        Les bons de livraison imprimés affichent en plus : le numéro du BL, la date, la date d'échéance,
        le nom du chauffeur, l'immatriculation du véhicule, le type de transport (Rendu/Départ),
        le transporteur et le responsable ayant créé le BL.
      </Paragraph>
    </div>
  )
}

function AgendaNotificationsSection() {
  return (
    <div>
      <SectionTitle icon={Bell} title="Agenda & Notifications" />
      <Paragraph>
        GEMA ERP PRO intègre un système d'agenda personnel et de notifications pour vous aider à suivre
        vos tâches, échéances et activités importantes en temps réel.
      </Paragraph>

      <SubTitle id="agenda-agenda-personnel">Agenda personnel</SubTitle>
      <Paragraph>
        L'agenda affiche les données qui vous concernent directement : vos devis en cours, commandes à traiter,
        factures impayées, ordres de fabrication actifs et alertes de stock. Chaque utilisateur voit uniquement
        les éléments sur lesquels il a travaillé.
      </Paragraph>

      <Step num={1}>Cliquez sur l'icône <strong>calendrier</strong> dans la barre d'en-tête (à côté du bouton thème).</Step>
      <Step num={2}>Le panneau d'agenda s'ouvre depuis la droite.</Step>
      <Step num={3}>Utilisez le <strong>menu déroulant</strong> en haut pour naviguer entre les vues : Vue d'ensemble, Ventes, Préparations, Factures, Production, Alertes et Calendrier.</Step>
      <Step num={4}>Dans la vue <strong>Calendrier</strong>, cliquez sur un jour pour voir les événements prévus (factures, livraisons, ordres de fabrication, commandes fournisseurs).</Step>

      <SubTitle id="agenda-calendrier">Tableau de bord de l'agenda</SubTitle>
      <Paragraph>
        La vue d'ensemble affiche 9 cartes de statistiques : Devis actifs, Commandes, Préparations, Livraisons,
        Factures, En retard, Ordres de fabrication, Commandes fournisseurs et Alertes stock. En dessous,
        les échéances à venir (factures impayées dans les 7 prochains jours) et l'activité récente.
      </Paragraph>

      <TipBox type="info">
        Les points colorés sur le calendrier indiquent les types d'événements : <strong>rouge</strong> pour les factures,
        <strong> bleu</strong> pour les livraisons, <strong>vert</strong> pour les ordres de fabrication, et
        <strong>orange</strong> pour les commandes fournisseurs.
      </TipBox>

      <SubTitle>Notifications</SubTitle>
      <Paragraph>
        Le système de notifications vous alerte en temps réel sur les événements importants :
        nouvelles commandes, factures en retard, alertes de stock, etc. Le nombre de notifications
        non lues est affiché sous forme de badge rouge sur l'icône cloche dans la barre d'en-tête.
      </Paragraph>

      <Step num={1}>Cliquez sur l'icône <strong>cloche</strong> dans la barre d'en-tête.</Step>
      <Step num={2}>Le panneau de notifications s'ouvre.</Step>
      <Step num={3}>Cliquez sur une notification pour la marquer comme lue et accéder au contenu associé.</Step>
      <Step num={4}>Utilisez <strong>« Tout lire »</strong> pour marquer toutes les notifications comme lues.</Step>

      <TipBox type="success">
        Les notifications sont actualisées automatiquement toutes les 30 secondes. Vous pouvez également
        supprimer individuellement chaque notification en survolant l'élément et cliquant sur l'icône corbeille.
      </TipBox>
    </div>
  )
}

function AdministrationSection() {
  return (
    <div>
      <SectionTitle icon={Settings} title="Administration" />
      <Paragraph>
        Le module Administration est réservé aux utilisateurs <strong>super_admin</strong> et <strong>admin</strong>.
        Il permet de gérer les comptes utilisateurs, de consulter le journal d'audit et de configurer
        les paramètres globaux du système.
      </Paragraph>

      {/* Utilisateurs */}
      <SubTitle id="administration-utilisateurs">Utilisateurs</SubTitle>
      <Paragraph>
        Gérez les comptes des utilisateurs du système, leurs rôles et leurs permissions d'accès.
        Le système dispose de 10 rôles prédéfinis couvrant tous les profils de l'entreprise.
      </Paragraph>

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
                { role: 'super_admin', desc: 'Super Administrateur', access: 'Accès total + gestion utilisateurs' },
                { role: 'admin', desc: 'Administrateur', access: 'Tous les modules sauf utilisateurs' },
                { role: 'commercial', desc: 'Commercial', access: 'Ventes : Clients, Devis, Commandes, BL, Factures' },
                { role: 'buyer', desc: 'Acheteur', access: 'Achats : Fournisseurs, Commandes, Réceptions' },
                { role: 'storekeeper', desc: 'Magasinier', access: 'Stock : Mouvements, Alertes, Inventaires' },
                { role: 'prod_manager', desc: 'Resp. Production', access: 'Production : BOM, Gammes, OF' },
                { role: 'operator', desc: 'Opérateur', access: 'Ordres de fabrication assignés uniquement' },
                { role: 'accountant', desc: 'Comptable', access: 'Finance : Factures, Paiements, Comptabilité' },
                { role: 'cashier', desc: 'Caissier', access: 'Caisses et paiements reçus' },
                { role: 'direction', desc: 'Direction', access: 'Tableau de bord et rapports (lecture seule)' },
              ].map((r) => (
                <TableRow key={r.role}>
                  <TableCell className="font-mono text-xs font-medium">{r.role}</TableCell>
                  <TableCell className="text-sm">{r.desc}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.access}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TipBox type="warning">
        Seul le <strong>Super Administrateur</strong> peut créer, modifier et supprimer des comptes utilisateurs. Le rôle <strong>admin</strong> peut consulter la liste mais pas modifier les rôles.
      </TipBox>

      <SubTitle>Bloquer / Débloquer un utilisateur</SubTitle>
      <Step num={1}>Accédez à <strong>Administration → Utilisateurs</strong>.</Step>
      <Step num={2}>Trouvez l'utilisateur dans la liste.</Step>
      <Step num={3}>Cliquez sur le bouton <strong>« Bloquer »</strong> ou <strong>« Débloquer »</strong>.</Step>
      <Step num={4}>Un utilisateur bloqué ne peut plus se connecter au système.</Step>

      {/* Journal d'audit */}
      <SubTitle id="administration-journal-audit">Journal d'audit</SubTitle>
      <Paragraph>
        Le journal d'audit enregistre toutes les actions importantes effectuées dans le système :
        connexions, créations, modifications, suppressions, changements de statut, etc.
        Chaque entrée contient la date, l'utilisateur, l'action et l'élément concerné.
      </Paragraph>

      <ScreenMock title="Journal d'audit — Dernières actions">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Détail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              { date: '15/01/2026 14:32', user: 'admin', action: 'Connexion', detail: 'Adresse IP : 192.168.1.45' },
              { date: '15/01/2026 14:35', user: 'commercial', action: 'Création', detail: 'Devis DEV-2026-0042 créé' },
              { date: '15/01/2026 15:00', user: 'magasinier', action: 'Modification', detail: 'Réception REC-2026-0012 validée' },
              { date: '15/01/2026 15:20', user: 'comptable', action: 'Création', detail: 'Paiement PAY-2026-0034 enregistré' },
            ].map((e, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">{e.date}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{e.user}</Badge></TableCell>
                <TableCell className="text-sm">{e.action}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{e.detail}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScreenMock>

      <TipBox type="info">
        Le journal d'audit est consultable par les rôles <strong>super_admin</strong> et <strong>admin</strong>. Il garantit une traçabilité totale des opérations.
      </TipBox>

      {/* Paramètres */}
      <SubTitle id="administration-parametres">Paramètres</SubTitle>
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
            { label: 'IF (Identifiant Fiscal)', value: '12345678' },
            { label: 'CNSS', value: '98765432' },
            { label: 'N° TVA', value: '11223344' },
            { label: 'RC (Registre Commerce)', value: '55667788' },
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

      <SubTitle>Logo de l'entreprise</SubTitle>
      <Paragraph>
        Vous pouvez télécharger le logo de votre entreprise qui apparaîtra sur tous les documents imprimés
        (devis, factures, bons de livraison, etc.).
      </Paragraph>

      <Step num={1}>Accédez à <strong>Administration → Paramètres → Logo</strong>.</Step>
      <Step num={2}>Cliquez sur <strong>« Télécharger un logo »</strong>.</Step>
      <Step num={3}>Sélectionnez un fichier image (PNG ou JPG).</Step>

      <TipBox type="warning">
        La taille maximale du logo est de <strong>500 Ko</strong>. Les formats acceptés sont PNG et JPG. Un logo trop grand sera rejeté.
      </TipBox>

      <SubTitle>Pied de page d'impression</SubTitle>
      <Paragraph>
        Configurez jusqu'à <strong>4 lignes de texte</strong> personnalisé qui apparaîtront en pied de page
        de tous les documents imprimés. Cela peut inclure des mentions légales, des coordonnées bancaires,
        ou toute autre information souhaitée.
      </Paragraph>

      <ScreenMock title="Configuration du pied de page d'impression">
        <div className="max-w-md space-y-3">
          {[
            { line: 'Ligne 1', value: 'Siège social : 123, Bd Zerktouni, Casablanca' },
            { line: 'Ligne 2', value: 'RIB : Attijariwafa 000 000 0000000000 00' },
            { line: 'Ligne 3', value: 'N° ICE : 009876543000012 — IF : 12345678 — RC : 55667788' },
            { line: 'Ligne 4', value: 'TVA non récupérable selon l\'article 92 du CGI' },
          ].map((l) => (
            <div key={l.line} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{l.line}</label>
              <div className="h-8 rounded border bg-muted/50 px-3 flex items-center text-sm">{l.value}</div>
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
                { param: 'Devise', value: 'MAD', desc: 'Dirham marocain' },
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

      <SubTitle id="administration-sauvegarde">Sauvegarde & Restauration</SubTitle>
      <Paragraph>
        Le système de sauvegarde intégré permet de protéger vos données à tout moment. Les sauvegardes
        sont automatiquement compressées et stockées dans la base de données. Vous pouvez également
        restaurer une sauvegarde antérieure ou importer un fichier de sauvegarde externe.
      </Paragraph>

      <Step num={1}>Accédez à <strong>Administration → Paramètres</strong> puis onglet <strong>« Sauvegarde »</strong>.</Step>
      <Step num={2}>Cliquez sur <strong>« Créer une sauvegarde »</strong> pour générer un instantané complet.</Step>
      <Step num={3}>Pour télécharger, cliquez sur l'icône de téléchargement à côté de la sauvegarde.</Step>
      <Step num={4}>Pour restaurer, utilisez le bouton <strong>« Restaurer depuis un fichier »</strong> et sélectionnez un fichier <code className="text-xs bg-muted px-1 py-0.5 rounded">.json.gz</code>.</Step>

      <TipBox type="warning">
        La restauration remplace toutes les données existantes. Le système conserve automatiquement les 7 dernières sauvegardes.
        Il est recommandé de télécharger régulièrement vos sauvegardes sur un support externe.
      </TipBox>
    </div>
  )
}

/* ─── Section content map ─── */
const sectionComponents: Record<string, () => JSX.Element> = {
  'introduction': IntroSection,
  'connexion': ConnexionSection,
  'tableau-de-bord': DashboardSection,
  'ventes': VentesSection,
  'achats': AchatsSection,
  'stock': StockSection,
  'production': ProductionSection,
  'finance': FinanceSection,
  'communication': CommunicationSection,
  'impression': ImpressionSection,
  'agenda': AgendaNotificationsSection,
  'administration': AdministrationSection,
}

/* ─── Main Guide View ─── */
export default function GuideView() {
  const [activeSection, setActiveSection] = useState('introduction')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['introduction']))
  const contentRef = useRef<HTMLDivElement>(null)
  const helpTarget = useNavStore((s) => s.helpTarget)
  const previousView = useNavStore((s) => s.previousView)
  const { setCurrentView, clearHelp } = useNavStore()

  // Handle helpTarget: navigate to the right section/sub on mount
  useEffect(() => {
    if (!helpTarget) return
    const { section, sub } = helpTarget
    const timer = setTimeout(() => {
      if (sub) {
        const el = document.getElementById(`${section}-${sub}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        const el = document.getElementById(`guide-${section}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [helpTarget])

  const scrollToSection = useCallback((id: string, forceExpand = true) => {
    setActiveSection(id)
    if (forceExpand) {
      setExpandedSections(prev => new Set(prev).add(id))
    }
    const el = document.getElementById(`guide-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const scrollToSub = useCallback((sectionId: string, subId: string) => {
    setActiveSection(sectionId)
    setExpandedSections(prev => new Set(prev).add(sectionId))
    const el = document.getElementById(`${sectionId}-${subId}`)
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
            const id = entry.target.id.replace('guide-', '')
            setActiveSection(id)
            // Auto-expand the section being viewed
            setExpandedSections(prev => new Set(prev).add(id))
          }
        })
      },
      { root: container, threshold: 0.1, rootMargin: '-40px 0px -60% 0px' }
    )

    // Observe both section headers and sub-items
    const ids: string[] = []
    sections.forEach((s) => {
      ids.push(`guide-${s.id}`)
      if (s.children) {
        s.children.forEach((sub) => ids.push(`${s.id}-${sub.id}`))
      }
    })
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <div className="flex flex-col lg:flex-row gap-6 -m-4 md:-m-6 p-4 md:p-6 min-h-full">
      {/* Sidebar Navigation */}
      <div className="lg:w-80 shrink-0">
        <div className="lg:sticky lg:top-4">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Guide d&apos;utilisation</CardTitle>
                  <CardDescription className="text-xs">GEMA ERP PRO v{APP_VERSION}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="p-2">
              <ScrollArea className="h-[calc(100vh-220px)]">
                <nav className="space-y-0.5 pb-4">
                  {sections.map((section) => {
                    const Icon = section.icon
                    const isActive = activeSection === section.id
                    const isExpanded = expandedSections.has(section.id)
                    const hasChildren = section.children && section.children.length > 0

                    return (
                      <div key={section.id}>
                        <button
                          onClick={() => {
                            if (hasChildren) {
                              const isExpanded = expandedSections.has(section.id)
                              if (!isExpanded) {
                                // If collapsed, expand AND scroll
                                setExpandedSections(prev => new Set(prev).add(section.id))
                                scrollToSection(section.id, true)
                              } else {
                                // If expanded, collapse (don't scroll)
                                setExpandedSections(prev => {
                                  const next = new Set(prev)
                                  next.delete(section.id)
                                  return next
                                })
                              }
                            } else {
                              // No children, just scroll
                              scrollToSection(section.id, true)
                            }
                          }}
                          className={cn(
                            'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors text-left group',
                            isActive && !isExpanded
                              ? 'bg-primary text-primary-foreground'
                              : isActive
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate flex-1">{section.label}</span>
                          {hasChildren && (
                            <ChevronDown className={cn(
                              'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
                              isExpanded ? 'rotate-180' : 'rotate-0'
                            )} />
                          )}
                        </button>
                        {hasChildren && isExpanded && (
                          <div className="ml-6 mt-0.5 space-y-0.5 border-l border-border/50 pl-2">
                            {section.children!.map((sub) => (
                              <button
                                key={sub.id}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  scrollToSub(section.id, sub.id)
                                }}
                                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs transition-colors text-left text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                              >
                                <ChevronRight className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate">{sub.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
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
                Version {APP_VERSION}
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
            {/* Back button when arriving from help */}
            {previousView && previousView !== 'guide' && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { clearHelp(); setCurrentView(previousView) }}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour
                </Button>
              </div>
            )}
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
            <p className="font-medium">GEMA ERP PRO v{APP_VERSION} — Guide d&apos;utilisation</p>
            <p className="mt-1">Développé avec passion au Maroc.</p>
            <p className="mt-1 text-xs">&copy; {new Date().getFullYear()} JAZEL WEB AGENCY SARL. Tous droits réservés.</p>
          </div>
        </div>
      </div>
    </div>
  )
}


