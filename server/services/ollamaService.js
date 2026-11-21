const http = require('http');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';

/**
 * Generate a JSON completion from the local Ollama LLM
 */
const generateJson = (prompt, systemPrompt = '', options = {}) => {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      system: systemPrompt,
      stream: false,
      format: 'json',
      options: {
        temperature: 0.1,
        ...options
      }
    });

    const url = new URL('/api/generate', OLLAMA_URL);
    const req = http.request({
      hostname: url.hostname,
      port: url.port || 11434,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 60000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.response) {
            try {
              resolve(JSON.parse(parsed.response));
            } catch (jsonErr) {
              // Try cleaning markdown fences if any
              const clean = parsed.response.replace(/```json|```/gi, '').trim();
              resolve(JSON.parse(clean));
            }
          } else {
            reject(new Error(parsed.error || 'No response from Ollama'));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Ollama request timed out'));
    });

    req.write(payload);
    req.end();
  });
};

module.exports = {
  generateJson,
  OLLAMA_MODEL,
  OLLAMA_URL
};
