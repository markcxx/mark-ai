import ChatApp from '@/components/chat/ChatApp';

export default async function Page({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return <ChatApp initialSessionId={sessionId} />;
}
