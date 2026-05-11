import { useState, useRef } from "react";
import { AppShell } from "@/components/layout/shell";
import { useListMyDoctors, useCreateDoctor, getListMyDoctorsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, ChevronLeft, ChevronRight, Upload, Image, FileText, Download, Eye } from "lucide-react";
import { uploadFile, exportUrl } from "@/lib/api";
import { format } from "date-fns";

const doctorSchema = z.object({
  doctorName: z.string().min(2, "Name required"),
  specialization: z.string().min(2, "Specialization required"),
  city: z.string().min(2, "City required"),
  clinicAddress: z.string().optional(),
  phoneNumber: z.string().optional(),
});
type DoctorForm = z.infer<typeof doctorSchema>;

export default function MyDoctorsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [uploading, setUploading] = useState<{ [id: number]: string }>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const photoInputRefs = useRef<{ [id: number]: HTMLInputElement | null }>({});
  const docInputRefs = useRef<{ [id: number]: HTMLInputElement | null }>({});

  const params = {
    ...(search ? { search } : {}),
    ...(status && status !== "all" ? { status } : {}),
    page,
    limit: 20,
  };

  const { data, isLoading } = useListMyDoctors(params, {
    query: { queryKey: getListMyDoctorsQueryKey(params) },
  });
  const createMutation = useCreateDoctor();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<DoctorForm>({
    resolver: zodResolver(doctorSchema),
    defaultValues: { doctorName: "", specialization: "", city: "", clinicAddress: "", phoneNumber: "" },
  });

  const onAddDoctor = async (values: DoctorForm) => {
    try {
      await createMutation.mutateAsync({
        data: {
          doctorName: values.doctorName,
          specialization: values.specialization,
          city: values.city,
          clinicAddress: values.clinicAddress || null,
          phoneNumber: values.phoneNumber || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListMyDoctorsQueryKey() });
      toast({ title: "Doctor added successfully" });
      form.reset();
      setAddOpen(false);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "data" in err ? String((err as { data: { error?: string } }).data?.error) : "Failed to add doctor";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handlePhotoUpload = async (doctorId: number, file: File) => {
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      toast({ title: "Invalid file", description: "Only JPG, JPEG, PNG allowed", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10MB for photos", variant: "destructive" });
      return;
    }
    setUploading(u => ({ ...u, [doctorId]: "photo" }));
    try {
      const res = await uploadFile(`/api/manager/doctors/${doctorId}/photo`, "photo", file);
      if (!res.ok) throw new Error("Upload failed");
      queryClient.invalidateQueries({ queryKey: getListMyDoctorsQueryKey() });
      toast({ title: "Photo uploaded successfully" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(u => { const n = { ...u }; delete n[doctorId]; return n; });
    }
  };

  const handleDocUpload = async (doctorId: number, file: File) => {
    const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Invalid file", description: "Only PDF, DOC, DOCX allowed", variant: "destructive" });
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 25MB for documents", variant: "destructive" });
      return;
    }
    setUploading(u => ({ ...u, [doctorId]: "doc" }));
    try {
      const res = await uploadFile(`/api/manager/doctors/${doctorId}/document`, "document", file);
      if (!res.ok) throw new Error("Upload failed");
      queryClient.invalidateQueries({ queryKey: getListMyDoctorsQueryKey() });
      toast({ title: "Document uploaded successfully" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(u => { const n = { ...u }; delete n[doctorId]; return n; });
    }
  };

  const doctors = data?.doctors ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <AppShell>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">My Doctors</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{total} doctors in your portfolio</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={exportUrl("/api/manager/export")}
              data-testid="button-export-my-doctors"
              className="flex items-center gap-2 border border-border text-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-muted transition-colors"
            >
              <Download size={15} />
              Export
            </a>
            <Button onClick={() => setAddOpen(true)} data-testid="button-add-doctor" className="gap-2">
              <Plus size={16} />
              Add Doctor
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              data-testid="input-search-my-doctors"
              placeholder="Search by name, specialization, city..."
              className="pl-9 h-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-36 h-9" data-testid="select-my-status-filter">
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
              <SelectItem value="incomplete">Incomplete</SelectItem>
            </SelectContent>
          </Select>
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
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Phone</th>
                  <th className="text-center px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Status</th>
                  <th className="text-center px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Photo</th>
                  <th className="text-center px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Document</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Added</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {[...Array(8)].map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>
                    ))}
                  </tr>
                ))}
                {!isLoading && doctors.map((d) => (
                  <tr key={d.id} data-testid={`row-my-doctor-${d.id}`} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-foreground">{d.doctorName}</span>
                      {d.clinicAddress && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">{d.clinicAddress}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">{d.specialization}</td>
                    <td className="px-4 py-3.5 text-muted-foreground">{d.city}</td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{d.phoneNumber ?? "-"}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        d.isComplete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {d.isComplete ? "Complete" : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {d.photoUrl && (
                          <button
                            onClick={() => setPreviewUrl(d.photoUrl!)}
                            data-testid={`button-preview-photo-${d.id}`}
                            className="p-1 rounded hover:bg-muted text-primary transition-colors"
                            title="Preview photo"
                          >
                            <Eye size={13} />
                          </button>
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png"
                          className="hidden"
                          ref={(el) => { photoInputRefs.current[d.id] = el; }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePhotoUpload(d.id, file);
                            e.target.value = "";
                          }}
                        />
                        <button
                          onClick={() => photoInputRefs.current[d.id]?.click()}
                          data-testid={`button-upload-photo-${d.id}`}
                          disabled={uploading[d.id] === "photo"}
                          className={`p-1.5 rounded text-xs transition-colors flex items-center gap-1 ${
                            d.photoUrl
                              ? "text-emerald-600 hover:bg-emerald-50"
                              : "text-muted-foreground hover:bg-muted"
                          }`}
                          title={d.photoUrl ? "Replace photo" : "Upload photo"}
                        >
                          {uploading[d.id] === "photo" ? (
                            <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Image size={13} className={d.photoUrl ? "text-emerald-600" : ""} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        ref={(el) => { docInputRefs.current[d.id] = el; }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleDocUpload(d.id, file);
                          e.target.value = "";
                        }}
                      />
                      <button
                        onClick={() => docInputRefs.current[d.id]?.click()}
                        data-testid={`button-upload-doc-${d.id}`}
                        disabled={uploading[d.id] === "doc"}
                        className={`p-1.5 rounded text-xs transition-colors flex items-center justify-center gap-1 mx-auto ${
                          d.documentUrl
                            ? "text-emerald-600 hover:bg-emerald-50"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                        title={d.documentUrl ? "Replace document" : "Upload document"}
                      >
                        {uploading[d.id] === "doc" ? (
                          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <FileText size={13} className={d.documentUrl ? "text-emerald-600" : ""} />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">
                      {format(new Date(d.createdAt), "dd MMM yyyy")}
                    </td>
                  </tr>
                ))}
                {!isLoading && doctors.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-muted-foreground text-sm">
                      No doctors added yet. Click "Add Doctor" to start adding.
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
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} data-testid="button-my-prev-page">
                  <ChevronLeft size={15} />
                </Button>
                <span className="text-sm text-muted-foreground px-2">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} data-testid="button-my-next-page">
                  <ChevronRight size={15} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Doctor Dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) form.reset(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Doctor</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onAddDoctor)} className="space-y-4">
              <FormField control={form.control} name="doctorName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Doctor Name</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-doctor-name" placeholder="e.g. Dr. Suresh Mehta" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="specialization" render={({ field }) => (
                <FormItem>
                  <FormLabel>Specialization</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-doctor-spec" placeholder="e.g. Cardiology" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-doctor-city" placeholder="e.g. Mumbai" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="clinicAddress" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clinic Address <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-doctor-address" placeholder="Clinic address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-doctor-phone" placeholder="Phone number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="submit" data-testid="button-confirm-add-doctor" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Adding..." : "Add Doctor"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Photo Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={(o) => { if (!o) setPreviewUrl(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Doctor Photo</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img
              src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}${previewUrl.replace(/^\/api/, "/api")}`}
              alt="Doctor photo"
              className="w-full rounded-lg object-contain max-h-96"
              onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400?text=Photo"; }}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
