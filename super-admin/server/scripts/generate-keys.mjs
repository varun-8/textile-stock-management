import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const outDir = resolve(process.cwd(), 'keys');
mkdirSync(outDir, { recursive: true });

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

writeFileSync(resolve(outDir, 'license-public.pem'), publicKey);
writeFileSync(resolve(outDir, 'license-private.pem'), privateKey);

console.log(`Generated keys in ${dirname(resolve(outDir, 'license-public.pem'))}`);
