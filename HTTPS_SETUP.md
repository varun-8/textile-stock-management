# HTTPS Certificate Setup for Development

Your backend requires HTTPS certificates for camera access in the mobile app.

## Prerequisites
Install mkcert (local CA for HTTPS):

**Windows (with Chocolatey):**
```powershell
choco install mkcert
```

**Windows (without Chocolatey):**
Download from: https://github.com/FiloSottile/mkcert/releases

**Mac:**
```bash
brew install mkcert
```

**Linux:**
```bash
apt-get install -y libnss3-tools
wget https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64
chmod +x mkcert-v1.4.4-linux-amd64
sudo mv mkcert-v1.4.4-linux-amd64 /usr/local/bin/mkcert
```

## Generate Certificates

Navigate to your backend folder and run:

```powershell
cd backend

# Create local CA (do this once)
mkcert -install

# Generate certificates for your local network
mkcert -key-file stock-system.local-key.pem -cert-file stock-system.local.pem localhost 127.0.0.1 "*.local" 192.168.*.* 10.*.*.* 172.16.*.*
```

This will create:
- `stock-system.local-key.pem` - Private key
- `stock-system.local.pem` - Certificate

Both files should be in the `backend/` folder (same location as server.js)

## Verify HTTPS is Working

1. Start the backend: `npm start`
2. Open browser to: `https://YOUR_LAN_IP:5000`
3. You should see no certificate warning (because mkcert installed a local CA)

## Mobile App Usage

- Mobile app will automatically use HTTPS now
- Camera permissions will work properly on Android/iOS
- No more certificate warnings

## Note

These certificates are **for local development only**. For production, use proper certificates from a CA like Let's Encrypt.
