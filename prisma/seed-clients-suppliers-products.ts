/**
 * Optimized seed script: Clients, Suppliers, Products & ClientContacts
 *
 * Uses Prisma createMany for bulk inserts (fast) instead of individual creates.
 * Deletes existing data in FK order before inserting.
 *
 * Usage:
 *   npx ts-node prisma/seed-clients-suppliers-products.ts
 *   # or
 *   npx tsx prisma/seed-clients-suppliers-products.ts
 */

import { PrismaClient } from "@prisma/client";

// ─── Database connection ──────────────────────────────────────────────────────
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_VjZ3u1cQOotx@ep-round-unit-aj8b7o9b-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const prisma = new PrismaClient({
  datasources: {
    db: { url: DATABASE_URL },
  },
});

// ─── Deterministic random helper (seeded-like via Math) ───────────────────────
function rnd(min: number, max: number, decimals = 0): number {
  const val = Math.random() * (max - min) + min;
  return decimals > 0 ? parseFloat(val.toFixed(decimals)) : Math.floor(val);
}

// ─── ICE generator (sequential counter → unique) ──────────────────────────────
let iceCounter = 100000;
function genICE(): string {
  iceCounter++;
  return `00${String(iceCounter).padStart(6, "0")}000${String(rnd(1, 999)).padStart(3, "0")}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA DEFINITIONS — extracted verbatim from seed.ts
// ═══════════════════════════════════════════════════════════════════════════════

// ─── PRODUCTS: Matières Premières ──────────────────────────────────────────────
const matieresPremieres = [
  { reference: "MP-001", designation: "Profilé coulissant série 6000", description: "Profilé aluminium coulissant série 6000 pour fenêtres et baies coulissantes", famille: "Profilés Aluminium", sousFamille: "Coulissant", priceHT: 45, unit: "ml", currentStock: 500, minStock: 100, maxStock: 2000, averageCost: 38 },
  { reference: "MP-002", designation: "Profilé fixe série 6000", description: "Profilé aluminium fixe série 6000 pour ouvrants dormants", famille: "Profilés Aluminium", sousFamille: "Fixe", priceHT: 38, unit: "ml", currentStock: 400, minStock: 80, maxStock: 1500, averageCost: 32 },
  { reference: "MP-003", designation: "Profilé oscillo-battant série 7000", description: "Profilé aluminium oscillo-battant série 7000", famille: "Profilés Aluminium", sousFamille: "Oscillo-battant", priceHT: 52, unit: "ml", currentStock: 350, minStock: 80, maxStock: 1500, averageCost: 44 },
  { reference: "MP-004", designation: "Profilé dormant série 6000", description: "Profilé dormant aluminium série 6000 pour fenêtres coulissantes", famille: "Profilés Aluminium", sousFamille: "Dormant", priceHT: 42, unit: "ml", currentStock: 300, minStock: 60, maxStock: 1200, averageCost: 36 },
  { reference: "MP-005", designation: "Profilé battant série 7000", description: "Profilé battant aluminium série 7000 pour portes et fenêtres", famille: "Profilés Aluminium", sousFamille: "Battant", priceHT: 48, unit: "ml", currentStock: 250, minStock: 50, maxStock: 1000, averageCost: 40 },
  { reference: "MP-006", designation: "Profilé traverse basse aluminium", description: "Traverse basse aluminium pour fenêtres coulissantes", famille: "Profilés Aluminium", sousFamille: "Accessoires aluminium", priceHT: 35, unit: "ml", currentStock: 200, minStock: 40, maxStock: 800, averageCost: 30 },
  { reference: "MP-007", designation: "Profilé traverse haute aluminium", description: "Traverse haute aluminium pour fenêtres", famille: "Profilés Aluminium", sousFamille: "Accessoires aluminium", priceHT: 35, unit: "ml", currentStock: 180, minStock: 40, maxStock: 800, averageCost: 30 },
  { reference: "MP-008", designation: "Meneau aluminium", description: "Meneau central aluminium pour baies vitrées", famille: "Profilés Aluminium", sousFamille: "Accessoires aluminium", priceHT: 55, unit: "ml", currentStock: 150, minStock: 30, maxStock: 600, averageCost: 48 },
  { reference: "MP-009", designation: "Seuil aluminium", description: "Seuil aluminium pour portes et baies vitrées", famille: "Profilés Aluminium", sousFamille: "Seuils", priceHT: 65, unit: "ml", currentStock: 200, minStock: 40, maxStock: 800, averageCost: 55 },
  { reference: "MP-010", designation: "Profilé PVC 3 chambres", description: "Profilé PVC 3 chambres standard pour fenêtres économiques", famille: "Profilés PVC", sousFamille: "Standard", priceHT: 28, unit: "ml", currentStock: 600, minStock: 150, maxStock: 2500, averageCost: 24 },
  { reference: "MP-011", designation: "Profilé PVC 5 chambres", description: "Profilé PVC 5 chambres pour fenêtres isolation renforcée", famille: "Profilés PVC", sousFamille: "Renforcé", priceHT: 38, unit: "ml", currentStock: 500, minStock: 100, maxStock: 2000, averageCost: 33 },
  { reference: "MP-012", designation: "Profilé PVC 7 chambres", description: "Profilé PVC 7 chambres haute performance thermique", famille: "Profilés PVC", sousFamille: "Premium", priceHT: 48, unit: "ml", currentStock: 300, minStock: 80, maxStock: 1500, averageCost: 42 },
  { reference: "MP-013", designation: "Renfort acier PVC 3 chambres", description: "Renfort acier galvanisé pour profilé PVC 3 chambres", famille: "Profilés PVC", sousFamille: "Renforts", priceHT: 18, unit: "ml", currentStock: 400, minStock: 100, maxStock: 1500, averageCost: 15 },
  { reference: "MP-014", designation: "Double vitrage 4/16/4", description: "Double vitrage 4mm-air16mm-4mm standard clair", famille: "Vitres", sousFamille: "Double vitrage", priceHT: 185, unit: "m²", currentStock: 200, minStock: 50, maxStock: 500, averageCost: 160 },
  { reference: "MP-015", designation: "Double vitrage 4/12/4", description: "Double vitrage 4mm-air12mm-4mm compact", famille: "Vitres", sousFamille: "Double vitrage", priceHT: 165, unit: "m²", currentStock: 150, minStock: 40, maxStock: 400, averageCost: 142 },
  { reference: "MP-016", designation: "Triple vitrage 4/12/4/12/4", description: "Triple vitrage haute isolation 4/12/4/12/4", famille: "Vitres", sousFamille: "Triple vitrage", priceHT: 248, unit: "m²", currentStock: 80, minStock: 20, maxStock: 200, averageCost: 215 },
  { reference: "MP-017", designation: "Vitre teintée grise 4/16/4", description: "Double vitrage teinté gris pour protection solaire", famille: "Vitres", sousFamille: "Vitre teintée", priceHT: 210, unit: "m²", currentStock: 60, minStock: 20, maxStock: 200, averageCost: 185 },
  { reference: "MP-018", designation: "Vitre teintée bronze 4/16/4", description: "Double vitrage teinté bronze pour protection solaire", famille: "Vitres", sousFamille: "Vitre teintée", priceHT: 215, unit: "m²", currentStock: 50, minStock: 15, maxStock: 150, averageCost: 190 },
  { reference: "MP-019", designation: "Vitrage acoustique 4/16/4", description: "Double vitrage acoustique pour isolation phonique", famille: "Vitres", sousFamille: "Acoustique", priceHT: 235, unit: "m²", currentStock: 40, minStock: 15, maxStock: 150, averageCost: 205 },
  { reference: "MP-020", designation: "Vitrage feuilleté sécurité 44.2", description: "Double vitrage feuilleté de sécurité 4+4.2mm", famille: "Vitres", sousFamille: "Sécurité", priceHT: 250, unit: "m²", currentStock: 30, minStock: 10, maxStock: 100, averageCost: 220 },
  { reference: "MP-021", designation: "Poignée aluminium HOPPE", description: "Poignée aluminium type HOPPE pour fenêtres et portes", famille: "Quincaillerie", sousFamille: "Poignées", priceHT: 45, unit: "unité", currentStock: 300, minStock: 50, maxStock: 800, averageCost: 38 },
  { reference: "MP-022", designation: "Poignée PVC", description: "Poignée PVC pour fenêtres PVC", famille: "Quincaillerie", sousFamille: "Poignées", priceHT: 32, unit: "unité", currentStock: 250, minStock: 50, maxStock: 600, averageCost: 28 },
  { reference: "MP-023", designation: "Crémone ROTO", description: "Crémone ROTO pour fenêtres oscillo-battantes", famille: "Quincaillerie", sousFamille: "Crémones", priceHT: 75, unit: "unité", currentStock: 200, minStock: 40, maxStock: 500, averageCost: 65 },
  { reference: "MP-024", designation: "Paumelle SIEGENIA", description: "Paumelle SIEGENIA pour portes battantes aluminium", famille: "Quincaillerie", sousFamille: "Paumelles", priceHT: 85, unit: "unité", currentStock: 150, minStock: 30, maxStock: 400, averageCost: 72 },
  { reference: "MP-025", designation: "Ferrure oscillo-battant MACO", description: "Ferrure oscillo-battante MACO complète pour fenêtre", famille: "Quincaillerie", sousFamille: "Ferrures", priceHT: 145, unit: "lot", currentStock: 80, minStock: 20, maxStock: 200, averageCost: 125 },
  { reference: "MP-026", designation: "Galet coulissant", description: "Galet coulissant pour fenêtre aluminium coulissante", famille: "Quincaillerie", sousFamille: "Galets", priceHT: 25, unit: "unité", currentStock: 400, minStock: 80, maxStock: 1000, averageCost: 22 },
  { reference: "MP-027", designation: "Verrou multipoint", description: "Verrou multipoint pour porte d'entrée", famille: "Quincaillerie", sousFamille: "Serrures", priceHT: 220, unit: "unité", currentStock: 60, minStock: 15, maxStock: 150, averageCost: 190 },
  { reference: "MP-028", designation: "Serrure encastrée", description: "Serrure encastrée pour porte d'entrée aluminium", famille: "Quincaillerie", sousFamille: "Serrures", priceHT: 180, unit: "unité", currentStock: 50, minStock: 10, maxStock: 120, averageCost: 155 },
  { reference: "MP-029", designation: "Charnière invisible", description: "Charnière invisible pour portes aluminium premium", famille: "Quincaillerie", sousFamille: "Charnières", priceHT: 65, unit: "unité", currentStock: 120, minStock: 30, maxStock: 300, averageCost: 55 },
  { reference: "MP-030", designation: "Joint EPDM 6mm", description: "Joint EPDM 6mm pour étanchéité fenêtres aluminium", famille: "Joints & Étanchéité", sousFamille: "EPDM", priceHT: 5, unit: "ml", currentStock: 2000, minStock: 500, maxStock: 5000, averageCost: 4 },
  { reference: "MP-031", designation: "Joint EPDM 10mm", description: "Joint EPDM 10mm pour étanchéité portes et baies", famille: "Joints & Étanchéité", sousFamille: "EPDM", priceHT: 8, unit: "ml", currentStock: 1500, minStock: 400, maxStock: 4000, averageCost: 7 },
  { reference: "MP-032", designation: "Mousse PU expansif", description: "Mousse polyuréthane expansif pour calfeutrage et isolation", famille: "Joints & Étanchéité", sousFamille: "Mousses", priceHT: 35, unit: "cartouche", currentStock: 200, minStock: 50, maxStock: 400, averageCost: 30 },
  { reference: "MP-033", designation: "Silicone neutre cartouche", description: "Silicone neutre cartouche 300ml pour jointure extérieure", famille: "Joints & Étanchéité", sousFamille: "Silicone", priceHT: 28, unit: "cartouche", currentStock: 150, minStock: 40, maxStock: 300, averageCost: 24 },
  { reference: "MP-034", designation: "Vis A2 inox lot 100", description: "Lot de 100 vis inox A2 pour assemblage menuiserie", famille: "Accessoires", sousFamille: "Visserie", priceHT: 22, unit: "lot", currentStock: 500, minStock: 100, maxStock: 2000, averageCost: 18 },
  { reference: "MP-035", designation: "Cheville nylon lot 50", description: "Lot de 50 chevilles nylon pour fixation murale", famille: "Accessoires", sousFamille: "Fixation", priceHT: 15, unit: "lot", currentStock: 400, minStock: 100, maxStock: 1500, averageCost: 12 },
];

// ─── PRODUCTS: Semi-Finis ─────────────────────────────────────────────────────
const semiFinis = [
  { reference: "SF-001", designation: "Cadre aluminium coupé-collé 120x120", description: "Cadre aluminium assemblé par système coupé-collé pour fenêtre 120x120", famille: "Semi-finis Aluminium", sousFamille: "Cadres", priceHT: 380, unit: "unité", currentStock: 30, minStock: 10, maxStock: 80, averageCost: 310 },
  { reference: "SF-002", designation: "Cadre aluminium coupé-collé 150x120", description: "Cadre aluminium assemblé pour fenêtre 150x120", famille: "Semi-finis Aluminium", sousFamille: "Cadres", priceHT: 420, unit: "unité", currentStock: 25, minStock: 8, maxStock: 60, averageCost: 345 },
  { reference: "SF-003", designation: "Cadre aluminium coupé-collé 200x120", description: "Cadre aluminium assemblé pour baie vitrée 200x120", famille: "Semi-finis Aluminium", sousFamille: "Cadres", priceHT: 500, unit: "unité", currentStock: 15, minStock: 5, maxStock: 40, averageCost: 410 },
  { reference: "SF-004", designation: "Dormant aluminium assemblé 120x120", description: "Dormant aluminium assemblé pour fenêtre coulissante 120x120", famille: "Semi-finis Aluminium", sousFamille: "Dormants", priceHT: 350, unit: "unité", currentStock: 25, minStock: 8, maxStock: 60, averageCost: 290 },
  { reference: "SF-005", designation: "Dormant aluminium assemblé 200x120", description: "Dormant aluminium assemblé pour baie coulissante 200x120", famille: "Semi-finis Aluminium", sousFamille: "Dormants", priceHT: 480, unit: "unité", currentStock: 10, minStock: 5, maxStock: 30, averageCost: 395 },
  { reference: "SF-006", designation: "Cadre PVC soudé 120x120", description: "Cadre PVC soudé par thermosoudure pour fenêtre 120x120", famille: "Semi-finis PVC", sousFamille: "Cadres", priceHT: 320, unit: "unité", currentStock: 35, minStock: 10, maxStock: 80, averageCost: 265 },
  { reference: "SF-007", designation: "Cadre PVC soudé 150x120", description: "Cadre PVC soudé pour fenêtre 150x120", famille: "Semi-finis PVC", sousFamille: "Cadres", priceHT: 355, unit: "unité", currentStock: 20, minStock: 8, maxStock: 60, averageCost: 292 },
  { reference: "SF-008", designation: "Dormant PVC soudé 120x120", description: "Dormant PVC soudé pour fenêtre coulissante PVC", famille: "Semi-finis PVC", sousFamille: "Dormants", priceHT: 300, unit: "unité", currentStock: 30, minStock: 10, maxStock: 70, averageCost: 248 },
  { reference: "SF-009", designation: "Vitrage monté sur cadre alu 120x120", description: "Double vitrage monté et calé sur cadre aluminium 120x120", famille: "Semi-finis Vitrage", sousFamille: "Alu vitré", priceHT: 580, unit: "unité", currentStock: 20, minStock: 5, maxStock: 50, averageCost: 480 },
  { reference: "SF-010", designation: "Vitrage monté sur cadre PVC 120x120", description: "Double vitrage monté sur cadre PVC 120x120", famille: "Semi-finis Vitrage", sousFamille: "PVC vitré", priceHT: 520, unit: "unité", currentStock: 18, minStock: 5, maxStock: 45, averageCost: 430 },
  { reference: "SF-011", designation: "Volet roulant alvéolaire assemblé 120x120", description: "Volet roulant alvéolaire pré-assemblé dimension 120x120", famille: "Semi-finis Volets", sousFamille: "Alvéolaire", priceHT: 650, unit: "unité", currentStock: 15, minStock: 5, maxStock: 40, averageCost: 535 },
  { reference: "SF-012", designation: "Volet roulant alvéolaire assemblé 150x120", description: "Volet roulant alvéolaire pré-assemblé dimension 150x120", famille: "Semi-finis Volets", sousFamille: "Alvéolaire", priceHT: 720, unit: "unité", currentStock: 10, minStock: 3, maxStock: 30, averageCost: 590 },
  { reference: "SF-013", designation: "Store vénitien assemblé 120x120", description: "Store vénitien aluminium assemblé complet", famille: "Semi-finis Stores", sousFamille: "Vénitien", priceHT: 380, unit: "unité", currentStock: 20, minStock: 5, maxStock: 50, averageCost: 310 },
  { reference: "SF-014", designation: "Porte blindée assemblée 100x210", description: "Porte blindée assemblée dimensions 100x210cm", famille: "Semi-finis Portes", sousFamille: "Blindée", priceHT: 780, unit: "unité", currentStock: 8, minStock: 3, maxStock: 20, averageCost: 640 },
  { reference: "SF-015", designation: "Porte sectionnelle assemblée 250x250", description: "Porte de garage sectionnelle assemblée 250x250cm", famille: "Semi-finis Portes", sousFamille: "Sectionnelle", priceHT: 680, unit: "unité", currentStock: 5, minStock: 2, maxStock: 15, averageCost: 560 },
];

// ─── PRODUCTS: Produits Finis ──────────────────────────────────────────────────
const produitsFinis = [
  { reference: "PF-001", designation: "Fenêtre alu coulissante 120x120", description: "Fenêtre aluminium coulissante 2 vantaux 120x120cm, double vitrage", famille: "Fenêtres Aluminium", sousFamille: "Coulissante", priceHT: 1850, currentStock: 15, minStock: 5, maxStock: 40, averageCost: 1280 },
  { reference: "PF-002", designation: "Fenêtre alu coulissante 150x120", description: "Fenêtre aluminium coulissante 2 vantaux 150x120cm, double vitrage", famille: "Fenêtres Aluminium", sousFamille: "Coulissante", priceHT: 2150, currentStock: 12, minStock: 4, maxStock: 30, averageCost: 1490 },
  { reference: "PF-003", designation: "Fenêtre alu coulissante 200x120", description: "Fenêtre aluminium coulissante 2 vantaux 200x120cm, double vitrage", famille: "Fenêtres Aluminium", sousFamille: "Coulissante", priceHT: 2650, currentStock: 8, minStock: 3, maxStock: 25, averageCost: 1840 },
  { reference: "PF-004", designation: "Fenêtre alu coulissante 240x120", description: "Fenêtre aluminium coulissante 3 vantaux 240x120cm, double vitrage", famille: "Fenêtres Aluminium", sousFamille: "Coulissante", priceHT: 3100, currentStock: 5, minStock: 2, maxStock: 15, averageCost: 2150 },
  { reference: "PF-005", designation: "Fenêtre alu coulissante 300x120", description: "Fenêtre aluminium coulissante 4 vantaux 300x120cm, double vitrage", famille: "Fenêtres Aluminium", sousFamille: "Coulissante", priceHT: 3750, currentStock: 4, minStock: 2, maxStock: 12, averageCost: 2600 },
  { reference: "PF-006", designation: "Fenêtre alu oscillo-battante 120x120", description: "Fenêtre aluminium oscillo-battante 120x120cm, ferrure MACO", famille: "Fenêtres Aluminium", sousFamille: "Oscillo-battante", priceHT: 1650, currentStock: 18, minStock: 5, maxStock: 45, averageCost: 1140 },
  { reference: "PF-007", designation: "Fenêtre alu oscillo-battante 100x140", description: "Fenêtre aluminium oscillo-battante 100x140cm", famille: "Fenêtres Aluminium", sousFamille: "Oscillo-battante", priceHT: 1580, currentStock: 15, minStock: 5, maxStock: 40, averageCost: 1095 },
  { reference: "PF-008", designation: "Fenêtre alu oscillo-battante 80x120", description: "Fenêtre aluminium oscillo-battante 80x120cm", famille: "Fenêtres Aluminium", sousFamille: "Oscillo-battante", priceHT: 1280, currentStock: 20, minStock: 6, maxStock: 50, averageCost: 885 },
  { reference: "PF-009", designation: "Fenêtre alu fixe 120x120", description: "Fenêtre aluminium fixe 120x120cm pour panoramique", famille: "Fenêtres Aluminium", sousFamille: "Fixe", priceHT: 980, currentStock: 10, minStock: 3, maxStock: 25, averageCost: 680 },
  { reference: "PF-010", designation: "Fenêtre alu fixe 200x150", description: "Fenêtre aluminium fixe 200x150cm grande surface vitrée", famille: "Fenêtres Aluminium", sousFamille: "Fixe", priceHT: 1650, currentStock: 6, minStock: 2, maxStock: 15, averageCost: 1140 },
  { reference: "PF-011", designation: "Fenêtre PVC coulissante 120x120", description: "Fenêtre PVC coulissante 2 vantaux 120x120cm, profilé 5 chambres", famille: "Fenêtres PVC", sousFamille: "Coulissante", priceHT: 1450, currentStock: 20, minStock: 6, maxStock: 50, averageCost: 1000 },
  { reference: "PF-012", designation: "Fenêtre PVC coulissante 150x120", description: "Fenêtre PVC coulissante 2 vantaux 150x120cm", famille: "Fenêtres PVC", sousFamille: "Coulissante", priceHT: 1720, currentStock: 15, minStock: 5, maxStock: 40, averageCost: 1190 },
  { reference: "PF-013", designation: "Fenêtre PVC coulissante 200x120", description: "Fenêtre PVC coulissante 2 vantaux 200x120cm", famille: "Fenêtres PVC", sousFamille: "Coulissante", priceHT: 2100, currentStock: 8, minStock: 3, maxStock: 25, averageCost: 1450 },
  { reference: "PF-014", designation: "Fenêtre PVC oscillo-battante 120x120", description: "Fenêtre PVC oscillo-battante 120x120cm, ferrure MACO", famille: "Fenêtres PVC", sousFamille: "Oscillo-battante", priceHT: 1380, currentStock: 22, minStock: 6, maxStock: 55, averageCost: 955 },
  { reference: "PF-015", designation: "Fenêtre PVC oscillo-battante 100x140", description: "Fenêtre PVC oscillo-battante 100x140cm", famille: "Fenêtres PVC", sousFamille: "Oscillo-battante", priceHT: 1320, currentStock: 18, minStock: 5, maxStock: 45, averageCost: 915 },
  { reference: "PF-016", designation: "Fenêtre PVC fixe 120x120", description: "Fenêtre PVC fixe 120x120cm", famille: "Fenêtres PVC", sousFamille: "Fixe", priceHT: 820, currentStock: 12, minStock: 4, maxStock: 30, averageCost: 565 },
  { reference: "PF-017", designation: "Porte d'entrée aluminium 90x210", description: "Porte d'entrée aluminium à 1 vantail 90x210cm avec vitrage supérieur", famille: "Portes Aluminium", sousFamille: "Entrée", priceHT: 3200, currentStock: 10, minStock: 3, maxStock: 25, averageCost: 2215 },
  { reference: "PF-018", designation: "Porte d'entrée aluminium 100x210", description: "Porte d'entrée aluminium 100x210cm, verrou multipoint", famille: "Portes Aluminium", sousFamille: "Entrée", priceHT: 3500, currentStock: 8, minStock: 3, maxStock: 20, averageCost: 2420 },
  { reference: "PF-019", designation: "Porte d'entrée aluminium 120x210 double", description: "Porte d'entrée aluminium double vantail 120x210cm", famille: "Portes Aluminium", sousFamille: "Entrée", priceHT: 5200, currentStock: 4, minStock: 2, maxStock: 12, averageCost: 3600 },
  { reference: "PF-020", designation: "Porte d'entrée PVC 90x210", description: "Porte d'entrée PVC 90x210cm, profilé 7 chambres", famille: "Portes PVC", sousFamille: "Entrée", priceHT: 2800, currentStock: 12, minStock: 4, maxStock: 30, averageCost: 1940 },
  { reference: "PF-021", designation: "Porte d'entrée PVC 100x210", description: "Porte d'entrée PVC 100x210cm avec décor", famille: "Portes PVC", sousFamille: "Entrée", priceHT: 3050, currentStock: 8, minStock: 3, maxStock: 20, averageCost: 2110 },
  { reference: "PF-022", designation: "Porte d'entrée blindée 100x210", description: "Porte d'entrée blindée acier 100x210cm acier haute sécurité", famille: "Portes Blindées", sousFamille: "Standard", priceHT: 6800, currentStock: 5, minStock: 2, maxStock: 15, averageCost: 4700 },
  { reference: "PF-023", designation: "Porte d'entrée blindée 90x210", description: "Porte d'entrée blindée 90x210cm", famille: "Portes Blindées", sousFamille: "Standard", priceHT: 6200, currentStock: 6, minStock: 2, maxStock: 15, averageCost: 4290 },
  { reference: "PF-024", designation: "Porte d'entrée blindée luxe 100x210", description: "Porte blindée luxe avec décor bois, serrure multipoint", famille: "Portes Blindées", sousFamille: "Luxe", priceHT: 9500, currentStock: 3, minStock: 1, maxStock: 10, averageCost: 6575 },
  { reference: "PF-025", designation: "Porte de service aluminium 80x200", description: "Porte de service aluminium 80x200cm pour cuisine, buanderie", famille: "Portes Aluminium", sousFamille: "Service", priceHT: 1580, currentStock: 15, minStock: 5, maxStock: 40, averageCost: 1090 },
  { reference: "PF-026", designation: "Porte de service PVC 80x200", description: "Porte de service PVC 80x200cm", famille: "Portes PVC", sousFamille: "Service", priceHT: 1250, currentStock: 18, minStock: 5, maxStock: 45, averageCost: 865 },
  { reference: "PF-027", designation: "Porte de garage sectionnelle 250x220", description: "Porte de garage sectionnelle 250x220cm motorisée", famille: "Portes de Garage", sousFamille: "Sectionnelle", priceHT: 8500, currentStock: 3, minStock: 1, maxStock: 8, averageCost: 5880 },
  { reference: "PF-028", designation: "Porte de garage sectionnelle 300x250", description: "Porte de garage sectionnelle 300x250cm motorisée", famille: "Portes de Garage", sousFamille: "Sectionnelle", priceHT: 10500, currentStock: 2, minStock: 1, maxStock: 6, averageCost: 7265 },
  { reference: "PF-029", designation: "Porte de garage basculante 250x220", description: "Porte de garage basculante 250x220cm", famille: "Portes de Garage", sousFamille: "Basculante", priceHT: 5500, currentStock: 4, minStock: 1, maxStock: 10, averageCost: 3805 },
  { reference: "PF-030", designation: "Volet roulant alvéolaire 120x120", description: "Volet roulant alvéolaire motorisé 120x120cm", famille: "Volets Roulants", sousFamille: "Alvéolaire", priceHT: 2200, currentStock: 10, minStock: 3, maxStock: 25, averageCost: 1520 },
  { reference: "PF-031", designation: "Volet roulant alvéolaire 150x140", description: "Volet roulant alvéolaire motorisé 150x140cm", famille: "Volets Roulants", sousFamille: "Alvéolaire", priceHT: 2650, currentStock: 8, minStock: 3, maxStock: 20, averageCost: 1830 },
  { reference: "PF-032", designation: "Volet roulant alvéolaire 200x150", description: "Volet roulant alvéolaire motorisé 200x150cm", famille: "Volets Roulants", sousFamille: "Alvéolaire", priceHT: 3200, currentStock: 5, minStock: 2, maxStock: 15, averageCost: 2210 },
  { reference: "PF-033", designation: "Volet roulant PVC 120x120", description: "Volet roulant PVC motorisé 120x120cm économique", famille: "Volets Roulants", sousFamille: "PVC", priceHT: 1750, currentStock: 12, minStock: 4, maxStock: 30, averageCost: 1210 },
  { reference: "PF-034", designation: "Volet roulant PVC 150x140", description: "Volet roulant PVC motorisé 150x140cm", famille: "Volets Roulants", sousFamille: "PVC", priceHT: 2100, currentStock: 8, minStock: 3, maxStock: 20, averageCost: 1450 },
  { reference: "PF-035", designation: "Store vénitien aluminium 120x120", description: "Store vénitien aluminium 120x120cm, lames 50mm", famille: "Stores", sousFamille: "Vénitien", priceHT: 650, currentStock: 20, minStock: 5, maxStock: 50, averageCost: 450 },
  { reference: "PF-036", designation: "Store vénitien aluminium 150x120", description: "Store vénitien aluminium 150x120cm, lames 50mm", famille: "Stores", sousFamille: "Vénitien", priceHT: 780, currentStock: 15, minStock: 4, maxStock: 35, averageCost: 540 },
  { reference: "PF-037", designation: "Store banne 300x200", description: "Store banne motorisé 300x200cm, toile acrylique", famille: "Stores", sousFamille: "Banne", priceHT: 4500, currentStock: 4, minStock: 1, maxStock: 10, averageCost: 3110 },
  { reference: "PF-038", designation: "Store banne 400x250", description: "Store banne motorisé 400x250cm, toile acrylique premium", famille: "Stores", sousFamille: "Banne", priceHT: 5800, currentStock: 3, minStock: 1, maxStock: 8, averageCost: 4010 },
  { reference: "PF-039", designation: "Véranda aluminium 400x300", description: "Véranda aluminium modèle classique 400x300cm, toit vitré", famille: "Vérandas", sousFamille: "Classique", priceHT: 14500, currentStock: 2, minStock: 1, maxStock: 5, averageCost: 10025 },
  { reference: "PF-040", designation: "Véranda aluminium 500x350", description: "Véranda aluminium victorienne 500x350cm", famille: "Vérandas", sousFamille: "Victorienne", priceHT: 18500, currentStock: 1, minStock: 1, maxStock: 3, averageCost: 12800 },
  { reference: "PF-041", designation: "Véranda PVC 400x300", description: "Véranda PVC 400x300cm isolation thermique renforcée", famille: "Vérandas", sousFamille: "PVC", priceHT: 12800, currentStock: 2, minStock: 1, maxStock: 5, averageCost: 8850 },
  { reference: "PF-042", designation: "Façade rideau aluminium 300x350", description: "Façade rideau aluminium 300x350cm avec vitrage", famille: "Façades", sousFamille: "Rideau", priceHT: 12000, currentStock: 2, minStock: 1, maxStock: 5, averageCost: 8300 },
  { reference: "PF-043", designation: "Mur rideau verre 400x350", description: "Mur rideau en verre 400x350cm", famille: "Façades", sousFamille: "Mur rideau", priceHT: 15000, currentStock: 1, minStock: 1, maxStock: 3, averageCost: 10375 },
  { reference: "PF-044", designation: "Baie vitrée coulissante 240x240", description: "Baie vitrée coulissante aluminium 3 vantaux 240x240cm", famille: "Baies Vitrées", sousFamille: "Coulissante", priceHT: 4500, currentStock: 3, minStock: 1, maxStock: 8, averageCost: 3110 },
  { reference: "PF-045", designation: "Baie vitrée oscillo-battante 240x220", description: "Baie vitrée oscillo-battante aluminium 240x220cm", famille: "Baies Vitrées", sousFamille: "Oscillo-battante", priceHT: 4800, currentStock: 3, minStock: 1, maxStock: 8, averageCost: 3320 },
  { reference: "PF-046", designation: "Cloison amovible vitrée 300x250", description: "Cloison amovible vitrée aluminium 300x250cm", famille: "Cloisons", sousFamille: "Amovible vitrée", priceHT: 6800, currentStock: 2, minStock: 1, maxStock: 5, averageCost: 4700 },
  { reference: "PF-047", designation: "Cloison amovible vitrée 400x250", description: "Cloison amovible vitrée aluminium 400x250cm", famille: "Cloisons", sousFamille: "Amovible vitrée", priceHT: 8500, currentStock: 2, minStock: 1, maxStock: 4, averageCost: 5880 },
  { reference: "PF-048", designation: "Cabine de douche aluminium 90x200", description: "Cabine de douche aluminium avec porte coulissante 90x200cm", famille: "Salles de bain", sousFamille: "Cabine douche", priceHT: 3800, currentStock: 5, minStock: 2, maxStock: 12, averageCost: 2630 },
  { reference: "PF-049", designation: "Cabine de douche aluminium 120x200", description: "Cabine de douche aluminium walk-in 120x200cm", famille: "Salles de bain", sousFamille: "Cabine douche", priceHT: 4800, currentStock: 3, minStock: 1, maxStock: 8, averageCost: 3320 },
  { reference: "PF-050", designation: "Grille de ventilation aluminium 60x60", description: "Grille de ventilation aluminium 60x60cm pour façade", famille: "Ventilation", sousFamille: "Grilles", priceHT: 450, unit: "unité", currentStock: 25, minStock: 8, maxStock: 60, averageCost: 310 },
];

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────
const suppliersData = [
  { code: "FOU-001", name: "ALUMECO Maroc SA", siret: "IF00123456789", address: "Zone Industrielle, Lot 45", city: "Casablanca", postalCode: "20153", country: "Maroc", phone: "0522-35-40-40", email: "contact@alumeco.ma", deliveryDelay: 7, paymentTerms: "30 jours", notes: "Principal fournisseur profilés aluminium série 6000 et 7000. Accord cadre annuel.", balance: 45000, creditLimit: 200000, rating: 4.8 },
  { code: "FOU-002", name: "Profilal Maroc SARL", siret: "IF00234567890", address: "Km 12, Route de Rabat", city: "Tanger", postalCode: "90000", country: "Maroc", phone: "0539-32-11-22", email: "commercial@profilal.ma", deliveryDelay: 5, paymentTerms: "15 jours", notes: "Profilés aluminium spéciaux, livraison express depuis Tanger.", balance: 28000, creditLimit: 150000, rating: 4.5 },
  { code: "FOU-003", name: "Tecna Maroc SARL", siret: "IF00345678901", address: "Zone Franche Tanger Automotive City", city: "Tanger", postalCode: "90000", country: "Maroc", phone: "0539-39-55-66", email: "ventes@tecna.ma", deliveryDelay: 10, paymentTerms: "30 jours", notes: "Profilés aluminium haute qualité, export vers Europe aussi.", balance: 15000, creditLimit: 120000, rating: 4.3 },
  { code: "FOU-004", name: "PALFRAMES Industries", siret: "IF00456789012", address: "Bourgogne, Lot 12", city: "Casablanca", postalCode: "20600", country: "Maroc", phone: "0522-28-33-44", email: "info@palframes.ma", deliveryDelay: 7, paymentTerms: "30 jours", notes: "Profilés PVC Rehau et profilés aluminium. Gamme complète.", balance: 52000, creditLimit: 180000, rating: 4.6 },
  { code: "FOU-005", name: "Complex Maroc SARL", siret: "IF00567890123", address: "Sidi Bernoussi, Zone B", city: "Casablanca", postalCode: "20200", country: "Maroc", phone: "0522-64-77-88", email: "contact@complex.ma", deliveryDelay: 7, paymentTerms: "30 jours", notes: "Fournisseur historique profilés PVC. Qualité fiable.", balance: 38000, creditLimit: 150000, rating: 4.2 },
  { code: "FOU-006", name: "PlasticSystem Maroc", siret: "IF00678901234", address: "Ain Sebaa", city: "Casablanca", postalCode: "20250", country: "Maroc", phone: "0522-44-55-66", email: "ventes@plasticsystem.ma", deliveryDelay: 5, paymentTerms: "30 jours", notes: "Profilés PVC 5 et 7 chambres, renforts acier.", balance: 22000, creditLimit: 100000, rating: 4.1 },
  { code: "FOU-007", name: "Saint-Gobain Glass Maroc", siret: "IF00789012345", address: "Route d'El Jadida, Km 15", city: "Casablanca", postalCode: "20100", country: "Maroc", phone: "0522-54-32-10", email: "commercial@glassmorocco.saint-gobain.com", deliveryDelay: 10, paymentTerms: "30 jours fin de mois", notes: "Leader mondial du verre. Gamme complète double/triple vitrage.", balance: 85000, creditLimit: 300000, rating: 4.9 },
  { code: "FOU-008", name: "AGC Glass Europe - Filiale Maroc", siret: "IF00890123456", address: "Technopolis, Route Bouskoura", city: "Casablanca", postalCode: "20153", country: "Maroc", phone: "0522-78-90-12", email: "orders@agc-maroc.ma", deliveryDelay: 12, paymentTerms: "45 jours", notes: "Vitrage teinté, feuilleté, acoustique. Commandes sur stock Maroc.", balance: 35000, creditLimit: 200000, rating: 4.5 },
  { code: "FOU-009", name: "Vitro Maroc SA", siret: "IF00901234567", address: "Zone Industrielle Nouacer", city: "Nouaceur", postalCode: "20153", country: "Maroc", phone: "0522-33-44-55", email: "contact@vitro-maroc.ma", deliveryDelay: 8, paymentTerms: "30 jours", notes: "Transformateur de verre local. Coupes sur mesure disponibles.", balance: 18000, creditLimit: 80000, rating: 4.0 },
  { code: "FOU-010", name: "HOPPE Maroc SARL", siret: "IF01012345678", address: "Ain Harrouda", city: "Mohammedia", postalCode: "20600", country: "Maroc", phone: "0523-32-44-55", email: "ventes@hoppe.ma", deliveryDelay: 14, paymentTerms: "30 jours", notes: "Importateur exclusif poignées HOPPE Allemagne. Qualité premium.", balance: 12000, creditLimit: 60000, rating: 4.7 },
  { code: "FOU-011", name: "ROTO Frank Maroc", siret: "IF01123456789", address: "Sidi Maarouf", city: "Casablanca", postalCode: "20153", country: "Maroc", phone: "0522-85-66-77", email: "contact@roto-frank.ma", deliveryDelay: 14, paymentTerms: "30 jours", notes: "Crémones et ferrures oscillo-battantes. Qualité allemande.", balance: 15000, creditLimit: 75000, rating: 4.8 },
  { code: "FOU-012", name: "MACO Maroc Distribution", siret: "IF01234567890", address: "Zone Industrielle, Rue 5", city: "Tanger", postalCode: "90000", country: "Maroc", phone: "0539-37-88-99", email: "info@maco-maroc.ma", deliveryDelay: 10, paymentTerms: "30 jours", notes: "Ferrures oscillo-battantes MACO Autriche. Stock Tanger.", balance: 20000, creditLimit: 90000, rating: 4.6 },
  { code: "FOU-013", name: "SIEGENIA Maroc", siret: "IF01345678901", address: "Bourgogne, Bloc C", city: "Casablanca", postalCode: "20600", country: "Maroc", phone: "0522-78-22-33", email: "commercial@siegenia.ma", deliveryDelay: 14, paymentTerms: "30 jours", notes: "Paumelles, ferrures et systèmes multipoints SIEGENIA.", balance: 18000, creditLimit: 85000, rating: 4.5 },
  { code: "FOU-014", name: "Quincaillerie Menuiserie Maroc", siret: "IF01456789012", address: "Derb Sultan", city: "Casablanca", postalCode: "20100", country: "Maroc", phone: "0522-26-33-44", email: "contact@qm-maroc.ma", deliveryDelay: 3, paymentTerms: "especes", notes: "Galets, visserie, accessoires divers. Livraison rapide Casablanca.", balance: 5000, creditLimit: 25000, rating: 3.8 },
  { code: "FOU-015", name: "ETANCHEX SARL", siret: "IF01567890123", address: "Zone Industrielle, Lot 8", city: "Kénitra", postalCode: "14000", country: "Maroc", phone: "0537-35-22-11", email: "ventes@etanchex.ma", deliveryDelay: 5, paymentTerms: "30 jours", notes: "Joints EPDM, silicone, mousse PU, bandes bitumeuses.", balance: 8000, creditLimit: 40000, rating: 4.0 },
  { code: "FOU-016", name: "Jointex Maroc", siret: "IF01678901234", address: "Moulay Rachid", city: "Bouskoura", postalCode: "20153", country: "Maroc", phone: "0522-38-55-66", email: "contact@jointex.ma", deliveryDelay: 5, paymentTerms: "30 jours", notes: "Joints et produits d'étanchéité pour menuiserie.", balance: 6500, creditLimit: 35000, rating: 3.9 },
  { code: "FOU-017", name: "Visserie Industrielle Maroc", siret: "IF01789012345", address: "Ain Sebaa, Rue 20", city: "Casablanca", postalCode: "20250", country: "Maroc", phone: "0522-47-88-99", email: "commandes@vim.ma", deliveryDelay: 3, paymentTerms: "15 jours", notes: "Vis inox A2, chevilles, boulonnerie pour menuiserie.", balance: 3500, creditLimit: 20000, rating: 4.1 },
  { code: "FOU-018", name: "FixPro SARL", siret: "IF01890123456", address: "Sidi Bernoussi", city: "Casablanca", postalCode: "20200", country: "Maroc", phone: "0522-65-11-22", email: "ventes@fixpro.ma", deliveryDelay: 3, paymentTerms: "especes", notes: "Chevilles, tiges filetées, fixations mécaniques. Catalogue large.", balance: 2000, creditLimit: 15000, rating: 3.7 },
  { code: "FOU-019", name: "Somfy Maroc SAS", siret: "IF01901234567", address: "Les Berges du Lac", city: "Casablanca", postalCode: "20153", country: "Maroc", phone: "0522-89-00-11", email: "b2b@somfy.ma", deliveryDelay: 10, paymentTerms: "30 jours", notes: "Motorisations volets roulants, stores, portes de garage.", balance: 25000, creditLimit: 100000, rating: 4.7 },
  { code: "FOU-020", name: "Robinetterie Menuiserie SARL", siret: "IF02012345678", address: "Route des Zehra", city: "Rabat", postalCode: "10000", country: "Maroc", phone: "0537-68-44-55", email: "contact@rm-maroc.ma", deliveryDelay: 7, paymentTerms: "30 jours", notes: "Serrures encastrées, verrous multipoints, cylindres.", balance: 12000, creditLimit: 50000, rating: 4.2 },
  { code: "FOU-021", name: "Bricorame Distribution", siret: "IF02123456789", address: "Hay Riad", city: "Rabat", postalCode: "10100", country: "Maroc", phone: "0537-75-66-77", email: "ventes@bricorame.ma", deliveryDelay: 5, paymentTerms: "15 jours", notes: "Quincaillerie de portail et accessoires portes de garage.", balance: 8000, creditLimit: 35000, rating: 3.9 },
  { code: "FOU-022", name: "Motorisation Services Maroc", siret: "IF02234567890", address: "Bouskoura, Lot 3", city: "Casablanca", postalCode: "20153", country: "Maroc", phone: "0522-36-77-88", email: "commandes@ms-maroc.ma", deliveryDelay: 7, paymentTerms: "30 jours", notes: "Moteurs volets roulants, télécommandes, automatismes.", balance: 10000, creditLimit: 45000, rating: 4.0 },
  { code: "FOU-023", name: "Aluconcept España", siret: "ES-A12345678", address: "Pol. Ind. El Saler, Nave 12", city: "Valencia", postalCode: "46012", country: "Espagne", phone: "+34-96-123-4567", email: "export@aluconcept.es", deliveryDelay: 21, paymentTerms: "60 jours", notes: "Profilés aluminium design espagnol. Importation maritime.", balance: 65000, creditLimit: 250000, rating: 4.4 },
  { code: "FOU-024", name: "Veka GmbH - Agence Maroc", siret: "DE-V12345678", address: "Bourgogne, Résidence Atlas", city: "Casablanca", postalCode: "20600", country: "Maroc", phone: "0522-28-99-00", email: "morocco@veka.de", deliveryDelay: 14, paymentTerms: "30 jours", notes: "Profilés PVC Veka Allemagne. Réseau mondial. Import via Casablanca.", balance: 40000, creditLimit: 180000, rating: 4.8 },
  { code: "FOU-025", name: "Schüco International Maroc", siret: "DE-S12345678", address: "Technopolis, Bât. 7", city: "Casablanca", postalCode: "20153", country: "Maroc", phone: "0522-75-33-44", email: "morocco@schueco.com", deliveryDelay: 21, paymentTerms: "45 jours", notes: "Systèmes aluminium premium pour façades et vérandas.", balance: 55000, creditLimit: 200000, rating: 4.6 },
  { code: "FOU-026", name: "Glassolutions Saint-Gobain", siret: "FR-G12345678", address: "Rue de l'Industrie, BP 45", city: "Roubaix", postalCode: "59100", country: "France", phone: "+33-3-20-12-34-56", email: "export@glassolutions.fr", deliveryDelay: 28, paymentTerms: "60 jours", notes: "Vitrage feuilleté, acoustique spécial. Commande spéciale.", balance: 30000, creditLimit: 150000, rating: 4.3 },
  { code: "FOU-027", name: "Tecsed Maroc SARL", siret: "IF02734567890", address: "Sidi Maarouf, Lot 6", city: "Casablanca", postalCode: "20153", country: "Maroc", phone: "0522-82-33-44", email: "contact@tecsed.ma", deliveryDelay: 7, paymentTerms: "30 jours", notes: "Scies, outils de coupe et d'assemblage pour menuiserie.", balance: 5000, creditLimit: 25000, rating: 4.0 },
  { code: "FOU-028", name: "LamineX Maroc", siret: "IF02845678901", address: "Ain Harrouda", city: "Mohammedia", postalCode: "20600", country: "Maroc", phone: "0523-31-22-33", email: "ventes@laminex.ma", deliveryDelay: 10, paymentTerms: "30 jours", notes: "Lames de store, toiles acryliques pour stores banne.", balance: 7000, creditLimit: 30000, rating: 3.8 },
  { code: "FOU-029", name: "MetalBain SARL", siret: "IF02956789012", address: "Zone Industrielle Oulfa", city: "Casablanca", postalCode: "20153", country: "Maroc", phone: "0522-42-11-22", email: "info@metalbain.ma", deliveryDelay: 7, paymentTerms: "30 jours", notes: "Profilés et accessoires pour cabines de douche et salles de bain.", balance: 6000, creditLimit: 30000, rating: 3.7 },
  { code: "FOU-030", name: "PackagingPro Maroc", siret: "IF03067890123", address: "Zone Industrielle Had Soualem", city: "Had Soualem", postalCode: "26000", country: "Maroc", phone: "0523-45-66-77", email: "contact@packagingpro.ma", deliveryDelay: 5, paymentTerms: "15 jours", notes: "Films de protection, cartons, calages pour emballage menuiserie.", balance: 3000, creditLimit: 15000, rating: 3.6 },
];

// ─── CLIENTS ──────────────────────────────────────────────────────────────────

// City distributions by region
const villesCasablanca = ["Casablanca", "Mohammedia", "El Jadida", "Bouskoura", "Nouaceur", "Berrechid", "Settat"];
const villesRabat = ["Rabat", "Salé", "Témara", "Kénitra", "Skhirat"];
const villesMarrakech = ["Marrakech", "Safi", "El Kelaa des Sraghna", "Essaouira"];
const villesTanger = ["Tanger", "Tétouan", "Al Hoceima", "Ksar el Kébir", "Larache"];
const villesFes = ["Fès", "Meknès", "Ifrane", "Taza", "El Hajeb"];
const villesBeniMellal = ["Béni Mellal", "Khénifra", "Azilal", "Fqih Bensalah"];
const villesDraa = ["Errachidia", "Ouarzazate", "Zagora", "Midelt"];
const villesSouss = ["Agadir", "Inezgane", "Aït Melloul", "Taroudant", "Tiznit", "Biarritz"];
const villesGuelmim = ["Guelmim", "Tan-Tan", "Assa", "Zag"];
const villesOriental = ["Oujda", "Nador", "Jerada", "Berkane"];
const villesLaayoune = ["Laâyoune", "Boujdour", "Smara", "Es-Semara"];
const villesDakhla = ["Dakhla", "Aousserd", "Lagouira"];

// Build client from parameters (deterministic-ish, same as seed.ts)
function makeClient(
  idx: number,
  code: string,
  raisonSociale: string,
  nomCommercial: string,
  ville: string,
  provincePrefecture: string,
  categorie: "grand_compte" | "PME" | "particulier" | "revendeur" | "export",
  statut: "actif" | "inactif" | "prospect" | "client_risque" | "client_privilegie",
  formeJuridique: "SARL" | "SA" | "SNC" | "SARLAU" | "Autre",
  regimeFiscal: "IS" | "IR" | "reel_simplifie" | "reel_normal",
  modeReglement: "virement" | "cheque" | "effet" | "especes",
  origine: string,
  country: string = "Maroc",
  incotermVal: "EXW" | "FCA" | "DAP" | "autre" | null = null
) {
  const isActif = statut === "actif" || statut === "client_privilegie";
  const isProspect = statut === "prospect";
  const isExport = categorie === "export";
  const ice = genICE();
  const patente = `${rnd(1000000, 9999999)}`;
  const cnss = `${rnd(10000000, 99999999)}`;
  const rc = `RC-${rnd(100000, 999999)}`;
  const cp = isExport ? String(rnd(10000, 99999)) : `${String(rnd(10000, 30000))}`;

  const emailDomain = isExport ? ["gmail.com", "outlook.com", "yahoo.fr"][rnd(0, 2)] : "gmail.com";
  const emailClean = nomCommercial.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15);
  const email = `${emailClean}@${emailDomain}`;

  const gsmPrefix = country === "Maroc" ? "06" : "+33";
  const gsm = `${gsmPrefix}${String(rnd(10000000, 99999999))}`;
  const telephone = `05${String(rnd(20000000, 99999999))}`;

  const condPaiement = isProspect ? "30 jours" : ["30 jours", "45 jours", "60 jours", "comptant"][rnd(0, 3)];

  const transporteurs = ["Transport Adrar", "Logistica.ma", "CTM Cargo", "AJT Express", "AMJ Express", "TNT Express Maroc"];
  const transporteur = transporteurs[rnd(0, transporteurs.length - 1)];

  const streetNames = ["Bd Mohammed V", "Rue Ibn Batouta", "Avenue Hassan II", "Rue Allal Ben Abdellah", "Bd Zerktouni", "Rue Atlas", "Avenue des FAR", "Bd Anfa", "Rue de Fes", "Lotissement"];
  const streetNames2 = ["Bd Mohammed V", "Rue Ibn Batouta", "Avenue Hassan II", "Rue Allal Ben Abdellah", "Bd Zerktouni"];

  return {
    code,
    name: nomCommercial,
    siret: ice,
    address: `${rnd(1, 200)}, ${streetNames[rnd(0, 9)]}`,
    city: ville,
    postalCode: cp,
    phone: telephone,
    country,
    creditLimit: categorie === "grand_compte" ? rnd(200000, 500000) : categorie === "export" ? rnd(100000, 300000) : categorie === "revendeur" ? rnd(50000, 150000) : rnd(10000, 50000),
    paymentTerms: condPaiement,
    balance: isProspect ? 0 : rnd(0, 35000),
    notes: `Client ${statut} du secteur ${provincePrefecture}. Activité menuiserie et bâtiment.`,
    // Identité légale
    raisonSociale,
    nomCommercial,
    ice,
    patente,
    cnss,
    identifiantFiscal: `IF${rnd(10000000, 99999999)}`,
    registreCommerce: rc,
    villeRC: ville,
    formeJuridique,
    dateCreation: new Date(`${rnd(2005, 2023)}-${String(rnd(1, 12)).padStart(2, "0")}-${String(rnd(1, 28)).padStart(2, "0")}T00:00:00.000Z`),
    // Coordonnées
    adresse: `${rnd(1, 200)}, ${streetNames2[rnd(0, 4)]}`,
    codePostal: cp,
    ville,
    provincePrefecture,
    telephone,
    gsm,
    email,
    emailSecondaire: `${emailClean}2@${emailDomain}`,
    siteWeb: `www.${nomCommercial.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12)}.ma`,
    langueCommunication: "francais" as const,
    // Paramètres commerciaux
    conditionsPaiement: condPaiement,
    modeReglementPrefere: modeReglement,
    escompte: categorie === "grand_compte" ? rnd(1, 3) : categorie === "revendeur" ? rnd(2, 5) : 0,
    remisePermanente: categorie === "grand_compte" ? rnd(3, 8) : categorie === "revendeur" ? rnd(5, 12) : 0,
    baremePrix: categorie === "revendeur" ? "Grossiste" : categorie === "grand_compte" ? "Particulier" : null,
    seuilCredit: rnd(20000, 100000),
    delaiLivraison: rnd(3, 14),
    transporteurPrefere: transporteur,
    incoterm: incotermVal,
    // Paramètres fiscaux
    tauxTva: "taux_20" as const,
    codeComptableClient: "3421",
    modeFacturation: "electronique" as const,
    emailFacturation: email,
    regimeFiscal,
    // Suivi commercial
    datePremierAchat: isProspect ? null : new Date(`${rnd(2020, 2024)}-${String(rnd(1, 12)).padStart(2, "0")}-${String(rnd(1, 28)).padStart(2, "0")}T00:00:00.000Z`),
    dateDernierAchat: isActif ? new Date(`${rnd(2024, 2025)}-${String(rnd(1, 6)).padStart(2, "0")}-${String(rnd(1, 28)).padStart(2, "0")}T00:00:00.000Z`) : null,
    caTotalHT: isProspect ? 0 : rnd(50000, 2500000),
    nbCommandes: isProspect ? 0 : rnd(5, 150),
    panierMoyen: isProspect ? 0 : rnd(3000, 45000),
    tauxRetour: rnd(0, 5),
    dernierDevisDate: new Date(`2025-01-${String(rnd(1, 14)).padStart(2, "0")}T00:00:00.000Z`),
    dernierDevisMontant: isProspect ? 0 : rnd(5000, 150000),
    dernierDevisStatut: isProspect ? "draft" : ["accepte", "envoye", "en_attente"][rnd(0, 2)],
    derniereFactureDate: isActif ? new Date(`2024-${String(rnd(6, 12)).padStart(2, "0")}-${String(rnd(1, 28)).padStart(2, "0")}T00:00:00.000Z`) : null,
    derniereFactureMontant: isActif ? rnd(15000, 250000) : 0,
    statutPaiement: isActif ? (rnd(0, 10) > 2 ? "paye" as const : "partiel" as const) : null,
    // Statut
    typeSociete: categorie === "particulier" ? "PARTICULIER" : categorie === "revendeur" ? "REVENDEUR" : "SOCIETE",
    statut,
    categorie,
    priorite: categorie === "grand_compte" ? rnd(1, 2) : rnd(2, 5),
    origineProspect: origine,
    commentairesInternes: null,
    // Relances
    nbImpayes: statut === "client_risque" ? rnd(2, 5) : rnd(0, 1),
    delaiMoyenPaiement: isActif ? rnd(15, 60) : 0,
    alerteImpaye: statut === "client_risque",
    // Production
    certificationsRequises: isExport ? "ISO 9001, CE" : null,
    seuilLotMinimal: categorie === "grand_compte" ? rnd(10, 50) : null,
    frequenceReporting: categorie === "grand_compte" ? "mensuel" : null,
  };
}

// Build the full clients array (100 clients)
const clientsData: ReturnType<typeof makeClient>[] = [];

// GRANDS COMPTES (15)
clientsData.push(makeClient(1, "CL-0001", "CGI Bâtiment Maroc SA", "CGI Bâtiment", villesCasablanca[0], "Casablanca-Settat", "grand_compte", "client_privilegie", "SA", "IS", "virement", "salon", "Maroc", null));
clientsData.push(makeClient(2, "CL-0002", "Alliances Développement SA", "Alliances Dév.", villesCasablanca[0], "Casablanca-Settat", "grand_compte", "actif", "SA", "IS", "virement", "prospection", "Maroc", null));
clientsData.push(makeClient(3, "CL-0003", "Résidences Atlas SARL", "Résidences Atlas", villesCasablanca[1], "Casablanca-Settat", "grand_compte", "actif", "SARL", "IS", "cheque", "référence", "Maroc", null));
clientsData.push(makeClient(4, "CL-0004", "Société Marocaine de Promotion Immobilière SA", "SMPI", villesRabat[0], "Rabat-Salé-Kénitra", "grand_compte", "actif", "SA", "IS", "virement", "publicité", "Maroc", null));
clientsData.push(makeClient(5, "CL-0005", "Atlas Golf SARL", "Atlas Golf", villesRabat[1], "Rabat-Salé-Kénitra", "grand_compte", "client_privilegie", "SARL", "IS", "effet", "bouche-à-oreille", "Maroc", null));
clientsData.push(makeClient(6, "CL-0006", "Marrakech Prestige SA", "Marrakech Prestige", villesMarrakech[0], "Marrakech-Safi", "grand_compte", "actif", "SA", "IS", "virement", "salon", "Maroc", null));
clientsData.push(makeClient(7, "CL-0007", "Al Houara Real Estate SARL", "Al Houara RE", villesTanger[0], "Tanger-Tétouan-Al Hoceima", "grand_compte", "actif", "SARL", "IS", "cheque", "prospection", "Maroc", null));
clientsData.push(makeClient(8, "CL-0008", "Cité du Nord SARL", "Cité du Nord", villesTanger[1], "Tanger-Tétouan-Al Hoceima", "grand_compte", "actif", "SARL", "IS", "virement", "référence", "Maroc", null));
clientsData.push(makeClient(9, "CL-0009", "Promotion Fès SA", "Promotion Fès", villesFes[0], "Fès-Meknès", "grand_compte", "actif", "SA", "IS", "virement", "site web", "Maroc", null));
clientsData.push(makeClient(10, "CL-0010", "Meknès Construction SARL", "Meknès Const.", villesFes[1], "Fès-Meknès", "grand_compte", "actif", "SARL", "IS", "cheque", "bouche-à-oreille", "Maroc", null));
clientsData.push(makeClient(11, "CL-0011", "Sahara Invest SA", "Sahara Invest", villesSouss[0], "Souss-Massa", "grand_compte", "actif", "SA", "IS", "virement", "prospection", "Maroc", null));
clientsData.push(makeClient(12, "CL-0012", "Béni Mellal Habitat SARL", "BM Habitat", villesBeniMellal[0], "Béni Mellal-Khénifra", "grand_compte", "actif", "SARL", "IS", "cheque", "référence", "Maroc", null));
clientsData.push(makeClient(13, "CL-0013", "Draa Valley Real Estate SARL", "Draa Valley RE", villesDraa[0], "Drâa-Tafilalet", "grand_compte", "actif", "SARL", "IS", "virement", "publicité", "Maroc", null));
clientsData.push(makeClient(14, "CL-0014", "Oriental Builders SARL", "Oriental Builders", villesOriental[0], "Oriental", "grand_compte", "actif", "SARL", "IS", "cheque", "site web", "Maroc", null));
clientsData.push(makeClient(15, "CL-0015", "Laâyoune Construction SARL", "Laâyoune Const.", villesLaayoune[0], "Laâyoune-Sakia El Hamra", "grand_compte", "actif", "SARL", "IS", "virement", "prospection", "Maroc", null));

// PME (40)
clientsData.push(makeClient(16, "CL-0016", "BatiPro SARL", "BatiPro", villesCasablanca[0], "Casablanca-Settat", "PME", "actif", "SARL", "IS", "virement", "bouche-à-oreille", "Maroc", null));
clientsData.push(makeClient(17, "CL-0017", "Menuiserie Moderne SARL", "Menuiserie Moderne", villesCasablanca[2], "Casablanca-Settat", "PME", "actif", "SARL", "IS", "cheque", "prospection", "Maroc", null));
clientsData.push(makeClient(18, "CL-0018", "Génie Bâtir SARL", "Génie Bâtir", villesCasablanca[0], "Casablanca-Settat", "PME", "actif", "SARL", "IS", "virement", "site web", "Maroc", null));
clientsData.push(makeClient(19, "CL-0019", "Aluminium & Verre SARL", "Alu & Verre", villesCasablanca[3], "Casablanca-Settat", "PME", "actif", "SARL", "reel_simplifie", "cheque", "salon", "Maroc", null));
clientsData.push(makeClient(20, "CL-0020", "Espace Habitat SARL", "Espace Habitat", villesCasablanca[4], "Casablanca-Settat", "PME", "inactif", "SARL", "IS", "cheque", "publicité", "Maroc", null));
clientsData.push(makeClient(21, "CL-0021", "Settat Développement SARL", "Setta Dév.", villesCasablanca[6], "Casablanca-Settat", "PME", "actif", "SARL", "IS", "virement", "référence", "Maroc", null));
clientsData.push(makeClient(22, "CL-0022", "BTP Services SARL", "BTP Services", villesCasablanca[5], "Casablanca-Settat", "PME", "actif", "SARL", "reel_simplifie", "cheque", "prospection", "Maroc", null));
clientsData.push(makeClient(23, "CL-0023", "Rabat Architecture SARL", "Rabat Archi.", villesRabat[0], "Rabat-Salé-Kénitra", "PME", "actif", "SARL", "IS", "virement", "site web", "Maroc", null));
clientsData.push(makeClient(24, "CL-0024", "Salé Construction SARL", "Salé Const.", villesRabat[1], "Rabat-Salé-Kénitra", "PME", "actif", "SARL", "IS", "cheque", "bouche-à-oreille", "Maroc", null));
clientsData.push(makeClient(25, "CL-0025", "Témara Bâtiment SARL", "Témara Bât.", villesRabat[2], "Rabat-Salé-Kénitra", "PME", "actif", "SARL", "reel_simplifie", "virement", "référence", "Maroc", null));
clientsData.push(makeClient(26, "CL-0026", "Kénitra Menuiserie SARL", "Kénitra Menu.", villesRabat[3], "Rabat-Salé-Kénitra", "PME", "actif", "SARL", "IS", "cheque", "prospection", "Maroc", null));
clientsData.push(makeClient(27, "CL-0027", "Marrakech Rénovation SARL", "Marrakech Rénov.", villesMarrakech[0], "Marrakech-Safi", "PME", "actif", "SARL", "IS", "virement", "bouche-à-oreille", "Maroc", null));
clientsData.push(makeClient(28, "CL-0028", "Safi Aluminium SARL", "Safi Alu", villesMarrakech[1], "Marrakech-Safi", "PME", "client_risque", "SARL", "reel_simplifie", "cheque", "publicité", "Maroc", null));
clientsData.push(makeClient(29, "CL-0029", "Essaouira Habitat SARL", "Essaouira Hab.", villesMarrakech[3], "Marrakech-Safi", "PME", "actif", "SARL", "IS", "virement", "site web", "Maroc", null));
clientsData.push(makeClient(30, "CL-0030", "Kelaa Bâtiment SARL", "Kelaa Bât.", villesMarrakech[2], "Marrakech-Safi", "PME", "actif", "SARL", "IS", "cheque", "prospection", "Maroc", null));
clientsData.push(makeClient(31, "CL-0031", "Tanger Aluminium SARL", "Tanger Alu", villesTanger[0], "Tanger-Tétouan-Al Hoceima", "PME", "actif", "SARL", "IS", "virement", "salon", "Maroc", null));
clientsData.push(makeClient(32, "CL-0032", "Tétouan Menuiserie SARL", "Tétouan Menu.", villesTanger[1], "Tanger-Tétouan-Al Hoceima", "PME", "actif", "SARL", "IS", "cheque", "référence", "Maroc", null));
clientsData.push(makeClient(33, "CL-0033", "Hoceima BTP SARL", "Hoceima BTP", villesTanger[2], "Tanger-Tétouan-Al Hoceima", "PME", "actif", "SARL", "reel_simplifie", "virement", "bouche-à-oreille", "Maroc", null));
clientsData.push(makeClient(34, "CL-0034", "Fès Menuiserie SARL", "Fès Menu.", villesFes[0], "Fès-Meknès", "PME", "actif", "SARL", "IS", "cheque", "site web", "Maroc", null));
clientsData.push(makeClient(35, "CL-0035", "Meknès Alu SARL", "Meknès Alu", villesFes[1], "Fès-Meknès", "PME", "actif", "SARL", "IS", "virement", "prospection", "Maroc", null));
clientsData.push(makeClient(36, "CL-0036", "Ifrane Construction SARL", "Ifrane Const.", villesFes[2], "Fès-Meknès", "PME", "actif", "SARL", "IS", "cheque", "publicité", "Maroc", null));
clientsData.push(makeClient(37, "CL-0037", "Béni Mellal Menuiserie SARL", "BM Menu.", villesBeniMellal[0], "Béni Mellal-Khénifra", "PME", "actif", "SARL", "reel_simplifie", "virement", "bouche-à-oreille", "Maroc", null));
clientsData.push(makeClient(38, "CL-0038", "Khénifra Bâtiment SARL", "Khénifra Bât.", villesBeniMellal[1], "Béni Mellal-Khénifra", "PME", "actif", "SARL", "IS", "cheque", "prospection", "Maroc", null));
clientsData.push(makeClient(39, "CL-0039", "Ouarzazate Habitat SARL", "Ouarzazate Hab.", villesDraa[1], "Drâa-Tafilalet", "PME", "actif", "SARL", "IS", "virement", "site web", "Maroc", null));
clientsData.push(makeClient(40, "CL-0040", "Errachidia Menuiserie SARL", "Errachidia Menu.", villesDraa[0], "Drâa-Tafilalet", "PME", "inactif", "SARL", "reel_simplifie", "cheque", "référence", "Maroc", null));
clientsData.push(makeClient(41, "CL-0041", "Agadir BTP SARL", "Agadir BTP", villesSouss[0], "Souss-Massa", "PME", "actif", "SARL", "IS", "virement", "salon", "Maroc", null));
clientsData.push(makeClient(42, "CL-0042", "Inezgane Aluminium SARL", "Inezgane Alu", villesSouss[1], "Souss-Massa", "PME", "actif", "SARL", "IS", "cheque", "bouche-à-oreille", "Maroc", null));
clientsData.push(makeClient(43, "CL-0043", "Taroudant Menuiserie SARL", "Taroudant Menu.", villesSouss[4], "Souss-Massa", "PME", "actif", "SARL", "reel_simplifie", "virement", "prospection", "Maroc", null));
clientsData.push(makeClient(44, "CL-0044", "Guelmim Construction SARL", "Guelmim Const.", villesGuelmim[0], "Guelmim-Oued Noun", "PME", "actif", "SARL", "IS", "cheque", "publicité", "Maroc", null));
clientsData.push(makeClient(45, "CL-0045", "Oujda Bâtiment SARL", "Oujda Bât.", villesOriental[0], "Oriental", "PME", "actif", "SARL", "IS", "virement", "site web", "Maroc", null));
clientsData.push(makeClient(46, "CL-0046", "Nador Menuiserie SARL", "Nador Menu.", villesOriental[1], "Oriental", "PME", "actif", "SARL", "IS", "cheque", "référence", "Maroc", null));
clientsData.push(makeClient(47, "CL-0047", "Berkane Aluminium SARL", "Berkane Alu", villesOriental[3], "Oriental", "PME", "actif", "SARL", "IS", "virement", "prospection", "Maroc", null));
clientsData.push(makeClient(48, "CL-0048", "Laâyoune Menuiserie SARL", "Laâyoune Menu.", villesLaayoune[0], "Laâyoune-Sakia El Hamra", "PME", "actif", "SARL", "reel_simplifie", "cheque", "bouche-à-oreille", "Maroc", null));
clientsData.push(makeClient(49, "CL-0049", "Dakhla Habitat SARL", "Dakhla Hab.", villesDakhla[0], "Dakhla-Oued Ed Dahab", "PME", "actif", "SARL", "IS", "virement", "site web", "Maroc", null));
clientsData.push(makeClient(50, "CL-0050", "Casablanca Prestige SARL", "Casa Prestige", villesCasablanca[0], "Casablanca-Settat", "PME", "actif", "SARL", "IS", "virement", "salon", "Maroc", null));
clientsData.push(makeClient(51, "CL-0051", "Mohammedia Alu SARL", "Mohammedia Alu", villesCasablanca[1], "Casablanca-Settat", "PME", "actif", "SARL", "IS", "cheque", "publicité", "Maroc", null));
clientsData.push(makeClient(52, "CL-0052", "El Jadida BTP SARL", "El Jadida BTP", villesCasablanca[2], "Casablanca-Settat", "PME", "client_risque", "SARL", "reel_simplifie", "cheque", "référence", "Maroc", null));
clientsData.push(makeClient(53, "CL-0053", "Skhirat Rénovation SARL", "Skhirat Rénov.", villesRabat[2], "Rabat-Salé-Kénitra", "PME", "actif", "SARL", "IS", "virement", "prospection", "Maroc", null));
clientsData.push(makeClient(54, "CL-0054", "Larache Menuiserie SARL", "Larache Menu.", villesTanger[4], "Tanger-Tétouan-Al Hoceima", "PME", "actif", "SARL", "IS", "cheque", "bouche-à-oreille", "Maroc", null));
clientsData.push(makeClient(55, "CL-0055", "Taza Construction SARL", "Taza Const.", villesFes[3], "Fès-Meknès", "PME", "actif", "SARL", "IS", "virement", "site web", "Maroc", null));

// REVENDEURS (20)
clientsData.push(makeClient(56, "CL-0056", "AluTech Distribution SARL", "AluTech Dist.", villesCasablanca[0], "Casablanca-Settat", "revendeur", "actif", "SARL", "IS", "virement", "salon", "Maroc", null));
clientsData.push(makeClient(57, "CL-0057", "Menuiserie Express SARL", "Menuiserie Exp.", villesCasablanca[0], "Casablanca-Settat", "revendeur", "actif", "SARL", "IS", "cheque", "référence", "Maroc", null));
clientsData.push(makeClient(58, "CL-0058", "Casablanca Fenêtres SARL", "Casa Fenêtres", villesCasablanca[3], "Casablanca-Settat", "revendeur", "actif", "SARL", "IS", "virement", "site web", "Maroc", null));
clientsData.push(makeClient(59, "CL-0059", "Rabat Menuiserie SARL", "Rabat Menu.", villesRabat[0], "Rabat-Salé-Kénitra", "revendeur", "actif", "SARL", "IS", "virement", "bouche-à-oreille", "Maroc", null));
clientsData.push(makeClient(60, "CL-0060", "Salé Distribution SARL", "Salé Dist.", villesRabat[1], "Rabat-Salé-Kénitra", "revendeur", "actif", "SARL", "IS", "cheque", "prospection", "Maroc", null));
clientsData.push(makeClient(61, "CL-0061", "Kénitra Vitre SARL", "Kénitra Vitre", villesRabat[3], "Rabat-Salé-Kénitra", "revendeur", "actif", "SARL", "reel_simplifie", "virement", "publicité", "Maroc", null));
clientsData.push(makeClient(62, "CL-0062", "Marrakech Distribution SARL", "Marrakech Dist.", villesMarrakech[0], "Marrakech-Safi", "revendeur", "actif", "SARL", "IS", "cheque", "salon", "Maroc", null));
clientsData.push(makeClient(63, "CL-0063", "Safi Alu SARL", "Safi Alu Dist.", villesMarrakech[1], "Marrakech-Safi", "revendeur", "actif", "SARL", "IS", "virement", "référence", "Maroc", null));
clientsData.push(makeClient(64, "CL-0064", "Tanger Fenêtres SARL", "Tanger Fen.", villesTanger[0], "Tanger-Tétouan-Al Hoceima", "revendeur", "actif", "SARL", "IS", "virement", "prospection", "Maroc", null));
clientsData.push(makeClient(65, "CL-0065", "Tétouan Vitre SARL", "Tétouan Vitre", villesTanger[1], "Tanger-Tétouan-Al Hoceima", "revendeur", "actif", "SARL", "IS", "cheque", "site web", "Maroc", null));
clientsData.push(makeClient(66, "CL-0066", "Fès Distribution SARL", "Fès Dist.", villesFes[0], "Fès-Meknès", "revendeur", "actif", "SARL", "IS", "virement", "bouche-à-oreille", "Maroc", null));
clientsData.push(makeClient(67, "CL-0067", "Meknès Menuiserie SARL", "Meknès Menu Dist.", villesFes[1], "Fès-Meknès", "revendeur", "actif", "SARL", "IS", "cheque", "publicité", "Maroc", null));
clientsData.push(makeClient(68, "CL-0068", "Agadir Alu SARL", "Agadir Alu Dist.", villesSouss[0], "Souss-Massa", "revendeur", "actif", "SARL", "IS", "virement", "prospection", "Maroc", null));
clientsData.push(makeClient(69, "CL-0069", "Inezgane Fenêtres SARL", "Inezgane Fen.", villesSouss[1], "Souss-Massa", "revendeur", "actif", "SARL", "IS", "cheque", "référence", "Maroc", null));
clientsData.push(makeClient(70, "CL-0070", "Tiznit Vitre SARL", "Tiznit Vitre Dist.", villesSouss[4], "Souss-Massa", "revendeur", "actif", "SARL", "reel_simplifie", "virement", "site web", "Maroc", null));
clientsData.push(makeClient(71, "CL-0071", "Oujda Menuiserie SARL", "Oujda Menu Dist.", villesOriental[0], "Oriental", "revendeur", "actif", "SARL", "IS", "virement", "bouche-à-oreille", "Maroc", null));
clientsData.push(makeClient(72, "CL-0072", "Nador Alu SARL", "Nador Alu Dist.", villesOriental[1], "Oriental", "revendeur", "actif", "SARL", "IS", "cheque", "prospection", "Maroc", null));
clientsData.push(makeClient(73, "CL-0073", "Laâyoune Fenêtres SARL", "Laâyoune Fen.", villesLaayoune[0], "Laâyoune-Sakia El Hamra", "revendeur", "actif", "SARL", "IS", "virement", "publicité", "Maroc", null));
clientsData.push(makeClient(74, "CL-0074", "Béni Mellal Distribution SARL", "BM Dist.", villesBeniMellal[0], "Béni Mellal-Khénifra", "revendeur", "actif", "SARL", "reel_simplifie", "cheque", "référence", "Maroc", null));
clientsData.push(makeClient(75, "CL-0075", "Casablanca Wholesale SARL", "Casa Wholesale", villesCasablanca[0], "Casablanca-Settat", "revendeur", "client_privilegie", "SARL", "IS", "virement", "salon", "Maroc", null));

// PARTICULIERS (10)
clientsData.push(makeClient(76, "CL-0076", "M. Karim Alaoui", "K. Alaoui", villesCasablanca[0], "Casablanca-Settat", "particulier", "actif", "Autre", "IR", "especes", "site web", "Maroc", null));
clientsData.push(makeClient(77, "CL-0077", "Mme Fatima Zahra El Fassi", "F.Z. El Fassi", villesRabat[0], "Rabat-Salé-Kénitra", "particulier", "actif", "Autre", "IR", "especes", "bouche-à-oreille", "Maroc", null));
clientsData.push(makeClient(78, "CL-0078", "M. Hassan Benjelloun", "H. Benjelloun", villesMarrakech[0], "Marrakech-Safi", "particulier", "actif", "Autre", "IR", "cheque", "référence", "Maroc", null));
clientsData.push(makeClient(79, "CL-0079", "M. Ahmed Tazi", "A. Tazi", villesTanger[0], "Tanger-Tétouan-Al Hoceima", "particulier", "actif", "Autre", "IR", "especes", "publicité", "Maroc", null));
clientsData.push(makeClient(80, "CL-0080", "M. Rachid Chraibi", "R. Chraibi", villesFes[0], "Fès-Meknès", "particulier", "actif", "Autre", "IR", "cheque", "site web", "Maroc", null));
clientsData.push(makeClient(81, "CL-0081", "Mme Nadia Berrada", "N. Berrada", villesCasablanca[0], "Casablanca-Settat", "particulier", "actif", "Autre", "IR", "especes", "prospection", "Maroc", null));
clientsData.push(makeClient(82, "CL-0082", "M. Omar Squalli", "O. Squalli", villesSouss[0], "Souss-Massa", "particulier", "actif", "Autre", "IR", "especes", "bouche-à-oreille", "Maroc", null));
clientsData.push(makeClient(83, "CL-0083", "M. Youssef Amrani", "Y. Amrani", villesCasablanca[1], "Casablanca-Settat", "particulier", "actif", "Autre", "IR", "cheque", "salon", "Maroc", null));
clientsData.push(makeClient(84, "CL-0084", "M. Driss Lahlou", "D. Lahlou", villesRabat[1], "Rabat-Salé-Kénitra", "particulier", "inactif", "Autre", "IR", "especes", "référence", "Maroc", null));
clientsData.push(makeClient(85, "CL-0085", "Mme Amina Kettani", "A. Kettani", villesFes[1], "Fès-Meknès", "particulier", "actif", "Autre", "IR", "cheque", "site web", "Maroc", null));

// EXPORT (10)
clientsData.push(makeClient(86, "CL-0086", "AluTrade Spain SL", "AluTrade Spain", "Valencia", "Valencia", "export", "actif", "SA", "IS", "virement", "salon", "Espagne", "FCA"));
clientsData.push(makeClient(87, "CL-0087", "Fenêtre Services France SAS", "Fenêtre Services", "Marseille", "Bouches-du-Rhône", "export", "actif", "SA", "IS", "virement", "prospection", "France", "DAP"));
clientsData.push(makeClient(88, "CL-0088", "Mauritania Building Co. Ltd", "Mauritania Bldg", "Nouakchott", "Nouakchott", "export", "actif", "SA", "IS", "virement", "site web", "Mauritanie", "FCA"));
clientsData.push(makeClient(89, "CL-0089", "West Africa Aluminium SARL", "WA Aluminium", "Dakar", "Dakar", "export", "actif", "SA", "IS", "virement", "référence", "Sénégal", "FCA"));
clientsData.push(makeClient(90, "CL-0090", "Glass & Aluminium International BV", "G&A International", "Amsterdam", "Noord-Holland", "export", "actif", "Autre", "IS", "virement", "salon", "Pays-Bas", "EXW"));
clientsData.push(makeClient(91, "CL-0091", "Mediterranean Windows GmbH", "Med Windows", "Düsseldorf", "Noord-Holland", "export", "actif", "Autre", "IS", "virement", "publicité", "Allemagne", "DAP"));
clientsData.push(makeClient(92, "CL-0092", "Algeria Menuiserie SPA", "Algeria Menu.", "Alger", "Alger", "export", "actif", "SA", "IS", "virement", "prospection", "Algérie", "FCA"));
clientsData.push(makeClient(93, "CL-0093", "Tunisie Aluminium SARL", "Tunisie Alu", "Tunis", "Tunis", "export", "actif", "SA", "IS", "virement", "bouche-à-oreille", "Tunisie", "EXW"));
clientsData.push(makeClient(94, "CL-0094", "Libya Construction & Trading Co.", "Libya C&T", "Tripoli", "Tripoli", "export", "actif", "Autre", "IS", "virement", "site web", "Libye", "FCA"));
clientsData.push(makeClient(95, "CL-0095", "Ivory Coast Building Materials SARL", "ICBM SARL", "Abidjan", "Abidjan", "export", "inactif", "SA", "IS", "virement", "référence", "Côte d'Ivoire", "DAP"));

// PROSPECTS (5)
clientsData.push(makeClient(96, "CL-0096", "Promo Sud SARL", "Promo Sud", villesGuelmim[0], "Guelmim-Oued Noun", "PME", "prospect", "SARL", "IS", "virement", "prospection", "Maroc", null));
clientsData.push(makeClient(97, "CL-0097", "Tan-Tan Construction SARL", "Tan-Tan Const.", villesGuelmim[1], "Guelmim-Oued Noun", "PME", "prospect", "SARL", "IS", "cheque", "publicité", "Maroc", null));
clientsData.push(makeClient(98, "CL-0098", "Oasis Habitat SARL", "Oasis Habitat", villesDraa[2], "Drâa-Tafilalet", "PME", "prospect", "SARL", "IS", "virement", "site web", "Maroc", null));
clientsData.push(makeClient(99, "CL-0099", "Midelt Bâtiment SARL", "Midelt Bât.", villesDraa[3], "Drâa-Tafilalet", "PME", "prospect", "SARL", "IS", "cheque", "salon", "Maroc", null));
clientsData.push(makeClient(100, "CL-0100", "Lagouira Construction SARL", "Lagouira Const.", villesDakhla[2], "Dakhla-Oued Ed Dahab", "PME", "prospect", "SARL", "IS", "virement", "prospection", "Maroc", null));

// ─── CLIENT CONTACT NAMES (French-Moroccan pool) ────────────────────────────
const prenomsHomme = [
  "Mohammed", "Ahmed", "Youssef", "Karim", "Omar", "Rachid", "Hassan", "Mehdi",
  "Hamza", "Amine", "Zakaria", "Soufiane", "Adil", "Hicham", "Mustapha",
  "Khalid", "Reda", "Ayoub", "Ilyass", "Yassine",
];
const prenomsFemme = [
  "Fatima", "Nadia", "Samira", "Khadija", "Amina", "Salma", "Hajar", "Zineb",
  "Meryem", "Rim", "Imane", "Sanaa", "Houda", "Nisrine", "Laila",
  "Douae", "Ghita", "Ikram", "Oumaima", "Rania",
];
const noms = [
  "Alaoui", "Benjelloun", "El Fassi", "Berrada", "Tazi", "Chraibi", "Amrani",
  "Bennani", "El Idrissi", "Ouazzani", "Squalli", "Kettani", "Lahlou",
  "Belhaj", "Fassi Fihri", "Bouzidi", "Koraichi", "Alami", "Bensalem",
  "Hajji", "Lemrini", "Filali", "Ziani", "Doukkali", "Mouline",
  "Rahmouni", "Senhaji", "Naciri", "Cherkaoui", "Belkadi",
];
const fonctions = [
  "Directeur Général", "Directeur Technique", "Responsable Achats",
  "Chef de Projet", "Responsable Commercial", "Gérant", "Directeur Commercial",
  "Ingénieur Bâtiment", "Architecte", "Responsable Logistique",
  "Chargé d'Affaires", "Directeur Financier", "Responsable Production",
  "Conducteur de Travaux", "Chef de Chantier",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT TRANSFORMATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function transformProduct(
  p: Record<string, unknown>,
  nature: "matiere_premiere" | "semi_fini" | "produit_fini",
  usage: "consommation" | "vente"
) {
  return {
    reference: p.reference as string,
    designation: p.designation as string,
    description: (p.description as string) ?? null,
    famille: (p.famille as string) ?? null,
    sousFamille: (p.sousFamille as string) ?? null,
    priceHT: p.priceHT as number,
    tvaRate: 20,
    unit: (p.unit as string) || "unité",
    productNature: nature,
    productUsage: usage,
    isStockable: true,
    currentStock: p.currentStock as number,
    minStock: p.minStock as number,
    maxStock: p.maxStock as number,
    averageCost: p.averageCost as number,
    isActive: true,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const startTime = Date.now();
  console.log("🚀 Starting optimized seed: Clients, Suppliers, Products & Contacts");
  console.log(`   DB: ${DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")}`);
  console.log("");

  // ─── Step 1: DELETE existing data in FK order ──────────────────────────────
  console.log("🗑️  Step 1: Deleting existing data in FK order...");

  // Level 1: Client-dependent records
  const delClientLevel = await prisma.$transaction([
    prisma.clientContact.deleteMany(),
    prisma.clientDocument.deleteMany(),
    prisma.chantier.deleteMany(),
  ]);
  console.log(`   ✓ Deleted client-dependent records: ${delClientLevel[0].count + delClientLevel[1].count + delClientLevel[2].count} rows`);

  // Level 2: Sales records (Client + Product dependent)
  const delSalesLevel = await prisma.$transaction([
    prisma.quoteLine.deleteMany(),
    prisma.quote.deleteMany(),
    prisma.salesOrderLine.deleteMany(),
    prisma.salesOrder.deleteMany(),
    prisma.invoiceLine.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.creditNoteLine.deleteMany(),
    prisma.creditNote.deleteMany(),
    prisma.deliveryNoteLine.deleteMany(),
    prisma.deliveryNote.deleteMany(),
    prisma.customerReturnLine.deleteMany(),
    prisma.customerReturn.deleteMany(),
  ]);
  const salesTotal = delSalesLevel.reduce((sum, r) => sum + r.count, 0);
  console.log(`   ✓ Deleted sales records: ${salesTotal} rows`);

  // Level 3: Purchase records (Supplier + Product dependent)
  const delPurchaseLevel = await prisma.$transaction([
    prisma.purchaseOrderLine.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.supplierQuoteLine.deleteMany(),
    prisma.supplierQuote.deleteMany(),
    prisma.supplierInvoiceLine.deleteMany(),
    prisma.supplierInvoice.deleteMany(),
    prisma.supplierReturnLine.deleteMany(),
    prisma.supplierReturn.deleteMany(),
    prisma.supplierCreditNoteLine.deleteMany(),
    prisma.supplierCreditNote.deleteMany(),
    prisma.receptionLine.deleteMany(),
    prisma.reception.deleteMany(),
    prisma.priceRequestLine.deleteMany(),
    prisma.priceRequest.deleteMany(),
  ]);
  const purchaseTotal = delPurchaseLevel.reduce((sum, r) => sum + r.count, 0);
  console.log(`   ✓ Deleted purchase records: ${purchaseTotal} rows`);

  // Level 4: Product-dependent records
  const delProductLevel = await prisma.$transaction([
    prisma.stockMovement.deleteMany(),
    prisma.inventoryLine.deleteMany(),
    prisma.inventory.deleteMany(),
    prisma.productionBatch.deleteMany(),
    prisma.lotMouvement.deleteMany(),
    prisma.lot.deleteMany(),
    prisma.qualityControlLine.deleteMany(),
    prisma.qualityControl.deleteMany(),
    prisma.workOrderStep.deleteMany(),
    prisma.workOrder.deleteMany(),
    prisma.routingStep.deleteMany(),
    prisma.bomComponent.deleteMany(),
    prisma.preparationLine.deleteMany(),
  ]);
  const productLevelTotal = delProductLevel.reduce((sum, r) => sum + r.count, 0);
  console.log(`   ✓ Deleted product-dependent records: ${productLevelTotal} rows`);

  // Level 5: Core entities
  const delCore = await prisma.$transaction([
    prisma.product.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.client.deleteMany(),
  ]);
  console.log(`   ✓ Deleted core: ${delCore[0].count} products, ${delCore[1].count} suppliers, ${delCore[2].count} clients`);
  console.log("");

  // ─── Step 2: BUILD product payloads ─────────────────────────────────────────
  console.log("📦 Step 2: Preparing product data...");

  const productsPayload = [
    ...matieresPremieres.map((p) => transformProduct(p, "matiere_premiere", "consommation")),
    ...semiFinis.map((p) => transformProduct(p, "semi_fini", "consommation")),
    ...produitsFinis.map((p) => transformProduct(p, "produit_fini", "vente")),
  ];
  console.log(`   Total products: ${productsPayload.length} (${matieresPremieres.length} MP + ${semiFinis.length} SF + ${produitsFinis.length} PF)`);

  // ─── Step 3: BUILD supplier payload ──────────────────────────────────────────
  console.log("📦 Step 3: Preparing supplier data...");

  const suppliersPayload = suppliersData.map((s) => ({
    code: s.code,
    name: s.name,
    siret: s.siret,
    address: s.address,
    city: s.city,
    postalCode: s.postalCode,
    country: s.country,
    phone: s.phone,
    email: s.email,
    deliveryDelay: s.deliveryDelay,
    paymentTerms: s.paymentTerms,
    notes: s.notes,
    balance: s.balance,
    creditLimit: s.creditLimit,
    rating: s.rating,
  }));
  console.log(`   Total suppliers: ${suppliersPayload.length}`);

  // ─── Step 4: BUILD client payload ───────────────────────────────────────────
  console.log("📦 Step 4: Preparing client data...");
  console.log(`   Total clients: ${clientsData.length}`);
  console.log(`     - Grands comptes: ${clientsData.filter((c) => c.categorie === "grand_compte").length}`);
  console.log(`     - PME: ${clientsData.filter((c) => c.categorie === "PME").length}`);
  console.log(`     - Revendeurs: ${clientsData.filter((c) => c.categorie === "revendeur").length}`);
  console.log(`     - Particuliers: ${clientsData.filter((c) => c.categorie === "particulier").length}`);
  console.log(`     - Export: ${clientsData.filter((c) => c.categorie === "export").length}`);

  // ─── Step 5: INSERT all data ───────────────────────────────────────────────
  console.log("");
  console.log("💾 Step 5: Bulk inserting data...");

  await prisma.$transaction(async (tx) => {
    // 5a. Insert Products
    console.log("   Inserting products...");
    const productResult = await tx.product.createMany({
      data: productsPayload,
      skipDuplicates: true,
    });
    console.log(`   ✓ Products inserted: ${productResult.count}`);

    // 5b. Insert Suppliers
    console.log("   Inserting suppliers...");
    const supplierResult = await tx.supplier.createMany({
      data: suppliersPayload,
      skipDuplicates: true,
    });
    console.log(`   ✓ Suppliers inserted: ${supplierResult.count}`);

    // 5c. Insert Clients
    console.log("   Inserting clients...");
    const clientResult = await tx.client.createMany({
      data: clientsData,
      skipDuplicates: true,
    });
    console.log(`   ✓ Clients inserted: ${clientResult.count}`);

    // 5d. Fetch inserted clients to get their IDs for contacts
    console.log("   Fetching client IDs for contact generation...");
    const insertedClients = await tx.client.findMany({
      select: { id: true, code: true, email: true },
      orderBy: { code: "asc" },
    });
    console.log(`   ✓ Found ${insertedClients.length} clients`);

    // 5e. Generate and insert ClientContacts
    console.log("   Generating client contacts...");
    const clientById = new Map(insertedClients.map((c) => [c.code, c]));
    const contactsData: { clientId: string; type: "principal" | "commercial"; nom: string; prenom: string; fonction: string; telephoneDirect: string; email: string }[] = [];

    for (const client of insertedClients) {
      // Every client gets at least 1 principal contact
      const isHomme = Math.random() > 0.35;
      const prenom = isHomme ? pickRandom(prenomsHomme) : pickRandom(prenomsFemme);
      const nom = pickRandom(noms);
      const fonct = pickRandom(fonctions);
      const emailClean = `${prenom.toLowerCase().replace(/'/g, "")}.${nom.toLowerCase()}`.slice(0, 25);
      const emailBase = client.email?.split("@")[1] || "gmail.com";

      contactsData.push({
        clientId: client.id,
        type: "principal",
        nom,
        prenom,
        fonction: fonct,
        telephoneDirect: `06${String(rnd(10000000, 99999999))}`,
        email: `${emailClean}@${emailBase}`,
      });

      // ~60% of clients get a second commercial contact
      if (Math.random() > 0.4) {
        const prenom2 = pickRandom(Math.random() > 0.5 ? prenomsHomme : prenomsFemme);
        const nom2 = pickRandom(noms);
        const emailClean2 = `${prenom2.toLowerCase().replace(/'/g, "")}.${nom2.toLowerCase()}`.slice(0, 25);

        contactsData.push({
          clientId: client.id,
          type: "commercial",
          nom: nom2,
          prenom: prenom2,
          fonction: pickRandom(["Responsable Commercial", "Chargé d'Affaires", "Responsable Achats", "Directeur Technique"]),
          telephoneDirect: `06${String(rnd(10000000, 99999999))}`,
          email: `${emailClean2}@${emailBase}`,
        });
      }
    }

    console.log(`   Inserting ${contactsData.length} client contacts...`);
    // Batch insert in chunks of 50 to avoid query size limits
    const CHUNK = 50;
    let totalContactsInserted = 0;
    for (let i = 0; i < contactsData.length; i += CHUNK) {
      const chunk = contactsData.slice(i, i + CHUNK);
      const result = await tx.clientContact.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      totalContactsInserted += result.count;
    }
    console.log(`   ✓ Client contacts inserted: ${totalContactsInserted}`);
  }, { timeout: 120000 });

  // ─── Summary ────────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("");
  console.log("✅ Seed completed successfully!");
  console.log(`   Products:   ${productsPayload.length} (${matieresPremieres.length} MP + ${semiFinis.length} SF + ${produitsFinis.length} PF)`);
  console.log(`   Suppliers:  ${suppliersPayload.length}`);
  console.log(`   Clients:    ${clientsData.length}`);
  console.log(`   Contacts:   generated during insert`);
  console.log(`   ⏱️  Elapsed: ${elapsed}s`);
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
