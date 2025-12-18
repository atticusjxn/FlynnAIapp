# Flynn AI Quote Generation System

## Overview

A comprehensive quote generation feature that allows Flynn AI users to create professional, industry-specific quotes directly in the app and send them to clients via SMS, email, or as PDF attachments. The system intelligently adapts to different business types with industry-specific templates.

---

## 🎯 Core Features

### 1. **Industry-Specific Quote Templates**
- Pre-built templates for 10+ common industries
- Auto-detected from user's business type during onboarding
- Customizable line items per industry
- Smart defaults for common expenses/parts

### 2. **Flexible Quote Builder**
- Line item management (add/edit/remove)
- Labor charges (hourly/flat rate)
- Parts & materials with markup
- Callout/service fees
- Discounts (% or fixed)
- Tax handling (GST inclusive/exclusive)
- Subtotals and grand total calculation

### 3. **Professional PDF Generation**
- Branded PDFs with business logo/colors
- Clear itemization of charges
- Terms & conditions
- Payment instructions
- Validity period
- Quote number/reference

### 4. **Multi-Channel Delivery**
- **SMS**: Send as plain text summary with PDF link
- **Email**: Professional HTML email with attached PDF
- **In-App**: Share via iOS/Android share sheet

### 5. **Quote Management**
- Save as draft
- Track status (Draft, Sent, Viewed, Accepted, Expired)
- Quote history per client
- Convert quote to invoice (future)

---

## 🏭 Industry-Specific Templates

### Template Structure

Each template includes:
- Default line item categories
- Common parts/materials for that industry
- Typical labor descriptions
- Industry-specific terminology
- Average hourly rates (as defaults)

### 10 Core Industry Templates

#### 1. **Plumbing**
```json
{
  "id": "plumbing",
  "name": "Plumbing Services",
  "categories": [
    {
      "name": "Labor",
      "items": [
        { "description": "Standard callout fee", "type": "fixed", "defaultAmount": 95 },
        { "description": "Licensed plumber labor", "type": "hourly", "defaultRate": 120 },
        { "description": "Apprentice labor", "type": "hourly", "defaultRate": 75 }
      ]
    },
    {
      "name": "Parts & Materials",
      "items": [
        { "description": "Pipes & fittings", "type": "quantity", "unit": "per item" },
        { "description": "Valves & taps", "type": "quantity", "unit": "each" },
        { "description": "Sealants & adhesives", "type": "quantity", "unit": "per item" },
        { "description": "Water heater parts", "type": "quantity", "unit": "each" }
      ]
    },
    {
      "name": "Additional Costs",
      "items": [
        { "description": "After-hours surcharge", "type": "fixed", "defaultAmount": 150 },
        { "description": "Travel beyond 30km", "type": "per_km", "defaultRate": 2.5 }
      ]
    }
  ],
  "taxRate": 0.10,
  "taxLabel": "GST",
  "defaultValidityDays": 30,
  "paymentTerms": "Payment due upon completion. We accept cash, card, and bank transfer."
}
```

#### 2. **Electrical**
```json
{
  "id": "electrical",
  "name": "Electrical Services",
  "categories": [
    {
      "name": "Labor",
      "items": [
        { "description": "Licensed electrician callout", "type": "fixed", "defaultAmount": 110 },
        { "description": "Licensed electrician labor", "type": "hourly", "defaultRate": 135 },
        { "description": "Assistant labor", "type": "hourly", "defaultRate": 85 }
      ]
    },
    {
      "name": "Parts & Materials",
      "items": [
        { "description": "Switches & outlets", "type": "quantity", "unit": "each" },
        { "description": "Circuit breakers", "type": "quantity", "unit": "each" },
        { "description": "Wiring & cables", "type": "quantity", "unit": "per meter" },
        { "description": "Light fixtures", "type": "quantity", "unit": "each" }
      ]
    },
    {
      "name": "Testing & Compliance",
      "items": [
        { "description": "Safety inspection", "type": "fixed", "defaultAmount": 85 },
        { "description": "Compliance certificate", "type": "fixed", "defaultAmount": 120 }
      ]
    }
  ],
  "taxRate": 0.10,
  "taxLabel": "GST",
  "defaultValidityDays": 30
}
```

