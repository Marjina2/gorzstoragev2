# Vercel Deployment Guide

## Prerequisites

1. **Supabase Account** - Set up your database and get credentials
2. **Cloudflare R2 Account** - Set up R2 bucket for file storage
3. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)

## Step 1: Run Database Migrations

Before deploying, run these SQL migrations in your Supabase SQL Editor:

1. `migrations/add_ip_and_user_agent.sql` - Adds IP and user agent tracking
2. `migrations/add_master_token.sql` - Adds master token to database
3. `migrations/add_upload_size_limit.sql` - Adds upload size limit feature

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel
```

### Option B: Deploy via Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your Git repository
3. Vercel will auto-detect Vite framework
4. Add environment variables (see below)
5. Click "Deploy"

## Step 3: Configure Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables, add:

### Supabase Variables
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_KEY` - Your Supabase anon/public key

### Cloudflare R2 Variables
- `VITE_R2_ACCOUNT_ID` - Your R2 account ID
- `VITE_R2_ACCESS_KEY_ID` - Your R2 access key ID
- `VITE_R2_SECRET_ACCESS_KEY` - Your R2 secret access key
- `VITE_R2_BUCKET_NAME` - Your R2 bucket name

**Important:** Add these variables for all environments (Production, Preview, Development)

## Step 4: Configure Supabase

### Enable Anonymous Access

In Supabase Dashboard → Authentication → Providers:
- Enable "Anonymous sign-ins" if needed for public access

### Set Up Row Level Security (RLS)

Make sure your RLS policies allow:
- Public read access to necessary tables
- Authenticated/token-based write access

### CORS Configuration

In Supabase Dashboard → Settings → API:
- Add your Vercel domain to allowed origins
- Example: `https://your-app.vercel.app`

## Step 5: Configure Cloudflare R2

### CORS Policy

Add CORS policy to your R2 bucket:

```json
[
  {
    "AllowedOrigins": ["https://your-app.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

### Public Access

- Enable public access for the bucket if needed
- Or use signed URLs (already implemented in the code)

## Step 6: Verify Deployment

1. Visit your deployed URL
2. Test file upload functionality
3. Test admin panel access
4. Verify R2 storage integration
5. Check database connections

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json`
- Verify Node.js version compatibility
- Check build logs for specific errors

### Environment Variables Not Working
- Ensure all variables start with `VITE_`
- Redeploy after adding/changing variables
- Check variable names match exactly

### CORS Errors
- Add Vercel domain to Supabase allowed origins
- Update R2 CORS policy with your domain
- Clear browser cache and try again

### Database Connection Issues
- Verify Supabase URL and key are correct
- Check RLS policies allow necessary access
- Ensure migrations have been run

## Post-Deployment

1. **Set up custom domain** (optional)
   - Go to Vercel Dashboard → Domains
   - Add your custom domain
   - Update CORS policies with new domain

2. **Monitor performance**
   - Check Vercel Analytics
   - Monitor Supabase usage
   - Track R2 storage costs

3. **Set up backups**
   - Enable Supabase automatic backups
   - Set up R2 bucket versioning

## Security Notes

- Never commit `.env` file to Git
- Use Vercel environment variables for secrets
- Rotate R2 access keys periodically
- Monitor Supabase auth logs
- Keep dependencies updated

## Support

For issues:
- Check Vercel deployment logs
- Review Supabase logs
- Check browser console for errors
- Verify all environment variables are set
