# AutoLoan Central

มีแผนจะสร้าง web app เป็นแนว CRM + Car for cash ทำสินเชื่อรถแลกเงิน โดยให้ใช้ทรัพยากรระบบที่ loveable รองรับ เช่น cloud, ai, n8n, api ฯลฯ รวมถึงมี dashboard สำหรับผู้บริหาร ตามรายละเอียดด้านล่างนี้(ดูภาพรูปแบบการทำงานประกอบ)
มีแผนจะปรับปรุงระบบ PC Base ที่มี ms access เป็นฐานข้อมูล ระบบเดิมเป็น VB6 ใช้ cystal เป็น report ต้องการพัฒนาปรับปรุงเป็น web app(web base) ที่เคยมี requirement เป็นระบบสินเชื่อจำนำเล่มทะเบียนแลกเงินสด คล้าย car for cash คร่าวๆ ประมาณนี้ สำหรับ Phase I

As is:
#รองรับ CRUD 
#แต่ล่ะสาขาทำงานเป็น standalone
#มี admin คนเดียวในแต่ล่ะสาขาใช้ระบบ

#มี step manual อีกหลายๆ งาน
#มี report daily(excel, pdf, word) ขนาด A4 
#รองรับ ภาษาไทยเป็นหลัก

To be:
#รองรับ 11 สาขา โดยมีสนง.ใหญ่อยู่อ.เมือง สุราษฎร์ธานี และอีก 10 สาขาเป็นอำเภอในจังหวัดสุราษฎร์ธานี และรองรับขยายสาขาเพิ่ม
#รองรับ role ของแต่ล่ะหน้าที่ เช่น admin, manager, staff และอื่นๆ ที่จำเป็น ของแต่ล่ะสาขาและสนง.ใหญ่
#รองรับ approver flow ในกรณี delete record และกรณีอื่นๆ ที่จำเป็น
#ข้อมูลทั้ง 11 สาขาต้องเชื่อมโยง แต่มี flag แยกสาขา (ยังไม่ชัวร์ว่าถ้าไม่ใช่สนง.ใหญ่ ต่างสาขาจะเห็นข้อมูลกันได้มั้ย)
#รองรับ daily backup และมี cycle management เคลียร์ backup เกิน 1 วัน เพื่อประหยัดเนื้อที่

In the future:
Phase 1.1 รองรับระบบ push notify via brower, line oa, line, รองรับ API อื่นๆ และ รองรับ API Phase 2 อื่นๆ ยังไม่ได้กำหนด

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ba86c689-294b-4f44-b209-7ee1c7d99319).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