#### 3. **HVAC (Heating, Ventilation, Air Conditioning)**
```json
{
  "id": "hvac",
  "name": "HVAC Services",
  "categories": [
    {
      "name": "Labor",
      "items": [
        { "description": "Service callout", "type": "fixed", "defaultAmount": 100 },
        { "description": "HVAC technician labor", "type": "hourly", "defaultRate": 125 }
      ]
    },
    {
      "name": "Parts & Equipment",
      "items": [
        { "description": "Filters", "type": "quantity", "unit": "each" },
        { "description": "Refrigerant gas", "type": "quantity", "unit": "per kg" },
        { "description": "Thermostats", "type": "quantity", "unit": "each" },
        { "description": "Ducting materials", "type": "quantity", "unit": "per meter" }
      ]
    },
    {
      "name": "Services",
      "items": [
        { "description": "System cleaning", "type": "fixed", "defaultAmount": 180 },
        { "description": "Gas leak test", "type": "fixed", "defaultAmount": 95 }
      ]
    }
  ],
  "taxRate": 0.10,
  "taxLabel": "GST",
  "defaultValidityDays": 30
}
```

#### 4. **Landscaping & Gardening**
```json
{
  "id": "landscaping",
  "name": "Landscaping Services",
  "categories": [
    {
      "name": "Labor",
      "items": [
        { "description": "Landscaper labor", "type": "hourly", "defaultRate": 75 },
        { "description": "Garden maintenance", "type": "hourly", "defaultRate": 55 },
        { "description": "Team labor (per person)", "type": "hourly", "defaultRate": 65 }
      ]
    },
    {
      "name": "Materials & Plants",
      "items": [
        { "description": "Plants & trees", "type": "quantity", "unit": "each" },
        { "description": "Mulch & soil", "type": "quantity", "unit": "per m³" },
        { "description": "Turf/grass", "type": "quantity", "unit": "per m²" },
        { "description": "Pavers & stones", "type": "quantity", "unit": "per m²" }
      ]
    },
    {
      "name": "Equipment & Disposal",
      "items": [
        { "description": "Equipment hire", "type": "fixed", "defaultAmount": 150 },
        { "description": "Green waste disposal", "type": "fixed", "defaultAmount": 80 }
      ]
    }
  ],
  "taxRate": 0.10,
  "taxLabel": "GST",
  "defaultValidityDays": 14
}
```

#### 5. **Cleaning Services**
```json
{
  "id": "cleaning",
  "name": "Cleaning Services",
  "categories": [
    {
      "name": "Labor",
      "items": [
        { "description": "Cleaner labor", "type": "hourly", "defaultRate": 45 },
        { "description": "Deep clean surcharge", "type": "fixed", "defaultAmount": 80 },
        { "description": "Team of 2 cleaners", "type": "hourly", "defaultRate": 85 }
      ]
    },
    {
      "name": "Supplies & Equipment",
      "items": [
        { "description": "Cleaning products", "type": "fixed", "defaultAmount": 25 },
        { "description": "Specialist equipment hire", "type": "fixed", "defaultAmount": 50 }
      ]
    },
    {
      "name": "Add-On Services",
      "items": [
        { "description": "Window cleaning", "type": "fixed", "defaultAmount": 120 },
        { "description": "Carpet steam clean", "type": "per_room", "defaultRate": 45 },
        { "description": "Oven clean", "type": "fixed", "defaultAmount": 85 }
      ]
    }
  ],
  "taxRate": 0.10,
  "taxLabel": "GST",
  "defaultValidityDays": 7
}
```

#### 6. **Carpentry & Renovation**
```json
{
  "id": "carpentry",
  "name": "Carpentry Services",
  "categories": [
    {
      "name": "Labor",
      "items": [
        { "description": "Carpenter labor", "type": "hourly", "defaultRate": 95 },
        { "description": "Site visit/quote fee", "type": "fixed", "defaultAmount": 75 }
      ]
    },
    {
      "name": "Materials",
      "items": [
        { "description": "Timber & lumber", "type": "quantity", "unit": "per m²" },
        { "description": "Hardware & fixtures", "type": "quantity", "unit": "per item" },
        { "description": "Paint & finishes", "type": "quantity", "unit": "per litre" },
        { "description": "Custom joinery", "type": "fixed", "defaultAmount": 0 }
      ]
    },
    {
      "name": "Project Management",
      "items": [
        { "description": "Design & planning", "type": "fixed", "defaultAmount": 250 },
        { "description": "Project management fee", "type": "percentage", "defaultRate": 10 }
      ]
    }
  ],
  "taxRate": 0.10,
  "taxLabel": "GST",
  "defaultValidityDays": 30
}
```

