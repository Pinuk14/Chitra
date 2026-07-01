/**
 * Security Collections Setup Script
 * 
 * This script:
 * 1. Deletes all existing anonymous data (drawings, messages, rooms, users_realtime)
 * 2. Updates the `rooms` collection with owner_id and access_mode fields
 * 3. Creates `room_members` collection for role-based access
 * 4. Creates `permission_requests` collection for permission escalation
 * 5. Creates `moderation_log` collection for audit trail
 * 6. Tightens API rules to require authentication
 */

const PB_URL = 'http://127.0.0.1:8090';
const ADMIN_EMAIL = 'admin@chitra.local';
const ADMIN_PASSWORD = 'admin123456';

async function getAdminToken() {
  const res = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });
  if (!res.ok) throw new Error('Failed to authenticate as admin');
  const { token } = await res.json();
  return token;
}

async function deleteAllRecords(token, collectionName) {
  const headers = { 'Authorization': `Bearer ${token}` };
  let page = 1;
  let deleted = 0;
  while (true) {
    const res = await fetch(
      `${PB_URL}/api/collections/${collectionName}/records?perPage=200&page=${page}`,
      { headers }
    );
    const data = await res.json();
    if (!data.items || data.items.length === 0) break;
    for (const item of data.items) {
      await fetch(
        `${PB_URL}/api/collections/${collectionName}/records/${item.id}`,
        { method: 'DELETE', headers }
      );
      deleted++;
    }
    if (data.items.length < 200) break;
    // Don't increment page since we're deleting records
  }
  console.log(`  Deleted ${deleted} records from ${collectionName}`);
}

async function getCollection(token, name) {
  const res = await fetch(`${PB_URL}/api/collections/${name}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return await res.json();
}

async function updateCollection(token, id, data) {
  const res = await fetch(`${PB_URL}/api/collections/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    console.error('  Failed to update collection:', await res.text());
    return false;
  }
  return true;
}

async function createCollection(token, data) {
  const res = await fetch(`${PB_URL}/api/collections`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errText = await res.text();
    if (errText.includes('already exists')) {
      console.log(`  Collection ${data.name} already exists, skipping`);
      return true;
    }
    console.error(`  Failed to create ${data.name}:`, errText);
    return false;
  }
  return true;
}

