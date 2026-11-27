UPDATE public.regulation_categories SET category_name_th = CASE category_code
  WHEN 'general' THEN 'หมวดทั่วไป'
  WHEN 'employment' THEN 'การจ้างงาน'
  WHEN 'working_time' THEN 'วันทำงาน เวลาทำงานปกติ และเวลาพัก'
  WHEN 'holidays' THEN 'วันหยุดและหลักเกณฑ์วันหยุด'
  WHEN 'wages' THEN 'การบริหารค่าจ้าง เงินเดือน และค่าตอบแทน'
  WHEN 'overtime' THEN 'การทำงานล่วงเวลาและการทำงานในวันหยุด'
  WHEN 'leave' THEN 'การลาและหลักเกณฑ์การลา'
  WHEN 'welfare_safety' THEN 'สวัสดิการ การรักษาพยาบาลและความปลอดภัย'
  WHEN 'development' THEN 'การพัฒนาบุคลากร'
  WHEN 'discipline' THEN 'วินัยและโทษทางวินัย'
  WHEN 'grievances' THEN 'การร้องทุกข์'
  WHEN 'termination' THEN 'การพ้นสภาพการเป็นพนักงาน'
  WHEN 'severance' THEN 'การจ่ายค่าชดเชย'
  WHEN 'acknowledgment' THEN 'การทำความเข้าใจในข้อบังคับการทำงาน'
  ELSE category_name_th END
WHERE category_code IN ('general','employment','working_time','holidays','wages','overtime','leave','welfare_safety','development','discipline','grievances','termination','severance','acknowledgment');