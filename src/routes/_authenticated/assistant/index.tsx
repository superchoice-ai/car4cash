import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/Common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useBranchFilter } from "@/hooks/useBranchFilter";
import { askAssistant, type AssistantMessage } from "@/lib/assistant.functions";
import { ROLE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "สรุปสถานะลูกหนี้และงวดค้างชำระในขอบเขตที่ผมดูอยู่",
  "ขั้นตอนการออกใบเสร็จรับชำระทำอย่างไร",
  "ยกเลิกใบเสร็จที่ออกผิดต้องทำยังไง",
  "สิทธิ์ของผมทำอะไรได้บ้างในระบบนี้",
  "วิเคราะห์รายรับ-รายจ่ายเดือนนี้ให้หน่อย",
];

function AssistantPage() {
  const { roles } = useAuth();
  const { branchId, scopeName } = useBranchFilter();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const ask = useServerFn(askAssistant);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || loading) return;
    const next: AssistantMessage[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await ask({ data: { messages: next, branchId } });
      setMessages([...next, { role: "assistant", content: res.answer }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ผู้ช่วย AI ไม่พร้อมใช้งาน");
      setMessages(next);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  };

  return (
    <div>
      <PageHeader
        title="ผู้ช่วย AI"
        description="ถามวิธีใช้งานระบบ และให้ช่วยวิเคราะห์ข้อมูลตามสิทธิ์ของคุณ (อ่านข้อมูลเท่านั้น)"
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="secondary">ขอบเขตข้อมูล: {scopeName}</Badge>
        {roles.map((r) => (
          <Badge key={r} variant="outline">
            {ROLE_LABEL[r] ?? r}
          </Badge>
        ))}
        <Badge variant="outline">โหมดอ่านอย่างเดียว</Badge>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex min-h-[320px] flex-col gap-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <Sparkles className="size-8 text-accent" />
                <p className="font-medium">เริ่มถามผู้ช่วย AI ได้เลย</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  ผู้ช่วยจะตอบตามคู่มือการใช้งานระบบ และวิเคราะห์เฉพาะข้อมูลที่สิทธิ์ของคุณเข้าถึงได้
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <Button key={s} variant="outline" size="sm" onClick={() => void send(s)}>
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                <div
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                    m.role === "user" ? "bg-secondary text-secondary-foreground" : "bg-primary/10 text-primary",
                  )}
                >
                  {m.role === "user" ? <User className="size-4" /> : <Sparkles className="size-4" />}
                </div>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                    m.role === "user" ? "bg-secondary" : "bg-muted",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> กำลังคิด...
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="mt-4 flex items-end gap-2 border-t pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="พิมพ์คำถาม เช่น วิธีสร้างคำขอสินเชื่อ หรือ สรุปยอดค้างชำระเดือนนี้"
              rows={2}
              className="min-h-[52px] resize-none"
            />
            <Button type="submit" disabled={loading || !input.trim()} className="h-[52px]">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            ผู้ช่วยไม่สามารถสร้าง แก้ไข ลบ หรืออนุมัติข้อมูลได้ ทุกการเปลี่ยนแปลงต้องทำผ่านหน้าจอและระบบอนุมัติตามปกติ
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/assistant/")({
  head: () => ({
    meta: [
      { title: "ผู้ช่วย AI | SuperChoice AI" },
      {
        name: "description",
        content: "ผู้ช่วย AI ภาษาไทย ตอบวิธีใช้งานระบบสินเชื่อและวิเคราะห์ข้อมูลตามสิทธิ์ผู้ใช้แบบอ่านอย่างเดียว",
      },
      { property: "og:title", content: "ผู้ช่วย AI | SuperChoice AI" },
      { property: "og:description", content: "ถามวิธีใช้งานระบบและวิเคราะห์ข้อมูลสินเชื่อตามสิทธิ์ของคุณ" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantPage,
});
