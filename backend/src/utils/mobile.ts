export function normalizeMobile(value: unknown) {
  const raw = String(value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 10 && digits.length <= 13) return `+${digits}`;
  return digits;
}

export function maskMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `${digits.slice(0, 2)}••••••${digits.slice(-2)}`;
}
