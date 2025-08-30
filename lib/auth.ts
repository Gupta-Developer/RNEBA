export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string; // mobile number
  upiId?: string; // e.g., user@upi
  photoUrl?: string; // optional profile picture
};

export type AuthError = {
  code: 'INVALID_CREDENTIALS' | 'UNKNOWN';
  message: string;
};

// Seeded users for mock auth
const USERS: Array<User & { password: string }> = [
  {
    id: 'u-1',
    name: 'Demo User',
    email: 'demo@earnbyapps.com',
    password: 'password',
    photoUrl: 'https://i.pravatar.cc/120?img=12',
  },
  {
    id: 'u-2',
    name: 'Admin',
    email: 'admin@earnbyapps.com',
    password: 'admin123',
    photoUrl: 'https://i.pravatar.cc/120?img=3',
  },
];

let currentUser: User | null = null;
const subs = new Set<(user: User | null) => void>();

function notify() {
  subs.forEach((cb) => cb(currentUser));
}

export function subscribeAuth(cb: (user: User | null) => void) {
  subs.add(cb);
  cb(currentUser);
  return () => subs.delete(cb);
}

export function getUser(): User | null {
  return currentUser ? { ...currentUser } : null;
}

export function updateProfile(input: Partial<Pick<User, 'name' | 'phone' | 'upiId'>>) {
  if (!currentUser) return;
  currentUser = { ...currentUser, ...input };
  // persist into seed list for this session
  const idx = USERS.findIndex((u) => u.email.toLowerCase() === currentUser!.email.toLowerCase());
  if (idx !== -1) {
    USERS[idx] = { ...USERS[idx], ...input } as any;
  }
  notify();
}

export async function login(email: string, password: string): Promise<User> {
  const normalized = String(email || '').trim().toLowerCase();
  const user = USERS.find((u) => u.email.toLowerCase() === normalized && u.password === password);
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 400));
  if (!user) {
    const err: AuthError = { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' };
    throw err;
  }
  currentUser = { id: user.id, name: user.name, email: user.email, phone: user.phone, upiId: user.upiId, photoUrl: user.photoUrl };
  notify();
  return currentUser;
}

export async function googleLogin(): Promise<User> {
  // Simulate a Google auth that returns the demo user
  await new Promise((r) => setTimeout(r, 300));
  const user = USERS[0];
  currentUser = { id: user.id, name: user.name, email: user.email, phone: user.phone, upiId: user.upiId, photoUrl: user.photoUrl };
  notify();
  return currentUser;
}

export function logout() {
  currentUser = null;
  notify();
}
