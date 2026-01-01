# Flynn AI Quote Portal

Customer-facing quote request forms for service businesses. Mobile-optimized, multi-step form with photo/video uploads and real-time price estimates.

## Features

- **Multi-step form flow**: Intro → Questions → Media Upload → Contact Details → Review → Confirmation
- **Smart question types**: Yes/No, Single/Multi-choice, Text, Number, Address, Date/Time
- **Conditional logic**: Show/hide questions based on previous answers
- **Media uploads**: Optimized photo compression + video upload with progress tracking
- **Price estimation**: Real-time rules-based pricing (optional, customer-facing or internal)
- **Mobile-first design**: Fast, responsive, works on all devices
- **Branding support**: Custom colors, logos, disclaimers per business

## Tech Stack

- **Next.js 15** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS**
- **Supabase** (Database + Storage)
- **browser-image-compression** (Client-side image optimization)

## Setup

### 1. Install Dependencies

```bash
cd quote-portal
npm install
```

### 2. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and add your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Update `.env.local` with:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for uploads)

### 3. Create Supabase Storage Bucket

Run this in your Supabase SQL Editor:

```sql
-- Create quote-submissions storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-submissions', 'quote-submissions', false);

-- Create RLS policies for public uploads
CREATE POLICY "Allow public uploads to temp folder"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'quote-submissions' AND (storage.foldername(name))[1] = 'temp');

CREATE POLICY "Allow authenticated access to quote media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'quote-submissions' AND
  EXISTS (
    SELECT 1 FROM quote_submission_media
    WHERE file_url = name AND submission_id IN (
      SELECT id FROM quote_submissions WHERE org_id IN (
        SELECT org_id FROM org_members WHERE user_id = auth.uid()
      )
    )
  )
);
```

### 4. Run Database Migrations

Run the quote links migration in your Supabase project:

```bash
# From Flynn AI root directory
supabase db push
```

Or manually run `/supabase/migrations/20250129000003_create_quote_links_system.sql` in SQL Editor.

### 5. Start Development Server

```bash
npm run dev
```

The quote portal will be available at `http://localhost:3002`

### 6. Test with Sample Data

The migration includes 8 pre-seeded quote form templates:
- Plumbing
- Electrical
- Cleaning
- Lawn & Garden
- Handyman
- Painting
- Removalist
- Beauty/Salon

Create a quote form in the Flynn AI mobile app, publish it, and access it via:
```
http://localhost:3002/[your-quote-form-slug]
```

## URL Structure

```
https://flynnai.app/quote/[slug]
```

Example:
- `https://flynnai.app/quote/joes-plumbing-quote`
- `https://flynnai.app/quote/sydney-electrical-quote`

Slugs are auto-generated from business names and guaranteed to be unique.

## Production Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

### Custom Domain Setup

1. Add CNAME record: `quote.yourdomain.com` → `cname.vercel-dns.com`
2. Configure domain in Vercel
3. Update `QUOTE_DOMAIN` env var

## Architecture

### File Structure

```
quote-portal/
├── app/
│   ├── [slug]/
│   │   ├── page.tsx                 # Main quote form page (server component)
│   │   └── components/
│   │       ├── QuotePortalClient.tsx    # Main client wrapper
│   │       ├── IntroScreen.tsx          # Step 1: Welcome + What to expect
│   │       ├── QuestionScreen.tsx       # Step 2: Answer questions
│   │       ├── MediaUploadScreen.tsx    # Step 3: Upload photos/videos
│   │       ├── ContactDetailsScreen.tsx # Step 4: Name, phone, email
│   │       ├── ReviewScreen.tsx         # Step 5: Review before submit
│   │       ├── ConfirmationScreen.tsx   # Step 6: Success message
│   │       └── ProgressBar.tsx          # Sticky progress indicator
│   ├── api/
│   │   ├── submit/route.ts          # Handle form submission
│   │   └── upload/route.ts          # Generate signed upload URLs
│   ├── layout.tsx                   # Root layout
│   ├── globals.css                  # Tailwind + custom styles
│   └── not-found.tsx                # 404 page
├── lib/
│   └── supabase.ts                  # Supabase client + types
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── next.config.js
```

### Data Flow

