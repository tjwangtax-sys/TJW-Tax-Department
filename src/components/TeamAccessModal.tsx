import React, { useEffect, useState } from 'react';
import { X, Shield, UserCheck, UserX, Plus } from 'lucide-react';
import { fetchStaffUsers, upsertStaffUser, setStaffActiveStatus, setStaffRole, type StaffUser, type StaffRole } from '../lib/staffService';

interface TeamAccessModalProps {
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const TeamAccessModal: React.FC<TeamAccessModalProps> = ({ onClose, onNotify }) => {
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<StaffRole>('PIC');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const list = await fetchStaffUsers();
      setStaffList(list);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load team access list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStaff();
  }, []);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setErrorMsg('Please enter a valid staff email.');
      return;
    }
    setErrorMsg(null);
    try {
      await upsertStaffUser(newEmail.trim(), newName.trim() || newEmail.split('@')[0], newRole, true);
      onNotify(`Added staff member ${newEmail} as ${newRole}.`);
      setNewEmail('');
      setNewName('');
      setShowAddForm(false);
      await loadStaff();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add staff.');
    }
  };

  const handleToggleActive = async (staff: StaffUser) => {
    try {
      const nextActive = !staff.active;
      await setStaffActiveStatus(staff.email, nextActive);
      onNotify(`Updated ${staff.email} active status to ${nextActive ? 'Active' : 'Deactivated'}.`);
      await loadStaff();
    } catch (err) {
      onNotify('Failed to update status.');
    }
  };

  const handleChangeRole = async (staff: StaffUser, newRoleVal: StaffRole) => {
    try {
      await setStaffRole(staff.email, newRoleVal);
      onNotify(`Updated ${staff.email} role to ${newRoleVal}.`);
      await loadStaff();
    } catch (err) {
      onNotify('Failed to update role.');
    }
  };



  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#D6D3D1] max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#790D16] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 font-display font-bold text-base">
            <Shield className="w-5 h-5 text-[#E5D3AF]" />
            <span>Staff Access Control &amp; Role Management</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#E5D3AF] hover:text-white cursor-pointer p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#57534E]">
              Manage TJW Group tax professionals, assign roles (Admin, Reviewer, PIC), and restrict portal access for unauthorized accounts.
            </p>
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="px-3 py-1.5 bg-[#790D16] text-white text-xs font-semibold hover:bg-[#5E0A11] inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'Cancel' : 'Add Staff Member'}</span>
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800">
              {errorMsg}
            </div>
          )}

          {showAddForm && (
            <form onSubmit={handleAddStaff} className="p-4 bg-[#F5EFE1] border border-[#E5D3AF] space-y-3">
              <div className="text-xs font-bold text-[#1C1917]">Provision New Staff Account</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#57534E] mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="staff@tjwang.com.my"
                    required
                    className="w-full px-3 py-1.5 text-xs bg-white border border-[#D6D3D1] focus:outline-none focus:border-[#790D16]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#57534E] mb-1">Staff Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Rachel Tan"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-[#D6D3D1] focus:outline-none focus:border-[#790D16]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#57534E] mb-1">Access Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as StaffRole)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-[#D6D3D1] focus:outline-none focus:border-[#790D16]"
                >
                  <option value="PIC">PIC (Person in Charge)</option>
                  <option value="Reviewer">Reviewer (Senior / Manager)</option>
                  <option value="Admin">Admin (Director / IT)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#790D16] text-white text-xs font-semibold hover:bg-[#5E0A11] cursor-pointer"
                >
                  Save &amp; Grant Access
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="py-8 text-center text-xs text-[#57534E]">Loading staff team directory...</div>
          ) : (
            <div className="border border-[#E5E7EB] overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF9F6] text-[#57534E] border-b border-[#E5E7EB] font-semibold">
                  <tr>
                    <th className="p-3">Staff Member</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {staffList.map((st) => (
                    <tr key={st.email} className="hover:bg-[#FAF9F6]">
                      <td className="p-3 font-medium text-[#1C1917]">{st.name}</td>
                      <td className="p-3 font-mono text-[#57534E]">{st.email}</td>
                      <td className="p-3">
                        <select
                          value={st.role}
                          onChange={(e) => void handleChangeRole(st, e.target.value as StaffRole)}
                          className="px-2 py-1 text-xs border border-[#D6D3D1] bg-white font-medium focus:outline-none"
                        >
                          <option value="Admin">Admin</option>
                          <option value="Reviewer">Reviewer</option>
                          <option value="PIC">PIC</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold ${
                            st.active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {st.active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => void handleToggleActive(st)}
                          className={`px-2.5 py-1 text-[11px] font-semibold border inline-flex items-center gap-1 cursor-pointer ${
                            st.active
                              ? 'border-red-300 text-red-700 hover:bg-red-50'
                              : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {st.active ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                          <span>{st.active ? 'Deactivate' : 'Activate'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#FAF9F6] border-t border-[#E5E7EB] flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-[#D6D3D1] text-[#1C1917] text-xs font-semibold hover:bg-[#F5EFE1] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
