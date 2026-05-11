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
import { Plus, Search, ChevronLeft, ChevronRight, Image, Download, Upload, X, Eye, CheckCircle2, Clock } from "lucide-react";
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

// Optimistic photo state keyed by doctor id
type PhotoState = { url: string; uploading: boolean };

export default function MyDoctorsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);

  // Optimistic photo states: show blob URL immediately, then replace with server URL
  const [photoStates, setPhotoStates] = useState<Record<number, PhotoState>>({});

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewIsBlob, setPreviewIsBlob] = useState(false);

  const photoInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Form-level file state
  const [formPhoto, setFormPhoto] = useState<File | null>(null);
  const [formPhotoPreview, setFormPhotoPreview] = useState<string | null>(null);
  const formPhotoRef = useRef<HTMLInputElement | null>(null);

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
    if (formPhotoPreview) URL.revokeObjectURL(formPhotoPreview);
    setFormPhoto(null);
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

      if (formPhoto && doctorId) {
        // Show optimistic preview immediately
        const blobUrl = formPhotoPreview ?? URL.createObjectURL(formPhoto);
        setPhotoStates(s => ({ ...s, [doctorId]: { url: blobUrl, uploading: true } }));

        uploadFile(`/api/manager/doctors/${doctorId}/photo`, "photo", formPhoto)
          .then(async (res) => {
            if (!res.ok) throw new Error();
            const data = await res.json() as { photoUrl: string };
            setPhotoStates(s => ({ ...s, [doctorId]: { url: `${BASE}${data.photoUrl}`, uploading: false } }));
            queryClient.invalidateQueries({ queryKey: getListMyDoctorsQueryKey() });
          })
          .catch(() => {
            setPhotoStates(s => { const n = { ...s }; delete n[doctorId]; return n; });
            toast({ title: "Photo upload failed", variant: "destructive" });
          });
      } else {
        queryClient.invalidateQueries({ queryKey: getListMyDoctorsQueryKey() });
      }

      toast({ title: "Doctor added" });
      resetForm();
      setAddOpen(false);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "data" in err
        ? String((err as { data: { error?: string } }).data?.error)
        : "Failed to add doctor";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  // Instant photo upload from the table row
  const handlePhotoUpload = (doctorId: number, file: File) => {
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      toast({ title: "Invalid file", description: "Only JPG, PNG allowed", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10MB", variant: "destructive" });
      return;
    }

    // Show blob preview instantly — no waiting for server
    const blobUrl = URL.createObjectURL(file);
    setPhotoStates(s => ({ ...s, [doctorId]: { url: blobUrl, uploading: true } }));

    uploadFile(`/api/manager/doctors/${doctorId}/photo`, "photo", file)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json() as { photoUrl: string };
        // Replace blob with real server URL, revoke blob
        URL.revokeObjectURL(blobUrl);
        setPhotoStates(s => ({ ...s, [doctorId]: { url: `${BASE}${data.photoUrl}`, uploading: false } }));
        queryClient.invalidateQueries({ queryKey: getListMyDoctorsQueryKey() });
        toast({ title: "Photo saved" });
      })
      .catch(() => {
        URL.revokeObjectURL(blobUrl);
        setPhotoStates(s => { const n = { ...s }; delete n[doctorId]; return n; });
        toast({ title: "Upload failed", variant: "destructive" });
      });
  };

  const getPhotoUrl = (d: { id: number; photoUrl: string | null }) => {
    const opt = photoStates[d.id];
    if (opt) return opt.url;
    if (d.photoUrl) return `${BASE}${d.photoUrl}`;
    return null;
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
                  <th className="text-center px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Photo</th>
                  <th className="text-center px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Added</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {[...Array(7)].map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>
                    ))}
                  </tr>
                ))}
                {!isLoading && doctors.map((d) => {
                  const photoUrl = getPhotoUrl(d);
                  const isUploading = photoStates[d.id]?.uploading ?? false;

                  return (
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

                      {/* Photo column — thumbnail + upload button */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {photoUrl ? (
                            <div className="relative">
                              <button
                                onClick={() => { setPreviewUrl(photoUrl); setPreviewIsBlob(isUploading); }}
                                className="block w-9 h-9 rounded-md overflow-hidden border border-border hover:border-primary transition-colors shrink-0"
                                title="Preview photo"
                              >
                                <img
                                  src={photoUrl}
                                  alt="photo"
                                  className="w-full h-full object-cover"
                                />
                              </button>
                              {isUploading && (
                                <div className="absolute inset-0 rounded-md bg-black/40 flex items-center justify-center">
                                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                </div>
                              )}
                            </div>
                          ) : null}

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
                            disabled={isUploading}
                            title={photoUrl ? "Replace photo" : "Upload photo"}
                            className={`p-1.5 rounded-lg border transition-colors text-xs flex items-center gap-1 ${
                              photoUrl
                                ? "border-border text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5"
                                : "border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5"
                            }`}
                          >
                            <Upload size={12} />
                            <span>{photoUrl ? "Replace" : "Upload"}</span>
                          </button>
                        </div>
                      </td>

                      {/* Status — now based on photo only */}
                      <td className="px-4 py-3 text-center">
                        {(d.isComplete || !!photoStates[d.id]) ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            <CheckCircle2 size={10} />
                            Complete
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            <Clock size={10} />
                            Pending
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {format(new Date(d.createdAt), "dd MMM yyyy")}
                      </td>
                    </tr>
                  );
                })}
                {!isLoading && doctors.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground text-sm">
                      No doctors added yet. Click "Add Doctor" to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

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
                    <FormLabel>Clinic Address <span className="text-muted-foreground font-normal text-xs">(optional)</span></FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-doctor-address" placeholder="Clinic address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone <span className="text-muted-foreground font-normal text-xs">(optional)</span></FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-doctor-phone" placeholder="Phone number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Photo upload only */}
              <div>
                <p className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                  <Image size={13} className="text-muted-foreground" />
                  Doctor Photo
                  <span className="text-muted-foreground font-normal text-xs">(optional — can upload later)</span>
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
                      if (formPhotoPreview) URL.revokeObjectURL(formPhotoPreview);
                      setFormPhoto(file);
                      setFormPhotoPreview(URL.createObjectURL(file));
                    }
                    e.target.value = "";
                  }}
                />
                {formPhotoPreview ? (
                  <div className="relative h-36 w-full rounded-xl overflow-hidden border border-border group cursor-pointer" onClick={() => formPhotoRef.current?.click()}>
                    <img src={formPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-medium bg-black/60 px-2 py-1 rounded transition-opacity">Change photo</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); if (formPhotoPreview) URL.revokeObjectURL(formPhotoPreview); setFormPhoto(null); setFormPhotoPreview(null); }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => formPhotoRef.current?.click()}
                    data-testid="input-form-photo"
                    className="w-full h-28 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-primary"
                  >
                    <Upload size={20} />
                    <span className="text-sm font-medium">Click to upload photo</span>
                    <span className="text-xs">JPG, PNG — max 10 MB</span>
                  </button>
                )}
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
      <Dialog open={!!previewUrl} onOpenChange={(o) => { if (!o) { setPreviewUrl(null); setPreviewIsBlob(false); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye size={15} />
              Doctor Photo
              {previewIsBlob && <span className="text-xs text-amber-600 font-normal">(uploading...)</span>}
            </DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Doctor photo"
              className="w-full rounded-xl object-contain max-h-[70vh]"
              onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400?text=Photo"; }}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
