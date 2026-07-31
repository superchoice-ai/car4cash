import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/Common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/settings/")({
  head: () => ({
    meta: [
      { title: "ตั้งค่าระบบ | ธารทรัพย์" },
      { name: "description", content: "จัดการสาขา ผู้ใช้งาน สิทธิ์การเข้าถึง และค่าตั้งต้นของระบบสินเชื่อ" },
      { property: "og:title", content: "ตั้งค่าระบบ | ธารทรัพย์" },
      { property: "og:description", content: "จัดการสาขา ผู้ใช้งาน และค่าตั้งต้นสินเชื่อ" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data } = useQuery({
    queryKey: ["settings-data"],
    queryFn: async () => {
      const [b, s] = await Promise.all([
        supabase.from("branches").select("*").order("code"),
        supabase.from("system_settings").select("*"),
      ]);
      return { branches: b.data ?? [], settings: s.data ?? [] };
    },
  });

  return (
    <div>
      <PageHeader title="ตั้งค่าระบบ" description="ข้อมูลสาขาและค่าตั้งต้นของระบบสินเชื่อ" />

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">สาขาทั้งหมด ({data?.branches.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>รหัส</TableHead>
                <TableHead>ชื่อสาขา</TableHead>
                <TableHead>อำเภอ</TableHead>
                <TableHead>ประเภท</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.branches ?? []).map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="tabular font-medium">{b.code}</TableCell>
                  <TableCell>{b.name}</TableCell>
                  <TableCell>{b.district ?? "-"}</TableCell>
                  <TableCell>{b.is_hq ? "สำนักงานใหญ่" : "สาขา"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">ค่าตั้งต้นระบบ</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>คีย์</TableHead>
                <TableHead>คำอธิบาย</TableHead>
                <TableHead>ค่า</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.settings ?? []).map((s) => (
                <TableRow key={s.key}>
                  <TableCell className="tabular font-medium">{s.key}</TableCell>
                  <TableCell>{s.description ?? "-"}</TableCell>
                  <TableCell className="tabular text-xs">{JSON.stringify(s.value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
