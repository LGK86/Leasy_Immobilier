# Configuration Supabase

## Template email de confirmation

1. Aller sur https://supabase.com/dashboard/project/{PROJECT_ID}/auth/templates
2. Cliquer sur "Confirm signup"
3. Remplacer le sujet par : `Confirmez votre adresse email - Leasy Immobilier`
4. Remplacer le HTML par le template dans `supabase-email-templates.md`

## URL de redirection après confirmation

1. Aller sur https://supabase.com/dashboard/project/{PROJECT_ID}/auth/url-configuration
2. Dans **Site URL**, mettre : `https://leasy-immobilier-staging.vercel.app`
3. Dans **Redirect URLs**, ajouter : `https://leasy-immobilier-staging.vercel.app/auth/callback`
