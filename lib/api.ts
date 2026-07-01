import PocketBase from 'pocketbase';

export const pb = new PocketBase(
  process.env.NEXT_PUBLIC_POCKETBASE_URL
);

export const auth = {
  login: (email: string, password: string) =>
    pb.collection('users').authWithPassword(email, password),
  logout: () => pb.authStore.clear(),
};
