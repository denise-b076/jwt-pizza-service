const config = require('./config');
const os = require('os');

const requests = {};
const authenticationAttempts = {};
const pizzaOrderAttempts = {};
let latencyTotal = 0;
let pizzaLatencyTotal = 0;
let latencyCount = 0;
let pizzaLatencyCount = 0;
let pizzaRevenueTotal = 0;

function requestTracker(req, res, next) {
    const start = Date.now();
    res.once('finish', () => {
        latencyTotal += Date.now() - start;
        latencyCount += 1;
    });
    const endpoint = `[${req.method}] ${req.path}`;
    requests[endpoint] = (requests[endpoint] || 0) + 1;
    requests['all'] = (requests['all'] || 0) + 1;
    next();
}

function authenticationAttemptTracker(res) {
    res.once('finish', () => {
        const status = res.statusCode;
        const result = status === 200 ? 'successes' : 'failures';

        authenticationAttempts[result] = (authenticationAttempts[result] || 0) + 1;
    });
}

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return Number(memoryUsage.toFixed(2));
}

function pizzaPurchase(status, res, order) {
    const start = Date.now();
    res.once('finish', () => {
        pizzaLatencyTotal += Date.now() - start;
        pizzaLatencyCount += 1;
    });
    if (status === 'success') {
        for (const item of order.items) {
            pizzaRevenueTotal += Number(item.price);
        }
    }
    pizzaOrderAttempts[status] = (pizzaOrderAttempts[status] || 0) + 1;
}

setInterval(() => {
  const metrics = [];
  Object.keys(requests).forEach((endpoint) => {
    metrics.push(createMetric('requests', requests[endpoint], '1', 'sum', 'asInt', { endpoint }));
  });
  
  Object.keys(authenticationAttempts).forEach((status) => {
    metrics.push(createMetric('authentication_attempts', authenticationAttempts[status], '1', 'sum', 'asInt', { status }));
  });

  Object.keys(pizzaOrderAttempts).forEach((status) => {
    metrics.push(createMetric('pizza_order_attempts', pizzaOrderAttempts[status], '1', 'sum', 'asInt', { status }));
  });

  const cpuUsage = getCpuUsagePercentage();
  const memoryUsage = getMemoryUsagePercentage();
  metrics.push(createMetric('cpu_usage', cpuUsage, '%', 'gauge', 'asDouble', { display_name: 'CPU' }));
  metrics.push(createMetric('memory_usage', memoryUsage, '%', 'gauge', 'asDouble', { display_name: 'Memory' }));

  metrics.push(createMetric('pizza_revenue', pizzaRevenueTotal, 'BTC', 'sum', 'asDouble', {}));

  metrics.push(createMetric('latency_total', latencyTotal, 'ms', 'sum', 'asInt', {}));
  metrics.push(createMetric('latency_count', latencyCount, '1', 'sum', 'asInt', {}));

  metrics.push(createMetric('pizza_latency_total', pizzaLatencyTotal, 'ms', 'sum', 'asInt', {}));
  metrics.push(createMetric('pizza_latency_count', pizzaLatencyCount, '1', 'sum', 'asInt', {}));

  sendMetricToGrafana(metrics);
}, 10000);

function createMetric(metricName, metricValue, metricUnit, metricType, valueType, attributes) {
  attributes = { ...attributes, source: config.metrics.source };

  const metric = {
    name: metricName,
    unit: metricUnit,
    [metricType]: {
      dataPoints: [
        {
          [valueType]: metricValue,
          timeUnixNano: Date.now() * 1000000,
          attributes: [],
        },
      ],
    },
  };

  Object.keys(attributes).forEach((key) => {
    metric[metricType].dataPoints[0].attributes.push({
      key: key,
      value: { stringValue: attributes[key] },
    });
  });

  if (metricType === 'sum') {
    metric[metricType].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    metric[metricType].isMonotonic = true;
  }

  return metric;
}

function sendMetricToGrafana(metrics) {
  const body = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics,
          },
        ],
      },
    ],
  };

  fetch(`${config.metrics.endpointUrl}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${config.metrics.accountId}:${config.metrics.apiKey}`, 'Content-Type': 'application/json' },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`);
      }
    })
    .catch((error) => {
      console.error('Error pushing metrics:', error);
    });
}

module.exports = { requestTracker, authenticationAttemptTracker, pizzaPurchase };