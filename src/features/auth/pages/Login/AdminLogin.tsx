import React from 'react';
import { AdminLoginProps } from '@/types';
import { Login } from './Login';

// AdminLogin now uses the unified Login component with admin mode
export const AdminLogin: React.FC<AdminLoginProps> = (props) => {
  return <Login {...props} loginType="admin" />;
};
