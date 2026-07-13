'use client';

import { useState, useEffect } from 'react';
import { useTranscription } from '@/lib/hooks/useTranscription';

interface TranscriptionTestProps {
  sessionId?: string;
}

export default function TranscriptionTest({ sessionId = 'test-session-' + Date.now() }: TranscriptionTestProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [testSessionId, setTestSessionId] = useState(sessionId);
  
  const { loading, error, transcripts, startRecording, stopRecordingAndTranscribe, fetchTranscripts } = useTranscription({
    sessionId: testSessionId,
    callId: testSessionId,
    speaker: 'client',
    archiveToGoogle: false,
  });

  const handleStart = async () => {
    setIsRecording(true);
    await startRecording();
  };

  const handleStop = async () => {
    setIsRecording(false);
    await stopRecordingAndTranscribe();
    await fetchTranscripts();
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', maxWidth: '500px', margin: '20px auto' }}>
      <h2>Transcription Test</h2>
      
      <div style={{ marginBottom: '15px' }}>
        <label>Session ID:</label>
        <input 
          type="text" 
          value={testSessionId} 
          onChange={(e) => setTestSessionId(e.target.value)}
          style={{ width: '100%', padding: '8px', marginTop: '5px' }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        {!isRecording ? (
          <button 
            onClick={handleStart} 
            disabled={loading}
            style={{ padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
          >
            Start Recording
          </button>
        ) : (
          <button 
            onClick={handleStop} 
            disabled={loading}
            style={{ padding: '10px 20px', backgroundColor: '#f44336', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
          >
            Stop & Transcribe
          </button>
        )}
      </div>

      <button 
        onClick={fetchTranscripts}
        disabled={loading}
        style={{ padding: '10px 20px', backgroundColor: '#2196F3', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px', marginLeft: '10px' }}
      >
        Fetch Transcripts
      </button>

      {loading && <p style={{ color: '#2196F3' }}>Processing...</p>}
      {error && <p style={{ color: '#f44336' }}>Error: {error}</p>}

      {transcripts.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>Transcripts ({transcripts.length})</h3>
          {transcripts.map((t) => (
            <div key={t._id} style={{ padding: '10px', marginBottom: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
              <p><strong>Speaker:</strong> {t.speaker}</p>
              <p><strong>Text:</strong> {t.text}</p>
              <p><strong>Confidence:</strong> {(t.confidence * 100).toFixed(1)}%</p>
              <p><strong>Processor:</strong> {t.processor}</p>
              <p style={{ fontSize: '0.9em', color: '#999' }}><strong>Time:</strong> {new Date(t.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
