# Security Policy

Warning System handles confidential employee and disciplinary information.

## Reporting
Report suspected vulnerabilities privately to the system owner. Do not publish exploit details, employee information, warning documents, credentials, or database exports in public issues.

## Required safeguards
- Keep the repository private before production use.
- Use a dedicated Supabase project for Warning System.
- Enable and verify Row Level Security on every table containing HR data.
- Keep service-role keys and database credentials on trusted server-side systems only.
- Store evidence files in private storage buckets and serve them using short-lived signed URLs.
- Use least-privilege roles and review access regularly.
- Enable audit trails for sensitive create, update, approve, reject, issue, and export actions.
- Never use real employee data in development fixtures or screenshots.