#### 7. **Auto Repair & Mechanics**
```json
{
  "id": "automotive",
  "name": "Automotive Services",
  "categories": [
    {
      "name": "Labor",
      "items": [
        { "description": "Diagnostic fee", "type": "fixed", "defaultAmount": 90 },
        { "description": "Mechanic labor", "type": "hourly", "defaultRate": 110 }
      ]
    },
    {
      "name": "Parts & Fluids",
      "items": [
        { "description": "OEM parts", "type": "quantity", "unit": "each" },
        { "description": "Aftermarket parts", "type": "quantity", "unit": "each" },
        { "description": "Engine oil & fluids", "type": "quantity", "unit": "per litre" },
        { "description": "Filters & consumables", "type": "quantity", "unit": "each" }
      ]
    },
    {
      "name": "Services",
      "items": [
        { "description": "Roadworthiness inspection", "type": "fixed", "defaultAmount": 95 },
        { "description": "Wheel alignment", "type": "fixed", "defaultAmount": 120 },
        { "description": "Vehicle recovery/towing", "type": "fixed", "defaultAmount": 180 }
      ]
    }
  ],
  "taxRate": 0.10,
  "taxLabel": "GST",
  "defaultValidityDays": 30
}
```

#### 8. **Hair & Beauty Salon**
```json
{
  "id": "beauty",
  "name": "Beauty Services",
  "categories": [
    {
      "name": "Services",
      "items": [
        { "description": "Haircut & styling", "type": "fixed", "defaultAmount": 65 },
        { "description": "Color treatment", "type": "fixed", "defaultAmount": 150 },
        { "description": "Highlights", "type": "fixed", "defaultAmount": 180 },
        { "description": "Blow dry & styling", "type": "fixed", "defaultAmount": 55 }
      ]
    },
    {
      "name": "Treatments",
      "items": [
        { "description": "Deep conditioning", "type": "fixed", "defaultAmount": 45 },
        { "description": "Keratin treatment", "type": "fixed", "defaultAmount": 280 },
        { "description": "Scalp treatment", "type": "fixed", "defaultAmount": 75 }
      ]
    },
    {
      "name": "Products",
      "items": [
        { "description": "Professional products", "type": "quantity", "unit": "each" }
      ]
    }
  ],
  "taxRate": 0.10,
  "taxLabel": "GST",
  "defaultValidityDays": 7
}
```

#### 9. **IT & Tech Support**
```json
{
  "id": "it_support",
  "name": "IT Services",
  "categories": [
    {
      "name": "Labor & Consulting",
      "items": [
        { "description": "Initial consultation", "type": "fixed", "defaultAmount": 120 },
        { "description": "IT support (hourly)", "type": "hourly", "defaultRate": 150 },
        { "description": "Remote support", "type": "hourly", "defaultRate": 95 }
      ]
    },
    {
      "name": "Hardware & Software",
      "items": [
        { "description": "Hardware components", "type": "quantity", "unit": "each" },
        { "description": "Software licenses", "type": "quantity", "unit": "each" },
        { "description": "Network equipment", "type": "quantity", "unit": "each" }
      ]
    },
    {
      "name": "Project Services",
      "items": [
        { "description": "System setup & configuration", "type": "fixed", "defaultAmount": 450 },
        { "description": "Data migration", "type": "fixed", "defaultAmount": 350 },
        { "description": "Training session", "type": "fixed", "defaultAmount": 200 }
      ]
    }
  ],
  "taxRate": 0.10,
  "taxLabel": "GST",
  "defaultValidityDays": 30
}
```

#### 10. **Personal Training & Fitness**
```json
{
  "id": "fitness",
  "name": "Fitness Services",
  "categories": [
    {
      "name": "Training Sessions",
      "items": [
        { "description": "1-on-1 personal training", "type": "per_session", "defaultRate": 85 },
        { "description": "Small group training (2-4 people)", "type": "per_session", "defaultRate": 120 },
        { "description": "Online coaching session", "type": "per_session", "defaultRate": 65 }
      ]
    },
    {
      "name": "Packages",
      "items": [
        { "description": "10-session package", "type": "fixed", "defaultAmount": 750 },
        { "description": "Monthly unlimited", "type": "fixed", "defaultAmount": 400 }
      ]
    },
    {
      "name": "Additional Services",
      "items": [
        { "description": "Nutrition plan", "type": "fixed", "defaultAmount": 150 },
        { "description": "Fitness assessment", "type": "fixed", "defaultAmount": 75 }
      ]
    }
  ],
  "taxRate": 0.10,
  "taxLabel": "GST",
  "defaultValidityDays": 14
}
```

