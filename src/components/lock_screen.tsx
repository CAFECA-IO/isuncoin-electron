'use client';

import React, { useState, useEffect } from 'react';
import { Fingerprint, Lock, ShieldCheck } from 'lucide-react';

interface ILockScreenProps {
  onUnlock: () => void;
}

const LockScreen: React.FC<ILockScreenProps> = ({ onUnlock }) => {
  const [status, setStatus] = useState('Checking Security...');
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState('');

  const [version, setVersion] = useState('v0.0.0');

  useEffect(() => {
    const credId = localStorage.getItem('fido_cred_id');
    if (credId) {
      setIsRegistered(true);
      setStatus('System Locked');
    } else {
      setIsRegistered(false);
      setStatus('Setup Secure Access');
    }

    const fetchVersion = async () => {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const ver = await window.electronAPI.getIsuncoinVersion();
        setVersion(ver);
      }
    };
    fetchVersion();
  }, []);

  // Helpers for ArrayBuffer conversion
  const bufferToBase64 = (buffer: ArrayBuffer) => {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  };

  const base64ToBuffer = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const handleRegister = async () => {
    setStatus('Waiting for FIDO2 Key...');
    setError('');

    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      // ToDo: (20251214 - Luphia) remove simulation
      setTimeout(() => {
        setStatus('Registration Successful');
        localStorage.setItem('fido_cred_id', 'simulated');
        onUnlock();
      }, 500);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: { name: 'iSunCloud Gateway' }, // ID defaults to origin (isuncoin.local)
          user: {
            id: Uint8Array.from('admin', c => c.charCodeAt(0)),
            name: 'admin@isuncoin.com',
            displayName: 'Admin User'
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256
            { alg: -257, type: 'public-key' } // RS256
          ],
          authenticatorSelection: {
            userVerification: 'preferred',
            residentKey: 'preferred',
          },
          timeout: 60000,
          attestation: 'none'
        }
      }) as PublicKeyCredential;

      if (credential) {
        localStorage.setItem('fido_cred_id', bufferToBase64(credential.rawId));
        setIsRegistered(true);
        setStatus('Registration Successful');
        setTimeout(onUnlock, 1000);
      }

    } catch (e: unknown) {
      console.error('FIDO2 Registration Error:', e);
      const err = e as Error;
      setError(`Registration Failed: ${err.message || err.name}`);
      setStatus('Setup Failed');
    }
  };

  const handleAuthenticate = async () => {
    setStatus('Waiting for key...');
    setError('');

    // ToDo: (20251214 - Luphia) remove simulation
    setTimeout(() => {
      setIsRegistered(true);
      setStatus('Unlocked');
      onUnlock();
    }, 500);

    try {
      const savedId = localStorage.getItem('fido_cred_id');
      if (!savedId) throw new Error('No credential found');

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          allowCredentials: [{
            id: base64ToBuffer(savedId),
            type: 'public-key'
          }],
          timeout: 60000
        }
      });

      if (credential) {
        setStatus('Unlocked');
        setTimeout(onUnlock, 500);
      }

    } catch (e: unknown) {
      console.error(e);
      const err = e as Error;
      setError('Unlock Failed: ' + (err.message || 'Unknown Error'));
      setStatus('Try Again');
    }
  };

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      background: 'var(--bg-color)',
      backgroundImage: `
            radial-gradient(circle at 50% 50%, rgba(0, 229, 255, 0.05), transparent 70%),
            linear-gradient(rgba(0, 229, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 229, 255, 0.02) 1px, transparent 1px)
        `,
      backgroundSize: '100% 100%, 50px 50px, 50px 50px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-primary)',
      flexDirection: 'column',
    }}>
      <div style={{
        padding: '3rem',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '24px',
        border: '1px solid rgba(0, 229, 255, 0.2)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 0 50px rgba(0, 0, 0, 0.5)',
        textAlign: 'center',
        maxWidth: '400px',
        width: '90%'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          background: 'rgba(0, 229, 255, 0.1)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 2rem auto',
          color: 'var(--color-primary)',
          boxShadow: '0 0 20px rgba(0, 229, 255, 0.2)'
        }}>
          {isRegistered ? <Lock size={40} /> : <ShieldCheck size={40} />}
        </div>

        <h1 style={{ marginBottom: '0.5rem', fontFamily: "'Courier New', monospace", fontSize: '1.5rem' }}>
          SYSTEM SECURE
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          {status}
        </p>

        {error && (
          <div style={{
            color: 'var(--color-red)',
            background: 'rgba(255, 61, 0, 0.1)',
            padding: '0.5rem',
            borderRadius: '8px',
            fontSize: '0.8rem',
            marginBottom: '1.5rem'
          }}>
            {error}
          </div>
        )}

        <button
          onClick={isRegistered ? handleAuthenticate : handleRegister}
          style={{
            background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))',
            border: 'none',
            color: '#000',
            padding: '1rem 2rem',
            borderRadius: '50px',
            fontSize: '1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            width: '100%',
            transition: 'transform 0.2s',
            boxShadow: '0 0 20px rgba(0, 229, 255, 0.3)'
          }}
        >
          <Fingerprint size={20} />
          {isRegistered ? 'UNLOCK WITH FIDO2' : 'REGISTER FIDO2 KEY'}
        </button>
      </div>

      <div style={{ marginTop: '2rem', opacity: 0.3, fontSize: '0.8rem' }}>
        iSunCloud {version}
      </div>
    </div>
  );
};

export default LockScreen;
