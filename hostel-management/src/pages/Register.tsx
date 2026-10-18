import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from '../components/layout';
import { Button, Input } from '../components/ui';
import { useAuth } from '../context';

export default function Register() {
  const navigate = useNavigate();
  const { signUp, loading: authLoading, isConfigured } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim();

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
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const result = await signUp(cleanEmail, password, cleanName);
    setIsSubmitting(false);

    if (result.error) {
      setErrorMessage(result.error.message);
      return;
    }

    if (result.needsEmailConfirmation) {
      setSuccessMessage('Account created. Check your email to confirm your account, then sign in.');
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