---

## 📱 User Experience Flow

### Entry Points to Quote Builder

#### 1. From Job Detail Screen
```
Tab: Calendar → Tap Job → "Create Quote" button
  ↓
Pre-populated with job details:
  - Client name, phone, email
  - Service type
  - Job location
  - Notes/description
```

#### 2. From Client Profile
```
Tab: Clients → Tap Client → "New Quote" button
  ↓
Pre-populated with:
  - Client contact info
  - Previous job history
```

#### 3. From Dashboard
```
Tab: Dashboard → "+" FAB → "Create Quote"
  ↓
Start from scratch:
  - Select existing client OR add new
  - Choose service type
```

### Quote Builder Screen Structure

```
┌─────────────────────────────────────────┐
│  [Back]    Create Quote        [Save]   │
├─────────────────────────────────────────┤
│                                         │
│  CLIENT INFORMATION                     │
│  ┌───────────────────────────────────┐ │
│  │ John Smith                       ✓│ │
│  │ +61 491 234 567                   │ │
│  │ john@example.com                  │ │
│  └───────────────────────────────────┘ │
│                                         │
│  QUOTE DETAILS                          │
│  ┌───────────────────────────────────┐ │
│  │ Quote #: Q-2025-001               │ │
│  │ Valid Until: Jan 30, 2025     [→]│ │
│  │ Job Location: 123 Main St        │ │
│  └───────────────────────────────────┘ │
│                                         │
│  LINE ITEMS                        [+]  │
│  ┌───────────────────────────────────┐ │
│  │ ⚡ Licensed electrician callout   │ │
│  │    $110.00                   [✎]│ │
│  ├───────────────────────────────────┤ │
│  │ ⚡ Electrician labor - 2.5 hrs    │ │
│  │    $337.50                   [✎]│ │
│  ├───────────────────────────────────┤ │
│  │ 🔧 Circuit breakers x3            │ │
│  │    $165.00                   [✎]│ │
│  └───────────────────────────────────┘ │
│                                         │
│  [+ Add Labor] [+ Add Parts] [+ Custom]│
│                                         │
│  CALCULATIONS                           │
│  ┌───────────────────────────────────┐ │
│  │ Subtotal:              $612.50    │ │
│  │ GST (10%):              $61.25    │ │
│  │ ─────────────────────────────────│ │
│  │ TOTAL:                 $673.75    │ │
│  └───────────────────────────────────┘ │
│                                         │
│  TAX OPTIONS                   [Switch]│
│  ○ GST Inclusive   ● GST Exclusive     │
│                                         │
│  NOTES & TERMS                          │
│  ┌───────────────────────────────────┐ │
│  │ Payment due upon completion...    │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌─────────────────────────────────┐  │
│  │     [📱 Send via SMS]           │  │
│  ├─────────────────────────────────┤  │
│  │     [📧 Send via Email]         │  │
│  ├─────────────────────────────────┤  │
│  │     [📄 View PDF]               │  │
│  └─────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

### Add Line Item Modal

```
┌─────────────────────────────────────────┐
│  [Cancel]  Add Line Item      [Add]     │
├─────────────────────────────────────────┤
│                                         │
│  CATEGORY                               │
│  [Labor ▼]                              │
│                                         │
│  FROM TEMPLATE                          │
│  ┌───────────────────────────────────┐ │
│  │ ○ Licensed electrician callout   │ │
│  │   Suggested: $110.00              │ │
│  ├───────────────────────────────────┤ │
│  │ ○ Licensed electrician labor     │ │
│  │   Suggested: $135/hr              │ │
│  ├───────────────────────────────────┤ │
│  │ ○ Assistant labor                │ │
│  │   Suggested: $85/hr               │ │
│  └───────────────────────────────────┘ │
│                                         │
│  OR CREATE CUSTOM                       │
│  ┌───────────────────────────────────┐ │
│  │ Description:                      │ │
│  │ [Custom labor description...]     │ │
│  │                                   │ │
│  │ Type: [Hourly ▼]                  │ │
│  │                                   │ │
│  │ Rate/Amount: [$___.__]            │ │
│  │                                   │ │
│  │ Quantity: [___.__]                │ │
│  │                                   │ │
│  │ Total: $0.00                      │ │
│  └───────────────────────────────────┘ │
│                                         │
│         [Add to Quote]                  │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🗄️ Database Schema

