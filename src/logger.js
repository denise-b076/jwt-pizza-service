class Logger {
  constructor(config) {
    this.config = config;
  }

  httpLogger = (req, res, next) => {
    let send = res.send;
    res.send = (resBody) => {
      const logData = {
        userId: req.user?.id ?? null,
        authorized: !!req.headers.authorization,
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: req.body ?? null,
        resBody: resBody ?? null,
      };
      const level = this.statusToLogLevel(res.statusCode);
      if (level == "error") {
        this.log(level, 'unhandledException', logData);
      }
      else {
        this.log(level, 'http', logData);
      }
      res.send = send;
      return res.send(resBody);
    };
    next();
  };

  dbLogger(query) {
    const queryData = {
      sqlQuery: query
    };
    this.log('info', 'db', queryData);
  }

  factoryLogger(requestBody, responseBody) {
    const logData = {
      userId: requestBody.diner.id,
      reqBody: requestBody,
      resBody: responseBody
    };
    this.log('info', 'factory', logData);
  }

  log(level, type, logData) {
    const labels = { component: this.config.logging.source, level: level, type: type };
    const values = [this.nowString(), this.sanitize(logData)];
    const logEvent = { streams: [{ stream: labels, values: [values] }] };

    this.sendLogToGrafana(logEvent);
  }

  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  nowString() {
    return (Math.floor(Date.now()) * 1000000).toString();
  }

  sanitize(logData) {
    const sensitiveFields = new Set(['password', 'email', 'name', 'token', 'jwt']);

    const redact = (value) => {
      if (Array.isArray(value)) {
        return value.map(redact);
      }
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value).map(([key, fieldValue]) => [
            key,
            sensitiveFields.has(key.toLowerCase()) ? '*****' : redact(fieldValue),
          ])
        );
      }
      if (typeof value === 'string') {
        try {
          return redact(JSON.parse(value));
        } catch {
          return value;
        }
      }
      return value;
    };

    return JSON.stringify(redact(logData));
  }

  async sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    try {
      const res = await fetch(`${this.config.logging.url}`, {
        method: 'post',
        body: body,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.logging.userId}:${this.config.logging.apiKey}`,
        },
      });
      if (!res.ok) {
        console.log('Failed to send log to Grafana');
      }
    } catch (error) {
      console.log('Error sending log to Grafana:', error);
    }
  }
}
module.exports = Logger;