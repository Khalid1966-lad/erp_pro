import { z } from 'zod'

// ═══════════════════════════════════════════════════════════════
// GEMA ERP PRO - Validations Client (Maroc)
// ═══════════════════════════════════════════════════════════════

// ICE: Identifiant Commun de l'Entreprise — exactly 15 alphanumeric digits
const iceRegex = /^[A-Za-z0-9]{15}$/

// Moroccan phone: +212XXXXXXXXX or 06XXXXXXXX
const moroccanPhoneRegex = /^(\+212|0)[5-7]\d{8}$/

// Email validation
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export const clientCreateSchema = z.object({
  // 1. Identité légale
  raisonSociale: z.string().min(1, 'La raison sociale est requise'),
  nomCommercial: z.string().optional(),
  ice: z
    .string()
    .min(1, "L'ICE est requis")
    .regex(iceRegex, "L'ICE doit contenir exactement 15 caractères alphanumériques"),
  patente: z.string().optional(),
  cnss: z.string().optional(),
  identifiantFiscal: z.string().optional(),
  registreCommerce: z.string().optional(),
  villeRC: z.string().optional(),
  formeJuridique: z.enum(['SARL', 'SA', 'SNC', 'SARLAU', 'Autre']).default('SARL'),
  dateCreation: z.string().datetime().optional().nullable(),

  // 2. Coordonnées
  adresse: z.string().optional(),
  codePostal: z.string().optional(),
  ville: z.string().min(1, 'La ville est requise'),
  provincePrefecture: z.string().optional(),
  telephone: z
    .string()
    .optional()
    .refine((val) => !val || moroccanPhoneRegex.test(val), {
      message: 'Format téléphone invalide (ex: +212612345678)',
    }),
  gsm: z
    .string()
    .optional()
    .refine((val) => !val || moroccanPhoneRegex.test(val), {
      message: 'Format GSM invalide (ex: +212612345678)',
    }),
  email: z
    .string()
    .min(1, "L'email est requis")
    .regex(emailRegex, "Format d'email invalide"),
  emailSecondaire: z
    .string()
    .optional()
    .refine((val) => !val || emailRegex.test(val), {
      message: 'Format email secondaire invalide',
    }),
  siteWeb: z.string().optional(),
  langueCommunication: z
    .enum(['francais', 'arabe', 'anglais'])
    .default('francais'),

  // 3. Paramètres commerciaux
  conditionsPaiement: z.string().default('30 jours'),
  modeReglementPrefere: z
    .enum(['virement', 'cheque', 'effet', 'especes'])
    .default('virement'),
  escompte: z.number().min(0).max(100).default(0),
  remisePermanente: z.number().min(0).max(100).default(0),
  baremePrix: z.string().optional(),
  seuilCredit: z.number().min(0).default(0),
  delaiLivraison: z.number().int().min(0).optional().nullable(),
  transporteurPrefere: z.string().optional(),
  incoterm: z
    .enum(['EXW', 'FCA', 'DAP', 'autre'])
    .optional()
    .nullable(),

  // 4. Paramètres fiscaux & comptables
  tauxTva: z
    .enum(['taux_20', 'taux_10', 'taux_7', 'taux_0', 'exonere', 'autoliquidation'])
    .default('taux_20'),
  codeComptableClient: z.string().default('3421'),
  modeFacturation: z
    .enum(['electronique', 'papier'])
    .default('electronique'),
  emailFacturation: z
    .string()
    .optional()
    .refine((val) => !val || emailRegex.test(val), {
      message: 'Format email de facturation invalide',
    }),
  regimeFiscal: z
    .enum(['IS', 'IR', 'reel_simplifie', 'reel_normal'])
    .default('IS'),

  // 5. Suivi commercial (read-only — set by system, not user)
  datePremierAchat: z.string().datetime().optional().nullable(),
  dateDernierAchat: z.string().datetime().optional().nullable(),
  caTotalHT: z.number().min(0).default(0),
  nbCommandes: z.number().int().min(0).default(0),
  panierMoyen: z.number().min(0).default(0),
  tauxRetour: z.number().min(0).max(100).default(0),
  dernierDevisDate: z.string().datetime().optional().nullable(),
  dernierDevisMontant: z.number().min(0).optional().nullable(),
  dernierDevisStatut: z.string().optional(),
  derniereFactureDate: z.string().datetime().optional().nullable(),
  derniereFactureMontant: z.number().min(0).optional().nullable(),
  statutPaiement: z
    .enum(['paye', 'impaye', 'partiel'])
    .optional()
    .nullable(),

  // 6. Statut et relation client
  statut: z
    .enum(['actif', 'inactif', 'prospect', 'client_risque', 'client_privilegie'])
    .default('prospect'),
  categorie: z
    .enum(['grand_compte', 'PME', 'particulier', 'revendeur', 'export'])
    .default('PME'),
  priorite: z.number().int().min(1).max(5).default(3),
  origineProspect: z.string().optional(),
  commentairesInternes: z.string().optional(),

  // 7. Relances et litiges
  nbImpayes: z.number().int().min(0).default(0),
  delaiMoyenPaiement: z.number().int().min(0).default(0),
  alerteImpaye: z.boolean().default(false),
  contentieuxNom: z.string().optional(),
  contentieuxEmail: z
    .string()
    .optional()
    .refine((val) => !val || emailRegex.test(val), {
      message: 'Format email contentieux invalide',
    }),
  contentieuxTelephone: z.string().optional(),
  derniereRelanceDate: z.string().datetime().optional().nullable(),
  derniereRelanceType: z.string().optional(),

  // 8. Spécificités production
  certificationsRequises: z.string().optional(),
  referencesInternes: z.string().optional(),
  specsTechniquesUrl: z.string().optional(),
  packagingInstructions: z.string().optional(),
  planningLivraisonRecurrent: z.string().optional(),
  seuilLotMinimal: z.number().int().min(0).optional().nullable(),
  frequenceReporting: z.string().optional(),

  // Legacy fields (backward compatibility)
  name: z.string().optional(),
  siret: z.string().optional(),
  country: z.string().default('Maroc'),
  creditLimit: z.number().min(0).default(0),
  paymentTerms: z.string().default('30 jours'),
  notes: z.string().optional(),
  balance: z.number().default(0),
})

