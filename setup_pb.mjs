import fs from 'fs';

async function main() {
  const url = 'http://127.0.0.1:8090';
  
  // Authenticate as admin
  const authRes = await fetch(`${url}/api/admins/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'admin@chitra.local', password: 'admin123456' })
  });
  
  if (!authRes.ok) {
    console.error('Failed to authenticate:', await authRes.text());
    return;
  }
  
  const { token } = await authRes.json();
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const collections = [
    {
      name: 'rooms',
      type: 'base',
      schema: [
        { name: 'name', type: 'text', required: true },
        { name: 'created_by', type: 'text', required: true }
      ]
    },
    {
      name: 'drawings',
      type: 'base',
      schema: [
        { name: 'room_id', type: 'text', required: true },
        { name: 'user_id', type: 'text', required: true },
        { name: 'strokes', type: 'json', options: { maxSize: 2000000 } },
        { name: 'timestamp', type: 'text' }
      ]
    },
    {
      name: 'users_realtime',
      type: 'base',
      schema: [
        { name: 'room_id', type: 'text', required: true },
        { name: 'user_id', type: 'text', required: true },
        { name: 'cursor_x', type: 'number' },
        { name: 'cursor_y', type: 'number' },
        { name: 'color', type: 'text' }
      ]
    }
  ];

  for (const collection of collections) {
    const res = await fetch(`${url}/api/collections`, {
      method: 'POST',
      headers,
      body: JSON.stringify(collection)
    });
    
    if (res.ok) {
      console.log(`Created collection: ${collection.name}`);
    } else {
      console.error(`Failed to create ${collection.name}:`, await res.text());
    }
  }
}

main().catch(console.error);
