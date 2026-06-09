const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

export type ApiError = {
  success: false;
  error: { code: string; message: string };
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: { page: number; per_page: number; total: number };
};

export class ApiClientError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string; idempotencyKey?: string } = {}
): Promise<T> {
  const { token, idempotencyKey, headers, ...rest } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      ...headers,
    },
  });

  const body = await res.json();
  if (!res.ok || body.success === false) {
    const err = body as ApiError;
    throw new ApiClientError(
      res.status,
      err.error?.code || "UNKNOWN",
      err.error?.message || "Request failed"
    );
  }
  return (body as ApiSuccess<T>).data;
}

export const api = {
  register: (data: { email: string; password: string; full_name: string; phone?: string }) =>
    request<{ user: User; tokens: Tokens }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    request<{ user: User; tokens: Tokens }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  me: (token: string) => request<User>("/auth/me", { token }),

  listEvents: (params?: { q?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.page) qs.set("page", String(params.page));
    const query = qs.toString();
    return fetch(`${API_URL}/events${query ? `?${query}` : ""}`).then(async (res) => {
      const body = await res.json();
      if (!body.success) throw new ApiClientError(res.status, body.error?.code, body.error?.message);
      return body as ApiSuccess<Event[]>;
    });
  },

  getEvent: (slug: string) =>
    request<{ event: Event; ticket_types: TicketType[] }>(`/events/${slug}`),

  getAvailability: (slug: string) =>
    request<Availability[]>(`/events/${slug}/availability`),

  holdBooking: (
    token: string,
    idempotencyKey: string,
    data: { event_id: string; items: { ticket_type_id: string; quantity: number }[] }
  ) =>
    request<Booking>("/bookings/hold", {
      method: "POST",
      token,
      idempotencyKey,
      body: JSON.stringify(data),
    }),

  getBooking: (token: string, id: string) =>
    request<Booking>(`/bookings/${id}`, { token }),

  listBookings: (token: string) => request<BookingSummary[]>("/bookings", { token }),

  confirmBooking: (token: string, id: string) =>
    request<{ booking_id: string; status: string; total_amount: number }>(
      `/bookings/${id}/confirm`,
      { method: "POST", token }
    ),

  cancelBooking: (token: string, id: string) =>
    request<{ message: string }>(`/bookings/${id}`, { method: "DELETE", token }),

  simulatePayment: (token: string, bookingId: string) =>
    request<{ message: string; booking_id: string }>("/payments/simulate", {
      method: "POST",
      token,
      body: JSON.stringify({ booking_id: bookingId }),
    }),

  listTickets: (token: string, bookingId: string) =>
    request<Ticket[]>(`/bookings/${bookingId}/tickets`, { token }),

  // ── Admin ──
  adminStats: (token: string) =>
    request<AdminStats>("/admin/dashboard/stats", { token }),

  adminListEvents: (token: string, params?: { status?: string; q?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.q) qs.set("q", params.q);
    if (params?.page) qs.set("page", String(params.page));
    const query = qs.toString();
    return fetch(`${API_URL}/admin/events${query ? `?${query}` : ""}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (res) => {
      const body = await res.json();
      if (!body.success) throw new ApiClientError(res.status, body.error?.code, body.error?.message);
      return body as ApiSuccess<AdminEvent[]>;
    });
  },

  adminGetEvent: (token: string, id: string) =>
    request<{ event: AdminEventDetail; ticket_types: AdminTicketType[] }>(
      `/admin/events/${id}`,
      { token }
    ),

  adminCreateEvent: (token: string, data: AdminEventInput) =>
    request<AdminEventDetail>("/admin/events", {
      method: "POST",
      token,
      body: JSON.stringify(data),
    }),

  adminUpdateEvent: (token: string, id: string, data: AdminEventInput) =>
    request<AdminEventDetail>(`/admin/events/${id}`, {
      method: "PUT",
      token,
      body: JSON.stringify(data),
    }),

  adminCreateTicketType: (
    token: string,
    eventId: string,
    data: AdminTicketTypeInput
  ) =>
    request<AdminTicketType>(`/admin/events/${eventId}/ticket-types`, {
      method: "POST",
      token,
      body: JSON.stringify(data),
    }),

  adminListVenues: (token: string) => request<Venue[]>("/admin/venues", { token }),

  adminCreateVenue: (token: string, data: VenueInput) =>
    request<Venue>("/admin/venues", {
      method: "POST",
      token,
      body: JSON.stringify(data),
    }),

  adminListBookings: (
    token: string,
    params?: { status?: string; event_id?: string; page?: number }
  ) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.event_id) qs.set("event_id", params.event_id);
    if (params?.page) qs.set("page", String(params.page));
    const query = qs.toString();
    return fetch(`${API_URL}/admin/bookings${query ? `?${query}` : ""}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (res) => {
      const body = await res.json();
      if (!body.success) throw new ApiClientError(res.status, body.error?.code, body.error?.message);
      return body as ApiSuccess<AdminBooking[]>;
    });
  },

  adminGetBooking: (token: string, id: string) =>
    request<AdminBookingDetail>(`/admin/bookings/${id}`, { token }),
};

