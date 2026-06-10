import { getValidAccessToken, refreshAccessToken } from "./auth-client";

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

  let body: ApiSuccess<T> | ApiError;
  try {
    body = await res.json();
  } catch {
    throw new ApiClientError(
      res.status,
      "INVALID_RESPONSE",
      res.ok ? "Invalid response from server" : "Request failed"
    );
  }
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

type AuthRequestOptions = RequestInit & {
  token: string;
  idempotencyKey?: string;
};

async function authenticatedRequest<T>(path: string, options: AuthRequestOptions): Promise<T> {
  const token = await getValidAccessToken(options.token);
  if (!token) {
    throw new ApiClientError(401, "UNAUTHORIZED", "Authentication required");
  }

  try {
    return await request<T>(path, { ...options, token });
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 401) {
      const newToken = await refreshAccessToken();
      if (!newToken) throw err;
      return await request<T>(path, { ...options, token: newToken });
    }
    throw err;
  }
}

async function authenticatedFetch(
  path: string,
  token: string,
  init?: RequestInit
): Promise<Response> {
  const validToken = await getValidAccessToken(token);
  if (!validToken) {
    throw new ApiClientError(401, "UNAUTHORIZED", "Authentication required");
  }

  let res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${validToken}`,
    },
  });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      const body = await res.json().catch(() => ({}));
      throw new ApiClientError(
        401,
        body.error?.code || "UNAUTHORIZED",
        body.error?.message || "Authentication required"
      );
    }
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${newToken}`,
      },
    });
  }

  return res;
}