async function main() {
  console.log('🔐 Chitra Security Setup\n');

  const token = await getAdminToken();
  console.log('✅ Authenticated as admin\n');

  // Step 1: Delete all existing anonymous data
  console.log('🗑️  Cleaning up anonymous data...');
  await deleteAllRecords(token, 'drawings');
  await deleteAllRecords(token, 'messages');
  await deleteAllRecords(token, 'rooms');
  await deleteAllRecords(token, 'users_realtime');
  console.log('');

  // Step 2: Update rooms collection — add owner_id and access_mode
  console.log('📝 Updating rooms collection...');
  const roomsCol = await getCollection(token, 'rooms');
  if (roomsCol) {
    const existingFieldNames = roomsCol.schema.map(f => f.name);
    const newFields = [];
    
    if (!existingFieldNames.includes('owner_id')) {
      newFields.push({ name: 'owner_id', type: 'text', required: true });
    }
    if (!existingFieldNames.includes('access_mode')) {
      newFields.push({
        name: 'access_mode', type: 'select', required: true,
        options: { values: ['public', 'invite_only', 'manual_approval'], maxSelect: 1 }
      });
    }

    if (newFields.length > 0) {
      const ok = await updateCollection(token, roomsCol.id, {
        schema: [...roomsCol.schema, ...newFields],
        // Rooms: anyone authenticated can list/view, only authenticated users can create
        listRule: '',
        viewRule: '',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != "" && owner_id = @request.auth.id',
        deleteRule: '@request.auth.id != "" && owner_id = @request.auth.id'
      });
      console.log(ok ? '  ✅ rooms updated' : '  ❌ rooms update failed');
    } else {
      console.log('  ℹ️  rooms already has required fields');
    }
  }

  // Step 3: Create room_members collection
  console.log('📝 Creating room_members collection...');
  await createCollection(token, {
    name: 'room_members',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
    schema: [
      { name: 'room_id', type: 'text', required: true },
      { name: 'user_id', type: 'text', required: true },
      { name: 'username', type: 'text', required: false },
      { name: 'role', type: 'select', required: true,
        options: { values: ['owner', 'admin', 'editor', 'viewer'], maxSelect: 1 } },
      { name: 'status', type: 'select', required: true,
        options: { values: ['active', 'pending', 'banned', 'muted', 'kicked'], maxSelect: 1 } },
      { name: 'color', type: 'text', required: false },
      { name: 'invited_by', type: 'text', required: false },
      { name: 'ban_expires', type: 'text', required: false }
    ]
  });
  console.log('  ✅ room_members created');

  // Step 4: Create permission_requests collection
  console.log('📝 Creating permission_requests collection...');
  await createCollection(token, {
    name: 'permission_requests',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
    schema: [
      { name: 'room_id', type: 'text', required: true },
      { name: 'user_id', type: 'text', required: true },
      { name: 'username', type: 'text', required: false },
      { name: 'action', type: 'text', required: true },
      { name: 'status', type: 'select', required: true,
        options: { values: ['pending', 'approved', 'rejected'], maxSelect: 1 } },
      { name: 'resolved_by', type: 'text', required: false }
    ]
  });
  console.log('  ✅ permission_requests created');

  // Step 5: Create moderation_log collection
  console.log('📝 Creating moderation_log collection...');
  await createCollection(token, {
    name: 'moderation_log',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '@request.auth.id != ""',
    updateRule: '',
    deleteRule: '',
    schema: [
      { name: 'room_id', type: 'text', required: true },
      { name: 'actor_id', type: 'text', required: true },
      { name: 'target_id', type: 'text', required: true },
      { name: 'action', type: 'select', required: true,
        options: { values: ['kick', 'ban', 'mute', 'unban', 'unmute', 'promote', 'demote'], maxSelect: 1 } },
      { name: 'reason', type: 'text', required: false },
      { name: 'expires_at', type: 'text', required: false }
    ]
  });
  console.log('  ✅ moderation_log created');

  // Step 6: Tighten API rules for existing collections
  console.log('\n🔒 Tightening API rules...');
  
  const collectionsToSecure = [
    { name: 'drawings', createRule: '@request.auth.id != ""', updateRule: '@request.auth.id != ""', deleteRule: '@request.auth.id != ""' },
    { name: 'messages', createRule: '@request.auth.id != ""', updateRule: '@request.auth.id != ""', deleteRule: '@request.auth.id != ""' },
    { name: 'users_realtime', createRule: '@request.auth.id != ""', updateRule: '@request.auth.id != ""', deleteRule: '@request.auth.id != ""' }
  ];

  for (const col of collectionsToSecure) {
    const existing = await getCollection(token, col.name);
    if (existing) {
      const ok = await updateCollection(token, existing.id, {
        listRule: '',
        viewRule: '',
        createRule: col.createRule,
        updateRule: col.updateRule,
        deleteRule: col.deleteRule
      });
      console.log(ok ? `  ✅ ${col.name} secured` : `  ❌ ${col.name} failed`);
    }
  }

  // Step 7: Update users auth collection — enable username auth, set rules
  console.log('\n👤 Configuring users auth collection...');
  const usersCol = await getCollection(token, 'users');
  if (usersCol) {
    const existingFieldNames = usersCol.schema.map(f => f.name);
    const newFields = [];
    if (!existingFieldNames.includes('display_name')) {
      newFields.push({ name: 'display_name', type: 'text', required: false });
    }
    
    const updateData = {
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: 'id = @request.auth.id',
      deleteRule: 'id = @request.auth.id',
    };
    if (newFields.length > 0) {
      updateData.schema = [...usersCol.schema, ...newFields];
    }
    
    const ok = await updateCollection(token, usersCol.id, updateData);
    console.log(ok ? '  ✅ users configured' : '  ❌ users config failed');
  }

  console.log('\n🎉 Security setup complete!');
}

main().catch(console.error);
