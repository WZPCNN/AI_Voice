// Layout — 应用主布局,Sidebar + Outlet
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useSessionStore } from '../store/sessionStore';
import { useChatStore } from '../store/chatStore';

export default function Layout() {
  const navigate = useNavigate();
  const conversations = useSessionStore((s) => s.conversations);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const selectSession = useSessionStore((s) => s.selectSession);
  const newSession = useSessionStore((s) => s.newSession);
  const deleteSession = useSessionStore((s) => s.deleteSession);
  const clearMessages = useChatStore((s) => s.clearMessages);

  return (
    <div className="flex h-screen">
      <Sidebar
        conversations={conversations}
        activeId={currentSessionId ?? ''}
        onSelect={selectSession}
        onNewSession={() => {
          newSession(crypto.randomUUID(), 'New Session');
          clearMessages();
        }}
        onDelete={deleteSession}
        onSettings={() => navigate('/settings')}
      />
      <Outlet />
    </div>
  );
}
