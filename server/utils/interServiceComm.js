const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

/**
 * Inter-Service Communication Utility
 * Features:
 * 1. Exponential Backoff Retries
 * 2. Circuit Breaker Pattern
 * 3. Correlation ID for SOC-compliant logging
 */

class CircuitBreaker {
  constructor(failureThreshold = 3, resetTimeout = 10000) {
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.nextAttempt = null;
  }

  async fire(requestFn) {
    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttempt) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit Breaker is OPEN. Request blocked.');
      }
    }

    try {
      const result = await requestFn();
      return this.onSuccess(result);
    } catch (error) {
      return this.onFailure(error);
    }
  }

  onSuccess(result) {
    this.failures = 0;
    this.state = 'CLOSED';
    return result;
  }

  onFailure(error) {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.warn(`[CIRCUIT BREAKER] State changed to OPEN. Will reset after ${this.resetTimeout}ms.`);
    }
    throw error;
  }
}

const circuitBreakers = new Map();

/**
 * Fetch with Exponential Backoff
 */
async function fetchWithBackoff(url, options, retries = 3, backoff = 300) {
  try {
    const response = await axios({ url, ...options });
    return response;
  } catch (error) {
    if (retries === 0 || !error.response || error.response.status < 500) {
      throw error;
    }
    console.log(`[RETRY] Retrying ${url} in ${backoff}ms... (${retries} retries left)`);
    await new Promise((res) => setTimeout(res, backoff));
    return fetchWithBackoff(url, options, retries - 1, backoff * 2);
  }
}

/**
 * Make an Inter-Service Request
 */
async function makeServiceRequest(serviceName, url, options = {}) {
  const correlationId = options.correlationId || uuidv4();
  
  if (!options.headers) {
    options.headers = {};
  }
  options.headers['X-Correlation-ID'] = correlationId;

  console.log(`[INTER-SERVICE] [${correlationId}] Requesting ${serviceName} at ${url}`);

  if (!circuitBreakers.has(serviceName)) {
    circuitBreakers.set(serviceName, new CircuitBreaker(3, 10000));
  }
  const breaker = circuitBreakers.get(serviceName);

  return breaker.fire(() => fetchWithBackoff(url, options));
}

module.exports = { makeServiceRequest, CircuitBreaker };
