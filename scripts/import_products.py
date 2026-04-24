"""
Script d'import des produits depuis le fichier Excel vers l'ERP.
Usage: python3 import_products.py [ERP_BASE_URL]
"""
import pandas as pd
import requests
import sys
import json

EXCEL_FILE = '/home/z/my-project/upload/Table REQ_Liste_des_articles.xlsx'
DEFAULT_URL = 'https://erp-pro-khalid1966-lads-projects.vercel.app'
SUPER_ADMIN_EMAIL = 'contact@jazelwebagency.com'
SUPER_ADMIN_PASSWORD = 'hello@erp2026'

UNIT_MAP = {
    'U': 'unité',
    'M2': 'm²',
    'KG': 'kg',
    'M': 'mètre',
    'ML': 'mètre',
    'M3': 'm³',
    'L': 'litre',
    'T': 'tonne',
    'SAC': 'sac',
    'PQT': 'paquet',
    'Paquet': 'paquet',
    'V': 'unité',
    'JOUR': 'jour',
    'BIDON': 'bidon',
    'FORFAIT': 'forfait',
}

def determine_type(row):
    """Determine product type from Excel flags."""
    semi_fini = int(row[7])
    prod_fini = int(row[6])
    vente = int(row[1])
    achat = int(row[0])

    if semi_fini == 1:
        return 'semi_fini'
    if prod_fini == 1 or vente == 1:
        return 'vente'
    if achat == 1:
        return 'achat'
    # Default: achat
    return 'achat'

def clean_val(val):
    """Clean a string value: strip whitespace, convert NaN to None."""
    if pd.isna(val) or val is None:
        return None
    s = str(val).strip()
    if s == '' or s == 'nan' or s == 'NaN':
        return None
    return s

def safe_float(val, default=0.0):
    """Convert to float, return default on failure."""
    try:
        v = float(val)
        if pd.isna(v):
            return default
        return v
    except (ValueError, TypeError):
        return default

def safe_int(val, default=0):
    """Convert to int, return default on failure."""
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return default

def main():
    base_url = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_URL
    base_url = base_url.rstrip('/')

    print(f'📂 Lecture du fichier Excel...')
    df = pd.read_excel(EXCEL_FILE, header=None)
    data = df.iloc[1:].reset_index(drop=True)

    print(f'📊 {len(data)} lignes trouvées dans le fichier Excel')

    # Build products array
    products = []
    errors = []
    for idx, row in data.iterrows():
        code = clean_val(row[4])
        libelle = clean_val(row[5])

        if not code or not libelle:
            errors.append(f'Ligne {idx+2}: Code ou Libellé manquant')
            continue

        unit_raw = clean_val(row[12])
        unit = UNIT_MAP.get(unit_raw, unit_raw) if unit_raw else 'unité'

        product = {
            'reference': code,
            'designation': libelle,
            'famille': clean_val(row[14]),
            'sousFamille': clean_val(row[15]),
            'productType': determine_type(row),
            'priceHT': safe_float(row[21], 0),
            'tvaRate': 20,
            'unit': unit,
            'currentStock': safe_float(row[8], 0),
            'minStock': safe_float(row[9], 0),
            'maxStock': safe_float(row[11], 100),
            'averageCost': safe_float(row[20], 0),
            'isActive': int(row[3]) == 1,
        }
        products.append(product)

    print(f'✅ {len(products)} produits préparés pour import')
    if errors:
        print(f'⚠️  {len(errors)} erreurs (lignes ignorées):')
        for e in errors[:5]:
            print(f'   - {e}')
        if len(errors) > 5:
            print(f'   ... et {len(errors)-5} autres')

    # Stats
    types = {}
    for p in products:
        t = p['productType']
        types[t] = types.get(t, 0) + 1
    print(f'\n📋 Répartition par type:')
    for t, c in types.items():
        print(f'   {t}: {c}')

    active = sum(1 for p in products if p['isActive'])
    print(f'   Actifs: {active}, Inactifs: {len(products)-active}')

    # Login
    print(f'\n🔑 Connexion à {base_url}...')
    try:
        login_resp = requests.post(
            f'{base_url}/api/auth/login',
            json={'email': SUPER_ADMIN_EMAIL, 'password': SUPER_ADMIN_PASSWORD},
            timeout=30
        )
        if login_resp.status_code != 200:
            print(f'❌ Erreur de connexion: {login_resp.status_code} - {login_resp.text[:200]}')
            return
        token_data = login_resp.json()
        token = token_data['token']
        print(f'✅ Connecté en tant que {token_data["user"]["name"]}')
    except Exception as e:
        print(f'❌ Erreur de connexion: {e}')
        return

    # Import
    print(f'\n📦 Import de {len(products)} produits...')
    print(f'   (Cela peut prendre quelques minutes...)')

    try:
        import_resp = requests.post(
            f'{base_url}/api/products/bulk-import',
            headers={
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json',
            },
            json=products,
            timeout=300
        )
        result = import_resp.json()
        if import_resp.status_code == 200 and result.get('success'):
            print(f'\n✅ Import réussi !')
            print(f'   🗑️  {result["deleted"]} anciens produits supprimés')
            print(f'   📥 {result["imported"]} nouveaux produits importés')
        else:
            print(f'❌ Erreur import: {import_resp.status_code}')
            print(f'   {json.dumps(result, indent=2, ensure_ascii=False)[:500]}')
    except Exception as e:
        print(f'❌ Erreur lors de l\'import: {e}')

if __name__ == '__main__':
    main()