export type User = {
  id: string;
  email: string;
  full_name: string;
  role: string;
};

export type Tokens = {
  access_token: string;
  refresh_token: string;
  expires_at: string;
};

export type Event = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: string;
  starts_at: string;
  ends_at: string;
  venue_name?: string;
  venue_city?: string;
  cover_image_url?: string;
};

export type TicketType = {
  id: string;
  name: string;
  price: number;
  available: number;
  max_per_order: number;
};

export type Availability = {
  id: string;
  name: string;
  price: number;
  available: number;
};

export type Booking = {
  id: string;
  event_id: string;
  status: string;
  hold_expires_at: string;
  total_amount: number;
  items: {
    ticket_type_id: string;
    ticket_type_name: string;
    quantity: number;
    unit_price: number;
  }[];
};

export type BookingSummary = {
  id: string;
  event_title: string;
  event_slug: string;
  event_starts_at?: string;
  status: string;
  total_amount: number;
  hold_expires_at: string;
  created_at: string;
};

export type Ticket = {
  id: string;
  ticket_code: string;
  ticket_type_name: string;
  status: string;
};

export type AdminStats = {
  total_events: number;
  published_events: number;
  total_bookings: number;
  confirmed_bookings: number;
  total_revenue: number;
  tickets_sold: number;
};

export type AdminEvent = {
  id: string;
  slug: string;
  title: string;
  status: string;
  starts_at: string;
  ends_at: string;
  venue_name?: string;
  venue_city?: string;
  created_at: string;
};

export type AdminEventDetail = Event & { venue_id?: string };

export type AdminTicketType = TicketType & {
  total_quota?: number;
  sold_count?: number;
  sales_start_at?: string;
  sales_end_at?: string;
};

export type AdminEventInput = {
  slug?: string;
  title: string;
  description?: string;
  venue_id?: string;
  cover_image_url?: string;
  status?: string;
  starts_at: string;
  ends_at: string;
};

export type AdminTicketTypeInput = {
  name: string;
  price: number;
  total_quota: number;
  max_per_order?: number;
  sales_start_at: string;
  sales_end_at: string;
};

export type Venue = {
  id: string;
  name: string;
  address: string;
  city: string;
  capacity: number;
};

export type VenueInput = {
  name: string;
  address: string;
  city: string;
  capacity: number;
};

export type AdminBooking = {
  id: string;
  user_email: string;
  user_name: string;
  event_title: string;
  event_slug: string;
  status: string;
  total_amount: number;
  created_at: string;
};

export type AdminBookingDetail = AdminBooking & {
  items: {
    ticket_type_name: string;
    quantity: number;
    unit_price: number;
  }[];
};

export function formatIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(date));
}

export function formatEventDate(date: string): { day: string; month: string; weekday: string; time: string } {
  const d = new Date(date);
  return {
    day: d.toLocaleDateString("id-ID", { day: "numeric", timeZone: "Asia/Jakarta" }),
    month: d.toLocaleDateString("id-ID", { month: "short", timeZone: "Asia/Jakarta" }),
    weekday: d.toLocaleDateString("id-ID", { weekday: "short", timeZone: "Asia/Jakarta" }),
    time: d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }),
  };
}
