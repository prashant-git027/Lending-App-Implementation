
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
 * Helper function to calculate weekly date ranges
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
 * Fetch repositories for the organization or user.
 */
async function fetchRepositories() {
  try {
    const response = await axios.get(`${GITHUB_API_URL}/users/${ORG_OR_USER}/repos`, { headers });
    return response.data.map((repo) => ({
      name: repo.name,
      defaultBranch: repo.default_branch,
      createdAt: repo.created_at,
      url: repo.html_url,
    }));
  } catch (error) {
    console.error('Error fetching repositories:', error.message);
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
 * Fetch commits for a repository in a specific date range.
 */
async function fetchCommits(repoName, startDate, endDate) {
  try {
    const response = await axios.get(`${GITHUB_API_URL}/repos/${ORG_OR_USER}/${repoName}/commits`, {
      headers,
      params: { since: startDate, until: endDate },
    });

    return response.data.map((commit) => ({
      message: commit.commit.message,
      author: commit.commit.author.name,
      date: commit.commit.author.date,
    }));
  } catch (error) {
    console.error(`Error fetching commits for ${repoName}:`, error.message);
    return [];
  }
}

/**
 * Fetch deployment details for a repository.
 */
async function fetchDeployments(repoName) {
  try {
    const response = await axios.get(`${GITHUB_API_URL}/repos/${ORG_OR_USER}/${repoName}/deployments`, { headers });
    return response.data.map((deployment) => ({
      sha: deployment.sha,
      environment: deployment.environment,
      status: deployment.status,
    }));
  } catch (error) {
    console.error(`Error fetching deployments for ${repoName}:`, error.message);
    return [];
  }
}

/**
 * Fetch protection rules for a repository.
 */
async function fetchProtectionRules(repoName) {
  try {
    const response = await axios.get(`${GITHUB_API_URL}/repos/${ORG_OR_USER}/${repoName}/branches/${repoName}/protection`, { headers });
    return response.data;
  } catch (error) {
    console.error(`Error fetching protection rules for ${repoName}:`, error.message);
    return null;
  }
}

/**
 * Fetch issues, assignees, comments, events, labels, milestones
 */
async function fetchIssues(repoName, startDate, endDate) {
  try {
    const response = await axios.get(`${GITHUB_API_URL}/repos/${ORG_OR_USER}/${repoName}/issues`, {
      headers,
      params: { state: 'all', since: startDate },
    });

    const issues = response.data.filter((issue) => {
      return new Date(issue.created_at) >= new Date(startDate) && new Date(issue.created_at) <= new Date(endDate);
    });

    const issuesData = await Promise.all(issues.map(async (issue) => {
      const comments = await axios.get(issue.comments_url, { headers });
      const events = await axios.get(issue.events_url, { headers });
      const labels = issue.labels.map((label) => label.name);
      const milestones = issue.milestone ? issue.milestone.title : null;

      return {
        title: issue.title,
        createdAt: issue.created_at,
        user: issue.user.login,
        assignees: issue.assignees ? issue.assignees.map((assignee) => assignee.login) : [],
        comments: comments.data,
        events: events.data,
        labels,
        milestones,
      };
    }));

    return issuesData;
  } catch (error) {
    console.error(`Error fetching issues for ${repoName}:`, error.message);
    return [];
  }
}

/**
 * Main function to fetch weekly data from GitHub.
 */
async function fetchWeeklyGitHubData() {
  const repositories = await fetchRepositories();
  const weeklyRanges = calculateWeeklyRanges(START_DATE);
  const weeklyData = [];

  for (const repo of repositories) {
    const repoData = {
      repoName: repo.name,
      createdAt: repo.createdAt,
      defaultBranch: repo.defaultBranch,
      deployments: [],
      protectionRules: null,
      issues: [],
      commits: [],
      pullRequests: [],
    };

    for (const range of weeklyRanges) {
      const pullRequests = await fetchPullRequests(repo.name, range.start, range.end);
      const commits = await fetchCommits(repo.name, range.start, range.end);
      const deployments = await fetchDeployments(repo.name);
      const protectionRules = await fetchProtectionRules(repo.name);
      const issues = await fetchIssues(repo.name, range.start, range.end);

      repoData.deployments.push(deployments);
      repoData.protectionRules = protectionRules;
      repoData.pullRequests.push(pullRequests);
      repoData.commits.push(commits);
      repoData.issues.push(issues);
    }

    weeklyData.push(repoData);
  }

  return weeklyData;
}

// Run the script
(async () => {
  try {
    const data = await fetchWeeklyGitHubData();
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error fetching GitHub data:', error.message);
  }
})();
