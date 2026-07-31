import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Car, FileSignature, Phone, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusPill, EmptyState } from "@/components/Common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, formatThaiDate, thaiIdMask } from "@/lib/format";
import {
  CUSTOMER_STATUS_LABEL,
  CONTRACT_STATUS_LABEL,
  VEHICLE_TYPE_LABEL,
  BOOK_STATUS_LABEL,
} from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/customers/$customerId")({
  head: () => ({
    meta: [
      { title: "ข้อมูลลูกค้า | ธารทรัพย์" },
      { name: "description", content: "รายละเอียดลูกค้า รถที่ใช้เป็นหลักประกัน และประวัติสัญญาสินเชื่อ" },
      { property: "og:title", content: "ข้อมูลลูกค้า | ธารทรัพย์" },
      { property: "og:description", content: "รายละเอียดลูกค้าและประวัติสินเชื่อ" },
    ],
  }),
  component: CustomerDetail,
});

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}

function CustomerDetail() {
  const { customerId } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: async () => {
      const [c, v, ct] = await Promise.all([
        supabase.from("customers").select("*, branches:branch_id(name)").eq("id", customerId).maybeSingle(),
        supabase.from("vehicles").select("*").eq("customer_id", customerId),
        supabase.from("contracts").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
      ]);
      return { customer: c.data, vehicles: v.data ?? [], contracts: ct.data ?? [] };
    },
  });

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-muted" />;
  if (!data?.customer)
    return <EmptyState title="ไม่พบข้อมูลลูกค้า" description="ข้อมูลอาจถูกลบ หรือคุณไม่มีสิทธิ์เข้าถึงข้อมูลสาขานี้" />;

  const c = data.customer as Record<string, unknown> & {
    code: string;
    full_name: string;
    national_id: string;
    status: string;
  };

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-2">
        <Link to="/customers">
          <ArrowLeft className="size-4" /> กลับทะเบียนลูกค้า
        </Link>
      </Button>

      <PageHeader
        title={c.full_name}
        description={`รหัสลูกค้า ${c.code}`}
        actions={<StatusPill status={c.status} label={CUSTOMER_STATUS_LABEL[c.status] ?? c.status} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">ข้อมูลส่วนตัว</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Field label="เลขบัตรประชาชน" value={thaiIdMask(c.national_id)} />
            <Field label="เบอร์โทรศัพท์" value={(c["phone"] as string) ?? "-"} />
            <Field label="อีเมล" value={(c["email"] as string) ?? "-"} />
            <Field label="อาชีพ" value={(c["occupation"] as string) ?? "-"} />
            <Field
              label="รายได้ต่อเดือน"
              value={c["monthly_income"] ? `฿${formatMoney(c["monthly_income"] as number)}` : "-"}
            />
            <Field label="ที่อยู่" value={(c["address"] as string) ?? "-"} />
            <Field label="สาขา" value={((c["branches"] as { name: string } | null)?.name) ?? "-"} />
            <Field label="ผู้ติดต่อฉุกเฉิน" value={(c["emergency_name"] as string) ?? "-"} />
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Car className="size-4" /> รถที่ใช้เป็นหลักประกัน ({data.vehicles.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.vehicles.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลรถ</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ทะเบียน</TableHead>
                      <TableHead>ประเภท / ยี่ห้อ-รุ่น</TableHead>
                      <TableHead>ปี</TableHead>
                      <TableHead className="text-right">ราคาประเมิน</TableHead>
                      <TableHead>เล่มทะเบียน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.vehicles.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">
                          {v.plate_no} {v.plate_province ?? ""}
                        </TableCell>
                        <TableCell>
                          {VEHICLE_TYPE_LABEL[v.vehicle_type] ?? v.vehicle_type} · {v.brand} {v.model}
                        </TableCell>
                        <TableCell className="tabular">{v.year ?? "-"}</TableCell>
                        <TableCell className="tabular text-right">฿{formatMoney(v.appraised_value)}</TableCell>
                        <TableCell>
                          <StatusPill status={v.book_status} label={BOOK_STATUS_LABEL[v.book_status] ?? v.book_status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSignature className="size-4" /> ประวัติสัญญา ({data.contracts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.contracts.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">ยังไม่มีสัญญา</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>เลขที่สัญญา</TableHead>
                      <TableHead className="text-right">เงินต้น</TableHead>
                      <TableHead className="text-right">คงค้าง</TableHead>
                      <TableHead>งวด</TableHead>
                      <TableHead>วันเริ่ม</TableHead>
                      <TableHead>สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.contracts.map((ct) => (
                      <TableRow key={ct.id}>
                        <TableCell className="tabular font-medium">
                          <Link to="/contracts/$contractId" params={{ contractId: ct.id }} className="text-primary hover:underline">
                            {ct.code}
                          </Link>
                        </TableCell>
                        <TableCell className="tabular text-right">฿{formatMoney(ct.principal)}</TableCell>
                        <TableCell className="tabular text-right">฿{formatMoney(ct.outstanding)}</TableCell>
                        <TableCell className="tabular">{ct.term_months} เดือน</TableCell>
                        <TableCell className="tabular">{formatThaiDate(ct.start_date)}</TableCell>
                        <TableCell>
                          <StatusPill status={ct.status} label={CONTRACT_STATUS_LABEL[ct.status] ?? ct.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Phone className="size-3.5" /> ติดต่อลูกค้าก่อนดำเนินการทุกครั้ง
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" /> ตรวจสอบที่อยู่ให้ตรงกับเอกสาร
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
