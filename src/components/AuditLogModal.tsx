import React, { useEffect, useState, useMemo } from 'react';
import { X, Shield, Search, FileSpreadsheet, FileText } from 'lucide-react';
import { fetchAuditLogs, type AuditLogEntry } from '../lib/auditLogService';
import * as XLSX from 'xlsx';
import { todayIsoDate } from '../types/tax';

interface AuditLogModalProps {
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ onClose, onNotify }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  useEffect(() => {
    fetchAuditLogs()
      .then((data) => setLogs(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const uniqueActions = useMemo(() => {
    const s = new Set<string>();
    logs.forEach((l) => {
      if (l.action) s.add(l.action);
    });
    return Array.from(s);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((log) => {
      if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;
      if (!q) return true;
      const haystack = [
        log.actorName,
        log.actorEmail,
        log.actorRole,
        log.action,
        log.fileRef,
        log.clientName,
        log.details,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [logs, searchQuery, actionFilter]);

  const triggerDownload = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportCsv = () => {
    if (filteredLogs.length === 0) {
      onNotify('No audit logs to export.');
      return;
    }
    const rows = filteredLogs.map((l) => ({
      Timestamp: l.timestamp && typeof (l.timestamp as { toDate?: () => Date }).toDate === 'function' ? (l.timestamp as { toDate: () => Date }).toDate().toISOString() : String(l.timestamp || ''),
      'Actor Name': l.actorName,
      'Actor Email': l.actorEmail,
      'Actor Role': l.actorRole,
      Action: l.action,
      'File Ref': l.fileRef,
      'Client Name': l.clientName,
      Details: l.details,
    }));
    const headers = Object.keys(rows[0]);
    const escape = (val: unknown) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const csvLines = [
      headers.map(escape).join(','),
      ...rows.map((r) => headers.map((h) => escape((r as Record<string, unknown>)[h])).join(',')),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `TJW_Tax_Audit_Log_${todayIsoDate()}.csv`);
    onNotify('Exported audit trail CSV successfully.');
  };

  const handleExportExcel = () => {
    if (filteredLogs.length === 0) {
      onNotify('No audit logs to export.');
      return;
    }
    const rows = filteredLogs.map((l) => ({
      Timestamp: l.timestamp && typeof (l.timestamp as { toDate?: () => Date }).toDate === 'function' ? (l.timestamp as { toDate: () => Date }).toDate().toISOString() : String(l.timestamp || ''),
      'Actor Name': l.actorName,
      'Actor Email': l.actorEmail,
      'Actor Role': l.actorRole,
      Action: l.action,
      'File Ref': l.fileRef,
      'Client Name': l.clientName,
      Details: l.details,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Trail');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    triggerDownload(blob, `TJW_Tax_Audit_Log_${todayIsoDate()}.xlsx`);
    onNotify('Exported audit trail Excel (.xlsx) successfully.');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#D6D3D1] max-w-6xl w-full shadow-2xl flex flex-col h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#790D16] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 font-display font-bold text-base">
            <Shield className="w-5 h-5 text-[#E5D3AF]" />
            <span>Tamper-Proof User Activity Audit Log (System Admin Only)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#E5D3AF] hover:text-white cursor-pointer p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 bg-[#FAF9F6] border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search audit trail by actor, action, file ref, client..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#D6D3D1] bg-white focus:outline-none focus:border-[#790D16]"
              />
            </div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-[#D6D3D1] bg-white focus:outline-none focus:border-[#790D16]"
            >
              <option value="ALL">All Actions</option>
              {uniqueActions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 bg-white border border-[#D6D3D1] text-[#1C1917] text-xs font-semibold hover:bg-[#F5EFE1] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-[#57534E]" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-1.5 bg-white border border-[#D6D3D1] text-[#1C1917] text-xs font-semibold hover:bg-[#F5EFE1] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#166534]" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="py-12 text-center text-xs text-[#57534E]">Loading tamper-proof audit trail from Firestore...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#57534E]">No audit logs match your search criteria.</div>
          ) : (
            <div className="border border-[#E5E7EB] overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[900px]">
                <thead className="bg-[#FAF9F6] text-[#57534E] border-b border-[#E5E7EB] font-semibold sticky top-0">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Actor</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">File Ref / Client</th>
                    <th className="p-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {filteredLogs.map((log, idx) => {
                    const tsStr =
                      log.timestamp && typeof (log.timestamp as { toDate?: () => Date }).toDate === 'function'
                        ? (log.timestamp as { toDate: () => Date }).toDate().toLocaleString()
                        : 'Just now';
                    return (
                      <tr key={log.id || idx} className="hover:bg-[#FAF9F6]">
                        <td className="p-3 font-mono text-[#57534E] whitespace-nowrap">{tsStr}</td>
                        <td className="p-3">
                          <div className="font-semibold text-[#1C1917]">{log.actorName}</div>
                          <div className="text-[11px] font-mono text-[#78716C]">{log.actorEmail}</div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 text-[11px] font-semibold bg-[#E6EFF5] text-[#1E3A5F] border border-[#AEC4D4]">
                            {log.actorRole}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-[#790D16]">{log.action}</td>
                        <td className="p-3">
                          <div className="font-mono text-[#1C1917]">{log.fileRef}</div>
                          <div className="text-[11px] text-[#57534E]">{log.clientName}</div>
                        </td>
                        <td className="p-3 text-[#44403C] max-w-xs truncate" title={log.details}>
                          {log.details || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#FAF9F6] border-t border-[#E5E7EB] flex items-center justify-between shrink-0">
          <div className="text-[11px] text-[#57534E]">
            🔒 Append-only audit records. Modifying or deleting audit logs is strictly prohibited by Firestore security rules.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-[#D6D3D1] text-[#1C1917] text-xs font-semibold hover:bg-[#F5EFE1] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
