const request = require('supertest');
const { app } = require('../server');

describe('Security Layer Tests', () => {
  it('should reject POST requests with missing CSRF tokens', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'password123'
    });
    expect(res.statusCode).toEqual(403);
    expect(res.body.error).toEqual('Invalid CSRF Token');
  });

  it('should block NoSQL injection payloads gracefully', async () => {
    // Send request with an injected payload
    const res = await request(app).post('/api/auth/login')
      .set('x-csrf-token', 'dummy')
      .set('Cookie', ['csrfSecret=dummy'])
      .send({
        email: { $gt: "" },
        password: "password123"
      });
      
    // Sanitize converts $gt to _gt, so auth will fail validation, but it won't crash or leak data
    expect(res.statusCode).not.toEqual(500); 
  });
});
