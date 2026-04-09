# Super Admin

Private cloud control plane for LoomTrack/Prodexa licensing.

Structure:
- `server/` private API for login, license issuance, reset-code issuance, and revocation
- `server/public/` no-index HTML portal for direct access by URL only

Security notes:
- Use RSA keys stored outside source control
- Serve only over HTTPS
- Keep this deployment behind your own auth or network policy
