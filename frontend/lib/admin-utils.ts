export function isAdminRole(role?: string): boolean {
  return role === "admin" || role === "organizer" || role === "gate_staff";
}

export function isPlatformAdmin(role?: string): boolean {
  return role === "admin";
}

/** ISO string → value untuk input datetime-local */
export function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local → ISO string */
export function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
}
