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

  const collections = ['rooms', 'drawings', 'users_realtime'];

  for (const name of collections) {
    // get collection id
    let res = await fetch(`${url}/api/collections/${name}`, { headers });
    let collection = await res.json();

    collection.listRule = "";
    collection.viewRule = "";
    collection.createRule = "";
    collection.updateRule = "";
    collection.deleteRule = "";

    let updateRes = await fetch(`${url}/api/collections/${collection.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(collection)
    });

    if (updateRes.ok) {
      console.log(`Updated rules for: ${name}`);
    } else {
      console.error(`Failed to update ${name}:`, await updateRes.text());
    }
  }
}

main().catch(console.error);
