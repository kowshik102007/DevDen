import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { ChatPage } from './pages/ChatPage';

export default function App() {
  const { user, isLoading, login, register, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={login} onRegister={register} />;
  }

  return <ChatPage user={user} onLogout={logout} />;
}
