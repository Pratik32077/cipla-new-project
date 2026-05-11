import { useState } from "react";
import { AppShell } from "@/components/layout/shell";
import { useListManagers, useCreateManager, useDeleteManager, getListManagersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Download, Users, CheckCircle2, Clock } from "lucide-react";
import { exportUrl } from "@/lib/api";
import { format } from "date-fns";

const managerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  employeeCode: z.string().min(3, "Employee code must be at least 3 characters").toUpperCase(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type ManagerForm = z.infer<typeof managerSchema>;

export default function ManagersPage() {
  const { data: managers, isLoading } = useListManagers();
  const createMutation = useCreateManager();
  const deleteMutation = useDeleteManager();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const form = useForm<ManagerForm>({
    resolver: zodResolver(managerSchema),
    defaultValues: { name: "", employeeCode: "", password: "" },
  });

  const onAddManager = async (values: ManagerForm) => {
    try {
      await createMutation.mutateAsync({ data: values });
      queryClient.invalidateQueries({ queryKey: getListManagersQueryKey() });
      toast({ title: "Manager added successfully" });
      form.reset();
      setAddOpen(false);
    } catch {
      toast({ title: "Failed to add manager", description: "Employee code may already exist.", variant: "destructive" });
    }
  };

  const onDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListManagersQueryKey() });
      toast({ title: "Manager deleted" });
      setDeleteId(null);
    } catch {
      toast({ title: "Failed to delete manager", variant: "destructive" });
    }
  };

  return (
    <AppShell>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Managers</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {managers?.length ?? 0} managers registered
            </p>
          </div>
          <Button
            onClick={() => setAddOpen(true)}
            data-testid="button-add-manager"
            className="gap-2"
          >
            <Plus size={16} />
            Add Manager
          </Button>
        </div>

        {/* Table */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Manager</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Emp Code</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Doctors</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Photos</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Documents</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Completed</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Rate</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Joined</th>
                  <th className="px-4 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  [...Array(4)].map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td colSpan={9} className="px-5 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded w-full" />
                      </td>
                    </tr>
                  ))
                )}
                {!isLoading && (managers ?? []).map((m) => (
                  <tr key={m.id} data-testid={`row-manager-${m.id}`} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Users size={14} className="text-primary" />
                        </div>
                        <span className="font-medium text-foreground">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground font-mono text-xs">{m.employeeCode}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-foreground">{m.totalDoctors}</td>
                    <td className="px-4 py-3.5 text-right text-muted-foreground">{m.photosUploaded}</td>
                    <td className="px-4 py-3.5 text-right text-muted-foreground">{m.documentsUploaded}</td>
                    <td className="px-4 py-3.5 text-right text-muted-foreground">{m.completedProfiles}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        m.completionPercentage >= 75 ? "bg-emerald-100 text-emerald-700"
                          : m.completionPercentage >= 40 ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {m.completionPercentage}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">
                      {format(new Date(m.createdAt), "dd MMM yyyy")}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 justify-center">
                        <a
                          href={exportUrl(`/api/admin/managers/${m.id}/export`)}
                          data-testid={`button-export-manager-${m.id}`}
                          className="p-1.5 rounded hover:bg-primary/10 text-primary transition-colors"
                          title="Export doctors"
                        >
                          <Download size={14} />
                        </a>
                        <button
                          onClick={() => setDeleteId(m.id)}
                          data-testid={`button-delete-manager-${m.id}`}
                          className="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors"
                          title="Delete manager"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && (managers ?? []).length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-muted-foreground text-sm">
                      No managers added yet. Click "Add Manager" to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Manager Dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) form.reset(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Manager</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onAddManager)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-manager-name" placeholder="e.g. Rajesh Kumar" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employeeCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee Code</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-manager-code" placeholder="e.g. MGR004" className="uppercase" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-manager-password" type="password" placeholder="Min. 6 characters" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="submit" data-testid="button-confirm-add-manager" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Adding..." : "Add Manager"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Manager</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this manager? All their associated doctors will also be deleted. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              data-testid="button-confirm-delete"
              disabled={deleteMutation.isPending}
              onClick={() => deleteId !== null && onDelete(deleteId)}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
