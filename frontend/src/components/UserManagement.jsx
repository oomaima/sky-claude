import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuthStore } from '../store/authStore';
import { Trash2, Plus } from 'lucide-react';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('BUSINESS_ANALYST');
  const token = useAuthStore(state => state.token);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/api/users/');
      setUsers(res.data);
      setUsers(res.data);
    } catch (error) {
      console.error("Error fetching users", error);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/users/', {
        email: newUserEmail,
        password: newUserPassword,
        full_name: newUserFullName,
        role: newUserRole
      });
      setNewUserEmail('');
      setNewUserFullName('');
      setNewUserPassword('');
      fetchUsers();
    } catch (error) {
      alert("Failed to create user");
    }
  };

  const handleDeleteUser = async (id) => {
    if(!window.confirm("Are you sure?")) return;
    try {
      await api.delete(`/api/users/${id}`);
      fetchUsers();
      fetchUsers();
    } catch (error) {
      alert("Failed to delete user");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white m-4 rounded-2xl shadow-sm border border-slate-200">
      <div className="p-8 border-b border-slate-200">
        <h2 className="text-2xl font-bold text-slate-800">User Management</h2>
        <p className="text-slate-500 text-sm mt-1">Add, modify, or delete platform users.</p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* User List */}
        <div className="w-2/3 border-r border-slate-200 p-8 overflow-y-auto">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Current Users</h3>
          <div className="space-y-4">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                <div>
                  <p className="font-bold text-slate-800">{u.full_name || 'No Name'}</p>
                  <p className="text-sm text-slate-500">{u.email}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{u.role}</p>
                </div>
                {u.role !== 'SUPER_ADMIN' && (
                  <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Add User Form */}
        <div className="w-1/3 p-8 bg-slate-50 overflow-y-auto">
          <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center">
            <Plus className="w-5 h-5 mr-2" />
            Add New User
          </h3>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-genviz-accent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input type="text" value={newUserFullName} onChange={e => setNewUserFullName(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-genviz-accent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-genviz-accent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-genviz-accent outline-none">
                <option value="BUSINESS_ANALYST">Business Analyst</option>
                <option value="DATA_ANALYST">Data Analyst</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>
            <button type="submit" className="w-full bg-genviz-accent hover:bg-genviz-accentHover text-white font-medium py-2.5 rounded-lg transition-colors mt-4">
              Create User
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
