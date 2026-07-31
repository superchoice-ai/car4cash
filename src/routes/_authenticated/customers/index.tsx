import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader, EmptyState, StatusPill } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatThaiDate, isValidThaiId, thaiIdMask } from "@/lib/format";
import { CUSTOMER_STATUS_LABEL} from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/customers/")({
  head: () => ({
    meta: [
      { title: "ทะเบียนลูกค้า | ธารทรัพย์" },
      { name: "description", content: "ค้นหา เพิ่ม และจัดการข้อมูลลูกค้าสินเชื่อจำนำเล่มทะเบียนของแต่ละสาขา" },
      { property: "og:title", content: "ทะเบียนลูกค้า | ธารทรัพย์" },
      { property: "og:description", content: "จัดการข้อมูลลูกค้าสินเชื่อรถแลกเงิน" },
    ],
  }),
  component: CustomersPage,
});

interface CustomerRow {
  id: string;
  code: string;
  full_name: string;
  national_id: string;
  phone: string | null;
  status: string;
  occupation: string | null;
  created_at: string;
  branch_id: string;
  branches: { code: string; name: string } | null;
}

const customerSchema = z.object({
  full_name: z.string().trim().min(2, "กรุณากรอกชื่อ-นามสกุล").max(150),
  national_id: z.string().refine(isValidThaiId, "เลขบัตรประชาชนไม่ถูกต้อง"),
  phone: z.string().trim().regex(/^0\d{8,9}$/, "เบอร์โทรไม่ถูกต้อง"),
  email: z.string().trim().email("อีเมลไม่ถูกต้อง").max(255).or(z.literal("")),
  address: z.string().trim().max(500),
  occupation: z.string().trim().max(100),
  monthly_income: z.string(),
  note: z.string().trim().max(1000),
});

function CustomersPage() {
  const { profile, isHQ } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, code, full_name, national_id, phone, status, occupation, created_at, branch_id, branches:branch_id(code, name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as CustomerRow[];
    },
  });

  const [form, setForm] = useState({
    full_name: "",
    national_id: "",
    phone: "",
    email: "",
    address: "",
    occupation: "",
    monthly_income: "",
    note: "",
  });

  const createCustomer = useMutation({
    mutationFn: async () => {
      const parsed = customerSchema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0]!.message);
      if (!profile?.branch_id) throw new Error("บัญชีของคุณยังไม่ได้สังกัดสาขา กรุณาติดต่อผู้ดูแลระบบ");

      const { data: code, error: codeErr } = await supabase.rpc("next_doc_no", {
        _branch: profile.branch_id,
        _doc_type: "CUS",
      });
      if (codeErr) throw codeErr;

      const v = parsed.data;
      const { error } = await supabase.from("customers").insert({
        code: code as string,
        branch_id: profile.branch_id,
        full_name: v.full_name,
        national_id: v.national_id.replace(/\D/g, ""),
        phone: v.phone,
        email: v.email || null,
        address: v.address || null,
        occupation: v.occupation || null,
        monthly_income: v.monthly_income ? Math.round(parseFloat(v.monthly_income) * 100) : null,
        note: v.note || null,
        created_by: profile.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกข้อมูลลูกค้าเรียบร้อย");
      setOpen(false);
      setForm({ full_name: "", national_id: "", phone: "", email: "", address: "", occupation: "", monthly_income: "", note: "" });
      void qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) =>
      toast.error(e.message.includes("duplicate") ? "เลขบัตรประชาชนนี้มีในระบบแล้ว" : e.message),
  });

  const filtered = (customers ?? []).filter((c) => {
    const q = search.trim().toLowerCase();
    const matchQ =
      !q ||
      c.full_name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.national_id.includes(q.replace(/\D/g, "")) ||
      (c.phone ?? "").includes(q);
    const matchS = statusFilter === "all" || c.status === statusFilter;
    return matchQ && matchS;
  });

  return (
    <div>
      <PageHeader
        title="ทะเบียนลูกค้า"
        description={isHQ ? "ข้อมูลลูกค้าทุกสาขา" : "ข้อมูลลูกค้าเฉพาะสาขาของคุณ"}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> เพิ่มลูกค้าใหม่
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap gap-3 p-4">
          <div className="relative min-w-60 flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="ค้นหาชื่อ / รหัสลูกค้า / เลขบัตร / เบอร์โทร"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              {Object.entries(CUSTOMER_STATUS_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState title="ยังไม่มีข้อมูลลูกค้า" description="กดปุ่ม “เพิ่มลูกค้าใหม่” เพื่อเริ่มบันทึกข้อมูล" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>รหัส</TableHead>
                    <TableHead>ชื่อ-นามสกุล</TableHead>
                    <TableHead>เลขบัตรประชาชน</TableHead>
                    <TableHead>เบอร์โทร</TableHead>
                    <TableHead>อาชีพ</TableHead>
                    {isHQ && <TableHead>สาขา</TableHead>}
                    <TableHead>สถานะ</TableHead>
                    <TableHead>วันที่สร้าง</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="tabular font-medium">
                        <Link to="/customers/$customerId" params={{ customerId: c.id }} className="text-primary hover:underline">
                          {c.code}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserRound className="size-4 text-muted-foreground" />
                          {c.full_name}
                        </div>
                      </TableCell>
                      <TableCell className="tabular">{thaiIdMask(c.national_id)}</TableCell>
                      <TableCell className="tabular">{c.phone ?? "-"}</TableCell>
                      <TableCell>{c.occupation ?? "-"}</TableCell>
                      {isHQ && <TableCell>{c.branches?.name ?? "-"}</TableCell>}
                      <TableCell>
                        <StatusPill status={c.status} label={CUSTOMER_STATUS_LABEL[c.status] ?? c.status} />
                      </TableCell>
                      <TableCell className="tabular text-muted-foreground">{formatThaiDate(c.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>เพิ่มลูกค้าใหม่</DialogTitle>
            <DialogDescription>บันทึกข้อมูลผู้ขอสินเชื่อจำนำเล่มทะเบียน</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>ชื่อ-นามสกุล *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={150} />
            </div>
            <div className="space-y-1.5">
              <Label>เลขบัตรประชาชน *</Label>
              <Input
                value={form.national_id}
                onChange={(e) => setForm({ ...form, national_id: e.target.value })}
                placeholder="1234567890123"
                maxLength={17}
              />
            </div>
            <div className="space-y-1.5">
              <Label>เบอร์โทรศัพท์ *</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0812345678" maxLength={10} />
            </div>
            <div className="space-y-1.5">
              <Label>อีเมล</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} />
            </div>
            <div className="space-y-1.5">
              <Label>อาชีพ</Label>
              <Input value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label>รายได้ต่อเดือน (บาท)</Label>
              <Input
                type="number"
                value={form.monthly_income}
                onChange={(e) => setForm({ ...form, monthly_income: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>ที่อยู่</Label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={500} rows={2} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>หมายเหตุ</Label>
              <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={1000} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={() => createCustomer.mutate()} disabled={createCustomer.isPending}>
              บันทึกข้อมูล
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
