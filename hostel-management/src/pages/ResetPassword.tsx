import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { AuthLayout } from '../components/layout';
import { Button, Input, LoadingSpinner } from '../components/ui';
import { useAuth } from '../context';

// Supabase appends errors to the redirect URL hash, e.g. #error_code=otp_expired&error_description=...
function readLinkError(): string | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const description = params.get('error_description');
  return description ? description.replace(/\+/g, ' ') : null;
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const { user, loading, updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [linkError] = useState(readLinkError);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    const { error } = await updatePassword(password);
    if (error) {
      setIsSubmitting(false);
      setErrorMessage(error.message);
      return;
    }
    // End the recovery session so the new password is proven on the next sign-in.
    await signOut();
    setIsSubmitting(false);
    navigate('/login', { replace: true, state: { notice: 'Your password was updated. Sign in with the new password.' } });
  };

  const invalidLink = !loading && !user;

  return (
    <AuthLayout>
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Choose a new password</h2>
          <p className="text-sm text-gray-500 mt-1">This page works only from the reset link sent to your email.</p>
        </div>

        {loading ? (
          <LoadingSpinner message="Verifying your reset link..." />
        ) : invalidLink ? (
          <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              {linkError || 'This reset link is invalid or has expired.'}{' '}
              <Link to="/forgot-password" className="font-medium underline">Request a new link</Link>.
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
            <p className="text-xs text-gray-500">Resetting the password for {user?.email}.</p>
            <Input label="New password" type="password" value={password} onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password" helperText="Use at least 8 characters." required disabled={isSubmitting} />
            <Input label="Confirm new password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password" required disabled={isSubmitting} />
            <Button type="submit" className="w-full" isLoading={isSubmitting}>Update password</Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
