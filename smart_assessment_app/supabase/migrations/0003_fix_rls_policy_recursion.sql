-- The student class policy queried class_members while the teacher class_members
-- policy queried classes, causing PostgreSQL policy recursion. Student enrollment
-- and joined-class access are deferred until that flow has dedicated policies.
drop policy if exists "students can view joined classes" on classes;
