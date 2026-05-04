import { PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'

const db = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
})

function hashPassword(password: string): string {
  return createHash('sha256').update(password + (process.env.PASSWORD_SALT || 'erp-salt')).digest('hex')
}

async function main() {
  console.log('🌱 Seeding GEMA ERP PRO database...\n')

  // Clean existing data (in correct order due to relations)
  console.log('🧹 Cleaning existing data...')
  await db.accountingEntry.deleteMany()
  await db.payment.deleteMany()
  await db.bankTransaction.deleteMany()
  await db.cashMovement.deleteMany()
  await db.creditNoteLine.deleteMany()
  await db.creditNote.deleteMany()
  await db.invoiceLine.deleteMany()
  await db.invoice.deleteMany()
  await db.preparationOrder.deleteMany()
  await db.salesOrderLine.deleteMany()
  await db.salesOrder.deleteMany()
  await db.quoteLine.deleteMany()
  await db.quote.deleteMany()
  await db.reception.deleteMany()
  await db.purchaseOrderLine.deleteMany()
  await db.purchaseOrder.deleteMany()
  await db.stockMovement.deleteMany()
  await db.inventoryLine.deleteMany()
  await db.inventory.deleteMany()
  await db.workOrderStep.deleteMany()
  await db.workOrder.deleteMany()
  await db.routingStep.deleteMany()
  await db.bomComponent.deleteMany()
  await db.product.deleteMany()
  await db.workStation.deleteMany()
  await db.supplier.deleteMany()
  await db.clientDocument.deleteMany()
  await db.clientContact.deleteMany()
  await db.client.deleteMany()
  await db.auditLog.deleteMany()
  await db.setting.deleteMany()
  await db.user.deleteMany()
  await db.cashRegister.deleteMany()
  await db.bankAccount.deleteMany()

  // ============ SETTINGS ============
  console.log('⚙️  Creating settings...')
  await db.setting.createMany({
    data: [
      { key: 'company_name', value: 'GEMA ERP PRO Industries' },
      { key: 'company_address', value: '123 Avenue de l\'Industrie, 69000 Lyon' },
      { key: 'company_phone', value: '+33 4 72 00 00 00' },
      { key: 'company_email', value: 'contact@gema-erp-industries.ma' },
      { key: 'company_siret', value: '123 456 789 00012' },
      { key: 'company_tva_number', value: 'FR 12 345678901' },
      { key: 'default_tva_rate', value: '20' },
      { key: 'currency', value: 'MAD' },
      { key: 'quote_validity_days', value: '30' },
      { key: 'inventory_valuation_method', value: 'average_cost' },
      { key: 'account_client', value: '411000' },
      { key: 'account_supplier', value: '401000' },
      { key: 'account_bank', value: '512000' },
      { key: 'account_cash', value: '530000' },
      { key: 'account_revenue', value: '706000' },
      { key: 'account_purchases', value: '601000' },
      { key: 'account_tva_collected', value: '445710' },
      { key: 'account_tva_deductible', value: '445660' },
    ]
  })

  // ============ USERS ============
  console.log('👤 Creating users...')
  const users = await db.user.createMany({
    data: [
      { email: 'admin@gema-erp.com', passwordHash: hashPassword('admin123'), name: 'Admin Principal', role: 'admin', isActive: true },
      { email: 'commercial@gema-erp.com', passwordHash: hashPassword('pass123'), name: 'Marie Dupont', role: 'commercial', isActive: true },
      { email: 'magasinier@gema-erp.com', passwordHash: hashPassword('pass123'), name: 'Jean Martin', role: 'storekeeper', isActive: true },
      { email: 'production@gema-erp.com', passwordHash: hashPassword('pass123'), name: 'Pierre Bernard', role: 'prod_manager', isActive: true },
      { email: 'acheteur@gema-erp.com', passwordHash: hashPassword('pass123'), name: 'Sophie Leroy', role: 'buyer', isActive: true },
      { email: 'comptable@gema-erp.com', passwordHash: hashPassword('pass123'), name: 'Claire Moreau', role: 'accountant', isActive: true },
      { email: 'caissier@gema-erp.com', passwordHash: hashPassword('pass123'), name: 'Luc Petit', role: 'cashier', isActive: true },
      { email: 'direction@gema-erp.com', passwordHash: hashPassword('pass123'), name: 'François Dubois', role: 'direction', isActive: true },
      { email: 'operateur@gema-erp.com', passwordHash: hashPassword('pass123'), name: 'Thomas Roux', role: 'operator', isActive: true },
    ]
  })

  const adminUser = await db.user.findUnique({ where: { email: 'admin@gema-erp.com' } })
  const commercialUser = await db.user.findUnique({ where: { email: 'commercial@gema-erp.com' } })
  const accountantUser = await db.user.findUnique({ where: { email: 'comptable@gema-erp.com' } })
  const storekeeperUser = await db.user.findUnique({ where: { email: 'magasinier@gema-erp.com' } })
  const prodManagerUser = await db.user.findUnique({ where: { email: 'production@gema-erp.com' } })
  const buyerUser = await db.user.findUnique({ where: { email: 'acheteur@gema-erp.com' } })

  // ============ CLIENTS ============
  console.log('🏢 Creating clients...')
  const clients = await Promise.all([
    db.client.create({
      data: {
        code: 'CL-0001',
        name: 'TechnoMat SA', siret: '321 654 987 00011',
        address: '45 Boulevard Zerktouni', city: 'Casablanca', postalCode: '20000', phone: '+212 522 00 00 01',
        raisonSociale: 'TechnoMat SA', ice: '001234567000011', patente: '12345678', cnss: '98765432',
        formeJuridique: 'SA', registreCommerce: 'RC-12345', villeRC: 'Casablanca',
        adresse: '45 Boulevard Zerktouni', ville: 'Casablanca', codePostal: '20000',
        provincePrefecture: 'Casablanca-Settat',
        telephone: '+212 522 00 00 01', gsm: '+212 600 00 00 01',
        email: 'contact@technomat.ma', emailFacturation: 'facturation@technomat.ma',
        siteWeb: 'www.technomat.ma', langueCommunication: 'francais',
        conditionsPaiement: '30 jours', modeReglementPrefere: 'virement',
        seuilCredit: 50000, remisePermanente: 2, categorie: 'grand_compte',
        statut: 'actif', regimeFiscal: 'IS', tauxTva: 'taux_20',
        balance: 12000, creditLimit: 50000, paymentTerms: '30 jours',
        caTotalHT: 320000, nbCommandes: 24, panierMoyen: 13333,
        datePremierAchat: new Date('2023-03-15'), dateDernierAchat: new Date('2025-01-25'),
        commentairesInternes: 'Client fidèle, commandes régulières'
      }
    }),
    db.client.create({
      data: {
        code: 'CL-0002',
        name: 'MécaPro Industries', siret: '654 321 987 00022',
        address: '12 Avenue Mohammed V', city: 'Rabat', postalCode: '10000', phone: '+212 537 00 00 02',
        raisonSociale: 'MécaPro Industries SARL', ice: '002345678000022', patente: '23456789', cnss: '87654321',
        formeJuridique: 'SARL', registreCommerce: 'RC-23456', villeRC: 'Rabat',
        adresse: '12 Avenue Mohammed V', ville: 'Rabat', codePostal: '10000',
        provincePrefecture: 'Rabat-Salé-Kénitra',
        telephone: '+212 537 00 00 02', gsm: '+212 601 00 00 02',
        email: 'commandes@mecapro.ma', emailFacturation: 'comptabilite@mecapro.ma',
        langueCommunication: 'francais',
        conditionsPaiement: '45 jours', modeReglementPrefere: 'cheque',
        seuilCredit: 30000, categorie: 'PME',
        statut: 'actif', regimeFiscal: 'IS', tauxTva: 'taux_20',
        balance: 8500, creditLimit: 30000, paymentTerms: '45 jours',
        caTotalHT: 180000, nbCommandes: 15, panierMoyen: 12000,
        nbImpayes: 1, delaiMoyenPaiement: 52, alerteImpaye: true,
        datePremierAchat: new Date('2023-06-01'), dateDernierAchat: new Date('2024-12-15')
      }
    }),
    db.client.create({
      data: {
        code: 'CL-0003',
        name: 'AutoParts Maroc', siret: '789 456 123 00033',
        address: '8 Zone Industrielle Nord', city: 'Tanger', postalCode: '90000', phone: '+212 539 00 00 03',
        raisonSociale: 'AutoParts Maroc SA', ice: '003456789000033', patente: '34567890',
        formeJuridique: 'SA', registreCommerce: 'RC-34567', villeRC: 'Tanger',
        adresse: '8 Zone Industrielle Nord', ville: 'Tanger', codePostal: '90000',
        provincePrefecture: 'Tanger-Tétouan-Al Hoceima',
        telephone: '+212 539 00 00 03', gsm: '+212 602 00 00 03',
        email: 'achat@autoparts.ma',
        langueCommunication: 'francais',
        conditionsPaiement: '30 jours', modeReglementPrefere: 'virement',
        seuilCredit: 75000, categorie: 'grand_compte',
        statut: 'actif', regimeFiscal: 'IS', tauxTva: 'taux_20',
        balance: 0, creditLimit: 75000, paymentTerms: '30 jours',
        caTotalHT: 450000, nbCommandes: 32, panierMoyen: 14063,
        datePremierAchat: new Date('2022-11-01'), dateDernierAchat: new Date('2025-01-20')
      }
    }),
    db.client.create({
      data: {
        code: 'CL-0004',
        name: 'BatiConseil SARL', siret: '147 258 369 00044',
        address: '23 Rue Semlalia', city: 'Marrakech', postalCode: '40000', phone: '+212 524 00 00 04',
        raisonSociale: 'BatiConseil SARL', ice: '004567890000044', patente: '45678901',
        formeJuridique: 'SARL', registreCommerce: 'RC-45678', villeRC: 'Marrakech',
        adresse: '23 Rue Semlalia', ville: 'Marrakech', codePostal: '40000',
        provincePrefecture: 'Marrakech-Safi',
        telephone: '+212 524 00 00 04', gsm: '+212 603 00 00 04',
        email: 'info@baticonseil.ma',
        langueCommunication: 'francais',
        conditionsPaiement: 'Fin de mois', modeReglementPrefere: 'effet',
        seuilCredit: 20000, categorie: 'PME',
        statut: 'actif', regimeFiscal: 'reel_simplifie', tauxTva: 'taux_20',
        balance: 3400, creditLimit: 20000, paymentTerms: 'Fin de mois',
        caTotalHT: 95000, nbCommandes: 8, panierMoyen: 11875,
        datePremierAchat: new Date('2024-01-10'), dateDernierAchat: new Date('2025-01-05')
      }
    }),
    db.client.create({
      data: {
        code: 'CL-0005',
        name: 'AluTech GmbH',
        address: 'Zone Franche', city: 'Casablanca', postalCode: '20100', phone: '+212 522 00 00 05',
        raisonSociale: 'AluTech GmbH', ice: '005678901000055',
        formeJuridique: 'Autre', registreCommerce: 'RC-56789', villeRC: 'Casablanca',
        adresse: 'Zone Franche', ville: 'Casablanca', codePostal: '20100',
        provincePrefecture: 'Casablanca-Settat',
        telephone: '+212 522 00 00 05', gsm: '+212 604 00 00 05',
        email: 'order@alutech.ma',
        langueCommunication: 'anglais',
        conditionsPaiement: '60 jours', modeReglementPrefere: 'virement',
        seuilCredit: 100000, categorie: 'export',
        statut: 'actif', regimeFiscal: 'IS', tauxTva: 'exonere',
        incoterm: 'EXW', delaiLivraison: 14,
        balance: 25000, creditLimit: 100000, paymentTerms: '60 jours',
        caTotalHT: 520000, nbCommandes: 18, panierMoyen: 28889,
        datePremierAchat: new Date('2023-09-01'), dateDernierAchat: new Date('2025-02-01'),
        commentairesInternes: 'Client export - exonération TVA applicable'
      }
    }),
    db.client.create({
      data: {
        code: 'CL-0006',
        name: 'ElecDistrib SA', siret: '963 852 741 00055',
        address: '56 Avenue Hassan II', city: 'Fès', postalCode: '30000', phone: '+212 535 00 00 06',
        raisonSociale: 'ElecDistrib SA', ice: '006789012000066', patente: '56789012',
        formeJuridique: 'SA', registreCommerce: 'RC-67890', villeRC: 'Fès',
        adresse: '56 Avenue Hassan II', ville: 'Fès', codePostal: '30000',
        provincePrefecture: 'Fès-Meknès',
        telephone: '+212 535 00 00 06', gsm: '+212 605 00 00 06',
        email: 'commercial@elecdistrib.ma',
        langueCommunication: 'francais',
        conditionsPaiement: '30 jours', modeReglementPrefere: 'virement',
        seuilCredit: 40000, categorie: 'revendeur',
        statut: 'prospect', regimeFiscal: 'IS', tauxTva: 'taux_20',
        balance: 0, creditLimit: 40000, paymentTerms: '30 jours'
      }
    }),
  ])

  // ============ SUPPLIERS ============
  console.log('🚛 Creating suppliers...')
  const suppliers = await Promise.all([
    db.supplier.create({ data: { code: 'FR-0001', name: 'AcierPlus', siret: '111 222 333 00001', address: 'Zone Industrielle Est', city: 'Marseille', postalCode: '13000', phone: '04 91 00 00 01', email: 'ventes@acierplus.fr', deliveryDelay: 5, paymentTerms: '30 jours', rating: 4.5 } }),
    db.supplier.create({ data: { code: 'FR-0002', name: 'Plastiform SA', siret: '222 333 444 00002', address: '15 Rue des Matériaux', city: 'Lyon', postalCode: '69008', phone: '04 78 00 00 02', email: 'contact@plastiform.fr', deliveryDelay: 3, paymentTerms: '15 jours', rating: 4.8 } }),
    db.supplier.create({ data: { code: 'FR-0003', name: 'ElectroSupply', siret: '333 444 555 00003', address: '8 Chemin des Composants', city: 'Grenoble', postalCode: '38000', phone: '04 76 00 00 03', email: 'order@electrosupply.fr', deliveryDelay: 7, paymentTerms: '45 jours', rating: 3.9 } }),
    db.supplier.create({ data: { code: 'FR-0004', name: 'VisseriePro', siret: '444 555 666 00004', address: '90 Route du Boulon', city: 'Clermont-Ferrand', postalCode: '63000', phone: '04 73 00 00 04', email: 'pro@visseriepro.fr', deliveryDelay: 2, paymentTerms: '30 jours', rating: 4.2 } }),
    db.supplier.create({ data: { code: 'FR-0005', name: 'PeintureMax', siret: '555 666 777 00005', address: '33 Allée des Peintures', city: 'Valence', postalCode: '26000', phone: '04 75 00 00 05', email: 'contact@peinturemax.fr', deliveryDelay: 4, paymentTerms: '30 jours', rating: 4.0 } }),
  ])

  // ============ PRODUCTS ============
  console.log('📦 Creating products...')
  const products = await Promise.all([
    // Raw materials
    db.product.create({ data: { reference: 'MP-001', designation: 'Tôle acier 2mm', description: 'Tôle d\'acier laminé à froid, épaisseur 2mm', priceHT: 45.00, tvaRate: 20, unit: 'kg', productType: 'achat', currentStock: 2500, minStock: 500, maxStock: 5000, averageCost: 42.50, isActive: true } }),
    db.product.create({ data: { reference: 'MP-002', designation: 'Aluminium 6061 barre 30mm', description: 'Barre cylindrique en alliage aluminium 6061', priceHT: 18.50, tvaRate: 20, unit: 'm', productType: 'achat', currentStock: 800, minStock: 200, maxStock: 2000, averageCost: 16.00, isActive: true } }),
    db.product.create({ data: { reference: 'MP-003', designation: 'Polycarbonate transparent 5mm', description: 'Plaque polycarbonate transparent, épaisseur 5mm', priceHT: 32.00, tvaRate: 20, unit: 'm²', productType: 'achat', currentStock: 150, minStock: 50, maxStock: 500, averageCost: 28.50, isActive: true } }),
    db.product.create({ data: { reference: 'MP-004', designation: 'Visserie M8 inox lot 100', description: 'Lot de 100 vis M8x40 en acier inox A2', priceHT: 12.80, tvaRate: 20, unit: 'lot', productType: 'achat', currentStock: 300, minStock: 100, maxStock: 1000, averageCost: 11.00, isActive: true } }),
    db.product.create({ data: { reference: 'MP-005', designation: 'Peinture époxy gris RAL 7001', description: 'Peinture époxy industrielle 2 composants', priceHT: 85.00, tvaRate: 20, unit: 'kg', productType: 'achat', currentStock: 80, minStock: 30, maxStock: 200, averageCost: 78.00, isActive: true } }),
    db.product.create({ data: { reference: 'MP-006', designation: 'Câble électrique 2.5mm²', description: 'Câble cuivre rigide, section 2.5mm²', priceHT: 3.50, tvaRate: 20, unit: 'm', productType: 'achat', currentStock: 5000, minStock: 1000, maxStock: 10000, averageCost: 3.20, isActive: true } }),
    db.product.create({ data: { reference: 'MP-007', designation: 'Joint torique NBR 50mm', description: 'Joint torique Nitrile, diamètre intérieur 50mm', priceHT: 2.40, tvaRate: 20, unit: 'pièce', productType: 'achat', currentStock: 0, minStock: 100, maxStock: 500, averageCost: 2.00, isActive: true } }),
    db.product.create({ data: { reference: 'MP-008', designation: 'Rondelle M10 inox lot 50', description: 'Lot de 50 rondelles M10 en acier inox', priceHT: 5.50, tvaRate: 20, unit: 'lot', productType: 'achat', currentStock: 50, minStock: 50, maxStock: 300, averageCost: 4.80, isActive: true } }),

    // Semi-finished products
    db.product.create({ data: { reference: 'SF-001', designation: 'Châssis soudé type A', description: 'Châssis en tôle acier soudé, dimensions 600x400mm', priceHT: 120.00, tvaRate: 20, unit: 'pièce', productType: 'semi_fini', currentStock: 25, minStock: 10, maxStock: 100, averageCost: 95.00, isActive: true } }),
    db.product.create({ data: { reference: 'SF-002', designation: 'Panneau aluminium usiné', description: 'Panneau en aluminium usiné CNC, dimensions 300x200mm', priceHT: 85.00, tvaRate: 20, unit: 'pièce', productType: 'semi_fini', currentStock: 15, minStock: 5, maxStock: 50, averageCost: 65.00, isActive: true } }),
    db.product.create({ data: { reference: 'SF-003', designation: 'Armoire électrique câblée', description: 'Armoire de distribution avec câblage basique', priceHT: 450.00, tvaRate: 20, unit: 'pièce', productType: 'semi_fini', currentStock: 8, minStock: 3, maxStock: 20, averageCost: 380.00, isActive: true } }),

    // Finished products
    db.product.create({ data: { reference: 'PF-001', designation: 'Armoire industrielle modulable', description: 'Armoire de rangement industriel 5 niveaux, capacité 500kg/niveau', priceHT: 850.00, tvaRate: 20, unit: 'pièce', productType: 'vente', currentStock: 12, minStock: 5, maxStock: 50, averageCost: 620.00, isActive: true } }),
    db.product.create({ data: { reference: 'PF-002', designation: 'Banc de travail technique', description: 'Banc de travail avec établi, éclairage LED et prises intégrées', priceHT: 1250.00, tvaRate: 20, unit: 'pièce', productType: 'vente', currentStock: 5, minStock: 3, maxStock: 20, averageCost: 980.00, isActive: true } }),
    db.product.create({ data: { reference: 'PF-003', designation: 'Tablette de protection polycarbonate', description: 'Tablette de protection transparente pour poste de travail', priceHT: 280.00, tvaRate: 20, unit: 'pièce', productType: 'vente', currentStock: 20, minStock: 10, maxStock: 100, averageCost: 195.00, isActive: true } }),
    db.product.create({ data: { reference: 'PF-004', designation: 'Étagère lourde charge 1000kg', description: 'Étagère métallique 5 niveaux, charge 1000kg/ niveau', priceHT: 680.00, tvaRate: 20, unit: 'pièce', productType: 'vente', currentStock: 8, minStock: 3, maxStock: 30, averageCost: 490.00, isActive: true } }),
    db.product.create({ data: { reference: 'PF-005', designation: 'Coffret électrique IP65', description: 'Coffret de distribution IP65, 12 modules', priceHT: 320.00, tvaRate: 20, unit: 'pièce', productType: 'vente', currentStock: 18, minStock: 5, maxStock: 60, averageCost: 230.00, isActive: true } }),
    db.product.create({ data: { reference: 'PF-006', designation: 'Chariot atelier 3 plateaux', description: 'Chariot de manutention atelier avec 3 plateaux', priceHT: 450.00, tvaRate: 20, unit: 'pièce', productType: 'vente', currentStock: 0, minStock: 5, maxStock: 25, averageCost: 340.00, isActive: true } }),
  ])

  const productMap = new Map(products.map(p => [p.reference, p]))

  // ============ WORKSTATIONS ============
  console.log('🔧 Creating workstations...')
  const workstations = await Promise.all([
    db.workStation.create({ data: { name: 'Coupe laser', description: 'Machine de découpe laser CNC', efficiency: 95 } }),
    db.workStation.create({ data: { name: 'Pliage CNC', description: 'Presse plieuse CNC 100 tonnes', efficiency: 90 } }),
    db.workStation.create({ data: { name: 'Soudure TIG/MIG', description: 'Poste de soudure TIG et MIG', efficiency: 85 } }),
    db.workStation.create({ data: { name: 'Usinage CNC', description: 'Centre d\'usinage CNC 5 axes', efficiency: 92 } }),
    db.workStation.create({ data: { name: 'Peinture cabine', description: 'Cabine de peinture avec séchoir', efficiency: 88 } }),
    db.workStation.create({ data: { name: 'Assemblage', description: 'Poste d\'assemblage mécanique', efficiency: 100 } }),
    db.workStation.create({ data: { name: 'Câblage électrique', description: 'Poste de câblage et test électrique', efficiency: 95 } }),
    db.workStation.create({ data: { name: 'Emballage', description: 'Zone d\'emballage et expédition', efficiency: 100 } }),
  ])

  // ============ BOM (Bill of Materials) ============
  console.log('📋 Creating BOMs...')
  // PF-001: Armoire industrielle → SF-001 (1), MP-005 (2kg), MP-004 (4 lots)
  if (productMap.has('PF-001') && productMap.has('SF-001')) {
    await db.bomComponent.createMany({
      data: [
        { bomId: productMap.get('PF-001')!.id, componentId: productMap.get('SF-001')!.id, quantity: 1, notes: 'Châssis principal' },
        { bomId: productMap.get('PF-001')!.id, componentId: productMap.get('MP-005')!.id, quantity: 2, notes: 'Peinture finition' },
        { bomId: productMap.get('PF-001')!.id, componentId: productMap.get('MP-004')!.id, quantity: 4, notes: 'Fixations' },
      ]
    })
  }

  // PF-002: Banc de travail → SF-001 (1), SF-003 (1), MP-006 (5m), MP-002 (2m)
  if (productMap.has('PF-002') && productMap.has('SF-001') && productMap.has('SF-003')) {
    await db.bomComponent.createMany({
      data: [
        { bomId: productMap.get('PF-002')!.id, componentId: productMap.get('SF-001')!.id, quantity: 1, notes: 'Structure' },
        { bomId: productMap.get('PF-002')!.id, componentId: productMap.get('SF-003')!.id, quantity: 1, notes: 'Partie électrique' },
        { bomId: productMap.get('PF-002')!.id, componentId: productMap.get('MP-006')!.id, quantity: 5, notes: 'Câblage éclairage' },
        { bomId: productMap.get('PF-002')!.id, componentId: productMap.get('MP-002')!.id, quantity: 2, notes: 'Renfort aluminium' },
        { bomId: productMap.get('PF-002')!.id, componentId: productMap.get('MP-005')!.id, quantity: 1.5, notes: 'Peinture' },
      ]
    })
  }

  // PF-003: Tablette protection → MP-003 (0.5m²), MP-001 (1kg)
  if (productMap.has('PF-003') && productMap.has('MP-003')) {
    await db.bomComponent.createMany({
      data: [
        { bomId: productMap.get('PF-003')!.id, componentId: productMap.get('MP-003')!.id, quantity: 0.5, notes: 'Panneau polycarbonate' },
        { bomId: productMap.get('PF-003')!.id, componentId: productMap.get('MP-001')!.id, quantity: 1, notes: 'Support acier' },
      ]
    })
  }

  // PF-004: Étagère lourde charge → MP-001 (8kg), MP-004 (8 lots), MP-005 (1kg)
  if (productMap.has('PF-004')) {
    await db.bomComponent.createMany({
      data: [
        { bomId: productMap.get('PF-004')!.id, componentId: productMap.get('MP-001')!.id, quantity: 8, notes: 'Tôles étagères' },
        { bomId: productMap.get('PF-004')!.id, componentId: productMap.get('MP-004')!.id, quantity: 8, notes: 'Boulonnerie' },
        { bomId: productMap.get('PF-004')!.id, componentId: productMap.get('MP-005')!.id, quantity: 1, notes: 'Peinture' },
      ]
    })
  }

  // PF-005: Coffret électrique → SF-003 (1), MP-006 (3m), MP-007 (5), MP-002 (0.5m)
  if (productMap.has('PF-005') && productMap.has('SF-003')) {
    await db.bomComponent.createMany({
      data: [
        { bomId: productMap.get('PF-005')!.id, componentId: productMap.get('SF-003')!.id, quantity: 1, notes: 'Armoire câblée' },
        { bomId: productMap.get('PF-005')!.id, componentId: productMap.get('MP-006')!.id, quantity: 3, notes: 'Câblage' },
        { bomId: productMap.get('PF-005')!.id, componentId: productMap.get('MP-007')!.id, quantity: 5, notes: 'Joints étanchéité' },
        { bomId: productMap.get('PF-005')!.id, componentId: productMap.get('MP-002')!.id, quantity: 0.5, notes: 'Accessoires' },
      ]
    })
  }

  // ============ ROUTINGS ============
  console.log('🗺️  Creating routings...')
  // PF-001 routing
  if (productMap.has('PF-001')) {
    await db.routingStep.createMany({
      data: [
        { productId: productMap.get('PF-001')!.id, workStationId: workstations[0].id, stepOrder: 1, duration: 30, description: 'Découpe châssis' },
        { productId: productMap.get('PF-001')!.id, workStationId: workstations[1].id, stepOrder: 2, duration: 20, description: 'Pliage montants' },
        { productId: productMap.get('PF-001')!.id, workStationId: workstations[2].id, stepOrder: 3, duration: 60, description: 'Soudage châssis' },
        { productId: productMap.get('PF-001')!.id, workStationId: workstations[4].id, stepOrder: 4, duration: 45, description: 'Peinture' },
        { productId: productMap.get('PF-001')!.id, workStationId: workstations[5].id, stepOrder: 5, duration: 30, description: 'Assemblage final' },
      ]
    })
  }

  // PF-002 routing
  if (productMap.has('PF-002')) {
    await db.routingStep.createMany({
      data: [
        { productId: productMap.get('PF-002')!.id, workStationId: workstations[0].id, stepOrder: 1, duration: 45, description: 'Découpe laser structure' },
        { productId: productMap.get('PF-002')!.id, workStationId: workstations[1].id, stepOrder: 2, duration: 30, description: 'Pliage' },
        { productId: productMap.get('PF-002')!.id, workStationId: workstations[2].id, stepOrder: 3, duration: 90, description: 'Soudage complet' },
        { productId: productMap.get('PF-002')!.id, workStationId: workstations[6].id, stepOrder: 4, duration: 120, description: 'Câblage électrique' },
        { productId: productMap.get('PF-002')!.id, workStationId: workstations[4].id, stepOrder: 5, duration: 60, description: 'Peinture et séchage' },
        { productId: productMap.get('PF-002')!.id, workStationId: workstations[5].id, stepOrder: 6, duration: 60, description: 'Assemblage' },
      ]
    })
  }

  // ============ QUOTES ============
  console.log('📝 Creating quotes...')
  const quotes = await Promise.all([
    // Quote 1 - accepted
    db.quote.create({
      data: {
        number: 'DEV-2025-0001',
        clientId: clients[0].id,
        status: 'accepted',
        date: new Date('2025-01-10'),
        validUntil: new Date('2025-02-10'),
        discountRate: 5,
        shippingCost: 45,
        notes: 'Commande récurrente - client fidèle',
        totalHT: 2682.50,
        totalTVA: 512.70,
        totalTTC: 3195.20,
        lines: {
          create: [
            { productId: productMap.get('PF-001')!.id, quantity: 3, unitPrice: 850, tvaRate: 20, totalHT: 2550, discount: 0 },
            { productId: productMap.get('PF-003')!.id, quantity: 2, unitPrice: 280, tvaRate: 20, totalHT: 560, discount: 0 },
          ]
        }
      }
    }),
    // Quote 2 - sent
    db.quote.create({
      data: {
        number: 'DEV-2025-0002',
        clientId: clients[1].id,
        status: 'sent',
        date: new Date('2025-01-15'),
        validUntil: new Date('2025-02-15'),
        discountRate: 0,
        shippingCost: 0,
        totalHT: 2450,
        totalTVA: 490,
        totalTTC: 2940,
        lines: {
          create: [
            { productId: productMap.get('PF-002')!.id, quantity: 1, unitPrice: 1250, tvaRate: 20, totalHT: 1250, discount: 0 },
            { productId: productMap.get('PF-005')!.id, quantity: 2, unitPrice: 320, tvaRate: 20, totalHT: 640, discount: 0 },
            { productId: productMap.get('PF-004')!.id, quantity: 1, unitPrice: 680, tvaRate: 20, totalHT: 680, discount: 0 },
          ]
        }
      }
    }),
    // Quote 3 - accepted
    db.quote.create({
      data: {
        number: 'DEV-2025-0003',
        clientId: clients[2].id,
        status: 'accepted',
        date: new Date('2025-01-20'),
        validUntil: new Date('2025-02-20'),
        discountRate: 10,
        shippingCost: 85,
        notes: 'Remise volume - grande commande',
        totalHT: 2547,
        totalTVA: 509.40,
        totalTTC: 3056.40,
        lines: {
          create: [
            { productId: productMap.get('PF-005')!.id, quantity: 5, unitPrice: 320, tvaRate: 20, totalHT: 1600, discount: 10 },
            { productId: productMap.get('PF-003')!.id, quantity: 3, unitPrice: 280, tvaRate: 20, totalHT: 756, discount: 10 },
            { productId: productMap.get('PF-004')!.id, quantity: 2, unitPrice: 680, tvaRate: 20, totalHT: 1360, discount: 0 },
          ]
        }
      }
    }),
    // Quote 4 - draft
    db.quote.create({
      data: {
        number: 'DEV-2025-0004',
        clientId: clients[3].id,
        status: 'draft',
        date: new Date('2025-02-01'),
        validUntil: new Date('2025-03-03'),
        totalHT: 1530,
        totalTVA: 306,
        totalTTC: 1836,
        lines: {
          create: [
            { productId: productMap.get('PF-001')!.id, quantity: 1, unitPrice: 850, tvaRate: 20, totalHT: 850, discount: 0 },
            { productId: productMap.get('PF-006')!.id, quantity: 1, unitPrice: 450, tvaRate: 20, totalHT: 450, discount: 0 },
            { productId: productMap.get('PF-005')!.id, quantity: 1, unitPrice: 320, tvaRate: 20, totalHT: 320, discount: 0 },
          ]
        }
      }
    }),
    // Quote 5 - expired
    db.quote.create({
      data: {
        number: 'DEV-2024-0015',
        clientId: clients[4].id,
        status: 'expired',
        date: new Date('2024-11-01'),
        validUntil: new Date('2024-12-01'),
        totalHT: 6800,
        totalTVA: 1360,
        totalTTC: 8160,
        notes: 'Client allemand - offre expirée',
        lines: {
          create: [
            { productId: productMap.get('PF-002')!.id, quantity: 4, unitPrice: 1250, tvaRate: 20, totalHT: 5000, discount: 0 },
            { productId: productMap.get('PF-001')!.id, quantity: 2, unitPrice: 850, tvaRate: 20, totalHT: 1700, discount: 0 },
          ]
        }
      }
    }),
  ])

  // ============ SALES ORDERS ============
  console.log('🛒 Creating sales orders...')
  const salesOrders = await Promise.all([
    db.salesOrder.create({
      data: {
        number: 'BC-2025-0001',
        quoteId: quotes[0].id,
        clientId: clients[0].id,
        status: 'delivered',
        date: new Date('2025-01-12'),
        deliveryDate: new Date('2025-01-25'),
        totalHT: 2682.50,
        totalTVA: 512.70,
        totalTTC: 3195.20,
        notes: 'Livraison express demandée',
        lines: {
          create: [
            { productId: productMap.get('PF-001')!.id, quantity: 3, unitPrice: 850, tvaRate: 20, totalHT: 2550, quantityPrepared: 3 },
            { productId: productMap.get('PF-003')!.id, quantity: 2, unitPrice: 280, tvaRate: 20, totalHT: 560, quantityPrepared: 2 },
          ]
        }
      }
    }),
    db.salesOrder.create({
      data: {
        number: 'BC-2025-0002',
        quoteId: quotes[2].id,
        clientId: clients[2].id,
        status: 'in_preparation',
        date: new Date('2025-01-22'),
        totalHT: 2547,
        totalTVA: 509.40,
        totalTTC: 3056.40,
        lines: {
          create: [
            { productId: productMap.get('PF-005')!.id, quantity: 5, unitPrice: 320, tvaRate: 20, totalHT: 1600, quantityPrepared: 2 },
            { productId: productMap.get('PF-003')!.id, quantity: 3, unitPrice: 280, tvaRate: 20, totalHT: 756, quantityPrepared: 0 },
            { productId: productMap.get('PF-004')!.id, quantity: 2, unitPrice: 680, tvaRate: 20, totalHT: 1360, quantityPrepared: 0 },
          ]
        }
      }
    }),
    db.salesOrder.create({
      data: {
        number: 'BC-2025-0003',
        clientId: clients[4].id,
        status: 'confirmed',
        date: new Date('2025-02-01'),
        totalHT: 4250,
        totalTVA: 850,
        totalTTC: 5100,
        lines: {
          create: [
            { productId: productMap.get('PF-002')!.id, quantity: 2, unitPrice: 1250, tvaRate: 20, totalHT: 2500, quantityPrepared: 0 },
            { productId: productMap.get('PF-001')!.id, quantity: 2, unitPrice: 850, tvaRate: 20, totalHT: 1700, quantityPrepared: 0 },
          ]
        }
      }
    }),
  ])

  // ============ INVOICES ============
  console.log('🧾 Creating invoices...')
  await Promise.all([
    db.invoice.create({
      data: {
        number: 'FAC-202501-0001',
        salesOrderId: salesOrders[0].id,
        clientId: clients[0].id,
        status: 'paid',
        date: new Date('2025-01-25'),
        dueDate: new Date('2025-02-25'),
        paymentDate: new Date('2025-02-15'),
        discountRate: 5,
        shippingCost: 45,
        totalHT: 2682.50,
        totalTVA: 512.70,
        totalTTC: 3195.20,
        lines: {
          create: [
            { productId: productMap.get('PF-001')!.id, quantity: 3, unitPrice: 850, tvaRate: 20, totalHT: 2550 },
            { productId: productMap.get('PF-003')!.id, quantity: 2, unitPrice: 280, tvaRate: 20, totalHT: 560 },
          ]
        }
      }
    }),
    db.invoice.create({
      data: {
        number: 'FAC-202501-0002',
        clientId: clients[5].id,
        status: 'sent',
        date: new Date('2025-01-15'),
        dueDate: new Date('2025-02-15'),
        totalHT: 1250,
        totalTVA: 250,
        totalTTC: 1500,
        lines: {
          create: [
            { productId: productMap.get('PF-002')!.id, quantity: 1, unitPrice: 1250, tvaRate: 20, totalHT: 1250 },
          ]
        }
      }
    }),
    db.invoice.create({
      data: {
        number: 'FAC-202502-0001',
        clientId: clients[1].id,
        status: 'overdue',
        date: new Date('2024-12-01'),
        dueDate: new Date('2025-01-15'),
        totalHT: 3400,
        totalTVA: 680,
        totalTTC: 4080,
        lines: {
          create: [
            { productId: productMap.get('PF-004')!.id, quantity: 5, unitPrice: 680, tvaRate: 20, totalHT: 3400 },
          ]
        }
      }
    }),
  ])

  // ============ PURCHASE ORDERS ============
  console.log('📥 Creating purchase orders...')
  await Promise.all([
    db.purchaseOrder.create({
      data: {
        number: 'ACH-2025-0001',
        supplierId: suppliers[0].id,
        status: 'received',
        date: new Date('2025-01-05'),
        expectedDate: new Date('2025-01-12'),
        notes: 'Commande mensuelle tôle',
        totalHT: 5000,
        totalTVA: 1000,
        totalTTC: 6000,
        lines: {
          create: [
            { productId: productMap.get('MP-001')!.id, quantity: 100, unitPrice: 45, tvaRate: 20, totalHT: 4500, quantityReceived: 100 },
            { productId: productMap.get('MP-005')!.id, quantity: 10, unitPrice: 85, tvaRate: 20, totalHT: 850, quantityReceived: 10 },
          ]
        }
      }
    }),
    db.purchaseOrder.create({
      data: {
        number: 'ACH-2025-0002',
        supplierId: suppliers[1].id,
        status: 'sent',
        date: new Date('2025-01-20'),
        expectedDate: new Date('2025-01-25'),
        totalHT: 3250,
        totalTVA: 650,
        totalTTC: 3900,
        lines: {
          create: [
            { productId: productMap.get('MP-003')!.id, quantity: 80, unitPrice: 32, tvaRate: 20, totalHT: 2560, quantityReceived: 0 },
            { productId: productMap.get('MP-008')!.id, quantity: 50, unitPrice: 5.50, tvaRate: 20, totalHT: 275, quantityReceived: 0 },
            { productId: productMap.get('MP-007')!.id, quantity: 200, unitPrice: 2.40, tvaRate: 20, totalHT: 480, quantityReceived: 0 },
          ]
        }
      }
    }),
    db.purchaseOrder.create({
      data: {
        number: 'ACH-2025-0003',
        supplierId: suppliers[2].id,
        status: 'draft',
        date: new Date('2025-02-01'),
        expectedDate: new Date('2025-02-10'),
        totalHT: 1050,
        totalTVA: 210,
        totalTTC: 1260,
        lines: {
          create: [
            { productId: productMap.get('MP-006')!.id, quantity: 300, unitPrice: 3.50, tvaRate: 20, totalHT: 1050, quantityReceived: 0 },
          ]
        }
      }
    }),
  ])

  // ============ STOCK MOVEMENTS ============
  console.log('📊 Creating stock movements...')
  await db.stockMovement.createMany({
    data: [
      { productId: productMap.get('MP-001')!.id, type: 'in', origin: 'purchase_reception', quantity: 100, unitCost: 45, documentRef: 'ACH-2025-0001', notes: 'Réception tôle acier' },
      { productId: productMap.get('MP-005')!.id, type: 'in', origin: 'purchase_reception', quantity: 10, unitCost: 85, documentRef: 'ACH-2025-0001', notes: 'Réception peinture' },
      { productId: productMap.get('PF-001')!.id, type: 'in', origin: 'production_output', quantity: 3, unitCost: 620, documentRef: 'OF-2025-001', notes: 'Fabrication armoires' },
      { productId: productMap.get('PF-003')!.id, type: 'in', origin: 'production_output', quantity: 2, unitCost: 195, documentRef: 'OF-2025-002', notes: 'Fabrication tablettes' },
      { productId: productMap.get('PF-001')!.id, type: 'out', origin: 'sale', quantity: 3, unitCost: 620, documentRef: 'BC-2025-0001', notes: 'Vente TechnoMat' },
      { productId: productMap.get('PF-003')!.id, type: 'out', origin: 'sale', quantity: 2, unitCost: 195, documentRef: 'BC-2025-0001', notes: 'Vente TechnoMat' },
      { productId: productMap.get('MP-001')!.id, type: 'out', origin: 'production_input', quantity: 8, unitCost: 45, documentRef: 'OF-2025-001', notes: 'Consommation pour production' },
    ]
  })

  // ============ WORK ORDERS ============
  console.log('🏭 Creating work orders...')
  await Promise.all([
    db.workOrder.create({
      data: {
        number: 'OF-2025-001',
        productId: productMap.get('PF-001')!.id,
        quantity: 3,
        status: 'closed',
        plannedDate: new Date('2025-01-15'),
        startedAt: new Date('2025-01-15'),
        completedAt: new Date('2025-01-22'),
        closedAt: new Date('2025-01-22'),
        goodQuantity: 3,
        scrapQuantity: 0,
        totalCost: 1860,
        steps: {
          create: [
            { stepOrder: 1, description: 'Découpe châssis', workStationId: workstations[0].id, duration: 30, actualDuration: 28, status: 'completed', startedAt: new Date('2025-01-15T08:00:00'), completedAt: new Date('2025-01-15T08:30:00'), goodQuantity: 3 },
            { stepOrder: 2, description: 'Pliage montants', workStationId: workstations[1].id, duration: 20, actualDuration: 22, status: 'completed', startedAt: new Date('2025-01-15T09:00:00'), completedAt: new Date('2025-01-15T09:25:00'), goodQuantity: 3 },
            { stepOrder: 3, description: 'Soudage châssis', workStationId: workstations[2].id, duration: 60, actualDuration: 55, status: 'completed', startedAt: new Date('2025-01-16T08:00:00'), completedAt: new Date('2025-01-16T09:00:00'), goodQuantity: 3 },
            { stepOrder: 4, description: 'Peinture', workStationId: workstations[4].id, duration: 45, actualDuration: 45, status: 'completed', startedAt: new Date('2025-01-17T08:00:00'), completedAt: new Date('2025-01-17T08:50:00'), goodQuantity: 3 },
            { stepOrder: 5, description: 'Assemblage final', workStationId: workstations[5].id, duration: 30, actualDuration: 25, status: 'completed', startedAt: new Date('2025-01-18T08:00:00'), completedAt: new Date('2025-01-18T08:30:00'), goodQuantity: 3 },
          ]
        }
      }
    }),
    db.workOrder.create({
      data: {
        number: 'OF-2025-002',
        productId: productMap.get('PF-003')!.id,
        quantity: 5,
        status: 'completed',
        plannedDate: new Date('2025-01-18'),
        startedAt: new Date('2025-01-18'),
        completedAt: new Date('2025-01-20'),
        goodQuantity: 5,
        scrapQuantity: 0,
        totalCost: 975,
        notes: 'Fabrication tablettes protection'
      }
    }),
    db.workOrder.create({
      data: {
        number: 'OF-2025-003',
        productId: productMap.get('PF-002')!.id,
        quantity: 2,
        status: 'in_progress',
        plannedDate: new Date('2025-02-05'),
        startedAt: new Date('2025-02-05'),
        goodQuantity: 0,
        scrapQuantity: 0,
        totalCost: 0,
        notes: 'Commande AluTech - priorité haute'
      }
    }),
    db.workOrder.create({
      data: {
        number: 'OF-2025-004',
        productId: productMap.get('PF-005')!.id,
        quantity: 5,
        status: 'planned',
        plannedDate: new Date('2025-02-10'),
        goodQuantity: 0,
        scrapQuantity: 0,
        totalCost: 0,
        notes: 'Pour commande AutoParts'
      }
    }),
    db.workOrder.create({
      data: {
        number: 'OF-2025-005',
        productId: productMap.get('PF-006')!.id,
        quantity: 3,
        status: 'draft',
        goodQuantity: 0,
        scrapQuantity: 0,
        totalCost: 0,
        notes: 'Stock rupturé - besoin urgent'
      }
    }),
  ])

  // ============ CASH & BANK ============
  console.log('🏦 Creating financial data...')
  const cashRegister = await db.cashRegister.create({
    data: { name: 'Caisse principale', description: 'Caisse au siège', balance: 3500, minBalance: 500 }
  })

  const bankAccount = await db.bankAccount.create({
    data: { name: 'BNP Paribas - Compte courant', iban: 'FR76 3000 4000 0100 0000 0123 456', bic: 'BNPAFRPP', balance: 85400 }
  })

  await Promise.all([
    db.cashMovement.createMany({
      data: [
        { cashRegisterId: cashRegister.id, type: 'in', amount: 5000, paymentMethod: 'espèces', notes: 'Fonds initial', createdAt: new Date('2025-01-01') },
        { cashRegisterId: cashRegister.id, type: 'out', amount: 250, paymentMethod: 'espèces', notes: 'Achat petit matériel', createdAt: new Date('2025-01-10') },
        { cashRegisterId: cashRegister.id, type: 'out', amount: 180, paymentMethod: 'espèces', notes: 'Fournitures bureau', createdAt: new Date('2025-01-15') },
        { cashRegisterId: cashRegister.id, type: 'in', amount: 750, paymentMethod: 'espèces', reference: 'FAC-202501-0001', notes: 'Règlement partiel', createdAt: new Date('2025-02-01') },
        { cashRegisterId: cashRegister.id, type: 'out', amount: 120, paymentMethod: 'espèces', notes: 'Courses ménagères atelier', createdAt: new Date('2025-02-03') },
      ]
    }),
    db.bankTransaction.createMany({
      data: [
        { bankAccountId: bankAccount.id, date: new Date('2025-01-02'), label: 'Virement client TechnoMat', amount: 3195.20, reference: 'VIR-TM-001', isReconciled: true, reconciledWith: 'FAC-202501-0001' },
        { bankAccountId: bankAccount.id, date: new Date('2025-01-08'), label: 'Prélèvement RADEEMA', amount: -1250, reference: 'PRL-RAD-001', isReconciled: true, reconciledWith: 'Fournisseur' },
        { bankAccountId: bankAccount.id, date: new Date('2025-01-15'), label: 'Virement fournisseur AcierPlus', amount: -6000, reference: 'VIR-AP-001', isReconciled: true, reconciledWith: 'ACH-2025-0001' },
        { bankAccountId: bankAccount.id, date: new Date('2025-01-20'), label: 'Virement client ElecDistrib', amount: 1500, reference: 'VIR-ED-001', isReconciled: false },
        { bankAccountId: bankAccount.id, date: new Date('2025-02-01'), label: 'Salaires janvier', amount: -28500, reference: 'VIR-SAL-0125', isReconciled: true, reconciledWith: 'Salaires' },
        { bankAccountId: bankAccount.id, date: new Date('2025-02-05'), label: 'Loyer atelier', amount: -3500, reference: 'PRL-LOY-0225', isReconciled: true, reconciledWith: 'Loyer' },
      ]
    }),
  ])

  // ============ ACCOUNTING ENTRIES ============
  console.log('📒 Creating accounting entries...')
  await db.accountingEntry.createMany({
    data: [
      // Invoice FAC-202501-0001 - TechnoMat (paid)
      { date: new Date('2025-01-25'), label: 'Facture FAC-202501-0001 - Client TechnoMat', account: '411000', debit: 3195.20, credit: 0, documentRef: 'FAC-202501-0001' },
      { date: new Date('2025-01-25'), label: 'Facture FAC-202501-0001 - Ventes', account: '706000', debit: 0, credit: 2682.50, documentRef: 'FAC-202501-0001' },
      { date: new Date('2025-01-25'), label: 'Facture FAC-202501-0001 - TVA collectée', account: '445710', debit: 0, credit: 512.70, documentRef: 'FAC-202501-0001' },
      // Payment for FAC-202501-0001
      { date: new Date('2025-02-15'), label: 'Paiement FAC-202501-0001', account: '512000', debit: 3195.20, credit: 0, documentRef: 'PAY-001' },
      { date: new Date('2025-02-15'), label: 'Paiement client TechnoMat', account: '411000', debit: 0, credit: 3195.20, documentRef: 'PAY-001' },
      // Purchase order ACH-2025-0001
      { date: new Date('2025-01-12'), label: 'Réception ACH-2025-0001 - AcierPlus', account: '601000', debit: 5000, credit: 0, documentRef: 'ACH-2025-0001' },
      { date: new Date('2025-01-12'), label: 'TVA déductible ACH-2025-0001', account: '445660', debit: 1000, credit: 0, documentRef: 'ACH-2025-0001' },
      { date: new Date('2025-01-12'), label: 'Fournisseur AcierPlus', account: '401000', debit: 0, credit: 6000, documentRef: 'ACH-2025-0001' },
      // Expenses
      { date: new Date('2025-01-08'), label: 'Charges RADEEMA', account: '601000', debit: 1041.67, credit: 0, documentRef: 'RAD-001' },
      { date: new Date('2025-01-08'), label: 'TVA RADEEMA', account: '445660', debit: 208.33, credit: 0, documentRef: 'RAD-001' },
      { date: new Date('2025-01-08'), label: 'Fournisseur RADEEMA', account: '401000', debit: 0, credit: 1250, documentRef: 'RAD-001' },
      // Salaires
      { date: new Date('2025-02-01'), label: 'Salaires janvier', account: '641000', debit: 23750, credit: 0, documentRef: 'SAL-0125' },
      { date: new Date('2025-02-01'), label: 'Charges sociales salaires', account: '645000', debit: 4750, credit: 0, documentRef: 'SAL-0125' },
      { date: new Date('2025-02-01'), label: 'Banque - Salaires', account: '512000', debit: 0, credit: 28500, documentRef: 'SAL-0125' },
    ]
  })

  // ============ CREDIT NOTE ============
  console.log('🔄 Creating credit note...')
  const paidInvoice = await db.invoice.findFirst({ where: { number: 'FAC-202501-0001' }, include: { client: true, lines: true } })
  if (paidInvoice) {
    await db.creditNote.create({
      data: {
        number: 'AVO-2025-0001',
        invoiceId: paidInvoice.id,
        clientId: paidInvoice.clientId,
        status: 'draft',
        date: new Date('2025-02-05'),
        reason: 'Remise commerciale sur volume prochain',
        totalHT: 280,
        totalTVA: 56,
        totalTTC: 336,
        lines: {
          create: [
            { productId: productMap.get('PF-003')!.id, quantity: 1, unitPrice: 280, tvaRate: 20, totalHT: 280 },
          ]
        }
      }
    })
  }

  // ============ AUDIT LOGS ============
  console.log('📋 Creating audit logs...')
  if (adminUser) {
    await db.auditLog.createMany({
      data: [
        { userId: adminUser.id, action: 'create', entity: 'User', entityId: adminUser.id, newValues: JSON.stringify({ email: 'admin@gema-erp.com' }) },
        { userId: adminUser.id, action: 'create', entity: 'Client', entityId: clients[0].id, newValues: JSON.stringify({ name: 'TechnoMat SA' }) },
        { userId: adminUser.id, action: 'create', entity: 'Product', entityId: productMap.get('PF-001')?.id, newValues: JSON.stringify({ reference: 'PF-001' }) },
        { userId: commercialUser?.id || adminUser.id, action: 'create', entity: 'Quote', entityId: quotes[0].id, newValues: JSON.stringify({ number: 'DEV-2025-0001' }) },
        { userId: commercialUser?.id || adminUser.id, action: 'transform_to_sales_order', entity: 'Quote', entityId: quotes[0].id },
        { userId: prodManagerUser?.id || adminUser.id, action: 'create', entity: 'WorkOrder', entityId: 'OF-2025-001' },
        { userId: prodManagerUser?.id || adminUser.id, action: 'update', entity: 'WorkOrder', entityId: 'OF-2025-001', newValues: JSON.stringify({ status: 'closed' }) },
      ]
    })
  }

  console.log('\n✅ Seed completed successfully!')
  console.log('\n📋 Summary:')
  console.log(`  👤 Users: 9`)
  console.log(`  🏢 Clients: ${clients.length}`)
  console.log(`  🚛 Suppliers: ${suppliers.length}`)
  console.log(`  📦 Products: ${products.length}`)
  console.log(`  📝 Quotes: ${quotes.length}`)
  console.log(`  🛒 Sales Orders: ${salesOrders.length}`)
  console.log(`  📋 Invoices: 3`)
  console.log(`  🏭 Work Orders: 5`)
  console.log(`  🏦 Bank: 1 account, 6 transactions`)
  console.log(`  💰 Cash: 1 register, 5 movements`)
  console.log(`  📊 Stock Movements: 7`)
  console.log(`  📒 Accounting Entries: 13`)
  console.log('\n🔐 Login credentials:')
  console.log('  Admin: admin@gema-erp.com / admin123')
  console.log('  Others: {role}@gema-erp.com / pass123')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