// For updates — all fields optional except ICE must stay valid
export const clientUpdateSchema = z.object({
  raisonSociale: z.string().min(1).optional(),
  nomCommercial: z.string().optional(),
  ice: z
    .string()
    .regex(iceRegex, "L'ICE doit contenir exactement 15 caractères alphanumériques")
    .optional(),
  patente: z.string().optional(),
  cnss: z.string().optional(),
  identifiantFiscal: z.string().optional(),
  registreCommerce: z.string().optional(),
  villeRC: z.string().optional(),
  formeJuridique: z.enum(['SARL', 'SA', 'SNC', 'SARLAU', 'Autre']).optional(),
  dateCreation: z.string().datetime().optional().nullable(),

  adresse: z.string().optional(),
  codePostal: z.string().optional(),
  ville: z.string().optional(),
  provincePrefecture: z.string().optional(),
  telephone: z
    .string()
    .refine((val) => !val || moroccanPhoneRegex.test(val), {
      message: 'Format téléphone invalide',
    })
    .optional(),
  gsm: z
    .string()
    .refine((val) => !val || moroccanPhoneRegex.test(val), {
      message: 'Format GSM invalide',
    })
    .optional(),
  email: z
    .string()
    .regex(emailRegex, "Format d'email invalide")
    .optional(),
  emailSecondaire: z
    .string()
    .refine((val) => !val || emailRegex.test(val), {
      message: 'Format email secondaire invalide',
    })
    .optional(),
  siteWeb: z.string().optional(),
  langueCommunication: z
    .enum(['francais', 'arabe', 'anglais'])
    .optional(),

  conditionsPaiement: z.string().optional(),
  modeReglementPrefere: z
    .enum(['virement', 'cheque', 'effet', 'especes'])
    .optional(),
  escompte: z.number().min(0).max(100).optional(),
  remisePermanente: z.number().min(0).max(100).optional(),
  baremePrix: z.string().optional(),
  seuilCredit: z.number().min(0).optional(),
  delaiLivraison: z.number().int().min(0).optional().nullable(),
  transporteurPrefere: z.string().optional(),
  incoterm: z.enum(['EXW', 'FCA', 'DAP', 'autre']).optional().nullable(),

  tauxTva: z
    .enum(['taux_20', 'taux_10', 'taux_7', 'taux_0', 'exonere', 'autoliquidation'])
    .optional(),
  codeComptableClient: z.string().optional(),
  modeFacturation: z.enum(['electronique', 'papier']).optional(),
  emailFacturation: z
    .string()
    .refine((val) => !val || emailRegex.test(val), {
      message: 'Format email de facturation invalide',
    })
    .optional(),
  regimeFiscal: z
    .enum(['IS', 'IR', 'reel_simplifie', 'reel_normal'])
    .optional(),

  caTotalHT: z.number().min(0).optional(),
  nbCommandes: z.number().int().min(0).optional(),
  panierMoyen: z.number().min(0).optional(),
  tauxRetour: z.number().min(0).max(100).optional(),
  dernierDevisDate: z.string().datetime().optional().nullable(),
  dernierDevisMontant: z.number().min(0).optional().nullable(),
  dernierDevisStatut: z.string().optional(),
  derniereFactureDate: z.string().datetime().optional().nullable(),
  derniereFactureMontant: z.number().min(0).optional().nullable(),
  statutPaiement: z
    .enum(['paye', 'impaye', 'partiel'])
    .optional()
    .nullable(),

  statut: z
    .enum(['actif', 'inactif', 'prospect', 'client_risque', 'client_privilegie'])
    .optional(),
  categorie: z
    .enum(['grand_compte', 'PME', 'particulier', 'revendeur', 'export'])
    .optional(),
  priorite: z.number().int().min(1).max(5).optional(),
  origineProspect: z.string().optional(),
  commentairesInternes: z.string().optional(),

  nbImpayes: z.number().int().min(0).optional(),
  delaiMoyenPaiement: z.number().int().min(0).optional(),
  alerteImpaye: z.boolean().optional(),
  contentieuxNom: z.string().optional(),
  contentieuxEmail: z
    .string()
    .refine((val) => !val || emailRegex.test(val), {
      message: 'Format email contentieux invalide',
    })
    .optional(),
  contentieuxTelephone: z.string().optional(),
  derniereRelanceDate: z.string().datetime().optional().nullable(),
  derniereRelanceType: z.string().optional(),

  certificationsRequises: z.string().optional(),
  referencesInternes: z.string().optional(),
  specsTechniquesUrl: z.string().optional(),
  packagingInstructions: z.string().optional(),
  planningLivraisonRecurrent: z.string().optional(),
  seuilLotMinimal: z.number().int().min(0).optional().nullable(),
  frequenceReporting: z.string().optional(),

  // Legacy fields
  name: z.string().optional(),
  siret: z.string().optional(),
  country: z.string().optional(),
  creditLimit: z.number().min(0).optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
  balance: z.number().optional(),
})

