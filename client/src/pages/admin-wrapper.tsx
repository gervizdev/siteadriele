import { useState } from "react";
import Login from "./login";
import AdminPanel from "./admin";

export default function AdminWrapper() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return <AdminPanel />;
}