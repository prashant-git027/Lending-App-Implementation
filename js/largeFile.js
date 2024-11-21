

const axios = require('axios');

// Configuration
const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_TOKEN = '<your-github-token>'; // Replace with your GitHub token
const ORG_OR_USER = '<org-or-username>'; // Replace with organization or username
const START_DATE = new Date(new Date().setMonth(new Date().getMonth() - 3)); // 3 months ago

const headers = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
};

/**
 * Helper to calculate weekly ranges from a start date to today.
 */
function calculateWeeklyRanges(startDate) {
  const ranges = [];
  let current = new Date(startDate);
  while (current <= new Date()) {
    const weekStart = new Date(current);
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);

    ranges.push({
      start: weekStart.toISOString(),
      end: weekEnd.toISOString(),
    });

    current.setDate(current.getDate() + 7);
  }
  return ranges;
}

/**
 * Fetch repositories for the user or organization.
 */
async function fetchRepositories() {
  try {
    const response = await axios.get(`${GITHUB_API_URL}/users/${ORG_OR_USER}/repos`, { headers });
    return response.data.map((repo) => ({
      name: repo.name,
      defaultBranch: repo.default_branch,
      url: repo.html_url,
      createdAt: repo.created_at,
    }));
  } catch (error) {
    console.error('Error fetching repositories:', error.message);
    return [];
  }
}

/**
 * Fetch branches for a repository.
 */
async function fetchBranches(repoName) {
  try {
    const response = await axios.get(`${GITHUB_API_URL}/repos/${ORG_OR_USER}/${repoName}/branches`, { headers });
    return response.data.map((branch) => ({
      name: branch.name,
      commitSha: branch.commit.sha,
    }));
  } catch (error) {
    console.error(`Error fetching branches for repository ${repoName}:`, error.message);
    return [];
  }
}

/**
 * Fetch pull requests for a repository in a specific date range.
 */
async function fetchPullRequests(repoName, startDate, endDate) {
  try {
    const response = await axios.get(`${GITHUB_API_URL}/repos/${ORG_OR_USER}/${repoName}/pulls`, {
      headers,
      params: { state: 'all', sort: 'created', direction: 'desc', since: startDate },
    });

    return response.data.filter(
      (pr) => new Date(pr.created_at) >= new Date(startDate) && new Date(pr.created_at) <= new Date(endDate)
    ).map((pr) => ({
      title: pr.title,
      state: pr.state,
      createdAt: pr.created_at,
      mergedAt: pr.merged_at || null,
      user: pr.user.login,
    }));
  } catch (error) {
    console.error(`Error fetching pull requests for ${repoName}:`, error.message);
    return [];
  }
}

/**
 * Fetch commits for a branch in a specific date range.
 */
async function fetchCommits(repoName, branchName, startDate, endDate) {
  try {
    const response = await axios.get(`${GITHUB_API_URL}/repos/${ORG_OR_USER}/${repoName}/commits`, {
      headers,
      params: { sha: branchName, since: startDate, until: endDate },
    });

    return response.data.map((commit) => ({
      message: commit.commit.message,
      author: commit.commit.author.name,
      date: commit.commit.author.date,
    }));
  } catch (error) {
    console.error(`Error fetching commits for ${repoName} on branch ${branchName}:`, error.message);
    return [];
  }
}

/**
 * Main function to fetch weekly data from GitHub.
 */
async function fetchGitHubWeeklyData() {
  const repositories = await fetchRepositories();
  const weeklyRanges = calculateWeeklyRanges(START_DATE);

  const results = [];

  for (const repo of repositories) {
    console.log(`Processing repository: ${repo.name}`);
    const branches = await fetchBranches(repo.name);

    const weeklyData = [];
    for (const range of weeklyRanges) {
      const pullRequests = await fetchPullRequests(repo.name, range.start, range.end);

      const commitsByBranch = {};
      for (const branch of branches) {
        const commits = await fetchCommits(repo.name, branch.name, range.start, range.end);
        commitsByBranch[branch.name] = commits;
      }

      weeklyData.push({
        weekStart: range.start,
        weekEnd: range.end,
        pullRequests,
        commits: commitsByBranch,
      });
    }

    results.push({
      repository: repo,
      branches: branches.map((branch) => branch.name),
      weeklyData,
    });
  }

  return results;
}

// Execute script
(async () => {
  try {
    const weeklyGitHubData = await fetchGitHubWeeklyData();
    console.log('GitHub Weekly Data:', JSON.stringify(weeklyGitHubData, null, 2));
  } catch (error) {
    console.error('Error fetching GitHub weekly data:', error.message);
  }
})();