export const api = {
  register: (data: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    captcha_token?: string;
  }) =>
    request<{ user: User; tokens: Tokens }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  downloadTicketPdf: async (token: string, bookingId: string, ticketId: string) => {
    const validToken = await getValidAccessToken(token);
    if (!validToken) throw new ApiClientError(401, "UNAUTHORIZED", "Authentication required");
    const res = await fetch(`${API_URL}/bookings/${bookingId}/tickets/${ticketId}/pdf`, {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    if (!res.ok) throw new ApiClientError(res.status, "DOWNLOAD_FAILED", "Gagal unduh PDF");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ticket-${ticketId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },

  login: (data: { email: string; password: string; captcha_token?: string }) =>
    request<{ user: User; tokens: Tokens }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  refresh: (refreshToken: string) =>
    request<Tokens>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),

  logout: (refreshToken: string) =>
    request<{ message: string }>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),

  me: (token: string) => authenticatedRequest<User>("/auth/me", { token }),

  getHomepage: () =>
    request<{
      banners: HomepageBanner[];
      categories: EventCategory[];
      events: Event[];
    }>("/homepage"),

  listCategories: () => request<EventCategory[]>("/categories"),

  listEvents: (params?: { q?: string; category?: string; city?: string; date_from?: string; date_to?: string; price_min?: number; price_max?: number; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.category) qs.set("category", params.category);
    if (params?.city) qs.set("city", params.city);
    if (params?.date_from) qs.set("date_from", params.date_from);
    if (params?.date_to) qs.set("date_to", params.date_to);
    if (params?.price_min) qs.set("price_min", String(params.price_min));
    if (params?.price_max) qs.set("price_max", String(params.price_max));
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

  getQueueConfig: (slug: string) =>
    request<{ enabled: boolean; capacity: number }>(`/events/${slug}/queue/config`),

  joinQueue: (slug: string) =>
    request<{ token: string; position: number; estimated_seconds: number; status: string }>(
      `/events/${slug}/queue/join`,
      { method: "POST" }
    ),

  getQueueStatus: (slug: string, token: string) =>
    request<{ status: string; position?: number; estimated_seconds?: number }>(
      `/events/${slug}/queue/status?token=${encodeURIComponent(token)}`
    ),

  getAvailability: (slug: string) =>
    request<Availability[]>(`/events/${slug}/availability`),

  validatePromo: (data: { code: string; event_id: string; subtotal: number }) =>
    request<{
      code: string;
      discount_amount: number;
      final_total: number;
      subtotal: number;
    }>("/promos/validate", { method: "POST", body: JSON.stringify(data) }),

  holdBooking: (
    token: string,
    idempotencyKey: string,
    data: {
      event_id: string;
      items: { ticket_type_id: string; quantity: number }[];
      promo_code?: string;
      queue_token?: string;
    }
  ) =>
    authenticatedRequest<Booking>("/bookings/hold", {
      method: "POST",
      token,
      idempotencyKey,
      body: JSON.stringify(data),
    }),

  getBooking: (token: string, id: string) =>
    authenticatedRequest<Booking>(`/bookings/${id}`, { token }),

  listBookings: (token: string) =>
    authenticatedRequest<BookingSummary[]>("/bookings", { token }),

  confirmBooking: (token: string, id: string) =>
    authenticatedRequest<{ booking_id: string; status: string; total_amount: number }>(
      `/bookings/${id}/confirm`,
      { method: "POST", token }
    ),

  cancelBooking: (token: string, id: string) =>
    authenticatedRequest<{ message: string }>(`/bookings/${id}`, {
      method: "DELETE",
      token,
    }),

  paymentCheckout: (token: string, bookingId: string) =>
    authenticatedRequest<PaymentCheckout>("/payments/checkout", {
      method: "POST",
      token,
      body: JSON.stringify({ booking_id: bookingId }),
    }),

  syncPayment: (token: string, bookingId: string) =>
    authenticatedRequest<{ status: string }>("/payments/sync", {
      method: "POST",
      token,
      body: JSON.stringify({ booking_id: bookingId }),
    }),

  simulatePayment: (token: string, bookingId: string) =>
    authenticatedRequest<{ message: string; booking_id: string }>("/payments/simulate", {
      method: "POST",
      token,
      body: JSON.stringify({ booking_id: bookingId }),
    }),

  listTickets: (token: string, bookingId: string) =>
    authenticatedRequest<Ticket[]>(`/bookings/${bookingId}/tickets`, { token }),

  // ── Admin ──
  adminStats: (token: string) =>
    authenticatedRequest<AdminStats>("/admin/dashboard/stats", { token }),

  adminDashboardTrend: (token: string, days = 14) =>
    authenticatedRequest<DailyTrendRow[]>(`/admin/dashboard/trend?days=${days}`, { token }),

  adminListEvents: (token: string, params?: { status?: string; q?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.q) qs.set("q", params.q);
    if (params?.page) qs.set("page", String(params.page));
    const query = qs.toString();
    return authenticatedFetch(`/admin/events${query ? `?${query}` : ""}`, token).then(
      async (res) => {
        const body = await res.json();
        if (!body.success) {
          throw new ApiClientError(res.status, body.error?.code, body.error?.message);
        }
        return body as ApiSuccess<AdminEvent[]>;
      }
    );
  },

  adminGetEvent: (token: string, id: string) =>
    authenticatedRequest<{ event: AdminEventDetail; ticket_types: AdminTicketType[] }>(
      `/admin/events/${id}`,
      { token }
    ),

  adminCreateEvent: (token: string, data: AdminEventInput) =>
    authenticatedRequest<AdminEventDetail>("/admin/events", {
      method: "POST",
      token,
      body: JSON.stringify(data),
    }),

  adminUpdateEvent: (token: string, id: string, data: AdminEventInput) =>
    authenticatedRequest<AdminEventDetail>(`/admin/events/${id}`, {
      method: "PUT",
      token,
      body: JSON.stringify(data),
    }),

  adminCreateTicketType: (
    token: string,
    eventId: string,
    data: AdminTicketTypeInput
  ) =>
    authenticatedRequest<AdminTicketType>(`/admin/events/${eventId}/ticket-types`, {
      method: "POST",
      token,
      body: JSON.stringify(data),
    }),

  adminUpdateTicketType: (token: string, eventId: string, ticketTypeId: string, data: AdminTicketTypeInput) =>
    authenticatedRequest<AdminTicketType>(`/admin/events/${eventId}/ticket-types/${ticketTypeId}`, {
      method: "PUT",
      token,
      body: JSON.stringify(data),
    }),

  adminDeleteTicketType: (token: string, eventId: string, ticketTypeId: string) =>
    authenticatedRequest<{ message: string }>(`/admin/events/${eventId}/ticket-types/${ticketTypeId}`, {
      method: "DELETE",
      token,
    }),

  adminGetOrganizerPayout: (token: string, organizerId: string) =>
    authenticatedRequest<{ bank_name?: string; account_number?: string; account_holder?: string }>(
      `/admin/organizers/${organizerId}/payout`,
      { token }
    ),

  adminUpsertOrganizerPayout: (
    token: string,
    organizerId: string,
    data: { bank_name: string; account_number: string; account_holder: string }
  ) =>
    authenticatedRequest<{ message: string }>(`/admin/organizers/${organizerId}/payout`, {
      method: "PUT",
      token,
      body: JSON.stringify(data),
    }),

  adminQueueDLQStats: (token: string) =>
    authenticatedRequest<{ dlq_size: number }>("/admin/queue/dlq", { token }),

  adminListVenues: (token: string) =>
    authenticatedRequest<Venue[]>("/admin/venues", { token }),

  adminCreateVenue: (token: string, data: VenueInput) =>
    authenticatedRequest<Venue>("/admin/venues", {
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
    return authenticatedFetch(`/admin/bookings${query ? `?${query}` : ""}`, token).then(
      async (res) => {
        const body = await res.json();
        if (!body.success) {
          throw new ApiClientError(res.status, body.error?.code, body.error?.message);
        }
        return body as ApiSuccess<AdminBooking[]>;
      }
    );
  },

  adminGetBooking: (token: string, id: string) =>
    authenticatedRequest<AdminBookingDetail>(`/admin/bookings/${id}`, { token }),

  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password: newPassword }),
    }),

  verifyEmail: (token: string) =>
    request<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  requestVerifyEmail: (token: string) =>
    authenticatedRequest<{ message: string }>("/auth/request-verify-email", {
      method: "POST",
      token,
    }),

  adminListPayments: (token: string, params?: { status?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    const query = qs.toString();
    return authenticatedFetch(`/admin/payments${query ? `?${query}` : ""}`, token).then(
      async (res) => {
        const body = await res.json();
        if (!body.success) throw new ApiClientError(res.status, body.error?.code, body.error?.message);
        return body as ApiSuccess<AdminPayment[]>;
      }
    );
  },

  adminListUsers: (token: string, params?: { q?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.page) qs.set("page", String(params.page));
    const query = qs.toString();
    return authenticatedFetch(`/admin/users${query ? `?${query}` : ""}`, token).then(
      async (res) => {
        const body = await res.json();
        if (!body.success) throw new ApiClientError(res.status, body.error?.code, body.error?.message);
        return body as ApiSuccess<AdminUser[]>;
      }
    );
  },

  adminGetSettings: (token: string) =>
    authenticatedRequest<AppSettings>("/admin/settings", { token }),

  adminUpdateSettings: (token: string, key: string, value: Record<string, unknown>) =>
    authenticatedRequest<{ message: string }>(`/admin/settings/${key}`, {
      method: "PUT",
      token,
      body: JSON.stringify(value),
    }),

  adminListAudit: (token: string, page = 1) =>
    authenticatedFetch(`/admin/audit?page=${page}`, token).then(async (res) => {
      const body = await res.json();
      if (!body.success) throw new ApiClientError(res.status, body.error?.code, body.error?.message);
      return body as ApiSuccess<AuditLogEntry[]>;
    }),

  adminSalesReport: (token: string) =>
    authenticatedRequest<SalesReportRow[]>("/admin/reports/sales", { token }),

  adminExportBookingsUrl: () => `${API_URL}/admin/reports/exports/bookings`,

  adminRefundBooking: (token: string, bookingId: string) =>
    authenticatedRequest<{ message: string }>(`/admin/bookings/${bookingId}/refund`, {
      method: "POST",
      token,
    }),

  adminListPromos: (token: string) =>
    authenticatedRequest<PromoCode[]>("/admin/promos", { token }),

  adminCreatePromo: (token: string, data: PromoCodeInput) =>
    authenticatedRequest<{ id: string; code: string }>("/admin/promos", {
      method: "POST",
      token,
      body: JSON.stringify(data),
    }),

  adminCheckIn: (token: string, ticketCode: string) =>
    authenticatedRequest<CheckInResult>("/admin/check-in/scan", {
      method: "POST",
      token,
      body: JSON.stringify({ ticket_code: ticketCode }),
    }),

  adminListCategories: (token: string) =>
    authenticatedRequest<EventCategory[]>("/admin/categories", { token }),

  adminCreateCategory: (token: string, data: { slug: string; name: string; sort_order?: number }) =>
    authenticatedRequest<{ id: string; slug: string; name: string }>("/admin/categories", {
      method: "POST",
      token,
      body: JSON.stringify(data),
    }),

  adminListBanners: (token: string) =>
    authenticatedRequest<HomepageBanner[]>("/admin/banners", { token }),

  adminCreateBanner: (
    token: string,
    data: { title: string; subtitle?: string; image_url?: string; link_url?: string; sort_order?: number; active?: boolean }
  ) =>
    authenticatedRequest<{ id: string; title: string }>("/admin/banners", {
      method: "POST",
      token,
      body: JSON.stringify(data),
    }),

  adminListModeration: (token: string, page = 1) =>
    authenticatedFetch(`/admin/moderation?page=${page}`, token).then(async (res) => {
      const body = await res.json();
      if (!body.success) throw new ApiClientError(res.status, body.error?.code, body.error?.message);
      return body as ApiSuccess<AdminEvent[]>;
    }),

  adminModerateEvent: (token: string, eventId: string, action: "approve" | "reject") =>
    authenticatedRequest<{ status: string }>(`/admin/moderation/${eventId}`, {
      method: "POST",
      token,
      body: JSON.stringify({ action }),
    }),

  adminListAttendees: (token: string, eventId: string) =>
    authenticatedRequest<AttendeeRow[]>(`/admin/events/${eventId}/attendees`, { token }),

  adminExportAttendeesUrl: (eventId: string) =>
    `${API_URL}/admin/events/${eventId}/attendees/export`,

  adminUpdateCategory: (token: string, id: string, data: { slug: string; name: string; sort_order?: number }) =>
    authenticatedRequest<{ message: string }>(`/admin/categories/${id}`, {
      method: "PUT",
      token,
      body: JSON.stringify(data),
    }),

  adminDeleteCategory: (token: string, id: string) =>
    authenticatedRequest<{ message: string }>(`/admin/categories/${id}`, { method: "DELETE", token }),

  adminUpdateBanner: (
    token: string,
    id: string,
    data: { title: string; subtitle?: string; image_url?: string; link_url?: string; sort_order?: number; active?: boolean }
  ) =>
    authenticatedRequest<{ message: string }>(`/admin/banners/${id}`, {
      method: "PUT",
      token,
      body: JSON.stringify(data),
    }),

  adminDeleteBanner: (token: string, id: string) =>
    authenticatedRequest<{ message: string }>(`/admin/banners/${id}`, { method: "DELETE", token }),

  adminListOrganizers: (token: string) =>
    authenticatedRequest<OrganizerUser[]>("/admin/organizers", { token }),

  adminCreateOrganizer: (token: string, data: { email: string; full_name: string; password: string }) =>
    authenticatedRequest<{ id: string; email: string }>("/admin/organizers", {
      method: "POST",
      token,
      body: JSON.stringify(data),
    }),

  adminListStaff: (token: string, eventId?: string) => {
    const qs = eventId ? `?event_id=${eventId}` : "";
    return authenticatedRequest<EventStaffRow[]>(`/admin/staff${qs}`, { token });
  },

  adminAssignStaff: (token: string, eventId: string, userId: string) =>
    authenticatedRequest<{ message: string }>("/admin/staff", {
      method: "POST",
      token,
      body: JSON.stringify({ event_id: eventId, user_id: userId }),
    }),

  adminRemoveStaff: (token: string, id: string) =>
    authenticatedRequest<{ message: string }>(`/admin/staff/${id}`, { method: "DELETE", token }),

  adminListGateStaff: (token: string) =>
    authenticatedRequest<OrganizerUser[]>("/admin/gate-staff", { token }),

  adminCreateGateStaff: (token: string, data: { email: string; full_name: string; password: string }) =>
    authenticatedRequest<{ id: string; email: string }>("/admin/gate-staff", {
      method: "POST",
      token,
      body: JSON.stringify(data),
    }),

  adminListSettlements: (token: string) =>
    authenticatedRequest<SettlementRow[]>("/admin/settlements", { token }),

  adminCreateSettlement: (
    token: string,
    data: { organizer_id: string; period_start: string; period_end: string; fee_percent?: number }
  ) =>
    authenticatedRequest<{ id: string; net_payout: number }>("/admin/settlements", {
      method: "POST",
      token,
      body: JSON.stringify(data),
    }),

  adminMarkSettlementPaid: (token: string, id: string) =>
    authenticatedRequest<{ message: string }>(`/admin/settlements/${id}/paid`, {
      method: "POST",
      token,
    }),

  adminCheckInStats: (token: string, eventId: string) =>
    authenticatedRequest<{ checked_in: number; total: number }>(
      `/admin/check-in/stats/${eventId}`,
      { token }
    ),
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
  category_slug?: string;
  category_name?: string;
};

