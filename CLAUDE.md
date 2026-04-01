# CLAUDE.md — Leasy Immobilier

Contexte projet pour Claude Code. À lire en début de chaque session.

---

## Présentation

**Leasy Immobilier** est une application SaaS de gestion locative immobilière.
Elle permet à un propriétaire de gérer ses biens, locataires, paiements de loyer, quittances et documents administratifs (bail, état des lieux).

Répertoire : `/Users/landed/Documents/mon-app`

---

## Commandes

```bash
npm run dev      # Démarrage local (port 3000)
npm run build    # Build de production — toujours lancer pour valider
npm run lint     # Lint ESLint
npm run start    # Démarrage en mode production
```

**Règle : toujours lancer `npm run build` après chaque modification pour confirmer qu'il n'y a pas d'erreurs.**

---

## Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Framework | Next.js App Router | 14.2.35 |
| Langage | TypeScript | ^5.9 |
| Auth + DB + Storage | Supabase | @supabase/ssr ^0.9 |
| UI components | shadcn — basé sur **@base-ui/react** (PAS Radix UI) | ^1.3.0 |
| Styles | Tailwind CSS | ^3.4 |
| PDF | pdf-lib + @pdf-lib/fontkit | ^1.17 |
| Email | Resend | ^6.9 |
| Formulaires | react-hook-form + zod | ^7.71 / ^4.3 |
| Toasts | sonner | ^2.0 |
| Dates | date-fns + react-day-picker | ^4.1 / ^9.14 |
| Icônes | lucide-react | ^0.577 |

---

## Architecture des dossiers

```
src/
├── app/
│   ├── (dashboard)/              # Route group — layout avec Sidebar + Header
│   │   ├── layout.tsx            # Auth check + Sidebar + Header pour toutes les pages
│   │   ├── properties/
│   │   │   ├── page.tsx
│   │   │   └── loading.tsx       # Skeleton de chargement
│   │   ├── tenants/page.tsx + loading.tsx
│   │   ├── payments/page.tsx + loading.tsx
│   │   ├── receipts/page.tsx + loading.tsx
│   │   ├── documents/page.tsx + loading.tsx
│   │   └── settings/page.tsx + loading.tsx
│   ├── dashboard/
│   │   ├── page.tsx              # Dashboard principal (hors route group — a son propre Sidebar/Header)
│   │   └── loading.tsx
│   ├── api/
│   │   ├── documents/generate/route.ts     # Génération PDF document + envoi email
│   │   ├── receipts/generate/route.ts      # Génération PDF quittance + envoi email
│   │   ├── receipts/send-email/route.ts    # Renvoi email quittance existante
│   │   ├── receipts/download/route.ts      # Téléchargement PDF depuis Supabase Storage
│   │   └── payments/generate-monthly/route.ts
│   ├── auth/callback/route.ts
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── page.tsx                  # Redirect → /dashboard ou /login
├── components/
│   ├── dashboard/Sidebar.tsx     # Navigation principale (liens avec prefetch={true})
│   ├── dashboard/Header.tsx
│   ├── properties/PropertyList.tsx + PropertyForm.tsx
│   ├── tenants/TenantList.tsx + TenantForm.tsx
│   ├── payments/PaymentList.tsx + PaymentForm.tsx
│   ├── receipts/ReceiptList.tsx
│   ├── documents/DocumentList.tsx + DocumentForm.tsx + DocumentDetail.tsx + SignatureCanvas.tsx
│   ├── settings/SettingsForm.tsx
│   └── ui/                       # Composants shadcn (card, button, dialog, select, etc.)
└── lib/
    ├── supabase/
    │   ├── server.ts             # createClient() — SSR avec cookies
    │   ├── client.ts             # createClient() — côté client
    │   └── middleware.ts
    ├── pdf/
    │   ├── receipt.ts            # Génération PDF quittance
    │   └── document.ts           # Génération PDF document
    └── utils.ts                  # cn()
```

**Important :** `src/app/dashboard/page.tsx` n'est PAS dans le route group `(dashboard)`. Il intègre `Sidebar` et `Header` directement. Les autres pages utilisent le layout du groupe.

---

## Base de données Supabase

URL : `https://ekuhrnysmmswxelfwvnj.supabase.co`
Schéma complet : `supabase-schema.sql` à la racine.

### Tables

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| `profiles` | Propriétaires (liés à auth.users) | id, first_name, last_name, email, phone, address, city, postal_code |
| `properties` | Biens immobiliers | id, owner_id, address, city, postal_code, type, monthly_rent, charges, deposit, status (`rented`/`vacant`) |
| `tenants` | Locataires | id, owner_id, property_id, first_name, last_name, email, phone, entry_date, lease_end_date |
| `rent_payments` | Paiements de loyer | id, owner_id, property_id, tenant_id, amount, charges, payment_date, period_month, period_year, status (`paid`/`pending`/`late`) |
| `rent_receipts` | Quittances générées | id, owner_id, property_id, tenant_id, payment_id, period_month, period_year, amount, charges, issue_date, file_path, sent_at |
| `documents` | Bail, état des lieux, inventaire | id, owner_id, property_id, tenant_id, type (`lease`/`entry_inspection`/`exit_inspection`/`inventory`), title, status (`draft`/`sent`/`signed`/`finalized`), content (jsonb), file_path, owner_signature, tenant_signature |

