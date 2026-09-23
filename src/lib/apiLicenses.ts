"use client";

import { normalizeLicense, type LicenseInput, type PowerBiLicense } from "@/lib/licenseTypes";

const LOCAL_STORAGE_KEY = "powerbi_licenses_backup_standalone_v1";

function getLocalBackup(): PowerBiLicense[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => normalizeLicense(item));
    }
    return [];
  } catch {
    return [];
  }
}

function setLocalBackup(items: PowerBiLicense[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore quota errors
  }
}

export async function getLicenses(): Promise<PowerBiLicense[]> {
  try {
    const res = await fetch("/api/licenses", { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}`);
    }
    const data = await res.json();
    if (data.licenses && Array.isArray(data.licenses)) {
      const normalized = (data.licenses as Partial<PowerBiLicense>[]).map(normalizeLicense);
      setLocalBackup(normalized);
      return normalized;
    }
    return getLocalBackup();
  } catch (err) {
    console.warn("API request failed, falling back to local storage cache:", err);
    return getLocalBackup();
  }
}

export async function saveLicense(input: LicenseInput): Promise<PowerBiLicense> {
  const normalized = normalizeLicense(input);
  try {
    const res = await fetch("/api/licenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalized),
    });
    if (!res.ok) throw new Error("Failed to save license on server");
    const json = await res.json();
    const saved = normalizeLicense(json.license || normalized);

    const current = getLocalBackup();
    const idx = current.findIndex((item) => item.id === saved.id);
    if (idx >= 0) {
      current[idx] = saved;
      setLocalBackup([...current]);
    } else {
      setLocalBackup([saved, ...current]);
    }
    return saved;
  } catch (err) {
    console.warn("Server save failed, saving to local cache:", err);
    const current = getLocalBackup();
    const idx = current.findIndex((item) => item.id === normalized.id);
    if (idx >= 0) {
      current[idx] = normalized;
      setLocalBackup([...current]);
    } else {
      setLocalBackup([normalized, ...current]);
    }
    return normalized;
  }
}

export async function deleteLicense(id: string): Promise<boolean> {
  try {
    await fetch(`/api/licenses?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (err) {
    console.warn("Server delete failed:", err);
  }
  const current = getLocalBackup();
  setLocalBackup(current.filter((item) => item.id !== id));
  return true;
}

export async function batchImportLicenses(inputs: LicenseInput[]): Promise<{ count: number }> {
  let count = 0;
  for (const input of inputs) {
    await saveLicense(input);
    count++;
  }
  return { count };
}
