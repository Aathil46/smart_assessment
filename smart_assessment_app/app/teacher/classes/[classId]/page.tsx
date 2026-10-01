import { ClassDetail } from "@/components/bolt/teacher/ClassDetail";

export default async function TeacherClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  return <ClassDetail classId={classId} />;
}
