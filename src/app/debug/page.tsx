'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export default function DebugPage() {
  const [status, setStatus] = useState('Loading...');
  const [details, setDetails] = useState('');

  useEffect(() => {
    async function test() {
      try {
        setStatus('Step 1: Trying single doc read...');
        
        // Try single document read first
        const docRef = doc(db, 'projects', 'pathways-to-purpose-career-guidance');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setStatus(`SUCCESS! Document found: ${data.title}`);
          setDetails(JSON.stringify({
            id: docSnap.id,
            title: data.title,
            verificationStatus: data.verificationStatus,
            verificationBadge: data.verificationBadge,
            category: data.category,
          }, null, 2));
        } else {
          setStatus('Document does NOT exist at projects/pathways-to-purpose-career-guidance');
          
          // Try listing all docs
          const snapshot = await getDocs(collection(db, 'projects'));
          setDetails(`Collection has ${snapshot.size} documents: ${snapshot.docs.map(d => d.id).join(', ')}`);
        }
      } catch (error: unknown) {
        const err = error as Error & { code?: string };
        setStatus(`Error: ${err.message}`);
        setDetails(JSON.stringify({ code: err.code, message: err.message, name: err.name, stack: err.stack?.split('\n').slice(0, 5) }, null, 2));
      }
    }
    test();
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>Firestore Debug</h1>
      <p><strong>NEXT_PUBLIC_USE_EMULATORS:</strong> {process.env.NEXT_PUBLIC_USE_EMULATORS}</p>
      <p><strong>NEXT_PUBLIC_FIREBASE_PROJECT_ID:</strong> {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}</p>
      <hr />
      <p><strong>Status:</strong> {status}</p>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#f0f0f0', padding: '1rem' }}>{details}</pre>
    </div>
  );
}
