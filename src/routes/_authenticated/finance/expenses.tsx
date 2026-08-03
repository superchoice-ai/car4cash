import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Printer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBranchFilter } from "@/hooks/useBranchFilter";
import { PageHeader, EmptyState, StatCard } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatThaiDate, todayISO, toSatang, toBaht } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { categoriesFor, CASH_CATEGORY_LABEL, type CashCategory } from "@/lib/cashbook";

export const Route = createFileRoute("/_authenticated/finance/expenses")({
  head: () => ({
    meta: [
      { title: "บันทึกรายจ่าย | ธารทรัพย์" },
      {
        name: "description",
        content: "แฟ้มรายจ่ายของสาขา — เงินเดือน ประกัน ทะเบียน ติดตาม สำนักงาน ดอกเบี้ย คืนเงินกู้ และต่างสาขา",
      },
      { property: "og:title", content: "บันทึกรายจ่าย | ธารทรัพย์" },
      { property: "og:description", content: "บันทึกใบสำคัญจ่ายแยกหมวดแบบเดียวกับระบบเดิม" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExpensesPage,
});

const EXPENSE_CATEGORIES = categoriesFor("expense");

type AmountMap = Partial<Record<CashCategory, string>>;

function ExpensesPage() {
  const { profile, isHQ, isManager } = useAuth();
  const { branchId } = useBranchFilter();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(todayISO());
  const [partyName, setPartyName] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [amounts, setAmounts] = useState<AmountMap>({});

  const [from, setFrom] = useState(todayISO().slice(0, 8) + "01");
  const [to, setTo] = useState(todayISO());
  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: entries, isLoading } = useQuery({
    queryKey: ["cash-expenses", from, to, keyword, categoryFilter, branchId],
    queryFn: async () => {
      let q = supabase
        .from("cash_entries")
        .select("*, branches:branch_id(name), cash_entry_lines(id, category, amount, note)")
        .eq("direction", "expense")
        .gte("entry_date", from)
        .lte("entry_date", to)
        .order("entry_date", { ascending: false })
        .order("doc_no", { ascending: false })
        .limit(500);
      if (branchId) q = q.eq("branch_id", branchId);
      if (keyword.trim()) q = q.or(`doc_no.ilike.%${keyword}%,party_name.ilike.%${keyword}%`);
      const { data, error } = await q;
      if (error) throw error;
      const rows = data ?? [];
      if (categoryFilter === "all") return rows;
      return rows.filter((r) => r.cash_entry_lines.some((l) => l.category === categoryFilter));
    },
  });

  const rows = entries ?? [];
  const total = rows.filter((r) => !r.voided).reduce((s, r) => s + Number(r.total_amount), 0);
  const catTotal = (cat: CashCategory) =>
    rows
      .filter((r) => !r.voided)
      .reduce((s, r) => s + r.cash_entry_lines.filter((l) => l.category === cat).reduce((a, l) => a + Number(l.amount), 0), 0);

  const resetForm = () => {
    setEditingId(null);
    setEntryDate(todayISO());
    setPartyName("");
    setMethod("cash");
    setNote("");
    setAmounts({});
  };

  const openNew = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (row: (typeof rows)[number]) => {
    setEditingId(row.id);
    setEntryDate(row.entry_date);
    setPartyName(row.party_name ?? "");
    setMethod(row.method);
    setNote(row.note ?? "");
    const next: AmountMap = {};
    for (const l of row.cash_entry_lines) {
      if (Number(l.amount) !== 0) next[l.category] = String(toBaht(Number(l.amount)));
    }
    setAmounts(next);
    setOpen(true);
  };

  const buildLines = () =>
    EXPENSE_CATEGORIES.map((c) => ({ category: c.key, amount: toSatang(amounts[c.key] || "0") })).filter(
      (l) => l.amount > 0,
    );

  const save = useMutation({
    mutationFn: async () => {
      if (!profile?.branch_id) throw new Error("บัญชีของคุณยังไม่ได้สังกัดสาขา");
      const lines = buildLines();
      if (lines.length === 0) throw new Error("กรุณากรอกจำนวนเงินอย่างน้อย 1 หมวด");
      if (!partyName.trim()) throw new Error("กรุณากรอกชื่อผู้รับเงิน");
      const sum = lines.reduce((s, l) => s + l.amount, 0);

      if (editingId) {
        const { error: uErr } = await supabase
          .from("cash_entries")
          .update({
            entry_date: entryDate,
            party_name: partyName.trim(),
            method,
            note: note || null,
            total_amount: sum,
          })
          .eq("id", editingId);
        if (uErr) throw uErr;
        const { error: dErr } = await supabase.from("cash_entry_lines").delete().eq("entry_id", editingId);
        if (dErr) throw dErr;
        const { error: lErr } = await supabase.from("cash_entry_lines").insert(
          lines.map((l) => ({
            entry_id: editingId,
            branch_id: profile.branch_id!,
            direction: "expense" as const,
            category: l.category,
            amount: l.amount,
          })),
        );
        if (lErr) throw lErr;
        return;
      }

      const { data: docNo, error: nErr } = await supabase.rpc("next_doc_no", {
        _branch: profile.branch_id,
        _doc_type: "EXP",
      });
      if (nErr) throw nErr;

      const { data: created, error: cErr } = await supabase
        .from("cash_entries")
        .insert({
          branch_id: profile.branch_id,
          direction: "expense",
          doc_no: docNo as string,
          entry_date: entryDate,
          party_name: partyName.trim(),
          method,
          note: note || null,
          total_amount: sum,
          created_by: profile.id,
        })
        .select("id")
        .single();
      if (cErr) throw cErr;

      const { error: lErr } = await supabase.from("cash_entry_lines").insert(
        lines.map((l) => ({
          entry_id: created.id,
          branch_id: profile.branch_id!,
          direction: "expense" as const,
          category: l.category,
          amount: l.amount,
        })),
      );
      if (lErr) throw lErr;
    },
    onSuccess: () => {
      toast.success(editingId ? "แก้ไขรายจ่ายเรียบร้อย" : "บันทึกรายจ่ายเรียบร้อย");
      setOpen(false);
      resetForm();
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeEntry = useMutation({
    mutationFn: async (row: (typeof rows)[number]) => {
      if (isManager) {
        const { error } = await supabase.from("cash_entries").delete().eq("id", row.id);
        if (error) throw error;
        return "deleted" as const;
      }
      const { error } = await supabase.from("approval_requests").insert({
        branch_id: row.branch_id,
        type: "delete_record",
        entity_table: "cash_entries",
        entity_id: row.id,
        entity_label: `ใบสำคัญจ่าย ${row.doc_no} · ฿${formatMoney(row.total_amount)}`,
        reason: "ขอลบรายการรายจ่าย",
        requested_by: profile?.id ?? null,
      });
      if (error) throw error;
      return "requested" as const;
    },
    onSuccess: (r) => {
      toast.success(r === "deleted" ? "ลบรายการเรียบร้อย" : "ส่งคำขออนุมัติลบเรียบร้อย");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const formTotal = buildLines().reduce((s, l) => s + l.amount, 0);

  return (
    <div>
      <PageHeader
        title="บันทึกรายจ่าย"
        description="แฟ้มรายจ่ายแยกหมวดแบบเดียวกับระบบเดิม — หนึ่งใบสำคัญจ่ายมีได้หลายหมวด"
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" /> พิมพ์
            </Button>
            <Button onClick={openNew}>
              <Plus className="size-4" /> บันทึกรายจ่าย
            </Button>
          </>
        }
      />

      <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="รายจ่ายรวมในช่วงที่เลือก" value={`฿${formatMoney(total)}`} tone="danger" />
        <StatCard label="เงินเดือน" value={`฿${formatMoney(catTotal("salary"))}`} />
        <StatCard label="ค่าสำนักงาน" value={`฿${formatMoney(catTotal("office"))}`} />
        <StatCard label="ดอกเบี้ยจ่าย" value={`฿${formatMoney(catTotal("interest"))}`} />
      </div>

      <Card className="no-print mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label>ตั้งแต่วันที่</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>ถึงวันที่</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>หมวด</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกหมวด</SelectItem>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>ค้นหา (เลขที่ใบสำคัญ / ชื่อ)</Label>
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="เช่น EXP-01..." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6">
              <EmptyState title="ยังไม่มีรายการรายจ่าย" description="กด “บันทึกรายจ่าย” เพื่อเพิ่มใบสำคัญจ่ายใบแรก" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead>เลขที่ใบสำคัญ</TableHead>
                    <TableHead>วันที่</TableHead>
                    <TableHead>ชื่อผู้รับเงิน</TableHead>
                    <TableHead>หมวด</TableHead>
                    {isHQ && <TableHead>สาขา</TableHead>}
                    <TableHead className="text-right">จำนวนเงิน</TableHead>
                    <TableHead className="no-print w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} className={r.voided ? "opacity-50 line-through" : ""}>
                      <TableCell className="tabular font-medium">{r.doc_no}</TableCell>
                      <TableCell className="tabular whitespace-nowrap">{formatThaiDate(r.entry_date)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.party_name || "-"}</TableCell>
                      <TableCell className="max-w-[220px] truncate">
                        {r.cash_entry_lines
                          .map((l) => `${CASH_CATEGORY_LABEL[l.category]} ${formatMoney(l.amount)}`)
                          .join(" · ")}
                      </TableCell>
                      {isHQ && <TableCell>{r.branches?.name ?? "-"}</TableCell>}
                      <TableCell className="tabular text-right font-medium">฿{formatMoney(r.total_amount)}</TableCell>
                      <TableCell className="no-print">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(r)} aria-label="แก้ไข">
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeEntry.mutate(r)}
                            aria-label="ลบ"
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={isHQ ? 5 : 4} className="text-right font-semibold">
                      รวมรายจ่าย
                    </TableCell>
                    <TableCell className="tabular text-right font-bold">฿{formatMoney(total)}</TableCell>
                    <TableCell className="no-print" />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : (setOpen(false), resetForm()))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "แก้ไขใบสำคัญจ่าย" : "บันทึกใบสำคัญจ่าย"}</DialogTitle>
            <DialogDescription>กรอกเฉพาะหมวดที่มีการจ่ายจริง ระบบจะรวมยอดให้อัตโนมัติ</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>วันที่ *</Label>
                <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>ชื่อ-สกุล ผู้รับเงิน *</Label>
                <Input value={partyName} onChange={(e) => setPartyName(e.target.value)} maxLength={150} />
              </div>
            </div>

            <div className="rounded-md border p-3">
              <p className="mb-2 text-sm font-medium">จำนวนเงินแยกหมวด (บาท)</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {EXPENSE_CATEGORIES.map((c) => (
                  <div key={c.key} className="space-y-1.5">
                    <Label className="text-xs">{c.label}</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={amounts[c.key] ?? ""}
                      onChange={(e) => setAmounts((a) => ({ ...a, [c.key]: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                ))}
              </div>
              <p className="tabular mt-3 text-right text-sm font-bold">รวม ฿{formatMoney(formTotal)}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>ช่องทางจ่าย</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>หมายเหตุ</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
            >
              ยกเลิก
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              บันทึกข้อมูล
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
