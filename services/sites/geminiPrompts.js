const DEFAULT_TEMPERATURES = {
  classify: 0.3,
  vision: 0.4,
  site: 0.6,
};

const cleanArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean);
};

const buildBusinessInsightPrompt = ({ bio, followers, posts, contactInfo }) => {
  const recentPosts = cleanArray(posts)
    .map((post) => ({
      caption: post.caption || '',
      hashtags: cleanArray(post.hashtags),
      detectedObjects: cleanArray(post.detectedObjects),
      dominantColors: cleanArray(post.dominantColors),
      vibe: cleanArray(post.vibe),
      location: post.location || null,
      hours: post.hours || null,
    }));

  return `You are a brand strategist. Summarize this Instagram account into structured fields.
Input:
- Bio: ${bio || ''}
- Follower count: ${followers ?? ''}
- Recent posts: ${JSON.stringify(recentPosts)}
- Known contact: ${JSON.stringify(contactInfo || {})}

Return JSON:
{
  "businessType": "...",
  "targetAudience": "...",
  "toneWords": ["...", "..."],
  "keywords": ["...", "..."],
  "valueProps": ["...", "..."],
  "servicesOrProducts": ["...", "..."],
  "locationOrHours": "... or null",
  "paletteHints": ["hex or common color names inferred"],
  "styleReferences": ["minimal", "luxury", "playful", etc.],
  "riskFlags": ["nsfw", "medical", "financial", "political", or []]
}
Keep it concise; no marketing copy yet.`;
};

const buildImageTaggingPrompt = () => `You are a web art director. For this image, decide its best web usage.
Describe: dominant colors, presence of people/faces, vibe (e.g., luxury, playful, street, rustic), and suitability scores 0-1 for hero, background, gallery, accent.
Return JSON:
{
  "heroScore": 0-1,
  "backgroundScore": 0-1,
  "galleryScore": 0-1,
  "accentScore": 0-1,
  "detectFaces": true/false,
  "nsfwOrBrandRisk": true/false,
  "notes": "1 short sentence on why"
}`;

const serializeAssetsForPrompt = (assets = []) => assets.map((asset) => ({
  url: asset.url,
  suggestedRoles: asset.suggestedRoles,
  heroScore: asset.heroScore,
  backgroundScore: asset.backgroundScore,
  galleryScore: asset.galleryScore,
  accentScore: asset.accentScore,
}));

const buildSiteGenerationPrompt = ({
  insight,
  assets,
}) => {
  const {
    businessType,
    targetAudience,
    toneWords = [],
    keywords = [],
    valueProps = [],
    servicesOrProducts = [],
    styleReferences = [],
    paletteHints = [],
    locationOrHours = null,
  } = insight || {};

  return `You are a senior brand designer + webflow-level front-end director.
Design a modern, aesthetic, high-conversion landing page for this business.
Use the provided assets only; do not invent new images.

Business summary:
${businessType || 'Unknown business type'}, audience: ${targetAudience || 'Unknown audience'}, keywords: ${keywords.join(', ')}, value props: ${valueProps.join(', ')}, services/products: ${servicesOrProducts.join(', ')}, tone: ${toneWords.join(', ')}, style references: ${styleReferences.join(', ')}, palette hints: ${paletteHints.join(', ')}, location/hours: ${locationOrHours || 'n/a'}.

Assets (only these URLs):
${JSON.stringify(serializeAssetsForPrompt(assets))}

Return JSON with these keys:
{
  "brandName": "invented but plausible name if none exists",
  "tagline": "...",
  "voice": "few words (e.g., 'warm, confident, witty')",
  "palette": {
    "primary": "#xxxxxx",
    "secondary": "#xxxxxx",
    "accent": "#xxxxxx",
    "background": "#xxxxxx",
    "surface": "#xxxxxx",
    "text": "#xxxxxx"
  },
  "fontPairing": {
    "display": "style hint (e.g., geometric sans, humanist sans, serif, grotesk)",
    "body": "style hint"
  },
  "hero": {
    "headline": "...",
    "subhead": "...",
    "ctaPrimary": "short CTA",
    "ctaSecondary": "optional",
    "heroImageUrl": "choose from assets",
    "layoutHint": "e.g., split hero, overlay card, or background with glass card"
  },
  "sections": [
    {
      "type": "services",
      "headline": "...",
      "items": [{ "title": "...", "desc": "1-2 sentences", "iconCue": "simple shape hint" }]
    },
    {
      "type": "about",
      "headline": "...",
      "body": "2-4 sentences",
      "imageUrl": "from assets or null"
    },
    {
      "type": "gallery",
      "headline": "...",
      "imageUrls": ["..."],
      "layoutHint": "masonry or grid"
    },
    {
      "type": "testimonials",
      "items": [
        { "quote": "fabricated but realistic, 1-2 sentences, non-famous name", "name": "First L.", "roleOrCity": "City" }
      ]
    },
    {
      "type": "faq",
      "items": [{ "q": "...", "a": "..." }]
    },
    {
      "type": "cta",
      "headline": "...",
      "subhead": "...",
      "ctaPrimary": "...",
      "ctaSecondary": "optional"
    }
  ],
  "animationDirections": [
    "hero text fade-up with 120ms stagger",
    "cards hover: subtle lift + shadow",
    "gallery: slow parallax on scroll",
    "buttons: micro-scale + glow on hover"
  ],
  "iconStyle": "outline or minimal duotone; avoid emoji",
  "backgroundTreatment": "e.g., soft gradient wash using palette, or subtle noise; keep text legible",
  "seo": { "title": "...", "description": "120-150 chars" },
  "ogImageHint": "describe how to compose OG from hero asset and brand colors"
}
Rules: keep copy tight, avoid clichés, no invented links/emails/phone unless provided, do not reference Instagram explicitly, keep tone consistent with toneWords, stay under 120 tokens per section, only use provided asset URLs.`;
};

module.exports = {
  DEFAULT_TEMPERATURES,
  buildBusinessInsightPrompt,
  buildImageTaggingPrompt,
  buildSiteGenerationPrompt,
};