export const clientContactSchema = z.object({
  type: z
    .enum(['principal', 'commercial', 'comptable', 'technique', 'expedition'])
    .default('principal'),
  nom: z.string().min(1, 'Le nom est requis'),
  prenom: z.string().min(1, 'Le prénom est requis'),
  fonction: z.string().optional(),
  telephoneDirect: z.string().optional(),
  email: z
    .string()
    .optional()
    .refine((val) => !val || emailRegex.test(val), {
      message: 'Format email invalide',
    }),
  notes: z.string().optional(),
})

export const clientContactUpdateSchema = clientContactSchema.partial().omit({
  // At least one field must remain
}).extend({
  nom: z.string().min(1, 'Le nom est requis').optional(),
  prenom: z.string().min(1, 'Le prénom est requis').optional(),
})

export const clientDocumentSchema = z.object({
  nomFichier: z.string().min(1, 'Le nom du fichier est requis'),
  url: z.string().optional(),
  type: z.string().optional(),
  taille: z.number().int().min(0).optional(),
})

// ═══════════════════════════════════════════════════════════════
// Form schema (extends create schema with contacts array)
// ═══════════════════════════════════════════════════════════════
export const clientFormSchema = clientCreateSchema.extend({
  contacts: z.array(clientContactSchema).default([]),
})

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════
export type ClientFormData = z.infer<typeof clientFormSchema>
export type ContactFormData = z.infer<typeof clientContactSchema>

