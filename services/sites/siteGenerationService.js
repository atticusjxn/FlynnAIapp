const { fetchInstagramProfile } = require('./instagramScraper');
const {
  DEFAULT_TEMPERATURES,
  buildBusinessInsightPrompt,
  buildImageTaggingPrompt,
  buildSiteGenerationPrompt,
} = require('./geminiPrompts');
const {
  runJsonPrompt,
  runVisionJsonPrompt,
} = require('./geminiClient');

const deriveSuggestedRoles = (scores) => {
  const roles = [];
  if (scores.heroScore >= 0.55) roles.push('hero');
  if (scores.backgroundScore >= 0.55) roles.push('background');
  if (scores.galleryScore >= 0.35) roles.push('gallery');
  if (scores.accentScore >= 0.35) roles.push('accent');
  return roles.length > 0 ? roles : ['gallery'];
};

const tagAssets = async (images = []) => {
  const prompt = buildImageTaggingPrompt();
  const tagged = [];
  const warnings = [];

  for (const image of images) {
    try {
      const tags = await runVisionJsonPrompt(prompt, image.imageUrl, {
        temperature: DEFAULT_TEMPERATURES.vision,
        maxOutputTokens: 400,
      });

      const entry = {
        ...image,
        ...tags,
      };
      entry.suggestedRoles = deriveSuggestedRoles(entry);
      tagged.push(entry);
    } catch (error) {
      warnings.push(`Failed to tag image ${image.id || image.imageUrl}: ${error.message}`);
    }
  }

  return { tagged, warnings };
};

const buildInsight = async ({ profile, posts }) => {
  const prompt = buildBusinessInsightPrompt({
    bio: profile?.bio,
    followers: profile?.followers,
    contactInfo: null,
    posts,
  });

  return runJsonPrompt(prompt, {
    temperature: DEFAULT_TEMPERATURES.classify,
    maxOutputTokens: 900,
  });
};

const pickAssets = (tagged = []) => tagged
  .filter(asset => !asset.nsfwOrBrandRisk)
  .sort((a, b) => (b.heroScore || 0) - (a.heroScore || 0));

const generateSiteFromInstagram = async ({ handle, imageLimit = 12 }) => {
  const generationWarnings = [];

  const { profile, posts, warnings: scrapeWarnings = [] } = await fetchInstagramProfile(handle, { limit: imageLimit });
  generationWarnings.push(...scrapeWarnings);

  const postsWithImages = posts.filter(post => post.imageUrl).slice(0, imageLimit);

  const insight = await buildInsight({ profile, posts: postsWithImages });

  const { tagged, warnings: tagWarnings } = await tagAssets(postsWithImages);
  generationWarnings.push(...tagWarnings);

  const curatedAssets = pickAssets(tagged);

  const sitePrompt = buildSiteGenerationPrompt({ insight, assets: curatedAssets });
  const siteSpec = await runJsonPrompt(sitePrompt, {
    temperature: DEFAULT_TEMPERATURES.site,
    maxOutputTokens: 2200,
  });

  return {
    profile,
    insight,
    assets: curatedAssets,
    rawAssets: tagged,
    siteSpec,
    warnings: generationWarnings,
  };
};

module.exports = {
  generateSiteFromInstagram,
};
