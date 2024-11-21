
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();

// Configuration
const SONARQUBE_URL = 'https://sonarcloud.io'; // Replace with your SonarQube server URL
const TOKEN = 'YOUR_SONARQUBE_TOKEN'; // Replace with your SonarQube token
const PORT = 3000;

// Middleware to parse JSON requests
app.use(express.json());

/**
 * Fetch all available metrics for a given project from SonarQube
 */
app.get('/fetch-all-metrics', async (req, res) => {
  const projectKey = req.query.projectKey;

  if (!projectKey) {
    return res.status(400).json({ error: 'Missing required parameter: projectKey' });
  }

  const headers = {
    'Authorization': `Basic ${Buffer.from(`${TOKEN}:`).toString('base64')}`,
  };

  try {
    // Fetch all metrics keys
    const metricsResponse = await axios.get(`${SONARQUBE_URL}/api/metrics/search`, { headers });
    const metricKeys = metricsResponse.data.metrics.map((metric) => metric.key).join(',');

    // Fetch project data for all metrics
    const projectResponse = await axios.get(`${SONARQUBE_URL}/api/measures/component`, {
      headers,
      params: {
        component: projectKey,
        metricKeys,
      },
    });

    const projectData = projectResponse.data.component;
    const metrics = projectData.measures.reduce((acc, metric) => {
      acc[metric.metric] = metric.value;
      return acc;
    }, {});

    const result = {
      project: projectData.key,
      metrics,
    };

    // Save the data to a JSON file
    const outputFilePath = path.join(__dirname, `${projectKey}-metrics.json`);
    fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));

    console.log(`Metrics saved to ${outputFilePath}`);
    res.json({ message: 'Metrics fetched successfully', filePath: outputFilePath });
  } catch (error) {
    console.error('Error fetching metrics:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch metrics', details: error.response?.data || error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

