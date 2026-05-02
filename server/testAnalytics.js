async function test() {
  try {
    const res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@medisync.com', password: 'Admin@123' })
    });
    const { token } = await res.json();

    const analyticsRes = await fetch('http://localhost:5000/api/admin/analytics', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Analytics status:', analyticsRes.status);
    const data = await analyticsRes.text();
    console.log('Analytics response:', data.substring(0, 150));
  } catch(e) {
    console.error(e);
  }
}
test();
