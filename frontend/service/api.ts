import { getServerUrl } from './config';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'cashier';
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
}

export interface MenuItem {
  id: number;
  name: string;
  name_en: string;
  price: number;
  category_id: string;
  description: string;
  image: string | null;
  is_available: boolean;
}

export interface OrderItem {
  item_id: number;
  item_name: string;
  qty: number;
  price: number;
}

export interface Order {
  order_id: string;
  order_number: number;
  total: number;
  payment_method: string;
  status: 'pending' | 'completed';
  cashier_name: string;
  created_at: string;
  items: OrderItem[];
}

export interface DailySummary {
  total_orders: string;
  total_revenue: string;
  cash_orders: string;
  cash_revenue: string;
  promptpay_orders: string;
  promptpay_revenue: string;
  card_orders: string;
  card_revenue: string;
}

// ─── Token Storage ───────────────────────────────────────────────────────────

const TOKEN_KEY = 'pos_cafe_token';
const USER_KEY = 'pos_cafe_user';

export function saveSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser(): User | null {
  try {
    const u = localStorage.getItem(USER_KEY);
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}

// ─── HTTP Client ─────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${getServerUrl()}${path}`, {
      ...options,
      signal: AbortSignal.timeout(8000),
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการตั้งค่า');
    }
    throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการตั้งค่า');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ─── Menu ─────────────────────────────────────────────────────────────────────

export async function fetchCategories(): Promise<Category[]> {
  return request('/api/menu/categories');
}
export async function fetchMenuItems(category?: string): Promise<MenuItem[]> {
  const q = category ? `?category=${category}` : '';
  return request(`/api/menu/items${q}`);
}

// ─── Orders ───────────────────────────────────────────────────────────────────
export async function createOrder(
  items: OrderItem[],
  payment_method: string
): Promise<Order> {
  return request('/api/orders', {
    method: 'POST',
    body: JSON.stringify({ items, payment_method }),
  });
}

export async function fetchOrders(date?: string, status?: string): Promise<Order[]> {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (status) params.set('status', status);
  const q = params.toString();
  return request(`/api/orders${q ? `?${q}` : ''}`);
}

export async function updateOrderStatus(
  orderId: string,
  status: 'pending' | 'completed'
): Promise<{ success: boolean; order_id: string; status: string }> {
  return request(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function fetchDailySummary(date?: string): Promise<DailySummary> {
  const q = date ? `?date=${date}` : '';
  return request(`/api/orders/summary/daily${q}`);
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function checkHealth(): Promise<boolean> {
  try {
    await fetch(`${getServerUrl()}/api/health`, { signal: AbortSignal.timeout(3000) });
    return true;
  } catch {
    return false;
  }
}
