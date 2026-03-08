import { useState } from "react";

interface AuthPanelProps {
  configured: boolean;
  isOwner: boolean;
  userEmail: string | null;
  authError: string;
  authStatus: string;
  showImportLocal: boolean;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onImportLocal: () => Promise<void>;
}

export function AuthPanel({
  configured,
  isOwner,
  userEmail,
  authError,
  authStatus,
  showImportLocal,
  onSignIn,
  onSignOut,
  onImportLocal
}: AuthPanelProps): JSX.Element {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  if (!configured) {
    return (
      <div className="utilityItem authPanel">
        <div className="utilityItemHeader">
          <h2>Auth</h2>
        </div>
        <p className="uploadError">Supabase auth is not configured. Add environment variables to enable owner login.</p>
      </div>
    );
  }

  return (
    <div className="utilityItem authPanel">
      <div className="utilityItemHeader">
        <h2>Owner Access</h2>
      </div>
      {isOwner ? (
        <div className="authPanelRow">
          <p className="uploadStatus">Signed in as {userEmail ?? "owner"}.</p>
          <button
            type="button"
            className="navButton bubbleInteractive"
            disabled={pending}
            onClick={async () => {
              try {
                setPending(true);
                await onSignOut();
              } finally {
                setPending(false);
              }
            }}
          >
            Sign out
          </button>
        </div>
      ) : (
        <>
          <div className="authPanelRow">
            <input
              className="glassInput"
              type="email"
              value={email}
              placeholder="Owner email"
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              className="glassInput"
              type="password"
              value={password}
              placeholder="Password"
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="navButton bubbleInteractive"
              disabled={pending || email.trim().length === 0 || password.length === 0}
              onClick={async () => {
                try {
                  setPending(true);
                  await onSignIn(email.trim(), password);
                  setPassword("");
                } finally {
                  setPending(false);
                }
              }}
            >
              Sign in
            </button>
          </div>
          <p className="uploadStatus">Read-only mode until owner login succeeds.</p>
        </>
      )}
      {showImportLocal && isOwner ? (
        <div className="authPanelRow">
          <button
            type="button"
            className="navButton bubbleInteractive"
            disabled={pending}
            onClick={async () => {
              try {
                setPending(true);
                await onImportLocal();
              } finally {
                setPending(false);
              }
            }}
          >
            Import local data to cloud
          </button>
        </div>
      ) : null}
      {authStatus ? <p className="uploadStatus">{authStatus}</p> : null}
      {authError ? <p className="uploadError">{authError}</p> : null}
    </div>
  );
}
