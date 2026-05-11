import { AppShell } from "@/components/layout/shell";
import { StatCard } from "@/components/stat-card";
import { useGetMe, useGetAdminDashboard, useGetManagerDashboard, useGetDailyAdditions, useGetManagerPerformance, getGetAdminDashboardQueryKey, getGetDailyAdditionsQueryKey } from "@workspace/api-client-react";
import { Users, Stethoscope, Image, FileText, Clock, TrendingUp, BarChart2, CheckCircle } from "lucide-react";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

function AdminDashboard() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const params = {
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  };

  const { data: stats, isLoading } = useGetAdminDashboard(params, {
    query: { queryKey: getGetAdminDashboardQueryKey(params) },
  });
  const { data: dailyData } = useGetDailyAdditions({ days: 30 }, {
    query: { queryKey: getGetDailyAdditionsQueryKey({ days: 30 }) },
  });
  const { data: performance } = useGetManagerPerformance();

  const chartData = (dailyData ?? []).map((d) => ({
    date: d.date ? format(new Date(d.date), "MMM d") : "",
    count: d.count,
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Campaign overview and performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            data-testid="input-start-date"
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            data-testid="input-end-date"
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Stats Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-5 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <StatCard
            label="Total Doctors"
            value={stats?.totalDoctors ?? 0}
            icon={Stethoscope}
            iconColor="text-blue-500"
            iconBg="bg-blue-50"
          />
          <StatCard
            label="Total Managers"
            value={stats?.totalManagers ?? 0}
            icon={Users}
            iconColor="text-violet-500"
            iconBg="bg-violet-50"
          />
          <StatCard
            label="Photos Uploaded"
            value={stats?.totalPhotos ?? 0}
            icon={Image}
            iconColor="text-emerald-500"
            iconBg="bg-emerald-50"
          />
          <StatCard
            label="Documents Uploaded"
            value={stats?.totalDocuments ?? 0}
            icon={FileText}
            iconColor="text-amber-500"
            iconBg="bg-amber-50"
          />
          <StatCard
            label="Pending Profiles"
            value={stats?.pendingProfiles ?? 0}
            icon={Clock}
            iconColor="text-orange-500"
            iconBg="bg-orange-50"
          />
          <StatCard
            label="Completion Rate"
            value={`${stats?.completionPercentage ?? 0}%`}
            icon={TrendingUp}
            iconColor="text-teal-500"
            iconBg="bg-teal-50"
          />
          <StatCard
            label="Added (7 days)"
            value={stats?.recentAdditions ?? 0}
            icon={CheckCircle}
            iconColor="text-green-500"
            iconBg="bg-green-50"
          />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Daily Additions Chart */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={16} className="text-primary" />
            <h2 className="font-semibold text-foreground text-sm">Daily Doctor Additions (Last 30 Days)</h2>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Doctors Added" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Manager Performance Table */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-primary" />
            <h2 className="font-semibold text-foreground text-sm">Manager Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium text-xs">Manager</th>
                  <th className="text-right py-2 text-muted-foreground font-medium text-xs">Doctors</th>
                  <th className="text-right py-2 text-muted-foreground font-medium text-xs">Completed</th>
                  <th className="text-right py-2 text-muted-foreground font-medium text-xs">Rate</th>
                </tr>
              </thead>
              <tbody>
                {(performance ?? []).map((p) => (
                  <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 font-medium text-foreground">{p.name}</td>
                    <td className="py-2.5 text-right text-muted-foreground">{p.totalDoctors}</td>
                    <td className="py-2.5 text-right text-muted-foreground">{p.completedProfiles}</td>
                    <td className="py-2.5 text-right">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        p.completionPercentage >= 75
                          ? "bg-emerald-100 text-emerald-700"
                          : p.completionPercentage >= 40
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {p.completionPercentage}%
                      </span>
                    </td>
                  </tr>
                ))}
                {(performance ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground text-sm">No managers yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManagerDashboard() {
  const { data: stats, isLoading } = useGetManagerDashboard();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">My Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your campaign progress overview</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-5 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="Total Doctors"
            value={stats?.totalDoctors ?? 0}
            icon={Stethoscope}
            iconColor="text-blue-500"
            iconBg="bg-blue-50"
          />
          <StatCard
            label="Photos Uploaded"
            value={stats?.photosUploaded ?? 0}
            icon={Image}
            iconColor="text-emerald-500"
            iconBg="bg-emerald-50"
          />
          <StatCard
            label="Documents Uploaded"
            value={stats?.documentsUploaded ?? 0}
            icon={FileText}
            iconColor="text-amber-500"
            iconBg="bg-amber-50"
          />
          <StatCard
            label="Completed Profiles"
            value={stats?.completedProfiles ?? 0}
            icon={CheckCircle}
            iconColor="text-teal-500"
            iconBg="bg-teal-50"
          />
          <StatCard
            label="Completion Rate"
            value={`${stats?.completionPercentage ?? 0}%`}
            icon={TrendingUp}
            iconColor="text-violet-500"
            iconBg="bg-violet-50"
          />
        </div>
      )}

      {/* Completion Progress */}
      <div className="bg-card border border-card-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground text-sm">Campaign Progress</h2>
          <span className="text-sm font-bold text-primary">{stats?.completionPercentage ?? 0}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${stats?.completionPercentage ?? 0}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>{stats?.completedProfiles ?? 0} completed</span>
          <span>{(stats?.totalDoctors ?? 0) - (stats?.completedProfiles ?? 0)} pending</span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: user } = useGetMe();

  return (
    <AppShell>
      {user?.role === "admin" ? <AdminDashboard /> : <ManagerDashboard />}
    </AppShell>
  );
}
