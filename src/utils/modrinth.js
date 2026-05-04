const axios = require('axios');

const MODRINTH_API = 'https://api.modrinth.com/v2';

async function searchPlugins(query, limit = 10) {
  try {
    const response = await axios.get(`${MODRINTH_API}/search`, {
      params: {
        query: `${query} server plugin`,
        limit,
        facets: [['categories:server-plugin']],
        index: 'relevance',
      },
    });

    return response.data.hits.map(hit => ({
      id: hit.project_id,
      title: hit.title,
      description: hit.description,
      author: hit.author,
      downloads: hit.downloads,
      icon: hit.icon,
      slug: hit.slug,
      categories: hit.categories,
      latest_version: hit.latest_version,
    }));
  } catch (error) {
    console.error('Modrinth search error:', error.message);
    return [];
  }
}

async function getPluginVersions(projectId) {
  try {
    const response = await axios.get(`${MODRINTH_API}/project/${projectId}/version`);
    return response.data.map(v => ({
      id: v.id,
      name: v.name,
      version_number: v.version_number,
      game_versions: v.game_versions,
      loaders: v.loaders,
      files: v.files,
    }));
  } catch (error) {
    console.error('Modrinth versions error:', error.message);
    return [];
  }
}

async function getPluginDownloadUrl(projectId, versionId = null) {
  try {
    let versions;
    if (versionId) {
      const response = await axios.get(`${MODRINTH_API}/version/${versionId}`);
      versions = [response.data];
    } else {
      versions = await getPluginVersions(projectId);
    }

    if (!versions || versions.length === 0) return null;

    const latest = versions[0];
    if (!latest.files || latest.files.length === 0) return null;

    return latest.files[0].url;
  } catch (error) {
    console.error('Modrinth download URL error:', error.message);
    return null;
  }
}

async function getPluginInfo(projectId) {
  try {
    const response = await axios.get(`${MODRINTH_API}/project/${projectId}`);
    const data = response.data;

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      body: data.body,
      categories: data.categories,
      client_side: data.client_side,
      server_side: data.server_side,
      downloads: data.downloads,
      icon: data.icon,
      logo: data.logo,
      slug: data.slug,
      url: `https://modrinth.com/plugin/${data.slug}`,
      versions: await getPluginVersions(projectId),
    };
  } catch (error) {
    console.error('Modrinth plugin info error:', error.message);
    return null;
  }
}

module.exports = {
  searchPlugins,
  getPluginVersions,
  getPluginDownloadUrl,
  getPluginInfo,
};
