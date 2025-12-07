const axios = require('axios');

const parseHashtags = (caption = '') => {
  const matches = caption.match(/#([a-zA-Z0-9_]+)/g) || [];
  return matches.map(tag => tag.replace('#', '')).slice(0, 15);
};

const mapMediaToPosts = (media = []) => media
  .filter(item => item.media_url)
  .map((item) => ({
    id: item.id,
    caption: item.caption || '',
    hashtags: parseHashtags(item.caption),
    imageUrl: item.media_url,
    mediaType: item.media_type,
    permalink: item.permalink,
    timestamp: item.timestamp,
  }));

const fetchInstagramProfile = async (handle, { limit = 12 } = {}) => {
  if (!handle) {
    throw new Error('Instagram handle is required');
  }

  const accessToken = (process.env.INSTAGRAM_GRAPH_TOKEN || '').trim();
  const businessId = (process.env.INSTAGRAM_BUSINESS_ID || '').trim();

  if (!accessToken) {
    return {
      profile: { handle, followers: null, bio: null },
      posts: [],
      warnings: ['INSTAGRAM_GRAPH_TOKEN not configured; returning empty dataset.'],
    };
  }

  if (!businessId) {
    return {
      profile: { handle, followers: null, bio: null },
      posts: [],
      warnings: ['INSTAGRAM_BUSINESS_ID not configured; returning empty dataset until Graph setup is completed.'],
    };
  }

  const commonParams = { access_token: accessToken };
  const profilePromise = axios.get(`https://graph.instagram.com/${businessId}`, {
    params: {
      ...commonParams,
      fields: 'id,username,biography,followers_count,name',
    },
  });

  const mediaPromise = axios.get(`https://graph.instagram.com/${businessId}/media`, {
    params: {
      ...commonParams,
      fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username',
      limit,
    },
  });

  const [profileResp, mediaResp] = await Promise.all([profilePromise, mediaPromise]);
  const profileData = profileResp.data || {};
  const mediaData = mediaResp.data?.data || [];

  return {
    profile: {
      handle: profileData.username || handle,
      name: profileData.name || null,
      bio: profileData.biography || null,
      followers: profileData.followers_count ?? null,
    },
    posts: mapMediaToPosts(mediaData),
    warnings: [],
  };
};

module.exports = {
  fetchInstagramProfile,
};
