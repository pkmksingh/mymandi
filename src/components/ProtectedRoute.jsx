import { Navigate } from 'react-router-dom';
import { useStore } from '../store';

export function ProtectedRoute({ children, requiredRole }) {
  const { currentUser } = useStore();

  if (!currentUser) {
    // Redirect to the registration/auth page if not logged in
    return <Navigate to="/" replace />;
  }

  if (requiredRole && currentUser.role !== requiredRole) {
    // If they have the wrong role, redirect back to their appropriate dashboard
    return <Navigate to={currentUser.role === 'buyer' ? '/buyer' : '/seller'} replace />;
  }

  return children;
}