### Storage
- Bucket `documents` (privé) — fichiers PDF générés
- Chemin des fichiers : `{owner_id}/{filename}.pdf`
- Politique RLS : `auth.uid()::text = (storage.foldername(name))[1]`

### Auth pattern (Server Components)
```typescript
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')
```

### Requêtes parallèles — toujours utiliser Promise.all
```typescript
const [{ data: properties }, { data: tenants }] = await Promise.all([
  supabase.from('properties').select('*').eq('owner_id', user.id),
  supabase.from('tenants').select('*').eq('owner_id', user.id),
])
```

---

## Variables d'environnement (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://ekuhrnysmmswxelfwvnj.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
RESEND_API_KEY=...
```

Note : la clé Supabase est `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (pas `ANON_KEY`).

---

## Email — Resend

Adresse expéditeur systématique :
```
Leasy Immobilier <noreply@leasy-immo.fr>
```

Ne jamais utiliser `onboarding@resend.dev`.

---

## Routes API — règles importantes

Toutes les routes API qui utilisent `createClient()` (cookies) ou Resend **doivent** avoir en tête de fichier :
```typescript
export const dynamic = 'force-dynamic'
```
Sans ça, Next.js tente de les pré-rendre au build et échoue sur Vercel.

---

## Composants UI — @base-ui/react (PAS Radix UI)

Les composants shadcn sont basés sur `@base-ui/react`, pas `@radix-ui`. L'API diffère :

### Select
```typescript
// onValueChange reçoit (value, eventDetails) — pas juste value
<Select onValueChange={(value: string | null) => setValue(value ?? '')}>
```

### DropdownMenu
```typescript
// Pas de prop asChild sur DropdownMenuTrigger ni DropdownMenuItem
<DropdownMenuTrigger className="...">  // className directement, pas asChild
<DropdownMenuItem onClick={handler}>   // onClick, pas de Link enfant
```

### Dialog, Sheet, AlertDialog
- Fonctionnent comme shadcn standard mais via @base-ui/react en interne.

---

## PDF — pdf-lib

Deux fonctions de génération :
- `lib/pdf/receipt.ts` → `generateReceiptPDF(data: ReceiptData): Promise<Uint8Array>`
- `lib/pdf/document.ts` → `generateDocumentPDF(data: DocumentData): Promise<Uint8Array>`

### Contraintes importantes
- Utilise `StandardFonts` de pdf-lib (Helvetica) — **pas de polices custom** car WinAnsiEncoding.
- Les mois sont en ASCII sans accents : `fevrier`, `aout` (pas `février`, `août`).
- Formatter les montants avec une fonction custom, PAS `toLocaleString('fr-FR')` qui produit `\u202F` (espace fine insécable) absent de WinAnsiEncoding → crash.
  ```typescript
  const fmt = (n: number) =>
    Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' EUR'
  ```
- Formatter les dates manuellement (pas `toLocaleDateString`) pour les mêmes raisons d'encodage.

---

## Performance et navigation

- `Sidebar.tsx` : tous les `Link` ont `prefetch={true}` pour le préchargement au survol.
- `loading.tsx` présent dans chaque dossier de page pour les skeletons de chargement (composant `Skeleton` dans `src/components/ui/skeleton.tsx`).
- `unstable_cache` de Next.js ne fonctionne **pas** avec `createClient()` (lecture de cookies) — ne pas l'utiliser pour les requêtes Supabase.

---

## Déploiement

- Hébergé sur **Vercel**.
- Le build local (`npm run build`) doit passer sans erreurs avant de push.
- Erreur courante Vercel : `Failed to collect page data for /api/...` → ajouter `export const dynamic = 'force-dynamic'` en tête de route.

---

## Gestion des branches

- **Petits fixes** → directement sur `dev`
- **Grosses features** → créer une branche `feature/nom-feature` depuis `dev`
  - Push sur la branche feature
  - Merge dans `dev` quand la feature est validée sur staging
  - Merge `dev` → `main` pour passer en prod

---

## Récap de session

- En fin de session, demander à Claude de générer un récap par catégorie :
  - 🆕 Nouvelles features
  - 🔄 Updates features existantes
  - 🐛 Corrections de bugs
  - ✨ Améliorations UX/UI
- Claude crée un brouillon Gmail à amor.faycal1@gmail.com

---

## Domaines

- Prod : app.leasy-immo.fr → Vercel projet leasy-immobilier → Supabase ekuhrnysmmswxelfwvnj
- Staging : demo.leasy-immo.fr → Vercel projet leasy-immobilier-staging → Supabase bpgqhifwvidleiqvrfsl

Note : le domaine est leasy-immo.fr (PAS leasy-immobilier.fr)

Supabase prod Site URL : https://app.leasy-immo.fr
Supabase staging Site URL : https://demo.leasy-immo.fr