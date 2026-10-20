import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { AuthLayout } from '../components/layout';
import { Button, Input } from '../components/ui';
import { useAuth } from '../context';

export default function ForgotPassword() {
  const { requestPasswordReset, isConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    if (!email.trim()) {
      setErrorMessage('Enter the email address you use to sign in.');
      return;
    }
    setIsSubmitting(true);
    const { error } = await requestPasswordReset(email);
    setIsSubmitting(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <AuthLayout>
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Reset your password</h2>
          <p className="text-sm text-gray-500 mt-1">We will email you a secure link to choose a new password.</p>
        </div>

        {!isConfigured && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            Password reset is unavailable until the live Supabase connection is configured.
          </div>
        )}

        {errorMessage && (
          <div role="alert" className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {sent ? (
          <div role="status" className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>If an account exists for that email, a password reset link has been sent. Open it on this device; the link expires after a short time.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              leftIcon={<Mail className="h-4 w-4" />}
              required
              disabled={isSubmitting}
            />
            <Button type="submit" className="w-full" isLoading={isSubmitting} disabled={!isConfigured}>
              Send reset link
            </Button>
          </form>
        )}

        <p className="mt-6 pt-5 border-t border-gray-100 text-center text-xs text-gray-500">
          Remembered it?{' '}
          <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">Back to sign in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
