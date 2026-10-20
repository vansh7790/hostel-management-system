import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from '../components/layout';
import { Button, Input } from '../components/ui';
import { useAuth } from '../context';

export default function Register() {
  const navigate = useNavigate();
  const { signUp, resendConfirmation, loading: authLoading, isConfigured } = useAuth();
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const handleResend = async () => {
    setResendStatus('Sending...');
    const { error } = await resendConfirmation(email);
    setResendStatus(error ? `Could not resend: ${error.message}` : 'A new confirmation email has been sent if the account is still unconfirmed.');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim();
    const cleanStudentId = studentId.trim();

    if (!isConfigured) {
      setErrorMessage('Registration requires the live Supabase connection.');
      return;
    }
    if (!cleanName) {
      setErrorMessage('Enter your full name.');
      return;
    }
    if (!cleanEmail) {
      setErrorMessage('Enter a valid email address.');
      return;
    }
    if (!cleanStudentId) {
      setErrorMessage('Enter the student ID from your student record.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const result = await signUp(cleanEmail, password, cleanName, cleanStudentId);
    setIsSubmitting(false);

    if (result.error) {
      setErrorMessage(result.error.message);
      return;
    }

    if (result.needsEmailConfirmation) {
      setAwaitingConfirmation(true);
      setSuccessMessage('Account created. Confirm your email, then sign in. Your student ID and verified email must match the student record. If your record was not pre-created or the details do not match, contact the hostel administrator to complete registration.');
      return;
    }

    if (result.role) {
      navigate(`/${result.role}`, { replace: true });
    } else {
      setSuccessMessage('Account created. You can now continue to your student portal.');
    }
  };

  return (
    <AuthLayout>
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Create your account</h2>
          <p className="text-sm text-gray-500 mt-1">New accounts start as student accounts.</p>
        </div>

        {!isConfigured && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            Live Supabase registration is unavailable until the connection is configured.
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {awaitingConfirmation && (
          <p className="mb-4 text-xs text-gray-600">
            Didn&apos;t receive it?{' '}
            <button type="button" onClick={() => void handleResend()} className="font-medium text-primary-600 hover:text-primary-700">
              Resend confirmation email
            </button>
            {resendStatus && <span className="block mt-1">{resendStatus}</span>}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full name"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
            required
            disabled={isSubmitting || authLoading}
          />
          <Input
            label="College email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            disabled={isSubmitting || authLoading}
          />
          <Input
            label="Student ID"
            type="text"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            autoComplete="off"
            helperText="Use the student ID shown on your student record."
            required
            disabled={isSubmitting || authLoading}
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            helperText="Use at least 8 characters."
            required
            disabled={isSubmitting || authLoading}
          />
          <Input
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            required
            disabled={isSubmitting || authLoading}
          />
          <Button
            type="submit"
            className="w-full mt-2"
            size="md"
            isLoading={isSubmitting || authLoading}
            rightIcon={<ArrowRight className="h-4 w-4" />}
            disabled={!isConfigured}
          >
            Create student account
          </Button>
        </form>

        <p className="mt-6 pt-5 border-t border-gray-100 text-center text-xs text-gray-500">
          Already registered?{' '}
          <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