export type EventCategory = {
  id: string;
  slug: string;
  name: string;
  sort_order?: number;
};

export type HomepageBanner = {
  id: string;
  title: string;
  subtitle?: string;
  image_url?: string;
  link_url?: string;
  sort_order?: number;
  active?: boolean;
};

export type TicketType = {
  id: string;
  name: string;
  price: number;
  available: number;
  max_per_order: number;
  sale_status?: string;
  tier_label?: string;
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
  subtotal_amount?: number;
  discount_amount?: number;
  promo_code?: string;
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

export type PaymentCheckout = {
  snap_token: string;
  client_key: string;
  order_id: string;
  booking_id: string;
  total_amount: number;
  gateway: string;
  is_production: boolean;
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

export type AdminEventDetail = Event & {
  venue_id?: string;
  category_id?: string;
  waiting_room_enabled?: boolean;
  waiting_room_capacity?: number;
};

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
  category_id?: string;
  cover_image_url?: string;
  status?: string;
  starts_at: string;
  ends_at: string;
  waiting_room_enabled?: boolean;
  waiting_room_capacity?: number;
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
  payments?: AdminPayment[];
};

export type DailyTrendRow = {
  day: string;
  revenue: number;
  bookings: number;
  tickets: number;
};

export type AttendeeRow = {
  ticket_code: string;
  status: string;
  user_name: string;
  user_email: string;
  ticket_type: string;
  booking_id: string;
  checked_in_at?: string;
};

export type OrganizerUser = {
  id: string;
  email: string;
  full_name: string;
  event_count?: number;
  created_at?: string;
};

export type EventStaffRow = {
  id: string;
  event_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  event_title: string;
};

export type SettlementRow = {
  id: string;
  organizer_id: string;
  organizer_name: string;
  period_start: string;
  period_end: string;
  gross_revenue: number;
  platform_fee: number;
  net_payout: number;
  status: string;
  paid_at?: string;
  created_at: string;
};

export type AdminPayment = {
  id: string;
  booking_id: string;
  gateway: string;
  gateway_ref?: string;
  amount: number;
  status: string;
  paid_at?: string;
  created_at: string;
  user_email: string;
  event_title: string;
  booking_status: string;
};

export type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  email_verified_at?: string;
  created_at: string;
};

export type AppSettings = {
  general?: Record<string, unknown>;
  integrations?: Record<string, unknown>;
  email_templates?: Record<string, unknown>;
};

export type AuditLogEntry = {
  id: string;
  actor_id?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export type SalesReportRow = {
  event_id: string;
  event_title: string;
  tickets_sold: number;
  revenue: number;
  booking_count: number;
};

export type PromoCode = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_uses?: number;
  used_count: number;
  valid_from: string;
  valid_until: string;
  active: boolean;
};

export type PromoCodeInput = {
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  max_uses?: number;
  event_id?: string;
  valid_from: string;
  valid_until: string;
};

export type CheckInResult = {
  ticket_code: string;
  event_title: string;
  holder_name: string;
  checked_in_at: string;
  message: string;
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
