"use client";

import { useState } from "react";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { Button, Modal, Panel } from "@/components/ui";
import type { LicenseInput } from "@/lib/licenseTypes";

export function LicenseImportModal({
  onImport,
  onClose,
}: {
  onImport: (licenses: LicenseInput[]) => Promise<void>;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewRows, setPreviewRows] = useState<LicenseInput[]>([]);
  const [sheetName, setSheetName] = useState("");
  const [importing, setImporting] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  async function handleFileSelected(selectedFile: File) {
    setFile(selectedFile);
    setLoading(true);
    setError("");
    setSuccessCount(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch("/api/licenses/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to read Excel file");
      }
      setPreviewRows(data.rows || []);
      setSheetName(data.sheetName || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error reading file");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmImport() {
    if (previewRows.length === 0) return;
    setImporting(true);
    setError("");
    try {
      await onImport(previewRows);
      setSuccessCount(previewRows.length);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import rows into database");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-xs sm:p-6">
      <Panel className="my-auto w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl border border-slate-200/90 sm:p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">
              Import 2026 Power BI Licenses
            </h2>
            <p className="text-xs text-slate-500">
              Upload .xlsx file (e.g. 2026 List Power BI License.xlsx)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error ? (
          <div className="mt-3 rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
            {error}
          </div>
        ) : null}

        {successCount !== null ? (
          <div className="my-8 flex flex-col items-center justify-center text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 animate-bounce" />
            <h3 className="text-base font-bold text-slate-900">นำเข้าข้อมูลสำเร็จ!</h3>
            <p className="text-xs text-slate-500">
              บันทึกและซิงค์ข้อมูลสิทธิ์จำนวน {successCount} รายการเข้าสู่ระบบเรียบร้อย
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-6 text-center cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition shadow-xs">
              <Upload className="h-8 w-8 text-slate-400" />
              <div className="text-xs font-semibold text-slate-800">
                {file ? file.name : "คลิกหรือลากไฟล์ Excel (.xlsx) มาวางที่นี่"}
              </div>
              <div className="text-[11px] text-slate-400">
                รองรับไฟล์ตารางสิทธิ์ 32 คอลัมน์ หรือตารางรายชื่อผู้ถือ License
              </div>
              <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelected(f);
                }}
              />
            </label>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
                กำลังวิเคราะห์โครงสร้างคอลัมน์และแถวข้อมูลในไฟล์...
              </div>
            ) : previewRows.length > 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    <span>Sheet: {sheetName}</span>
                  </div>
                  <span className="rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px] font-bold border border-emerald-200/60">
                    ตรวจพบ {previewRows.length} รายการ
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-100 text-xs">
                  <table className="table table-zebra table-xs w-full text-left">
                    <thead className="sticky top-0 bg-slate-100 text-[11px] font-semibold text-slate-600">
                      <tr>
                        <th className="p-2">Name</th>
                        <th className="p-2">Email / AD Account</th>
                        <th className="p-2">Site</th>
                        <th className="p-2">License Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewRows.slice(0, 10).map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-2 font-medium text-slate-800 truncate max-w-[140px]">{row.name}</td>
                          <td className="p-2 text-slate-500 truncate max-w-[160px] font-mono text-[11px]">{row.email}</td>
                          <td className="p-2 text-slate-600">{row.hospital}</td>
                          <td className="p-2 text-slate-600">{row.license_type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previewRows.length > 10 ? (
                  <div className="text-center text-[10px] text-slate-400">
                    ...และอีก {previewRows.length - 10} รายการที่พร้อมนำเข้า
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={onClose} disabled={importing}>
                ยกเลิก (Cancel)
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={previewRows.length === 0 || importing}
                onClick={handleConfirmImport}
              >
                {importing ? "กำลังนำเข้า..." : `ยืนยันการนำเข้า (${previewRows.length} รายการ)`}
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </Modal>
  );
}