### New Tables

#### `quotes` Table
```sql
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  quote_number text not null, -- Q-2025-001

  -- Client info
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null,
  client_email text,
  client_phone text,

  -- Job linkage (optional)
  job_id uuid references public.jobs(id) on delete set null,

  -- Quote details
  service_type text,
  location text,
  notes text,

  -- Line items (stored as JSONB)
  line_items jsonb not null default '[]'::jsonb,

  -- Financial calculations
  subtotal numeric(10,2) not null default 0,
  tax_rate numeric(5,4) not null default 0.10, -- 10% GST
  tax_amount numeric(10,2) not null default 0,
  discount_amount numeric(10,2) default 0,
  discount_type text check (discount_type in ('fixed', 'percentage')),
  total numeric(10,2) not null default 0,
  tax_inclusive boolean not null default false,
  tax_label text not null default 'GST',

  -- Quote metadata
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired')),
  valid_until date,
  terms text,

  -- Delivery tracking
  sent_at timestamptz,
  sent_via text check (sent_via in ('sms', 'email', 'share')),
  viewed_at timestamptz,
  accepted_at timestamptz,

  -- PDF generation
  pdf_url text,
  pdf_generated_at timestamptz,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Indexes
  constraint unique_quote_number_per_org unique (org_id, quote_number)
);

create index if not exists quotes_org_id_idx on public.quotes(org_id);
create index if not exists quotes_client_id_idx on public.quotes(client_id);
create index if not exists quotes_job_id_idx on public.quotes(job_id);
create index if not exists quotes_status_idx on public.quotes(status);
create index if not exists quotes_created_at_idx on public.quotes(created_at desc);
```

#### `quote_templates` Table
```sql
create table if not exists public.quote_templates (
  id uuid primary key default gen_random_uuid(),
  template_id text not null unique, -- 'plumbing', 'electrical', etc.
  name text not null,
  industry_category text not null,

  -- Template structure (JSONB)
  categories jsonb not null default '[]'::jsonb,

  -- Default settings
  tax_rate numeric(5,4) not null default 0.10,
  tax_label text not null default 'GST',
  default_validity_days integer not null default 30,
  payment_terms text,

  -- Metadata
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quote_templates_industry_idx on public.quote_templates(industry_category);
```

#### `quote_history` Table (Audit Trail)
```sql
create table if not exists public.quote_history (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,

  action text not null check (action in ('created', 'updated', 'sent', 'viewed', 'accepted', 'declined', 'expired')),
  actor_id uuid references public.users(id) on delete set null,

  -- Snapshot of quote at this point
  quote_snapshot jsonb,

  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists quote_history_quote_id_idx on public.quote_history(quote_id);
create index if not exists quote_history_created_at_idx on public.quote_history(created_at desc);
```

### Line Item Structure (JSONB)

```typescript
interface QuoteLineItem {
  id: string; // uuid
  category: string; // 'Labor', 'Parts & Materials', etc.
  description: string;
  type: 'fixed' | 'hourly' | 'quantity' | 'per_session' | 'per_room' | 'per_km' | 'percentage';
  rate?: number; // For hourly, per_unit types
  quantity?: number; // Hours, units, etc.
  amount: number; // Calculated total for this line
  unit?: string; // 'hours', 'each', 'm²', 'km', etc.
  notes?: string;
  isFromTemplate: boolean;
  templateItemId?: string; // Reference back to template
}

// Example line items array
const lineItems: QuoteLineItem[] = [
  {
    id: "uuid-1",
    category: "Labor",
    description: "Licensed electrician callout",
    type: "fixed",
    amount: 110.00,
    isFromTemplate: true,
    templateItemId: "electrical_callout"
  },
  {
    id: "uuid-2",
    category: "Labor",
    description: "Licensed electrician labor",
    type: "hourly",
    rate: 135.00,
    quantity: 2.5,
    amount: 337.50,
    unit: "hours",
    isFromTemplate: true
  },
  {
    id: "uuid-3",
    category: "Parts & Materials",
    description: "Circuit breakers",
    type: "quantity",
    rate: 55.00,
    quantity: 3,
    amount: 165.00,
    unit: "each",
    isFromTemplate: false
  }
];
```