// ═══════════════════════════════════════════════════════════════
// Default form values
// ═══════════════════════════════════════════════════════════════
export const defaultClientFormValues: ClientFormData = {
  raisonSociale: '',
  nomCommercial: '',
  ice: '',
  patente: '',
  cnss: '',
  identifiantFiscal: '',
  registreCommerce: '',
  villeRC: '',
  formeJuridique: 'SARL',
  dateCreation: null,

  adresse: '',
  codePostal: '',
  ville: '',
  provincePrefecture: '',
  telephone: '',
  gsm: '',
  email: '',
  emailSecondaire: '',
  siteWeb: '',
  langueCommunication: 'francais',

  conditionsPaiement: '30 jours',
  modeReglementPrefere: 'virement',
  escompte: 0,
  remisePermanente: 0,
  baremePrix: '',
  seuilCredit: 0,
  delaiLivraison: null,
  transporteurPrefere: '',
  incoterm: null,

  tauxTva: 'taux_20',
  codeComptableClient: '3421',
  modeFacturation: 'electronique',
  emailFacturation: '',
  regimeFiscal: 'IS',

  datePremierAchat: null,
  dateDernierAchat: null,
  caTotalHT: 0,
  nbCommandes: 0,
  panierMoyen: 0,
  tauxRetour: 0,
  dernierDevisDate: null,
  dernierDevisMontant: null,
  dernierDevisStatut: '',
  derniereFactureDate: null,
  derniereFactureMontant: null,
  statutPaiement: null,

  statut: 'prospect',
  categorie: 'PME',
  priorite: 3,
  origineProspect: '',
  commentairesInternes: '',

  nbImpayes: 0,
  delaiMoyenPaiement: 0,
  alerteImpaye: false,
  contentieuxNom: '',
  contentieuxEmail: '',
  contentieuxTelephone: '',
  derniereRelanceDate: null,
  derniereRelanceType: '',

  certificationsRequises: '',
  referencesInternes: '',
  specsTechniquesUrl: '',
  packagingInstructions: '',
  planningLivraisonRecurrent: '',
  seuilLotMinimal: null,
  frequenceReporting: '',

  // Legacy fields
  name: '',
  siret: '',
  country: 'Maroc',
  creditLimit: 0,
  paymentTerms: '30 jours',
  notes: '',
  balance: 0,

  contacts: [],
}

// ═══════════════════════════════════════════════════════════════
// Select option lists for forms
// ═══════════════════════════════════════════════════════════════
export const clientStatusOptions = [
  { value: 'actif', label: 'Actif', color: 'bg-green-100 text-green-800' },
  { value: 'inactif', label: 'Inactif', color: 'bg-gray-100 text-gray-700' },
  { value: 'prospect', label: 'Prospect', color: 'bg-blue-100 text-blue-800' },
  { value: 'client_risque', label: 'À risque', color: 'bg-red-100 text-red-800' },
  { value: 'client_privilegie', label: 'Privilégié', color: 'bg-purple-100 text-purple-800' },
]

export const categorieOptions = [
  { value: 'grand_compte', label: 'Grand compte' },
  { value: 'PME', label: 'PME' },
  { value: 'particulier', label: 'Particulier' },
  { value: 'revendeur', label: 'Revendeur' },
  { value: 'export', label: 'Export' },
]

