import { useState } from "react";
import { AppShell } from "@/components/layout/shell";
import { useListAllDoctors, useListManagers, getListAllDoctorsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search, ChevronLeft, ChevronRight, Image, FileText } from "lucide-react";
import { exportUrl } from "@/lib/api";
import { format } from "date-fns";

export default function AllDoctorsPage() {
  const [search, setSearch] = useState("");
  const [managerId, setManagerId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const params = {
    ...(search ? { search } : {}),
    ...(managerId && managerId !== "all" ? { managerId: parseInt(managerId) } : {}),
    ...(status && status !== "all" ? { status } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    page,
    limit: 20,
  };

  const { data, isLoading } = useListAllDoctors(params, {
    query: { queryKey: getListAllDoctorsQueryKey(params) },
  });
  const { data: managers } = useListManagers();

  const buildExportUrl = () => {
    const qp = new URLSearchParams();
    if (managerId && managerId !== "all") qp.set("managerId", managerId);
    if (startDate) qp.set("startDate", startDate);
    if (endDate) qp.set("endDate", endDate);
    const qs = qp.toString();
    return exportUrl(`/api/admin/export${qs ? `?${qs}` : ""}`);
  };

  const doctors = data?.doctors ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">All Doctors</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{total} doctors across all managers</p>
          </div>
          <a
            href={buildExportUrl()}
            data-testid="button-export-all"
            className="flex items-center justify-center gap-2 bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors w-full sm:w-auto"
          >
            <Download size={15} />
            Export to Excel
          </a>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-3">
          <div className="relative col-span-1 sm:col-span-2 lg:flex-1 lg:max-w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              data-testid="input-search-doctors"
              placeholder="Search doctors..."
              className="pl-9 h-9"
            />
          </div>
          <Select value={managerId} onValueChange={(v) => { setManagerId(v); setPage(1); }}>
            <SelectTrigger className="w-full lg:w-44 h-9" data-testid="select-manager-filter">
              <SelectValue placeholder="All managers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All managers</SelectItem>
              {(managers ?? []).map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-full lg:w-36 h-9" data-testid="select-status-filter">
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
              <SelectItem value="incomplete">Incomplete</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2 col-span-1 sm:col-span-2 lg:col-span-1">
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="text-xs sm:text-sm border border-border rounded-lg px-2 sm:px-3 py-1.5 bg-card text-foreground h-9 focus:outline-none focus:ring-1 focus:ring-primary flex-1 min-w-0"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="text-xs sm:text-sm border border-border rounded-lg px-2 sm:px-3 py-1.5 bg-card text-foreground h-9 focus:outline-none focus:ring-1 focus:ring-primary flex-1 min-w-0"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Doctor</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Specialization</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">City</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Manager</th>
                  <th className="text-center px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Photo</th>
                  <th className="text-center px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Document</th>
                  <th className="text-center px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Added</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {[...Array(8)].map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))}
                {!isLoading && doctors.map((d) => (
                  <tr key={d.id} data-testid={`row-doctor-${d.id}`} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-foreground">{d.doctorName}</span>
                      {d.phoneNumber && (
                        <p className="text-xs text-muted-foreground mt-0.5">{d.phoneNumber}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">{d.specialization}</td>
                    <td className="px-4 py-3.5 text-muted-foreground">{d.city}</td>
                    <td className="px-4 py-3.5 text-muted-foreground">{d.managerName ?? "-"}</td>
                    <td className="px-4 py-3.5 text-center">
                      {d.photoUrl ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100">
                          <Image size={12} className="text-emerald-600" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted">
                          <Image size={12} className="text-muted-foreground/40" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {d.documentUrl ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100">
                          <FileText size={12} className="text-emerald-600" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted">
                          <FileText size={12} className="text-muted-foreground/40" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        d.isComplete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {d.isComplete ? "Complete" : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">
                      {format(new Date(d.createdAt), "dd MMM yyyy")}
                    </td>
                  </tr>
                ))}
                {!isLoading && doctors.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-muted-foreground text-sm">
                      No doctors found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <span className="text-sm text-muted-foreground">
                Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft size={15} />
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  data-testid="button-next-page"
                >
                  <ChevronRight size={15} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
