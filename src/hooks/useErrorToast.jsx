import { useState, useCallback } from 'react';
import ErrorToast from '../components/ErrorToast';

export default function useErrorToast() {
  const [message, setMessage] = useState(null);
  const showError = useCallback((msg) => setMessage(msg || 'An unexpected error occurred.'), []);
  const toast = message
    ? <ErrorToast message={message} onClose={() => setMessage(null)} />
    : null;
  return [showError, toast];
}
