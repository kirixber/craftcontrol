const axios = require('axios');

const SPIGET_API = 'https://api.spiget.org/v2';

async function searchPlugins(query, limit = 10) {
  try {
    const response = await axios.get(`${SPIGET_API}/search/resources/${encodeURIComponent(query)}`, {
      params: {
        field: 'name',
        size: limit,
        sort: '-downloads',
      },
    });

    return response.data.map(resource => ({
      id: resource.id,
      name: resource.name,
      tag: resource.tag,
      author: resource.author?.name,
      downloads: resource.downloads,
      rating: resource.rating?.average,
      icon: `https://cdn.spiget.org/resource-icons/${resource.id}.png`,
      url: `https://www.spigotmc.org/resources/${resource.id}`,
    }));
  } catch (error) {
    console.error('Spiget search error:', error.message);
    return [];
  }
}

async function getPluginInfo(resourceId) {
  try {
    const response = await axios.get(`${SPIGET_API}/resources/${resourceId}`);
    const data = response.data;

    return {
      id: data.id,
      name: data.name,
      tag: data.tag,
      description: data.description,
      author: data.author?.name,
      downloads: data.downloads,
      rating: data.rating?.average,
      rating_count: data.rating?.count,
      icon: `https://cdn.spiget.org/resource-icons/${data.id}.png`,
      url: `https://www.spigotmc.org/resources/${data.id}`,
      versions: data.versions,
      tested_versions: data.tested_versions,
    };
  } catch (error) {
    console.error('Spiget plugin info error:', error.message);
    return null;
  }
}

async function getPluginDownloadUrl(resourceId, versionId = null) {
  try {
    if (versionId) {
      return `https://cdn.spiget.org/versions/${resourceId}/${versionId}.jar`;
    }
    const info = await getPluginInfo(resourceId);
    if (!info || !info.versions || info.versions.length === 0) return null;
    const latest = info.versions[0];
    return `https://cdn.spiget.org/versions/${resourceId}/${latest}.jar`;
  } catch (error) {
    console.error('Spiget download URL error:', error.message);
    return null;
  }
}

async function getPluginVersions(resourceId) {
  try {
    const response = await axios.get(`${SPIGET_API}/resources/${resourceId}/versions`);
    return response.data.map(v => ({
      id: v.id,
      name: v.name,
      date: v.date,
      size: v.size,
      type: v.type,
    }));
  } catch (error) {
    console.error('Spiget versions error:', error.message);
    return [];
  }
}

module.exports = {
  searchPlugins,
  getPluginInfo,
  getPluginDownloadUrl,
  getPluginVersions,
};