export const formeJuridiqueOptions = [
  { value: 'SARL', label: 'SARL' },
  { value: 'SA', label: 'SA' },
  { value: 'SNC', label: 'SNC' },
  { value: 'SARLAU', label: 'SARLAU' },
  { value: 'Autre', label: 'Autre' },
]

export const langueOptions = [
  { value: 'francais', label: 'Français' },
  { value: 'arabe', label: 'Arabe' },
  { value: 'anglais', label: 'Anglais' },
]

export const contactTypeOptions = [
  { value: 'principal', label: 'Principal' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'comptable', label: 'Comptable' },
  { value: 'technique', label: 'Technique' },
  { value: 'expedition', label: 'Expédition' },
]

export const modeReglementOptions = [
  { value: 'virement', label: 'Virement bancaire' },
  { value: 'cheque', label: 'Chèque' },
  { value: 'effet', label: 'Effet de commerce' },
  { value: 'especes', label: 'Espèces' },
]

export const conditionsPaiementOptions = [
  { value: 'comptant', label: 'Comptant' },
  { value: '15 jours', label: '15 jours' },
  { value: '30 jours', label: '30 jours' },
  { value: '45 jours', label: '45 jours' },
  { value: '60 jours', label: '60 jours' },
  { value: '90 jours', label: '90 jours' },
  { value: 'fin_de_mois', label: 'Fin de mois' },
  { value: '30 jours_fin_de_mois', label: '30 jours fin de mois' },
  { value: '60 jours_fin_de_mois', label: '60 jours fin de mois' },
]

export const incotermOptions = [
  { value: 'EXW', label: 'EXW — Départ usine' },
  { value: 'FCA', label: 'FCA — Porteur charge' },
  { value: 'DAP', label: 'DAP — Rendu lieu' },
  { value: 'autre', label: 'Autre' },
]

export const tauxTVAOptions = [
  { value: 'taux_20', label: 'TVA 20%' },
  { value: 'taux_14', label: 'TVA 14%' },
  { value: 'taux_10', label: 'TVA 10%' },
  { value: 'taux_7', label: 'TVA 7%' },
  { value: 'taux_0', label: 'TVA 0%' },
  { value: 'exonere', label: 'Exonéré' },
  { value: 'autoliquidation', label: 'Autoliquidation' },
]

export const modeFacturationOptions = [
  { value: 'electronique', label: 'Électronique' },
  { value: 'papier', label: 'Papier' },
]

export const regimeFiscalOptions = [
  { value: 'IS', label: 'Impôt sur les Sociétés (IS)' },
  { value: 'IR', label: 'Impôt sur le Revenu (IR)' },
  { value: 'reel_simplifie', label: 'Régime réel simplifié' },
  { value: 'reel_normal', label: 'Régime réel normal' },
]

export const relanceTypeOptions = [
  { value: 'courrier', label: 'Courrier' },
  { value: 'email', label: 'Email' },
  { value: 'telephone', label: 'Téléphone' },
  { value: 'mise_en_demeure', label: 'Mise en demeure' },
  { value: 'contentieux', label: 'Contentieux' },
]

export const frequenceReportingOptions = [
  { value: 'hebdomadaire', label: 'Hebdomadaire' },
  { value: 'mensuel', label: 'Mensuel' },
  { value: 'trimestriel', label: 'Trimestriel' },
  { value: 'semestriel', label: 'Semestriel' },
  { value: 'annuel', label: 'Annuel' },
]

export const origineProspectOptions = [
  { value: 'site_web', label: 'Site web' },
  { value: 'referral', label: 'Parrainage' },
  { value: 'salon', label: 'Salon / Foire' },
  { value: ' Linkedin', label: 'LinkedIn' },
  { value: 'telephone', label: 'Appel entrant' },
  { value: 'visite', label: 'Visite commerciale' },
  { value: 'publicite', label: 'Publicité' },
  { value: 'autre', label: 'Autre' },
]