1. **Customer opens link** → Server fetches published quote form + price guide
2. **Customer fills questions** → Answers stored in React state
3. **Media upload** → Compressed, uploaded to Supabase Storage, tracked in DB
4. **Price calculation** → Client-side rules engine calculates estimate
5. **Submit** → Creates `quote_submission` record with all data
6. **Confirmation** → Shows success message + estimate

### Key Components

- **QuotePortalClient**: Main orchestrator, manages flow between screens
- **QuestionScreen**: Handles all 8 question types, conditional logic, validation
- **MediaUploadScreen**: Photo compression (browser-image-compression), video upload with progress, retry logic
- **ReviewScreen**: Shows all answers + estimate before submission

## Integration with Flynn AI App

### SMS Link Flow

1. Business enables quote link in IVR settings
2. Caller presses "2" during call
3. Flynn sends SMS: "Share your project details and photos here: [link]"
4. Caller clicks link → Opens quote portal
5. Submits request → Creates job card in Flynn AI app

### Manual Sharing

Businesses can share their quote link via:
- SMS to customers
- Social media posts
- Email signatures
- Website "Get a Quote" buttons

## Price Estimation

### How It Works

1. Business configures price guide with rules:
   ```typescript
   {
     condition: { questionId: 'q1', operator: 'equals', value: 'emergency' },
     action: { type: 'add', value: 100, note: 'After-hours surcharge' }
   }
   ```

2. Customer answers questions → Rules evaluated in order
3. Base price + callout fee + rule adjustments = Estimate
4. Min/max constraints applied
5. Estimate shown to customer (if enabled) or internal-only

### Display Modes

- **Range**: "$150 – $250"
- **Starting From**: "From $150"
- **Internal Only**: Estimate calculated but not shown to customer
- **Disabled**: No estimate generated

## Security

- RLS policies enforce org-level access control
- Signed upload URLs for secure file uploads
- File type/size validation on client and server
- Media scanning status tracked (integration point for ClamAV/VirusTotal)
- Rate limiting recommended (implement at edge/middleware level)

## Performance Optimizations

- **Image compression**: Reduces files to 1MB, max 1920px
- **Background uploads**: Don't block form completion
- **Lazy loading**: Next.js automatic code splitting
- **Caching**: Revalidate quote forms every 60 seconds
- **CDN**: Supabase Storage with global CDN
- **Mobile-first**: Optimized for 3G/4G connections

## Monitoring & Analytics

Quote link events tracked:
- `link_opened`
- `form_started`
- `question_answered`
- `media_upload_started`
- `media_uploaded`
- `form_submitted`
- `estimate_viewed`

Query analytics with:
```sql
SELECT
  event_type,
  COUNT(*) as count,
  DATE(created_at) as date
FROM quote_link_events
WHERE form_id = '[your-form-id]'
GROUP BY event_type, DATE(created_at)
ORDER BY date DESC;
```

## Troubleshooting

### Quote form shows 404
- Check form is published (`is_published = true`)
- Verify slug is correct
- Check RLS policies allow public read

### Media upload fails
- Verify `quote-submissions` storage bucket exists
- Check RLS policies on storage.objects
- Ensure SUPABASE_SERVICE_ROLE_KEY is set
- Check file size limits (10MB photos, 50MB videos)

### Price estimate not showing
- Verify price guide exists for form (`is_active = true`)
- Check `show_to_customer = true` in price guide
- Ensure rules reference valid question IDs
- Test rules with sample answers

### Form loads slowly
- Enable Next.js caching (revalidate: 60)
- Optimize images in form customization
- Check Supabase query performance
- Use CDN for static assets

## Future Enhancements

### v1.1 (Planned)
- Video transcoding for streamable playback
- Conditional question logic (full implementation)
- A/B testing for form variations
- Advanced analytics dashboard
- Multi-language support

### v1.2 (Future)
- AI-assisted form filling (autocomplete from photos)
- Voice input for questions
- Digital signature capture
- Payment collection integration
- CRM webhooks (Zapier, Make)

## Support

For issues or questions:
- GitHub: https://github.com/anthropics/flynn-ai
- Docs: https://docs.flynnai.app
- Email: support@flynnai.app
