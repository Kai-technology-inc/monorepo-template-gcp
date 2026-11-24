import './styles/tokens.css';
import './styles/kit.css';

export { LocaleSwitcher } from './components/LocaleSwitcher';
export {
    AuthContext,
    AuthProvider,
    needsEmailVerification,
    sessionCan,
    useAuth,
    type AuthContextValue,
    type AuthStatus,
    type RegisterInput,
} from './context/AuthContext';
export { sessionFlag, useFlag } from './context/flags';
export {
    ApiError,
    apiErrorFromResponse,
    errorMessageKey,
    isApiError,
    type ApiErrorCode,
} from './lib/api-error';
export { readWebEnv, type WebEnv } from './lib/env';
export { firebaseAuth } from './lib/firebase';
export { firebaseErrorCode, firebaseErrorKey } from './lib/firebase-errors';
export { callApi, type CallApiOptions, type HttpMethod } from './lib/http-client';
export { localeCookieString, readLocaleCookie, writeLocaleCookie } from './lib/locale-cookie';
export { DEFAULT_SIGNED_IN_ROUTE, ROUTES, safeNextPath, withNext } from './lib/navigation';
export { useApiQuery, type ApiQuery } from './lib/use-api-query';
export { useErrorMessage } from './lib/use-error-message';
export { Alert, type AlertTone } from './ui/Alert';
export { Button, ButtonLink, type ButtonProps, type ButtonVariant } from './ui/Button';
export { Card } from './ui/Card';
export { ConfirmDialog, type ConfirmDialogProps } from './ui/ConfirmDialog';
export { EmptyState } from './ui/EmptyState';
export { InlineSelect, SelectField, TextField, type SelectOption } from './ui/Field';
export { Loading, Spinner } from './ui/Spinner';
export { Table, type TableColumn } from './ui/Table';
