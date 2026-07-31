import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/Common";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/assistant/")({
  head: () => ({
    meta: [
      { title: "ผู้ช่วย AI | ธารทรัพย์" },
      { name: "description", content: "ผู้ช่วย AI ภาษาไทยสำหรับสรุปความเสี่ยงลูกหนี้และตอบคำถามข้อมูลสินเชื่อ" },
      { property: "og:title", content: "ผู้ช่วย AI | ธารทรัพย์" },
      { property: "og:description", content: "ผู้ช่วย AI ภาษาไทยสำหรับงานสินเชื่อ" },
    ],
  }),
  component: () => (
    <div>
      <PageHeader title="ผู้ช่วย AI" description="สรุปความเสี่ยงและตอบคำถามภาษาไทยจากข้อมูลในระบบ" />
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <Sparkles className="size-8 text-accent" />
          <p className="font-medium">กำลังเตรียมผู้ช่วย AI</p>
          <p className="max-w-md text-sm text-muted-foreground">
            ขั้นตอนถัดไปจะเชื่อมผู้ช่วย AI เข้ากับข้อมูลลูกค้า สัญญา และการชำระเงิน เพื่อสรุปความเสี่ยงและตอบคำถามเป็นภาษาไทย
          </p>
        </CardContent>
      </Card>
    </div>
  ),
});
