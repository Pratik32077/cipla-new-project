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
import { Plus, Search, ChevronLeft, ChevronRight, Image, FileText, Download, Upload, X, Eye } from "lucide-react";
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

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function PhotoThumb({ url, onClick }: { url: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-9 h-9 rounded-md overflow-hidden border border-border hover:border-primary transition-colors shrink-0"
      title="Click to preview"
    >
      <img
        src={`${BASE}${url}`}
        alt="Doctor photo"
        className="w-full h-full object-cover"
        onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/40x40?text=?"; }}
      />
    </button>
  );
}

export default function MyDoctorsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [uploading, setUploading] = useState<{ [id: number]: string }>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // For inline table photo replacement
  const photoInputRefs = useRef<{ [id: number]: HTMLInputElement | null }>({});

  // For Add Doctor form file picks
  const [formPhoto, setFormPhoto] = useState<File | null>(null);
  const [formDoc, setFormDoc] = useState<File | null>(null);
  const [formPhotoPreview, setFormPhotoPreview] = useState<string | null>(null);
  const formPhotoRef = useRef<HTMLInputElement | null>(null);
  const formDocRef = useRef<HTMLInputElement | null>(null);

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

  const resetForm = () => {
    form.reset();
    setFormPhoto(null);
    setFormDoc(null);
    setFormPhotoPreview(null);
  };

  const onAddDoctor = async (values: DoctorForm) => {
    try {
      const created = await createMutation.mutateAsync({
        data: {
          doctorName: values.doctorName,
          specialization: values.specialization,
          city: values.city,
          clinicAddress: values.clinicAddress || null,
          phoneNumber: values.phoneNumber || null,
        },
      });

      const doctorId = (created as { id: number }).id;

      // Upload photo and doc in parallel right after creating
      const uploads: Promise<void>[] = [];

      if (formPhoto && doctorId) {
        uploads.push(
          uploadFile(`/api/manager/doctors/${doctorId}/photo`, "photo", formPhoto)
            .then((res) => { if (!res.ok) throw new Error(); })
            .catch(() => { toast({ title: "Photo upload failed", variant: "destructive" }); })
        );
      }

      if (formDoc && doctorId) {
        uploads.push(
          uploadFile(`/api/manager/doctors/${doctorId}/document`, "document", formDoc)
            .then((res) => { if (!res.ok) throw new Error(); })
            .catch(() => { toast({ title: "Document upload failed", variant: "destructive" }); })
        );
      }

      if (uploads.length > 0) await Promise.all(uploads);

      queryClient.invalidateQueries({ queryKey: getListMyDoctorsQueryKey() });
      toast({ title: "Doctor added successfully" });
      resetForm();
      setAddOpen(false);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "data" in err
        ? String((err as { data: { error?: string } }).data?.error)
        : "Failed to add doctor";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleTablePhotoUpload = async (doctorId: number, file: File) => {
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      toast({ title: "Invalid file", description: "Only JPG, JPEG, PNG allowed", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10MB", variant: "destructive" });
      return;
    }
    setUploading(u => ({ ...u, [doctorId]: "photo" }));
    try {
      const res = await uploadFile(`/api/manager/doctors/${doctorId}/photo`, "photo", file);
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: getListMyDoctorsQueryKey() });
      toast({ title: "Photo updated" });
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
                    <td className="px-5 py-3">
                      <span className="font-medium text-foreground">{d.doctorName}</span>
                      {d.clinicAddress && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[160px]">{d.clinicAddress}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{d.specialization}</td>
                    <td className="px-4 py-3 text-muted-foreground">{d.city}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{d.phoneNumber ?? "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        d.isComplete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {d.isComplete ? "Complete" : "Pending"}
                      </span>
                    </td>

                    {/* Photo column — thumbnail if uploaded, upload button if not */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {d.photoUrl ? (
                          <PhotoThumb url={d.photoUrl} onClick={() => setPreviewUrl(d.photoUrl!)} />
                        ) : null}
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png"
                          className="hidden"
                          ref={(el) => { photoInputRefs.current[d.id] = el; }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleTablePhotoUpload(d.id, file);
                            e.target.value = "";
                          }}
                        />
                        <button
                          onClick={() => photoInputRefs.current[d.id]?.click()}
                          data-testid={`button-upload-photo-${d.id}`}
                          disabled={uploading[d.id] === "photo"}
                          title={d.photoUrl ? "Replace photo" : "Upload photo"}
                          className={`p-1.5 rounded transition-colors ${
                            d.photoUrl
                              ? "text-muted-foreground/50 hover:text-primary hover:bg-primary/10"
                              : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {uploading[d.id] === "photo" ? (
                            <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Upload size={13} />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Document column — status icon only (upload from Add Doctor form) */}
                    <td className="px-4 py-3 text-center">
                      {d.documentUrl ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100" title="Document uploaded">
                          <FileText size={13} className="text-emerald-600" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted" title="No document">
                          <FileText size={13} className="text-muted-foreground/40" />
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {format(new Date(d.createdAt), "dd MMM yyyy")}
                    </td>
                  </tr>
                ))}
                {!isLoading && doctors.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-muted-foreground text-sm">
                      No doctors added yet. Click "Add Doctor" to get started.
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

      {/* ── Add Doctor Dialog ── */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Doctor</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onAddDoctor)} className="space-y-4">
              {/* Doctor info fields */}
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="doctorName" render={({ field }) => (
                  <FormItem className="col-span-2">
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
                <FormField control={form.control} name="clinicAddress" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">Clinic Address <span className="text-muted-foreground font-normal text-xs">(optional)</span></FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-doctor-address" placeholder="Clinic address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">Phone <span className="text-muted-foreground font-normal text-xs">(optional)</span></FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-doctor-phone" placeholder="Phone number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* ── Upload section ── */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Photo upload */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                    <Image size={13} className="text-muted-foreground" />
                    Doctor Photo
                    <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                  </p>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    className="hidden"
                    ref={formPhotoRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (file) {
                        if (file.size > 10 * 1024 * 1024) {
                          toast({ title: "Photo too large", description: "Max 10MB", variant: "destructive" });
                          return;
                        }
                        setFormPhoto(file);
                        setFormPhotoPreview(URL.createObjectURL(file));
                      }
                      e.target.value = "";
                    }}
                  />
                  {formPhotoPreview ? (
                    <div className="relative w-full h-28 rounded-lg overflow-hidden border border-border group">
                      <img src={formPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => { setFormPhoto(null); setFormPhotoPreview(null); }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => formPhotoRef.current?.click()}
                      data-testid="input-form-photo"
                      className="w-full h-28 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-primary"
                    >
                      <Upload size={18} />
                      <span className="text-xs font-medium">Upload Photo</span>
                      <span className="text-[10px]">JPG, PNG · max 10MB</span>
                    </button>
                  )}
                </div>

                {/* Document upload */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                    <FileText size={13} className="text-muted-foreground" />
                    Consent Document
                    <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    ref={formDocRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (file) {
                        if (file.size > 25 * 1024 * 1024) {
                          toast({ title: "Document too large", description: "Max 25MB", variant: "destructive" });
                          return;
                        }
                        setFormDoc(file);
                      }
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => formDocRef.current?.click()}
                    data-testid="input-form-doc"
                    className={`w-full h-28 rounded-lg border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-1.5 ${
                      formDoc
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                        : "border-border hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-primary"
                    }`}
                  >
                    {formDoc ? (
                      <>
                        <FileText size={20} className="text-emerald-600" />
                        <span className="text-xs font-medium text-center px-2 truncate max-w-full">{formDoc.name}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setFormDoc(null); }}
                          className="text-[10px] text-emerald-600 underline"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <>
                        <Upload size={18} />
                        <span className="text-xs font-medium">Upload Document</span>
                        <span className="text-[10px]">PDF, DOC · max 25MB</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setAddOpen(false); resetForm(); }}>Cancel</Button>
                <Button type="submit" data-testid="button-confirm-add-doctor" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Adding...
                    </span>
                  ) : "Add Doctor"}
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
            <DialogTitle className="flex items-center gap-2">
              <Eye size={15} />
              Doctor Photo
            </DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img
              src={`${BASE}${previewUrl}`}
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
