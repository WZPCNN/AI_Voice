// Layout — 应用主布局,Sidebar + Outlet
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useConversations } from '../hooks/useConversations';

export default function Layout() {
  const navigate = useNavigate();
  const { conversations, currentSessionId, selectSession, newSession, deleteSession } =
    useConversations();

  return (
    <div className="flex h-screen">
      <Sidebar
        conversations={conversations}
        activeId={currentSessionId ?? ''}
        onSelect={selectSession}
        onNewSession={newSession}
        onDelete={deleteSession}
        onSettings={() => navigate('/settings')}
      />
      <Outlet />
    </div>
  );
}
