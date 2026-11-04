import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { changePassword } from '../db/repositories/users';
import { TOAST_MESSAGES, BUTTON_TEXT } from '../constants/appConstants';

const UbahPassword = ({ user: propUser, isEmbedded = false }) => {
  const navigate = useNavigate();
  const sessionUser = JSON.parse(sessionStorage.getItem('user') || '{}');
  const user = propUser || sessionUser;

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!oldPassword.trim()) {
      toast.error('Password lama wajib diisi');
      return;
    }
    if (!newPassword.trim()) {
      toast.error('Password baru wajib diisi');
      return;
    }
    if (newPassword.length < 5) {
      toast.error('Password baru minimal 5 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi password tidak cocok');
      return;
    }

    setIsLoading(true);
    try {
      await changePassword({
        userId: user?.uuid || user?.id,
        username: user?.username,
        oldPassword,
        newPassword
      });

      toast.success(TOAST_MESSAGES.SUCCESS);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.message || TOAST_MESSAGES.ERROR);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`ubah-password-wrapper ${isEmbedded ? '' : 'py-3'}`}>
      {!isEmbedded && (
        <div className="d-flex align-items-center gap-2 mb-3">
          <button
            type="button"
            className="btn btn-sm btn-light border rounded-circle shadow-xs d-flex align-items-center justify-content-center"
            style={{ width: '36px', height: '36px' }}
            onClick={() => navigate(-1)}
          >
            <i className="bi bi-arrow-left"></i>
          </button>
          <h5 className="fw-bold mb-0">Ubah Password</h5>
        </div>
      )}

      {/* Form Ubah Password */}
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-3 p-sm-4">
          <div className="d-flex align-items-center gap-2 mb-3 pb-2 border-bottom">
            <i className="bi bi-shield-lock-fill text-primary fs-5"></i>
            <div>
              <h6 className="fw-bold mb-0">Keamanan Akun</h6>
              <small className="text-muted" style={{ fontSize: '0.75rem' }}>Ganti kata sandi secara berkala</small>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Password Lama */}
            <div className="mb-3">
              <label className="small fw-bold text-muted mb-1">Password Lama</label>
              <div className="input-group">
                <input
                  type={showOld ? 'text' : 'password'}
                  className="form-control border bg-light rounded-start-3 py-4"
                  placeholder="Password saat ini"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="btn btn-light border border-start-0 rounded-end-3 text-muted"
                  onClick={() => setShowOld(!showOld)}
                  tabIndex="-1"
                >
                  <i className={`bi ${showOld ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
            </div>

            {/* Password Baru */}
            <div className="mb-3">
              <label className="small fw-bold text-muted mb-1">Password Baru</label>
              <div className="input-group">
                <input
                  type={showNew ? 'text' : 'password'}
                  className="form-control border bg-light rounded-start-3 py-4"
                  placeholder="Minimal 5 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={5}
                />
                <button
                  type="button"
                  className="btn btn-light border border-start-0 rounded-end-3 text-muted"
                  onClick={() => setShowNew(!showNew)}
                  tabIndex="-1"
                >
                  <i className={`bi ${showNew ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
            </div>

            {/* Konfirmasi Password Baru */}
            <div className="mb-4">
              <label className="small fw-bold text-muted mb-1">Konfirmasi Password Baru</label>
              <div className="input-group">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  className="form-control border bg-light rounded-start-3 py-4"
                  placeholder="Ulangi password baru"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={5}
                />
                <button
                  type="button"
                  className="btn btn-light border border-start-0 rounded-end-3 text-muted"
                  onClick={() => setShowConfirm(!showConfirm)}
                  tabIndex="-1"
                >
                  <i className={`bi ${showConfirm ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <div className="text-danger small mt-1" style={{ fontSize: '0.72rem' }}>
                  Konfirmasi password tidak cocok!
                </div>
              )}
            </div>

            {/* Tombol Simpan */}
            <button
              type="submit"
              className="btn btn-outline-primary w-100 rounded-pill fw-bold shadow-sm py-2 d-flex align-items-center justify-content-center gap-2"
              disabled={isLoading || (newPassword && confirmPassword && newPassword !== confirmPassword)}
            >
              {isLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  <span>{BUTTON_TEXT.SAVING}</span>
                </>
              ) : (
                <>
                  <i className="bi bi-check-lg"></i>
                  <span>{BUTTON_TEXT.SAVE}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UbahPassword;
