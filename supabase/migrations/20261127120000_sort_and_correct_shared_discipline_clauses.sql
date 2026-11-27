update public.regulation_sections set content_text=$t$
พักงานเพื่อการสอบสวน
ในกรณีที่พนักงานกระทำความผิด และบริษัทพิจารณาเห็นสมควรให้มีการสอบสวน กรรมการผู้จัดการหรือผู้มีอำนาจที่ได้รับมอบหมายอาจสั่งพักงานเป็นหนังสือได้ไม่เกิน 7 วัน เพื่อสอบสวนโดยระบุความผิดให้พนักงานทราบ ระหว่างการพักงานเพื่อสอบสวนดังกล่าวบริษัทจะจ่ายค่าจ้างให้เท่ากับครึ่งหนึ่งของค่าจ้างที่ได้รับในวันทำงานปกติ หากผลการสอบสวนปรากฏว่าพนักงานไม่ผิด บริษัทจะจ่ายค่าจ้างส่วนที่ขาดอีกครึ่งหนึ่งระหว่างถูกพักงานให้พร้อมดอกเบี้ยร้อยละ 15 ต่อปี
$t$ where section_number='10.7' and document_id=(select id from public.regulation_documents where document_code='DP-SR-HR-001' and is_shared_standard=true limit 1);

with ordered as (
 select id,row_number() over(order by string_to_array(section_number,'.')::int[]) as rn
 from public.regulation_sections
 where document_id=(select id from public.regulation_documents where document_code='DP-SR-HR-001' and is_shared_standard=true limit 1)
)
update public.regulation_sections s set sort_order=o.rn from ordered o where s.id=o.id;