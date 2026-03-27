# Email Templates Supabase

Configurer manuellement dans : **Supabase Dashboard → Authentication → Email Templates**

---

## Confirmation d'inscription

**Subject:** Confirmez votre adresse email - Leasy Immobilier

**HTML:**

```html
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #063B26; padding: 24px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #CFFF92; margin: 0; font-size: 20px;">Leasy Immobilier</h1>
  </div>
  <div style="padding: 32px; background: #ffffff; border: 1px solid #e5e7eb;">
    <h2 style="color: #063B26;">Confirmez votre adresse email</h2>
    <p style="color: #374151;">Bienvenue sur Leasy Immobilier !</p>
    <p style="color: #374151;">Cliquez sur le bouton ci-dessous pour confirmer votre adresse email et activer votre compte.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{ .ConfirmationURL }}"
         style="background-color: #CFFF92; color: #063B26; padding: 16px 32px;
                border-radius: 8px; text-decoration: none; font-weight: bold;
                font-size: 16px; display: inline-block;">
        Confirmer mon adresse email
      </a>
    </div>
    <p style="color: #6b7280; font-size: 12px;">Si vous n'avez pas créé de compte, ignorez cet email.</p>
  </div>
  <div style="background-color: #F5F6F4; padding: 16px; border-radius: 0 0 8px 8px; text-align: center;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">Leasy Immobilier — noreply@leasy-immo.fr</p>
  </div>
</div>
```
