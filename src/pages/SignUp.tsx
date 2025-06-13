import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function SignUp() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to login since signup is not currently implemented
    navigate('/login');
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to login...</p>
      </div>
    </div>
  );
} 