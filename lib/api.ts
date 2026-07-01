import PocketBase from 'pocketbase';

// Detect if we should use HTTPS based on the window location (if in browser)
let pbUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8090';
if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
  pbUrl = pbUrl.replace('http://', 'https://');
}

export const pb = new PocketBase(pbUrl);

export const auth = {
  login: (email: string, password: string) =>
    pb.collection('users').authWithPassword(email, password),
  logout: () => pb.authStore.clear(),
};