---

## 📄 PDF Generation

### Technology Stack

**Option 1: React Native PDF (react-native-html-to-pdf)**
- Pros: Native PDF generation, no external dependencies
- Cons: More complex, platform-specific code

**Option 2: Server-Side PDF (Puppeteer/PDFKit)**
- Pros: Consistent output, easier templating, server caching
- Cons: Requires server endpoint, slower for user

**Recommendation: Hybrid Approach**
- Generate HTML template on client
- Send to server for PDF conversion
- Cache PDFs on Supabase Storage
- Return signed URL to client

### PDF Template Design

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Quote #{{quoteNumber}}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #333;
      margin: 0;
      padding: 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      border-bottom: 3px solid #2563EB;
      padding-bottom: 20px;
    }
    .business-info h1 {
      margin: 0 0 5px 0;
      color: #2563EB;
      font-size: 28px;
    }
    .quote-info {
      text-align: right;
      font-size: 14px;
    }
    .quote-number {
      font-size: 24px;
      font-weight: bold;
      color: #2563EB;
      margin-bottom: 10px;
    }
    .client-section {
      background: #F8FAFC;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .line-items {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    .line-items th {
      background: #F1F5F9;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #CBD5E1;
    }
    .line-items td {
      padding: 12px;
      border-bottom: 1px solid #E2E8F0;
    }
    .category-header {
      background: #F8FAFC;
      font-weight: 600;
      color: #475569;
    }
    .totals {
      width: 100%;
      max-width: 350px;
      margin-left: auto;
      font-size: 16px;
    }
    .totals tr td {
      padding: 8px 12px;
    }
    .totals .grand-total {
      font-size: 20px;
      font-weight: bold;
      background: #2563EB;
      color: white;
      border-radius: 4px;
    }
    .terms {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #E2E8F0;
      font-size: 12px;
      color: #64748B;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 12px;
      color: #94A3B8;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="business-info">
      <h1>{{businessName}}</h1>
      <p>{{businessPhone}}<br>{{businessEmail}}<br>{{businessAddress}}</p>
    </div>
    <div class="quote-info">
      <div class="quote-number">Quote #{{quoteNumber}}</div>
      <p>
        Date: {{quoteDate}}<br>
        Valid Until: {{validUntil}}
      </p>
    </div>
  </div>

  <div class="client-section">
    <h3>Quote For:</h3>
    <p>
      <strong>{{clientName}}</strong><br>
      {{clientPhone}}<br>
      {{clientEmail}}<br>
      {{#if jobLocation}}Location: {{jobLocation}}<br>{{/if}}
    </p>
  </div>

  <table class="line-items">
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align: right;">Qty/Hours</th>
        <th style="text-align: right;">Rate</th>
        <th style="text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      {{#each categorizedLineItems}}
        <tr class="category-header">
          <td colspan="4"><strong>{{category}}</strong></td>
        </tr>
        {{#each items}}
          <tr>
            <td>{{description}}{{#if notes}}<br><small>{{notes}}</small>{{/if}}</td>
            <td style="text-align: right;">{{quantity}} {{unit}}</td>
            <td style="text-align: right;">{{formatCurrency rate}}</td>
            <td style="text-align: right;">{{formatCurrency amount}}</td>
          </tr>
        {{/each}}
      {{/each}}
    </tbody>
  </table>

  <table class="totals">
    <tr>
      <td>Subtotal:</td>
      <td style="text-align: right;">{{formatCurrency subtotal}}</td>
    </tr>
    {{#if discountAmount}}
    <tr>
      <td>Discount:</td>
      <td style="text-align: right;">-{{formatCurrency discountAmount}}</td>
    </tr>
    {{/if}}
    <tr>
      <td>{{taxLabel}} ({{taxRate}}%):</td>
      <td style="text-align: right;">{{formatCurrency taxAmount}}</td>
    </tr>
    <tr class="grand-total">
      <td>TOTAL:</td>
      <td style="text-align: right;">{{formatCurrency total}}</td>
    </tr>
  </table>

  {{#if notes}}
  <div style="margin-top: 30px; padding: 15px; background: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 4px;">
    <strong>Notes:</strong>
    <p>{{notes}}</p>
  </div>
  {{/if}}

  <div class="terms">
    <h4>Terms & Conditions</h4>
    <p>{{paymentTerms}}</p>
    <p>This quote is valid until {{validUntil}}. Prices include {{taxLabel}} unless otherwise stated.</p>
  </div>

  <div class="footer">
    <p>Generated by Flynn AI • {{generatedDate}}</p>
  </div>
</body>
</html>
```

---

## 📲 Delivery Methods

### 1. SMS Delivery

**Plain Text Version (Under 160 chars)**
```
Hi {{clientName}},

Your quote from {{businessName}}:

{{serviceType}}
Total: ${{total}} inc. GST

View full quote: {{shortUrl}}

Valid until {{validUntil}}
```

**Extended Version (MMS)**
```
Hi {{clientName}},

Quote #{{quoteNumber}} from {{businessName}}

Service: {{serviceType}}
Location: {{location}}

Subtotal: ${{subtotal}}
GST: ${{taxAmount}}
TOTAL: ${{total}}

📄 View detailed quote: {{pdfUrl}}

Valid until {{validUntil}}

{{businessPhone}}
```

### 2. Email Delivery

**HTML Email Template**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Your Quote from {{businessName}}</title>
</head>
<body style="font-family: Arial, sans-serif; color: #333; background: #f8f9fa; padding: 20px;">
  <table style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden;">
    <tr>
      <td style="background: #2563EB; color: white; padding: 30px; text-align: center;">
        <h1 style="margin: 0;">{{businessName}}</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">Professional Quote</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 30px;">
        <p>Hi {{clientName}},</p>
        <p>Thank you for your inquiry. Please find attached your quote for {{serviceType}}.</p>

        <table style="width: 100%; margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 8px;">
          <tr style="background: #f8fafc;">
            <td style="padding: 15px;"><strong>Quote Number:</strong></td>
            <td style="padding: 15px; text-align: right;">{{quoteNumber}}</td>
          </tr>
          <tr>
            <td style="padding: 15px;"><strong>Total Amount:</strong></td>
            <td style="padding: 15px; text-align: right; font-size: 24px; color: #2563EB;"><strong>${{total}}</strong></td>
          </tr>
          <tr style="background: #f8fafc;">
            <td style="padding: 15px;"><strong>Valid Until:</strong></td>
            <td style="padding: 15px; text-align: right;">{{validUntil}}</td>
          </tr>
        </table>

        <p style="text-align: center; margin: 30px 0;">
          <a href="{{pdfUrl}}" style="background: #2563EB; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
            📄 View Full Quote (PDF)
          </a>
        </p>

        <p>If you have any questions or would like to proceed, please don't hesitate to contact us.</p>

        <p style="margin-top: 30px;">
          <strong>{{businessName}}</strong><br>
          {{businessPhone}}<br>
          {{businessEmail}}
        </p>
      </td>
    </tr>
    <tr>
      <td style="background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 12px;">
        <p>Generated by Flynn AI • {{generatedDate}}</p>
      </td>
    </tr>
  </table>
</body>
</html>
```

### 3. In-App Share (iOS/Android Share Sheet)

```typescript
import { Share } from 'react-native';

const shareQuote = async (quoteId: string, pdfUrl: string) => {
  try {
    await Share.share({
      title: `Quote #${quoteNumber}`,
      message: `Quote from ${businessName}\n\nTotal: $${total}\nValid until: ${validUntil}\n\nView PDF: ${pdfUrl}`,
      url: pdfUrl, // PDF URL for iOS
    });
  } catch (error) {
    console.error('Error sharing quote:', error);
  }
};
```

---

## 🔧 Backend API Endpoints

### 1. Create Quote
```
POST /api/quotes
Auth: Required (JWT)

Body:
{
  "clientId": "uuid",
  "jobId": "uuid" (optional),
  "serviceType": "string",
  "location": "string",
  "lineItems": [...],
  "notes": "string",
  "taxInclusive": boolean,
  "validityDays": number
}

Response:
{
  "quote": { ... },
  "quoteNumber": "Q-2025-001"
}
```

### 2. Get Quote Templates
```
GET /api/quotes/templates?industry=plumbing
Auth: Required

Response:
{
  "templates": [
    {
      "id": "plumbing",
      "name": "Plumbing Services",
      "categories": [...],
      "defaults": { ... }
    }
  ]
}
```

### 3. Generate PDF
```
POST /api/quotes/:id/generate-pdf
Auth: Required

Response:
{
  "pdfUrl": "https://storage.supabase.co/...",
  "expiresAt": "2025-01-30T00:00:00Z"
}
```

### 4. Send Quote
```
POST /api/quotes/:id/send
Auth: Required

Body:
{
  "method": "sms" | "email" | "both",
  "recipientEmail": "string" (for email),
  "recipientPhone": "string" (for SMS)
}

Response:
{
  "success": true,
  "sentVia": ["sms", "email"],
  "sentAt": "2025-01-15T10:30:00Z"
}
```

### 5. Track Quote View
```
POST /api/quotes/:id/track-view
Auth: Not required (public link)

Response:
{
  "success": true,
  "viewedAt": "2025-01-16T14:22:00Z"
}
```

---

## 🎨 Design Considerations

### Visual Hierarchy
1. **Client Info** → Top (who it's for)
2. **Quote Number & Validity** → Prominent (urgency)
3. **Line Items** → Clear categorization
4. **Totals** → Large, bold, easy to scan
5. **Terms** → Bottom (important but secondary)

### Mobile-First Design
- Large touch targets (min 44px)
- Swipe gestures for line item editing
- Collapsible categories
- Sticky total at bottom during scroll
- Quick actions (edit, duplicate, delete)

### Accessibility
- High contrast ratios
- Clear font sizes (min 16px for body)
- Icon + text labels
- Screen reader support
- Error messages with context

---

## 📊 Quote Management Features

### Quote Status Workflow
```
Draft → Sent → Viewed → Accepted
                 ↓
              Declined
                 ↓
              Expired
```

### Dashboard Widgets
- **Recent Quotes** (last 5)
- **Pending Quotes** (sent but not accepted)
- **Quote Conversion Rate** (accepted / sent)
- **Total Quote Value** (this month)

### Notifications
- Quote viewed by client (push notification)
- Quote expiring soon (3 days before)
- Quote accepted (push + email)

---

## 🚀 Implementation Phases

### Phase 1: Core Quote Builder (Week 1-2)
- [ ] Database schema (quotes, quote_templates tables)
- [ ] Quote templates seed data (10 industries)
- [ ] Quote builder UI screen
- [ ] Line item add/edit/delete
- [ ] Tax calculations (GST inclusive/exclusive)
- [ ] Save as draft

### Phase 2: PDF Generation (Week 3)
- [ ] PDF template design
- [ ] Server-side PDF generation endpoint (Puppeteer)
- [ ] Supabase Storage integration
- [ ] PDF preview in app

### Phase 3: Delivery System (Week 4)
- [ ] SMS delivery integration (Twilio)
- [ ] Email delivery (SMTP/SendGrid)
- [ ] Share sheet integration
- [ ] Delivery status tracking

### Phase 4: Quote Management (Week 5)
- [ ] Quote listing screen
- [ ] Quote detail/preview screen
- [ ] Status updates (sent, viewed, accepted)
- [ ] Quote history/audit trail
- [ ] Analytics dashboard

### Phase 5: Advanced Features (Week 6+)
- [ ] Duplicate quote
- [ ] Quote versioning
- [ ] Convert quote to invoice
- [ ] Recurring quotes/templates
- [ ] Custom branding (logo, colors)
- [ ] Multi-currency support

---

## 💡 Key Benefits

### For Flynn AI Users
✅ **Frictionless workflow** - Create quotes directly from missed calls
✅ **Professional appearance** - Branded PDFs build trust
✅ **Time savings** - Pre-filled templates eliminate repetition
✅ **Higher conversion** - Fast quotes = more booked jobs
✅ **Multi-channel delivery** - Meet clients where they are

### For Flynn AI Platform
✅ **Increased stickiness** - Users rely on Flynn for entire workflow
✅ **Competitive differentiation** - End-to-end lead-to-payment solution
✅ **Upsell opportunity** - Premium features (custom branding, unlimited quotes)
✅ **Data insights** - Quote conversion rates inform product strategy

---

## 📝 Next Steps

1. **Review & Feedback** - Validate templates match real-world needs
2. **Design Mockups** - Create high-fidelity designs for quote builder
3. **Technical Spike** - Test PDF generation options
4. **Database Migration** - Create quotes tables
5. **Seed Templates** - Load 10 industry templates
6. **Build Phase 1** - Core quote builder functionality

Let me know what you think, and I can start implementing any specific phase! 🚀
